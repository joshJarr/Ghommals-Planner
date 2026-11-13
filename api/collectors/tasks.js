import {getItems} from '../../lib/clog.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({error: 'Method not allowed'});
    return;
  }
  try {
    const data = await getItems();
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (e) {
    res.status(e.status || 502).json({error: String(e.message || e), code: e.code});
  }
}
