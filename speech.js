import { whisperDecoder } from './whisper.js';

const engineUrl = new URL('./vendor/vosk.js', import.meta.url);
const workletUrl = new URL('./capture-worklet.js', import.meta.url);

async function loadEngine() {
  if (window.Vosk) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = engineUrl.href;
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error('No s’ha trobat el motor de veu.'));
    };
    document.head.append(script);
  });
}

export async function prepareModel(modelUrl, signal) {
  await loadEngine();
  signal?.throwIfAborted();
  const model = new window.Vosk.Model(modelUrl.href, -1);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => fail(), 120_000);
      function cleanup() {
        clearTimeout(timer);
        model.removeEventListener('error', fail);
        signal?.removeEventListener('abort', abort);
      }
      function fail() {
        cleanup();
        reject(new Error('No s’ha pogut carregar el model.'));
      }
      function abort() {
        cleanup();
        reject(signal.reason);
      }
      model.addEventListener('error', fail, { once: true });
      signal?.addEventListener('abort', abort, { once: true });
      model.on('load', message => {
        cleanup();
        if (message.result) resolve();
        else fail();
      });
    });
    return model;
  } catch (error) {
    model.terminate();
    throw error;
  }
}

export function startCapture(model, limit, callbacks, { grammar, signal } = {}) {
  return openCapture(limit, callbacks, signal, (sampleRate, events) =>
    voskDecoder(model, sampleRate, grammar, events));
}

export function startWhisperCapture(model, limit, callbacks, { locale, signal }) {
  return openCapture(limit, callbacks, signal, (sampleRate, events) =>
    whisperDecoder(model, sampleRate, limit, locale, events), 180_000);
}

async function openCapture(limit, callbacks, signal, createDecoder, finalTimeout = 45_000) {
  const context = new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' });
  let stream;
  try {
    signal?.throwIfAborted();
    await context.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    signal?.throwIfAborted();
    await context.audioWorklet.addModule(workletUrl.href);
    signal?.throwIfAborted();
    return capture(context, stream, limit, callbacks, signal, createDecoder, finalTimeout);
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    await context.close().catch(() => {});
    throw error;
  }
}

function capture(context, stream, limit, { onStopped, onRecognition, onAudio }, signal, createDecoder, finalTimeout) {
  const node = new AudioWorkletNode(context, 'reading-capture', {
    channelCount: 1,
    channelCountMode: 'explicit',
    processorOptions: { seconds: limit },
  });
  const microphone = context.createMediaStreamSource(stream);

  let resolveResult;
  let rejectResult;
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  let duration;
  let inputClosed = false;
  let settled = false;
  let timeout;
  const decoder = createDecoder(context.sampleRate, {
    onRecognition,
    onError: fail,
    onDone(words) {
      if (settled) return;
      dispose();
      resolveResult({ words, seconds: duration });
    },
  });

  function closeInput(notify) {
    if (inputClosed) return;
    inputClosed = true;
    microphone.disconnect();
    node.disconnect();
    node.port.close();
    for (const track of stream.getTracks()) track.stop();
    const close = () => { void context.close().catch(() => {}); };
    if (notify?.()) {
      const tone = context.createOscillator();
      const envelope = context.createGain();
      const now = context.currentTime;
      tone.frequency.value = 620;
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      tone.connect(envelope).connect(context.destination);
      tone.start(now);
      tone.stop(now + 0.22);
      const closeTimeout = setTimeout(close, 600);
      tone.addEventListener('ended', () => {
        clearTimeout(closeTimeout);
        close();
      }, { once: true });
    } else {
      close();
    }
  }

  function dispose() {
    settled = true;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
    closeInput();
    decoder.close();
  }

  function fail(message) {
    if (settled) return;
    dispose();
    rejectResult(message instanceof Error ? message : new Error(message));
  }

  function abort() {
    fail(signal.reason);
  }

  signal?.addEventListener('abort', abort, { once: true });
  timeout = setTimeout(() => fail('El micròfon ha deixat de respondre.'), (limit + 8) * 1000);
  node.onprocessorerror = () => fail('No s’ha pogut processar el senyal del micròfon.');
  for (const track of stream.getTracks()) {
    track.addEventListener('ended', () => fail('S’ha desconnectat el micròfon.'), { once: true });
  }

  node.port.onmessage = ({ data }) => {
    if (data.chunk) {
      decoder.accept(data.chunk);
      onAudio(data.seconds);
    } else {
      duration = data.seconds;
      closeInput(() => onStopped(duration));
      clearTimeout(timeout);
      timeout = setTimeout(() => fail('El reconeixement està trigant massa.'), finalTimeout);
      decoder.finish();
    }
  };

  // The worklet never writes to its output, so there is no microphone playback.
  microphone.connect(node);
  node.connect(context.destination);
  return {
    result,
    finish() {
      if (!inputClosed) node.port.postMessage('finish');
    },
  };
}

function voskDecoder(model, sampleRate, grammar, { onRecognition, onDone, onError }) {
  const recognizer = new model.KaldiRecognizer(sampleRate, grammar);
  recognizer.setWords(true);
  const words = [];
  let draft = '';
  let pending = 0;
  let finishing = false;
  let flushing = false;
  let closed = false;

  function flush() {
    if (!finishing || pending !== 0 || flushing) return;
    flushing = true;
    recognizer.retrieveFinalResult();
  }
  function onResponse(message) {
    if (closed) return;
    const committed = message.event === 'result';
    if (committed) words.push(...(message.result.result ?? []));
    const partial = committed ? '' : (message.result.partial ?? '');
    if (committed || draft !== partial) {
      draft = partial;
      onRecognition({ words, partial, committed });
    }
    if (flushing) {
      onDone(words);
      return;
    }
    pending--;
    flush();
  }

  recognizer.on('result', onResponse);
  recognizer.on('partialresult', onResponse);
  recognizer.on('error', () => onError('El reconeixement de veu s’ha interromput.'));
  return {
    accept(chunk) {
      pending++;
      recognizer.acceptWaveformFloat(chunk, sampleRate);
    },
    finish() {
      finishing = true;
      flush();
    },
    close() {
      closed = true;
      recognizer.remove();
    },
  };
}
