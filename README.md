# Ghommal's Planner

Old School RuneScape Combat Achievements tracker. Sync completed tasks from RuneLite WikiSync by RSN, shortlist aspirational goals, and see current and projected points and reward tiers.

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

`vercel.json` points the build at `dist`. Catalogue responses are CDN-cached for 24h (`s-maxage`) so cold starts don’t hit the wiki on every page load. WikiSync lookups stay `no-store`.

Local `npm run server` still works for development (Vite proxies `/api` → `:3001`).

## Features
- Live catalogue from the OSRS Wiki Bucket API (`combat_achievement`), cached 24h, with stable numeric CA ids
- WikiSync RSN lookup for completed Combat Achievements
- Manual checkbox overrides on top of the last sync; aspirational stars stay in localStorage
- Multi-select filters for tier, boss (with search), type, and completion status
- Current and projected points, reward tier, and milestone progress
- JSON export/import for backups

## WikiSync setup
1. Install the **WikiSync** plugin from the RuneLite Plugin Hub
2. Log in with the plugin enabled (CA completion uploads automatically)
3. Enter your RSN and click **Sync WikiSync**

If lookup fails with “No user data”, the account has not synced yet.

## Data notes
- Wise Old Man does **not** expose individual Combat Achievements — this app does not use WOM for CA completion
- Task ids are Wiki/Bucket numeric ids, the same ids WikiSync returns in `combat_achievements`
- The OSRS Wiki asks third parties not to lean on WikiSync long-term; this tool proxies it server-side (no browser `Origin`). If the wiki blocks non-wiki clients, switch to paste-import or another sync source

## License

MIT — see [LICENSE](LICENSE).

Old School RuneScape is a trademark of Jagex Ltd. This is an unofficial fan project and is not affiliated with Jagex.
