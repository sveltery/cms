// Ported from EmDash 1.1.0 useContainedMediaSize; MIT notice: notices/emdash-MIT.txt.
export interface MediaSize { width: number; height: number }

export function containedMediaSize(frame: MediaSize | null, source: MediaSize | null): MediaSize | null {
 if (!frame || !source) return null;
 const scale = Math.min(frame.width / source.width, frame.height / source.height);
 return { width: source.width * scale, height: source.height * scale };
}

/** Observe layout dimensions, which remain stable under an ancestor's CSS transform. */
export function observeMediaFrame(frame: HTMLElement, onsize: (size: MediaSize) => void): () => void {
 let current: MediaSize | null = null;
 const update = () => {
  const width = frame.clientWidth, height = frame.clientHeight;
  if (width <= 0 || height <= 0 || (current?.width === width && current.height === height)) return;
  current = { width, height };
  onsize(current);
 };
 update();
 if (typeof ResizeObserver === 'undefined') return () => {};
 const observer = new ResizeObserver(update);
 observer.observe(frame);
 return () => observer.disconnect();
}
