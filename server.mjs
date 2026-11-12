import {createServer} from 'node:http';
import {selfCheck} from './src/progress.mjs';

selfCheck();

const UA = 'OSRSCAPlanner/1.0 (personal educational project; WikiSync-backed CA planner)';
const BUCKET = "bucket('combat_achievement').select('id','name','monster','tier','type','task').limit(2000).run()";
const POINTS = {Easy: 1, Medium: 2, Hard: 3, Elite: 4, Master: 5, Grandmaster: 6};
const PROFILES = ['STANDARD', 'IRONMAN', 'HARDCORE_IRONMAN', 'ULTIMATE_IRONMAN', 'GROUP_IRONMAN', 'HARDCORE_GROUP_IRONMAN', 'UNRANKED_GROUP_IRONMAN'];

let cache = null, updated = 0;

function json(res, status, body, cacheControl) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...(cacheControl ? {'Cache-Control': cacheControl} : {}),
  });
  res.end(JSON.stringify(body));
}

async function getTasks() {
  if (cache && Date.now() - updated < 86400000) return cache;
  const url = new URL('https://oldschool.runescape.wiki/api.php');
  url.searchParams.set('action', 'bucket');
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', BUCKET);
  const [bucketRes, compRes] = await Promise.all([
    fetch(url, {headers: {'User-Agent': UA}}),
    fetch('https://oldschool.runescape.wiki/w/Module:Combat_Achievements/completion.json?action=raw', {headers: {'User-Agent': UA}}),
  ]);
  if (!bucketRes.ok) throw Error('Wiki bucket returned ' + bucketRes.status);
  const data = await bucketRes.json();
  const rows = data.bucket;
  if (!Array.isArray(rows) || rows.length < 500) throw Error('Wiki format changed: parsed ' + (rows?.length ?? 0) + ' tasks');
  let completion = {};
  if (compRes.ok) {
    try { completion = await compRes.json(); } catch { /* optional */ }
  }
  const tasks = rows.map(r => ({
    id: String(r.id),
    name: r.name,
    boss: r.monster,
    description: r.task,
    type: r.type,
    tier: r.tier,
    points: POINTS[r.tier],
    completion: completion[String(r.id)] ?? completion[r.id],
  }));
  cache = {tasks, updatedAt: new Date().toISOString()};
  updated = Date.now();
  return cache;
}

async function getWikiSync(username, profile) {
  const name = username.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 12) throw Object.assign(Error('Invalid RSN'), {status: 400});
  if (!PROFILES.includes(profile)) throw Object.assign(Error('Invalid profile'), {status: 400});
  const url = `https://sync.runescape.wiki/runelite/player/${encodeURIComponent(name)}/${profile}`;
  const res = await fetch(url, {headers: {'User-Agent': UA, Accept: 'application/json'}});
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = Error(body.error || body.code || `WikiSync returned ${res.status}`);
    err.status = res.status === 404 ? 404 : 502;
    err.code = body.code;
    throw err;
  }
  const raw = body.combat_achievements;
  if (!Array.isArray(raw)) {
    const err = Error('No combat_achievements on this WikiSync snapshot. Open CAs in-game with the WikiSync plugin, then try again.');
    err.status = 404;
    throw err;
  }
  const catalogue = await getTasks();
  const known = new Set(catalogue.tasks.map(t => t.id));
  const completedIds = [...new Set(raw.map(String))].filter(id => known.has(id));
  return {
    username: body.username || name,
    profile,
    syncedAt: body.timestamp || new Date().toISOString(),
    completedIds,
    matched: completedIds.length,
    reported: raw.length,
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    if (url.pathname === '/api/tasks') {
      // no-store: a cached pre-Bucket catalogue (slug ids) breaks WikiSync matching
      return json(res, 200, await getTasks(), 'no-store');
    }
    if (url.pathname === '/api/player') {
      const username = url.searchParams.get('username') || '';
      const profile = (url.searchParams.get('profile') || 'STANDARD').toUpperCase();
      return json(res, 200, await getWikiSync(username, profile));
    }
    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    json(res, e.status || 502, {error: String(e.message || e), code: e.code});
  }
});

server.listen(3001, () => console.log('CA catalogue + WikiSync API on :3001'));
