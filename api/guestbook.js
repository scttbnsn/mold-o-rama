export default async function handler(req, res) {
  const headers = {
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  };

  try {
    if (req.method === 'GET') {
      const url = `${process.env.SUPABASE_URL}/rest/v1/guestbook?select=id,name,message,created_at&order=created_at.desc&limit=50`;
      const r = await fetch(url, { headers });
      if (!r.ok) {
        console.error('guestbook GET failed', r.status, await r.text());
        return res.status(502).json({ ok: false, error: 'db' });
      }
      const entries = await r.json();
      return res.status(200).json({ ok: true, entries });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const message = (body.message || '').trim().slice(0, 500);
      let name = (body.name || '').trim().slice(0, 60);
      if (!name) name = 'anonymous mold-head';

      if (!message || message.length < 1 || message.length > 500) {
        return res.status(400).json({ ok: false, error: 'message required (1-500 chars)' });
      }

      const url = `${process.env.SUPABASE_URL}/rest/v1/guestbook`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify([{ name, message }])
      });
      if (!r.ok) {
        console.error('guestbook POST failed', r.status, await r.text());
        return res.status(502).json({ ok: false, error: 'db' });
      }
      const rows = await r.json();
      return res.status(200).json({ ok: true, entry: rows[0] });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (e) {
    console.error('guestbook handler error', e);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
}
