"use client";

import { useProgress } from "@react-three/drei";

export function CanvasLoader() {
  const { active, progress } = useProgress();
  const percentage = Math.min(100, Math.max(0, Math.round(progress)));

  if (!active || progress === 100) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm">
      <div className="w-52 rounded-xl border border-emerald-100 bg-white px-5 py-4 text-sm text-emerald-900">
        <p role="status" className="flex items-center justify-between gap-4">
          <span>Loading 3D assets</span>
          <span className="tabular-nums">{percentage}%</span>
        </p>
        <div
          role="progressbar"
          aria-label="3D asset loading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          className="mt-3 h-1 overflow-hidden rounded-full bg-emerald-100"
        >
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${percentage}%` }} />
        </div>
      </div>
    </div>
  );
}
