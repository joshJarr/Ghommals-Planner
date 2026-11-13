import {createServer} from 'node:http';
import {selfCheck} from './lib/progress.mjs';
import {getTasks, getRuneProfile, parseRuneProfileTasks} from './lib/osrs.mjs';
import {getItems, getRuneProfileClog, parseRuneProfileClog, gildedThreshold} from './lib/clog.mjs';

selfCheck();
{
  const ids = parseRuneProfileTasks({
    data: [
      {index: 0, completed: true},
      {index: 1, completed: false},
      {index: 27, completed: true},
      {index: 27, completed: true},
    ],
  });
  if (ids.join(',') !== '0,27') throw Error('parseRuneProfileTasks self-check failed: ' + ids);
  const clogIds = parseRuneProfileClog({
    tabs: [{
      name: 'Bosses',
      pages: [{
        name: 'Abyssal Sire',
        items: [
          {id: 4151, name: 'Abyssal whip', quantity: 3},
          {id: 13262, name: 'Abyssal orphan', quantity: 0},
        ],
      }],
    }],
  });
  if (clogIds.join(',') !== '4151') throw Error('parseRuneProfileClog self-check failed: ' + clogIds);
  if (gildedThreshold(1734) !== 1550) throw Error('gildedThreshold self-check failed');
}

function json(res, status, body, cacheControl) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...(cacheControl ? {'Cache-Control': cacheControl} : {}),
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    if (url.pathname === '/api/ghommals/tasks') {
      return json(res, 200, await getTasks(), 'public, max-age=0, s-maxage=86400');
    }
    if (url.pathname === '/api/ghommals/player') {
      return json(res, 200, await getRuneProfile(url.searchParams.get('username') || ''), 'no-store');
    }
    if (url.pathname === '/api/collectors/tasks') {
      return json(res, 200, await getItems(), 'public, max-age=0, s-maxage=86400');
    }
    if (url.pathname === '/api/collectors/player') {
      return json(res, 200, await getRuneProfileClog(url.searchParams.get('username') || ''), 'no-store');
    }
    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    json(res, e.status || 502, {error: String(e.message || e), code: e.code});
  }
});

const port = Number(process.env.PORT) || 3001;
server.listen(port, () => console.log('OSRS Planners API on :' + port));
