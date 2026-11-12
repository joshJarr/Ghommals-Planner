import {createServer} from 'node:http';
import {selfCheck} from './src/progress.mjs';
import {getTasks, getRuneProfile, parseRuneProfileTasks} from './lib/osrs.mjs';

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
    if (url.pathname === '/api/tasks') {
      return json(res, 200, await getTasks(), 'public, max-age=0, s-maxage=86400');
    }
    if (url.pathname === '/api/player') {
      const username = url.searchParams.get('username') || '';
      return json(res, 200, await getRuneProfile(username), 'no-store');
    }
    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    json(res, e.status || 502, {error: String(e.message || e), code: e.code});
  }
});

server.listen(3001, () => console.log('CA catalogue + RuneProfile API on :3001'));
