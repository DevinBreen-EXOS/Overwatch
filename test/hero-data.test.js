import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUNDLED_ROSTER_VERIFIED,
  defaultHeroes,
  heroLore,
  heroRates
} from '../hero-data.js';
import { HERO_ROLES, toHeroSlug } from '../hero-utils.js';

test('bundled roster has 50 unique, valid heroes with lore', () => {
  assert.equal(defaultHeroes.length, 50);

  const slugs = new Set();
  defaultHeroes.forEach((hero) => {
    assert.ok(hero.name);
    assert.ok(HERO_ROLES.includes(hero.role));
    assert.ok(hero.origin);
    assert.ok(heroLore[hero.name], `Missing lore for ${hero.name}`);

    const slug = toHeroSlug(hero.name);
    assert.ok(!slugs.has(slug), `Duplicate slug: ${slug}`);
    slugs.add(slug);
  });

  assert.deepEqual(
    Object.keys(heroLore).sort(),
    defaultHeroes.map((hero) => hero.name).sort()
  );
});

test('sample rates reference bundled heroes and valid percentages', () => {
  const names = new Set(defaultHeroes.map((hero) => hero.name));
  assert.equal(Object.keys(heroRates).length, 8);

  Object.entries(heroRates).forEach(([name, rates]) => {
    assert.ok(names.has(name), `Unknown rate sample hero: ${name}`);

    for (const value of [rates.winRate, rates.pickRate]) {
      assert.match(value, /^\d+(\.\d+)?%$/);
      const percentage = Number.parseFloat(value);
      assert.ok(percentage >= 0 && percentage <= 100);
    }
  });
});

test('bundled roster verification date is a valid ISO calendar date', () => {
  assert.match(BUNDLED_ROSTER_VERIFIED, /^\d{4}-\d{2}-\d{2}$/);
  const parsed = new Date(`${BUNDLED_ROSTER_VERIFIED}T00:00:00Z`);
  assert.ok(!Number.isNaN(parsed.valueOf()));
  assert.equal(parsed.toISOString().slice(0, 10), BUNDLED_ROSTER_VERIFIED);
});
