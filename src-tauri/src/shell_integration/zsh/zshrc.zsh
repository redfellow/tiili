# tiili shell integration for zsh: the user's own .zshrc, with their ZDOTDIR, then tiili's prompt when the user's
# files left zsh's default one, following the choice in the integration folder's `prompt` file before every prompt
# (Off puts the default prompt back). Colours are ANSI slots (%F{0..7}), so the terminal's theme picks the actual colours.
ZDOTDIR="${TIILI_USER_ZDOTDIR:-$HOME}"
# /etc/zshrc (macOS) put the history in tiili's folder, as ZDOTDIR pointed there: keep it where the user's is.
[[ "$HISTFILE" == "$_tiili_zdotdir/.zsh_history" ]] && HISTFILE="$ZDOTDIR/.zsh_history"
[[ -r "$ZDOTDIR/.zshrc" ]] && builtin source "$ZDOTDIR/.zshrc"
TIILI_USER_ZDOTDIR="$ZDOTDIR"
ZDOTDIR="$_tiili_zdotdir"

autoload -Uz add-zsh-hook
if [[ -z "$PROMPT" || "$PROMPT" == '%m%# ' || "$PROMPT" == '%n@%m %1~ %# ' ]]; then
  typeset -g _tiili_default_prompt="$PROMPT" _tiili_prompt_start="${TIILI_PROMPT:-off}" _tiili_prompt_applied=
  typeset -g _tiili_prompt_file="${_tiili_zdotdir:h}/prompt"
  # Sets the chosen prompt; succeeds only when it changed, so an unchanged choice never touches PROMPT.
  _tiili_apply_prompt() {
    emulate -L zsh
    local style=$_tiili_prompt_start
    [[ -r $_tiili_prompt_file ]] && style=$(<$_tiili_prompt_file)
    [[ $style == $_tiili_prompt_applied ]] && return 1
    _tiili_prompt_applied=$style
    case $style in
      classic) PROMPT='%F{6}%n%f@%F{2}%m%f:%F{4}%~%f%(!.#.$) ' ;;
      minimal) PROMPT='%F{4}%~%f %F{5}❯%f ' ;;
      tiili) PROMPT='%F{6}%n%f@%F{2}%m%f %F{4}%~%f'$'\n''%F{3}❯%f ' ;;
      *) PROMPT=$_tiili_default_prompt ;;
    esac
    return 0
  }
  _tiili_apply_prompt
  add-zsh-hook precmd _tiili_apply_prompt
fi

