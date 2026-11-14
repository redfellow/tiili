import "./styles.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { loadBackend, selectBackend } from "./backend";
import { currentPlatform } from "./keymap";
import { Panes } from "./panes";
import { normalize, type Settings } from "./settings";
import { createSettingsDialog, mountSettingsPage, type SettingsDialog } from "./settingsDialog";
import { same } from "./settingsSession";
import { applyTheme } from "./themes";
import { localDay, playSplash, splashDue } from "./splash";
import { createTopBar } from "./topBar";
import { showUpdateDialog } from "./updateDialog";
import { findUpdate, startupCheck } from "./updates";

/** Event sent when the macOS app menu's Settings… item is chosen. */
const OPEN_SETTINGS_EVENT = "open-settings";
/** Event sent when another window saved the settings; its payload is the saved value. */
const SETTINGS_CHANGED_EVENT = "settings-changed";
/** Event a settings window sends the window that opened it with each settings it previews. */
const SETTINGS_PREVIEW_EVENT = "settings-preview";
/** Event sent when this window's settings window has closed, however it closed. */
const SETTINGS_CLOSED_EVENT = "settings-closed";

/**
 * Runs the page as the settings window of tiili window `owner`: each change previews there (and in this page's own
 * colours), Save saves and closes, and Cancel, Esc, × and the OS close control send the opening settings back and close.
 */
async function startSettings(owner: string): Promise<void> {
  const backend = await loadBackend();
  const windows = backend.settingsWindows;
  if (!windows) throw new Error("this backend cannot open a settings window");
  const initial: Settings = normalize(await backend.loadSettings().catch(() => null));
  let theme = initial.theme;
  applyTheme(theme);
  const showTheme = (next: Settings) => {
    if (next.theme === theme) return;
    theme = next.theme;
    applyTheme(theme);
  };
  document.body.classList.add("settings-window");
  const page = mountSettingsPage(document.body, {
    initial,
    showAppIcon: currentPlatform() === "macos",
    apply: async (next) => {
      showTheme(next);
      await windows.preview(owner, next);
    },
    save: (next) => backend.saveSettings(next),
    onClose: () => void backend.closeWindow().catch((error: unknown) => console.error(error)),
    copy: (text) => backend.writeClipboard(text),
    checkForUpdates: async () => {
      const update = await findUpdate();
      if (update) showUpdateDialog(update);
      return update !== undefined;
    },
  });
  // Settings saved in another window are the ones Cancel returns to from now on.
  await backend.onAppEvent(SETTINGS_CHANGED_EVENT, (value) => {
    const next = normalize(value);
    page.adopt(next);
    showTheme(next);
  });
  await windows.onCloseRequested(() => page.discard());
}

const SPLASH_KEY = "tiili.splash.lastShown";

/** Whether the splash is due today; if so, records today as its day. Storage that fails plays the splash. */
function claimSplashDay(): boolean {
  const now = new Date();
  try {
    if (!splashDue(localStorage.getItem(SPLASH_KEY), now)) return false;
    localStorage.setItem(SPLASH_KEY, localDay(now));
  } catch {
    // Storage is unavailable: play the splash rather than lose it.
  }
  return true;
}

async function start(root: HTMLElement, bar: HTMLElement | null): Promise<void> {
  const backend = await loadBackend();
  // A missing or broken settings file loads as null, which normalizes to the defaults.
  let settings: Settings = normalize(await backend.loadSettings().catch(() => null));
  applyTheme(settings.theme);
  // The icon is cosmetic: a failure must not keep the terminal from starting.
  backend.setAppIcon(settings.appIcon).catch(() => undefined);

  // The splash covers the start-up; the first terminal opens underneath it, where its >_ lands.
  let adoptSettings: (next: Settings) => void = () => undefined;
  const splash = settings.behaviour.startupSplash && claimSplashDay()
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
  const settingsWindows = backend.settingsWindows;
  // Where the backend cannot open a settings window (the dev server), settings show in a dialogue in the page.
  let dialog: SettingsDialog | undefined;
  const openSettings = () => {
    if (!settingsWindows) return dialog?.open();
    settingsWindows.open().catch((error: unknown) => console.error(error));
  };
  const panes = await Panes.create(backend, root, platform, () => settings, openSettings);
  // The settings last saved or loaded, which a closed settings window's previews give way to.
  let saved = settings;
  const apply = async (next: Settings) => {
    if (same(next, settings)) return;
    const themeChanged = next.theme !== settings.theme;
    const iconChanged = next.appIcon !== settings.appIcon;
    const promptChanged = next.prompt !== settings.prompt;
    settings = next;
    // Open panes follow the prompt live: while picking, on Save, on Cancel and when another window saves.
    if (promptChanged) backend.setPrompt(next.prompt).catch((error: unknown) => console.error(error));
    if (themeChanged) applyTheme(next.theme);
    if (iconChanged) await backend.setAppIcon(next.appIcon);
    await panes.applySettings(next, themeChanged);
  };
  const report = (error: unknown) => console.error(error);
  if (!settingsWindows) {
    dialog = createSettingsDialog({
      initial: settings,
      showAppIcon: platform === "macos",
      apply,
      save: (next) => backend.saveSettings(next),
      onClose: () => panes.focusCurrent(),
      copy: (text) => backend.writeClipboard(text),
    });
  }
  adoptSettings = (next) => {
    saved = next;
    dialog?.adopt(next);
  };
  // Settings saved in another window, or in this window's settings window, apply here too.
  await backend.onAppEvent(SETTINGS_CHANGED_EVENT, (value) => {
    const next = normalize(value);
    adoptSettings(next);
    apply(next).catch(report);
  });
  // This window's settings window previews each change here; once it closes, what is saved applies again, so a
  // window closed without saving leaves no preview behind.
  await backend.onAppEvent(SETTINGS_PREVIEW_EVENT, (value) => {
    apply(normalize(value)).catch(report);
  });
  await backend.onAppEvent(SETTINGS_CLOSED_EVENT, () => {
    apply(saved).catch(report);
    panes.focusCurrent();
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

  // Only the first window checks for updates, once the splash is over, so the dialog shows once and on top.
  if (selectBackend(window) === "tauri" && getCurrentWindow().label === "main") {
    void (splash?.done ?? Promise.resolve()).then(() =>
      startupCheck({
        enabled: settings.updates.autoCheck,
        show: (update) => showUpdateDialog(update, () => panes.focusCurrent()),
      }),
    );
  }
}

const settingsOwner = new URLSearchParams(window.location.search).get("settings");
const root = document.getElementById("panes");
if (settingsOwner) {
  startSettings(settingsOwner).catch((error: unknown) => {
    document.body.textContent = `tiili could not show the settings: ${String(error)}`;
  });
} else if (root) {
  start(root, document.getElementById("top-bar")).catch((error: unknown) => {
    root.textContent = `tiili could not start the terminal: ${String(error)}`;
  });
}
