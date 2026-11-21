//! `tiili follow FILE [--title TEXT] [--pid PID] [--done MARKER]`: follows an agent transcript (JSONL) as it grows
//! and draws it as a readable log, for a pane opened beside the agent that spawned it. It reads Oh My Pi session files
//! and Claude Code transcripts, and never writes to the transcript.
//!
//! It waits for FILE to appear (agents write it lazily), then prints each entry as it lands. It stops following when
//! the transcript says the session ended (Oh My Pi's `session_exit` entry), when MARKER exists, or when process PID is
//! gone, and then waits for a key so the pane stays open to read: tiili closes a pane when its command exits.

use std::fs::File;
use std::io::{self, IsTerminal, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::time::Duration;

use serde_json::Value;

/// How often the transcript, the marker and the process are checked.
pub const POLL: Duration = Duration::from_millis(250);
/// How many lines of a tool result are shown.
const RESULT_LINES: usize = 3;
/// How many lines of the agent's thinking are shown.
const THINKING_LINES: usize = 4;
/// How many characters a one-line summary keeps.
const ONE_LINE: usize = 160;

/// What `tiili follow` was asked to follow.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Options {
    pub file: PathBuf,
    /// The heading; the file's name without `.jsonl` when absent.
    pub title: Option<String>,
    /// The agent's process: following stops when it is gone.
    pub pid: Option<u32>,
    /// A file whose appearance means the agent is done.
    pub done: Option<PathBuf>,
}

/// One thing a transcript line holds, in a shape shared by both formats.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event {
    /// A message to the agent; the first is its task.
    User(String),
    /// The agent's reply text.
    Text(String),
    Thinking(String),
    /// A tool call: the tool and a short description of its arguments.
    Tool {
        name: String,
        summary: String,
    },
    /// A tool's output.
    Result {
        text: String,
        error: bool,
    },
    /// Something that happened to the session, such as a compaction.
    Note(String),
    /// The session ended, with the reason it gave.
    End(Option<String>),
}

/// Text with terminal control sequences removed, so a transcript cannot drive the terminal: CSI sequences, then OSC
/// sequences, then every other control character but newline and tab.
pub fn clean(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let without_csi = strip(&chars, csi_len);
    let without_osc = strip(&without_csi, osc_len);
    without_osc
        .into_iter()
        .filter(|&c| !matches!(c, '\0'..='\x08' | '\x0b'..='\x1f' | '\x7f'..='\u{9f}'))
        .collect()
}

/// `chars` without the sequences `len_at` finds: it gives the length of the sequence starting at an index, if any.
fn strip(chars: &[char], len_at: fn(&[char]) -> Option<usize>) -> Vec<char> {
    let mut out = Vec::with_capacity(chars.len());
    let mut i = 0;
    while i < chars.len() {
        match len_at(&chars[i..]) {
            Some(len) => i += len,
            None => {
                out.push(chars[i]);
                i += 1;
            }
        }
    }
    out
}

/// The length of the CSI sequence `ESC [ params intermediates final` at the start of `s`.
fn csi_len(s: &[char]) -> Option<usize> {
    if s.first() != Some(&'\x1b') || s.get(1) != Some(&'[') {
        return None;
    }
    let mut i = 2;
    while s.get(i).is_some_and(|c| matches!(c, '0'..='9' | ';' | '?')) {
        i += 1;
    }
    while s.get(i).is_some_and(|c| matches!(c, ' '..='/')) {
        i += 1;
    }
    s.get(i).filter(|c| matches!(c, '@'..='~')).map(|_| i + 1)
}

/// The length of the OSC sequence `ESC ] text` ended by BEL or `ESC \` at the start of `s`.
fn osc_len(s: &[char]) -> Option<usize> {
    if s.first() != Some(&'\x1b') || s.get(1) != Some(&']') {
        return None;
    }
    let end = 2 + s[2..].iter().position(|&c| c == '\x07' || c == '\x1b')?;
    match s[end] {
        '\x07' => Some(end + 1),
        _ => (s.get(end + 1) == Some(&'\\')).then_some(end + 2),
    }
}

/// The first `count` lines of `text`, cleaned and without trailing white space, and how many more there are.
fn first_lines(text: &str, count: usize) -> (Vec<String>, usize) {
    let cleaned = clean(text);
    let lines: Vec<String> = cleaned.trim_end().split('\n').map(str::to_string).collect();
    let more = lines.len().saturating_sub(count);
    (lines.into_iter().take(count).collect(), more)
}

