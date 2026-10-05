import { useEffect, useRef } from 'react';

/** Scrolling, mirrored level bars driven by an AnalyserNode. Flattens to a calm line when `analyser` is null. */
export default function Waveform({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<number[]>([]);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d');
    if (!context) return;
    const data = analyser ? new Uint8Array(analyser.fftSize) : null;
    const BAR = 3, GAP = 3;
    let raf = 0, last = 0;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const columns = Math.floor(width / (BAR + GAP));
      if (time - last > 45) {
        last = time;
        let level = 0;
        if (analyser && data) {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const value of data) sum += ((value - 128) / 128) ** 2;
          level = Math.min(1, Math.sqrt(sum / data.length) * 5);
        }
        history.current.push(level);
        if (history.current.length > columns) history.current.splice(0, history.current.length - columns);
      }
      context.clearRect(0, 0, width, height);
      context.fillStyle = getComputedStyle(canvas).color;
      const offset = columns - history.current.length;
      history.current.forEach((level, i) => {
        const barHeight = Math.max(3, level * height * 0.95);
        context.globalAlpha = 0.35 + 0.65 * ((offset + i) / columns); // older bars fade out
        context.beginPath();
        context.roundRect((offset + i) * (BAR + GAP), (height - barHeight) / 2, BAR, barHeight, BAR / 2);
        context.fill();
      });
      context.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); observer?.disconnect(); };
  }, [analyser]);
  return <canvas ref={canvasRef} className="meeting-waveform" aria-hidden="true" />;
}
