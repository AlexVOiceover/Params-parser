Create the next feature file in `features/` based on the project PLAN.md.

## Arguments

- `$ARGUMENTS` - Optional slug override for the feature name (e.g., `phase-execution`). If omitted, derive from PLAN.md.

## Instructions

1. **Find the next number**:
   - List all files in `features/` matching `NN-*.md`
   - Take the highest existing number and increment by 1
   - Zero-pad to 2 digits (e.g., `05`)
   - If `features/` is empty, start at `01`

2. **Determine the feature name**:
   - If `$ARGUMENTS` is provided, use it as the slug
   - Otherwise, read `PLAN.md` and find the stage matching the next number
   - Extract the stage title and derive a short kebab-case slug from it

3. **Read PLAN.md for scope**:
   - Find the section for this stage number
   - Extract the goals, bullet points, and any relevant constraints
   - Use this as the basis for the feature file content

4. **Write the feature file**:
   - Create `features/{NN}-{slug}.md`
   - Write a clear, focused scope document (see format below)
   - Include what's in scope and what's explicitly out of scope for this stage

5. **Confirm**:
   - Tell the user the file was created and show the path
   - Suggest: "Review and adjust scope, then run `/execute {NN}` to start."

## Feature File Format

```markdown
# {NN} — {Stage Title}

{One paragraph describing the goal of this stage and what it delivers.}

## Scope

- **{Area}**: {what gets built}
- **{Area}**: {what gets built}
- **DB**: {new tables or schema changes, if any}

## Out of Scope for This Stage

- {Thing deferred to a later stage}
- {Another thing}
```

## Rules

- Keep scope tight — one stage should be completable in one focused session
- Always include an "Out of Scope" section to prevent scope creep
- Derive content from PLAN.md but feel free to add implementation detail that is obvious from the codebase
