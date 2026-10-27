"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

const revealWidth = 68;
export default function SwipeSetRow({ number, open, disabled, onOpen, onDelete, children }: {
  number: number; open: boolean; disabled: boolean; onOpen: (open: boolean) => void; onDelete: () => void; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; start: number; offset: number; axis: "pending" | "horizontal" | "vertical" } | null>(null);
  const suppressClick = useRef(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const offset = disabled ? 0 : dragOffset ?? (open ? -revealWidth : 0);
  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.PointerEvent) => { if (!root.current?.contains(event.target as Node)) onOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, onOpen]);

  function finish(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    gesture.current = null;
    if (active.axis === "horizontal") {
      suppressClick.current = true;
      onOpen(cancelled ? open : active.offset < -revealWidth / 2);
    }
    setDragOffset(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <div ref={root} className="swipe-set" data-open={open && !disabled} role="group" tabIndex={disabled ? -1 : 0}
    aria-label={`${number}세트${disabled ? "" : " 삭제 동작"}`} aria-describedby={disabled ? undefined : "set-swipe-help"}
    onPointerDownCapture={() => { suppressClick.current = false; }}
    onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && open) { event.preventDefault(); onOpen(false); root.current?.focus(); }
      if (event.target !== event.currentTarget || disabled) return;
      if (event.key === "ArrowLeft" || event.key === "Delete") { event.preventDefault(); onOpen(true); }
      if (event.key === "ArrowRight") { event.preventDefault(); onOpen(false); }
    }}>
    <button className="swipe-set-delete" type="button" style={{ visibility: offset < 0 ? "visible" : "hidden" }} aria-label={`${number}세트 삭제`} aria-hidden={!open || disabled} tabIndex={open && !disabled ? 0 : -1}
      disabled={disabled} onClick={() => { onOpen(false); onDelete(); }}><Trash2 size={19} /><span>삭제</span></button>
    <div className="set-row" style={{ transform: `translateX(${offset}px)`, transition: dragOffset !== null ? "none" : undefined }}
      onPointerDown={(event) => {
        if (disabled || !event.isPrimary || event.button !== 0) return;
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
        active.offset = Math.max(-revealWidth, Math.min(0, active.start + dx));
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
