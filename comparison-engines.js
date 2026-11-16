import { sampleRate } from './comparison-audio.js';

export const engines = [
  { id: 'vosk', name: 'Vosk actual' },
  { id: 'context', name: 'Vosk amb context' },
  { id: 'whisper', name: 'Whisper Tiny Catalan' },
];

// Vosk builds a word graph from these phrases. Leave an unknown-word path
// so speech outside the supplied passage can still be represented.
export function passageGrammar(reference) {
  const phrases = reference.map((_, index) =>
    reference.slice(index, index + 5).map(word => word.key).join(' '));
  return JSON.stringify([...new Set(phrases), '[unk]']);
}

export function transcribeVosk(model, samples, grammar, onProgress, signal) {
  signal.throwIfAborted();
  const recognizer = new model.KaldiRecognizer(sampleRate, grammar);
  return new Promise((resolve, reject) => {
    const segments = [];
    let offset = 0;
    let flushing = false;
    let timeout;
    function dispose() {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      recognizer.remove();
    }
    function fail(error) {
      dispose();
      reject(error);
    }
    function abort() { fail(signal.reason); }
    function send() {
      clearTimeout(timeout);
      timeout = setTimeout(() => fail(new Error('Vosk ha deixat de respondre.')), 45_000);
      if (offset === samples.length) {
        flushing = true;
        recognizer.retrieveFinalResult();
      } else {
        const chunk = samples.subarray(offset, offset + 4096);
        offset += chunk.length;
        recognizer.acceptWaveformFloat(chunk, sampleRate);
      }
    }
    function receive({ result, event }) {
      if (event === 'result' && result.text) segments.push(result.text);
      onProgress(offset / samples.length);
      if (flushing) {
        dispose();
        resolve(segments.join(' '));
      } else {
        send();
      }
    }
    signal.addEventListener('abort', abort, { once: true });
    recognizer.on('result', receive);
    recognizer.on('partialresult', receive);
    recognizer.on('error', () => fail(new Error('S’ha interromput el reconeixement amb Vosk.')));
    send();
  });
}

export function transcribeWhisper(samples, onStatus, signal) {
  signal.throwIfAborted();
  const worker = new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => fail(new Error('Whisper ha trigat més de cinc minuts.')), 300_000);
    function dispose() {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
    }
    function fail(error) {
      dispose();
      reject(error);
    }
    function abort() { fail(signal.reason); }
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = event => {
      console.error(event.message);
      fail(new Error('No s’ha pogut iniciar Whisper en aquest navegador.'));
    };
    worker.onmessage = ({ data }) => {
      if (data.type === 'error') {
        fail(new Error(data.message));
      } else if (data.type === 'result') {
        dispose();
        resolve(data);
      } else {
        onStatus(data.type);
      }
    };
    // Copy before transferring. The original stays available to all engines.
    const audio = samples.slice();
    worker.postMessage(audio, [audio.buffer]);
  });
}
