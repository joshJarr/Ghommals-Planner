# OSRS Planners

Monorepo with three pages:

| Path | App |
| --- | --- |
| `/` | Landing — links to both planners |
| `/ghommals` | **Ghommal's Planner** — Combat Achievements |
| `/collectors` | **Collector's Planner** — Collection Log |

Both planners sync via [RuneProfile](https://runeprofile.com), keep aspirational shortlists in `localStorage`, and share the same OSRS-styled UI.

## Layout

```
src/home/           Landing page
src/ghommals/       Combat Achievements planner
src/collectors/     Collection Log planner
lib/                Wiki + RuneProfile data helpers
api/ghommals/       CA catalogue + player sync
api/collectors/     Clog catalogue + player sync
```

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

Open http://127.0.0.1:5173/ (API on `:3001`, proxied as `/api/...`).

## Deploy (Vercel Hobby)

Framework preset **Vite**. No env vars. Nested serverless routes under `api/ghommals/*` and `api/collectors/*`.

## License

MIT — see [LICENSE](LICENSE).

Old School RuneScape is a trademark of Jagex Ltd. Unofficial fan project — not affiliated with Jagex or RuneProfile.