/// `text` cleaned, on one line, cut to `ONE_LINE` characters with an ellipsis.
fn one_line(text: &str) -> String {
    let flat = clean(text).split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() > ONE_LINE {
        let cut: String = flat.chars().take(ONE_LINE - 1).collect();
        format!("{cut}…")
    } else {
        flat
    }
}

/// A short description of a tool call's arguments: its stated intent, else its most telling argument, else the
/// arguments as JSON.
pub fn summarize_args(args: Option<&Value>, intent: Option<&str>) -> String {
    if let Some(intent) = intent.filter(|i| !i.is_empty()) {
        return one_line(intent);
    }
    let Some(args) = args else {
        return String::new();
    };
    if let Some(fields) = args.as_object() {
        if let Some(i) = fields.get("i").and_then(Value::as_str) {
            return one_line(i);
        }
        let telling = [
            "description",
            "command",
            "file_path",
            "path",
            "pattern",
            "url",
            "query",
            "prompt",
        ];
        for key in telling {
            if let Some(value) = fields
                .get(key)
                .and_then(Value::as_str)
                .filter(|v| !v.is_empty())
            {
                return one_line(value);
            }
        }
    }
    one_line(&args.to_string())
}

/// The text of a message's content: the content when it is a string, else its text blocks joined by newlines.
fn content_text(content: Option<&Value>) -> String {
    match content {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Array(blocks)) => blocks
            .iter()
            .filter_map(|block| match block {
                Value::String(text) => Some(text.as_str()),
                _ if block["type"] == "text" => block["text"].as_str(),
                _ => None,
            })
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

/// The events one transcript line holds. Lines that are bookkeeping give none.
pub fn events_of(entry: &Value) -> Vec<Event> {
    let kind = entry["type"].as_str().unwrap_or_default();
    let message = entry.get("message").filter(|m| m.is_object());

    // Oh My Pi: `{type: "message", message: {role, content}}`, `{type: "session_exit"}`, `{type: "compaction"}`.
    // omp 18.21 writes the exit record as `{type: "custom", customType: "session_exit", data: {reason}}`.
    let reason = |value: &Value| value.as_str().map(str::to_string);
    match kind {
        "custom" if entry["customType"] == "session_exit" => {
            return vec![Event::End(reason(&entry["data"]["reason"]))]
        }
        "session_exit" => return vec![Event::End(reason(&entry["reason"]))],
        "compaction" => return vec![Event::Note("context compacted".to_string())],
        _ => {}
    }
    let Some(message) = message else {
        return Vec::new();
    };
    let content = message.get("content");
    match kind {
        "message" => match message["role"].as_str() {
            Some("user") => vec![Event::User(content_text(content))],
            Some("assistant") => assistant_blocks(content),
            Some("toolResult") => vec![Event::Result {
                text: content_text(content),
                error: truthy(&message["isError"]),
            }],
            _ => Vec::new(),
        },
        // Claude Code: `{type: "user"|"assistant", message: {role, content}}`; other types are request bookkeeping.
        "assistant" => assistant_blocks(content),
        "user" => {
            if let Some(Value::String(text)) = content {
                return vec![Event::User(text.clone())];
            }
            let blocks = content
                .and_then(Value::as_array)
                .map(Vec::as_slice)
                .unwrap_or_default();
            let results: Vec<Event> = blocks
                .iter()
                .filter(|block| block["type"] == "tool_result")
                .map(|block| Event::Result {
                    text: content_text(block.get("content")),
                    error: truthy(&block["is_error"]),
                })
                .collect();
            if !results.is_empty() {
                return results;
            }
            let text = content_text(content);
            if text.is_empty() {
                Vec::new()
            } else {
                vec![Event::User(text)]
            }
        }
        _ => Vec::new(),
    }
}

/// Whether a JSON value counts as set: true, a non-zero number or a non-empty string.
fn truthy(value: &Value) -> bool {
    match value {
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|n| n != 0.0),
        Value::String(s) => !s.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
        Value::Null => false,
    }
}

