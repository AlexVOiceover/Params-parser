Mobile

Comments on .param files. test. Is there a param to store serial number

Connected drone, read serial number on user1, show if has an update


---

## Magic-link migration — manual checklist

Run in this order. Do steps 1 and 2 NOW. Step 3 is only before merging to main.

### Step 1 — Supabase dashboard (project `bsbomnirdjjcyapjvovm`)

Authentication → URL Configuration:
- Site URL: `https://air6params.vercel.app`
- Redirect URLs — add all three:
  - `http://localhost:3000/auth/callback`
  - `https://air6params.vercel.app/auth/callback`
  - `https://*-alexrodriguez-7999s-projects.vercel.app/auth/callback`

Authentication → Providers → Email:
- Enable email signups: **off**

### Step 2 — Local sign-in test (no email needed)

1. `npm run dev`
2. Open `localhost:3000/login`, enter admin email, click "Send magic link".
3. Dev mode signs you in directly. Should land on `/`. Open `/admin` to confirm.

If it fails, tell Claude the URL and the error.

### Step 3 — Production sign-in test (Vercel preview, before merging)

1. `git push` the branch. Vercel auto-deploys a preview at `https://params-parser-<sha>-….vercel.app`.
2. Open the preview, sign out, request a link with admin email.
3. Click link in email. Should land on `/` in the preview.
