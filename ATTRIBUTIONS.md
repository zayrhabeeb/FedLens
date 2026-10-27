# Attributions

FedLens is MIT-licensed. It relies on public data and open-source software, credited below. All dependencies shipped in the extension use licenses compatible with MIT distribution.

## Data sources

| Source | Data used | Terms |
| --- | --- | --- |
| [Bank for International Settlements](https://data.bis.org) | Central bank policy rates (WS_CBPOL), consumer prices (WS_LONG_CPI) | Free reuse with attribution — [BIS terms of use](https://www.bis.org/terms_conditions.htm). Source: BIS. |
| [World Bank Open Data](https://data.worldbank.org) | GDP growth, unemployment (ILO modelled), trade balance | [CC BY 4.0](https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets). Source: World Bank. |
| [European Central Bank Data Portal](https://data.ecb.europa.eu) | Euro reference exchange rates, euro-area HICP | Free reuse with source acknowledgement — [ECB copyright](https://www.ecb.europa.eu/services/disclaimer/html/index.en.html). Source: ECB. |
| [FRED, Federal Reserve Bank of St. Louis](https://fred.stlouisfed.org) | CPIAUCSL (BLS), GS2 (Board of Governors) | Series used are US-government data in the public domain; FRED [terms of use](https://fred.stlouisfed.org/legal/). |
| [US Treasury FiscalData](https://fiscaldata.treasury.gov) | Debt to the Penny | US government work, public domain. |
| [US Bureau of Labor Statistics](https://www.bls.gov/developers/) | Unemployment rate (LNS14000000) | US government work, public domain. BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov. |
| [US Bureau of Economic Analysis](https://apps.bea.gov/API/) (optional) | Real GDP growth (NIPA T10101) | US government work, public domain. |
| Central bank RSS feeds — Federal Reserve, ECB, Bank of England, Bank of Japan, Bank of Canada, Reserve Bank of Australia | Release headlines and links | Content © the respective institutions; FedLens shows headlines with links to the original. |
| [Google News RSS](https://news.google.com) | Headlines linking to publishers | Headlines are shown with attribution and link to the original publisher; article content is not reproduced. |

Inflation targets in `src/shared/countries.ts` are taken from each central bank's published mandate.

## Bundled software (ships in the extension)

| Package | License | Use |
| --- | --- | --- |
| [React](https://react.dev) / react-dom | MIT | UI |
| [lucide-react](https://lucide.dev) | ISC | Icons |
| [Inter](https://rsms.me/inter/) via @fontsource/inter | SIL OFL 1.1 | Body font (bundled locally) |
| [Cormorant Garamond](https://github.com/CatharsisFonts/Cormorant) via @fontsource/cormorant-garamond | SIL OFL 1.1 | Display font (bundled locally) |
| [pdf.js](https://mozilla.github.io/pdf.js/) (pdfjs-dist) | Apache-2.0 | Local PDF text extraction |
| [Transformers.js](https://github.com/huggingface/transformers.js) (@huggingface/transformers, @huggingface/jinja, @huggingface/tokenizers) | Apache-2.0 / MIT | Optional on-device model |
| [ONNX Runtime Web](https://onnxruntime.ai) (onnxruntime-web) | MIT | WASM inference for the optional model |
| tslib, type-fest and other small transitive helpers | 0BSD, MIT/CC0, ISC | Runtime helpers |

`@huggingface/transformers` also depends on Node-only packages (`sharp`, which bundles LGPL-3.0 libvips binaries, and `onnxruntime-node`). These are installed in `node_modules` for development but are **not included in the extension build** (verified: the build output contains no sharp, libvips or onnxruntime-node code).

## Optional model weights (downloaded by the user, not bundled)

| Model | License |
| --- | --- |
| [Xenova/flan-t5-base](https://huggingface.co/Xenova/flan-t5-base) (ONNX export of [google/flan-t5-base](https://huggingface.co/google/flan-t5-base)) | Apache-2.0 |

## Development tools (not shipped)

Vite (MIT), @vitejs/plugin-react (MIT), Tailwind CSS (MIT), TypeScript (Apache-2.0), Vitest (MIT), ESLint (MIT), typescript-eslint (MIT), eslint-plugin-react-hooks (MIT), Prettier (MIT), tsx (MIT), fflate (MIT), globals (MIT), @types/* (MIT).

## Icon

The FedLens icon is generated procedurally by `scripts/generate-icons.mjs` and is part of this project (MIT).
