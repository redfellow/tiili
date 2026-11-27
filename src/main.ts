import "./styles.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { loadBackend, selectBackend, type Backend } from "./backend";
import { currentPlatform } from "./keymap";
import { Panes } from "./panes";
import { normalize, type Settings } from "./settings";
import { createSettingsDialog, mountSettingsPage, type SettingsDialog } from "./settingsDialog";
import { same } from "./settingsSession";
import { applyTheme, themeKindSource, type TiiliTheme } from "./themes";
import { documentTokens, followSystemTheme, highlightColour, terminalTheme } from "./theme";
import type { ITheme } from "@xterm/xterm";
import { localDay, playSplash, splashDue } from "./splash";
import { createTopBar } from "./topBar";
import { showUpdateDialog } from "./updateDialog";
import { autoCheck, findUpdate, takeWhatsNew } from "./updates";
import { APP_VERSION, DEV_BUILD } from "./version";
import { showWhatsNewDialog } from "./whatsNewDialog";

/**
 * Shows this window, which opens hidden so the webview's white never flashes, once the page has painted in its theme.
 * The second frame is the one after the first paint; the timeout covers a hidden page that gets no frames. Nothing
 * to show in the browser preview.
 */
function reveal(): void {
  if (selectBackend(window) !== "tauri") return;
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    getCurrentWindow().show().catch((error: unknown) => console.error(error));
  };
  requestAnimationFrame(() => requestAnimationFrame(show));
  setTimeout(show, REVEAL_TIMEOUT_MS);
}
/** How long {@link reveal} waits for the page's first frames before showing the window anyway. */
const REVEAL_TIMEOUT_MS = 150;

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
 * colours), Save saves and closes, and Cancel, Esc, × and the OS close control send the opening settings back and close;
 * Esc and the OS close control ask first when something is unsaved.
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
    platform: currentPlatform(),
    showAppIcon: currentPlatform() === "macos",
    apply: async (next) => {
      showTheme(next);
      await windows.preview(owner, next);
    },
    save: (next) => backend.saveSettings(next),
    clearRestored: clearRestoredOf(backend),
    integrations: backend.integrations,
    confirmUnsaved: () => backend.confirmUnsaved(),
    onClose: () => void backend.closeWindow().catch((error: unknown) => console.error(error)),
    copy: (text) => backend.writeClipboard(text),
    checkForUpdates: async () => {
      const update = await findUpdate();
      if (update) showUpdateDialog(update);
      return update !== undefined;
    },
  });
  reveal();
  // Settings saved in another window are the ones Cancel returns to from now on.
  await backend.onAppEvent(SETTINGS_CHANGED_EVENT, (value) => {
    const next = normalize(value);
    page.adopt(next);
    showTheme(next);
  });
  await windows.onCloseRequested(() => page.requestClose());
}

