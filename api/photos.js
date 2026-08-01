function isPlainObject(o) {
  return o !== null && typeof o === 'object' && !Array.isArray(o);
}

function isValidSlotValue(v) {
  if (typeof v === 'string') return v.indexOf('data:image/') === 0;
  if (isPlainObject(v)) {
    if (v.u !== undefined && (typeof v.u !== 'string' || v.u.indexOf('data:image/') !== 0)) return false;
    if (v.s !== undefined && typeof v.s !== 'number') return false;
    if (v.x !== undefined && typeof v.x !== 'number') return false;
    if (v.y !== undefined && typeof v.y !== 'number') return false;
    return true;
  }
  return false;
}

export default async function handler(req, res) {
  const headers = {
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  };

  try {
    if (req.method === 'GET') {
      const url = `${process.env.SUPABASE_URL}/rest/v1/photo_state?id=eq.1&select=state`;
      const r = await fetch(url, { headers });
      if (!r.ok) {
        console.error('photos GET failed', r.status, await r.text());
        return res.status(502).json({ ok: false, error: 'db' });
      }
      const rows = await r.json();
      const state = (rows[0] && rows[0].state) || {};
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(state);
    }

    if (req.method === 'POST') {
      const state = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

      if (!isPlainObject(state)) {
        return res.status(400).json({ ok: false, error: 'state must be an object' });
      }
      for (const key in state) {
        if (!isValidSlotValue(state[key])) {
          return res.status(400).json({ ok: false, error: 'invalid slot value' });
        }
      }
      if (JSON.stringify(state).length > 4_000_000) {
        return res.status(413).json({ ok: false, error: 'state too large' });
      }

      const url = `${process.env.SUPABASE_URL}/rest/v1/photo_state?id=eq.1`;
      const r = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state, updated_at: new Date().toISOString() })
      });
      if (!r.ok) {
        console.error('photos POST failed', r.status, await r.text());
        return res.status(502).json({ ok: false, error: 'db' });
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (e) {
    console.error('photos handler error', e);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
}
