class GeminiPCMCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = new Float32Array(0);
    this.cursor = 0;
    this.chunk = new Int16Array(1600);
    this.chunkOffset = 0;
    this.ratio = sampleRate / 16000;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0];
    if (output) output.forEach((channel) => channel.fill(0));
    if (!input?.length) return true;

    const merged = new Float32Array(this.pending.length + input.length);
    merged.set(this.pending);
    merged.set(input, this.pending.length);

    while (this.cursor + 1 < merged.length) {
      const start = Math.floor(this.cursor);
      const fraction = this.cursor - start;
      const sample = merged[start] * (1 - fraction) + merged[start + 1] * fraction;
      const clipped = Math.max(-1, Math.min(1, sample));
      this.chunk[this.chunkOffset++] = clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff;
      this.cursor += this.ratio;

      if (this.chunkOffset === this.chunk.length) {
        const ready = this.chunk.buffer;
        this.port.postMessage(ready, [ready]);
        this.chunk = new Int16Array(1600);
        this.chunkOffset = 0;
      }
    }

    const consumed = Math.min(Math.floor(this.cursor), merged.length - 1);
    this.pending = merged.slice(consumed);
    this.cursor -= consumed;
    return true;
  }
}

registerProcessor("gemini-pcm-capture", GeminiPCMCapture);
