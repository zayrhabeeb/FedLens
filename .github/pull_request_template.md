## What and why

<!-- One or two sentences. Link the issue: Closes #123 -->

## How it was tested

- [ ] `npm run lint && npm run typecheck && npm test` pass
- [ ] Loaded the unpacked build (`dist/chrome` or `dist/firefox`) and checked the affected module

## Checklist

- [ ] No paid APIs, backend servers, or user-facing API keys introduced
- [ ] No secrets, keys or `.env` files committed
- [ ] No remote code (scripts, fonts, WASM) — everything is bundled (MV3 CSP)
- [ ] New NLP rules / data parsers have unit tests
- [ ] New data sources or libraries are listed in `ATTRIBUTIONS.md` with their license
