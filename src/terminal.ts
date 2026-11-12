import { Channel, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { followSystemTheme } from "./theme";

const EXIT_MESSAGE = "[process exited] Press Enter to start a new shell";

/** Opens one terminal in `container` connected to the user's default shell. */
export async function startTerminal(container: HTMLElement): Promise<Terminal> {
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
  // xterm measures the font when it opens, so Geist Mono has to be loaded first.
  await Promise.all([document.fonts.load(`14px "Geist Mono"`), document.fonts.load(`bold 14px "Geist Mono"`)]);

  const term = new Terminal({
    fontFamily,
    fontSize: 14,
    cursorStyle: "block",
    cursorBlink: false,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(container);
  followSystemTheme((theme) => {
    term.options.theme = theme;
  });
  fit.fit();

  let running = false;

  const reportError = (error: unknown) => {
    term.write(`\r\n${String(error)}\r\n`);
  };

  const spawn = async () => {
    const output = new Channel<number[]>();
    output.onmessage = (bytes) => term.write(new Uint8Array(bytes));
    await invoke("pty_spawn", { rows: term.rows, cols: term.cols, onOutput: output });
    running = true;
  };

  await listen<{ code: number }>("pty-exit", () => {
    running = false;
    term.write(`\r\n${EXIT_MESSAGE}\r\n`);
  });

  term.onData((data) => {
    if (running) {
      invoke("pty_write", { data }).catch(reportError);
    } else if (data.includes("\r")) {
      spawn().catch(reportError);
    }
  });

  term.onResize(({ rows, cols }) => {
    if (running) invoke("pty_resize", { rows, cols }).catch(reportError);
  });
  new ResizeObserver(() => fit.fit()).observe(container);

  await spawn().catch(reportError);
  term.focus();
  return term;
}
