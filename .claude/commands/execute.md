Create a plan from a features file and start the implementation loop.

## Arguments

- `$ARGUMENTS` - Feature number padded to 2 digits (e.g., `04`)

## Instructions

1. **Find the feature file**:
   - Look for `features/$ARGUMENTS-*.md` (e.g., `features/04-builds.md`)
   - If not found, stop and tell the user: "No feature file found. Create `features/$ARGUMENTS-<name>.md` first."
   - Read the file for scope and context

2. **Check implementation status**:
   - Analyze the codebase to determine if this feature is already implemented
   - Search for relevant files, routes, components, DB tables
   - If fully implemented: tell the user and stop
   - If partially implemented: note what exists and focus the plan on remaining work
   - If not implemented: proceed with full planning

3. **Create the feature branch**:
   - Derive slug from the filename without `.md`: `features/04-builds.md` → `04-builds`
   - Run: `git checkout main && git pull && git checkout -b feature/{slug}`
   - If the branch already exists, check it out: `git checkout feature/{slug}`

4. **Write the plan**:
   - Create/overwrite `docs/plan.md`
   - Use the feature file as scope — break it into numbered, actionable checkbox tasks
   - Structure as main tasks with subtasks

5. **Activate the loop**:
   - Run: `touch .claude/loop`
   - This tells the plan-iterator hook to auto-continue through tasks

**Claude stops here.** Review the plan before saying `start`.

## Plan Format

```markdown
# {NUMBER} {Feature Name}

> {Brief scope — one or two sentences from the feature file}

## Tasks

1. [ ] **Section Name**
   - [ ] 1.1 First step
   - [ ] 1.2 Second step

2. [ ] **Section Name**
   - [ ] 2.1 Next step
   - [ ] 2.2 Another step

## Notes

{Any relevant context, constraints, or decisions from the feature file}
```

## Rules

- **Checkbox format**: `1. [ ]` for main tasks, `- [ ] 1.1` for subtasks (hook reads these exactly)
- **Numbered structure**: numbered mains (1, 2, 3) with numbered subtasks (1.1, 1.2, etc.)
- **Small tasks**: each task = one focused, completable change
- **Logical order**: dependency-ordered
- **No time estimates**
