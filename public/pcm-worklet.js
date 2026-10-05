// Runs in the AudioWorklet thread: downsample mic input to 24kHz PCM16 and post ~100ms chunks.
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 24000;
    this.pos = 0;
    this.out = [];
  }
  process(inputs) {
    const ch = inputs[0][0];
    if (!ch) return true;
    while (this.pos < ch.length) {
      const i = Math.floor(this.pos);
      const s = Math.max(-1, Math.min(1, ch[i]));
      this.out.push(s < 0 ? s * 0x8000 : s * 0x7fff);
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    if (this.out.length >= 2400) {
      const buf = new Int16Array(this.out);
      this.out = [];
      this.port.postMessage(buf.buffer, [buf.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-processor", PcmProcessor);
