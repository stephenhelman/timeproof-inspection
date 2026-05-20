"use client";

import { useState, useRef, useEffect } from "react";
import { ATTIC_TAGS } from "@/src/lib/damage-tags";

export default function Step3AtticPhotos({ inspectionId, initialData }) {
  const [photos, setPhotos] = useState(
    (initialData?.photos || []).filter((p) => p.photoSection === "attic")
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.photos) {
          setPhotos(data.photos.filter((p) => p.photoSection === "attic"));
        }
      })
      .catch(() => {});
  }, [inspectionId]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("inspectionId", inspectionId);
    formData.append("photoSection", "attic");

    try {
      setUploadProgress(40);
      const res = await fetch("/api/photo/upload", { method: "POST", body: formData });
      setUploadProgress(80);
      const photo = await res.json();
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

  const handleTagChange = async (photoId, tagId, checked) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;
    const newTags = checked
      ? [...photo.damageTags, tagId]
      : photo.damageTags.filter((t) => t !== tagId);

    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, damageTags: newTags } : p))
    );

    await fetch(`/api/photo/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ damageTags: newTags }),
    });
  };

  const handleDelete = async (photoId) => {
    if (!confirm("Delete this photo?")) return;
    await fetch(`/api/photo/${photoId}`, { method: "DELETE" });
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Attic Inspection Photos</h2>
        <p className="text-text-secondary text-base mt-1">
          Document attic conditions. Tag each photo with the root cause indicators observed.
        </p>
      </div>

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
          📷 {uploading ? "Uploading..." : "Add Attic Photo"}
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

      <div className="flex flex-col gap-4">
        {photos.map((photo) => (
          <div key={photo.id} className="bg-bg-surface border border-border rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-bg-elevated">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.r2Url}
                  alt={`Attic photo ${photo.photoNumber}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary font-semibold text-base">Photo {photo.photoNumber}</p>
                <p className="text-text-secondary text-sm mt-1">Attic</p>
              </div>
            </div>

            <div>
              <p className="text-text-hint text-xs uppercase tracking-wider mb-2">Root cause indicators</p>
              <div className="grid grid-cols-2 gap-0.5">
                {ATTIC_TAGS.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 min-h-9 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={photo.damageTags.includes(tag.id)}
                      onChange={(e) => handleTagChange(photo.id, tag.id, e.target.checked)}
                      className="w-4 h-4 rounded accent-brand-blue"
                    />
                    <span className="text-text-secondary text-sm">{tag.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDelete(photo.id)}
              className="self-start text-accent-red hover:text-accent-red-hover text-sm flex items-center gap-1.5 min-h-9"
            >
              🗑 Delete
            </button>
          </div>
        ))}
      </div>

      {photos.length === 0 && !uploading && (
        <p className="text-text-hint text-center py-8">No attic photos yet. Tap "Add Attic Photo" to get started.</p>
      )}
    </div>
  );
}
