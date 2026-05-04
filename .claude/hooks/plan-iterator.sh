#!/usr/bin/env bash
set -euo pipefail

# Plan Iterator Hook (Stop event)
# Automatically continues through tasks in docs/plan.md
#
# Activation: .claude/loop marker must exist (created by /plan)
# Deactivation:
#   - Complete all tasks (auto-removes marker)
#   - Manually delete .claude/loop

PLAN_FILE="docs/plan.md"
LOOP_MARKER=".claude/loop"

# Only run if loop marker exists (opt-in)
[[ -f "$LOOP_MARKER" ]] || exit 0

# No plan file = stop and cleanup
if [[ ! -f "$PLAN_FILE" ]]; then
  rm -f "$LOOP_MARKER"
  exit 0
fi

# --- Helpers ---------------------------------------------------------------

portable_sed_inplace() {
  # Usage: portable_sed_inplace 's/old/new/' file
  # Works on macOS (BSD sed) and Linux (GNU sed)
  local expr="$1"
  local file="$2"
  sed -i.bak "$expr" "$file"
  rm -f "${file}.bak"
}

sanitize_git_subject() {
  # Read stdin, output a safe one-line git subject (<=72 chars), no newlines
  python3 - <<'PY'
import sys
s = sys.stdin.read()
s = s.replace("\r", " ").replace("\n", " ")
s = " ".join(s.split())  # collapse whitespace
if s.startswith("-"):
  s = s.lstrip("-").strip()
if len(s) > 72:
  s = s[:69] + "..."
print(s)
PY
}

# --- Parse plan.md once (leaf-only semantics) ------------------------------

# AWK outputs 5 lines:
# 1) remaining_leaf_count
# 2) completed_leaf_count
# 3) next_task_text
# 4) last_done_text (leaf or standalone main)
# 5) space-separated main task numbers that should be auto-marked complete
IFS=$'\t' read -r REMAINING COMPLETED NEXT_TASK LAST_DONE TO_COMPLETE < <(
  awk '
  function trim(s) { sub(/^[[:space:]]+/, "", s); sub(/[[:space:]]+$/, "", s); return s }
  function after_checkbox(s) {
    # strip leading numbering/bullet + checkbox, return the rest
    # main: "1. [ ] Task" or "1. [x] Task"
    # sub:  "   - [ ] 1.1 Task" or "   - [x] 1.1 Task"
    gsub(/^[[:space:]]*[0-9]+\.[[:space:]]*\[[ x]\][[:space:]]*/, "", s)
    gsub(/^[[:space:]]*-[[:space:]]*\[[ x]\][[:space:]]*/, "", s)
    return trim(s)
  }

  BEGIN {
    # leaf-only counts:
    remaining = 0
    completed = 0
    next_task = ""
    last_done = ""

    # track which mains exist and their checkbox state
    # main_state[n] = "incomplete" | "complete"
    # track subtasks existence + incomplete/complete counts per main
    # sub_any[n] = 1 if any subtask exists for main n
    # sub_incomplete[n], sub_complete[n]
  }

  # Main task: incomplete (strict [ ])
  /^[0-9]+\.[[:space:]]*\[ \][[:space:]]*/ {
    n = $0
    sub(/\..*$/, "", n)
    text = $0
    sub(/^[0-9]+\.[[:space:]]*\[ \][[:space:]]*/, "", text)
    main_state[n] = "incomplete"
    main_text[n] = trim(text)
    next
  }

  # Main task: complete (strict [x])
  /^[0-9]+\.[[:space:]]*\[x\][[:space:]]*/ {
    n = $0
    sub(/\..*$/, "", n)
    text = $0
    sub(/^[0-9]+\.[[:space:]]*\[x\][[:space:]]*/, "", text)
    main_state[n] = "complete"
    main_text[n] = trim(text)
    next
  }

  # Subtask: strict [ ] or [x], and requires a leading main number like 1.1, 2.3 etc
  /^[[:space:]]*-[[:space:]]*\[[ x]\][[:space:]]*[0-9]+\.[0-9]+[[:space:]]*/ {
    status = ($0 ~ /^[[:space:]]*-[[:space:]]*\[x\]/) ? "x" : " "
    tmp = $0
    sub(/^[[:space:]]*-[[:space:]]*\[[ x]\][[:space:]]*/, "", tmp)
    n = tmp
    sub(/\..*$/, "", n)
    sub_any[n] = 1

    if (status == "x") {
      sub_complete[n]++
      completed++
      last_done = after_checkbox($0)
    } else {
      sub_incomplete[n]++
      remaining++
      if (next_task == "") next_task = after_checkbox($0)
    }

    next
  }

  END {
    # Standalone mains (no subtasks) are leaf/actionable
    for (n in main_state) {
      if (!sub_any[n]) {
        if (main_state[n] == "complete") {
          completed++
          last_done = main_text[n]
        } else if (main_state[n] == "incomplete") {
          remaining++
          if (next_task == "") next_task = main_text[n]
        }
      }
    }

    # Determine which incomplete mains should auto-complete:
    # - main exists and is incomplete
    # - has subtasks
    # - 0 incomplete subtasks
    # - at least 1 complete subtask (avoid marking empty sections)
    to_complete = ""
    for (n in sub_any) {
      if (main_state[n] == "incomplete" && sub_incomplete[n] == 0 && sub_complete[n] > 0) {
        to_complete = to_complete (to_complete ? " " : "") n
      }
    }

    # Output as a single line, fields separated by tabs, then read in bash
    # (Use \t to keep NEXT_TASK / LAST_DONE intact even if they contain spaces)
    printf "%d\t%d\t%s\t%s\t%s\n", remaining, completed, next_task, last_done, to_complete
  }
  ' "$PLAN_FILE"
)

