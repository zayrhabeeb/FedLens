import { describe, expect, it } from 'vitest';
import { buildManifest } from '../manifest';
import { synthesize } from '.';
import { shield } from './shield';
import type { SynthesisRequest } from './types';

const request: SynthesisRequest = {
  kind: 'forecast',
  facts: ['Economy: Japan', 'P(tighten): 53%'],
  draft: 'For Japan, the model maps to a 53% probability of tightening.',
};

describe('hallucination shield', () => {
  it('accepts faithful paraphrases', () => {
    expect(shield('Japan has roughly a 53% chance of tightening.', request).passed).toBe(true);
  });

  it('rejects new numbers, new economies and advice language', () => {
    expect(shield('Japan has a 75% chance of tightening.', request).unsupportedNumbers).toEqual([
      '75',
    ]);
    expect(shield('Japan and China face a 53% chance.', request).unsupportedCountries).toEqual([
      'China',
    ]);
    expect(shield('At 53%, you should buy yen now.', request).adviceLanguage).toEqual([
      'you should buy',
    ]);
  });
});

describe('synthesize', () => {
  it('returns the deterministic draft in template mode (the default)', async () => {
    const result = await synthesize(request, {
      synthesis: 'template',
      byok: { endpoint: '', model: '', apiKey: '' },
    });
    expect(result).toEqual({ text: request.draft, provider: 'template' });
  });

  it('falls back to the template when an optional provider fails', async () => {
    const result = await synthesize(request, {
      synthesis: 'byok',
      byok: { endpoint: 'http://127.0.0.1:9/v1', model: 'x', apiKey: '' },
    });
    expect(result.provider).toBe('template');
    expect(result.text).toBe(request.draft);
    expect(result.fellBack).toBeTruthy();
  });
});

interface ManifestShape {
  manifest_version: number;
  background: { service_worker?: string; scripts?: string[]; type: string };
  permissions: string[];
  content_security_policy: { extension_pages: string };
  side_panel?: unknown;
  browser_specific_settings: { gecko: { id: string } };
}

describe('manifest', () => {
  it('builds a Chrome MV3 manifest with side panel and service worker', () => {
    const m = buildManifest('chrome', '1.2.3') as unknown as ManifestShape;
    expect(m.manifest_version).toBe(3);
    expect(m.background).toEqual({ service_worker: 'background.js', type: 'module' });
    expect(m.permissions).toContain('sidePanel');
    expect(m.content_security_policy.extension_pages).not.toMatch(/https?:/);
  });

  it('builds a Firefox MV3 manifest with gecko settings and no Chrome-only keys', () => {
    const m = buildManifest('firefox', '1.2.3') as unknown as ManifestShape;
    expect(m.browser_specific_settings.gecko.id).toMatch(/@/);
    expect(m.background.scripts).toEqual(['background.js']);
    expect(m.side_panel).toBeUndefined();
    expect(m.permissions).not.toContain('sidePanel');
  });
});
