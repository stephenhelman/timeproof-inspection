"use client";

import { useState, useRef, useEffect } from "react";
import { DAMAGE_GROUPS } from "@/src/lib/findings";
import PhotoReveal from "@/src/components/inspection/PhotoReveal";

interface Photo {
  id: string;
  photoNumber: number;
  driveUrl: string;
  driveFileId: string;
  damageTags: string[];
  description?: string | null;
}

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
  initialData?: Record<string, unknown>;
}

export default function Step4Photos({ inspectionId, initialData }: Props) {
  const [mode, setMode] = useState<"entry" | "present">("entry");
  const [photos, setPhotos] = useState<Photo[]>(
    (initialData?.photos as Photo[]) || []
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [driveFolderUrl, setDriveFolderUrl] = useState<string>(
    (initialData?.driveFolderUrl as string) || ""
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch latest photos on mount
  useEffect(() => {
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((inspection) => {
        if (inspection?.photos) setPhotos(inspection.photos);
        if (inspection?.driveFolderUrl) setDriveFolderUrl(inspection.driveFolderUrl);
      })
      .catch(() => {});
  }, [inspectionId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("inspectionId", inspectionId);

    try {
      setUploadProgress(40);
      const res = await fetch("/api/photo/upload", { method: "POST", body: formData });
      setUploadProgress(80);
      const photo = await res.json();
      if (photo.driveFolderUrl) setDriveFolderUrl(photo.driveFolderUrl);
      setPhotos((prev) => [...prev, photo]);
      setUploadProgress(100);
    } catch {
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleTagChange = async (photoId: string, tag: string, checked: boolean) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;
    const newTags = checked
      ? [...photo.damageTags, tag]
      : photo.damageTags.filter((t) => t !== tag);

    // Optimistic update
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, damageTags: newTags } : p))
    );

    const res = await fetch(`/api/photo/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ damageTags: newTags }),
    });
    const { photo: updated } = await res.json();
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, description: updated.description } : p))
    );
  };

  const handleDescriptionChange = async (photoId: string, description: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, description } : p))
    );
    await fetch(`/api/photo/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm("Delete this photo?")) return;
    await fetch(`/api/photo/${photoId}`, { method: "DELETE" });
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const findings: Record<string, boolean> = {};
  photos.forEach((p) => p.damageTags.forEach((t) => (findings[t] = true)));

  if (mode === "present") {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <button
          onClick={() => setMode("entry")}
          className="fixed top-4 left-4 z-50 bg-bg-surface text-text-primary px-4 py-2 rounded-xl border border-border text-sm"
        >
          ← Back to Data Entry
        </button>
        <PhotoReveal
          mode="presentation"
          photos={photos}
          findings={findings}
          address={(initialData?.customer as Record<string, string>)?.address || ""}
          repName={(initialData?.repName as string) || ""}
          customerName={(initialData?.customer as Record<string, string>)?.name || ""}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Photos</h2>
        <p className="text-text-secondary text-base mt-1">Capture roof damage documentation.</p>
      </div>

      {/* Mode toggle */}
      <div className="flex bg-bg-elevated rounded-xl p-1 gap-1">
        <button
          onClick={() => setMode("entry")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-10 ${
            mode === "entry" ? "bg-brand-blue text-text-primary" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          📋 Data Entry
        </button>
        <button
          onClick={() => setMode("present")}
          className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-10 text-text-secondary hover:text-text-primary"
        >
          🔍 Present to Customer
        </button>
      </div>

      {/* Upload */}
      <div className="flex flex-col items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full bg-bg-elevated border-2 border-dashed border-border hover:border-text-accent text-text-secondary hover:text-text-primary rounded-2xl min-h-16 text-base font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
        >
          📷 {uploading ? "Uploading..." : "Add Photo"}
        </button>
        {uploading && (
          <div className="w-full bg-bg-elevated rounded-full h-2">
            <div
              className="bg-brand-blue h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {driveFolderUrl && (
        <a
          href={driveFolderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-accent hover:text-text-primary text-sm flex items-center gap-2"
        >
          📁 View Drive Folder →
        </a>
      )}

      {/* Photo list */}
      <div className="flex flex-col gap-4">
        {photos.map((photo) => (
          <div key={photo.id} className="bg-bg-surface border border-border rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-bg-elevated">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.driveUrl}
                  alt={`Photo ${photo.photoNumber}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary font-semibold text-base">Photo {photo.photoNumber}</p>
                <p className="text-text-secondary text-sm mt-1">What does this photo show?</p>
              </div>
            </div>

            {/* Damage checkboxes */}
            <div className="flex flex-col gap-3">
              {DAMAGE_GROUPS.map((group) => (
                <div key={group.group}>
                  <p className="text-text-hint text-xs uppercase tracking-wider mb-1">{group.group}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5">
                    {group.items.map((item) => (
                      <label key={item.key} className="flex items-center gap-2 min-h-9 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={photo.damageTags.includes(item.key)}
                          onChange={(e) => handleTagChange(photo.id, item.key, e.target.checked)}
                          className="w-4 h-4 rounded accent-brand-blue"
                        />
                        <span className="text-text-secondary text-sm">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm">Description (auto-generated, editable)</label>
              <textarea
                value={photo.description || ""}
                onChange={(e) => handleDescriptionChange(photo.id, e.target.value)}
                rows={2}
                className="bg-bg-input border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 resize-none transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => handleDelete(photo.id)}
              className="self-start text-brand-red hover:text-accent-red-hover text-sm flex items-center gap-1.5 min-h-9"
            >
              🗑 Delete
            </button>
          </div>
        ))}
      </div>

      {photos.length === 0 && !uploading && (
        <p className="text-text-hint text-center py-8">No photos yet. Tap &quot;Add Photo&quot; to get started.</p>
      )}
    </div>
  );
}
