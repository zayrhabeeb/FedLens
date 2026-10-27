import type { CountryCode } from '../shared/types';
import { store } from './storage';

export type SynthesisMode = 'template' | 'local' | 'byok';

export interface ByokSettings {
  /** OpenAI-compatible base URL, e.g. http://localhost:11434/v1 for Ollama. */
  endpoint: string;
  model: string;
  /** Stored only in chrome.storage.local on this device; never bundled or synced. */
  apiKey: string;
}

export interface Settings {
  synthesis: SynthesisMode;
  byok: ByokSettings;
  watchlist: CountryCode[];
  country: CountryCode;
  disclaimerAccepted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  synthesis: 'template',
  byok: { endpoint: 'http://localhost:11434/v1', model: 'llama3.2', apiKey: '' },
  watchlist: ['US', 'EA'],
  country: 'US',
  disclaimerAccepted: false,
};

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const saved = await store.get<Partial<Settings>>(KEY);
  return { ...DEFAULT_SETTINGS, ...saved, byok: { ...DEFAULT_SETTINGS.byok, ...saved?.byok } };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await store.set(KEY, settings);
}