# zsh shows pasted text and its own selection (the region) in reverse video, a block of the text colour. Give them the
# terminal selection's colour instead, which tiili writes to the integration folder's `highlight` file with each theme
# and the shell reads before every prompt. A context the user's files highlight themselves stays theirs.
typeset -ga _tiili_highlight_contexts=()
[[ -n ${zle_highlight[(r)paste:*]} ]] || _tiili_highlight_contexts+=(paste)
[[ -n ${zle_highlight[(r)region:*]} ]] || _tiili_highlight_contexts+=(region)
if (( ${#_tiili_highlight_contexts} )); then
  typeset -g _tiili_highlight_file="${_tiili_zdotdir:h}/highlight"
  _tiili_apply_highlight() {
    local _tiili_status=$?
    emulate -L zsh
    local colour context
    [[ -r $_tiili_highlight_file ]] && colour=$(<$_tiili_highlight_file)
    if [[ $colour == '#'[[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]] ]]; then
      for context in $_tiili_highlight_contexts; do
        zle_highlight=(${zle_highlight:#$context:*} $context:bg=$colour)
      done
    fi
    return $_tiili_status
  }
  _tiili_apply_highlight
  add-zsh-hook precmd _tiili_apply_highlight
fi

# Home, End and the Ctrl/Alt word moves: stock zsh binds none of them. Each is bound in the emacs and viins keymaps
# only where the user's files left it unbound, so their own bindings stay.
() {
  emulate -L zsh
  local map seq
  local -A widgets=(
    '^[[H' beginning-of-line '^[OH' beginning-of-line
    '^[[F' end-of-line '^[OF' end-of-line
    '^[[1;3D' backward-word '^[[1;5D' backward-word
    '^[[1;3C' forward-word '^[[1;5C' forward-word
  )
  for map in emacs viins; do
    for seq in ${(k)widgets}; do
      [[ $(bindkey -M $map $seq 2>/dev/null) == (|*' undefined-key') ]] && bindkey -M $map $seq $widgets[$seq]
    done
  done
}

# Report the folder with OSC 7 before every prompt, whichever prompt is shown, so tiili knows this pane is local.
_tiili_osc7() {
  local _tiili_status=$?
  emulate -L zsh
  local LC_ALL=C enc= c hex
  local -i i
  for (( i = 1; i <= ${#PWD}; i++ )); do
    c=${PWD[i]}
    case $c in
      [-/:_.~a-zA-Z0-9]) enc+=$c ;;
      *) printf -v hex '%%%02X' "'$c"; enc+=$hex ;;
    esac
  done
  printf '\e]7;file://%s%s\a' "$HOST" "$enc"
  return $_tiili_status
}
add-zsh-hook precmd _tiili_osc7

# Tell tiili the command line about to run, in base64 (OSC 1337 TiiliCmd), so a pane reopened after tiili ends can
# show what was running; the next OSC 7 tells it the prompt is back.
_tiili_base64() {
  emulate -L zsh
  setopt localoptions nomultibyte
  local LC_ALL=C s=$1 t=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ ch out=
  local -i i k v n=${#1}
  for (( i = 1; i <= n; i += 3 )); do
    v=0
    for (( k = 0; k < 3; k++ )); do
      (( v <<= 8 ))
      if (( i + k <= n )); then
        ch=${s[i+k]}
        (( v += #ch & 255 ))
      fi
    done
    out+=${t[(v >> 18 & 63) + 1]}${t[(v >> 12 & 63) + 1]}
    if (( i + 1 <= n )); then out+=${t[(v >> 6 & 63) + 1]}; else out+='='; fi
    if (( i + 2 <= n )); then out+=${t[(v & 63) + 1]}; else out+='='; fi
  done
  REPLY=$out
}
# Only a line that goes into the history is reported: one the user's history hooks reject, or that starts with a
# space under hist_ignore_space, is kept off the disk, so tiili reports no command for it. The user's zshaddhistory
# function and hooks are run from tiili's own one, which so learns their answer and hands it on to zsh unchanged.
typeset -g _tiili_hist_kept=
typeset -ga _tiili_addhistory_hooks
_tiili_addhistory_hooks=("${(@)zshaddhistory_functions}")
if (( ${+functions[zshaddhistory]} )); then
  functions[_tiili_user_zshaddhistory]=$functions[zshaddhistory]
  unfunction zshaddhistory
  _tiili_addhistory_hooks=(_tiili_user_zshaddhistory "${(@)_tiili_addhistory_hooks}")
fi
zshaddhistory_functions=(_tiili_addhistory)
_tiili_addhistory() {
  local _tiili_hook
  local -i _tiili_ret=0 _tiili_r
  for _tiili_hook in "${(@)_tiili_addhistory_hooks}"; do
    (( ${+functions[$_tiili_hook]} )) || continue
    "$_tiili_hook" "$@"
    _tiili_r=$?
    (( _tiili_ret )) || _tiili_ret=$_tiili_r
  done
  _tiili_hist_kept=
  # 2 keeps the line in memory only, off the history file, so it is not reported either.
  if (( ! _tiili_ret )) && [[ ! ( -o hist_ignore_space && $1 == ' '* ) ]]; then _tiili_hist_kept=1; fi
  return $_tiili_ret
}
_tiili_preexec() {
  local _tiili_status=$? REPLY=
  if [[ -n $_tiili_hist_kept ]]; then _tiili_base64 "$1"; fi
  _tiili_hist_kept=
  printf '\e]1337;TiiliCmd=%s\a' "$REPLY"
  return $_tiili_status
}
add-zsh-hook preexec _tiili_preexec

# A pane reopened after tiili ended: the command that was running becomes the newest history entry, so Up then Enter
# runs it again. Done at the first prompt, once the user's history has been read.
if [[ -n $TIILI_RESTORE_HISTORY ]]; then
  typeset -g _tiili_restore_history=$TIILI_RESTORE_HISTORY
  _tiili_seed_history() {
    local _tiili_status=$?
    emulate -L zsh
    add-zsh-hook -d precmd _tiili_seed_history
    [[ -r $_tiili_restore_history ]] && print -s -r -- "$(<$_tiili_restore_history)"
    command rm -f -- "$_tiili_restore_history"
    unset _tiili_restore_history
    return $_tiili_status
  }
  add-zsh-hook precmd _tiili_seed_history
fi
unset TIILI_RESTORE_HISTORY

# Without a login shell this is the last startup file: hand ZDOTDIR back to the user.
if [[ ! -o login ]]; then
  ZDOTDIR="$TIILI_USER_ZDOTDIR"
  [[ "$ZDOTDIR" == "$HOME" ]] && unset ZDOTDIR
  unset TIILI_USER_ZDOTDIR TIILI_PROMPT _tiili_zdotdir
fi
