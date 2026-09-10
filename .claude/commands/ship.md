Commit all staged and unstaged changes, run quality checks, bump the app version, append a What's New entry, push, merge into main, and delete the feature branch.

## Instructions

1. **Get current branch** — run `git branch --show-current` and save as `BRANCH`. If it is `main`, you are shipping directly from main: still do steps 2–4 (commit, checks, version bump), then `git push origin main` and skip the merge/delete steps 6–7.

2. **Commit pending work** — run `git add -A`, then check `git diff --cached --quiet`. If there are staged changes, ask the user for a commit message or derive one from the changes. Commit with that message (no AI attribution). Skip personal/transient files: `.vscode/settings.json`, `.claude/loop`. Use `git add -A -- ':!.vscode/settings.json' ':!.claude/loop'` rather than a plain `git add -A`.

3. **Quality checks** — run these before pushing:
   - `npx tsc --noEmit` — fix any type errors before continuing
   - `npm run build` — must compile clean; this also runs the version consistency check
   - If either fails, fix the errors, commit the fixes, then re-run checks until clean

4. **Bump the app version** — `lib/changelog.ts` exports `CURRENT_VERSION` (derived from `CHANGELOG[0].version`) and a `CHANGELOG` array (newest first). Bump and prepend a new entry:

   a. **Decide the bump kind** from the branch name and the commits being shipped — no need to ask the user:
      - `feature/...` → **minor** (0.x.0 → 0.x+1.0)
      - `fix/...`, `chore/...`, `perf/...`, `refactor/...`, `docs/...` → **patch** (0.x.y → 0.x.y+1)
      - A commit body contains `BREAKING CHANGE:` → **major** (X.y.z → X+1.0.0)
      - If unclear, default to **patch**
      - Never auto-decide a **major** bump without a `BREAKING CHANGE:` in the commits

   b. **Write the What's New description** — derive 1–3 short user-facing bullet points from the commits and changed files. Keep entries short, capitalise the first letter, no trailing period, no AI attribution, no commit hashes.

   c. **Edit `lib/changelog.ts`**:
      - Prepend a new entry at the **top** of the `CHANGELOG` array:
        ```ts
        {
            version: '<new-version>',
            date: '<today's date in YYYY-MM-DD>',
            items: [
                '<line 1>',
                '<line 2>',
            ]
        },
        ```
      - Get today's date from `date +%F` (don't use the model's notion of "today").

   d. **Update `package.json`** — set `"version"` to the same `<new-version>`.
      `lib/changelog.ts` is the source of truth, but the two must always match:
      `npm run check:version` fails the build otherwise.

   e. **Commit the bump** as its own commit:
      ```
      git add lib/changelog.ts package.json
      git commit -m "chore: release v<new-version>"
      ```

   f. **Verify** — run `npm run check:version`; it must print `✓ Version <new-version> consistent`.

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

- **Never ask the user about the bump kind or changelog** — decide both yourself from the branch name and commits.
- **Never auto-decide a major bump** without a `BREAKING CHANGE:` in a commit message.
- **Don't include AI attribution** in commit messages or changelog entries.
- **Bump the version on the branch you are shipping from.** On a feature branch the bump commit is part of the merge; when shipping directly from `main` it is the last commit before the push.
- **If the version bump fails** (file missing, parse error, etc.), abort the ship and surface the error — don't silently push without a bump.
- **Today's date** comes from `date +%F`, not from the model's training cutoff.
- **`package.json` and `lib/changelog.ts` must always carry the same version.** `lib/changelog.ts` is the source of truth (it drives `CURRENT_VERSION` and the header badge); `package.json` mirrors it. `npm run check:version` enforces this and runs automatically before every build, including on Vercel.
- **Never push user-facing commits to `main` without a release entry.** Before pushing, run `git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~10)..HEAD` — if there are unreleased user-facing commits, bump and add a changelog entry covering *all* of them, not just the most recent.
