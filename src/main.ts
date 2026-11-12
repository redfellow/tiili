import "./styles.css";
import { loadBackend } from "./backend";
import { currentPlatform } from "./keymap";
import { Panes } from "./panes";
import { normalize, type Settings } from "./settings";
import { createSettingsDialog } from "./settingsDialog";
import { applyTheme } from "./themes";

/** Event sent when the macOS app menu's Settings… item is chosen. */
const OPEN_SETTINGS_EVENT = "open-settings";

async function start(root: HTMLElement): Promise<void> {
  const backend = await loadBackend();
  // A missing or broken settings file loads as null, which normalizes to the defaults.
  let settings: Settings = normalize(await backend.loadSettings().catch(() => null));
  applyTheme(settings.theme);

  const platform = currentPlatform();
  const openSettings = () => dialog.open();
  const panes = await Panes.create(backend, root, platform, () => settings, openSettings);
  const dialog = createSettingsDialog({
    initial: settings,
    apply: async (next) => {
      const themeChanged = next.theme !== settings.theme;
      settings = next;
      if (themeChanged) applyTheme(next.theme);
      await panes.applySettings(next, themeChanged);
    },
    save: (next) => backend.saveSettings(next),
    onClose: () => panes.focusCurrent(),
  });

  if (platform === "macos" && backend.nativeMenus) await backend.onAppEvent(OPEN_SETTINGS_EVENT, openSettings);
  await panes.open();
}

const root = document.getElementById("panes");
if (root) {
  start(root).catch((error: unknown) => {
    root.textContent = `tiili could not start the terminal: ${String(error)}`;
  });
}
