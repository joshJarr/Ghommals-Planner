import {getRuneProfile} from '../lib/osrs.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({error: 'Method not allowed'});
    return;
  }
  try {
    const username = String(req.query.username || '');
    const data = await getRuneProfile(username);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (e) {
    res.status(e.status || 502).json({error: String(e.message || e), code: e.code});
  }
}
