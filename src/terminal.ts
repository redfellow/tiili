import { Channel, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { LigaturesAddon } from "@xterm/addon-ligatures";
import { Terminal, type FontWeight } from "@xterm/xterm";
import { DEFAULT_FONT_FAMILY, type FontSettings, type Settings } from "./settings";
import { documentTokens, followSystemTheme, terminalTheme } from "./theme";

const EXIT_MESSAGE = "[process exited] Press Enter to start a new shell";

/** The addons `applyFont` changes or refits with, per terminal. */
const addons = new WeakMap<Terminal, { fit: FitAddon; ligatures?: LigaturesAddon }>();

/** The CSS font-family list for a chosen font: the font, then Geist Mono when it isn't installed. */
export function fontFamilyList(family: string): string {
  return family === DEFAULT_FONT_FAMILY
    ? `"${DEFAULT_FONT_FAMILY}", monospace`
    : `"${family}", "${DEFAULT_FONT_FAMILY}", monospace`;
}

/** Waits until the font's regular and bold faces are loaded, since xterm measures the font when it changes. */
async function loadFont(font: FontSettings): Promise<void> {
  const family = fontFamilyList(font.family);
  await Promise.all([
    document.fonts.load(`${font.weight} ${font.size}px ${family}`),
    document.fonts.load(`${font.weightBold} ${font.size}px ${family}`),
  ]).catch(() => undefined);
}

/**
 * Applies the font settings to `term`: family with Geist Mono as fallback, size, weights, line height, letter
 * spacing and the ligatures addon on or off, then refits so the shell gets the new size.
 */
export async function applyFont(term: Terminal, settings: Settings): Promise<void> {
  const { font } = settings;
  await loadFont(font);
  term.options.fontFamily = fontFamilyList(font.family);
  term.options.fontSize = font.size;
  term.options.fontWeight = String(font.weight) as FontWeight;
  term.options.fontWeightBold = String(font.weightBold) as FontWeight;
  term.options.lineHeight = font.lineHeight;
  term.options.letterSpacing = font.letterSpacing;

  const own = addons.get(term);
  if (!own) return;
  if (font.ligatures && !own.ligatures) {
    own.ligatures = new LigaturesAddon();
    term.loadAddon(own.ligatures);
  } else if (!font.ligatures && own.ligatures) {
    own.ligatures.dispose();
    own.ligatures = undefined;
  }
  own.fit.fit();
}

/** Re-reads the theme tokens into the terminal, after the theme setting changed. */
export function refreshTheme(term: Terminal): void {
  term.options.theme = terminalTheme(documentTokens());
}

/**
 * Opens one terminal in `container` connected to the user's default shell, styled by `settings()`, which the
 * terminal asks again whenever the system switches light and dark.
 */
export async function startTerminal(container: HTMLElement, settings: () => Settings): Promise<Terminal> {
  // xterm measures the font when it opens, so the font has to be loaded first.
  await loadFont(settings().font);

  const term = new Terminal({
    cursorStyle: "block",
    cursorBlink: false,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  addons.set(term, { fit });
  term.open(container);
  followSystemTheme((theme) => {
    term.options.theme = theme;
  }, () => settings().theme === "system");
  await applyFont(term, settings());

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
