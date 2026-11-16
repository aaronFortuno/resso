export async function prepareWhisper(signal) {
  signal?.throwIfAborted();
  const worker = new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
  let close;

  function request(message, transfer, timeout, operationSignal) {
    operationSignal?.throwIfAborted();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => fail(new Error('Whisper ha deixat de respondre.')), timeout);
      function cleanup() {
        clearTimeout(timer);
        operationSignal?.removeEventListener('abort', abort);
        worker.onmessage = null;
        worker.onerror = null;
        close = undefined;
      }
      function fail(error) {
        cleanup();
        reject(error);
      }
      function abort() { fail(operationSignal.reason); }
      close = () => fail(new DOMException('Sessió de Whisper tancada.', 'AbortError'));
      operationSignal?.addEventListener('abort', abort, { once: true });
      worker.onerror = () => fail(new Error('No s’ha pogut iniciar Whisper en aquest navegador.'));
      worker.onmessage = ({ data }) => {
        if (data.type === 'error') fail(new Error(data.message));
        else {
          cleanup();
          resolve(data);
        }
      };
      worker.postMessage(message, transfer);
    });
  }

  try {
    const { load } = await request({ type: 'load' }, [], 120_000, signal);
    return {
      load,
      transcribe(samples, language, wordTimes, operationSignal) {
        const audio = samples.slice();
        return request({ type: 'transcribe', audio, language, wordTimes }, [audio.buffer], 300_000, operationSignal);
      },
      terminate() {
        close?.();
        worker.terminate();
      },
    };
  } catch (error) {
    worker.terminate();
    throw error;
  }
}

export function whisperDecoder(model, sampleRate, limit, locale, { onRecognition, onDone, onError }) {
  const audio = new Float32Array(Math.ceil(sampleRate * limit));
  const words = [];
  let transcript = '';
  let length = 0;
  let covered = 0;
  let processing = false;
  let finishing = false;
  let closed = false;

  async function decode() {
    if (closed || processing) return;
    const step = 4 * sampleRate;
    const context = sampleRate;
    if (!finishing && length - covered < step + context) return;
    if (finishing && length === covered) {
      onDone(words);
      return;
    }
    processing = true;
    const start = Math.max(0, covered - context);
    const end = Math.min(length, start + 25 * sampleRate);
    const final = finishing && end === length;
    const through = final ? end : end - context;
    try {
      const result = await model.transcribe(audio.subarray(start, end), locale, true);
      if (closed) return;
      for (const { text, timestamp } of result.chunks) {
        const from = start + timestamp[0] * sampleRate;
        const to = timestamp[1] === null ? end : Math.min(end, start + timestamp[1] * sampleRate);
        const midpoint = (from + to) / 2;
        const word = text.trim();
        if (word && timestamp[0] !== null && midpoint >= covered && (midpoint < through || final) && to >= from) {
          words.push({ word, start: from / sampleRate, end: to / sampleRate });
          const joinsPrevious = !/^\s/.test(text) && /^[-’'.,!?…:;]/.test(word);
          transcript += (transcript && !joinsPrevious ? ' ' : '') + word;
        }
      }
      covered = through;
      onRecognition({ words, transcript, partial: '', committed: true, through: covered / sampleRate });
    } catch (error) {
      if (!closed) onError(error);
    } finally {
      processing = false;
    }
    void decode();
  }

  return {
    accept(chunk) {
      audio.set(chunk, length);
      length += chunk.length;
      void decode();
    },
    finish() {
      finishing = true;
      void decode();
    },
    close() { closed = true; },
  };
}
