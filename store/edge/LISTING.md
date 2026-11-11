# Microsoft Edge Add-ons — store listing

Everything needed to submit FedLens at **https://partner.microsoft.com/dashboard/microsoftedge/overview**.
Publishing on Edge Add-ons is free (no developer fee).

## Account (one-time)

| Field                  | Value                            |
| ---------------------- | -------------------------------- |
| Account type           | Individual                       |
| Publisher display name | Zayr Habeeb                      |
| Contact                | Your own Microsoft account email |

## Package

| Field          | Value                                                                                  |
| -------------- | -------------------------------------------------------------------------------------- |
| File to upload | `fedlens-edge-v1.0.1.zip` (from `release/` or the GitHub Release; do **not** unzip it) |

## Availability

| Field      | Value                    |
| ---------- | ------------------------ |
| Visibility | Public                   |
| Markets    | All markets (select all) |

## Properties

| Field                                                          | Value                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| Category                                                       | Productivity                                               |
| Does your extension access, collect or transmit personal info? | **No**                                                     |
| Privacy policy URL                                             | https://github.com/zayrhabeeb/FedLens/blob/main/PRIVACY.md |
| Website URL                                                    | https://github.com/zayrhabeeb/FedLens                      |
| Support contact details                                        | https://github.com/zayrhabeeb/FedLens/issues               |
| Mature content                                                 | No                                                         |

## Store listing — English (United States)

**Display name** (comes from the package): FedLens

**Short description** (from the manifest, 127 chars):

> Global macro intelligence: indicators, news radar, events, policy forecasts and comparisons for 12 economies. Free and keyless.

**Description** (paste as-is):

```
FedLens is a free, open-source research companion for global macroeconomics. Open it in Edge's sidebar and get live indicators, a scored news radar, detected macro events, calibrated central-bank policy forecasts and side-by-side country comparisons for 12 economies: the United States, Euro Area, United Kingdom, Japan, China, India, Brazil, Canada, Australia, South Korea, Mexico and South Africa.

No account. No API keys. No subscription. No tracking.

WHAT YOU GET
• Country Dashboard — GDP growth, inflation, policy rate, unemployment, exchange rate and trade balance with changes vs the prior period, a 0–100 Policy Risk Score broken into its drivers, and a news-intensity meter that flags spikes.
• News Radar — central-bank releases and economic headlines tagged by country, topic and sentiment, with key figures and institutions extracted. Every outlet carries a credibility tier, and unverified sources never influence a score.
• Article Analyzer — analyze the article in your current tab: highlighted figures and institutions, claim confidence (exact figure vs implied vs opinion), rule-based implications, and historical parallels drawn from real data.
• Event Timeline — rate decisions, inflation prints, GDP releases, fiscal and trade actions, currency shocks and more, with speculative and opinion headlines filtered out.
• Central Bank Documents — upload a PDF or paste a statement to get its hawkish/dovish stance, forward guidance, dissent and a phrase-by-phrase comparison with the previous statement. Documents are processed entirely on your device.
• Policy Forecast Lab — the probability that a central bank tightens or eases over the next ~3 months, built from seven transparent inputs, calibrated on 25 years of history and shown next to its own out-of-sample backtest.
• Compare — up to four economies side by side, with a divergence detector and CSV export.
• Country Brief — a one-page research brief you can export as Markdown or save as PDF.

TRANSPARENT BY DESIGN
FedLens is deterministic-first: every number, label and score comes from clear rules applied to public data, and every forecast shows its inputs and track record. Optional AI rewording (an on-device model, or your own local endpoint) is off by default and can never add facts.

DATA SOURCES
Bank for International Settlements, World Bank, European Central Bank, FRED (Federal Reserve Bank of St. Louis), U.S. Treasury, U.S. Bureau of Labor Statistics, official central-bank feeds and public news headlines that link to the original publishers.

PRIVACY
FedLens has no server and collects nothing. Your settings, documents and cache stay in your browser.

Open source under the MIT License: https://github.com/zayrhabeeb/FedLens

Not financial advice. Data comes from third-party public sources and may be incomplete or delayed; forecasts are statistical estimates for research and education.
```

**Search terms** (7 max, each ≤ 30 characters):

1. macroeconomics
2. central bank
3. inflation
4. interest rates
5. economic news
6. federal reserve
7. economic data

**Images** (all in this folder):

| Slot                               | File                         |
| ---------------------------------- | ---------------------------- |
| Extension logo (300×300, required) | `logo-300.png`               |
| Small promotional tile (440×280)   | `promo-small-440x280.png`    |
| Large promotional tile (1400×560)  | `promo-large-1400x560.png`   |
| Screenshot 1 (1280×800)            | `screenshot-1-dashboard.png` |
| Screenshot 2 (1280×800)            | `screenshot-2-news.png`      |
| Screenshot 3 (1280×800)            | `screenshot-3-forecast.png`  |
| Screenshot 4 (1280×800)            | `screenshot-4-compare.png`   |

YouTube video URL: leave empty.

## Notes for certification (paste into "Submit" step)

```
FedLens requires no account, login or API key; reviewers can test immediately.

How to test: click the FedLens toolbar icon to open the side panel, accept the one-time "not financial advice" notice, then browse the tabs (Dashboard, News, Events, Docs, Forecast, Compare, Brief, Settings).

Permissions:
- storage / unlimitedStorage: cache public data snapshots, a 30-day headline archive and user-analyzed documents locally.
- sidePanel: show the app in the Edge sidebar.
- activeTab + scripting: read the current tab's text only when the user clicks "Analyze current tab".
- Host access to raw.githubusercontent.com (public data snapshots from the open-source repository) and official central-bank / Google News RSS hosts (headlines).
- Optional host permissions are requested at runtime only if the user analyzes a page without the activeTab grant or configures their own local model endpoint.

'wasm-unsafe-eval' in the CSP is used only by the optional, off-by-default on-device text model (ONNX Runtime WebAssembly bundled in the package). No remote code is loaded. Source code: https://github.com/zayrhabeeb/FedLens
```
