Commit all staged and unstaged changes, run quality checks, bump the app version, append a What's New entry, push, merge into main, and delete the feature branch.

## Instructions

1. **Get current branch** — run `git branch --show-current` and save as `BRANCH`. If it is `main`, stop and tell the user there is nothing to ship.

2. **Commit pending work** — run `git add -A`, then check `git diff --cached --quiet`. If there are staged changes, ask the user for a commit message or derive one from the changes. Commit with that message (no AI attribution). Skip personal/transient files: `.vscode/settings.json`, `.claude/loop`. Use `git add -A -- ':!.vscode/settings.json' ':!.claude/loop'` rather than a plain `git add -A`.

3. **Quality checks** — run these before pushing:
   - `npx svelte-check --threshold error` — fix any type errors before continuing
   - `npx eslint .` — fix any lint errors before continuing
   - If either fails, fix the errors, commit the fixes, then re-run checks until clean

4. **Bump the app version** — `src/lib/version.ts` exports `VERSION` and a `CHANGELOG` array (newest first). Bump and prepend a new entry:

   a. **Decide the bump kind** from the branch name and the commits being shipped:
      - `feature/...` → **minor** (0.x.0 → 0.x+1.0). New user-facing feature.
      - `fix/...`, `chore/...`, `perf/...`, `refactor/...`, `docs/...` → **patch** (0.x.y → 0.x.y+1).
      - User typed `major` in the slash args, OR a commit body contains `BREAKING CHANGE:` → **major** (X.y.z → X+1.0.0).
      - If unclear (e.g. branch named `tweaks/something`), default to **patch**.

      State the inferred bump and the next version, then ask: *"Bump 0.2.0 → 0.3.0 (minor)? [y/N/major/patch/minor]"*. Accept the typed override.

   b. **Ask the user for a brief What's New description** — 1–3 short user-facing bullet points. Frame the prompt: *"Briefly describe what's new for end users (1–3 bullets, blank line to skip)."* If the user types nothing, skip step c entirely (don't add an empty entry — just bump the version number alone).

      Convert each line typed by the user into one item in the `changes: string[]` array. Strip leading bullet characters (`- `, `* `, `• `) so the file's existing format is preserved. Keep entries short — no PR-style prose, no commit hashes, no AI attribution. Capitalise the first letter; no trailing period.

   c. **Edit `src/lib/version.ts`**:
      - Update `export const VERSION = '...'` to the new value.
      - Prepend a new entry at the **top** of the `CHANGELOG` array:
        ```ts
        {
            version: '<new-version>',
            date: '<today's date in YYYY-MM-DD>',
            changes: [
                '<line 1>',
                '<line 2>',
                ...
            ]
        },
        ```
      - Get today's date from `date +%F` (don't use the model's notion of "today" — it's wrong half the time).

   d. **Commit the bump** as its own commit so it stands out in `git log`:
      ```
      git add src/lib/version.ts
      git commit -m "chore: release v<new-version>"
      ```

5. **Push** — run `git push -u origin $BRANCH`.

6. **Merge into main**:
   ```
   git checkout main
   git pull --ff-only origin main
   git merge $BRANCH --no-ff -m "merge: $BRANCH into main"
   git push origin main
   ```

7. **Delete feature branch**:
   ```
   git branch -d $BRANCH
   git push origin --delete $BRANCH
   ```

8. **Confirm** — tell the user:
   - The branch was shipped and deleted.
   - The new version on main (e.g. *"v0.3.0 is now on main, commit `<sha>`"*).
   - Where the changelog will surface (the "What's new" item in the username menu).

## Rules

- **Never auto-decide a major bump.** Major version bumps are intentional; require explicit `major` from the user or a `BREAKING CHANGE:` in a commit message.
- **Empty `changes: []` is allowed** when the user skips the description, but prefer to nudge them once for a one-liner — version bumps without notes hide what shipped.
- **Don't include AI attribution** in commit messages or changelog entries.
- **Bump the version on the feature branch**, not on main. The bump commit is part of the merge.
- **If the version bump fails** (file missing, parse error, etc.), abort the ship and surface the error — don't silently push without a bump.
- **Today's date** comes from `date +%F` (UTC-leaning), not from the model's training cutoff.
