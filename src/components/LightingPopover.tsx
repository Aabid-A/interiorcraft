"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sun } from "lucide-react";
import { ENVIRONMENT_PRESETS, useRoomStore, type EnvironmentPreset } from "@/store/useRoomStore";

export function LightingPopover() {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstControlRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const ambientLight = useRoomStore((state) => state.ambientLight);
  const exposure = useRoomStore((state) => state.exposure);
  const environmentPreset = useRoomStore((state) => state.environmentPreset);
  const setAmbientLight = useRoomStore((state) => state.setAmbientLight);
  const setExposure = useRoomStore((state) => state.setExposure);
  const setEnvironmentPreset = useRoomStore((state) => state.setEnvironmentPreset);
  const isOpen = position !== null;

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const maxRight = Math.max(16, window.innerWidth - 256 - 16);
      setPosition({ top: rect.bottom + 8, right: Math.min(maxRight, Math.max(16, window.innerWidth - rect.right)) });
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    firstControlRef.current?.focus();

    function isOutside(target: EventTarget | null) {
      return target instanceof Node && !panelRef.current?.contains(target) && !triggerRef.current?.contains(target);
    }
    function dismissOutside(event: PointerEvent | FocusEvent) {
      if (isOutside(event.target)) setPosition(null);
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      setPosition(null);
      triggerRef.current?.focus();
    }
    window.addEventListener("resize", updatePosition);
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Lighting and environment"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-panel` : undefined}
        title="Lighting and environment"
        onClick={() => isOpen ? setPosition(null) : updatePosition()}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-stone-600 hover:bg-white hover:text-stone-900 aria-expanded:bg-emerald-50 aria-expanded:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        <Sun size={18} aria-hidden="true" />
      </button>
      {position && createPortal(
        <div
          ref={panelRef}
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-title`}
          style={position}
          className="fixed z-[60] w-64 max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-4 text-stone-900 shadow-xl backdrop-blur-md"
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            if (event.shiftKey && event.target === firstControlRef.current) {
              event.preventDefault();
              triggerRef.current?.focus();
              setPosition(null);
            } else if (!event.shiftKey && event.target instanceof HTMLSelectElement) {
              event.preventDefault();
              const nextButton = triggerRef.current?.nextElementSibling;
              if (nextButton instanceof HTMLButtonElement) nextButton.focus();
              setPosition(null);
            }
          }}
        >
          <h3 id={`${id}-title`} className="mb-4 text-sm font-semibold">Lighting and environment</h3>
          <div className="space-y-4">
            {[
              { name: "Brightness", key: "brightness", value: ambientLight, min: 0.1, max: 2.5, setValue: setAmbientLight },
              { name: "Exposure", key: "exposure", value: exposure, min: 0.5, max: 2, setValue: setExposure },
            ].map(({ name, key, value, min, max, setValue }, index) => (
              <div key={key}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <label htmlFor={`${id}-${key}`} className="font-medium">{name}</label>
                  <output htmlFor={`${id}-${key}`} className="text-emerald-700 tabular-nums">{value.toFixed(1)}</output>
                </div>
                <input
                  ref={index === 0 ? firstControlRef : undefined}
                  id={`${id}-${key}`}
                  type="range"
                  min={min}
                  max={max}
                  step={0.1}
                  value={value}
                  aria-valuetext={value.toFixed(1)}
                  onChange={(event) => setValue(event.currentTarget.valueAsNumber)}
                  className="mt-1 h-9 w-full cursor-pointer accent-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                />
              </div>
            ))}
            <div>
              <label htmlFor={`${id}-environment`} className="text-sm font-medium">Time of Day / Vibe</label>
              <select
                id={`${id}-environment`}
                value={environmentPreset}
                onChange={(event) => setEnvironmentPreset(event.currentTarget.value as EnvironmentPreset)}
                className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                {ENVIRONMENT_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>{preset.charAt(0).toUpperCase() + preset.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
