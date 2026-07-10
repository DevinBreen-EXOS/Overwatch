import {
  BUNDLED_ROSTER_VERIFIED,
  defaultHeroes,
  heroLore,
  heroRates
} from './hero-data.js';
import { fetchHeroRoster } from './hero-api.js';
import {
  filterHeroes,
  findHeroBySlug,
  getOfficialHeroUrl,
  sortHeroes,
  toHeroSlug
} from './hero-utils.js';

const configuredEndpoint = window.OVERWATCH_HERO_API_URL;
const API_ENDPOINT =
  typeof configuredEndpoint === 'string' && configuredEndpoint.trim()
    ? configuredEndpoint.trim()
    : null;
const configuredTimeout = Number(window.OVERWATCH_HERO_API_TIMEOUT_MS);
const API_TIMEOUT_MS = Number.isFinite(configuredTimeout)
  ? Math.min(Math.max(configuredTimeout, 1000), 20000)
  : 5000;

let heroes = [...defaultHeroes];
let selectedHeroName = null;

const heroGrid = document.getElementById('heroGrid');
const totalHeroes = document.getElementById('totalHeroes');
const shownHeroes = document.getElementById('shownHeroes');
const rateSamples = document.getElementById('rateSamples');
const selectedHero = document.getElementById('selectedHero');
const searchInput = document.getElementById('searchInput');
const roleFilter = document.getElementById('roleFilter');
const sortOrder = document.getElementById('sortOrder');
const resetFilters = document.getElementById('resetFilters');
const resultsSummary = document.getElementById('resultsSummary');
const cardTemplate = document.getElementById('heroCardTemplate');
const loreName = document.getElementById('loreName');
const loreText = document.getElementById('loreText');
const loreMeta = document.getElementById('loreMeta');
const loreLink = document.getElementById('loreLink');
const returnToHero = document.getElementById('returnToHero');
const roleChips = [...document.querySelectorAll('.chip')];
const heroDetails = document.getElementById('heroDetails');
const rosterStatus = document.getElementById('rosterStatus');
const rosterStatusBadge = document.getElementById('rosterStatusBadge');
const rosterStatusDetail = document.getElementById('rosterStatusDetail');
const rosterTitle = document.getElementById('rosterTitle');

const verifiedDate = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeZone: 'UTC'
}).format(new Date(`${BUNDLED_ROSTER_VERIFIED}T00:00:00Z`));

function setRosterStatus(state, label, detail) {
  rosterStatus.dataset.state = state;
  rosterStatus.setAttribute('aria-busy', String(state === 'loading'));
  rosterStatusBadge.textContent = label;
  rosterStatusDetail.textContent = detail;
}

function getHeroFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return findHeroBySlug(heroes, params.get('hero'));
}

function syncHeroToUrl(heroName, historyMode = 'push') {
  const url = new URL(window.location.href);
  const nextSlug = heroName ? toHeroSlug(heroName) : null;
  const currentSlug = url.searchParams.get('hero');

  if (nextSlug === currentSlug) {
    return;
  }

  if (nextSlug) {
    url.searchParams.set('hero', nextSlug);
  } else {
    url.searchParams.delete('hero');
  }

  const method = historyMode === 'replace' ? 'replaceState' : 'pushState';
  window.history[method]({}, '', url);
}

function getBundledHero(heroName) {
  const heroSlug = toHeroSlug(heroName);
  return defaultHeroes.find((hero) => toHeroSlug(hero.name) === heroSlug) || null;
}

function getRateSample(heroName) {
  const bundledHero = getBundledHero(heroName);
  const rateKey = bundledHero?.name;
  return rateKey && Object.hasOwn(heroRates, rateKey) ? heroRates[rateKey] : null;
}

function syncDashboardStats() {
  const loadedSlugs = new Set(heroes.map((hero) => toHeroSlug(hero.name)));
  const matchingRateSamples = Object.keys(heroRates).filter((name) => {
    return loadedSlugs.has(toHeroSlug(name));
  }).length;

  totalHeroes.textContent = heroes.length;
  rateSamples.textContent = matchingRateSamples;
}

function setActiveChip(roleValue) {
  roleChips.forEach((chip) => {
    const isActive = chip.dataset.role === roleValue;
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-pressed', String(isActive));
  });
}

