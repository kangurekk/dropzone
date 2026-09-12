"use client";

import { useEffect, useRef, useState } from "react";

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine) return;
    setEnabled(true);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;
    let raf: number;
    let hoverTarget: Element | null = null;

    function onMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;

      const el = document.elementFromPoint(mouseX, mouseY);
      const clickable = el
        ? el.closest(
            'button, a, [role="button"], input, select, textarea, [data-cursor="pointer"]'
          )
        : null;
      if (clickable !== hoverTarget) {
        hoverTarget = clickable;
        setHovering(!!clickable);
      }
    }

    function onDown() {
      setPressed(true);
    }
    function onUp() {
      setPressed(false);
    }

    function tick() {
      cursorX += (mouseX - cursorX) * 0.4;
      cursorY += (mouseY - cursorY) * 0.4;
      const el = cursorRef.current;
      if (el) {
        el.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!enabled) return null;

  // The arrow's tip is at SVG coordinates (2, 2).
  // We use that as the anchor point for the hover rings.
  const TIP_X = 2;
  const TIP_Y = 2;

  return (
    <div
      ref={cursorRef}
      className="pointer-events-none fixed left-0 top-0 z-[9999]"
      style={{ willChange: "transform" }}
    >
      {/* HOVER INDICATORS — centered on the arrow tip */}
      {hovering && (
        <>
          {/* Pulsing ripple */}
          {!pressed && (
            <div
              className="pointer-events-none absolute"
              style={{
                top: TIP_Y,
                left: TIP_X,
                width: 10,
                height: 10,
                marginLeft: -5,
                marginTop: -5,
                borderRadius: "50%",
                border: "1.5px solid rgba(167,139,250,0.9)",
                animation:
                  "cursor-ping 1.1s cubic-bezier(0,0,0.2,1) infinite",
              }}
            />
          )}

          {/* Dashed ring */}
          <div
            className="pointer-events-none absolute"
            style={{
              top: TIP_Y,
              left: TIP_X,
              width: 26,
              height: 26,
              marginLeft: -13,
              marginTop: -13,
              borderRadius: "50%",
              border: "1px dashed rgba(167,139,250,0.75)",
              animation: "cursor-spin 4s linear infinite",
              boxShadow: "0 0 12px rgba(139,92,246,0.4)",
            }}
          />
        </>
      )}

      {/* ARROW */}
      <svg
        width="24"
        height="28"
        viewBox="0 0 24 28"
        fill="none"
        style={{
          pointerEvents: "none",
          transform: pressed
            ? "scale(0.85)"
            : hovering
              ? "scale(1.08)"
              : "scale(1)",
          transformOrigin: "4px 4px",
          transition: "transform 90ms ease",
          filter: hovering
            ? "drop-shadow(0 0 10px rgba(139,92,246,1))"
            : "drop-shadow(0 0 3px rgba(139,92,246,0.5))",
        }}
      >
        <path
          d="M2 2 L2 22 L8 17 L13 25 L17 23 L12 15 L20 14 Z"
          stroke={hovering ? "#e9d5ff" : "#a78bfa"}
          strokeWidth={hovering ? 1.8 : 1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={hovering ? "rgba(139,92,246,0.5)" : "rgba(139,92,246,0.12)"}
          style={{ transition: "fill 120ms ease, stroke 120ms ease" }}
        />
      </svg>
    </div>
  );
}