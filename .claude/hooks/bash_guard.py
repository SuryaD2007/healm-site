#!/usr/bin/env python3
"""PreToolUse guard for Bash: asks the user before a command that deletes broadly or reaches outside the repo.

Copied from Healm (~/Developer/Healm/.claude/hooks/bash_guard.py) and adapted for healm-site.

Asks (never silently allows or refuses) when a command has:
- rm with both recursive and force (rm -rf, -fr, -Rf, -r -f, --recursive --force),
- find with -exec rm or -delete,
- rm or find on a path built from a shell variable, which can be empty at run time ("$DATA/Library"),
- any path outside the repo, except /dev and system tool folders and this project's session scratchpad,
- a path in the read-only sources (the Healm app and healm-content) used by anything but a reading
  command, or as the destination of a copy or a redirect,
- git commit or push run from outside this repo (the home folder is a separate git repo).

Reads the hook payload on stdin. Prints a PreToolUse "ask" decision with the reason, or nothing.
"""

import json
import os
import re
import shlex
import sys

HOME = os.path.expanduser("~")
REPO = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.join(HOME, "Developer", "healm-site")

# Paths outside the repo that may run without asking.
ALLOWED = [
    "/dev/",
    "/usr/",
    "/bin/",
    "/sbin/",
    "/opt/homebrew/bin/",
    "/private/tmp/claude-501/-Users-gunnu-Developer-healm-site/",
    "/tmp/claude-501/-Users-gunnu-Developer-healm-site/",
]

# Paths this project may read but never change: the app (design tokens, sounds, the waitlist function)
# and the marketing footage.
READ_ONLY = [
    os.path.join(HOME, "Developer", "Healm"),
    os.path.join(HOME, "Developer", "healm-content"),
]

# Commands that only read what they are given.
READERS = {
    "cat", "ls", "head", "tail", "grep", "egrep", "rg", "find", "wc", "file", "stat", "du", "diff",
    "cmp", "sort", "uniq", "jq", "tree", "basename", "dirname", "realpath", "readlink", "shasum",
    "md5", "xxd", "strings", "ffprobe", "mdls", "cd", "test", "[", "echo", "printf",
}
# Commands that read every path but the last (their destination).
COPIERS = {"cp", "rsync", "ditto"}
GIT_READ = {"log", "show", "status", "diff", "rev-parse", "ls-files", "blame", "branch", "remote"}

SEPARATORS = {";", "&&", "||", "|", "&", "(", ")", "{", "}", "then", "do", "else"}


