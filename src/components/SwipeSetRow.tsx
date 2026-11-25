"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";

const revealWidth = 68;
export type SwipeAction = "insert" | "delete" | null;
export default function SwipeSetRow({ number, open, canDelete, canInsert, onOpen, onInsert, onDelete, children }: {
  number: number; open: SwipeAction; canDelete: boolean; canInsert: boolean; onInsert: () => void; onOpen: (open: SwipeAction) => void; onDelete: () => void; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; start: number; offset: number; axis: "pending" | "horizontal" | "vertical" } | null>(null);
  const suppressClick = useRef(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const offset = dragOffset ?? (open === "delete" && canDelete ? -revealWidth : open === "insert" && canInsert ? revealWidth : 0);
  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.PointerEvent) => { if (!root.current?.contains(event.target as Node)) onOpen(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, onOpen]);

  function finish(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    gesture.current = null;
    if (active.axis === "horizontal") {
      suppressClick.current = true;
      onOpen(cancelled ? open : active.offset < -revealWidth / 2 ? "delete" : active.offset > revealWidth / 2 ? "insert" : null);
    }
    setDragOffset(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <div ref={root} className="swipe-set" data-open={!!open} role="group" tabIndex={0}
    aria-label={`${number}세트 동작`} aria-describedby="set-swipe-help"
    onPointerDownCapture={() => { suppressClick.current = false; }}
    onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && open) { event.preventDefault(); onOpen(null); root.current?.focus(); }
      if (event.target !== event.currentTarget) return;
      if (event.key === "ArrowLeft" || event.key === "Delete") { event.preventDefault(); onOpen(canDelete && open !== "insert" ? "delete" : null); }
      if (event.key === "ArrowRight") { event.preventDefault(); onOpen(canInsert && open !== "delete" ? "insert" : null); }
    }}>
    <button className="swipe-set-insert" type="button" style={{ visibility: offset > 0 ? "visible" : "hidden" }}
      aria-label={number + "세트 아래에 빈 세트 추가"} aria-hidden={open !== "insert"} tabIndex={open === "insert" ? 0 : -1}
      disabled={!canInsert} onClick={() => { onOpen(null); onInsert(); }}><Plus size={19} /><span>추가</span></button>
    <button className="swipe-set-delete" type="button" style={{ visibility: offset < 0 ? "visible" : "hidden" }} aria-label={`${number}세트 삭제`} aria-hidden={open !== "delete"} tabIndex={open === "delete" ? 0 : -1}
      disabled={!canDelete} onClick={() => { onOpen(null); onDelete(); }}><Trash2 size={19} /><span>삭제</span></button>
    <div className="set-row" style={{ transform: `translateX(${offset}px)`, transition: dragOffset !== null ? "none" : undefined }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: offset, offset, axis: "pending" };
      }}
      onPointerMove={(event) => {
        const active = gesture.current;
        if (!active || active.id !== event.pointerId) return;
        const dx = event.clientX - active.x, dy = event.clientY - active.y;
        if (active.axis === "pending" && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
          active.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
          if (active.axis === "horizontal") event.currentTarget.setPointerCapture(event.pointerId);
        }
        if (active.axis !== "horizontal") return;
        event.preventDefault();
        active.offset = Math.max(canDelete && active.start <= 0 ? -revealWidth : 0, Math.min(canInsert && active.start >= 0 ? revealWidth : 0, active.start + dx));
        setDragOffset(active.offset);
      }} onPointerUp={(event) => finish(event)} onPointerCancel={(event) => finish(event, true)} onLostPointerCapture={(event) => {
        // Touch inputs start with implicit capture. Transferring capture to the
        // row emits a bubbling loss from the input; the row still owns the drag.
        if (event.target === event.currentTarget) finish(event, true);
      }}>
      {children}
    </div>
  </div>;
}