/** Deletes the saved scrollback and commands once Restore scrollback and commands is turned off, where any are kept. */
function clearRestoredOf(backend: Backend): (() => Promise<void>) | undefined {
  const session = backend.session;
  return session ? () => session.clearScrollback() : undefined;
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
  // Heynote panes take tiili's light or dark from here (heynote/bridge.js) and follow its changes.
  const themeKinds = themeKindSource(() => settings.theme, window.matchMedia("(prefers-color-scheme: dark)"));
  (window as Window & { tiiliTheme?: TiiliTheme }).tiiliTheme = themeKinds;
  // The theme chosen inside Heynote, so a Heynote pane opens in Heynote's own mode; its pages report later choices.
  backend.notes
    .load()
    .then((library) => themeKinds.heynoteChose(library.state?.theme))
    .catch((error: unknown) => console.error(error));
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
  // In its theme, and under the splash when one plays; the first pane opens in the shown window.
  reveal();

  const platform = currentPlatform();
  const settingsWindows = backend.settingsWindows;
  // Where the backend cannot open a settings window (the dev server), settings show in a dialogue in the page.
  let dialog: SettingsDialog | undefined;
  const openSettings = () => {
    if (!settingsWindows) return dialog?.open();
    settingsWindows.open().catch((error: unknown) => console.error(error));
  };
  // The Zen width an edge drag sets: saved on top of the settings last saved, not a settings window's unsaved
  // preview, sent to the other windows by the app and taken on here, with any preview still shown.
  const saveZenWidth = async (width: number) => {
    const next: Settings = { ...saved, zen: { ...saved.zen, width } };
    await backend.saveSettings(next);
    adoptSettings(next);
    await apply({ ...settings, zen: { ...settings.zen, width } });
  };
  const panes = await Panes.create(backend, root, platform, () => settings, openSettings, saveZenWidth);
  const report = (error: unknown) => console.error(error);
  // The shells paste in the selection's colour of the theme shown here, not in reverse video's block of text colour.
  const highlightShells = (theme: ITheme) => {
    const colour = highlightColour(theme);
    if (colour) backend.setHighlight(colour).catch(report);
  };
  followSystemTheme(highlightShells, () => settings.theme === "system");
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
    if (themeChanged) {
      applyTheme(next.theme);
      highlightShells(terminalTheme(documentTokens()));
      themeKinds.changed();
    }
    if (iconChanged) await backend.setAppIcon(next.appIcon);
    await panes.applySettings(next, themeChanged);
  };
  if (!settingsWindows) {
    dialog = createSettingsDialog({
      initial: settings,
      platform,
      showAppIcon: platform === "macos",
      apply,
      save: (next) => backend.saveSettings(next),
      clearRestored: clearRestoredOf(backend),
      integrations: backend.integrations,
      confirmUnsaved: () => backend.confirmUnsaved(),
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
    const attention = backend.attention;
    const topBar = createTopBar(bar, {
      platform,
      overlay: platform === "macos" && selectBackend(window) === "tauri",
      onNewPane: thenRefocus(() => panes.act({ type: "new" })),
      onHeynote: thenRefocus(() => panes.act({ type: "heynote" })),
      onResetLayout: thenRefocus(() => panes.actLayout("reset")),
      onSettings: openSettings,
      attentionCount: attention !== undefined,
      tabs: {
        onShow: (index) => panes.showTab(index),
        onReorder: (from, to) => panes.reorderTab(from, to),
        onRename: (index, name) => panes.renameTab(index, name),
        onMenu: (index, event) => {
          panes.tabMenu(index, event).catch(report);
        },
      },
      badges: {
        restore: (id) => panes.restoreBadge(id),
        menu: (id) => panes.badgeMenu(id),
        peek: (id) => panes.peekBadge(id),
      },
    });
    panes.attachStrip(topBar.tabs);
    panes.attachBadges(topBar.badges);
    // The count covers every window's marked panes.
    if (attention) {
      await backend.onAppEvent("attention-changed", ({ marks }) => topBar.setAttentionCount(marks.length));
      topBar.setAttentionCount((await attention.list().catch(() => [])).length);
    }
  }

  if (platform === "macos" && backend.nativeMenus) await backend.onAppEvent(OPEN_SETTINGS_EVENT, openSettings);
  // A window New Window opened names its first pane's folder in its address; one Move to New Window opened names
  // the pane it is to take over, which falls back to a fresh shell if that pane is no longer waiting. A window
  // reopened from the last session gets its panes back instead.
  const params = new URLSearchParams(window.location.search);
  const startCwd = params.get("cwd") ?? undefined;
  const moveToken = params.get("move");
  const arrived = moveToken ? await panes.arrive(moveToken).catch(() => false) : false;
  const restored = arrived ? undefined : await backend.session?.load().catch(() => undefined);
  const reopened = restored ? await panes.restore(restored).catch(() => false) : false;
  if (!arrived && !reopened) await panes.open(startCwd || undefined);
  void splash?.done.then(() => panes.focusCurrent());

  // Only the first window checks for updates, so the dialog shows once and on top: at startup once the splash is
  // over, then whenever the window gains focus (the 24-hour gap in autoCheck limits the requests). Before the
  // startup check, the first start after an in-app update shows what's new in the version it installed.
  if (selectBackend(window) === "tauri" && getCurrentWindow().label === "main") {
    const check = () =>
      autoCheck({
        // Read now, not captured at startup, so turning checks off in Settings stops later checks. A local dev build
        // would always find the release "newer" and offer to replace itself.
        enabled: settings.updates.autoCheck && !DEV_BUILD,
        show: (update) => showUpdateDialog(update, () => panes.focusCurrent()),
        busy: () => document.querySelector("dialog.update-dialog:not(.whats-new)") !== null,
      });
    void (splash?.done ?? Promise.resolve()).then(() => {
      const items = takeWhatsNew(APP_VERSION);
      if (items?.length) showWhatsNewDialog(APP_VERSION, items, () => panes.focusCurrent());
      void check();
      // From here on, focus checks too, so none opens its dialog under the splash.
      return getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (focused) void check();
      });
    }).catch((error: unknown) => console.error(error));
  }
}

const settingsOwner = new URLSearchParams(window.location.search).get("settings");
const root = document.getElementById("panes");
if (settingsOwner) {
  startSettings(settingsOwner).catch((error: unknown) => {
    document.body.textContent = `tiili could not show the settings: ${String(error)}`;
    reveal();
  });
} else if (root) {
  start(root, document.getElementById("top-bar")).catch((error: unknown) => {
    root.textContent = `tiili could not start the terminal: ${String(error)}`;
    reveal();
  });
}
