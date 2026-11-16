# tiili shell integration for bash. tiili starts `bash --rcfile <this file> -i`; this runs the startup files a login
# shell would, then sets tiili's prompt when they left bash's default one, following the choice in the integration
# folder's `prompt` file before every prompt (Off puts the default prompt back). Colours are ANSI slots
# (\e[30m..\e[37m), so the terminal's theme picks the actual colours.

# A SIGUSR1 (sent to redraw zsh prompts) never ends this shell; a handler, unlike ignoring it, leaves the signal's
# default to the programs it runs.
trap : USR1
_tiili_prompt_file="${BASH_SOURCE[0]%/*}/../prompt"
if [ -r /etc/profile ]; then . /etc/profile; fi
for _tiili_file in "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile"; do
  if [ -r "$_tiili_file" ]; then
    . "$_tiili_file"
    break
  fi
done
unset _tiili_file

# Sets the chosen prompt when it changed, so an unchanged choice never touches PS1.
_tiili_apply_prompt() {
  local style=$_tiili_prompt_start
  if [ -r "$_tiili_prompt_file" ]; then read -r style < "$_tiili_prompt_file"; fi
  [ "$style" = "$_tiili_prompt_applied" ] && return
  _tiili_prompt_applied=$style
  case "$style" in
    classic) PS1='\[\e[36m\]\u\[\e[39m\]@\[\e[32m\]\h\[\e[39m\]:\[\e[34m\]\w\[\e[39m\]\$ ' ;;
    minimal) PS1='\[\e[34m\]\w\[\e[39m\] \[\e[35m\]❯\[\e[39m\] ' ;;
    tiili) PS1='\[\e[36m\]\u\[\e[39m\]@\[\e[32m\]\h\[\e[39m\] \[\e[34m\]\w\[\e[39m\]\n\[\e[33m\]❯\[\e[39m\] ' ;;
    *) PS1=$_tiili_default_ps1 ;;
  esac
}
_tiili_follows=
if [ -z "${PS1-}" ] || [ "$PS1" = '\s-\v\$ ' ] || [ "$PS1" = '\h:\W \u\$ ' ]; then
  _tiili_follows=1
  _tiili_default_ps1=${PS1-}
  _tiili_prompt_start=${TIILI_PROMPT:-off}
  _tiili_prompt_applied=
  _tiili_apply_prompt
fi
unset TIILI_PROMPT

# bash 5.1 and later show pasted text and the active region in reverse video, a block of the text colour. Give them the
# terminal selection's colour instead, which tiili writes to the integration folder's `highlight` file with each theme
# and the shell reads before every prompt; unless the user's inputrc set a region colour of its own.
_tiili_highlight_file="${BASH_SOURCE[0]%/*}/../highlight"
_tiili_highlight_applied=
_tiili_highlights=
if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
  _tiili_highlights=1
  # Unset, readline lists the colour empty or as the terminal's standout (reverse video): anything else is the user's.
  while read -r _tiili_line; do
    case $_tiili_line in
      'set active-region-start-color '*)
        [ "${_tiili_line#set active-region-start-color }" = '\e[7m' ] || _tiili_highlights= ;;
    esac
  done < <(bind -v 2>/dev/null)
  unset _tiili_line
fi
# Sets the colour when it changed, so an unchanged file never rebinds readline.
_tiili_apply_highlight() {
  local colour=
  if [ -r "$_tiili_highlight_file" ]; then read -r colour < "$_tiili_highlight_file"; fi
  [ "$colour" = "$_tiili_highlight_applied" ] && return
  case $colour in
    '#'[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]) ;;
    *) return ;;
  esac
  _tiili_highlight_applied=$colour
  bind "set active-region-start-color \"\\e[48;2;$((16#${colour:1:2}));$((16#${colour:3:2}));$((16#${colour:5:2}))m\""
  bind 'set active-region-end-color "\e[49m"'
}
if [ -n "$_tiili_highlights" ]; then _tiili_apply_highlight; fi

# Ctrl/Alt+arrows move by a word, unless the user's inputrc or startup files bound them already. Only where readline
# edits the line: an interactive shell with emacs or vi editing on.
if [[ $- == *i* ]] && { [[ -o emacs ]] || [[ -o vi ]]; }; then
  _tiili_bound=$(bind -p 2>/dev/null)
  for _tiili_key in '\e[1;5D:backward-word' '\e[1;3D:backward-word' '\e[1;5C:forward-word' '\e[1;3C:forward-word'; do
    case $_tiili_bound in
      *"\"${_tiili_key%%:*}\": "*) ;;
      *) bind "\"${_tiili_key%%:*}\": ${_tiili_key#*:}" ;;
    esac
  done
  unset _tiili_bound _tiili_key
fi

