//! Where a session's output goes: a target that streams it (the pane's channel), or, while the pane moves to another
//! window, a buffer that keeps it until the pane's new target attaches. No Tauri types, so it tests without a window.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::pty::SessionId;

/// Receives a session's output, chunk by chunk.
pub type SinkTarget = Box<dyn FnMut(&[u8]) + Send>;

/// A session's output sink: streams to its target, or buffers between [`detach`](Self::detach) and
/// [`attach`](Self::attach), so nothing is lost or repeated while the pane changes windows.
pub struct OutputSink {
    target: Option<SinkTarget>,
    buffer: Vec<u8>,
}

impl OutputSink {
    /// A sink streaming to `target`.
    pub fn new(target: SinkTarget) -> Self {
        Self {
            target: Some(target),
            buffer: Vec::new(),
        }
    }

    /// Hands `data` to the target, or keeps it while detached.
    pub fn write(&mut self, data: &[u8]) {
        match self.target.as_mut() {
            Some(target) => target(data),
            None => self.buffer.extend_from_slice(data),
        }
    }

    /// Drops the target; output is buffered from now until the next [`attach`](Self::attach).
    pub fn detach(&mut self) {
        self.target = None;
    }

    /// Streams to `target` from now on, after handing it everything buffered since [`detach`](Self::detach).
    pub fn attach(&mut self, mut target: SinkTarget) {
        if !self.buffer.is_empty() {
            target(&std::mem::take(&mut self.buffer));
        }
        self.target = Some(target);
    }
}

/// A sink shared between its session's output thread and the commands that move it.
pub type SharedSink = Arc<Mutex<OutputSink>>;

/// Every session's output sink, by session id.
#[derive(Default)]
pub struct SessionSinks(Mutex<HashMap<SessionId, SharedSink>>);

impl SessionSinks {
    /// A new sink streaming to `target`, not yet registered: the session's id is known only once it runs.
    pub fn create(target: SinkTarget) -> SharedSink {
        Arc::new(Mutex::new(OutputSink::new(target)))
    }

    pub fn add(&self, id: SessionId, sink: SharedSink) {
        if let Ok(mut map) = self.0.lock() {
            map.insert(id, sink);
        }
    }

    /// Session `id` has ended; its sink goes with it.
    pub fn remove(&self, id: SessionId) {
        if let Ok(mut map) = self.0.lock() {
            map.remove(&id);
        }
    }

    fn with(&self, id: SessionId, f: impl FnOnce(&mut OutputSink)) -> Result<(), String> {
        let sink = self
            .0
            .lock()
            .ok()
            .and_then(|map| map.get(&id).cloned())
            .ok_or_else(|| format!("no session {id}"))?;
        let mut sink = sink.lock().map_err(|e| e.to_string())?;
        f(&mut sink);
        Ok(())
    }

    /// Session `id`'s output is buffered from now on.
    pub fn detach(&self, id: SessionId) -> Result<(), String> {
        self.with(id, OutputSink::detach)
    }

    /// Session `id`'s buffered output, then everything after, goes to `target`.
    pub fn attach(&self, id: SessionId, target: SinkTarget) -> Result<(), String> {
        self.with(id, |sink| sink.attach(target))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A target recording what it receives in `log`.
    fn recorder(log: &Arc<Mutex<Vec<u8>>>) -> SinkTarget {
        let log = Arc::clone(log);
        Box::new(move |data| log.lock().unwrap().extend_from_slice(data))
    }

    enum Step {
        Write(&'static str),
        Detach,
        AttachNew,
    }
    use Step::*;

    #[test]
    fn scrollback_and_output_during_the_move_nothing_lost_or_repeated() {
        // (name, steps, what the first target got, what the second target got)
        let cases: [(&str, Vec<Step>, &str, &str); 5] = [
            (
                "streams while attached",
                vec![Write("ab"), Write("c")],
                "abc",
                "",
            ),
            (
                "buffers between detach and attach, in order",
                vec![
                    Write("a"),
                    Detach,
                    Write("b"),
                    Write("c"),
                    AttachNew,
                    Write("d"),
                ],
                "a",
                "bcd",
            ),
            (
                "nothing written during the move",
                vec![Write("a"), Detach, AttachNew, Write("b")],
                "a",
                "b",
            ),
            (
                "detach twice keeps one buffer",
                vec![Detach, Write("a"), Detach, Write("b"), AttachNew],
                "",
                "ab",
            ),
            (
                "buffer is flushed once only",
                vec![Detach, Write("a"), AttachNew, Detach, AttachNew, Write("b")],
                "",
                "ab",
            ),
        ];
        for (name, steps, first, second) in cases {
            let first_log = Arc::new(Mutex::new(Vec::new()));
            let second_log = Arc::new(Mutex::new(Vec::new()));
            let mut sink = OutputSink::new(recorder(&first_log));
            for step in steps {
                match step {
                    Write(text) => sink.write(text.as_bytes()),
                    Detach => sink.detach(),
                    AttachNew => sink.attach(recorder(&second_log)),
                }
            }
            assert_eq!(&*first_log.lock().unwrap(), first.as_bytes(), "{name}");
            assert_eq!(&*second_log.lock().unwrap(), second.as_bytes(), "{name}");
        }
    }

    #[test]
    fn session_sinks_detach_and_attach_by_id() {
        let first = Arc::new(Mutex::new(Vec::new()));
        let second = Arc::new(Mutex::new(Vec::new()));
        let sinks = SessionSinks::default();
        let sink = SessionSinks::create(recorder(&first));
        sinks.add(7, Arc::clone(&sink));
        sinks.detach(7).unwrap();
        sink.lock().unwrap().write(b"x");
        sinks.attach(7, recorder(&second)).unwrap();
        assert_eq!(&*second.lock().unwrap(), b"x");
        sinks.remove(7);
        assert!(sinks.detach(7).is_err());
        assert!(sinks.attach(8, recorder(&second)).is_err());
    }
}
