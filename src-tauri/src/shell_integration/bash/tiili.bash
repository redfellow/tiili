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

# Report the folder with OSC 7 before every prompt, whichever prompt is shown, so tiili knows this pane is local, and
# follow the prompt choice where this shell does. It runs first and keeps $? for the user's own prompt commands.
_tiili_osc7() {
  local _tiili_status=$? LC_ALL=C enc= c i
  if [ -n "$_tiili_follows" ]; then _tiili_apply_prompt; fi
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
