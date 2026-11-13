// tiili's bridge for the Heynote web app, built over Heynote's own webapp/bridge.js by scripts/heynote.mjs.
//
// Derived from Heynote (https://heynote.com), Copyright (c) Jonatan Heyman, MIT License with the "Commons Clause"
// License Condition v1.0; see public/heynote/LICENSE. The changes: notes, folders, settings, open tabs and the
// theme live in tiili's note store (window.parent.tiiliHeynote, files in the app config folder) instead of
// localStorage, loaded once before the app starts and written through on each change; tiili can ask the page to
// save everything at once (window.tiiliFlush) before it closes the pane. Several Heynote pages stay in sync: each
// passes its own origin id with every change, hears every change through the store's subscribe, and follows the
// ones other pages made, handing new note text to Heynote's buffer.addOnChangeCallback callbacks and refreshing
// its notes list. Heynote starts with tiili's Geist Mono instead of Hack, and without its left panel until the
// user opens it.

import {
    SETTINGS_CHANGE_EVENT,
    SAVE_TABS_STATE,
    LOAD_TABS_STATE,
    WINDOW_CLOSE_EVENT,
    DEFAULT_LEFT_PANEL_WIDTH,
    LIBRARY_SEARCH_CANCEL,
    LIBRARY_SEARCH_DONE,
    LIBRARY_SEARCH_ERROR,
    LIBRARY_SEARCH_MATCH,
    LIBRARY_SEARCH_START,
} from "@/src/common/constants";
import { generateClientId } from "@/src/common/client-id";
import { CURRENCY_RATES_URL, getCurrencyFetchOptions } from "@/src/common/currency-request";
import { normalizeLibrarySearchMatch } from "@/src/common/library-search-match";
import { isLibrarySearchQueryLongEnough } from "@/src/common/library-search-query.js";

/** A store kept in this page's localStorage, for when the page is opened on its own, outside tiili. */
function localStore() {
    const read = (key, fallback) => {
        try {
            return JSON.parse(localStorage.getItem(key)) ?? fallback
        } catch {
            return fallback
        }
    }
    const notes = () => read("tiili-notes", {})
    const dirs = () => read("tiili-dirs", [])
    const keep = (key, value) => localStorage.setItem(key, JSON.stringify(value))
    return {
        load: async () => ({ notes: notes(), dirs: dirs(), state: read("tiili-state", null) }),
        write: async (path, content) => keep("tiili-notes", { ...notes(), [path]: content }),
        remove: async (path) => {
            const all = notes()
            delete all[path]
            keep("tiili-notes", all)
        },
        move: async (from, to) => {
            const all = notes()
            all[to] = all[from]
            delete all[from]
            keep("tiili-notes", all)
        },
        mkdir: async (path) => keep("tiili-dirs", [...new Set([...dirs(), path])]),
        rmdir: async (path) => keep("tiili-dirs", dirs().filter((dir) => dir !== path)),
        saveState: async (state) => keep("tiili-state", state),
        // A page on its own is the only one using its notes.
        subscribe: () => () => {},
    }
}

/** The font Heynote uses until the user picks another: tiili's own, when the page runs inside tiili. */
const TIILI_FONT = "Geist Mono"

/**
 * Copies tiili's @font-face rules for `family` into this page, so Heynote can use the font tiili bundles. Relative
 * font URLs are resolved against the stylesheet they came from. Returns false when tiili has no such font here.
 */
