/**
 * Runtime configuration. The only thing a fork needs to change is
 * SNAPSHOT_BASE_URL, so the extension reads data published by *your* repo's
 * scheduled workflow (see docs in README → "Data snapshots").
 */
export const SNAPSHOT_BASE_URL = 'https://raw.githubusercontent.com/zayrhabeeb/FedLens/main/data';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Cache lifetimes. Upstream data changes at most daily; feeds a few times an hour. */
export const TTL = {
  indicators: 6 * HOUR,
  newsSnapshot: 1 * HOUR,
  feed: 30 * MINUTE,
} as const;

/** Never request the same host more often than this, even on manual refresh. */
export const MIN_HOST_INTERVAL_MS = 1500;

/** How long processed articles are kept locally to build intensity history. */
export const NEWS_ARCHIVE_DAYS = 30;
export const NEWS_ARCHIVE_CAP = 2000;