/// The events of an assistant message: its text, thinking and tool calls, in order.
fn assistant_blocks(content: Option<&Value>) -> Vec<Event> {
    let blocks = match content {
        Some(Value::String(text)) if !text.is_empty() => return vec![Event::Text(text.clone())],
        Some(Value::Array(blocks)) => blocks,
        _ => return Vec::new(),
    };
    let text = |block: &Value, field: &str| {
        block[field]
            .as_str()
            .filter(|t| !t.is_empty())
            .map(str::to_string)
    };
    let name = |block: &Value| block["name"].as_str().unwrap_or("tool").to_string();
    blocks
        .iter()
        .filter_map(|block| match block["type"].as_str()? {
            "text" => text(block, "text").map(Event::Text),
            "thinking" => text(block, "thinking").map(Event::Thinking),
            "toolCall" => Some(Event::Tool {
                name: name(block),
                summary: summarize_args(block.get("arguments"), block["intent"].as_str()),
            }),
            "tool_use" => Some(Event::Tool {
                name: name(block),
                summary: summarize_args(block.get("input"), None),
            }),
            _ => None,
        })
        .collect()
}

/// Draws events as lines, styled with SGR codes when they go to a terminal.
#[derive(Debug, Default)]
pub struct Renderer {
    styled: bool,
    saw_task: bool,
}

impl Renderer {
    pub fn new(styled: bool) -> Self {
        Self {
            styled,
            saw_task: false,
        }
    }

    fn paint(&self, code: &str, text: &str) -> String {
        if self.styled {
            format!("\x1b[{code}m{text}\x1b[0m")
        } else {
            text.to_string()
        }
    }

    /// The lines to print for `event`. The end of the session prints nothing here: see [`follow`].
    pub fn render(&mut self, event: &Event) -> Vec<String> {
        const BOLD: &str = "1";
        const DIM: &str = "2";
        const ITALIC_DIM: &str = "2;3";
        const CYAN: &str = "36";
        const RED: &str = "31";
        match event {
            Event::User(text) => {
                let header = if self.saw_task {
                    "› message"
                } else {
                    "› task"
                };
                self.saw_task = true;
                vec![
                    self.paint(BOLD, header),
                    clean(text).trim_end().to_string(),
                    String::new(),
                ]
            }
            Event::Text(text) => vec![clean(text).trim_end().to_string(), String::new()],
            Event::Thinking(text) => {
                let (shown, more) = first_lines(text, THINKING_LINES);
                let mut lines: Vec<String> =
                    shown.iter().map(|l| self.paint(ITALIC_DIM, l)).collect();
                if more > 0 {
                    lines.push(self.paint(ITALIC_DIM, &format!("… {more} more")));
                }
                lines.push(String::new());
                lines
            }
            Event::Tool { name, summary } => vec![format!(
                "{} {} {}",
                self.paint(CYAN, "●"),
                self.paint(BOLD, &clean(name)),
                self.paint(DIM, summary)
            )],
            Event::Result { text, error } => {
                let (shown, more) = first_lines(text, RESULT_LINES);
                let colour = if *error { RED } else { DIM };
                let mut lines: Vec<String> = shown
                    .iter()
                    .filter(|line| !line.is_empty())
                    .enumerate()
                    .map(|(i, line)| {
                        let prefix = if i == 0 { "  ⎿ " } else { "    " };
                        self.paint(colour, &format!("{prefix}{line}"))
                    })
                    .collect();
                if lines.is_empty() {
                    let none = if *error {
                        "  ⎿ (error)"
                    } else {
                        "  ⎿ (no output)"
                    };
                    lines.push(self.paint(colour, none));
                }
                if more > 0 {
                    lines.push(self.paint(DIM, &format!("    … {more} more lines")));
                }
                lines.push(String::new());
                lines
            }
            Event::Note(text) => vec![self.paint(DIM, &format!("— {text} —")), String::new()],
            Event::End(_) => Vec::new(),
        }
    }

    /// The closing line for a transcript that ended or an agent that finished.
    pub fn finished(&self) -> String {
        format!(
            "{}{}",
            self.paint("32", "— finished —"),
            self.paint("2", "  press any key to close")
        )
    }

    /// The closing line for an agent whose process went away without ending its transcript.
    pub fn gone(&self) -> String {
        self.paint(
            "2",
            "— the agent's process is gone —  press any key to close",
        )
    }
}

/// How following ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ending {
    /// The transcript ended, or the done marker appeared.
    Finished,
    /// The agent's process is gone.
    Gone,
    /// The user pressed Ctrl-C or Ctrl-D, or the output went away.
    Stopped,
}

/// The transcript read so far: how far, and the start of a line still being written.
struct Tail {
    offset: u64,
    partial: Vec<u8>,
    waiting_shown: bool,
}

