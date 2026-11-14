import "./styles.css";
import { loadBackend, selectBackend } from "./backend";
import { currentPlatform } from "./keymap";
import { Panes } from "./panes";
import { normalize, type Settings } from "./settings";
import { createSettingsDialog } from "./settingsDialog";
import { applyTheme } from "./themes";
import { playSplash } from "./splash";
import { createTopBar } from "./topBar";

/** Event sent when the macOS app menu's Settings… item is chosen. */
const OPEN_SETTINGS_EVENT = "open-settings";
/** Event sent when another window saved the settings; its payload is the saved value. */
const SETTINGS_CHANGED_EVENT = "settings-changed";

async function start(root: HTMLElement, bar: HTMLElement | null): Promise<void> {
  const backend = await loadBackend();
  // A missing or broken settings file loads as null, which normalizes to the defaults.
  let settings: Settings = normalize(await backend.loadSettings().catch(() => null));
  applyTheme(settings.theme);
  // The icon is cosmetic: a failure must not keep the terminal from starting.
  backend.setAppIcon(settings.appIcon).catch(() => undefined);

  // The splash covers the start-up; the first terminal opens underneath it, where its >_ lands.
  let adoptSettings: (next: Settings) => void = () => undefined;
  const splash = settings.behaviour.startupSplash
    ? playSplash({
        target: () => root.querySelector(".pane[data-focused] .xterm-screen"),
        fontSize: settings.font.size,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        onDisable: async () => {
          const next: Settings = { ...settings, behaviour: { ...settings.behaviour, startupSplash: false } };
          await backend.saveSettings(next);
          settings = next;
          adoptSettings(next);
        },
      })
    : undefined;

  const platform = currentPlatform();
  const openSettings = () => dialog.open();
  const panes = await Panes.create(backend, root, platform, () => settings, openSettings);
  const apply = async (next: Settings) => {
    const themeChanged = next.theme !== settings.theme;
    const iconChanged = next.appIcon !== settings.appIcon;
    settings = next;
    if (themeChanged) applyTheme(next.theme);
    if (iconChanged) await backend.setAppIcon(next.appIcon);
    await panes.applySettings(next, themeChanged);
  };
  const dialog = createSettingsDialog({
    initial: settings,
    showAppIcon: platform === "macos",
    apply,
    save: (next) => backend.saveSettings(next),
    onClose: () => panes.focusCurrent(),
    copy: (text) => backend.writeClipboard(text),
  });
  adoptSettings = (next) => dialog.adopt(next);
  // Settings saved in another window apply here too.
  await backend.onAppEvent(SETTINGS_CHANGED_EVENT, (value) => {
    const next = normalize(value);
    dialog.adopt(next);
    apply(next).catch((error: unknown) => console.error(error));
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
  // A window New Window opened names its first pane's folder in its address; one Move to New Window opened names
  // the pane it is to take over, which falls back to a fresh shell if that pane is no longer waiting.
  const params = new URLSearchParams(window.location.search);
  const startCwd = params.get("cwd") ?? undefined;
  const moveToken = params.get("move");
  const arrived = moveToken ? await panes.arrive(moveToken).catch(() => false) : false;
  if (!arrived) await panes.open(startCwd || undefined);
  void splash?.done.then(() => panes.focusCurrent());
}

const root = document.getElementById("panes");
if (root) {
  start(root, document.getElementById("top-bar")).catch((error: unknown) => {
    root.textContent = `tiili could not start the terminal: ${String(error)}`;
  });
}
