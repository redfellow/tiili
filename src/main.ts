import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { attachClipboard } from "./clipboard";
import { currentPlatform } from "./keymap";
import { normalize, type Settings } from "./settings";
import { createSettingsDialog } from "./settingsDialog";
import { applyFont, refreshTheme, startTerminal } from "./terminal";
import { applyTheme } from "./themes";

/** Event sent when the macOS app menu's Settings… item is chosen. */
const OPEN_SETTINGS_EVENT = "open-settings";

async function start(container: HTMLElement): Promise<void> {
  // A missing or broken settings file loads as null, which normalizes to the defaults.
  let settings: Settings = normalize(await invoke("settings_load").catch(() => null));
  applyTheme(settings.theme);
  const term = await startTerminal(container, () => settings);

  const dialog = createSettingsDialog({
    initial: settings,
    apply: async (next) => {
      const themeChanged = next.theme !== settings.theme;
      settings = next;
      if (themeChanged) {
        applyTheme(next.theme);
        refreshTheme(term);
      }
      await applyFont(term, next);
    },
    save: (next) => invoke("settings_save", { value: next }),
    onClose: () => term.focus(),
  });
  const openSettings = () => dialog.open();

  await attachClipboard(term, container, openSettings);
  if (currentPlatform() === "macos") await listen(OPEN_SETTINGS_EVENT, openSettings);
}

const container = document.getElementById("terminal");
if (container) {
  start(container).catch((error: unknown) => {
    container.textContent = `tiili could not start the terminal: ${String(error)}`;
  });
}
