import type { ShieldReport } from './shield';

/**
 * Everything a synthesis provider may use. `draft` is the deterministic
 * template output and is always a complete, correct answer on its own;
 * optional providers may only rephrase it.
 */
export interface SynthesisRequest {
  kind: 'article' | 'forecast' | 'brief' | 'document';
  /** Atomic, already-verified facts ("CPI 3.7% vs 2% target"). */
  facts: string[];
  draft: string;
}

export interface SynthesisResult {
  text: string;
  provider: 'template' | 'local' | 'byok';
  shield?: ShieldReport;
  /** Why an optional provider's output was discarded in favour of the template. */
  fellBack?: string;
}