# Auto-mark main tasks complete (portable sed). Only after parse decides.
if [[ -n "${TO_COMPLETE:-}" ]]; then
  # Mark each numbered main "N. [ ]" -> "N. [x]"
  for n in $TO_COMPLETE; do
    portable_sed_inplace "s/^${n}\.[[:space:]]*\\[ \\]/${n}. [x]/" "$PLAN_FILE"
  done

  # Re-parse after modifications to get fresh counts/next/last_done
  IFS=$'\t' read -r REMAINING COMPLETED NEXT_TASK LAST_DONE _ < <(
    awk '
    function trim(s) { sub(/^[[:space:]]+/, "", s); sub(/[[:space:]]+$/, "", s); return s }
    function after_checkbox(s) {
      gsub(/^[[:space:]]*[0-9]+\.[[:space:]]*\[[ x]\][[:space:]]*/, "", s)
      gsub(/^[[:space:]]*-[[:space:]]*\[[ x]\][[:space:]]*/, "", s)
      return trim(s)
    }

    BEGIN { remaining=0; completed=0; next_task=""; last_done="" }

    /^[0-9]+\.[[:space:]]*\[ \][[:space:]]*/ {
      n = $0
      sub(/\..*$/, "", n)
      text = $0
      sub(/^[0-9]+\.[[:space:]]*\[ \][[:space:]]*/, "", text)
      main_state[n]="incomplete"
      main_text[n]=trim(text)
      next
    }
    /^[0-9]+\.[[:space:]]*\[x\][[:space:]]*/ {
      n = $0
      sub(/\..*$/, "", n)
      text = $0
      sub(/^[0-9]+\.[[:space:]]*\[x\][[:space:]]*/, "", text)
      main_state[n]="complete"
      main_text[n]=trim(text)
      next
    }

    /^[[:space:]]*-[[:space:]]*\[[ x]\][[:space:]]*[0-9]+\.[0-9]+[[:space:]]*/ {
      status = ($0 ~ /^[[:space:]]*-[[:space:]]*\[x\]/) ? "x" : " "
      tmp = $0
      sub(/^[[:space:]]*-[[:space:]]*\[[ x]\][[:space:]]*/, "", tmp)
      n = tmp
      sub(/\..*$/, "", n)
      sub_any[n]=1
      if (status=="x") { completed++; last_done=after_checkbox($0) }
      else { remaining++; if (next_task=="") next_task=after_checkbox($0) }
      next
    }

    END {
      for (n in main_state) if (!sub_any[n]) {
        if (main_state[n]=="complete") { completed++; last_done=main_text[n] }
        else { remaining++; if (next_task=="") next_task=main_text[n] }
      }
      printf "%d\t%d\t%s\t%s\n", remaining, completed, next_task, last_done
    }
    ' "$PLAN_FILE"
  )
fi

# All tasks complete - cleanup, update PLAN.md, then exit
if [[ "${REMAINING:-0}" -eq 0 ]]; then
  rm -f "$LOOP_MARKER"

  DONE_REASON=$(cat <<'DONEEOF'
PLAN ITERATOR: All tasks in docs/plan.md are complete.

1. Review PLAN.md (the top-level roadmap) and mark every item that is now implemented with [x].
   Use the Read tool to check any uncertain areas of the codebase before marking.
   Then commit the updated PLAN.md: `git add PLAN.md && git commit -m "chore: update PLAN.md progress"`

2. Give the user a brief summary — NO narratives, just:
   - **What was implemented**: bullet list of changes (files, features, DB changes)
   - **How to test**: concrete steps to verify each change works
   - **Migrations to apply**: SQL to run in Supabase (if any)
DONEEOF
)
  ESCAPED_DONE=$(printf '%s' "$DONE_REASON" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read())[1:-1])')
  echo "{\"decision\": \"block\", \"reason\": \"$ESCAPED_DONE\"}"
  exit 0
fi

# Stage all changes FIRST
git add -A >/dev/null 2>&1 || true

# Then commit if there are staged changes
if ! git diff --cached --quiet 2>/dev/null; then
  if [[ "${COMPLETED:-0}" -gt 0 ]]; then
    if [[ -n "${LAST_DONE:-}" ]]; then
      SAFE_SUBJECT="$(printf '%s' "$LAST_DONE" | sanitize_git_subject)"
      if [[ -n "$SAFE_SUBJECT" ]]; then
        git commit -m "feat: $SAFE_SUBJECT" >/dev/null 2>&1 || true
      fi
    fi
  fi
fi

# Escape reason for JSON
REASON=$(cat <<MSGEOF
PLAN ITERATOR: Continue with the next task.

## Current Progress
Completed: $COMPLETED | Remaining: $REMAINING

## Next Task
$NEXT_TASK

## Post-Task Checklist (do after completing the task above)

1. **Mark done**: Change \`1. [ ]\` or \`- [ ]\` to \`1. [x]\` or \`- [x]\` for the completed task in docs/plan.md

2. **Working preferences**:
   - Keep changes small and focused
   - Ensure code is consistent with existing patterns
   - Use proven, well-established approaches
   - Never add AI attribution

## To Stop Early
Run /stop or delete .claude/loop
MSGEOF
)
ESCAPED_REASON=$(printf '%s' "$REASON" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read())[1:-1])')

echo "{\"decision\": \"block\", \"reason\": \"$ESCAPED_REASON\"}"
