import { env, pipeline } from './vendor/whisper/runtime/transformers.min.js';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = new URL('./vendor/whisper/', import.meta.url).href;
env.useBrowserCache = false;
env.backends.onnx.wasm.wasmPaths = new URL('./vendor/whisper/runtime/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;

let transcribe;
self.onmessage = async ({ data }) => {
  try {
    const start = performance.now();
    if (data.type === 'load') {
      transcribe = await pipeline('automatic-speech-recognition', 'whisper-tiny-ca-timing', {
        device: 'wasm',
        dtype: 'q8',
      });
      self.postMessage({ type: 'ready', load: performance.now() - start });
      return;
    }
    const { text, chunks } = await transcribe(data.audio, {
      language: data.language,
      task: 'transcribe',
      chunk_length_s: 25,
      stride_length_s: 3,
      return_timestamps: data.wordTimes ? 'word' : true,
    });
    self.postMessage({
      type: 'result',
      transcript: text.trim(),
      chunks,
      elapsed: performance.now() - start,
    });
  } catch (error) {
    console.error(error);
    self.postMessage({ type: 'error', message: 'Whisper no ha pogut processar l’àudio en aquest navegador.' });
  }
};
