import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** A size in pixels that is remembered across reloads. */
export function useStoredSize(key: string, fallback: number): [number, (size: number) => void] {
  const [size, setSize] = useState(() => Number(localStorage.getItem(key)) || fallback);
  useEffect(() => localStorage.setItem(key, String(Math.round(size))), [key, size]);
  return [size, setSize];
}

interface Props {
  /** "vertical" is a vertical line dragged sideways; "horizontal" is dragged up and down. */
  orientation: 'vertical' | 'horizontal';
  size: number;
  min: number;
  /** Space to leave for the other side. */
  reserve: number;
  onResize: (size: number) => void;
}

/** The draggable line between the editor and the calendar. */
export function Splitter({ orientation, size, min, reserve, onResize }: Props) {
  const start = useRef<{ pointer: number; size: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const vertical = orientation === 'vertical';

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const parent = e.currentTarget.parentElement?.getBoundingClientRect();
    start.current = {
      pointer: vertical ? e.clientX : e.clientY,
      size,
      total: (vertical ? parent?.width : parent?.height) ?? window.innerWidth,
    };
    setDragging(true);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const delta = (vertical ? e.clientX : e.clientY) - start.current.pointer;
    const max = Math.max(start.current.total - reserve, min);
    onResize(Math.min(Math.max(start.current.size + delta, min), max));
  };
  const up = () => {
    start.current = null;
    setDragging(false);
  };

  return (
    <div
      className={`splitter ${orientation} ${dragging ? 'dragging' : ''}`}
      role="separator"
      aria-orientation={orientation}
      title="Drag to resize"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    />
  );
}
