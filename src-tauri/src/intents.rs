//! What a coding agent can ask of tiili: a small, fixed table of intents, each with one recipe. `tiili describe`
//! lists it as `intents`, `tiili prompt` prints it for pasting into agent prompts, and the tiili-tiles skill carries
//! it between its intents markers.
//!
//! An intent stays a recipe built from existing commands; it becomes a command or flag of its own only when the
//! recipe would race, need its output parsed, or be impossible.

/// One thing an agent may want from tiili, and the one way to do it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Intent {
    pub name: &'static str,
    /// When an agent reaches for it.
    pub when: &'static str,
    /// The command to run, with placeholders in capitals.
    pub recipe: &'static str,
    /// What to know after running it.
    pub notes: &'static str,
}

/// Every agent intent, in the order they are shown.
pub const INTENTS: &[Intent] = &[
    Intent {
        name: "fan-out",
        when: "a task should run in its own pane, one agent session per task",
        recipe: r#"tiili open --cwd DIR -- claude "PROMPT""#,
        notes: "the new session does not see this conversation, so PROMPT says everything the task needs",
    },
    Intent {
        name: "run-beside",
        when: "a long-running command (a dev server, a watcher, tests) should run beside you while you read its output",
        recipe: "tiili open --key dev -- sh -c 'CMD 2>&1 | tee FILE'",
        notes: "then read FILE; it prints opened ID, and running it again with the same --key prints reused ID instead of opening a second pane; tiili close ID closes it",
    },
    Intent {
        name: "need-you",
        when: "you need the user: a question, a finished task, something to review",
        recipe: r#"tiili attention "MSG""#,
        notes: "marks your own pane with MSG while the user is elsewhere; it clears when they focus the pane, or with tiili attention --clear",
    },
    Intent {
        name: "find-reuse",
        when: "you want to find a pane to reuse, read or close",
        recipe: "tiili list --json",
        notes: "each pane in panes has id, cwd, title, running.command, tab, key, self and opened_by_you; tiili close works only on panes with opened_by_you true",
    },
];

/// The comment the skill's intents section starts after.
pub const SKILL_BEGIN: &str = "<!-- tiili:intents:begin -->";
/// The comment the skill's intents section ends before.
pub const SKILL_END: &str = "<!-- tiili:intents:end -->";

/// `tiili prompt`'s text: the intents as plain text to paste into an agent's prompt.
pub fn render_prompt() -> String {
    let mut text = String::from(
        "You are running in a tiili terminal pane. To work with tiili, use these recipes:\n",
    );
    for intent in INTENTS {
        text.push_str(&format!(
            "\n{}: when {}.\n  {}\n  ({})\n",
            intent.name, intent.when, intent.recipe, intent.notes
        ));
    }
    text.push_str(
        "\nWhen a tiili command fails it prints tiili: <what went wrong> and a hint: line with the fix.\n",
    );
    text
}

/// The Markdown the skill holds between [`SKILL_BEGIN`] and [`SKILL_END`].
pub fn render_skill_section() -> String {
    let mut text = String::new();
    for intent in INTENTS {
        text.push_str(&format!(
            "- **{}**: when {}.\n\n  ```sh\n  {}\n  ```\n\n  {}{}.\n\n",
            intent.name,
            intent.when,
            intent.recipe,
            intent.notes[..1].to_uppercase(),
            &intent.notes[1..]
        ));
    }
    text.truncate(text.trim_end().len());
    text.push('\n');
    text
}

/// The intents as `tiili describe` lists them.
pub fn describe_intents() -> serde_json::Value {
    INTENTS
        .iter()
        .map(|i| {
            serde_json::json!({ "name": i.name, "when": i.when, "recipe": i.recipe, "notes": i.notes })
        })
        .collect()
}

/// `text` with what lies between the intents markers replaced by `section`, or `None` without both markers.
pub fn with_skill_section(text: &str, section: &str) -> Option<String> {
    let begin = text.find(SKILL_BEGIN)? + SKILL_BEGIN.len();
    let end = begin + text[begin..].find(SKILL_END)?;
    Some(format!("{}\n{section}{}", &text[..begin], &text[end..]))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Table changes: the intents section of the tiili-tiles skill matches the table, else this fails;
    /// `TIILI_BLESS=1` rewrites the section from the table.
    #[test]
    fn table_changes_the_skill_section_matches_the_table() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../integrations/claude/skills/tiili-tiles/SKILL.md"
        );
        let text = std::fs::read_to_string(path).expect("SKILL.md reads");
        let expected = with_skill_section(&text, &render_skill_section())
            .expect("SKILL.md has the intents markers");
        if std::env::var_os("TIILI_BLESS").is_some_and(|v| v == "1") {
            std::fs::write(path, &expected).expect("SKILL.md writes");
            return;
        }
        assert!(
            text == expected,
            "the intents section of SKILL.md differs from the intent table; run with TIILI_BLESS=1 to rewrite it"
        );
    }

    /// Prompt fragment: it names every intent with its recipe.
    #[test]
    fn prompt_fragment_lists_every_intent_and_recipe() {
        let prompt = render_prompt();
        assert_eq!(INTENTS.len(), 4);
        for intent in INTENTS {
            assert!(prompt.contains(intent.name), "{}", intent.name);
            assert!(prompt.contains(intent.recipe), "{}", intent.name);
        }
        assert_eq!(describe_intents().as_array().map(Vec::len), Some(4));
    }

    #[test]
    fn the_section_goes_between_the_markers() {
        let cases = [
            (
                format!("a\n{SKILL_BEGIN}\nold\n{SKILL_END}\nb"),
                Some(format!("a\n{SKILL_BEGIN}\nnew\n{SKILL_END}\nb")),
            ),
            ("no markers".to_string(), None),
            (format!("{SKILL_END}{SKILL_BEGIN}"), None),
        ];
        for (text, expected) in cases {
            assert_eq!(with_skill_section(&text, "new\n"), expected, "{text}");
        }
    }
}
