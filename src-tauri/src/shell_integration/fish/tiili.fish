# tiili shell integration for fish. tiili starts `fish -l --init-command 'source <this file>'`, which runs after the
# user's config.fish; the prompt is taken over at the first prompt, once fish_prompt (often autoloaded) exists. tiili's
# prompt shows in place of the user's own (theirs, a framework's like tide, or fish's default), following the choice in
# the integration folder's `prompt` file before every prompt (Off, shown as Default, shows theirs). Colours are ANSI
# slots (\e[30m..\e[37m), so the terminal's theme picks the actual colours.

set -g _tiili_prompt_file (string replace -r '/fish/[^/]*$' '' -- (status filename))/prompt
set -q TIILI_PROMPT; and set -g _tiili_prompt_start $TIILI_PROMPT; or set -g _tiili_prompt_start off
set -e TIILI_PROMPT

# The current choice: the integration folder's `prompt` file, else the one the shell started with.
function _tiili_prompt_style
    set -l style $_tiili_prompt_start
    test -r $_tiili_prompt_file; and read style <$_tiili_prompt_file
    echo $style
end

# The folder as zsh's %~ shows it: the home folder as ~.
function _tiili_prompt_pwd
    if test "$PWD" = "$HOME"
        echo '~'
    else if string match -q -- "$HOME/*" $PWD
        echo '~'(string sub -s (math (string length -- $HOME) + 1) -- $PWD)
    else
        echo $PWD
    end
end

# Sets $status for the user's prompt, which reads the last command's.
function _tiili_status
    return $argv[1]
end

function _tiili_take_prompt --on-event fish_prompt
    functions -e _tiili_take_prompt
    functions -q fish_prompt; and functions -c fish_prompt _tiili_user_prompt
    functions -q fish_right_prompt; and functions -c fish_right_prompt _tiili_user_right_prompt
    function fish_prompt
        set -l last $status
        set -l char '$'
        fish_is_root_user; and set char '#'
        switch (_tiili_prompt_style)
            case classic
                printf '\e[36m%s\e[39m@\e[32m%s\e[39m:\e[34m%s\e[39m%s ' $USER (prompt_hostname) (_tiili_prompt_pwd) $char
            case minimal
                printf '\e[34m%s\e[39m \e[35m❯\e[39m ' (_tiili_prompt_pwd)
            case tiili
                printf '\e[36m%s\e[39m@\e[32m%s\e[39m \e[34m%s\e[39m\n\e[33m❯\e[39m ' $USER (prompt_hostname) (_tiili_prompt_pwd)
            case '*'
                if functions -q _tiili_user_prompt
                    _tiili_status $last
                    _tiili_user_prompt
                else
                    printf '%s> ' (_tiili_prompt_pwd)
                end
        end
    end
    function fish_right_prompt
        set -l last $status
        contains -- (_tiili_prompt_style) classic minimal tiili; and return
        if functions -q _tiili_user_right_prompt
            _tiili_status $last
            _tiili_user_right_prompt
        end
    end
end

# tiili sends SIGUSR1 when the prompt choice changes: redraw an idle prompt in the new one.
function _tiili_redraw --on-signal SIGUSR1
    commandline -f repaint
end

# Report the folder with OSC 7 before every prompt, whichever prompt is shown, so tiili knows this pane is local.
function _tiili_osc7 --on-event fish_prompt
    printf '\e]7;file://%s%s\a' $hostname (string escape --style=url -- $PWD)
end

# Tell tiili the command line about to run, in base64 (OSC 1337 TiiliCmd), so a pane reopened after tiili ends can
# show what was running. A line starting with a space stays out of fish's history, so it is not reported either.
function _tiili_preexec --on-event fish_preexec
    set -l line
    if not string match -q -- ' *' $argv[1]; and command -q base64
        set line (printf '%s' $argv[1] | base64 | string join '')
    end
    printf '\e]1337;TiiliCmd=%s\a' "$line"
end

# A pane reopened after tiili ended: the command that was running becomes the newest history entry, so Up then Enter
# runs it again.
if set -q TIILI_RESTORE_HISTORY
    if test -r $TIILI_RESTORE_HISTORY
        history append -- (string collect <$TIILI_RESTORE_HISTORY)
    end
    command rm -f -- $TIILI_RESTORE_HISTORY
    set -e TIILI_RESTORE_HISTORY
end
