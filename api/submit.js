export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method' });
    return;
  }

  try {
    const body = req.body || {};

    const venue = String(body.venue || '').trim().slice(0, 120);
    const city = String(body.city || '').trim().slice(0, 120);
    const molds = (String(body.molds || '').trim() || '(no details)').slice(0, 1000);
    const name = (String(body.name || '').trim() || 'anonymous mold-head').slice(0, 60);

    if (!venue || !city) {
      res.status(400).json({ ok: false, error: 'missing venue/city' });
      return;
    }

    const title = `Sighting: ${venue} (${city})`;
    const bodyMd = [
      `**Venue:** ${venue}`,
      `**City/State:** ${city}`,
      `**What was seen:** ${molds}`,
      `**Reported by:** ${name}`,
      '',
      '---',
      'Submitted via the Mold-O-Rama fan site',
    ].join('\n');

    const ghRes = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'mold-o-rama-site',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body: bodyMd,
        labels: ['sighting'],
      }),
    });

    if (ghRes.status !== 201) {
      const text = await ghRes.text();
      console.error('GitHub issue creation failed:', ghRes.status, text);
      res.status(502).json({ ok: false, error: 'github' });
      return;
    }

    const issue = await ghRes.json();
    res.status(200).json({ ok: true, url: issue.html_url });
  } catch (err) {
    console.error('submit handler error:', err);
    res.status(500).json({ ok: false });
  }
}
