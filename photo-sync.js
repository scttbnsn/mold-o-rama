// Bridges image-slot.js's persistence contract (window.omelette.writeFile)
// to /api/photos on the deployed site, so dropped photos are shared across
// visitors instead of living only in the local sidecar file.
window.omelette = window.omelette || {};
window.omelette.writeFile = function (name, json) {
  if (name !== '.image-slots.state.json') return Promise.resolve();
  return fetch('/api/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json
  });
};
