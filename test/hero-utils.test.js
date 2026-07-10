import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractHeroRecords,
  filterHeroes,
  findHeroBySlug,
  getOfficialHeroUrl,
  normalizeHeroList,
  normalizeHeroRecord,
  sortHeroes,
  toHeroSlug
} from '../hero-utils.js';

test('creates stable, accent-insensitive hero slugs', () => {
  assert.equal(toHeroSlug('Lúcio'), 'lucio');
  assert.equal(toHeroSlug('Torbjörn'), 'torbjorn');
  assert.equal(toHeroSlug('Soldier: 76'), 'soldier-76');
  assert.equal(toHeroSlug('李'), '李');
  assert.equal(toHeroSlug('Герой 7').normalize('NFC'), 'герой-7');
  assert.equal(toHeroSlug('Łukasz'), 'łukasz');
  assert.equal(toHeroSlug('Ægir'), 'ægir');
});

test('keeps legacy accented deep links working', () => {
  const heroes = [{ name: 'Lúcio' }];
  assert.equal(findHeroBySlug(heroes, 'lucio'), heroes[0]);
  assert.equal(findHeroBySlug(heroes, 'l-cio'), heroes[0]);
});

test('prefers a canonical slug match over an earlier legacy alias', () => {
  const heroes = [{ name: 'Lúcio' }, { name: 'L-cio' }];
  assert.equal(findHeroBySlug(heroes, 'l-cio'), heroes[1]);
});

test('normalizes whitespace, nested roles, and role aliases', () => {
  assert.deepEqual(
    normalizeHeroRecord({
      heroName: '  Tracer  ',
      role: { name: ' damage ' },
      location: '  United Kingdom '
    }),
    {
      name: 'Tracer',
      role: 'Damage',
      origin: 'United Kingdom'
    }
  );

  assert.equal(normalizeHeroRecord({ name: 'Example', role: 'DPS' }).role, 'Damage');
});

test('rejects blank, malformed, and unknown-role records', () => {
  assert.equal(normalizeHeroRecord(null), null);
  assert.equal(normalizeHeroRecord({ name: '   ', role: 'Tank' }), null);
  assert.equal(normalizeHeroRecord({ name: 'Example', role: '   ' }), null);
  assert.equal(normalizeHeroRecord({ name: 'Example', role: {} }), null);
  assert.equal(normalizeHeroRecord({ name: 'Example', role: 'Wizard' }), null);
  assert.equal(normalizeHeroRecord({ name: 'Example', role: 'constructor' }), null);
  assert.equal(normalizeHeroRecord({ name: 'Example', role: '__proto__' }), null);
});

test('deduplicates normalized hero lists and enforces the safety limit', () => {
  const heroes = normalizeHeroList([
    { name: 'Lúcio', role: 'support' },
    { name: 'Lucio', role: 'Support' },
    { name: 'D.Va', role: 'tank' }
  ]);

  assert.deepEqual(
    heroes.map((hero) => hero.name),
    ['Lúcio', 'D.Va']
  );
  assert.throws(
    () => normalizeHeroList(new Array(3).fill({ name: 'Hero', role: 'Tank' }), { maxHeroes: 2 }),
    /safety limit/
  );
});

test('extracts supported API response shapes', () => {
  const records = [{ name: 'Ana' }];
  assert.equal(extractHeroRecords(records), records);
  assert.equal(extractHeroRecords({ heroes: records }), records);
  assert.equal(extractHeroRecords({ results: records }), records);
  assert.equal(extractHeroRecords({ data: records }), records);
  assert.equal(extractHeroRecords({ items: records }), null);
});

test('filters by name, role, and origin', () => {
  const heroes = [
    { name: 'Tracer', role: 'Damage', origin: 'United Kingdom' },
    { name: 'Winston', role: 'Tank', origin: 'Horizon Lunar Colony' }
  ];

  assert.deepEqual(filterHeroes(heroes, { query: 'kingdom' }), [heroes[0]]);
  assert.deepEqual(filterHeroes(heroes, { query: 'tank' }), [heroes[1]]);
  assert.deepEqual(filterHeroes(heroes, { role: 'Damage' }), [heroes[0]]);
});

test('sorts without mutating the input list', () => {
  const heroes = [
    { name: 'Zarya', role: 'Tank' },
    { name: 'Ana', role: 'Support' },
    { name: 'Ashe', role: 'Damage' }
  ];
  const original = [...heroes];

  assert.deepEqual(
    sortHeroes(heroes, 'name-desc').map((hero) => hero.name),
    ['Zarya', 'Ashe', 'Ana']
  );
  assert.deepEqual(
    sortHeroes(heroes, 'role-name').map((hero) => hero.name),
    ['Ashe', 'Ana', 'Zarya']
  );
  assert.deepEqual(heroes, original);
});

test('builds official profile URLs, including D.Va', () => {
  assert.equal(
    getOfficialHeroUrl('D.Va'),
    'https://overwatch.blizzard.com/en-us/heroes/dva/'
  );
  assert.equal(
    getOfficialHeroUrl('Lúcio'),
    'https://overwatch.blizzard.com/en-us/heroes/lucio/'
  );
});
