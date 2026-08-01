#!/usr/bin/env bash
# Add ANTHROPIC_API_KEY to Vercel so the AI photo check turns on.
# Create a key first at https://platform.claude.com/settings/keys
set -euo pipefail

read -r -s -p "Paste the Anthropic API key: " KEY
echo
case "$KEY" in
  sk-ant-*) ;;
  *) echo "That doesn't look like an Anthropic API key (sk-ant-...)"; exit 1;;
esac

echo "Checking the key works..."
CODE=$(curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/v1/messages \
  -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}')
if [ "$CODE" != "200" ]; then
  echo "Key check failed (HTTP $CODE) - not adding it to Vercel."
  exit 1
fi

vercel env rm ANTHROPIC_API_KEY production --yes --scope codeswhat >/dev/null 2>&1 || true
printf '%s' "$KEY" | vercel env add ANTHROPIC_API_KEY production --scope codeswhat >/dev/null
echo "Env var added. Redeploying..."
vercel deploy --prod --yes --scope codeswhat >/dev/null 2>&1
echo "Done - photo moderation is live on https://mold-o-rama.vercel.app"
