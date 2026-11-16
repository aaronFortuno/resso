class ReadingCapture extends AudioWorkletProcessor {
  constructor({ processorOptions }) {
    super();
    this.maximum = processorOptions.seconds * sampleRate;
    this.samples = 0;
    this.buffer = new Float32Array(4096);
    this.used = 0;
    this.finished = false;
    this.port.onmessage = () => this.finish();
  }

  send() {
    if (!this.used) return;
    const chunk = this.used === this.buffer.length ? this.buffer : this.buffer.slice(0, this.used);
    this.port.postMessage({ chunk }, [chunk.buffer]);
    this.buffer = new Float32Array(4096);
    this.used = 0;
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.send();
    this.port.postMessage({ seconds: this.samples / sampleRate });
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (this.finished || !channel) return !this.finished;

    let offset = 0;
    const length = Math.min(channel.length, this.maximum - this.samples);
    while (offset < length) {
      const size = Math.min(length - offset, this.buffer.length - this.used);
      this.buffer.set(channel.subarray(offset, offset + size), this.used);
      this.used += size;
      offset += size;
      if (this.used === this.buffer.length) this.send();
    }
    this.samples += length;
    if (this.samples >= this.maximum) this.finish();
    return !this.finished;
  }
}

registerProcessor('reading-capture', ReadingCapture);
