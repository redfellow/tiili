/**
 * Attention signals: what a terminal pane hears that means "this pane needs you" (the bell and the notification
 * escape codes), how a message is made safe to show, and the per-pane gate that merges and rate-limits signals.
 * Pure, so it tests without a terminal.
 */

/** A report longer than this many UTF-8 bytes is ignored whole. */
export const MAX_MESSAGE_BYTES = 4096;
/** A BEL and an OSC 9 this close together count as one signal. */
export const MERGE_MS = 100;
/** One pane fires at most once in this long. */
export const RATE_LIMIT_MS = 2000;

/** One attention signal: a bell, or a notification with its (sanitised) message text. */
export type AttentionSignal = { kind: "bell" } | { kind: "message"; text: string };

/** The event `attention-changed` carries: every marked session, oldest first, with its message. */
export interface AttentionMark {
  session: number;
  message: string | null;
}

/** Event sent to every window when the marked panes change; its payload is `{ marks: AttentionMark[] }`. */
export const ATTENTION_CHANGED_EVENT = "attention-changed";
/** Event sent to the window that is to focus a marked pane; its payload is the session. */
export const ATTENTION_FOCUS_EVENT = "attention-focus";

/**
 * The message of an OSC 9 report (`ESC ] 9 ; <data>`), or undefined for ConEmu's numbered codes such as `9;4;…`
 * (progress) and `9;9;…` (folder), which are not notifications.
 */
export function parseOsc9(data: string): string | undefined {
  if (/^\d+(;|$)/.test(data)) return undefined;
  return data;
}

/** The message of an OSC 777 `notify;<title>;<body>` report, or undefined for any other OSC 777. */
export function parseOsc777(data: string): string | undefined {
  const [kind, title = "", ...rest] = data.split(";");
  if (kind !== "notify") return undefined;
  const body = rest.join(";");
  return title && body ? `${title}: ${body}` : title || body;
}

/** Decodes base64 `text` as UTF-8, or undefined when it is not base64. */
function fromBase64(text: string): string | undefined {
  try {
    const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

/**
 * The message of a basic OSC 99 report (`ESC ] 99 ; <metadata> ; <payload>`, kitty's notifications), or undefined
 * for what is not a whole title or body: chunks still to be continued (`d=0`), queries and other payload types.
 */
export function parseOsc99(data: string): string | undefined {
  const split = data.indexOf(";");
  if (split < 0) return undefined;
  const meta = new Map<string, string>();
  for (const pair of data.slice(0, split).split(":")) {
    const eq = pair.indexOf("=");
    if (eq > 0) meta.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  if (meta.get("d") === "0") return undefined;
  const payload = meta.get("p") ?? "title";
  if (payload !== "title" && payload !== "body") return undefined;
  const text = data.slice(split + 1);
  return meta.get("e") === "1" ? fromBase64(text) : text;
}

/**
 * `text` made safe to show as plain text: control characters (C0, DEL and C1) removed and the ends trimmed.
 * Undefined when the report is over `MAX_MESSAGE_BYTES` bytes, which is then ignored.
 */
export function sanitizeMessage(text: string): string | undefined {
  if (new TextEncoder().encode(text).length > MAX_MESSAGE_BYTES) return undefined;
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
}

/**
 * The signal a `tiili attention` request makes: a notification with `message` made safe as an OSC 9 report's is, or
 * undefined when the message is too long to show.
 */
export function requestedSignal(message: string): AttentionSignal | undefined {
  const text = sanitizeMessage(message);
  return text === undefined ? undefined : { kind: "message", text };
}

/** What the gate makes of a signal: a new mark (with its message, if any), a message for the mark just made, or nothing. */
export type GateResult =
  | { action: "mark"; message?: string }
  | { action: "message"; message: string }
  | undefined;

/**
 * One pane's gate: it fires at most once every `RATE_LIMIT_MS`, and a bell and an OSC 9 arriving within `MERGE_MS`
 * of each other count as one signal that keeps the message.
 */
export class AttentionGate {
  private last: { at: number; kind: AttentionSignal["kind"] } | undefined;

  /** Passes `signal`, heard at `now` milliseconds, through the gate. */
  signal(signal: AttentionSignal, now: number): GateResult {
    const last = this.last;
    if (last && now - last.at < MERGE_MS) {
      if (last.kind === "bell" && signal.kind === "message" && signal.text !== "") {
        last.kind = "message";
        return { action: "message", message: signal.text };
      }
      return undefined;
    }
    if (last && now - last.at < RATE_LIMIT_MS) return undefined;
    this.last = { at: now, kind: signal.kind };
    if (signal.kind === "message" && signal.text !== "") return { action: "mark", message: signal.text };
    return { action: "mark" };
  }
}
