/**
 * Shell snippets for a remote machine's startup file. At every prompt each one reports the folder with OSC 7 and the
 * git root (empty outside a repository) as the `tiili_repo` user variable (`OSC 1337 ; SetUserVar`, base64), so a pane
 * that ssh'd there shows that machine's folder and repository. `base64` output has its newlines removed because GNU
 * wraps long values and BSD doesn't.
 */

export type RemoteShell = "bash" | "zsh" | "fish";

const BASH = [
  "# tiili: report this folder and its git repository at every prompt",
  "_tiili_report() {",
  "  local s=$? LC_ALL=C enc= c i root",
  "  for (( i = 0; i < ${#PWD}; i++ )); do",
  "    c=${PWD:i:1}",
  "    case $c in",
  "      [-/:_.~a-zA-Z0-9]) enc+=$c ;;",
  "      *) printf -v c '%d' \"'$c\"; printf -v c '%%%02X' $(( c & 255 )); enc+=$c ;;",
  "    esac",
  "  done",
  "  root=$(git rev-parse --show-toplevel 2>/dev/null | tr -d '\\n' | base64 | tr -d '\\n')",
  "  printf '\\033]7;file://%s%s\\007\\033]1337;SetUserVar=tiili_repo=%s\\007' \"$HOSTNAME\" \"$enc\" \"$root\"",
  "  return $s",
  "}",
  "case \"$(declare -p PROMPT_COMMAND 2>/dev/null)\" in",
  "  'declare -a'*) PROMPT_COMMAND=(_tiili_report \"${PROMPT_COMMAND[@]}\") ;;",
  "  *) PROMPT_COMMAND=\"_tiili_report${PROMPT_COMMAND:+; $PROMPT_COMMAND}\" ;;",
  "esac",
].join("\n");

const ZSH = [
  "# tiili: report this folder and its git repository at every prompt",
  "_tiili_report() {",
  "  emulate -L zsh",
  "  local LC_ALL=C enc= c hex root",
  "  local -i i",
  "  for (( i = 1; i <= ${#PWD}; i++ )); do",
  "    c=${PWD[i]}",
  "    case $c in",
  "      [-/:_.~a-zA-Z0-9]) enc+=$c ;;",
  "      *) printf -v hex '%%%02X' \"'$c\"; enc+=$hex ;;",
  "    esac",
  "  done",
  "  root=$(git rev-parse --show-toplevel 2>/dev/null | tr -d '\\n' | base64 | tr -d '\\n')",
  "  printf '\\033]7;file://%s%s\\007\\033]1337;SetUserVar=tiili_repo=%s\\007' \"$HOST\" \"$enc\" \"$root\"",
  "}",
  "autoload -Uz add-zsh-hook",
  "add-zsh-hook precmd _tiili_report",
].join("\n");

const FISH = [
  "# tiili: report this folder and its git repository at every prompt",
  "function _tiili_report --on-event fish_prompt",
  "    set -l root (git rev-parse --show-toplevel 2>/dev/null)",
  "    if command -q base64",
  "        set root (printf '%s' \"$root\" | base64 | tr -d '\\n')",
  "    else",
  "        set root (printf '%s' \"$root\" | openssl base64 | tr -d '\\n')",
  "    end",
  "    printf '\\033]7;file://%s%s\\007\\033]1337;SetUserVar=tiili_repo=%s\\007' $hostname (string escape --style=url -- $PWD) \"$root\"",
  "end",
].join("\n");

/** One snippet per shell, in the order the settings show them. */
export const REMOTE_SNIPPETS: readonly { shell: RemoteShell; text: string }[] = [
  { shell: "bash", text: BASH },
  { shell: "zsh", text: ZSH },
  { shell: "fish", text: FISH },
];
