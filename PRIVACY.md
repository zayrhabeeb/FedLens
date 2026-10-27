# Privacy Policy

**Last updated: 26 October 2026**

FedLens does not collect, transmit, sell or share any personal data. There is no FedLens server, no account, no analytics and no tracking.

## What stays on your device

Stored in your browser's extension storage (`chrome.storage.local`) and never sent anywhere by FedLens:

- your settings (selected country, watchlist, synthesis mode);
- cached data snapshots and a 30-day archive of news headlines;
- central-bank documents you choose to analyse (text is processed locally);
- an optional API key for a model endpoint you configure yourself.

Removing the extension deletes all of it.

## Network requests FedLens makes

- Public data snapshots from `raw.githubusercontent.com` (this project's repository).
- Public RSS feeds from central banks and Google News.
- Only if you enable them: model weights from `huggingface.co` (local model), or requests to the model endpoint **you** configure, containing the extracted facts being rephrased.
- Only when you click *Analyze current tab*: the text of that tab is read locally; it is not uploaded.

These third parties receive standard request metadata (such as your IP address) under their own privacy policies. FedLens sends no identifiers or cookies (`credentials: 'omit'`).

## Contact

Questions: open an issue at https://github.com/zayrhabeeb/FedLens/issues.
