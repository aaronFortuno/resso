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

export async function startCapture(model, limit, callbacks) {
  const context = new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' });
  let stream;
  try {
    await context.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    await context.audioWorklet.addModule(workletUrl.href);
    return capture(context, stream, model, limit, callbacks);
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    await context.close().catch(() => {});
    throw error;
  }
}

function capture(context, stream, model, limit, { onStopped, onRecognition, onAudio }) {
  const node = new AudioWorkletNode(context, 'reading-capture', {
    channelCount: 1,
    channelCountMode: 'explicit',
    processorOptions: { seconds: limit },
  });
  const microphone = context.createMediaStreamSource(stream);
  const recognizer = new model.KaldiRecognizer(context.sampleRate);
  recognizer.setWords(true);

  let resolveResult;
  let rejectResult;
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const words = [];
  let draft = '';
  let pending = 0;
  let duration;
  let inputClosed = false;
  let flushing = false;
  let settled = false;
  let timeout = setTimeout(() => fail('El micròfon ha deixat de respondre.'), (limit + 8) * 1000);

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
    closeInput();
    recognizer.remove();
  }

  function fail(message) {
    if (settled) return;
    dispose();
    rejectResult(new Error(message));
  }

  function flush() {
    // Every posted chunk produces one response. Only then request the final result.
    if (duration === undefined || pending !== 0 || flushing) return;
    flushing = true;
    recognizer.retrieveFinalResult();
  }

  function onResponse(message) {
    if (settled) return;
    const committed = message.event === 'result';
    if (committed) words.push(...(message.result.result ?? []));
    const partial = committed ? '' : (message.result.partial ?? '');
    if (committed || draft !== partial) {
      draft = partial;
      onRecognition({ words, partial, committed });
    }
    if (flushing) {
      dispose();
      resolveResult({ words, seconds: duration });
      return;
    }
    pending--;
    flush();
  }

  recognizer.on('result', onResponse);
  recognizer.on('partialresult', onResponse);
  recognizer.on('error', () => fail('El reconeixement de veu s’ha interromput.'));
  node.onprocessorerror = () => fail('No s’ha pogut processar el senyal del micròfon.');
  for (const track of stream.getTracks()) {
    track.addEventListener('ended', () => fail('S’ha desconnectat el micròfon.'), { once: true });
  }

  node.port.onmessage = ({ data }) => {
    if (data.chunk) {
      pending++;
      recognizer.acceptWaveformFloat(data.chunk, context.sampleRate);
      onAudio(data.seconds);
      return;
    }
    duration = data.seconds;
    closeInput(() => onStopped(duration));
    clearTimeout(timeout);
    timeout = setTimeout(() => fail('El reconeixement està trigant massa.'), 45_000);
    flush();
  };

  // The worklet never writes to its output, so there is no microphone playback.
  microphone.connect(node);
  node.connect(context.destination);
  return {
    result,
    finish() {
      if (!inputClosed) node.port.postMessage('finish');
    },
    cancel() {
      fail('S’ha interromput la lectura.');
    },
  };
}
