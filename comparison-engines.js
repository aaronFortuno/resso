import { sampleRate } from './comparison-audio.js';
import { prepareWhisper } from './whisper.js';

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

export async function transcribeWhisper(samples, onStatus, signal) {
  const model = await prepareWhisper(signal);
  try {
    onStatus('recognizing');
    const result = await model.transcribe(samples, 'ca', false, signal);
    return { ...result, load: model.load };
  } finally {
    model.terminate();
  }
}