/// Follows the transcript `options` names, printing to `out` with `renderer`, until it ends, the done marker appears,
/// the process is gone, or `wait` (called between polls with the poll interval) returns false. Prints the closing
/// line unless stopped. A failed write stops it: the pane closed, or the output went to a closed pipe.
pub fn follow(
    options: &Options,
    out: &mut dyn Write,
    renderer: &mut Renderer,
    alive: &dyn Fn(u32) -> bool,
    wait: &mut dyn FnMut(Duration) -> bool,
) -> Ending {
    match follow_until_end(options, out, renderer, alive, wait) {
        Ok(Ending::Stopped) | Err(_) => Ending::Stopped,
        Ok(ending) => {
            let line = match ending {
                Ending::Gone => renderer.gone(),
                _ => renderer.finished(),
            };
            match writeln!(out, "\n{line}").and_then(|()| out.flush()) {
                Ok(()) => ending,
                Err(_) => Ending::Stopped,
            }
        }
    }
}

fn follow_until_end(
    options: &Options,
    out: &mut dyn Write,
    renderer: &mut Renderer,
    alive: &dyn Fn(u32) -> bool,
    wait: &mut dyn FnMut(Duration) -> bool,
) -> io::Result<Ending> {
    let title = options.title.clone().unwrap_or_else(|| {
        let name = options
            .file
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        name.strip_suffix(".jsonl").unwrap_or(&name).to_string()
    });
    writeln!(
        out,
        "{}\n{}\n",
        renderer.paint("1", &clean(&title)),
        renderer.paint("2", &clean(&options.file.to_string_lossy()))
    )?;
    out.flush()?;
    let mut tail = Tail {
        offset: 0,
        partial: Vec::new(),
        waiting_shown: false,
    };
    loop {
        if drain(&options.file, &mut tail, out, renderer)? {
            return Ok(Ending::Finished);
        }
        if options.done.as_deref().is_some_and(Path::exists) {
            drain(&options.file, &mut tail, out, renderer)?;
            return Ok(Ending::Finished);
        }
        if options.pid.is_some_and(|pid| !alive(pid)) {
            drain(&options.file, &mut tail, out, renderer)?;
            return Ok(Ending::Gone);
        }
        if !wait(POLL) {
            return Ok(Ending::Stopped);
        }
    }
}

/// Prints the transcript's new whole lines. Returns whether one of them ended the session.
fn drain(
    file: &Path,
    tail: &mut Tail,
    out: &mut dyn Write,
    renderer: &mut Renderer,
) -> io::Result<bool> {
    let Ok(mut transcript) = File::open(file) else {
        if !tail.waiting_shown {
            writeln!(
                out,
                "{}\n",
                renderer.paint("2", "waiting for the agent's first turn…")
            )?;
            out.flush()?;
            tail.waiting_shown = true;
        }
        return Ok(false);
    };
    let size = transcript.metadata()?.len();
    if size < tail.offset {
        // The file was rewritten (compaction, garbage collection): start over.
        tail.offset = 0;
        tail.partial.clear();
    }
    if size == tail.offset {
        return Ok(false);
    }
    transcript.seek(SeekFrom::Start(tail.offset))?;
    let read = transcript
        .take(size - tail.offset)
        .read_to_end(&mut tail.partial)?;
    tail.offset += read as u64;
    let Some(last) = tail.partial.iter().rposition(|&b| b == b'\n') else {
        return Ok(false);
    };
    let whole: Vec<u8> = tail.partial.drain(..=last).collect();
    for line in whole.split(|&b| b == b'\n') {
        let line = String::from_utf8_lossy(line);
        if line.trim().is_empty() {
            continue;
        }
        let Ok(entry) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        for event in events_of(&entry) {
            if matches!(event, Event::End(_)) {
                out.flush()?;
                return Ok(true);
            }
            let lines = renderer.render(&event);
            if !lines.is_empty() {
                writeln!(out, "{}", lines.join("\n"))?;
            }
        }
    }
    out.flush()?;
    Ok(false)
}

/// Runs `tiili follow` in the terminal: Ctrl-C or Ctrl-D closes it at any time; once following ends it waits for a
/// key, unless no one can press one because stdin is not a terminal.
pub fn run(options: &Options, out: &mut dyn Write) {
    let mut renderer = Renderer::new(io::stdout().is_terminal());
    let keys = io::stdin().is_terminal().then(|| {
        let raw = terminal::Raw::enter();
        (raw, read_keys())
    });
    let mut wait = |pause: Duration| match &keys {
        Some((_, keys)) => match keys.recv_timeout(pause) {
            Ok(key) => !matches!(key, 0x03 | 0x04),
            Err(RecvTimeoutError::Timeout) => true,
            Err(RecvTimeoutError::Disconnected) => {
                std::thread::sleep(pause);
                true
            }
        },
        None => {
            std::thread::sleep(pause);
            true
        }
    };
    let ending = follow(options, out, &mut renderer, &process_alive, &mut wait);
    if let (Ending::Finished | Ending::Gone, Some((_, keys))) = (ending, &keys) {
        let _ = keys.recv();
    }
}

