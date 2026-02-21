"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { GripHorizontal } from "lucide-react";

interface DraggablePanelProps {
  children: ReactNode;
  className?: string;
  defaultPosition?: { x: number; y: number };
}

export function DraggablePanel({
  children,
  className = "",
  defaultPosition,
}: DraggablePanelProps) {
  const [position, setPosition] = useState(defaultPosition ?? { x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      posStart.current = { x: position.x, y: position.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [position],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: posStart.current.x + dx,
        y: posStart.current.y + dy,
      });
    },
    [isDragging],
  );

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      className={className}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? "none" : "transform 0.1s ease-out",
      }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex h-6 cursor-grab items-center justify-center active:cursor-grabbing"
      >
        <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>
      {children}
    </div>
  );
}