function borrowFont(family) {
    let parentDocument
    try {
        parentDocument = window.parent !== window ? window.parent.document : null
    } catch {
        return false
    }
    if (!parentDocument) {
        return false
    }
    const rules = []
    for (const sheet of parentDocument.styleSheets) {
        let cssRules
        try {
            cssRules = sheet.cssRules
        } catch {
            continue
        }
        const base = sheet.href || parentDocument.baseURI
        for (const rule of cssRules) {
            const name = rule.style?.getPropertyValue("font-family").replace(/["']/g, "").trim()
            if (rule.type === CSSRule.FONT_FACE_RULE && name === family) {
                rules.push(rule.cssText.replace(/url\((["']?)([^"')]+)\1\)/g, (_, quote, url) => `url("${new URL(url, base)}")`))
            }
        }
    }
    if (rules.length === 0) {
        return false
    }
    const style = document.createElement("style")
    style.textContent = rules.join("\n")
    document.head.append(style)
    return true
}

const hasTiiliFont = borrowFont(TIILI_FONT)
if (hasTiiliFont) {
    // Loaded before Heynote starts, so its monospace check measures Geist Mono and not a fallback font.
    await document.fonts.load(`12px "${TIILI_FONT}"`).catch(() => undefined)
}

const store = (window.parent !== window && window.parent.tiiliHeynote) || localStore()
const library = await store.load()

/** Note text by library path: the page's copy, written through to the store on every change. */
const notes = new Map(Object.entries(library.notes || {}))
const directories = new Set(library.dirs || [])
const state = Object.assign({}, library.state || {})

/** This page's id, sent with each change so it can tell its own changes from other Heynote pages'. */
const origin = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

/** Heynote's callbacks for each open note, called with the note's new text when another page changed it. */
const onChangeCallbacks = {}

function report(error) {
    console.error("tiili could not save a Heynote change:", error)
}

function setState(key, value) {
    if (value === undefined || value === null) {
        delete state[key]
    } else {
        state[key] = value
    }
    store.saveState(state).catch(report)
}

const mediaMatch = window.matchMedia('(prefers-color-scheme: dark)')
let themeCallback = null
mediaMatch.addEventListener("change", async () => {
    if (themeCallback) {
        themeCallback((await Heynote.themeMode.get()).computed)
    }
})

let currencyData = null

const uaPlatform = window.navigator?.userAgentData?.platform || window.navigator.platform
const platform = {
    isMac: uaPlatform.indexOf("Win") === -1 && uaPlatform.indexOf("Linux") === -1,
    isWindows: uaPlatform.indexOf("Win") !== -1,
    isLinux: uaPlatform.indexOf("Linux") !== -1,
    isWebApp: true,
}

function getClientId() {
    let clientId = state.clientId
    if (!clientId) {
        clientId = generateClientId()
        setState("clientId", clientId)
    }
    return clientId
}

class IpcRenderer {
    constructor() {
        this.callbacks = {}
    }

    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = []
        }
        this.callbacks[event].push(callback)
    }

    off(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback)
        }
    }

    send(event, ...args) {
        if (this.callbacks[event]) {
            for (const callback of this.callbacks[event]) {
                callback(null, ...args)
            }
        }
    }
}

const ipcRenderer = new IpcRenderer()

let initialSettings = {
    keymap: "default",
    emacsMetaKey: "alt",
    showLineNumberGutter: true,
    showFoldGutter: true,
    bufferTreeOpenFolders: [],
    bracketClosing: false,
    keyBindings: [],
    showTabs: true,
    showTabsInFullscreen: true,
    // tiili's pane is narrow next to the terminals: the notes list stays closed until the user opens it.
    showLeftPanel: false,
    leftPanelWidth: DEFAULT_LEFT_PANEL_WIDTH,
    startHidden: false,
    colorPreviewEnabled: true,
    cursorBlinkRate: 1000,
    librarySearchSettings: {
        caseSensitive: false,
        wholeWord: false,
        regexp: false,
    },
}
if (state.settings) {
    try {
        initialSettings = Object.assign(initialSettings, JSON.parse(state.settings))
    } catch {
        // A broken settings entry falls back to the defaults.
    }
}

function getNoteMetadata(content) {
    const firstSeparator = content.indexOf("\n∞∞∞")
    if (firstSeparator === -1) {
        return null
    }
    try {
        const metadata = JSON.parse(content.slice(0, firstSeparator).trim())
        return {"name": metadata.name}
    } catch {
        return {}
    }
}

function directoriesOfNotes() {
    const found = new Set()
    for (const path of notes.keys()) {
        const parts = path.split("/")
        for (let i = 1; i < parts.length; i++) {
            found.add(parts.slice(0, i).join("/"))
        }
    }
    return found
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function createLibrarySearchPattern(options, flags) {
    const query = options?.query || ""
    if (options.regexp) {
        return new RegExp(query, flags)
    }
    if (options.wholeWord) {
        return new RegExp(`\\b${escapeRegExp(query)}\\b`, flags)
    }
    return new RegExp(escapeRegExp(query), flags)
}

function putNote(path, content) {
    notes.set(path, content)
    return store.write(path, content, origin)
}

/**
 * Refreshes Heynote's notes list (and with it the folder tree, which follows it) after another page created,
 * deleted or moved a note or folder. Upstream Heynote has no hook for this: its Electron file watcher only feeds
 * buffer.addOnChangeCallback for open notes, and its library-path callback reloads the whole library and closes
 * every tab. So this calls the `updateBuffers` action of Heynote's own store, the one each of its own changes
 * ends with, found through the page's Vue app and Pinia; failing that, through the notes tree when it is shown.
 */
function refreshLibrary() {
    const pinia = document.querySelector("#app")?.__vue_app__?.config.globalProperties.$pinia
    const heynoteStore = pinia && [...pinia._s.values()].find((piniaStore) => typeof piniaStore.updateBuffers === "function")
    const refresh = heynoteStore ?? window._heynote_buffer_tree
    refresh?.updateBuffers?.()?.catch?.(report)
}

/** Follows a change another Heynote page made; see applyNoteChange in tiili's src/heynoteStore.ts. */
function followChange(change) {
    if (change.origin === origin) {
        return
    }
    switch (change.kind) {
        case "write": {
            const known = notes.get(change.path)
            notes.set(change.path, change.content)
            for (const callback of onChangeCallbacks[change.path] || []) {
                callback(change.content)
            }
            if (known === undefined || getNoteMetadata(known)?.name !== getNoteMetadata(change.content)?.name) {
                refreshLibrary()
            }
            return
        }
        case "remove":
            notes.delete(change.path)
            break
        case "move": {
            const content = notes.get(change.from)
            if (content !== undefined) {
                notes.set(change.to, content)
            }
            notes.delete(change.from)
            break
        }
        case "mkdir":
            directories.add(change.path)
            break
        case "rmdir":
            directories.delete(change.path)
            break
        default:
            return
    }
    refreshLibrary()
}

let unsubscribe = store.subscribe ? store.subscribe(followChange) : () => {}

/** Stops hearing other pages' changes, once this page is going away. */
function stopFollowing() {
    unsubscribe()
    unsubscribe = () => {}
}

const Heynote = {
    platform: platform,
    defaultFontFamily: hasTiiliFont ? TIILI_FONT : "Hack",
    defaultFontSize: 12,

    buffer: {
        async load(path) {
            const content = notes.get(path)
            return content === undefined ? '{"formatVersion":"1.0.0","name":"Scratch"}\n∞∞∞text-a;created=' + (new Date()).toISOString() + '\n' : content
        },

        async save(path, content) {
            await putNote(path, content)
        },

        async create(path, content) {
            await putNote(path, content)
        },

        async createDirectory(path) {
            if (!path) {
                return
            }
            directories.add(path)
            await store.mkdir(path, origin)
        },

        async delete(path) {
            notes.delete(path)
            await store.remove(path, origin)
        },

        async isDirectoryEmpty(path) {
            const prefix = path ? path + "/" : ""
            const hasNote = [...notes.keys()].some((notePath) => notePath.startsWith(prefix))
            const hasSubDirectory = [...directories].some((dir) => dir.startsWith(prefix))
            return !hasNote && !hasSubDirectory
        },

        async deleteDirectory(path) {
            directories.delete(path)
            await store.rmdir(path, origin)
            return true
        },

        async move(path, newPath) {
            const content = notes.get(path)
            if (content !== undefined) {
                notes.set(newPath, content)
            }
            notes.delete(path)
            await store.move(path, newPath, origin)
        },

        async saveAndQuit(contents) {
            await Promise.all([...contents].map(([path, content]) => putNote(path, content)))
        },

        async exists(path) {
            return notes.has(path)
        },

        async getList() {
            const list = {}
            for (const [path, content] of notes) {
                list[path] = getNoteMetadata(content)
            }
            if (list["scratch.txt"] === undefined) {
                list["scratch.txt"] = {name: "Scratch"}
            }
            return list
        },

        async getDirectoryList() {
            return [...new Set([...directoriesOfNotes(), ...directories])]
        },

        async close() {
        },

        _onChangeCallbacks: onChangeCallbacks,
        addOnChangeCallback(path, callback) {
            onChangeCallbacks[path] = [...(onChangeCallbacks[path] || []), callback]
        },
        removeOnChangeCallback(path, callback) {
            const left = (onChangeCallbacks[path] || []).filter((cb) => cb !== callback)
            if (left.length > 0) {
                onChangeCallbacks[path] = left
            } else {
                delete onChangeCallbacks[path]
            }
        },

        pathSeparator: "/",

        setLibraryPathChangeCallback() {
        },
    },

    mainProcess: {
        on(event, callback) {
            ipcRenderer.on(event, callback)
        },

        off(event, callback) {
            ipcRenderer.off(event, callback)
        },

        invoke(event, ...args) {
            switch (event) {
                case SAVE_TABS_STATE:
                    setState("openTabsState", JSON.stringify(args[0]))
                    break;
                case LOAD_TABS_STATE:
                    if (state.openTabsState) {
                        try {
                            return JSON.parse(state.openTabsState)
                        } catch {
                            return undefined
                        }
                    }
                    return undefined
                case LIBRARY_SEARCH_START:
                    searchLibrary(args[0])
                    return { ok: true }
                case LIBRARY_SEARCH_CANCEL:
                    return { ok: true }
            }
        }
    },

    settings: initialSettings,

    setSettings(settings) {
        setState("settings", JSON.stringify(settings))
        ipcRenderer.send(SETTINGS_CHANGE_EVENT, settings)
    },

    themeMode: {
        set: (mode) => {
            setState("theme", mode)
            themeCallback(mode)
        },
        get: async () => {
            const theme = state.theme || "system"
            const systemTheme = mediaMatch.matches ? "dark" : "light"
            return {
                theme: theme,
                computed: theme === "system" ? systemTheme : theme,
            }
        },
        onChange: (callback) => {
            themeCallback = callback
        },
        removeListener() {
            themeCallback = null
        },
        initial: state.theme || "system",
    },

    getCurrencyData: async () => {
        if (currencyData !== null) {
            return currencyData
        }
        const response = await fetch(
            CURRENCY_RATES_URL,
            getCurrencyFetchOptions(getClientId(), `${__APP_VERSION__}-tiili`),
        )
        currencyData = JSON.parse(await response.text())
        return currencyData
    },

    async getVersion() {
        return __APP_VERSION__ + " (" + __GIT_HASH__ + ")"
    },

    async getInitErrors() {
    },

    setWindowTitle(title) {
        document.title = title + " - Heynote"
    },

    async getSystemLocale() {
        return navigator.language
    },
}

function searchLibrary(options) {
    const query = options?.query || ""
    if (!isLibrarySearchQueryLongEnough(query)) {
        ipcRenderer.send(LIBRARY_SEARCH_DONE, { searchId: options?.searchId })
        return
    }
    const flags = options.caseSensitive ? "g" : "gi"
    let pattern
    try {
        pattern = createLibrarySearchPattern(options, flags)
    } catch (error) {
        ipcRenderer.send(LIBRARY_SEARCH_ERROR, {
            searchId: options.searchId,
            message: `Invalid regular expression: ${error.message}`,
        })
        return
    }
    for (const [buffer, content] of notes) {
        const lines = content.split(/\r?\n/)
        lines.forEach((line, index) => {
            const submatches = []
            pattern.lastIndex = 0
            let match = pattern.exec(line)
            while (match) {
                submatches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0],
                })
                if (match[0].length === 0) {
                    pattern.lastIndex++
                }
                match = pattern.exec(line)
            }
            if (submatches.length === 0) {
                return
            }
            const normalizedMatch = normalizeLibrarySearchMatch({
                line,
                lineNumber: index + 1,
                submatches,
            })
            if (!normalizedMatch) {
                return
            }
            ipcRenderer.send(LIBRARY_SEARCH_MATCH, {
                searchId: options.searchId,
                type: "match",
                buffer,
                ...normalizedMatch,
            })
        })
    }
    ipcRenderer.send(LIBRARY_SEARCH_DONE, { searchId: options.searchId })
}

/** Saves every open note now and stops following other pages; tiili calls this before it closes the pane. */
window.tiiliFlush = () => {
    ipcRenderer.send(WINDOW_CLOSE_EVENT)
    stopFollowing()
}
window.addEventListener("beforeunload", () => ipcRenderer.send(WINDOW_CLOSE_EVENT))
window.addEventListener("pagehide", stopFollowing)

export { Heynote, ipcRenderer }
