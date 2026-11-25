// @harvaaja-test-tier: fast
//! `tiili follow`: reading Oh My Pi and Claude Code transcript entries, drawing them, and following a transcript
//! file until the session ends.

use std::cell::Cell;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

use serde_json::{json, Value};
use tiili_lib::follow::{
    clean, events_of, follow, summarize_args, Ending, Event, Options, Renderer,
};

fn text(s: &str) -> String {
    s.to_string()
}

/// Oh My Pi and Claude Code entries become the same events; bookkeeping entries give none.
#[test]
fn transcript_entries_become_events() {
    let cases: Vec<(&str, Value, Vec<Event>)> = vec![
        (
            "omp task",
            json!({"type": "message", "message": {"role": "user", "content": [{"type": "text", "text": "Count files"}]}}),
            vec![Event::User(text("Count files"))],
        ),
        (
            "omp thinking, tool call with its intent, reply",
            json!({"type": "message", "message": {"role": "assistant", "content": [
                {"type": "thinking", "thinking": "Use ls."},
                {"type": "toolCall", "name": "bash", "arguments": {"command": "ls | wc -l"}, "intent": "Counting files"},
                {"type": "text", "text": "2"},
            ]}}),
            vec![
                Event::Thinking(text("Use ls.")),
                Event::Tool {
                    name: text("bash"),
                    summary: text("Counting files"),
                },
                Event::Text(text("2")),
            ],
        ),
        (
            "omp failed tool result",
            json!({"type": "message", "message": {"role": "toolResult", "isError": true, "content": [{"type": "text", "text": "boom"}]}}),
            vec![Event::Result {
                text: text("boom"),
                error: true,
            }],
        ),
        (
            "omp 18.21 session_exit record",
            json!({"type": "custom", "customType": "session_exit", "data": {"reason": "dispose"}}),
            vec![Event::End(Some(text("dispose")))],
        ),
        (
            "older omp session_exit record",
            json!({"type": "session_exit", "reason": "done"}),
            vec![Event::End(Some(text("done")))],
        ),
        (
            "omp compaction",
            json!({"type": "compaction"}),
            vec![Event::Note(text("context compacted"))],
        ),
        (
            "omp model change",
            json!({"type": "model_change", "model": "x"}),
            vec![],
        ),
        (
            "omp custom reminder",
            json!({"type": "custom", "customType": "date-cwd-reminder", "data": {}}),
            vec![],
        ),
        (
            "Claude string task",
            json!({"type": "user", "message": {"role": "user", "content": "Review this"}}),
            vec![Event::User(text("Review this"))],
        ),
        (
            "Claude tool_use",
            json!({"type": "assistant", "message": {"role": "assistant", "content": [{"type": "tool_use", "name": "Read", "input": {"file_path": "/a.ts"}}]}}),
            vec![Event::Tool {
                name: text("Read"),
                summary: text("/a.ts"),
            }],
        ),
        (
            "Claude tool_result",
            json!({"type": "user", "message": {"role": "user", "content": [{"type": "tool_result", "content": "ok", "is_error": false}]}}),
            vec![Event::Result {
                text: text("ok"),
                error: false,
            }],
        ),
        (
            "Claude request bookkeeping",
            json!({"type": "api-request", "params": {}}),
            vec![],
        ),
        (
            "Claude attachment",
            json!({"type": "attachment", "attachment": {}}),
            vec![],
        ),
        ("not an object", json!("text"), vec![]),
    ];
    for (name, entry, expected) in cases {
        assert_eq!(events_of(&entry), expected, "{name}");
    }
}

/// Control sequences are stripped from transcript text, keeping tabs and newlines; arguments are summarised by
/// their stated intent or most telling field, else as JSON.
#[test]
fn text_is_cleaned_and_arguments_summarised() {
    let cleaned: &[(&str, &str)] = &[
        (
            "a\x1b[31mred\x1b[0m\x1b]0;title\x07b\x07\tc\n",
            "aredb\tc\n",
        ),
        ("\x1b]8;;http://x\x1b\\link\x1b]8;;\x1b\\", "link"),
        ("a\u{9b}b\x7fc", "abc"),
    ];
    for (raw, expected) in cleaned {
        assert_eq!(clean(raw), *expected, "{raw:?}");
    }
    let summaries: &[(Option<Value>, Option<&str>, &str)] = &[
        (
            Some(json!({"path": "src", "i": "Listing src"})),
            None,
            "Listing src",
        ),
        (Some(json!({"pattern": "TODO"})), None, "TODO"),
        (Some(json!({"a": 1})), None, r#"{"a":1}"#),
        (Some(json!({"command": "ls\n  -la"})), None, "ls -la"),
        (Some(json!({"command": "ls"})), Some("Listing"), "Listing"),
        (None, None, ""),
    ];
    for (args, intent, expected) in summaries {
        assert_eq!(
            summarize_args(args.as_ref(), *intent),
            *expected,
            "{args:?}"
        );
    }
    let long = summarize_args(Some(&json!({"command": "x".repeat(400)})), None);
    assert_eq!(long.chars().count(), 160);
}

/// A long tool result shows its first three lines and how many more there are; the first message is headed
/// differently from later ones.
#[test]
fn long_results_are_cut_and_the_first_message_is_the_task() {
    let mut renderer = Renderer::new(false);
    let result = renderer.render(&Event::Result {
        text: text("1\n2\n3\n4\n5"),
        error: false,
    });
    // Three lines, the count of the rest, and a blank line.
    assert_eq!(result.len(), 5, "{result:?}");
    assert!(result[3].contains('2'), "{result:?}");
    assert!(
        !result.iter().any(|l| l.contains('4') || l.contains('5')),
        "{result:?}"
    );
    let empty = renderer.render(&Event::Result {
        text: text("\n\n"),
        error: true,
    });
    assert_eq!(empty.len(), 2, "{empty:?}");

    let task = renderer.render(&Event::User(text("a")));
    let message = renderer.render(&Event::User(text("b")));
    assert_ne!(task[0], message[0]);
    assert_eq!(message, renderer.render(&Event::User(text("b"))));
}

/// A transcript file that does not exist yet, and a scratch folder that is removed afterwards.
struct Scratch(PathBuf);

impl Scratch {
    fn new(name: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("tiili-follow-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }

    fn append(&self, file: &str, data: &str) {
        let mut f = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.0.join(file))
            .unwrap();
        f.write_all(data.as_bytes()).unwrap();
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

const TASK: &str = r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"Count \u001b[31mfiles"}]}}"#;
const REPLY: &str = r#"{"type":"message","message":{"role":"assistant","content":[{"type":"text","text":"There are 2"}]}}"#;
const EXIT: &str = r#"{"type":"custom","customType":"session_exit","data":{"reason":"dispose"}}"#;

