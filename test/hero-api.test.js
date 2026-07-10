import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchHeroRoster } from '../hero-api.js';

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    }
  };
}

test('loads and validates a supported API payload', async () => {
  const heroes = await fetchHeroRoster('https://example.com/heroes', {
    fetchImpl: async () =>
      jsonResponse({
        heroes: [{ name: '  Tracer ', role: 'damage', nationality: 'UK' }]
      })
  });

  assert.deepEqual(heroes, [{ name: 'Tracer', role: 'Damage', origin: 'UK' }]);
});

test('rejects non-success responses and unsupported payloads', async () => {
  await assert.rejects(
    fetchHeroRoster('https://example.com/heroes', {
      fetchImpl: async () => jsonResponse({}, { ok: false, status: 503 })
    }),
    /503/
  );

  await assert.rejects(
    fetchHeroRoster('https://example.com/heroes', {
      fetchImpl: async () => jsonResponse({ items: [] })
    }),
    /supported hero list/
  );
});

test('rejects payloads with no valid heroes', async () => {
  await assert.rejects(
    fetchHeroRoster('https://example.com/heroes', {
      fetchImpl: async () => jsonResponse([{ name: ' ', role: 'Tank' }])
    }),
    /no valid heroes/
  );
});

test('aborts a stalled request after the configured timeout', async () => {
  const stalledFetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('The operation was aborted.', 'AbortError')),
        { once: true }
      );
    });

  await assert.rejects(
    fetchHeroRoster('https://example.com/heroes', {
      fetchImpl: stalledFetch,
      timeoutMs: 10
    }),
    /timed out after 10ms/
  );
});
