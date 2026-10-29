'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const OUT_W = 600;
const OUT_H = 400;
const TARGET_RATIO = OUT_W / OUT_H; // 1.5
const FRAME_W = 540;
const FRAME_H = 360;
const RATIO_TOLERANCE = 0.01;
const MIN_SOURCE_DIM = 300;

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}
function simplifiedRatio(w, h) {
  const d = gcd(Math.round(w), Math.round(h)) || 1;
  return { rw: Math.round(w / d), rh: Math.round(h / d) };
}
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
function extFormat(file) {
  const type = file.type;
  if (type === 'image/jpeg') return 'JPEG';
  if (type === 'image/png') return 'PNG';
  if (type === 'image/webp') return 'WEBP';
  const ext = (file.name.split('.').pop() || '').toUpperCase();
  return ext === 'JPG' ? 'JPEG' : ext;
}
function isSupported(file) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
// Cloudinary: inserting fl_attachment forces a real download instead of
// opening the image in a new browser tab.
function toDownloadUrl(url) {
  if (!url) return url;
  return url.replace('/upload/', '/upload/fl_attachment/');
}

export default function Portal() {
  // ---------- upload / source image state ----------
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [iw, setIw] = useState(0);
  const [ih, setIh] = useState(0);
  const [needsCrop, setNeedsCrop] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadWarning, setUploadWarning] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // ---------- crop editor state ----------
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, startOffX: 0, startOffY: 0 });

  // ---------- convert / result state ----------
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState('');
  const [job, setJob] = useState(null);

  // ---------- history state ----------
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fileInputRef = useRef(null);

  const clampOffset = useCallback((off, z) => {
    const scale = baseScale * z;
    const dispW = iw * scale;
    const dispH = ih * scale;
    const minX = FRAME_W - dispW;
    const minY = FRAME_H - dispH;
    return {
      x: Math.min(0, Math.max(minX, off.x)),
      y: Math.min(0, Math.max(minY, off.y)),
    };
  }, [baseScale, iw, ih]);

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (res.ok) setHistory(data.jobs || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  function resetPipeline() {
    setUploadError('');
    setUploadWarning('');
    setConvertError('');
    setJob(null);
  }

  function handleFile(f) {
    resetPipeline();

    if (!isSupported(f)) {
      setUploadError('Unsupported file type. Please upload JPG, JPEG, PNG or WEBP.');
      setFile(null);
      return;
    }

    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < MIN_SOURCE_DIM || img.naturalHeight < MIN_SOURCE_DIM) {
        setUploadWarning('Image resolution is too low for a high-quality 600 × 400 output.');
      }
      const ratio = img.naturalWidth / img.naturalHeight;
      const needsCropNow = Math.abs(ratio - TARGET_RATIO) > RATIO_TOLERANCE;

      setFile(f);
      setPreviewUrl(url);
      setIw(img.naturalWidth);
      setIh(img.naturalHeight);
      setNeedsCrop(needsCropNow);

      if (needsCropNow) {
        const bScale = Math.max(FRAME_W / img.naturalWidth, FRAME_H / img.naturalHeight);
        setBaseScale(bScale);
        setZoom(1);
        setOffset({
          x: (FRAME_W - img.naturalWidth * bScale) / 2,
          y: (FRAME_H - img.naturalHeight * bScale) / 2,
        });
      }
    };
    img.onerror = () => {
      setUploadError('Something went wrong while processing your image. Please try another image.');
    };
    img.src = url;
  }

  function onZoomChange(e) {
    const newZoom = parseInt(e.target.value, 10) / 100;
    const scaleOld = baseScale * zoom;
    const scaleNew = baseScale * newZoom;
    const cx = FRAME_W / 2, cy = FRAME_H / 2;
    const imgX = (cx - offset.x) / scaleOld;
    const imgY = (cy - offset.y) / scaleOld;
    const nextOffset = { x: cx - imgX * scaleNew, y: cy - imgY * scaleNew };
    setZoom(newZoom);
    setOffset(clampOffset(nextOffset, newZoom));
  }

  function onResetCrop() {
    setZoom(1);
    setOffset({
      x: (FRAME_W - iw * baseScale) / 2,
      y: (FRAME_H - ih * baseScale) / 2,
    });
  }

  function getPoint(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }
  function onPointerDown(e) {
    const p = getPoint(e);
    dragState.current = { dragging: true, startX: p.x, startY: p.y, startOffX: offset.x, startOffY: offset.y };
  }
  function onPointerMove(e) {
    if (!dragState.current.dragging) return;
    const p = getPoint(e);
    const next = {
      x: dragState.current.startOffX + (p.x - dragState.current.startX),
      y: dragState.current.startOffY + (p.y - dragState.current.startY),
    };
    setOffset(clampOffset(next, zoom));
  }
  function onPointerUp() {
    dragState.current.dragging = false;
  }

  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }

  function computeCropRect() {
    if (!needsCrop) {
      return { left: 0, top: 0, width: iw, height: ih };
    }
    const scale = baseScale * zoom;
    let left = -offset.x / scale;
    let top = -offset.y / scale;
    const width = FRAME_W / scale;
    const height = FRAME_H / scale;
    left = Math.max(0, Math.min(left, iw - width));
    top = Math.max(0, Math.min(top, ih - height));
    return { left, top, width, height };
  }

  async function handleConvert() {
    if (!file) return;
    setConverting(true);
    setConvertError('');
    setJob(null);
    try {
      const crop = computeCropRect();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('crop', JSON.stringify(crop));

      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Processing failed.');

      setJob(data.job);
      fetchHistory();
    } catch (err) {
      console.error(err);
      setConvertError(err.message || 'Something went wrong while processing your image. Please try another image.');
    } finally {
      setConverting(false);
    }
  }

  const { rw, rh } = iw && ih ? simplifiedRatio(iw, ih) : { rw: 0, rh: 0 };

  return (
    <>
      {/* ===================== Top bar ===================== */}
      <div className="sticky top-0 z-40 glass">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between px-5 sm:px-10 py-3.5">
          <div className="flex items-center gap-3">
            <img src="/pinnacle-logo.png" alt="Pinnacle Rewards" className="h-9 w-auto" />
            <div className="hidden sm:block h-6 w-px bg-black/10" />
            <div className="hidden sm:block text-xs tracking-wide text-brand-700/50">
              Merchant Image Standardization Portal
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] font-medium px-3 py-1.5 rounded-full border border-black/10 text-brand-700/60 glass-soft">
              Public access
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-[1240px] mx-auto px-5 sm:px-10">
        {/* ===================== Hero ===================== */}
        <div className="pt-11 pb-7">
          <span className="inline-flex items-center gap-2 font-mono text-xs font-medium text-brand-600 px-3 py-1.5 rounded-full mb-4 brand-gradient-soft border border-black/5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-300" />
            Lifestyle image pipeline
          </span>
          <h1 className="text-[28px] sm:text-4xl font-semibold tracking-tight max-w-2xl leading-tight text-brand-700">
            Merchant Image Standardization Portal
          </h1>
          <p className="text-base text-brand-700/55 max-w-xl mt-3 leading-relaxed">
            Prepare your merchant lifestyle images for production in seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5 items-start">
          {/* ============ LEFT COLUMN ============ */}
          <div className="flex flex-col gap-5">
            {/* Step 1: Upload */}
            <div className="glass rounded-2xl shadow-2xl shadow-black/10 p-6">
              <div className="flex items-center mb-4">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg brand-gradient text-white font-mono text-[11px] font-semibold mr-2.5">1</span>
                <h2 className="text-[15px] font-semibold text-brand-700">Upload lifestyle image</h2>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={
                  'border-2 border-dashed rounded-xl glass-soft px-6 py-11 text-center cursor-pointer transition-all duration-200 ' +
                  (dragActive ? 'border-brand-300/80 bg-brand-100/50' : 'border-black/18 hover:border-brand-300/70 hover:bg-brand-100/40')
                }
              >
                <div className="w-11 h-11 mx-auto mb-3.5 rounded-xl glass flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 16V4M12 4L7 9M12 4l5 5" stroke="#D276FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="#D276FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-brand-700 mb-1">Drop your lifestyle image here</h3>
                <p className="text-[13px] text-brand-700/45 m-0">
                  or <span className="text-brand-500 font-semibold underline underline-offset-2">choose a file</span>
                </p>
                <div className="flex gap-1.5 justify-center mt-4 flex-wrap">
                  {['JPG', 'JPEG', 'PNG', 'WEBP'].map((f) => (
                    <span key={f} className="font-mono text-[10.5px] font-medium px-2 py-1 rounded-md glass-soft text-brand-700/55">{f}</span>
                  ))}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {uploadError && <Alert type="error">{uploadError}</Alert>}
              {uploadWarning && !uploadError && <Alert type="warn">{uploadWarning}</Alert>}
            </div>

            {/* Step 2: Info panel */}
            {file && (
              <div className="fade-in glass rounded-2xl shadow-2xl shadow-black/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg brand-gradient text-white font-mono text-[11px] font-semibold mr-2.5">2</span>
                    <h2 className="text-[15px] font-semibold text-brand-700">Source image details</h2>
                  </div>
                  <span className="text-[12.5px] text-brand-700/45">{needsCrop ? 'Crop required' : 'Direct resize'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoCell label="Filename" value={file.name} mono />
                  <InfoCell label="Format" value={extFormat(file)} mono />
                  <InfoCell label="Dimensions" value={`${iw} × ${ih}`} mono />
                  <InfoCell
                    label="Aspect ratio"
                    mono
                    value={
                      <>
                        {rw}:{rh}{' '}
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                          style={{
                            background: needsCrop ? 'rgba(230,160,60,0.15)' : 'rgba(210,118,255,0.15)',
                            color: needsCrop ? '#8A4F06' : '#3E1955',
                          }}
                        >
                          {needsCrop ? 'needs crop' : '3:2 match'}
                        </span>
                      </>
                    }
                  />
                  <InfoCell label="File size" value={formatBytes(file.size)} mono />
                  <InfoCell label="Target" value="600 × 400 · PNG" mono />
                </div>
                <div className="flex gap-3.5 items-center mt-4">
                  <img src={previewUrl} alt="Original preview" className="w-[76px] h-[76px] rounded-lg border border-black/10 object-cover checkerboard flex-none" />
                  <div className="text-[12.5px] text-brand-700/55 leading-relaxed">
                    <b className="text-brand-700">{file.name}</b><br />
                    {iw} × {ih} · {extFormat(file)}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Crop editor */}
            {file && needsCrop && (
              <div className="fade-in glass rounded-2xl shadow-2xl shadow-black/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg brand-gradient text-white font-mono text-[11px] font-semibold mr-2.5">3</span>
                    <h2 className="text-[15px] font-semibold text-brand-700">Position &amp; crop</h2>
                  </div>
                  <span className="text-[12.5px] text-brand-700/45">3:2 output frame</span>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative pt-5 pl-7 pr-5 pb-5">
                    <div className="absolute top-1.5 left-7 right-5 flex justify-between font-mono text-[9px] text-brand-700/40">
                      <span>0</span><span>150</span><span>300</span><span>450</span><span>600</span>
                    </div>
                    <div className="relative w-[540px] max-w-full">
                      <div
                        className={'crop-frame' + (dragState.current.dragging ? ' grabbing' : '')}
                        onMouseDown={onPointerDown}
                        onMouseMove={onPointerMove}
                        onMouseUp={onPointerUp}
                        onMouseLeave={onPointerUp}
                        onTouchStart={onPointerDown}
                        onTouchMove={onPointerMove}
                        onTouchEnd={onPointerUp}
                      >
                        <img
                          src={previewUrl}
                          alt="Crop preview"
                          style={{
                            width: iw * baseScale * zoom,
                            height: ih * baseScale * zoom,
                            transform: `translate(${offset.x}px, ${offset.y}px)`,
                          }}
                        />
                        <div className="rule-grid" />
                        <span className="corner tl" /><span className="corner tr" />
                        <span className="corner bl" /><span className="corner br" />
                        <span className="absolute top-2.5 right-2.5 font-mono text-[10px] font-semibold text-white brand-gradient px-2 py-1 rounded-md">600 × 400</span>
                        <span className="absolute bottom-2.5 left-2.5 font-mono text-[10.5px] text-white/85 bg-black/40 backdrop-blur px-2 py-1 rounded-md">
                          zoom {zoom.toFixed(2)}×
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-[540px] max-w-full flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <label className="text-[11.5px] text-brand-700/45 font-semibold uppercase tracking-wide flex-none">Zoom</label>
                      <input type="range" min="100" max="320" value={Math.round(zoom * 100)} onChange={onZoomChange} className="flex-1" />
                      <span className="font-mono text-brand-700/50 text-[12px]" style={{ width: 44, textAlign: 'right' }}>{zoom.toFixed(2)}×</span>
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <button onClick={onResetCrop} className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg glass-soft border border-black/15 text-brand-700/80 hover:bg-black/5 transition">
                        Reset crop
                      </button>
                      <span className="text-xs text-brand-700/40 text-center">Drag the image to reposition it inside the frame</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Convert */}
            {file && (
              <div className="fade-in glass rounded-2xl shadow-2xl shadow-black/10 p-6">
                <div className="flex items-center mb-4">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg brand-gradient text-white font-mono text-[11px] font-semibold mr-2.5">4</span>
                  <h2 className="text-[15px] font-semibold text-brand-700">Generate output</h2>
                </div>
                <button
                  onClick={handleConvert}
                  disabled={converting}
                  className="w-full flex items-center justify-center gap-2 text-[13.5px] font-semibold px-4 py-2.5 rounded-xl brand-gradient text-white shadow-glow hover:opacity-90 active:translate-y-px transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M4 12a8 8 0 0113.66-5.66M20 12a8 8 0 01-13.66 5.66" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <path d="M18 3v4h-4M6 21v-4h4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {converting ? 'Processing…' : 'Convert Image'}
                </button>

                <div className="flex items-center gap-2 mt-3.5 px-3 py-2.5 rounded-lg glass-soft text-[12.5px] text-brand-700/55">
                  <span className={'w-[7px] h-[7px] rounded-full flex-none ' + (job ? 'bg-brand-500' : converting ? 'bg-brand-400 pulse-dot' : 'bg-black/15')} />
                  <span>{job ? 'Output ready — 600 × 400 PNG' : converting ? 'Processing image…' : 'Waiting to convert'}</span>
                </div>

                {convertError && <Alert type="error">{convertError}</Alert>}

                <div className="flex flex-col gap-2 mt-3.5">
                  <CheckRow label="PNG format" pass={!!job} />
                  <CheckRow label="600 × 400 output" pass={!!job} />
                  <CheckRow label="High quality, no stretching" pass={!!job} />
                  <CheckRow label="Ready for production" pass={!!job} />
                </div>

                <a
                  href={job ? toDownloadUrl(job.output_storage_url) : undefined}
                  className={
                    'block text-center w-full mt-3.5 text-[13.5px] font-semibold px-4 py-2.5 rounded-xl border-2 border-brand-400 text-brand-600 bg-white/70 transition active:translate-y-px ' +
                    (job ? 'hover:bg-brand-50' : 'opacity-30 pointer-events-none')
                  }
                  download="merchant-lifestyle-600x400.png"
                >
                  Download PNG
                </a>
              </div>
            )}
          </div>

          {/* ============ RIGHT COLUMN ============ */}
          <div className="lg:sticky lg:top-24 flex flex-col gap-5">
            <div className="glass rounded-2xl shadow-2xl shadow-black/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-brand-700">Live preview</h2>
                <span className="text-[12.5px] text-brand-700/45">before / after</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-soft rounded-xl overflow-hidden">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-700/40 px-3 pt-2.5">Original</div>
                  <div className="aspect-[3/2] mx-3 mt-2.5 mb-3 rounded-lg overflow-hidden checkerboard border border-black/10 flex items-center justify-center text-brand-700/35 text-[11.5px] font-mono">
                    {previewUrl ? <img src={previewUrl} alt="Original" className="w-full h-full object-cover" /> : 'No image yet'}
                  </div>
                  <div className="flex justify-between px-3 pb-2.5 font-mono text-[11.5px] text-brand-700/45">
                    <span>{iw && ih ? `${iw} × ${ih}` : '—'}</span><span>&nbsp;</span>
                  </div>
                </div>
                <div className="glass-soft rounded-xl overflow-hidden">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-700/40 px-3 pt-2.5">Final output</div>
                  <div className="aspect-[3/2] mx-3 mt-2.5 mb-3 rounded-lg overflow-hidden checkerboard border border-black/10 flex items-center justify-center text-brand-700/35 text-[11.5px] font-mono">
                    {job ? <img src={job.output_storage_url} alt="Final output" className="w-full h-full object-cover" /> : '600 × 400'}
                  </div>
                  <div className="flex justify-between px-3 pb-2.5 font-mono text-[11.5px] text-brand-700/45">
                    <span>600 × 400</span><span>PNG</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent activity */}
            <div className="glass rounded-2xl shadow-2xl shadow-black/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-brand-700">Recent activity</h2>
                <span className="text-[12.5px] text-brand-700/45">{historyLoading ? 'Loading…' : `${history.length} shown`}</span>
              </div>
              {history.length === 0 && !historyLoading && (
                <p className="text-[12.5px] text-brand-700/40">No conversions yet — they'll show up here for the whole team.</p>
              )}
              <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 glass-soft rounded-lg p-2.5">
                    <img
                      src={h.output_storage_url}
                      alt={h.original_filename}
                      className="w-10 h-10 rounded-md object-cover checkerboard border border-black/10 flex-none"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium text-brand-700 truncate">{h.original_filename}</div>
                      <div className="text-[11px] text-brand-700/45">
                        {h.users?.display_name || 'Public visitor'} · {formatDate(h.created_at)}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-brand-100 text-brand-600 flex-none">
                      {h.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===================== Asset requirements ===================== */}
        <div className="mt-14 mb-1">
          <h2 className="text-[19px] font-semibold text-brand-700">Merchant Asset Requirements</h2>
          <p className="text-[13.5px] text-brand-700/45 mt-1">Reference specification used to validate every asset before it reaches the catalog.</p>
        </div>
        <div className="glass rounded-2xl shadow-2xl shadow-black/10 p-6 mt-3.5 mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RequirementCard title="Lifestyle Image" items={['PNG', '600 × 400 pixels', 'High quality']} />
            <RequirementCard title="Logo" items={['PNG recommended', 'Original dimensions accepted', 'Preserve aspect ratio']} />
          </div>
        </div>

        <div className="pt-5 pb-10 border-t border-black/10 flex justify-between flex-wrap gap-2 text-xs text-brand-700/35">
          <span>Pinnacle Rewards · Catalog Operations · Merchant Image Standardization Portal</span>
          <span className="font-mono">v1.0</span>
        </div>
      </div>
    </>
  );
}

