import { extractHeroRecords, normalizeHeroList } from './hero-utils.js';

export async function fetchHeroRoster(
  endpoint,
  { fetchImpl = globalThis.fetch, timeoutMs = 5000, maxHeroes = 100 } = {}
) {
  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    throw new Error('A hero API endpoint is required.');
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint.trim(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Hero API returned ${response.status}.`);
    }

    const records = extractHeroRecords(await response.json());
    if (!records) {
      throw new Error('Hero API response did not contain a supported hero list.');
    }

    const heroes = normalizeHeroList(records, { maxHeroes });
    if (heroes.length === 0) {
      throw new Error('Hero API response contained no valid heroes.');
    }

    return heroes;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Hero API request timed out after ${timeoutMs}ms.`, { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
