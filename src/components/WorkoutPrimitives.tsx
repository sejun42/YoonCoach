"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { allBodyParts, currentBodyParts, type BodyPartKey } from "@/lib/body-parts";
import type { ExerciseTag } from "@/lib/exercise-catalog";

export function PartTags({ tags }: { tags: readonly BodyPartKey[] }) {
  return <span className="workout-tags">{tags.map((tag) => {
    const part = allBodyParts.find((part) => part.key === tag);
    return part && <span className="workout-tag" key={tag} style={{ "--part-color": part.color } as CSSProperties}>{part.label}</span>;
  })}</span>;
}

export function TagPicker({ tags, onChange }: { tags: ExerciseTag[]; onChange: (tags: ExerciseTag[]) => void }) {
  return <div className="tag-picker" aria-label="운동 부위 태그 (최대 2개)">{currentBodyParts.map((part) => <button type="button" key={part.key} aria-pressed={tags.includes(part.key)}
    disabled={!tags.includes(part.key) && tags.length >= 2} onClick={() => onChange(tags.includes(part.key) ? tags.filter((tag) => tag !== part.key) : [...tags, part.key])}
    style={{ "--part-color": part.color } as CSSProperties}>{part.label}</button>)}</div>;
}

export function WorkoutDialog({ title, onClose, children, variant }: { title: string; onClose: () => void; children: ReactNode; variant?: "exercise-picker" | "set-type" }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const viewport = window.visualViewport;
    // Mobile keyboards can shrink only the visual viewport; dvh and the native
    // dialog's layout-viewport centering do not account for that hidden space.
    const fitViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      dialog.style.setProperty("--dialog-viewport-height", height + "px");
      dialog.style.setProperty("--dialog-viewport-top", (viewport?.offsetTop ?? 0) + "px");
      dialog.dataset.compactViewport = String(height < 520);
    };
    fitViewport();
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);
    window.addEventListener("resize", fitViewport);
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      window.removeEventListener("resize", fitViewport);
      dialog.close(); document.body.style.overflow = previous;
    };
  }, []);
  return <dialog ref={ref} className={"workout-dialog" + (variant ? " " + variant + "-dialog" : "")} aria-label={title} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-content"><div className="section-heading"><h2>{title}</h2><button type="button" className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></div>{children}</div>
  </dialog>;
}