def ask(reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def tokens(command: str) -> list[str]:
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|()")
        lexer.whitespace_split = True
        lexer.commenters = ""
        return list(lexer)
    except ValueError:
        # Unbalanced quotes (a heredoc body, say): split on whitespace and shell punctuation instead.
        return re.findall(r"[^\s;&|()]+|[;&|()]+", command)


def inside(path: str, root: str) -> bool:
    root = root.rstrip("/")
    return path == root or path.startswith(root + "/")


def allowed(path: str) -> bool:
    if inside(path, REPO):
        return True
    return any(inside(path, prefix.rstrip("/")) or path.startswith(prefix) for prefix in ALLOWED)


def read_only(path: str) -> bool:
    return any(inside(path, root) for root in READ_ONLY)


def reads_only(program: str, args: list[str]) -> bool:
    """True when the command cannot change the files it names."""
    if program == "sed":
        return not any(arg.startswith("-i") or arg == "--in-place" for arg in args)
    if program == "git":
        sub = [arg for arg in args if not arg.startswith("-")]
        # git -C <path> <subcommand>: skip the path.
        if "-C" in args and sub:
            sub = sub[1:]
        return bool(sub) and sub[0] in GIT_READ
    if program == "plutil":
        return "-p" in args or "-lint" in args
    if program == "find":
        return "-delete" not in args and not any(arg in {"-exec", "-execdir", "-ok"} for arg in args)
    return program in READERS


def resolve(token: str, cwd: str) -> str | None:
    """The absolute path a token names, or None when it is not a path the guard can judge."""
    if token.startswith("~"):
        token = os.path.expanduser(token)
    elif token.startswith("$HOME") or token.startswith("${HOME}"):
        token = HOME + token.split("}", 1)[-1] if token.startswith("${HOME}") else HOME + token[len("$HOME"):]
    if "=" in token and not token.startswith("/"):
        # --flag=/path or NAME=/path: judge the value.
        token = token.split("=", 1)[1]
        if token.startswith("~"):
            token = os.path.expanduser(token)
    if token.startswith("/"):
        return os.path.normpath(token)
    if ".." in token.split("/"):
        return os.path.normpath(os.path.join(cwd, token))
    return None


def check(command: str, cwd: str) -> str | None:
    parts = tokens(command)

    # Split into simple commands, and look at each.
    commands: list[list[str]] = [[]]
    for part in parts:
        if part in SEPARATORS or re.fullmatch(r"[;&|()]+", part):
            commands.append([])
        else:
            commands[-1].append(part)

    for words in commands:
        if not words:
            continue
        # The program, after any leading NAME=value assignments, sudo, xargs, command, or env.
        index = 0
        while index < len(words) and (re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", words[index])
                                      or words[index] in {"sudo", "xargs", "command", "env", "nohup", "time"}):
            index += 1
        program = os.path.basename(words[index]) if index < len(words) else ""
        args = words[index + 1:]

        if program == "rm":
            flags = [arg for arg in args if arg.startswith("-")]
            short = "".join(flag[1:] for flag in flags if not flag.startswith("--"))
            recursive = "r" in short or "R" in short or "--recursive" in flags
            force = "f" in short or "--force" in flags
            if recursive and force:
                return "rm with recursive and force flags deletes without asking."
            if any("$" in arg for arg in args if not arg.startswith("-")):
                return "rm on a path built from a shell variable, which can be empty when the command runs."

        if program == "find":
            joined = " ".join(args)
            if re.search(r"-exec(dir)?\s+(\S*/)?rm\b", joined) or "-delete" in args:
                return "find that deletes what it matches (-exec rm or -delete)."
            if args and "$" in args[0]:
                return "find starting from a path built from a shell variable, which can be empty when the command runs."

        if program == "git" and any(arg in {"commit", "push", "merge", "rebase", "reset"} for arg in args):
            target = cwd
            if "-C" in args and args.index("-C") + 1 < len(args):
                target = resolve(args[args.index("-C") + 1], cwd) or cwd
            if not inside(os.path.normpath(target), REPO):
                return f"git that changes history outside this repo ({target}); the home folder is its own repo."

        # The last path-like argument of a copy is where it writes.
        operands = [arg for arg in args if not arg.startswith("-")]
        destination = resolve(operands[-1], cwd) if program in COPIERS and operands else None

        previous = ""
        for word in words:
            redirect = previous in {">", ">>", "1>", "2>", "&>"} or bool(re.match(r"^\d?>>?", word))
            path = resolve(re.sub(r"^\d?>>?", "", word), cwd)
            previous = word
            if path is None:
                continue
            if read_only(path):
                if redirect:
                    return f"writes into a read-only source: {path}"
                if program in COPIERS:
                    if path == destination:
                        return f"copies into a read-only source: {path}"
                    continue
                if not reads_only(program, args):
                    return f"runs {program or 'a command'} on a read-only source: {path}"
                continue
            if not allowed(path):
                return f"reaches a path outside the repo: {path}"

    # A delete hidden in a find's -exec is checked above; this catches one after a pipe into xargs too.
    if re.search(r"\bfind\b.*-exec(dir)?\s+(\S*/)?rm\b", command):
        return "find that deletes what it matches (-exec rm)."
    return None


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        return
    if payload.get("tool_name") != "Bash":
        return
    command = (payload.get("tool_input") or {}).get("command") or ""
    cwd = payload.get("cwd") or REPO
    reason = check(command, cwd)
    if reason:
        ask(f"Needs your approval: {reason}")


if __name__ == "__main__":
    main()
