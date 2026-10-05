// Served as a plain static file from public/ so it is never inlined into a data: URL.
const workletUrl = `${import.meta.env.BASE_URL}pcm-worklet.js`;

export interface PcmCapture {
  stop(): void;
  /** Level meter for the waveform. Not connected to any output, so nothing is ever played back. */
  analyser: AnalyserNode;
}

/** Turn an existing microphone stream into 24kHz mono PCM16 chunks (~100ms each). */
export async function startPcmCapture(stream: MediaStream, onChunk: (pcm: ArrayBuffer) => void): Promise<PcmCapture> {
  const context = new AudioContext();
  await context.audioWorklet.addModule(workletUrl);
  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, 'pcm-processor');
  node.port.onmessage = event => onChunk(event.data as ArrayBuffer);
  source.connect(node);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  return { analyser, stop() { node.disconnect(); source.disconnect(); void context.close(); } };
}
