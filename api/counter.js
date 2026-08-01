export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/increment_hits`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + process.env.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: '{}'
      }
    );

    if (!response.ok) {
      console.error('increment_hits RPC failed', response.status, await response.text());
      res.status(502).json({ ok: false });
      return;
    }

    const count = await response.json();
    res.status(200).json({ ok: true, count });
  } catch (err) {
    console.error('counter handler error', err);
    res.status(500).json({ ok: false });
  }
}