function InfoCell({ label, value, mono }) {
  return (
    <div className="glass-soft rounded-lg px-3.5 py-3">
      <div className="text-[10.5px] uppercase tracking-wider text-brand-700/40 font-semibold mb-1">{label}</div>
      <div className={'text-[13.5px] font-medium break-all ' + (mono ? 'font-mono' : '')}>{value}</div>
    </div>
  );
}

function Alert({ type, children }) {
  const isError = type === 'error';
  return (
    <div
      className="flex gap-2.5 items-start px-3.5 py-3 rounded-lg text-[13.5px] leading-relaxed mt-3.5"
      style={
        isError
          ? { background: 'rgba(224,64,52,0.10)', color: '#9A2E23', border: '1px solid rgba(224,64,52,0.30)' }
          : { background: 'rgba(210,118,255,0.10)', color: '#5B2E7A', border: '1px solid rgba(210,118,255,0.30)' }
      }
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="flex-none mt-px">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

function CheckRow({ label, pass }) {
  return (
    <div
      className={
        'flex items-center gap-2.5 text-[13px] px-2.5 py-2 rounded-lg border transition-colors ' +
        (pass ? 'text-brand-700' : 'text-brand-700/45 glass-soft border-black/8')
      }
      style={
        pass
          ? { background: 'linear-gradient(120deg, rgba(175,86,230,0.22), rgba(100,0,150,0.22))', borderColor: 'rgba(210,118,255,0.35)' }
          : undefined
      }
    >
      <span
        className="w-[17px] h-[17px] rounded-full flex items-center justify-center flex-none"
        style={pass ? { background: 'linear-gradient(120deg,#D276FF,#640096)' } : { border: '1.6px solid rgba(0,0,0,0.15)' }}
      >
        {pass && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label}
    </div>
  );
}

function RequirementCard({ title, items }) {
  return (
    <div className="glass-soft rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2.5 text-brand-700">{title}</h3>
      <ul className="flex flex-col gap-1.5 text-[13px] text-brand-700/60">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#D276FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
