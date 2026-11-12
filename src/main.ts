import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { currentPlatform } from "./keymap";
import { Panes } from "./panes";
import { normalize, type Settings } from "./settings";
import { createSettingsDialog } from "./settingsDialog";
import { applyTheme } from "./themes";

/** Event sent when the macOS app menu's Settings… item is chosen. */
const OPEN_SETTINGS_EVENT = "open-settings";

async function start(root: HTMLElement): Promise<void> {
  // A missing or broken settings file loads as null, which normalizes to the defaults.
  let settings: Settings = normalize(await invoke("settings_load").catch(() => null));
  applyTheme(settings.theme);

  const platform = currentPlatform();
  const openSettings = () => dialog.open();
  const panes = await Panes.create(root, platform, () => settings, openSettings);
  const dialog = createSettingsDialog({
    initial: settings,
    apply: async (next) => {
      const themeChanged = next.theme !== settings.theme;
      settings = next;
      if (themeChanged) applyTheme(next.theme);
      await panes.applySettings(next, themeChanged);
    },
    save: (next) => invoke("settings_save", { value: next }),
    onClose: () => panes.focusCurrent(),
  });

  if (platform === "macos") await listen(OPEN_SETTINGS_EVENT, openSettings);
  await panes.open();
}

const root = document.getElementById("panes");
if (root) {
  start(root).catch((error: unknown) => {
    root.textContent = `tiili could not start the terminal: ${String(error)}`;
  });
}
