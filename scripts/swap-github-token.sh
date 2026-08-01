#!/usr/bin/env bash
# Swap the Vercel GITHUB_TOKEN for a fine-grained PAT, redeploy, and verify.
# Create the PAT first at https://github.com/settings/personal-access-tokens/new
#   Resource owner: scttbnsn - Only select repositories: mold-o-rama
#   Repository permissions: Issues = Read and write (Metadata comes along automatically)
set -euo pipefail

read -r -s -p "Paste the new fine-grained PAT: " TOKEN
echo

echo "Checking the token can open issues on scttbnsn/mold-o-rama..."
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" \
  https://api.github.com/repos/scttbnsn/mold-o-rama/issues)
if [ "$CODE" != "200" ]; then
  echo "Token check failed (HTTP $CODE) - not swapping. Is the PAT scoped to the repo with Issues read/write?"
  exit 1
fi

vercel env rm GITHUB_TOKEN production --yes --scope codeswhat >/dev/null
printf '%s' "$TOKEN" | vercel env add GITHUB_TOKEN production --scope codeswhat >/dev/null
echo "Env var swapped. Redeploying..."
vercel deploy --prod --yes --scope codeswhat

echo "Verifying the live endpoint files an issue with the new token..."
RESP=$(curl -s -X POST https://mold-o-rama.vercel.app/api/submit \
  -H 'Content-Type: application/json' \
  -d '{"venue":"Token swap check","city":"Nowhere, OK","molds":"verifying new PAT","name":"webmaster"}')
echo "$RESP"
URL=$(echo "$RESP" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')
if [ -n "$URL" ]; then
  NUM=${URL##*/}
  gh issue close "$NUM" -R scttbnsn/mold-o-rama -c "Test issue from token swap verification." >/dev/null
  echo "New PAT works (test issue $NUM created and closed). Old gh CLI token removed from Vercel."
else
  echo "Submit endpoint did not return an issue URL - check 'vercel logs' before trusting the swap."
  exit 1
fi
