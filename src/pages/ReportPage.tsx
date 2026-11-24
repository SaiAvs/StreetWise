import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, CheckCircle2, ImagePlus, Loader2, MapPin, Sparkles, Trash2, TriangleAlert, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchCategories, uploadEvidence } from '@/lib/data';
import { classifyDescription, MODEL_VERSION } from '@/lib/classifier';
import type { Category } from '@/lib/types';
import MapView from '@/components/MapView';
import { CategoryIcon } from '@/components/CategoryIcon';

const MAX_MB = 5;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export default function ReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [ai, setAi] = useState<ReturnType<typeof classifyDescription> | null>(null);
  const [aiAccepted, setAiAccepted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchCategories().then((cats) => {
      setCategories(cats);
      setCategoryId(cats[0]?.id ?? '');
    }).catch((e) => setError(e.message));
  }, []);

  // AI suggestion updates live from the description (baseline keyword model)
  useEffect(() => {
    if (description.trim().length < 15) {
      setAi(null);
      setAiAccepted(false);
      return;
    }
    const s = classifyDescription(description);
    setAi(s);
    setAiAccepted(false);
  }, [description]);

  const aiCategory = useMemo(() => {
    if (!ai) return null;
    return categories.find((c) => c.slug === ai.slug) ?? null;
  }, [ai, categories]);

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (!ACCEPTED.includes(f.type)) {
        setError('Only JPG, PNG or WebP images are allowed.');
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        setError(`Each image must be under ${MAX_MB} MB.`);
        continue;
      }
      next.push(f);
    }
    const total = [...files, ...next].slice(0, 3);
    setFiles(total);
    setPreviews(total.map((f) => URL.createObjectURL(f)));
  }

  function removeFile(i: number) {
    const total = files.filter((_, idx) => idx !== i);
    setFiles(total);
    setPreviews(total.map((f) => URL.createObjectURL(f)));
  }

  function useAiSuggestion() {
    if (!ai || !aiCategory) return;
    setCategoryId(aiCategory.id);
    setPriority(ai.priority);
    setAiAccepted(true);
  }

  function locateMe() {
    setGeoError(null);
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation is not available. Tap the map to place your report instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setGeoError('Location permission denied. Tap the map to place the pin manually.');
      },
      { timeout: 8000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!coords) {
      setError('Please choose the issue location: use "Locate me" or tap the map.');
      return;
    }
    setBusy(true);
    try {
      const imagePaths: string[] = [];
      for (const f of files) {
        if (user) imagePaths.push(await uploadEvidence(user.id, f));
      }

      const { data, error: insertError } = await supabase
        .from('complaints')
        .insert({
          title: title.trim(),
          description: description.trim(),
          category_id: categoryId,
          priority,
          address: address.trim(),
          latitude: coords[0],
          longitude: coords[1],
          image_urls: imagePaths,
          ai_suggested_category: aiCategory?.id ?? null,
          ai_confidence: ai?.confidence ?? null,
          ai_severity: ai?.severity ?? null,
          ai_analysis: ai?.analysis ?? null,
          ai_metadata: { model_version: MODEL_VERSION, accepted_by_user: aiAccepted },
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      navigate(`/complaints/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the complaint.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-slate-900">Report a civic issue</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Clear reports get resolved faster. You keep final control of every detail.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* AI suggestion */}
        {ai && aiCategory && (
          <div className="card animate-fade-up border-brand-200 bg-brand-50/60 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  AI suggestion: {aiCategory.name}
                  <span className="ml-2 font-normal text-slate-500">
                    {(ai.confidence * 100).toFixed(0)}% confidence · severity {ai.severity}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">{ai.analysis}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Baseline keyword model ({MODEL_VERSION}) — an estimate from your description, not a verified assessment.
                </p>
                {aiAccepted ? (
                  <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Applied to the form
                  </p>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={useAiSuggestion} className="btn-primary px-3 py-1.5 text-xs">
                      Use this category
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card space-y-5 p-6">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Large pothole on Main Street near the school"
              minLength={5}
              maxLength={120}
              required
            />
          </div>
          <div>
            <label className="label">Describe the issue</label>
            <textarea
              className="input min-h-32"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is wrong, how big is it, who does it affect? The AI suggestion appears as you type."
              minLength={10}
              maxLength={4000}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Category</label>
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card space-y-4 p-6">
          <div>
            <label className="label">Photos (up to 3, JPG/PNG/WebP, max {MAX_MB} MB each)</label>
            <div
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onPickFiles(e.dataTransfer.files);
              }}
            >
              <ImagePlus className="h-7 w-7 text-slate-400" />
              <p className="text-sm text-slate-500">Drag photos here</p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => fileInputRef.current?.click()}>
                  <Camera className="h-3.5 w-3.5" /> Browse / capture
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED.join(',')}
                capture="environment"
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </div>
          </div>
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {previews.map((src, i) => (
                <div key={src} className="group relative overflow-hidden rounded-lg border border-slate-200">
                  <img src={src} alt={`Upload preview ${i + 1}`} className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-red-600 shadow"
                    aria-label="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="label mb-0">Location</label>
            <button type="button" onClick={locateMe} className="btn-secondary px-3 py-1.5 text-xs" disabled={locating}>
              {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
              Locate me
            </button>
          </div>
          {geoError && (
            <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <TriangleAlert className="h-3.5 w-3.5" /> {geoError}
            </p>
          )}
          <MapView
            complaints={[]}
            center={coords ?? undefined}
            zoom={coords ? 16 : 12}
            onPick={(lat, lng) => setCoords([lat, lng])}
            className="h-64"
          />
          <input
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address or nearest landmark (helps staff find it)"
          />
          {coords && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Pin placed at {coords[0].toFixed(5)}, {coords[1].toFixed(5)} — tap the map to move it.
            </p>
          )}
        </div>

        {error && (
          <p className="card border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : 'Submit complaint'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
