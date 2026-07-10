# Overwatch Hero Dashboard

A zero-build, zero-runtime-dependency hero explorer with search, role filters, deep links, a resilient optional API, and a current bundled fallback.

## Quick start

Serve the repository over HTTP so browser modules load correctly:

```sh
python -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

To run the checks and unit tests, install Node.js 20 or newer:

```sh
npm install
npm test
```

Browser smoke tests cover real DOM wiring, navigation, responsive focus, and API success/fallback states:

```sh
npx playwright install chromium
npm run test:e2e
```

## Data behavior

The dashboard renders the bundled roster immediately. That roster contains 50 heroes and was verified on July 9, 2026 against Blizzard's [official hero roster](https://overwatch.blizzard.com/en-us/heroes/).

The eight win/pick-rate entries are explicitly labeled as demonstration samples. They are not presented as live competitive data.

### Optional hero API

Set the endpoint before `app.js` loads:

```html
<script>
  window.OVERWATCH_HERO_API_URL = 'https://example.com/api/heroes';
  window.OVERWATCH_HERO_API_TIMEOUT_MS = 5000;
</script>
<script type="module" src="app.js"></script>
```

Without that setting, the app makes no API request. With it, the bundled roster stays visible while the app refreshes in the background. Requests time out, failures are shown in the UI, and invalid payloads never replace the fallback. API data is labeled as schema-validated rather than official; official profile links appear only for names that match the verified bundled roster.

Supported top-level response shapes are a JSON array or an object containing an array under `heroes`, `results`, or `data`:

```json
{
  "heroes": [
    {
      "name": "Tracer",
      "role": "Damage",
      "origin": "United Kingdom"
    }
  ]
}
```

Records may use `heroName` instead of `name`, `role.name` instead of `role`, and `location` or `nationality` instead of `origin`. Roles are canonicalized to `Tank`, `Damage`, or `Support`; malformed and duplicate records are discarded. Responses above 100 records are rejected as a safety limit.

## Project structure

- `app.js` coordinates browser state, rendering, and history.
- `hero-data.js` contains the bundled roster, lore, and sample rates.
- `hero-utils.js` contains validated, testable domain logic.
- `hero-api.js` owns the timeout-guarded API boundary.
- `test/` covers normalization, filtering, slugs, API failures, and data invariants.
- `e2e/` runs Chromium smoke tests against the complete browser application.
- `.github/workflows/ci.yml` runs both test layers on pushes and pull requests.

## Deployment

The project is static and can be hosted on GitHub Pages or any static web server. No backend is required. If an external API is configured, it must allow browser requests from the deployed origin.

## Disclaimer

This is a fan-made project and is not affiliated with Blizzard Entertainment. Overwatch and its characters are trademarks of Blizzard Entertainment.
