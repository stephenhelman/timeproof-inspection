"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ROOF_TAGS, ATTIC_TAGS, ROOF_ZONES, ATTIC_ZONES } from "@/src/lib/damage-tags";

type Section = "roof" | "attic";

interface PhotoRecord {
  id: string;
  photoNumber: number;
  r2Url: string;
  damageTags: string[];
  description: string | null;
  photoSection: string;
  zone: string | null;
}

interface UploadingItem {
  localId: string;
  name: string;
  progress: number;
  error?: string;
}

interface Props {
  inspectionId: string;
  initialData?: Record<string, unknown>;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none ${value ? "bg-brand-blue" : "bg-border"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function EditPanel({
  photo,
  section,
  onClose,
  onUpdate,
}: {
  photo: PhotoRecord;
  section: Section;
  onClose: () => void;
  onUpdate: (updates: Partial<PhotoRecord>) => void;
}) {
  const zones = section === "roof" ? ROOF_ZONES : ATTIC_ZONES;
  const tags = section === "roof" ? ROOF_TAGS : ATTIC_TAGS;

  const [zone, setZone] = useState(photo.zone ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(photo.damageTags);
  const [note, setNote] = useState(photo.description ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/photo/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone: zone || null, damageTags: selectedTags, description: note }),
      });
      onUpdate({ zone: zone || null, damageTags: selectedTags, description: note });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  return (
    <div className="bg-bg-elevated border border-border rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-text-primary text-sm font-semibold">Edit Photo</p>
        <button type="button" onClick={onClose} className="text-text-hint hover:text-text-primary text-lg leading-none">×</button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-text-secondary text-xs font-medium uppercase tracking-wider">Zone</label>
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="bg-bg-input border border-border text-text-primary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-text-accent"
        >
          <option value="">No zone assigned</option>
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">
          {section === "roof" ? "Symptoms visible" : "Root cause indicators"}
        </p>
        <div className="grid grid-cols-2 gap-0.5">
          {tags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-2 min-h-9 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTags.includes(tag.id)}
                onChange={() => toggleTag(tag.id)}
                className="w-4 h-4 rounded accent-brand-blue"
              />
              <span className="text-text-secondary text-sm">{tag.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-text-secondary text-xs font-medium uppercase tracking-wider">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Rep note for this photo…"
          className="bg-bg-input border border-border text-text-primary rounded-xl px-3 py-2 text-sm placeholder:text-text-hint focus:outline-none focus:border-text-accent resize-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 border border-border text-text-secondary rounded-xl min-h-10 text-sm transition-colors hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary rounded-xl min-h-10 text-sm font-semibold transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function PhotoCard({
  photo,
  section,
  selected,
  onToggleSelect,
  editingId,
  onEditOpen,
  onEditClose,
  onUpdate,
  onDelete,
}: {
  photo: PhotoRecord;
  section: Section;
  selected: boolean;
  onToggleSelect: () => void;
  editingId: string | null;
  onEditOpen: () => void;
  onEditClose: () => void;
  onUpdate: (updates: Partial<PhotoRecord>) => void;
  onDelete: () => void;
}) {
  const isEditing = editingId === photo.id;

  return (
    <div className={`bg-bg-surface border rounded-2xl p-3 flex flex-col gap-3 transition-colors ${selected ? "border-brand-blue" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <label className="mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="w-5 h-5 rounded accent-brand-blue"
          />
        </label>

        <div className="flex gap-3 flex-1 min-w-0">
          <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-bg-elevated">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.r2Url} alt={`Photo ${photo.photoNumber}`} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-primary text-sm font-semibold">Photo {photo.photoNumber}</p>
            {photo.zone ? (
              <p className="text-text-accent text-xs mt-0.5">{photo.zone}</p>
            ) : (
              <p className="text-text-hint text-xs mt-0.5 italic">No zone</p>
            )}
            {photo.damageTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {photo.damageTags.map((t) => (
                  <span key={t} className="text-xs bg-bg-elevated border border-border text-text-secondary px-1.5 py-0.5 rounded-md">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={isEditing ? onEditClose : onEditOpen}
            className="text-text-secondary hover:text-text-primary text-xs border border-border rounded-lg px-2 py-1 transition-colors"
          >
            {isEditing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-accent-red hover:text-accent-red-hover text-xs border border-accent-red/30 rounded-lg px-2 py-1 transition-colors"
          >
            Del
          </button>
        </div>
      </div>

      {isEditing && (
        <EditPanel
          photo={photo}
          section={section}
          onClose={onEditClose}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

function BulkBar({
  count,
  section,
  onSetZone,
  onAddTags,
  onDelete,
  onClearSelection,
}: {
  count: number;
  section: Section;
  onSetZone: (zone: string) => void;
  onAddTags: (tags: string[]) => void;
  onDelete: () => void;
  onClearSelection: () => void;
}) {
  const zones = section === "roof" ? ROOF_ZONES : ATTIC_ZONES;
  const tags = section === "roof" ? ROOF_TAGS : ATTIC_TAGS;

  const [zoneOpen, setZoneOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [pendingTags, setPendingTags] = useState<string[]>([]);

  const togglePendingTag = (id: string) => {
    setPendingTags((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  return (
    <div className="bg-brand-navy border border-brand-blue/40 rounded-2xl p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-text-accent text-sm font-semibold">{count} selected</p>
        <button type="button" onClick={onClearSelection} className="text-text-hint hover:text-text-secondary text-xs">Clear</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => { setZoneOpen((v) => !v); setTagsOpen(false); }}
          className="text-sm border border-brand-blue/40 text-text-accent rounded-xl px-3 py-1.5 hover:bg-brand-blue/10 transition-colors"
        >
          Set Zone
        </button>
        <button
          type="button"
          onClick={() => { setTagsOpen((v) => !v); setZoneOpen(false); }}
          className="text-sm border border-brand-blue/40 text-text-accent rounded-xl px-3 py-1.5 hover:bg-brand-blue/10 transition-colors"
        >
          Add Tags
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-sm border border-accent-red/40 text-accent-red rounded-xl px-3 py-1.5 hover:bg-accent-red/10 transition-colors"
        >
          Delete
        </button>
      </div>

      {zoneOpen && (
        <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border">
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => { onSetZone(z); setZoneOpen(false); }}
              className="text-xs text-left text-text-secondary hover:text-text-primary border border-border rounded-lg px-2 py-1.5 hover:border-border-hover transition-colors"
            >
              {z}
            </button>
          ))}
        </div>
      )}

      {tagsOpen && (
        <div className="flex flex-col gap-2 pt-1 border-t border-border">
          <div className="grid grid-cols-2 gap-0.5">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 min-h-8 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pendingTags.includes(tag.id)}
                  onChange={() => togglePendingTag(tag.id)}
                  className="w-4 h-4 rounded accent-brand-blue"
                />
                <span className="text-text-secondary text-xs">{tag.label}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { onAddTags(pendingTags); setPendingTags([]); setTagsOpen(false); }}
            disabled={pendingTags.length === 0}
            className="self-start text-xs bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary rounded-lg px-3 py-1.5 font-semibold transition-colors"
          >
            Apply Tags ({pendingTags.length})
          </button>
        </div>
      )}
    </div>
  );
}

function GallerySection({
  section,
  photos,
  uploading,
  onUpload,
  onUpdate,
  onDelete,
  onBulkSetZone,
  onBulkAddTags,
  onBulkDelete,
}: {
  section: Section;
  photos: PhotoRecord[];
  uploading: UploadingItem[];
  onUpload: (files: FileList) => void;
  onUpdate: (id: string, updates: Partial<PhotoRecord>) => void;
  onDelete: (id: string) => void;
  onBulkSetZone: (ids: string[], zone: string) => void;
  onBulkAddTags: (ids: string[], tags: string[]) => void;
  onBulkDelete: (ids: string[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkSetZone = async (zone: string) => {
    const ids = Array.from(selected);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/photo/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zone }),
        })
      )
    );
    onBulkSetZone(ids, zone);
    clearSelection();
  };

  const handleBulkAddTags = async (tags: string[]) => {
    const ids = Array.from(selected);
    await Promise.all(
      ids.map((id) => {
        const photo = photos.find((p) => p.id === id);
        const merged = [...new Set([...(photo?.damageTags ?? []), ...tags])];
        return fetch(`/api/photo/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ damageTags: merged }),
        }).then(() => onUpdate(id, { damageTags: merged }));
      })
    );
    clearSelection();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} photo(s)?`)) return;
    const ids = Array.from(selected);
    await Promise.all(ids.map((id) => fetch(`/api/photo/${id}`, { method: "DELETE" })));
    onBulkDelete(ids);
    clearSelection();
  };

  const label = section === "roof" ? "Roof" : "Attic";
  const description = section === "roof"
    ? "Photograph all areas of concern. Tag each photo with the symptoms visible."
    : "Document attic conditions. Tag each photo with the root cause indicators observed.";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-text-primary text-lg font-semibold">{label} Photos</h3>
        <p className="text-text-secondary text-sm mt-0.5">{description}</p>
      </div>

      {/* Upload button */}
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) { onUpload(e.target.files); e.target.value = ""; } }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-bg-elevated border-2 border-dashed border-border hover:border-text-accent text-text-secondary hover:text-text-primary rounded-2xl min-h-14 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          📷 Add {label} Photo{" "}
          <span className="text-text-hint text-xs">(tap to select one or more)</span>
        </button>

        {uploading.map((item) => (
          <div key={item.localId} className="bg-bg-surface border border-border rounded-xl px-4 py-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-text-secondary text-xs truncate max-w-48">{item.name}</p>
              {item.error && <p className="text-accent-red text-xs">{item.error}</p>}
            </div>
            {!item.error && (
              <div className="w-full bg-bg-elevated rounded-full h-1.5">
                <div className="bg-brand-blue h-1.5 rounded-full transition-all duration-200" style={{ width: `${item.progress}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bulk operations bar */}
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          section={section}
          onSetZone={handleBulkSetZone}
          onAddTags={handleBulkAddTags}
          onDelete={handleBulkDelete}
          onClearSelection={clearSelection}
        />
      )}

      {/* Photo grid */}
      <div className="flex flex-col gap-3">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            section={section}
            selected={selected.has(photo.id)}
            onToggleSelect={() => toggleSelect(photo.id)}
            editingId={editingId}
            onEditOpen={() => setEditingId(photo.id)}
            onEditClose={() => setEditingId(null)}
            onUpdate={(updates) => onUpdate(photo.id, updates)}
            onDelete={() => onDelete(photo.id)}
          />
        ))}
      </div>

      {photos.length === 0 && uploading.length === 0 && (
        <p className="text-text-hint text-center py-6 text-sm">
          No {label.toLowerCase()} photos yet. Tap above to add.
        </p>
      )}
    </div>
  );
}

