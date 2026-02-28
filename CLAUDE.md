# CLAUDE.md — Project Instructions

## Commits & Pull Requests

- Use **conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `style:`, `test:`
- **Never** include "Co-authored by Claude", "Co-authored by Anthropic", or any AI attribution in commit messages or PR descriptions
- Keep commit messages concise and focused on the *why*, not the *what*

## Project

Next.js 15 web app (App Router) that filters ArduCopter `.param` files before applying them to drones.
See `memory/MEMORY.md` for full architecture notes.

## Stack

- **Next.js 15** — App Router, `"use client"` where needed, API routes under `app/api/`
- **Tailwind CSS v4** — `@theme inline` in `globals.css`, no arbitrary values when a utility exists
- **React 19** — prefer `useCallback`/`useMemo` for stable references; avoid unnecessary re-renders
- **TypeScript** — strict mode; no `any`; prefer explicit return types on exported functions
- **lucide-react** for icons

## Code Style

- No over-engineering: only add what is directly asked for or clearly necessary
- No docstrings, comments, or type annotations on code that was not changed
- No backwards-compatibility shims or unused exports
- Prefer editing existing files over creating new ones
- Keep components focused; extract sub-components only when they are reused or significantly complex

## UI / Tailwind Conventions

- Always add `cursor-pointer` to any interactive element (buttons, clickable spans, selects)
- Inputs with an overlaid clear button: use `pr-7` on the input and `absolute right-1.5 top-1/2 -translate-y-1/2` on the button
- Use `onMouseDown` + `e.preventDefault()` for clear buttons inside inputs to prevent `onBlur` race conditions
- Search fields with a mode selector: input grows `flex-1`, select is `shrink-0` to the right
- Highlight matched text with `bg-amber-400/25 text-amber-200 rounded-xs px-px not-italic` inside a `<mark>` element
- Description snippets below param names: `font-sans text-[10px] text-muted-foreground leading-snug`

## Data & API

- ArduPilot param definitions: `https://autotest.ardupilot.org/Parameters/ArduCopter/apm.pdef.json`
  - Flat structure: top-level keys are group names, values are objects keyed by **full param name**
  - Groups have **no descriptions** — only individual params do
- Default protection lists live in `data/protection-lists.json` (not hardcoded in TypeScript)
- User lists persist via Vercel KV (Upstash), keyed by lowercase username
- `listsReadyRef` prevents saving defaults back before the initial fetch completes

## Search / Filter Pattern

When implementing search in a param list:
1. Offer Name / Description / Both modes via a `<select>` to the right of the input
2. Auto-expand all groups while a query is active
3. Highlight every occurrence of the query in results using the `highlightText` helper
4. For description matches, show a short `getSnippet()` excerpt below the param name

## Environment

- Dev: `npm run dev --turbopack`
- Env vars needed locally: `KV_REST_API_URL`, `KV_REST_API_TOKEN` (pull via `vercel env pull`)
- `.next/` and `.env*.local` are gitignored
