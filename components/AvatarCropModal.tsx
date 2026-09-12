"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";

type Props = {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (
    blob: Blob,
    area: { x: number; y: number; width: number; height: number }
  ) => void;
  uploading?: boolean;
};

type Area = { x: number; y: number; width: number; height: number };

async function cropToBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const size = 400; // output 400x400
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob"));
      },
      "image/png",
      0.95
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function AvatarCropModal({
  imageSrc,
  onCancel,
  onConfirm,
  uploading,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: any, croppedAreaPixels: Area) => {
    setArea(croppedAreaPixels);
  }, []);

  async function handleConfirm() {
    if (!area) return;
    try {
      const blob = await cropToBlob(imageSrc, area);
      onConfirm(blob, area);
    } catch (err) {
      console.error("Crop failed:", err);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-[480px] overflow-hidden rounded-2xl border border-[#252a38] bg-[#0d1017] shadow-[0_35px_100px_rgba(0,0,0,0.7)]">
        {/* HEADER */}
        <div className="border-b border-[#181c26] px-6 py-4">
          <h3 className="text-[14px] font-bold text-white">Crop avatar</h3>
          <p className="mt-1 text-[10px] text-[#737887]">
            Drag to move · scroll to zoom
          </p>
        </div>

        {/* CROPPER */}
        <div className="relative h-[380px] bg-[#080a10]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="rect"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* ZOOM SLIDER */}
        <div className="flex items-center gap-3 px-6 py-3">
          <span className="text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[#8b5cf6]"
          />
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2 border-t border-[#181c26] p-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="h-[42px] flex-1 rounded-lg border border-[#1b1f2b] bg-[#0e1017] text-[11px] font-extrabold text-[#737887] transition hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!area || uploading}
            className="h-[42px] flex-[2] rounded-lg border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] text-[11px] font-extrabold text-white shadow-[0_10px_30px_rgba(109,63,224,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Save avatar"}
          </button>
        </div>
      </div>
    </div>
  );
}