function updateResultsSummary(count, role) {
  const roleText = role === 'all' ? 'all roles' : `${role} heroes`;
  const filterState = searchInput.value.trim() ? ` matching “${searchInput.value.trim()}”` : '';
  resultsSummary.textContent = `Showing ${count} of ${heroes.length} heroes across ${roleText}${filterState}.`;
}

function getLoreMeta(hero) {
  const rates = getRateSample(hero.name);
  if (!rates) {
    return `${hero.role} • ${hero.origin} • No bundled rate sample.`;
  }

  return `${hero.role} • ${hero.origin} • Sample win ${rates.winRate} • Sample pick ${rates.pickRate}`;
}

function updateSelectedCardState() {
  const selectedSlug = selectedHeroName ? toHeroSlug(selectedHeroName) : null;
  let selectedCardIsVisible = false;

  document.querySelectorAll('.hero-card').forEach((heroCard) => {
    const isSelected = heroCard.dataset.heroSlug === selectedSlug;
    heroCard.classList.toggle('is-selected', isSelected);
    selectedCardIsVisible ||= isSelected;

    if (isSelected) {
      heroCard.setAttribute('aria-current', 'true');
    } else {
      heroCard.removeAttribute('aria-current');
    }
  });

  returnToHero.hidden = !selectedCardIsVisible;
}

function resetLorePanel() {
  selectedHeroName = null;
  selectedHero.textContent = 'None';
  loreName.textContent = 'Select a hero';
  loreText.textContent = 'Choose any hero card to view their lore.';
  loreMeta.textContent = 'Role, origin, and sample performance data will appear here.';
  loreLink.hidden = true;
  loreLink.removeAttribute('href');
  returnToHero.hidden = true;
  updateSelectedCardState();
}

function clearSelection({ syncUrl = false, historyMode = 'replace' } = {}) {
  resetLorePanel();

  if (syncUrl) {
    syncHeroToUrl(null, historyMode);
  }
}

function restoreFocusedHero(focusedHeroSlug) {
  if (!focusedHeroSlug) {
    return;
  }

  const focusedCard = [...document.querySelectorAll('.hero-card')].find((card) => {
    return card.dataset.heroSlug === focusedHeroSlug;
  });

  if (focusedCard) {
    focusedCard.focus({ preventScroll: true });
  } else {
    resultsSummary.textContent +=
      ' The previously focused hero is not available in this roster.';
    rosterTitle.focus({ preventScroll: true });
  }
}

function renderHeroes() {
  const focusedHeroSlug = document.activeElement?.classList.contains('hero-card')
    ? document.activeElement.dataset.heroSlug
    : null;
  const role = roleFilter.value;
  const filtered = filterHeroes(heroes, {
    query: searchInput.value,
    role
  });
  const sorted = sortHeroes(filtered, sortOrder.value);

  shownHeroes.textContent = sorted.length;
  selectedHero.textContent = selectedHeroName || 'None';
  updateResultsSummary(sorted.length, role);
  setActiveChip(role);
  heroGrid.replaceChildren();

  if (sorted.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent =
      'No heroes match your current filters. Try resetting or searching by role or region.';
    heroGrid.append(emptyState);
    updateSelectedCardState();
    restoreFocusedHero(focusedHeroSlug);
    return;
  }

  const fragment = document.createDocumentFragment();

  sorted.forEach((hero) => {
    const heroCard = cardTemplate.content.firstElementChild.cloneNode(true);
    const rates = getRateSample(hero.name);

    heroCard.dataset.heroSlug = toHeroSlug(hero.name);
    heroCard.querySelector('.hero-name').textContent = hero.name;
    heroCard.querySelector('.hero-role').textContent = hero.role;
    heroCard.querySelector('.hero-origin').textContent = `Origin: ${hero.origin}`;

    const heroHint = heroCard.querySelector('.hero-hint');
    if (rates) {
      heroHint.textContent = `Sample: ${rates.winRate} win • ${rates.pickRate} pick`;
      heroHint.classList.add('hero-hint--rates');
    } else {
      heroHint.textContent = 'View hero intel';
    }

    heroCard.addEventListener('click', () => {
      updateLorePanel(hero.name, { syncUrl: true, scrollToDetails: true });
    });

    fragment.append(heroCard);
  });

  heroGrid.append(fragment);
  updateSelectedCardState();
  restoreFocusedHero(focusedHeroSlug);
}