/// Subagent ends: the transcript appears after a wait, grows a line at a time (one written in two halves), and
/// following stops at its `session_exit` record, at the done marker or when the process is gone, after printing
/// what came before and a closing line saying the subagent finished (or that its process is gone) and that the pane
/// is about to close.
#[test]
fn subagent_ends_following_stops_after_printing_the_transcript() {
    let half = TASK.len() / 2;
    let task_halves = [&TASK[..half], &TASK[half..]];
    // Name, what each poll writes (file name, text), whether the process is alive, the done marker, the ending,
    // and whether the reply is printed.
    type Case<'a> = (&'a str, Vec<(&'a str, String)>, bool, bool, Ending, bool);
    let cases: Vec<Case> = vec![
        (
            "session_exit",
            vec![
                ("t.jsonl", task_halves[0].to_string()),
                ("t.jsonl", format!("{}\n", task_halves[1])),
                ("t.jsonl", format!("{REPLY}\n{EXIT}\n{REPLY}\n")),
            ],
            true,
            false,
            Ending::Finished,
            true,
        ),
        (
            "done marker",
            vec![
                ("t.jsonl", format!("{TASK}\n")),
                ("t.jsonl", format!("{REPLY}\n")),
                ("done", String::new()),
            ],
            true,
            true,
            Ending::Finished,
            true,
        ),
        (
            "process gone",
            vec![("t.jsonl", format!("{TASK}\n{REPLY}\n"))],
            false,
            false,
            Ending::Gone,
            true,
        ),
    ];
    for (name, writes, alive, with_done, ending, reply) in cases {
        let scratch = Scratch::new(&name.replace(' ', "-"));
        let options = Options {
            file: scratch.0.join("t.jsonl"),
            title: Some("worker".to_string()),
            pid: Some(1),
            done: with_done.then(|| scratch.0.join("done")),
        };
        // The process runs until the last write has landed; then it may be gone.
        let left = Cell::new(writes.len());
        let mut writes = writes.into_iter();
        let mut polls = 0;
        let mut wait = |_| {
            polls += 1;
            if let Some((file, data)) = writes.next() {
                scratch.append(file, &data);
                left.set(left.get() - 1);
            }
            polls < 20
        };
        let mut out = Vec::new();
        let alive_now = |_| alive || left.get() > 0;
        let got = follow(
            &options,
            &mut out,
            &mut Renderer::new(false),
            &alive_now,
            &mut wait,
        );
        let out = String::from_utf8(out).unwrap();
        assert_eq!(got, ending, "{name}: {out}");
        assert!(out.contains("Count files"), "{name}: {out}");
        assert_eq!(out.contains("There are 2"), reply, "{name}: {out}");
        assert!(!out.contains('\x1b'), "{name}: {out:?}");
        // The record after session_exit is never printed.
        assert_eq!(out.matches("There are 2").count(), 1, "{name}: {out}");
        let closing = match ending {
            Ending::Gone => Renderer::new(false).gone(),
            _ => Renderer::new(false).finished(),
        };
        assert_eq!(out.lines().last(), Some(closing.as_str()), "{name}: {out}");
        // The pane closes on its own, so the closing line says when.
        assert!(closing.ends_with("closing in 3 s"), "{name}: {closing}");
    }
}

/// Following stops without a closing line when the wait is cut short (Ctrl-C), even before the transcript exists.
#[test]
fn ctrl_c_stops_following_while_waiting() {
    let scratch = Scratch::new("ctrl-c");
    let options = Options {
        file: scratch.0.join("never.jsonl"),
        title: None,
        pid: None,
        done: None,
    };
    let mut out = Vec::new();
    let got = follow(
        &options,
        &mut out,
        &mut Renderer::new(false),
        &|_| true,
        &mut |_| false,
    );
    assert_eq!(got, Ending::Stopped);
    let out = String::from_utf8(out).unwrap();
    // The heading is the file's name without .jsonl, then the path and the waiting line.
    assert_eq!(out.lines().next(), Some("never"), "{out}");
    assert_eq!(out.lines().filter(|l| !l.is_empty()).count(), 3, "{out}");
}
