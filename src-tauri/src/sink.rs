//! Where a session's output goes: a target that streams it (the pane's channel), or, while the pane moves to another
//! window, a buffer that keeps it until the pane's new target attaches. No Tauri types, so it tests without a window.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};

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
            .ok_or_else(|| "Could not move the pane: its shell has ended.".to_string())?;
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

/// Unacknowledged output, in bytes, at which a session's reader stops until the terminal catches up.
pub const FLOW_HIGH: usize = 1 << 20;

/// A session's output flow control: counts bytes sent but not yet acknowledged by the terminal, and holds the reader
/// back while [`FLOW_HIGH`] of them are pending, until acknowledged or [`close`](Self::close)d.
pub struct FlowGate {
    unacked: Mutex<usize>,
    closed: AtomicBool,
    cv: Condvar,
}

impl FlowGate {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            unacked: Mutex::new(0),
            closed: AtomicBool::new(false),
            cv: Condvar::new(),
        })
    }

    /// `n` more bytes have been sent to the terminal.
    pub fn sent(&self, n: usize) {
        if let Ok(mut unacked) = self.unacked.lock() {
            *unacked = unacked.saturating_add(n);
        }
    }

    /// Blocks while [`FLOW_HIGH`] or more bytes are unacknowledged and the gate is open.
    pub fn wait(&self) {
        let Ok(mut unacked) = self.unacked.lock() else {
            return;
        };
        while *unacked >= FLOW_HIGH && !self.closed.load(Ordering::SeqCst) {
            unacked = match self.cv.wait(unacked) {
                Ok(guard) => guard,
                Err(_) => return,
            };
        }
    }

    /// The terminal has drawn `n` bytes.
    pub fn ack(&self, n: usize) {
        if let Ok(mut unacked) = self.unacked.lock() {
            *unacked = unacked.saturating_sub(n);
        }
        self.cv.notify_all();
    }

    /// The terminal that was to acknowledge the pending bytes has let go of the session and never will: counting
    /// starts again from zero, and a waiting reader reads on.
    pub fn reset(&self) {
        if let Ok(mut unacked) = self.unacked.lock() {
            *unacked = 0;
        }
        self.cv.notify_all();
    }

    /// The session is going away: releases a waiting reader, and [`wait`](Self::wait) never blocks again.
    pub fn close(&self) {
        // Under the lock, so a reader between its check and its wait cannot miss the wake-up.
        let _guard = self.unacked.lock();
        self.closed.store(true, Ordering::SeqCst);
        self.cv.notify_all();
    }
}

/// Every session's flow gate, by session id.
#[derive(Default)]
pub struct FlowGates(Mutex<HashMap<SessionId, Arc<FlowGate>>>);

impl FlowGates {
    pub fn add(&self, id: SessionId, gate: Arc<FlowGate>) {
        if let Ok(mut map) = self.0.lock() {
            map.insert(id, gate);
        }
    }

    pub fn get(&self, id: SessionId) -> Option<Arc<FlowGate>> {
        self.0.lock().ok().and_then(|map| map.get(&id).cloned())
    }

    /// Session `id` has ended: its gate goes, closed so its reader is not left waiting.
    pub fn remove(&self, id: SessionId) {
        let gate = self.0.lock().ok().and_then(|mut map| map.remove(&id));
        if let Some(gate) = gate {
            gate.close();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

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

    /// Starts a thread that waits on `gate` and reports on the returned receiver when the wait returns.
    fn waiter(gate: &Arc<FlowGate>) -> std::sync::mpsc::Receiver<()> {
        let (tx, rx) = std::sync::mpsc::channel();
        let gate = Arc::clone(gate);
        std::thread::spawn(move || {
            gate.wait();
            let _ = tx.send(());
        });
        rx
    }

    #[test]
    fn flow_gate_wait_returns_at_once_below_the_high_mark() {
        let gate = FlowGate::new();
        gate.sent(FLOW_HIGH - 1);
        let done = waiter(&gate);
        assert!(done.recv_timeout(Duration::from_secs(5)).is_ok());
    }

    #[test]
    fn flow_gate_waiter_at_the_high_mark_wakes_on_ack_reset_or_close() {
        let release: [(&str, fn(&FlowGates, &FlowGate)); 4] = [
            ("ack", |_, gate| gate.ack(1)),
            ("reset on detach", |_, gate| gate.reset()),
            ("close", |_, gate| gate.close()),
            ("removed from the map", |gates, _| gates.remove(1)),
        ];
        for (name, release) in release {
            let gates = FlowGates::default();
            let gate = FlowGate::new();
            gates.add(1, Arc::clone(&gate));
            gate.sent(FLOW_HIGH);
            let done = waiter(&gate);
            assert!(
                done.recv_timeout(Duration::from_millis(100)).is_err(),
                "{name}: blocked before release"
            );
            release(&gates, &gate);
            assert!(done.recv_timeout(Duration::from_secs(5)).is_ok(), "{name}");
        }
    }
}
