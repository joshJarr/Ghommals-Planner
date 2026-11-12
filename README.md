# Ghommal's Planner

Old School RuneScape Combat Achievements tracker. Sync completed tasks from [RuneProfile](https://runeprofile.com) by RSN, shortlist aspirational goals, and see current and projected points and reward tiers.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run server
```

In another terminal:

```bash
npm run dev
```

Open the Vite URL (usually http://localhost:5173).

## Deploy (Vercel Hobby)

The app is set up for Vercel’s free Hobby plan: the Vite frontend is static, and `/api/tasks` + `/api/player` are serverless functions.

1. Push this branch (or `main`) to GitHub
2. Import the repo in [Vercel](https://vercel.com/new) — framework preset **Vite**
3. Deploy (no env vars required)

`vercel.json` points the build at `dist`. Catalogue responses are CDN-cached for 24h (`s-maxage`) so cold starts don’t hit the wiki on every page load. RuneProfile lookups stay `no-store`.

Local `npm run server` still works for development (Vite proxies `/api` → `:3001`).

## Features
- Live catalogue from the OSRS Wiki Bucket API (`combat_achievement`), cached 24h, with stable numeric CA ids
- RuneProfile RSN lookup for completed Combat Achievements
- Manual checkbox overrides on top of the last sync; aspirational stars stay in localStorage
- Multi-select filters for tier, boss (with search), type, and completion status
- Current and projected points, reward tier, and milestone progress
- JSON export/import for backups

## RuneProfile setup
1. Install the **RuneProfile** plugin from the [RuneLite Plugin Hub](https://runelite.net/plugin-hub/show/runeprofile)
2. Log in with the plugin enabled so your profile uploads (including per-task CAs)
3. Enter your RSN and click **Sync RuneProfile**

If lookup fails with “no profile”, the account has not synced yet. If it reports tier totals but no per-task detail, log in again with the plugin to refresh a pre–May 2026 snapshot.

## Data notes
- Wise Old Man does **not** expose individual Combat Achievements — this app does not use WOM for CA completion
- Task ids are Wiki/Bucket numeric ids; RuneProfile’s `index` matches those ids
- WikiSync is not used (the wiki asks third parties not to call that API)
- RuneProfile publishes a [public read-only API](https://api.runeprofile.com/v1/docs) (anonymous 30 req/min; optional API key for higher limits). Use a descriptive User-Agent; don’t poll faster than their 1-minute cache

## License

MIT — see [LICENSE](LICENSE).

Old School RuneScape is a trademark of Jagex Ltd. This is an unofficial fan project and is not affiliated with Jagex or RuneProfile.
