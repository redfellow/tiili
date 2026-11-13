# tiili shell integration for bash. tiili starts `bash --rcfile <this file> -i`; this runs the startup files a login
# shell would, then sets tiili's prompt when they left bash's default one. Colours are ANSI slots (\e[30m..\e[37m),
# so the terminal's theme picks the actual colours.
if [ -r /etc/profile ]; then . /etc/profile; fi
for _tiili_file in "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile"; do
  if [ -r "$_tiili_file" ]; then
    . "$_tiili_file"
    break
  fi
done
unset _tiili_file

if [ -z "${PS1-}" ] || [ "$PS1" = '\s-\v\$ ' ] || [ "$PS1" = '\h:\W \u\$ ' ]; then
  case "$TIILI_PROMPT" in
    classic) PS1='\[\e[36m\]\u\[\e[39m\]@\[\e[32m\]\h\[\e[39m\]:\[\e[34m\]\w\[\e[39m\]\$ ' ;;
    minimal) PS1='\[\e[34m\]\w\[\e[39m\] \[\e[35m\]❯\[\e[39m\] ' ;;
    tiili) PS1='\[\e[36m\]\u\[\e[39m\]@\[\e[32m\]\h\[\e[39m\] \[\e[34m\]\w\[\e[39m\]\n\[\e[33m\]❯\[\e[39m\] ' ;;
  esac
fi
unset TIILI_PROMPT
