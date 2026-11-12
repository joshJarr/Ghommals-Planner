import {createServer} from 'node:http';
import {selfCheck} from './src/progress.mjs';
import {getTasks, getWikiSync} from './lib/osrs.mjs';

selfCheck();

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
      const profile = (url.searchParams.get('profile') || 'STANDARD').toUpperCase();
      return json(res, 200, await getWikiSync(username, profile), 'no-store');
    }
    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    json(res, e.status || 502, {error: String(e.message || e), code: e.code});
  }
});

server.listen(3001, () => console.log('CA catalogue + WikiSync API on :3001'));
