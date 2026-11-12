const UA = 'GhommalsPlanner/1.0 (https://github.com/joshJarr/Ghommals-Planner; OSRS CA planner)';
const BUCKET = "bucket('combat_achievement').select('id','name','monster','tier','type','task').limit(2000).run()";
const POINTS = {Easy: 1, Medium: 2, Hard: 3, Elite: 4, Master: 5, Grandmaster: 6};
const RUNEPROFILE = 'https://api.runeprofile.com/v1/accounts/';

let cache = null, updated = 0;

export async function getTasks() {
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

/** RuneProfile timestamps look like "2026-08-02 18:26:28.409099" (space, no zone). */
function parseRuneProfileDate(value) {
  if (typeof value !== 'string' || !value) return new Date().toISOString();
  const iso = /^\d{4}-\d{2}-\d{2} /.test(value)
    ? `${value.replace(' ', 'T').replace(/(\.\d{3})\d+$/, '$1')}Z`
    : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function tierCompletedSum(rows) {
  if (!Array.isArray(rows)) return 0;
  let n = 0;
  for (const row of rows) {
    if (row && typeof row.completed === 'number' && Number.isFinite(row.completed)) n += row.completed;
  }
  return n;
}

/** Completed wiki Bucket ids from RuneProfile `/combat-achievements/tasks`. */
export function parseRuneProfileTasks(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.data)) {
    throw Object.assign(Error('RuneProfile returned no task list'), {status: 502});
  }
  const ids = [];
  for (const row of body.data) {
    if (!row || row.completed !== true) continue;
    if (typeof row.index !== 'number' || !Number.isFinite(row.index)) continue;
    ids.push(String(row.index));
  }
  return [...new Set(ids)];
}

export async function getRuneProfile(username) {
  const name = username.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 12) throw Object.assign(Error('Invalid RSN'), {status: 400});
  const base = RUNEPROFILE + encodeURIComponent(name);
  // No custom headers beyond UA — RuneProfile CORS is origin-allowlisted for non-simple requests.
  const headers = {'User-Agent': UA, Accept: 'application/json'};
  const [fullRes, tasksRes] = await Promise.all([
    fetch(base + '/full', {headers}),
    fetch(base + '/combat-achievements/tasks', {headers}),
  ]);
  if (fullRes.status === 404 || tasksRes.status === 404) {
    throw Object.assign(
      Error('No user data found. Install RuneProfile, sync in-game, then try again.'),
      {status: 404, code: 'NOT_FOUND'},
    );
  }
  if (fullRes.status === 429 || tasksRes.status === 429) {
    throw Object.assign(
      Error('Unable to fetch profile right now, please try again later.'),
      {status: 429, code: 'RATE_LIMITED'},
    );
  }
  if (!fullRes.ok) throw Object.assign(Error(`RuneProfile full returned ${fullRes.status}`), {status: 502});
  if (!tasksRes.ok) throw Object.assign(Error(`RuneProfile tasks returned ${tasksRes.status}`), {status: 502});

  const full = await fullRes.json().catch(() => ({}));
  const tasksBody = await tasksRes.json().catch(() => ({}));
  const rawIds = parseRuneProfileTasks(tasksBody);
  const tierDone = tierCompletedSum(full.combatAchievements);
  // Per-task storage shipped 2026-05-14; stale profiles report 0 completed tasks but non-zero tier totals.
  if (!rawIds.length && tierDone > 0) {
    throw Object.assign(
      Error(
        `RuneProfile has ${tierDone} CAs for ${name} but no per-task detail — log in with the RuneProfile plugin to refresh, then try again.`,
      ),
      {status: 409, code: 'STALE_PROFILE'},
    );
  }

  const catalogue = await getTasks();
  const known = new Set(catalogue.tasks.map(t => t.id));
  const completedIds = rawIds.filter(id => known.has(id));
  return {
    username: typeof full.username === 'string' && full.username ? full.username : name,
    profile: 'STANDARD',
    syncedAt: parseRuneProfileDate(full.updatedAt),
    completedIds,
    matched: completedIds.length,
    reported: rawIds.length,
  };
}