function updateLorePanel(heroName, options = {}) {
  const hero = heroes.find((item) => item.name === heroName);
  if (!hero) {
    clearSelection();
    return;
  }

  selectedHeroName = hero.name;
  const bundledHero = getBundledHero(hero.name);
  const loreKey = bundledHero?.name;
  selectedHero.textContent = hero.name;
  loreName.textContent = hero.name;
  loreText.textContent =
    loreKey && Object.hasOwn(heroLore, loreKey)
      ? heroLore[loreKey]
      : 'Lore coming soon for this hero.';
  loreMeta.textContent = getLoreMeta(hero);

  if (bundledHero) {
    loreLink.href = getOfficialHeroUrl(bundledHero.name);
    loreLink.hidden = false;
  } else {
    loreLink.hidden = true;
    loreLink.removeAttribute('href');
  }

  returnToHero.textContent = `Return to ${hero.name} in roster`;
  updateSelectedCardState();

  if (options.syncUrl) {
    syncHeroToUrl(hero.name);
  }

  if (options.scrollToDetails) {
    if (window.matchMedia('(max-width: 820px)').matches) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      heroDetails.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });
    }

    loreName.focus({ preventScroll: true });
  }
}

function resetDashboardFilters() {
  searchInput.value = '';
  roleFilter.value = 'all';
  sortOrder.value = 'name-asc';
  clearSelection({ syncUrl: true, historyMode: 'push' });
  renderHeroes();
  searchInput.focus();
}

async function refreshHeroesFromApi() {
  setRosterStatus(
    'loading',
    'Refreshing roster',
    `Showing the ${heroes.length}-hero bundled roster while the configured API responds.`
  );

  try {
    heroes = await fetchHeroRoster(API_ENDPOINT, {
      timeoutMs: API_TIMEOUT_MS,
      maxHeroes: 100
    });

    syncDashboardStats();
    renderHeroes();

    const heroFromUrl = getHeroFromUrl();
    if (heroFromUrl) {
      updateLorePanel(heroFromUrl.name);
    } else if (selectedHeroName && !heroes.some((hero) => hero.name === selectedHeroName)) {
      clearSelection({ syncUrl: true, historyMode: 'replace' });
    }

    setRosterStatus(
      'configured',
      'Configured API roster',
      `${heroes.length} schema-validated heroes loaded from the configured API.`
    );
  } catch (error) {
    setRosterStatus(
      'fallback',
      'Bundled fallback',
      `API refresh failed. Showing ${heroes.length} heroes verified ${verifiedDate}.`
    );
    console.warn(`Using the bundled hero roster: ${error.message}`);
  }
}

roleChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    roleFilter.value = chip.dataset.role;
    renderHeroes();
  });
});

searchInput.addEventListener('input', renderHeroes);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && searchInput.value) {
    searchInput.value = '';
    renderHeroes();
  }
});
roleFilter.addEventListener('change', renderHeroes);
sortOrder.addEventListener('change', renderHeroes);
resetFilters.addEventListener('click', resetDashboardFilters);
returnToHero.addEventListener('click', () => {
  const selectedSlug = selectedHeroName ? toHeroSlug(selectedHeroName) : null;
  const selectedCard = [...document.querySelectorAll('.hero-card')].find((card) => {
    return card.dataset.heroSlug === selectedSlug;
  });

  if (selectedCard) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    selectedCard.focus({ preventScroll: true });
    selectedCard.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center'
    });
  }
});

window.addEventListener('popstate', () => {
  const heroFromUrl = getHeroFromUrl();

  if (heroFromUrl) {
    updateLorePanel(heroFromUrl.name);
  } else {
    clearSelection();
  }
});

function initDashboard() {
  syncDashboardStats();
  renderHeroes();

  const heroFromUrl = getHeroFromUrl();
  if (heroFromUrl) {
    updateLorePanel(heroFromUrl.name);
  }

  if (API_ENDPOINT) {
    void refreshHeroesFromApi();
  } else {
    setRosterStatus(
      'bundled',
      'Bundled roster',
      `${heroes.length} heroes verified against the official roster on ${verifiedDate}.`
    );
  }
}

initDashboard();
