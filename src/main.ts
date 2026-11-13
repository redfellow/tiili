import "./styles.css";
import { loadBackend, selectBackend } from "./backend";
import { currentPlatform } from "./keymap";
import { Panes } from "./panes";
import { normalize, type Settings } from "./settings";
import { createSettingsDialog } from "./settingsDialog";
import { applyTheme } from "./themes";
import { createTopBar } from "./topBar";

/** Event sent when the macOS app menu's Settings… item is chosen. */
const OPEN_SETTINGS_EVENT = "open-settings";

async function start(root: HTMLElement, bar: HTMLElement | null): Promise<void> {
  const backend = await loadBackend();
  // A missing or broken settings file loads as null, which normalizes to the defaults.
  let settings: Settings = normalize(await backend.loadSettings().catch(() => null));
  applyTheme(settings.theme);
  // The icon is cosmetic: a failure must not keep the terminal from starting.
  backend.setAppIcon(settings.appIcon).catch(() => undefined);

  const platform = currentPlatform();
  const openSettings = () => dialog.open();
  const panes = await Panes.create(backend, root, platform, () => settings, openSettings);
  const dialog = createSettingsDialog({
    initial: settings,
    showAppIcon: platform === "macos",
    apply: async (next) => {
      const themeChanged = next.theme !== settings.theme;
      const iconChanged = next.appIcon !== settings.appIcon;
      settings = next;
      if (themeChanged) applyTheme(next.theme);
      if (iconChanged) await backend.setAppIcon(next.appIcon);
      await panes.applySettings(next, themeChanged);
    },
    save: (next) => backend.saveSettings(next),
    onClose: () => panes.focusCurrent(),
  });

  if (bar) {
    // Buttons share the shortcuts' code path, then hand the keyboard back to the focused pane.
    const thenRefocus = (action: () => void) => () => {
      action();
      panes.focusCurrent();
    };
    createTopBar(bar, {
      platform,
      overlay: platform === "macos" && selectBackend(window) === "tauri",
      onNewPane: thenRefocus(() => panes.act({ type: "new" })),
      onHeynote: thenRefocus(() => panes.act({ type: "heynote" })),
      onClosePane: thenRefocus(() => panes.act({ type: "close" })),
      onResetLayout: thenRefocus(() => panes.actLayout("reset")),
      onSettings: openSettings,
    });
  }

  if (platform === "macos" && backend.nativeMenus) await backend.onAppEvent(OPEN_SETTINGS_EVENT, openSettings);
  await panes.open();
}

const root = document.getElementById("panes");
if (root) {
  start(root, document.getElementById("top-bar")).catch((error: unknown) => {
    root.textContent = `tiili could not start the terminal: ${String(error)}`;
  });
}
