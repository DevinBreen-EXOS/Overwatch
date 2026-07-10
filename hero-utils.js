export const HERO_ROLES = Object.freeze(['Tank', 'Damage', 'Support']);

const ROLE_ALIASES = new Map([
  ['tank', 'Tank'],
  ['damage', 'Damage'],
  ['dps', 'Damage'],
  ['offense', 'Damage'],
  ['support', 'Support'],
  ['healer', 'Support']
]);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function toHeroSlug(heroName) {
  return cleanString(heroName)
    .normalize('NFKD')
    .replace(/(\p{Script=Latin})\p{Mark}+/gu, '$1')
    .toLocaleLowerCase('en')
    .replace(/[^\p{Letter}\p{Number}\p{Mark}]+/gu, '-')
    .replace(/(^-|-$)/g, '');
}

function toLegacyHeroSlug(heroName) {
  return cleanString(heroName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function findHeroBySlug(heroList, slug) {
  const requestedSlug = cleanString(slug).toLowerCase();

  if (!requestedSlug) {
    return null;
  }

  const canonicalMatch = heroList.find((hero) => toHeroSlug(hero.name) === requestedSlug);
  if (canonicalMatch) {
    return canonicalMatch;
  }

  return heroList.find((hero) => toLegacyHeroSlug(hero.name) === requestedSlug) || null;
}

export function normalizeHeroRecord(hero) {
  if (!hero || typeof hero !== 'object' || Array.isArray(hero)) {
    return null;
  }

  const name = cleanString(hero.name) || cleanString(hero.heroName);
  const rawRole = typeof hero.role === 'object' && hero.role !== null ? hero.role.name : hero.role;
  const role = ROLE_ALIASES.get(cleanString(rawRole).toLowerCase()) || '';
  const origin =
    cleanString(hero.origin) ||
    cleanString(hero.location) ||
    cleanString(hero.nationality) ||
    'Unknown';

  if (!name || !role) {
    return null;
  }

  return { name, role, origin };
}

export function normalizeHeroList(records, { maxHeroes = 100 } = {}) {
  if (!Array.isArray(records)) {
    return [];
  }

  if (records.length > maxHeroes) {
    throw new Error(`Hero API returned more than the ${maxHeroes}-record safety limit.`);
  }

  const seenSlugs = new Set();
  const normalized = [];

  records.forEach((record) => {
    const hero = normalizeHeroRecord(record);

    if (!hero) {
      return;
    }

    const slug = toHeroSlug(hero.name);
    if (!slug || seenSlugs.has(slug)) {
      return;
    }

    seenSlugs.add(slug);
    normalized.push(hero);
  });

  return normalized;
}

export function extractHeroRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  for (const key of ['heroes', 'results', 'data']) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return null;
}

export function filterHeroes(heroList, { query = '', role = 'all' } = {}) {
  const normalizedQuery = cleanString(query).toLocaleLowerCase('en');

  return heroList.filter((hero) => {
    const matchesRole = role === 'all' || hero.role === role;
    const searchableText = `${hero.name} ${hero.role} ${hero.origin}`.toLocaleLowerCase('en');
    return matchesRole && searchableText.includes(normalizedQuery);
  });
}

export function sortHeroes(heroList, selectedSort = 'name-asc') {
  const sorted = [...heroList];

  if (selectedSort === 'name-desc') {
    return sorted.sort((a, b) => b.name.localeCompare(a.name));
  }

  if (selectedSort === 'role-name') {
    return sorted.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  }

  return sorted.sort((a, b) => a.name.localeCompare(b.name));
}

export function getOfficialHeroUrl(heroName) {
  const slug = toHeroSlug(heroName) === 'd-va' ? 'dva' : toHeroSlug(heroName);
  return `https://overwatch.blizzard.com/en-us/heroes/${slug}/`;
}
