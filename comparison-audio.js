export const sampleRate = 16_000;
export const maxSeconds = 120;
const workletUrl = new URL('./capture-worklet.js', import.meta.url);

export async function recordAudio(onTime, signal) {
  const context = new AudioContext({ sampleRate, latencyHint: 'interactive' });
  let stream, microphone, node;

  function close() {
    if (node) {
      node.port.close();
      node.disconnect();
    }
    microphone?.disconnect();
    stream?.getTracks().forEach(track => track.stop());
    void context.close().catch(() => {});
  }

  try {
    await context.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    signal.throwIfAborted();
    await context.audioWorklet.addModule(workletUrl);
    signal.throwIfAborted();
    microphone = context.createMediaStreamSource(stream);
    node = new AudioWorkletNode(context, 'reading-capture', {
      channelCount: 1,
      channelCountMode: 'explicit',
      processorOptions: { seconds: maxSeconds },
    });

    const storage = new Float32Array(maxSeconds * sampleRate);
    let used = 0;
    const result = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => fail(new Error('El micròfon ha deixat de respondre.')), (maxSeconds + 8) * 1000);
      function finish() {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
        close();
      }
      function fail(error) {
        finish();
        reject(error);
      }
      function abort() { fail(signal.reason); }
      signal.addEventListener('abort', abort, { once: true });
      node.onprocessorerror = () => fail(new Error('No s’ha pogut processar el micròfon.'));
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', () => fail(new Error('S’ha desconnectat el micròfon.')), { once: true });
      }
      node.port.onmessage = ({ data }) => {
        if (data.chunk) {
          storage.set(data.chunk, used);
          used += data.chunk.length;
          onTime(data.seconds);
        } else {
          finish();
          resolve(storage.slice(0, used));
        }
      };
    });
    microphone.connect(node).connect(context.destination);
    return { result, stop: () => node.port.postMessage('finish') };
  } catch (error) {
    close();
    throw error;
  }
}

export async function readAudio(file) {
  if (file.size > 32 * 1024 * 1024) throw new Error('Tria un fitxer d’àudio de fins a 32 MB.');
  // decodeAudioData resamples to the context’s sample rate.
  const context = new OfflineAudioContext(1, sampleRate, sampleRate);
  const audio = await context.decodeAudioData(await file.arrayBuffer());
  if (audio.duration > maxSeconds) throw new Error('Tria un àudio de fins a dos minuts.');
  const samples = new Float32Array(audio.length);
  for (let n = 0; n < audio.numberOfChannels; n++) {
    const channel = audio.getChannelData(n);
    for (let i = 0; i < samples.length; i++) samples[i] += channel[i] / audio.numberOfChannels;
  }
  return samples;
}

export function playAudio(samples, onEnd) {
  const context = new AudioContext({ sampleRate });
  const audio = context.createBuffer(1, samples.length, sampleRate);
  audio.copyToChannel(samples, 0);
  const source = context.createBufferSource();
  source.buffer = audio;
  source.connect(context.destination);
  source.onended = () => {
    void context.close().catch(() => {});
    onEnd();
  };
  source.start();
  return () => source.stop();
}
