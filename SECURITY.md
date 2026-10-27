# Security Policy

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead: go to the repository's **Security** tab → **Report a vulnerability**. You should get a response within 7 days.

Useful details: affected version, browser, steps to reproduce, and impact.

## Security design

- **No backend and no accounts.** There is no server to breach and no user data collected.
- **No secrets in the repo or the extension.** Optional API keys for the data pipeline live only in GitHub Actions secrets and are redacted from logs. A gitleaks scan runs in CI on every push and pull request.
- **No remote code.** All scripts, fonts and WASM are bundled. The extension CSP is `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'` (`wasm-unsafe-eval` is needed only for the optional on-device model).
- **Untrusted input is treated as text.** RSS feeds and analysed pages are parsed with markup stripped and rendered through React (no `dangerouslySetInnerHTML`). PDFs are parsed locally by pdf.js.
- **Minimal permissions.** Broad host access is optional and requested at runtime only when the user asks to analyse a page or configures a custom model endpoint.
- **BYOK keys** (optional) stay in `chrome.storage.local` on the user's device and are sent only to the endpoint the user configured.

## If a secret is ever committed

1. **Revoke/rotate the key at the provider immediately** — assume it is compromised.
2. Remove it from history with [`git filter-repo`](https://github.com/newren/git-filter-repo) (`git filter-repo --replace-text replacements.txt`) or BFG Repo-Cleaner, then force-push all branches and tags.
3. Ask collaborators to re-clone, and contact GitHub Support to purge cached views if the repo was public.