export default function Step0Photos({ inspectionId, initialData }: Props) {
  const [activeTab, setActiveTab] = useState<Section>("roof");
  const [roofPhotos, setRoofPhotos] = useState<PhotoRecord[]>(
    ((initialData?.photos as PhotoRecord[]) || []).filter((p) => p.photoSection === "roof")
  );
  const [atticPhotos, setAtticPhotos] = useState<PhotoRecord[]>(
    ((initialData?.photos as PhotoRecord[]) || []).filter((p) => p.photoSection === "attic")
  );
  const [roofUploading, setRoofUploading] = useState<UploadingItem[]>([]);
  const [atticUploading, setAtticUploading] = useState<UploadingItem[]>([]);

  // Keep photo list fresh after initial render
  useEffect(() => {
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.photos) {
          setRoofPhotos(data.photos.filter((p: PhotoRecord) => p.photoSection === "roof"));
          setAtticPhotos(data.photos.filter((p: PhotoRecord) => p.photoSection === "attic"));
        }
      })
      .catch(() => {});
  }, [inspectionId]);

  const uploadFiles = useCallback(async (files: FileList, section: Section) => {
    const setUploading = section === "roof" ? setRoofUploading : setAtticUploading;
    const setPhotos = section === "roof" ? setRoofPhotos : setAtticPhotos;

    const items: UploadingItem[] = Array.from(files).map((f) => ({
      localId: `${Date.now()}-${f.name}`,
      name: f.name,
      progress: 0,
    }));

    setUploading((prev) => [...prev, ...items]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const item = items[i];

      setUploading((prev) =>
        prev.map((u) => (u.localId === item.localId ? { ...u, progress: 20 } : u))
      );

      const formData = new FormData();
      formData.append("file", file);
      formData.append("inspectionId", inspectionId);
      formData.append("photoSection", section);

      try {
        const res = await fetch("/api/photo/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          setUploading((prev) =>
            prev.map((u) => (u.localId === item.localId ? { ...u, progress: 0, error: err.error ?? "Upload failed" } : u))
          );
          continue;
        }
        const photo = await res.json() as PhotoRecord;
        setPhotos((prev) => [...prev, photo]);
        setUploading((prev) => prev.filter((u) => u.localId !== item.localId));
      } catch {
        setUploading((prev) =>
          prev.map((u) => (u.localId === item.localId ? { ...u, progress: 0, error: "Upload failed" } : u))
        );
      }
    }
  }, [inspectionId]);

  const updatePhoto = useCallback((id: string, section: Section, updates: Partial<PhotoRecord>) => {
    if (section === "roof") {
      setRoofPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    } else {
      setAtticPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    }
  }, []);

  const deletePhoto = useCallback(async (id: string, section: Section) => {
    if (!confirm("Delete this photo?")) return;
    await fetch(`/api/photo/${id}`, { method: "DELETE" });
    if (section === "roof") {
      setRoofPhotos((prev) => prev.filter((p) => p.id !== id));
    } else {
      setAtticPhotos((prev) => prev.filter((p) => p.id !== id));
    }
  }, []);

  const bulkSetZone = (ids: string[], zone: string, section: Section) => {
    if (section === "roof") {
      setRoofPhotos((prev) => prev.map((p) => ids.includes(p.id) ? { ...p, zone } : p));
    } else {
      setAtticPhotos((prev) => prev.map((p) => ids.includes(p.id) ? { ...p, zone } : p));
    }
  };

  const bulkAddTags = (ids: string[], tags: string[], section: Section) => {
    if (section === "roof") {
      setRoofPhotos((prev) =>
        prev.map((p) => ids.includes(p.id) ? { ...p, damageTags: [...new Set([...p.damageTags, ...tags])] } : p)
      );
    } else {
      setAtticPhotos((prev) =>
        prev.map((p) => ids.includes(p.id) ? { ...p, damageTags: [...new Set([...p.damageTags, ...tags])] } : p)
      );
    }
  };

  const bulkDelete = (ids: string[], section: Section) => {
    if (section === "roof") {
      setRoofPhotos((prev) => prev.filter((p) => !ids.includes(p.id)));
    } else {
      setAtticPhotos((prev) => prev.filter((p) => !ids.includes(p.id)));
    }
  };

  const totalPhotos = roofPhotos.length + atticPhotos.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Photos</h2>
        <p className="text-text-secondary text-base mt-1">
          Upload roof and attic photos. Assign zones and tag damage indicators.
        </p>
      </div>

      {totalPhotos > 0 && (
        <div className="bg-bg-elevated border border-border rounded-xl px-4 py-2.5 flex items-center gap-3">
          <span className="text-text-primary text-sm font-semibold">{roofPhotos.length} roof</span>
          <span className="text-text-hint">·</span>
          <span className="text-text-primary text-sm font-semibold">{atticPhotos.length} attic</span>
          <span className="text-text-hint ml-auto text-xs">{totalPhotos} total</span>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex bg-bg-elevated rounded-xl p-1 gap-1">
        {(["roof", "attic"] as Section[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-10 capitalize ${
              activeTab === tab
                ? "bg-brand-blue text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab === "roof" ? `Roof (${roofPhotos.length})` : `Attic (${atticPhotos.length})`}
          </button>
        ))}
      </div>

      {activeTab === "roof" ? (
        <GallerySection
          section="roof"
          photos={roofPhotos}
          uploading={roofUploading}
          onUpload={(files) => uploadFiles(files, "roof")}
          onUpdate={(id, updates) => updatePhoto(id, "roof", updates)}
          onDelete={(id) => deletePhoto(id, "roof")}
          onBulkSetZone={(ids, zone) => bulkSetZone(ids, zone, "roof")}
          onBulkAddTags={(ids, tags) => bulkAddTags(ids, tags, "roof")}
          onBulkDelete={(ids) => bulkDelete(ids, "roof")}
        />
      ) : (
        <GallerySection
          section="attic"
          photos={atticPhotos}
          uploading={atticUploading}
          onUpload={(files) => uploadFiles(files, "attic")}
          onUpdate={(id, updates) => updatePhoto(id, "attic", updates)}
          onDelete={(id) => deletePhoto(id, "attic")}
          onBulkSetZone={(ids, zone) => bulkSetZone(ids, zone, "attic")}
          onBulkAddTags={(ids, tags) => bulkAddTags(ids, tags, "attic")}
          onBulkDelete={(ids) => bulkDelete(ids, "attic")}
        />
      )}
    </div>
  );
}
