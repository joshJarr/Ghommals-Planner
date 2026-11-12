import {getWikiSync} from '../lib/osrs.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({error: 'Method not allowed'});
    return;
  }
  try {
    const username = String(req.query.username || '');
    const profile = String(req.query.profile || 'STANDARD').toUpperCase();
    const data = await getWikiSync(username, profile);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (e) {
    res.status(e.status || 502).json({error: String(e.message || e), code: e.code});
  }
}
