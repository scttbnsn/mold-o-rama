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

    let photoUrl = null;
    const photo = body.photo;
    if (typeof photo === 'string' && photo.indexOf('data:image/') === 0 && photo.length < 3_000_000) {
      photoUrl = await uploadSightingPhoto(photo);
    }

    const title = `Sighting: ${venue} (${city})`;
    const bodyLines = [
      `**Venue:** ${venue}`,
      `**City/State:** ${city}`,
      `**What was seen:** ${molds}`,
      `**Reported by:** ${name}`,
    ];
    if (photoUrl) {
      bodyLines.push('**Photo:**', `![sighting photo](${photoUrl})`);
    }
    bodyLines.push('', '---', 'Submitted via the Mold-O-Rama fan site');
    const bodyMd = bodyLines.join('\n');

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
    await cleanupSightingPhotoState();
    res.status(200).json({ ok: true, url: issue.html_url });
  } catch (err) {
    console.error('submit handler error:', err);
    res.status(500).json({ ok: false });
  }
}

async function uploadSightingPhoto(dataUrl) {
  try {
    const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
    if (!match) return null;
    const contentType = match[1];
    const bytes = Buffer.from(match[2], 'base64');
    const ext = contentType.split('/')[1] || 'webp';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const uploadRes = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/sightings/${filename}`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + process.env.SUPABASE_ANON_KEY,
          'Content-Type': contentType,
        },
        body: bytes,
      }
    );

    if (!uploadRes.ok) {
      console.error('sighting photo upload failed:', uploadRes.status, await uploadRes.text());
      return null;
    }

    return `${process.env.SUPABASE_URL}/storage/v1/object/public/sightings/${filename}`;
  } catch (err) {
    console.error('sighting photo upload error:', err);
    return null;
  }
}

// Best-effort: once a sighting photo has been uploaded to storage and
// attached to the issue, its copy in the shared photo_state row (dropped
// via the Submit page's image-slot) is no longer needed. Any failure here
// is swallowed — it must never fail the submission.
async function cleanupSightingPhotoState() {
  try {
    const headers = {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + process.env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    };
    const getRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/photo_state?id=eq.1&select=state`,
      { headers }
    );
    if (!getRes.ok) return;
    const rows = await getRes.json();
    const state = rows[0] && rows[0].state;
    if (!state || !('sighting-photo' in state)) return;
    const next = { ...state };
    delete next['sighting-photo'];
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/photo_state?id=eq.1`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state: next, updated_at: new Date().toISOString() }),
    });
  } catch (err) {}
}
