/** The app's name as it ends every window title. */
const APP_TITLE = "tiili >_";

/** A window's title: the focused pane's `command` followed by ` — tiili >_`, or just `tiili >_` without one. */
export function windowTitle(command?: string): string {
  const name = command?.trim();
  return name ? `${name} — ${APP_TITLE}` : APP_TITLE;
}
