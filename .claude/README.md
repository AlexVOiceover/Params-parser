# Claude Code Workflow

Custom automation for working with feature plans.

## Quick Reference

| Command | Description |
|---------|-------------|
| `/plan 04` | Start a feature (read → branch → plan → activate loop) |
| `/next-feature` | Create the next feature file from PLAN.md |
| `/stop` | Stop the iterator loop early |

---

## User Guide

### Starting a new feature

**Step 1 — Create the feature file** (if it doesn't exist yet):

```
/next-feature
```

This reads `PLAN.md`, finds the next stage number, and creates `features/NN-name.md` with the right scope. Review the file and adjust if needed.

Or create it manually: add `features/05-my-feature.md` with a short description of what to build.

**Step 2 — Generate the plan and start the loop:**

```
/plan 05
```

This reads the feature file, checks what's already built, creates a git branch, writes `docs/plan.md` with a task checklist, and activates the auto-loop.

**Claude stops and waits.** Review `docs/plan.md` if you want to adjust tasks.

**Step 3 — Start implementation:**

Just say `start`. The loop takes over from there — Claude works through each task, commits after each one, and auto-continues until all tasks are done.

**Step 4 — When the loop ends:**

All tasks are `[x]`. Create a PR and merge. Then run `/next-feature` and `/plan NN` for the next stage.

---

### Stopping and resuming

```
/stop              # pause the loop (plan stays in docs/plan.md)
touch .claude/loop # resume (picks up from the first unchecked task)
```

---

### What the loop does automatically

After each Claude response the hook (`.claude/hooks/plan-iterator.sh`):

1. Parses `docs/plan.md` and finds the next unchecked task
2. Stages and commits any changes with a meaningful message
3. Injects the next task into Claude's context as a prompt
4. Stops automatically when all tasks are `[x]` (deletes `.claude/loop`)

---

## Files

| File | Purpose |
|------|---------|
| `features/NN-name.md` | Feature scope description, one per feature |
| `docs/plan.md` | Active task checklist — one at a time |
| `.claude/loop` | Marker that activates the iterator |
| `.claude/settings.json` | Registers the Stop hook for this project |
| `.claude/hooks/plan-iterator.sh` | The auto-loop hook |
| `.claude/commands/plan.md` | `/plan` command |
| `.claude/commands/next-feature.md` | `/next-feature` command |
| `.claude/commands/stop.md` | `/stop` command |
