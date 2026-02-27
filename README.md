# AIR6 Param Filter

A web app for filtering Mission Planner `.param` files before applying them to a drone fleet. Export your config from one drone, strip the parameters that must stay unique per drone (calibration, hardware IDs, RC setup), and apply only the safe changes to your target drones.

**Live:** [v0-params-parser-git-main-fac-projects.vercel.app](https://v0-params-parser-git-main-fac-projects.vercel.app)

---

## Workflow

1. **Export from Mission Planner** — Config → Full Parameter List → Save to File
2. **Open the file** — click **Open .param File**
3. **Choose a protection list** — parameters split into Protected (removed) and Will Be Applied
4. **Adjust manually** if needed — use the Protect / Apply buttons to move individual params
5. **Save** — click **Save Filtered File**, then load it on the target drone via Mission Planner

---

## Protection Lists

Three lists are included. Rules can be `prefix` (matches any param starting with a string) or `exact` (matches one param by full name).

| List | Protects |
|---|---|
| Calibration | Compass offsets, IMU/accel/gyro calibration, baro ground pressure, AHRS trim |
| Hardware & Device IDs | Compass/IMU/baro device IDs, board type, serial number, system ID |
| RC Configuration | RC channels 1–16, RC channel mapping |

Use the **Protection list** dropdown → **Edit Lists…** to create or modify lists. Your lists are saved to your username and synced across devices.

---

## Development

```bash
npm install
npx vercel link          # link to Vercel project
npx vercel env pull .env.development.local   # pull KV credentials
npm run dev
```

### Deploy

Push to `main` — Vercel auto-deploys.

### Environment variables (set automatically via Vercel + Upstash Redis integration)

```
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```
