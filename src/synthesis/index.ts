/**
 * Synthesis entry point. Deterministic-first: the template draft is the
 * default and the fallback for every failure mode of the optional providers.
 */
import type { Settings } from '../data/settings';
import { describeFailure, shield } from './shield';
import type { SynthesisRequest, SynthesisResult } from './types';

export async function synthesize(
  request: SynthesisRequest,
  settings: Pick<Settings, 'synthesis' | 'byok'>,
): Promise<SynthesisResult> {
  if (settings.synthesis === 'template') return { text: request.draft, provider: 'template' };
  try {
    const text =
      settings.synthesis === 'local'
        ? await (await import('./local')).rewriteLocally(request)
        : await (await import('./byok')).rewriteWithByok(request, settings.byok);
    const report = shield(text, request);
    if (!report.passed) {
      return {
        text: request.draft,
        provider: 'template',
        shield: report,
        fellBack: `Shield rejected output (${describeFailure(report)})`,
      };
    }
    return { text, provider: settings.synthesis, shield: report };
  } catch (err) {
    return {
      text: request.draft,
      provider: 'template',
      fellBack: err instanceof Error ? err.message : String(err),
    };
  }
}

export type { SynthesisRequest, SynthesisResult } from './types';
