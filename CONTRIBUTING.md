# Contributing to FedLens

Thanks for helping! FedLens is small and readable on purpose — please keep it that way.

## Ground rules

FedLens must stay **free to use and free to run**. A change will not be merged if it:

- adds a paid API, a backend server, or a user-facing API key requirement;
- commits a secret, key or `.env` file;
- loads code from a remote URL (scripts, fonts, WASM must be bundled — MV3 CSP);
- makes a language model the source of a number, label or score. Models may only re-phrase deterministic output, behind the hallucination shield.

## Getting started

```bash
npm ci
npm run dev        # UI on localhost:5173 (no extension APIs; uses bundled data)
npm run build      # dist/chrome and dist/firefox → load unpacked to test for real
npm test           # unit tests
npm run lint       # ESLint + Prettier
```

Before opening a PR, run `npm run lint && npm run typecheck && npm test`, then load the unpacked build and click through the module you changed.

## Where things live

| Area | Folder | Notes |
| --- | --- | --- |
| Keyword dictionaries | `src/nlp/lexicon.ts` | The NLP "model". Prefer multi-word phrases; add a test for every new rule. |
| Entity / event rules | `src/nlp/entities.ts`, `src/nlp/events.ts` | Precision over recall: speculative headlines must not become events. |
| Credibility tiers | `src/nlp/credibility.ts` | Changes should cite why an outlet belongs in a tier. |
| Forecast inputs | `src/forecast/signals.ts` | Signals must be computable from data available at time *t* so the backtest stays honest. |
| Data sources | `scripts/sources/*.ts` | One file per provider, with a pure `parse…` function and a unit test. |
| UI modules | `src/ui/modules/*.tsx` | One file per module; shared pieces in `src/ui/components`. |

### Adding a data source

1. Add `scripts/sources/<provider>.ts` with a fetch function and a pure parser.
2. Add parser tests in `scripts/sources/sources.test.ts`.
3. Wire it into `scripts/fetch-snapshots.ts` inside `b.run(...)` so a failure keeps the previous values.
4. Document it in the README data table and in `ATTRIBUTIONS.md` with its terms of use.
5. Prefer keyless endpoints. If a free key is unavoidable, read it from an environment variable that the workflow maps from a repo secret, and make the source optional.

## Data pipeline secrets (optional)

The scheduled workflow (`.github/workflows/refresh-data.yml`) works with **no secrets at all**. In your fork you can add any of these under **Settings → Secrets and variables → Actions → New repository secret** to get richer data:

| Secret | Free signup | Effect |
| --- | --- | --- |
| `FRED_API_KEY` | https://fred.stlouisfed.org/docs/api/api_key.html | Use the official FRED API instead of the public `fredgraph.csv` download |
| `BEA_API_KEY` | https://apps.bea.gov/API/signup/ | Add quarterly US real GDP growth (SAAR) |
| `BLS_API_KEY` | https://data.bls.gov/registrationEngine/ | BLS API v2: 20 years of monthly history instead of ~3 |

To run the pipeline locally with keys, copy `.env.example` to `.env`, fill it in, and run `node --env-file=.env --import tsx scripts/fetch-snapshots.ts` (or simply `npm run data:refresh` for the keyless path). `.env` is git-ignored. Keys are redacted from all log output.

Then point the extension at your fork's data by editing `SNAPSHOT_BASE_URL` in `src/config.ts`.

## Commit and PR style

- Small, focused PRs with a clear "what and why".
- Conventional-ish commit prefixes are appreciated: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `data:`.
- New behaviour needs a test; bug fixes should add a test that fails without the fix.

## Releasing (maintainers)

1. Bump `version` in `package.json`.
2. Commit, then `git tag vX.Y.Z && git push --tags`.
3. The Release workflow builds both browsers and attaches the zips to a GitHub Release.

By contributing you agree that your contributions are licensed under the MIT License.