# Report the folder with OSC 7 before every prompt, whichever prompt is shown, so tiili knows this pane is local, and
# follow the prompt choice and the paste colour where this shell does. It runs first and keeps $? for the user's own
# prompt commands.
_tiili_osc7() {
  local _tiili_status=$? LC_ALL=C enc= c i
  _tiili_seed_history
  if [ -n "$_tiili_follows" ]; then _tiili_apply_prompt; fi
  if [ -n "$_tiili_highlights" ]; then _tiili_apply_highlight; fi
  for (( i = 0; i < ${#PWD}; i++ )); do
    c=${PWD:i:1}
    case $c in
      [-/:_.~a-zA-Z0-9]) enc+=$c ;;
      # bash 3.2 reads bytes above 127 as negative numbers.
      *) printf -v c '%d' "'$c"; printf -v c '%%%02X' $(( c & 255 )); enc+=$c ;;
    esac
  done
  printf '\e]7;file://%s%s\a' "$HOSTNAME" "$enc"
  return $_tiili_status
}
case "$(declare -p PROMPT_COMMAND 2>/dev/null)" in
  'declare -a'*) PROMPT_COMMAND=(_tiili_osc7 "${PROMPT_COMMAND[@]}") ;;
  *) PROMPT_COMMAND="_tiili_osc7${PROMPT_COMMAND:+; $PROMPT_COMMAND}" ;;
esac

# A pane reopened after tiili ended: the command that was running becomes the newest history entry, so Up then Enter
# runs it again. Done at the first prompt, once bash has read the user's history.
_tiili_restore_history=${TIILI_RESTORE_HISTORY-}
unset TIILI_RESTORE_HISTORY
_tiili_seed_history() {
  [ -n "$_tiili_restore_history" ] || return 0
  if [ -r "$_tiili_restore_history" ]; then history -s -- "$(< "$_tiili_restore_history")"; fi
  command rm -f -- "$_tiili_restore_history"
  _tiili_restore_history=
}

# Tell tiili the command line about to run, in base64 (OSC 1337 TiiliCmd), so a pane reopened after tiili ends can
# show what was running; the next OSC 7 tells it the prompt is back. A DEBUG trap runs before every command, so only
# the first one after a prompt counts, as with bash-preexec; a DEBUG trap of the user's own is left alone.
_tiili_base64() {
  local LC_ALL=C
  local s=$1 t=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ out= c i k v n
  n=${#s}
  for (( i = 0; i < n; i += 3 )); do
    v=0
    for (( k = 0; k < 3; k++ )); do
      v=$(( v << 8 ))
      if (( i + k < n )); then
        printf -v c '%d' "'${s:i+k:1}"
        v=$(( v + (c & 255) ))
      fi
    done
    out+=${t:$(( v >> 18 & 63 )):1}${t:$(( v >> 12 & 63 )):1}
    if (( i + 1 < n )); then out+=${t:$(( v >> 6 & 63 )):1}; else out+='='; fi
    if (( i + 2 < n )); then out+=${t:$(( v & 63 )):1}; else out+='='; fi
  done
  _tiili_reply=$out
}
_tiili_at_prompt=
_tiili_preexec() {
  [ -n "$_tiili_at_prompt" ] || return 0
  # An empty line runs no command, so the next thing after the prompt is the prompt command itself.
  if [ "$BASH_COMMAND" = _tiili_osc7 ]; then _tiili_at_prompt=; return 0; fi
  [ -z "${COMP_LINE-}" ] || return 0
  [ "$BASH_COMMAND" != _tiili_ready ] || return 0
  _tiili_at_prompt=
  local line _tiili_reply=
  line=$(HISTTIMEFORMAT= builtin history 1)
  # The newest entry is the same as at the prompt when this line stayed out of the history (HISTCONTROL,
  # HISTIGNORE, history off), or when it repeats that entry (ignoredups, erasedups). Then it is reported only where
  # that entry is the line now running: its first command is the one about to run. That text is in the history
  # already, so a line kept out of it is never reported.
  local changed=1 rest after='^[[:space:]]*([;&|)]|$)'
  [ "$line" != "$_tiili_last_history" ] || changed=
  [[ $line =~ ^\ *[0-9]+\*?\ +(.*)$ ]] && line=${BASH_REMATCH[1]}
  if [ -z "$changed" ]; then
    rest=${line#"$BASH_COMMAND"}
    if [ -z "$BASH_COMMAND" ] || [ "$rest" = "$line" ] || ! [[ $rest =~ $after ]]; then line=; fi
  fi
  if [ -n "$line" ]; then _tiili_base64 "$line"; fi
  printf '\e]1337;TiiliCmd=%s\a' "$_tiili_reply"
}
_tiili_last_history=
_tiili_ready() {
  local _tiili_status=$?
  _tiili_last_history=$(HISTTIMEFORMAT= builtin history 1)
  _tiili_at_prompt=1
  return $_tiili_status
}
if [ -z "$(trap -p DEBUG)" ]; then
  case "$(declare -p PROMPT_COMMAND 2>/dev/null)" in
    'declare -a'*) PROMPT_COMMAND+=(_tiili_ready) ;;
    # A newline, not `;`: a PROMPT_COMMAND of the user's ending in `;` (`history -a; $PROMPT_COMMAND`) stays valid.
    *) PROMPT_COMMAND+=$'\n'_tiili_ready ;;
  esac
  trap _tiili_preexec DEBUG
fi
