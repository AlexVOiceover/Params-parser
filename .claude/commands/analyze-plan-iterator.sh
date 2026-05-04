#!/usr/bin/env bash
set -euo pipefail

# Plan Iterator Analysis
# Mirrors the AWK parsing logic used by the plan-iterator hook

PLAN_FILE="docs/plan.md"

if [[ ! -f "$PLAN_FILE" ]]; then
  echo "Missing $PLAN_FILE"
  exit 1
fi

echo "=== PLAN ITERATOR ANALYSIS (AWK PARSER) ==="
echo "Plan file: $PLAN_FILE"
echo ""
echo "Expected formats:"
echo "  Main tasks: 1. [ ] Task"
echo "  Subtasks:   - [ ] 1.1 Task"
echo ""

IFS=$'\t' read -r REMAINING COMPLETED NEXT_TASK LAST_DONE TO_COMPLETE < <(
  awk '
  function trim(s) { sub(/^[[:space:]]+/, "", s); sub(/[[:space:]]+$/, "", s); return s }
  function after_checkbox(s) {
    gsub(/^[[:space:]]*[0-9]+\.[[:space:]]*\[[ x]\][[:space:]]*/, "", s)
    gsub(/^[[:space:]]*-[[:space:]]*\[[ x]\][[:space:]]*/, "", s)
    return trim(s)
  }

  BEGIN {
    remaining = 0
    completed = 0
    next_task = ""
    last_done = ""
  }

  match($0, /^([0-9]+)\.[[:space:]]*\[ \][[:space:]]*(.*)$/, m) {
    n = m[1]
    main_state[n] = "incomplete"
    main_text[n] = trim(m[2])
    next
  }

  match($0, /^([0-9]+)\.[[:space:]]*\[x\][[:space:]]*(.*)$/, m) {
    n = m[1]
    main_state[n] = "complete"
    main_text[n] = trim(m[2])
    next
  }

  match($0, /^[[:space:]]*-[[:space:]]*\[([ x])\][[:space:]]*([0-9]+)\.[0-9]+[[:space:]]*(.*)$/, m) {
    status = m[1]
    n = m[2]
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

    to_complete = ""
    for (n in sub_any) {
      if (main_state[n] == "incomplete" && sub_incomplete[n] == 0 && sub_complete[n] > 0) {
        to_complete = to_complete (to_complete ? " " : "") n
      }
    }

    printf "%d\t%d\t%s\t%s\t%s\n", remaining, completed, next_task, last_done, to_complete
  }
  ' "$PLAN_FILE"
)

echo "Leaf tasks remaining: ${REMAINING:-0}"
echo "Leaf tasks completed: ${COMPLETED:-0}"
echo "Next task: ${NEXT_TASK:-<none>}"
echo "Last done: ${LAST_DONE:-<none>}"
if [[ -n "${TO_COMPLETE:-}" ]]; then
  echo "Main tasks eligible for auto-complete: $TO_COMPLETE"
else
  echo "Main tasks eligible for auto-complete: <none>"
fi
