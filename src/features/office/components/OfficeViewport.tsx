import { LocateFixed, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode, type WheelEvent } from "react";
import { OFFICE_SCENE_HEIGHT, OFFICE_SCENE_WIDTH } from "../officeLayout";

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.8;

export function OfficeViewport({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const initialized = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState({ x: 28, y: 28 });

  const fitToViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const nextZoom = clamp(Math.min((rect.width - 48) / OFFICE_SCENE_WIDTH, (rect.height - 48) / OFFICE_SCENE_HEIGHT), MIN_ZOOM, 1);
    setZoom(nextZoom);
    setPan({ x: Math.round((rect.width - OFFICE_SCENE_WIDTH * nextZoom) / 2), y: Math.round((rect.height - OFFICE_SCENE_HEIGHT * nextZoom) / 2) });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (initialized.current) return;
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      const initialZoom = clamp(Math.min(width / 1500, height / OFFICE_SCENE_HEIGHT) * 0.94, MIN_ZOOM, 0.9);
      setZoom(initialZoom);
      setPan({ x: 28, y: Math.max(20, Math.round((height - OFFICE_SCENE_HEIGHT * initialZoom) / 2)) });
      initialized.current = true;
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-office-interactive]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  }, [pan.x, pan.y]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y });
  }, []);

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const onWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const nextZoom = clamp(zoom * Math.exp(-event.deltaY * 0.0012), MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === zoom) return;
    const worldX = (pointerX - pan.x) / zoom;
    const worldY = (pointerY - pan.y) / zoom;
    setZoom(nextZoom);
    setPan({ x: pointerX - worldX * nextZoom, y: pointerY - worldY * nextZoom });
  }, [pan.x, pan.y, zoom]);

  return (
    <div
      ref={viewportRef}
      className={`officeViewport ${dragging ? "isDragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
    >
      <div className="officeViewportToolbar" data-office-interactive>
        <button onClick={() => setZoom((value) => clamp(value - 0.1, MIN_ZOOM, MAX_ZOOM))} title="Zoom out" type="button"><Minus /></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((value) => clamp(value + 0.1, MIN_ZOOM, MAX_ZOOM))} title="Zoom in" type="button"><Plus /></button>
        <button onClick={fitToViewport} title="Fit office to window" type="button"><LocateFixed /></button>
      </div>
      <div className="officeViewportHint">Drag to explore · scroll to zoom</div>
      <div
        className="officeWorldTransform"
        style={{ width: OFFICE_SCENE_WIDTH, height: OFFICE_SCENE_HEIGHT, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {children}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
