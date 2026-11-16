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

export async function prepareModel(modelUrl) {
  await loadEngine();
  const model = new window.Vosk.Model(modelUrl.href, -1);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => fail(), 120_000);
      function fail() {
        clearTimeout(timer);
        reject(new Error('No s’ha pogut carregar el model.'));
      }
      model.addEventListener('error', fail, { once: true });
      model.on('load', message => {
        clearTimeout(timer);
        model.removeEventListener('error', fail);
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

export async function startCapture(model, limit, { onStopped, onRecognition }) {
  const context = new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' });
  let stream;
  try {
    await context.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    await context.audioWorklet.addModule(workletUrl.href);
    return capture(context, stream, model, limit, onStopped, onRecognition);
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    await context.close().catch(() => {});
    throw error;
  }
}

function capture(context, stream, model, limit, onStopped, onRecognition) {
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
  const segments = [];
  let draft = '';
  let pending = 0;
  let duration;
  let inputClosed = false;
  let flushing = false;
  let settled = false;
  let timeout = setTimeout(() => fail('El micròfon ha deixat de respondre.'), (limit + 8) * 1000);

  function closeInput() {
    if (inputClosed) return;
    inputClosed = true;
    microphone.disconnect();
    node.disconnect();
    node.port.close();
    for (const track of stream.getTracks()) track.stop();
    void context.close().catch(() => {});
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
    if (committed) {
      words.push(...(message.result.result ?? []));
      if (message.result.text) segments.push(message.result.text);
    }
    const partial = committed ? '' : (message.result.partial ?? '');
    if (committed || draft !== partial) {
      draft = partial;
      onRecognition({ words, segments, partial, committed });
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
      return;
    }
    duration = data.seconds;
    closeInput();
    clearTimeout(timeout);
    timeout = setTimeout(() => fail('El reconeixement està trigant massa.'), 45_000);
    onStopped();
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
