"use client";

import { useState, useRef, useEffect } from "react";
import { ROOF_TAGS } from "@/src/lib/damage-tags";

const CITY_AREA_OPTIONS = [
  "East El Paso",
  "Northeast El Paso",
  "Central El Paso",
  "West El Paso",
  "Horizon City / Socorro",
  "Las Cruces, NM",
  "Alamogordo, NM",
  "Other",
];

export default function Step2RoofPhotos({ inspectionId, initialData }) {
  const [photos, setPhotos] = useState(
    (initialData?.photos || []).filter((p) => p.photoSection === "roof")
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.photos) {
          setPhotos(data.photos.filter((p) => p.photoSection === "roof"));
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
    formData.append("photoSection", "roof");

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

  const handleGalleryToggle = async (photoId, enabled) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, galleryEligible: enabled, cityArea: enabled ? p.cityArea : null } : p))
    );
    await fetch(`/api/photo/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ galleryEligible: enabled, cityArea: enabled ? photos.find((p) => p.id === photoId)?.cityArea : null }),
    });
  };

  const handleCityAreaChange = async (photoId, area) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, cityArea: area } : p))
    );
    await fetch(`/api/photo/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityArea: area }),
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
        <h2 className="text-text-primary text-2xl font-semibold">Roof Inspection Photos</h2>
        <p className="text-text-secondary text-base mt-1">
          Photograph all areas of concern. Tag each photo with the symptoms visible.
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
          📷 {uploading ? "Uploading..." : "Add Roof Photo"}
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
                  alt={`Roof photo ${photo.photoNumber}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary font-semibold text-base">Photo {photo.photoNumber}</p>
                <p className="text-text-secondary text-sm mt-1">Roof</p>
              </div>
            </div>

            <div>
              <p className="text-text-hint text-xs uppercase tracking-wider mb-2">Symptoms visible</p>
              <div className="grid grid-cols-2 gap-0.5">
                {ROOF_TAGS.map((tag) => (
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

            {/* Gallery toggle */}
            <div className="border-t border-border pt-3 flex flex-col gap-2">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-text-secondary text-sm">Add to public gallery</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!photo.galleryEligible}
                  onClick={() => handleGalleryToggle(photo.id, !photo.galleryEligible)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                    photo.galleryEligible ? "bg-brand-blue" : "bg-bg-elevated"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      photo.galleryEligible ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
              {photo.galleryEligible && (
                <select
                  value={photo.cityArea || ""}
                  onChange={(e) => handleCityAreaChange(photo.id, e.target.value)}
                  className="w-full bg-bg-elevated border border-border text-text-secondary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
                >
                  <option value="">Select city area…</option>
                  {CITY_AREA_OPTIONS.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              )}
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
        <p className="text-text-hint text-center py-8">No roof photos yet. Tap "Add Roof Photo" to get started.</p>
      )}
    </div>
  );
}
