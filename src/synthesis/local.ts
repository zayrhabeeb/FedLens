/**
 * Optional, opt-in, fully local synthesis with Transformers.js.
 *
 * Nothing here runs unless the user enables "Local model" in Settings. The
 * library is code-split (dynamic import), the ONNX Runtime WASM binaries are
 * packaged inside the extension (no remote code, MV3-compliant), and only the
 * model *weights* are downloaded from the Hugging Face Hub on first use, then
 * cached by the browser.
 */
// ?url makes Vite package these runtime files with the extension and give us their URLs.
import ortFactoryUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import { rewritePrompt } from './shield';
import type { SynthesisRequest } from './types';

/** Apache-2.0 licensed weights (MIT-compatible); fetched from the Hugging Face Hub on demand. */
export const LOCAL_MODEL_ID = 'Xenova/flan-t5-base';
export const LOCAL_MODEL_SIZE_HINT = '≈ 250 MB, downloaded once';

type Generator = (
  prompt: string,
  options: Record<string, unknown>,
) => Promise<{ generated_text: string }[]>;

export interface ProgressInfo {
  status: string;
  file?: string;
  progress?: number;
}

let generatorPromise: Promise<Generator> | null = null;

export function loadLocalModel(onProgress?: (p: ProgressInfo) => void): Promise<Generator> {
  generatorPromise ??= (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    // Load the runtime from the extension package, never from a CDN.
    env.useWasmCache = false;
    const wasm = env.backends.onnx.wasm!;
    wasm.wasmPaths = {
      mjs: new URL(ortFactoryUrl, location.href).href,
      wasm: new URL(ortWasmUrl, location.href).href,
    };
    wasm.numThreads = 1; // extension pages are not cross-origin isolated
    const generator = await pipeline('text2text-generation', LOCAL_MODEL_ID, {
      dtype: 'q8',
      ...(onProgress ? { progress_callback: onProgress } : {}),
    });
    return generator as unknown as Generator;
  })().catch((err) => {
    generatorPromise = null;
    throw err;
  });
  return generatorPromise;
}

export async function rewriteLocally(request: SynthesisRequest): Promise<string> {
  const generate = await loadLocalModel();
  const [out] = await generate(rewritePrompt(request), { max_new_tokens: 220, do_sample: false });
  return out?.generated_text.trim() ?? '';
}
