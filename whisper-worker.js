import { env, pipeline } from './vendor/whisper/runtime/transformers.min.js';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = new URL('./vendor/whisper/', import.meta.url).href;
env.useBrowserCache = false;
env.backends.onnx.wasm.wasmPaths = new URL('./vendor/whisper/runtime/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;

self.onmessage = async ({ data: audio }) => {
  try {
    const start = performance.now();
    const transcribe = await pipeline('automatic-speech-recognition', 'whisper-tiny-ca', {
      device: 'wasm',
      dtype: 'q8',
    });
    const ready = performance.now();
    self.postMessage({ type: 'recognizing' });
    const { text } = await transcribe(audio, {
      language: 'ca',
      task: 'transcribe',
      chunk_length_s: 25,
      stride_length_s: 3,
      return_timestamps: true,
    });
    self.postMessage({
      type: 'result',
      transcript: text.trim(),
      load: ready - start,
      elapsed: performance.now() - ready,
    });
  } catch (error) {
    console.error(error);
    self.postMessage({ type: 'error', message: 'Whisper no ha pogut processar l’àudio en aquest navegador.' });
  }
};
