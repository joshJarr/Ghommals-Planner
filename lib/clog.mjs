import pageCategories from './page-categories.mjs';

const UA = 'CollectorsPlanner/1.0 (https://github.com/joshJarr/Ghommals-Planner; OSRS Collection Log planner)';
const RUNEPROFILE = 'https://api.runeprofile.com/v1/accounts/';
const WIKI_DATA = 'https://oldschool.runescape.wiki/w/Module:Collection_log/data.json?action=raw';
const WIKI_COMP = 'https://oldschool.runescape.wiki/w/Module:Collection_log/completion.json?action=raw';

const CATEGORIES = ['Bosses', 'Raids', 'Clues', 'Minigames', 'Other'];
const FIXED_RANKS = [
  {name: 'Bronze', slots: 100},
  {name: 'Iron', slots: 300},
  {name: 'Steel', slots: 500},
  {name: 'Black', slots: 700},
  {name: 'Mithril', slots: 900},
  {name: 'Adamant', slots: 1000},
  {name: 'Rune', slots: 1100},
  {name: 'Dragon', slots: 1200},
];

let cache = null, updated = 0;

function categoryForPage(page) {
  if (pageCategories[page]) return pageCategories[page];
  const hit = Object.keys(pageCategories).find(k => k.toLowerCase() === String(page).toLowerCase());
  return hit ? pageCategories[hit] : 'Other';
}

/** Gilded = 90% of total slots, rounded down to nearest 25 (wiki formula). */
export function gildedThreshold(totalSlots) {
  return Math.floor((totalSlots * 0.9) / 25) * 25;
}

export function rankTable(totalSlots) {
  return [...FIXED_RANKS, {name: 'Gilded', slots: gildedThreshold(totalSlots)}];
}

export async function getItems() {
  if (cache && Date.now() - updated < 86400000) return cache;
  const [dataRes, compRes] = await Promise.all([
    fetch(WIKI_DATA, {headers: {'User-Agent': UA}}),
    fetch(WIKI_COMP, {headers: {'User-Agent': UA}}),
  ]);
  if (!dataRes.ok) throw Error('Wiki collection log data returned ' + dataRes.status);
  const rows = await dataRes.json();
  if (!Array.isArray(rows) || rows.length < 1000) throw Error('Wiki format changed: parsed ' + (rows?.length ?? 0) + ' items');
  let completion = {};
  if (compRes.ok) {
    try { completion = await compRes.json(); } catch { /* optional */ }
  }
  const items = rows.map(r => {
    const pageNames = Array.isArray(r.tabs) ? [...new Set(r.tabs.map(String))] : [];
    const pages = pageNames.map(name => ({name, category: categoryForPage(name)}));
    const categories = [...new Set(pages.map(p => p.category))];
    return {
      id: String(r.id),
      name: r.name,
      pages,
      categories: categories.length ? categories : ['Other'],
      completion: completion[String(r.id)] ?? completion[r.id],
    };
  });
  const ranks = rankTable(items.length);
  const pageCategories = {};
  for (const it of items) for (const p of it.pages) pageCategories[p.name] = p.category;
  cache = {items, ranks, categories: CATEGORIES, pageCategories, updatedAt: new Date().toISOString()};
  updated = Date.now();
  return cache;
}

function parseRuneProfileDate(value) {
  if (typeof value !== 'string' || !value) return new Date().toISOString();
  const iso = /^\d{4}-\d{2}-\d{2} /.test(value)
    ? `${value.replace(' ', 'T').replace(/(\.\d{3})\d+$/, '$1')}Z`
    : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Obtained item ids from RuneProfile `/collection-log` (quantity > 0). */
export function parseRuneProfileClog(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.tabs)) {
    throw Object.assign(Error('RuneProfile returned no collection log'), {status: 502});
  }
  const ids = new Set();
  for (const tab of body.tabs) {
    if (!tab || !Array.isArray(tab.pages)) continue;
    for (const page of tab.pages) {
      if (!page || !Array.isArray(page.items)) continue;
      for (const item of page.items) {
        if (!item || item.quantity == null || Number(item.quantity) <= 0) continue;
        if (item.id == null) continue;
        ids.add(String(item.id));
      }
    }
  }
  return [...ids];
}

export async function getRuneProfileClog(username) {
  const name = username.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 12) throw Object.assign(Error('Invalid RSN'), {status: 400});
  const headers = {'User-Agent': UA, Accept: 'application/json'};
  const [clogRes, fullRes] = await Promise.all([
    fetch(RUNEPROFILE + encodeURIComponent(name) + '/collection-log', {headers}),
    fetch(RUNEPROFILE + encodeURIComponent(name) + '/full', {headers}),
  ]);
  if (clogRes.status === 404 || fullRes.status === 404) {
    throw Object.assign(
      Error('No user data found. Install RuneProfile, sync in-game (open the Collection Log once), then try again.'),
      {status: 404, code: 'NOT_FOUND'},
    );
  }
  if (clogRes.status === 429 || fullRes.status === 429) {
    throw Object.assign(
      Error('Unable to fetch profile right now, please try again later.'),
      {status: 429, code: 'RATE_LIMITED'},
    );
  }
  if (!clogRes.ok) throw Object.assign(Error(`RuneProfile collection-log returned ${clogRes.status}`), {status: 502});
  if (!fullRes.ok) throw Object.assign(Error(`RuneProfile full returned ${fullRes.status}`), {status: 502});

  const clog = await clogRes.json().catch(() => ({}));
  const full = await fullRes.json().catch(() => ({}));
  const rawIds = parseRuneProfileClog(clog);
  const catalogue = await getItems();
  const known = new Set(catalogue.items.map(t => t.id));
  const completedIds = rawIds.filter(id => known.has(id));
  return {
    username: typeof full.username === 'string' && full.username ? full.username : name,
    syncedAt: parseRuneProfileDate(full.updatedAt),
    completedIds,
    matched: completedIds.length,
    reported: rawIds.length,
    obtained: typeof clog.obtained === 'number' ? clog.obtained : completedIds.length,
    total: typeof clog.total === 'number' ? clog.total : catalogue.items.length,
  };
}
