// @harvaaja-test-tier: host
//! Divider drag resizes PTYs on release: two side-by-side shells get the sizes a moved column divider
//! gives them, and each shell reports its own new rows and columns.

#[cfg(unix)]
mod unix {
    use std::collections::HashMap;
    use std::sync::mpsc;
    use std::time::{Duration, Instant};

    use tiili_lib::pty::{SessionId, SessionRegistry};

    const TIMEOUT: Duration = Duration::from_secs(20);
    /// The window's width in columns across both panes, and its height in rows.
    const TOTAL_COLS: u16 = 160;
    const ROWS: u16 = 40;

    struct Outputs {
        rx: mpsc::Receiver<(SessionId, Vec<u8>)>,
        seen: HashMap<SessionId, Vec<u8>>,
    }

    impl Outputs {
        fn text(&self, id: SessionId) -> String {
            String::from_utf8_lossy(self.seen.get(&id).map(Vec::as_slice).unwrap_or_default())
                .into_owned()
        }

        fn wait_for(&mut self, id: SessionId, pattern: &str) -> bool {
            let deadline = Instant::now() + TIMEOUT;
            while Instant::now() < deadline {
                if self.text(id).contains(pattern) {
                    return true;
                }
                if let Ok((from, chunk)) = self.rx.recv_timeout(Duration::from_millis(100)) {
                    self.seen.entry(from).or_default().extend(chunk);
                }
            }
            self.text(id).contains(pattern)
        }
    }

    /// Columns of the two panes when the divider between them sits at `fraction` of the width.
    fn split(fraction: f64) -> (u16, u16) {
        let left = (f64::from(TOTAL_COLS) * fraction).round() as u16;
        (left, TOTAL_COLS - left)
    }

    #[test]
    #[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
    fn divider_drag_resizes_each_pane_pty() {
        let registry = SessionRegistry::new();
        let (tx, rx) = mpsc::channel();
        let mut out = Outputs {
            rx,
            seen: HashMap::new(),
        };
        let (left_cols, right_cols) = split(0.5);
        let ids: Vec<SessionId> = [left_cols, right_cols]
            .iter()
            .map(|&cols| {
                let tx = tx.clone();
                registry
                    .spawn(
                        None,
                        "off",
                        ROWS,
                        cols,
                        Box::new(move |id, data| {
                            let _ = tx.send((id, data.to_vec()));
                        }),
                        Box::new(|_, _| {}),
                    )
                    .expect("shell starts")
            })
            .collect();

        // The divider moved from the middle to 70 % of the width, then was let go.
        let (left_cols, right_cols) = split(0.7);
        let sizes = [(ROWS, left_cols), (ROWS, right_cols)];
        for (&id, &(rows, cols)) in ids.iter().zip(&sizes) {
            registry.resize(id, rows, cols).expect("resize is accepted");
        }
        for (&id, &(rows, cols)) in ids.iter().zip(&sizes) {
            registry
                .write(id, b"stty size\r")
                .expect("stty reaches the shell");
            assert!(
                out.wait_for(id, &format!("\n{rows} {cols}")),
                "session {id} never saw {rows} rows and {cols} columns: {:?}",
                out.text(id)
            );
        }
        for &id in &ids {
            registry.close(id).expect("close");
        }
    }
}