/// The bytes typed on stdin, one at a time, from a thread that reads until stdin closes.
fn read_keys() -> Receiver<u8> {
    let (send, receive) = mpsc::channel();
    std::thread::spawn(move || {
        let mut stdin = io::stdin();
        let mut byte = [0u8; 1];
        while let Ok(1) = stdin.read(&mut byte) {
            if send.send(byte[0]).is_err() {
                break;
            }
        }
    });
    receive
}

/// Whether process `pid` still runs. One this user may not signal still runs.
#[cfg(unix)]
pub fn process_alive(pid: u32) -> bool {
    let Ok(pid) = libc::pid_t::try_from(pid) else {
        return false;
    };
    // SAFETY: signal 0 only checks that the process exists and may be signalled.
    if unsafe { libc::kill(pid, 0) } == 0 {
        return true;
    }
    io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

/// Whether process `pid` still runs.
#[cfg(windows)]
pub fn process_alive(pid: u32) -> bool {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    /// The exit code of a process that has not exited.
    const STILL_ACTIVE: u32 = 259;
    // SAFETY: the handle is checked before use and closed after.
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return false;
        }
        let mut code = 0u32;
        let ok = GetExitCodeProcess(handle, &mut code) != 0;
        CloseHandle(handle);
        ok && code == STILL_ACTIVE
    }
}

/// The terminal in raw mode, so keys arrive one at a time without echo, restored when dropped.
mod terminal {
    #[cfg(unix)]
    pub struct Raw(Option<libc::termios>);

    #[cfg(unix)]
    impl Raw {
        pub fn enter() -> Self {
            // SAFETY: tcgetattr fills the struct it is given; tcsetattr only reads it.
            unsafe {
                let mut saved: libc::termios = std::mem::zeroed();
                if libc::tcgetattr(libc::STDIN_FILENO, &mut saved) != 0 {
                    return Self(None);
                }
                let mut raw = saved;
                libc::cfmakeraw(&mut raw);
                // Keep output processing, so a newline still returns the cursor.
                raw.c_oflag = saved.c_oflag;
                libc::tcsetattr(libc::STDIN_FILENO, libc::TCSANOW, &raw);
                Self(Some(saved))
            }
        }
    }

    #[cfg(unix)]
    impl Drop for Raw {
        fn drop(&mut self) {
            if let Some(saved) = &self.0 {
                // SAFETY: restores the settings read in enter.
                unsafe {
                    libc::tcsetattr(libc::STDIN_FILENO, libc::TCSANOW, saved);
                }
            }
        }
    }

    #[cfg(windows)]
    pub struct Raw(Option<u32>);

    #[cfg(windows)]
    impl Raw {
        pub fn enter() -> Self {
            use windows_sys::Win32::System::Console::{
                GetConsoleMode, GetStdHandle, SetConsoleMode, ENABLE_ECHO_INPUT, ENABLE_LINE_INPUT,
                ENABLE_PROCESSED_INPUT, STD_INPUT_HANDLE,
            };
            // SAFETY: both calls only read or set this process's console input mode.
            unsafe {
                let input = GetStdHandle(STD_INPUT_HANDLE);
                let mut saved = 0u32;
                if GetConsoleMode(input, &mut saved) == 0 {
                    return Self(None);
                }
                let raw = saved & !(ENABLE_ECHO_INPUT | ENABLE_LINE_INPUT | ENABLE_PROCESSED_INPUT);
                SetConsoleMode(input, raw);
                Self(Some(saved))
            }
        }
    }

    #[cfg(windows)]
    impl Drop for Raw {
        fn drop(&mut self) {
            use windows_sys::Win32::System::Console::{
                GetStdHandle, SetConsoleMode, STD_INPUT_HANDLE,
            };
            if let Some(saved) = self.0 {
                // SAFETY: restores the mode read in enter.
                unsafe {
                    SetConsoleMode(GetStdHandle(STD_INPUT_HANDLE), saved);
                }
            }
        }
    }
}
