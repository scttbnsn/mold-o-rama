// Cheap AI relevance check for uploaded photos (claude-haiku-4-5, ~$0.002/image).
// Fails OPEN: any missing key, unsupported format, or API error counts as
// "not checked" and the photo is allowed through — moderation must never
// break the site. Underscore prefix keeps this out of Vercel's function routes.
import Anthropic from '@anthropic-ai/sdk';

const SUPPORTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    relevant: { type: 'boolean' },
    reason: { type: 'string', maxLength: 200 }
  },
  required: ['relevant', 'reason'],
  additionalProperties: false
};

const PROMPT =
  'Decide whether this image belongs on a family-friendly fan site for Mold-A-Rama / ' +
  'Mold-O-Rama machines (1960s coin-operated vending machines that injection-mold warm ' +
  'plastic souvenir figurines on the spot). Mark relevant=true if the photo is plausibly ' +
  'related: the machines themselves, molded plastic figurines or souvenirs, vending ' +
  'machines generally, or places that host them such as zoos, museums, aquariums, and ' +
  'roadside attractions - including people posing with any of these. Be permissive: when ' +
  'in doubt, allow it. Mark relevant=false only if the image is clearly unrelated to all ' +
  'of the above, or is not family-friendly. Give a short reason either way.';

// Returns { checked, relevant, reason }. relevant is only meaningful when checked=true.
export async function moderatePhoto(dataUrl) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { checked: false, relevant: true, reason: 'no api key configured' };
  }
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
  if (!match) return { checked: false, relevant: true, reason: 'unparseable data url' };
  const mediaType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  if (!SUPPORTED.includes(mediaType)) {
    return { checked: false, relevant: true, reason: 'unsupported image format' };
  }

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      output_config: { format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: match[2] } },
            { type: 'text', text: PROMPT }
          ]
        }
      ]
    });
    const text = msg.content.find((b) => b.type === 'text');
    const verdict = JSON.parse(text.text);
    return { checked: true, relevant: !!verdict.relevant, reason: String(verdict.reason || '') };
  } catch (err) {
    console.error('photo moderation failed open:', err && err.message);
    return { checked: false, relevant: true, reason: 'moderation error' };
  }
}
