import { store } from './storage';
import type { HttpDeps } from './http';

/** Real-world dependencies for the data layer; tests construct their own. */
export const runtimeDeps: HttpDeps = {
  fetch: (...args) => fetch(...args),
  store,
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** URL of a file packaged inside the extension (falls back to the dev server root). */
export function packagedUrl(path: string): string {
  return typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(path) : `/${path}`;
}
