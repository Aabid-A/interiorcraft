"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { useRoomStore } from "@/store/useRoomStore";

function download(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function ProjectControls({ captureImage }: { captureImage: (() => string) | null }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);

  function exportLayout() {
    const { placedItems, roomDimensions, wallColor, floorMaterial, exposure, ambientLight, environmentPreset } = useRoomStore.getState();
    const url = URL.createObjectURL(new Blob([JSON.stringify({ placedItems, roomDimensions, wallColor, floorMaterial, exposure, ambientLight, environmentPreset }, null, 2)], { type: "application/json" }));
    download(url, "layout.json");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Layout exported.");
  }

  async function importLayout(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setImporting(true);
    setMessage("");
    try {
      const layout: unknown = JSON.parse(await file.text());
      const error = useRoomStore.getState().importLayout(layout);
      setMessage(error ?? "Layout imported.");
    } catch {
      setMessage("Could not read this layout. Choose a valid JSON file.");
    } finally {
      setImporting(false);
    }
  }

  function downloadImage() {
    if (!captureImage) return;
    try {
      download(captureImage(), "room.png");
      setMessage("Image downloaded.");
    } catch {
      setMessage("Could not capture the room. Try again once the 3D view is ready.");
    }
  }

  return (
    <div className="border-b border-stone-200 bg-stone-50 px-5 py-3 md:px-8">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Project controls">
        <Button variant="outline" onClick={exportLayout}>Export Layout (JSON)</Button>
        <Button variant="outline" disabled={importing} onClick={() => fileInput.current?.click()}>Import Layout (JSON)</Button>
        <Button variant="outline" disabled={!captureImage} onClick={downloadImage}>Download Image (PNG)</Button>
        <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Import layout JSON file" className="hidden" onChange={importLayout} />
      </div>
      <p role="status" className="mt-2 text-xs text-stone-600">{importing ? "Importing layout..." : message || "Save your layout or download the current 3D view."}</p>
    </div>
  );
}
