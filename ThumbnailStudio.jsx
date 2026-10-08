import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, cloudflareR2 } from './supabase';
import { getAdminRole } from './adminAuth';
import { buildPdlplChapters } from './palDoPalKeLamhe';
import { uploadPdlplFile, removePdlplFiles } from './pdlplR2';
import { chapterLanguageLabel, normalizeChapterLanguage } from './chapters';
import './thumbnail-studio.css';

const ATMA_BUCKET = 'covers';
const CARD_TARGETS = {
  desktop: { label: 'Desktop / PC', ratio: 16 / 9, size: '16:9' },
  mobile: { label: 'Mobile', ratio: 3 / 4, size: '3:4' },
};
const LIST_TARGETS = {
  atma: { label: 'Atma Rekha Chapter List', ratio: 13 / 9, size: '13:9', preview: '104 × 72 desktop · 76 × 100 mobile' },
  pdpkl: { label: 'PDPKL Chapter List', ratio: 3 / 4, size: '3:4', preview: '72 × 96' },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeRotation = value => ((Number(value) % 360) + 540) % 360 - 180;
const isQuarterTurn = value => Math.abs(normalizeRotation(value)) % 180 === 90;

function pathFromAtmaUrl(url) {
  if (!url) return null;
  const marker = '/storage/v1/object/public/' + ATMA_BUCKET + '/';
  const index = String(url).indexOf(marker);
  return index < 0 ? null : decodeURIComponent(String(url).slice(index + marker.length));
}

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Your Supabase session has expired. Please sign in again.');
  const role = await getAdminRole(user.id);
  if (!role) throw new Error('Admin access required.');
  return user;
}

const publicAtmaUrl = path => cloudflareR2.from(ATMA_BUCKET).getPublicUrl(path).data.publicUrl;

function formatRatio(ratio) {
  if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9';
  if (Math.abs(ratio - 13 / 9) < 0.01) return '13:9';
  if (Math.abs(ratio - 3 / 4) < 0.01) return '3:4';
  return (ratio * 100).toFixed(0) + ':100';
}

function makeOutputFile(blob, sourceName) {
  const base = String(sourceName || 'thumbnail').replace(/\.[^.]+$/, '');
  return new File([blob], base + '-cropped.webp', { type: 'image/webp', lastModified: Date.now() });
}

function CropEditor({ source, sourceName = 'thumbnail', ratio, outputLabel = '', title, subtitle, onCancel, onSave }) {
  const [src, setSrc] = useState('');
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    if (!source) return undefined;
    let objectUrl = '';
    if (source instanceof File || source instanceof Blob) objectUrl = URL.createObjectURL(source);
    setSrc(objectUrl || source);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setError('');
    setNatural({ width: 0, height: 0 });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source]);

  useEffect(() => {
    const update = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect) setStage({ width: rect.width, height: rect.height });
    };
    update();
    if (!stageRef.current) return undefined;
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(stageRef.current);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [src]);

  const metrics = useMemo(() => {
    if (!natural.width || !natural.height || !stage.width || !stage.height) return null;
    const turn = isQuarterTurn(rotation);
    const coverW = turn ? natural.height : natural.width;
    const coverH = turn ? natural.width : natural.height;
    const baseScale = Math.max(stage.width / coverW, stage.height / coverH);
    const drawW = natural.width * baseScale * zoom;
    const drawH = natural.height * baseScale * zoom;
    const visibleW = turn ? drawH : drawW;
    const visibleH = turn ? drawW : drawH;
    return {
      drawW,
      drawH,
      maxX: Math.max(0, (visibleW - stage.width) / 2),
      maxY: Math.max(0, (visibleH - stage.height) / 2),
    };
  }, [natural, stage, zoom, rotation]);

  useEffect(() => {
    if (!metrics) return;
    setPosition(current => ({
      x: clamp(current.x, -metrics.maxX, metrics.maxX),
      y: clamp(current.y, -metrics.maxY, metrics.maxY),
    }));
  }, [metrics?.maxX, metrics?.maxY]);

  const clampPosition = next => {
    if (!metrics) return next;
    return {
      x: clamp(next.x, -metrics.maxX, metrics.maxX),
      y: clamp(next.y, -metrics.maxY, metrics.maxY),
    };
  };

  const setZoomSafe = value => {
    const next = clamp(Number(value) || 1, 1, 5);
    setZoom(next);
    setPosition(current => current);
  };

  const rotateBy = degrees => setRotation(current => normalizeRotation(current + degrees));

  const startDrag = event => {
    if (busy || error) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: position,
    };
  };

  const moveDrag = event => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    setPosition(clampPosition({
      x: drag.origin.x + event.clientX - drag.startX,
      y: drag.origin.y + event.clientY - drag.startY,
    }));
  };

  const stopDrag = event => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const keyboardNudge = event => {
    const amount = event.shiftKey ? 16 : 4;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    setPosition(clampPosition({
      x: position.x + (event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0),
      y: position.y + (event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0),
    }));
  };

  const reset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  const exportCrop = async () => {
    if (!imageRef.current || !natural.width || !stage.width || busy) return;
    setBusy(true);
    setError('');
    try {
      const image = imageRef.current;
      const maxWidth = ratio >= 1 ? 1600 : 1200;
      const targetW = Math.round(maxWidth);
      const targetH = Math.round(targetW / ratio);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable in this browser.');

      const turn = isQuarterTurn(rotation);
      const coverW = turn ? image.naturalHeight : image.naturalWidth;
      const coverH = turn ? image.naturalWidth : image.naturalHeight;
      const baseScale = Math.max(targetW / coverW, targetH / coverH);
      const drawW = image.naturalWidth * baseScale * zoom;
      const drawH = image.naturalHeight * baseScale * zoom;
      const scaleX = stage.width ? targetW / stage.width : 1;
      const scaleY = stage.height ? targetH / stage.height : scaleX;

      ctx.save();
      ctx.fillStyle = '#080808';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.translate(
        targetW / 2 + position.x * scaleX,
        targetH / 2 + position.y * scaleY,
      );
      ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .92));
      if (!blob) throw new Error('Could not create the edited thumbnail.');
      onSave?.(makeOutputFile(blob, sourceName));
    } catch (exportError) {
      console.error(exportError);
      setError(exportError?.message || 'Could not create the edited thumbnail.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape' && !busy) onCancel?.();
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'enter') {
        event.preventDefault();
        exportCrop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!src) return null;
  const imageStyle = metrics ? {
    width: metrics.drawW + 'px',
    height: metrics.drawH + 'px',
    transform: 'translate3d(calc(-50% + ' + position.x + 'px), calc(-50% + ' + position.y + 'px), 0) rotate(' + rotation + 'deg)',
  } : { width: '100%', height: '100%', objectFit: 'cover' };

  return <div className="ar-ts-overlay" role="dialog" aria-modal="true" aria-label={title}>
    <section className="ar-ts-editor">
      <header className="ar-ts-editor-head">
        <div>
          <span>THUMBNAIL STUDIO</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button type="button" onClick={onCancel} disabled={busy} aria-label="Close editor">×</button>
      </header>

      <div className="ar-ts-editor-body">
        <div className="ar-ts-stage-column">
          <div
            ref={stageRef}
            className="ar-ts-stage"
            style={{ aspectRatio: String(ratio) }}
            tabIndex="0"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
            onKeyDown={keyboardNudge}
          >
            <img
              ref={imageRef}
              src={src}
              crossOrigin="anonymous"
              alt=""
              draggable="false"
              onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              onError={() => setError('This image could not be loaded for editing.')}
              style={imageStyle}
            />
            <div className="ar-ts-dim" aria-hidden="true" />
            <div className="ar-ts-grid" aria-hidden="true">
              <i className="v1" /><i className="v2" /><i className="h1" /><i className="h2" />
            </div>
            <div className="ar-ts-frame" aria-hidden="true">
              <b className="tl" /><b className="tr" /><b className="bl" /><b className="br" />
            </div>
            <span className="ar-ts-drag-hint">Drag artwork · Arrow keys fine-tune</span>
          </div>
          <div className="ar-ts-output-row">
            <div><span>Output</span><strong>{outputLabel || formatRatio(ratio)} · {title.includes('Mobile') ? 'Mobile' : title.includes('Chapter List') ? 'Chapter List' : 'Desktop / PC'}</strong></div>
            <small>Crop is exported as a new WebP image.</small>
          </div>
        </div>

        <aside className="ar-ts-controls" aria-label="Crop and adjustment controls">
          <section>
            <div className="ar-ts-control-head"><strong>Zoom</strong><b>{zoom.toFixed(2)}×</b></div>
            <div className="ar-ts-zoom-row">
              <button type="button" onClick={() => setZoomSafe(zoom - .1)} disabled={busy || zoom <= 1}>−</button>
              <input type="range" min="1" max="5" step=".01" value={zoom} onChange={event => setZoomSafe(event.target.value)} aria-label="Zoom" />
              <button type="button" onClick={() => setZoomSafe(zoom + .1)} disabled={busy || zoom >= 5}>+</button>
            </div>
          </section>

          <section>
            <div className="ar-ts-control-head"><strong>Position</strong><span>Drag, then fine-tune</span></div>
            <label className="ar-ts-slider"><span>Horizontal</span><input type="range" min={metrics ? -metrics.maxX : 0} max={metrics ? metrics.maxX : 0} step=".5" value={position.x} onChange={event => setPosition(current => clampPosition({ ...current, x: Number(event.target.value) }))} /></label>
            <label className="ar-ts-slider"><span>Vertical</span><input type="range" min={metrics ? -metrics.maxY : 0} max={metrics ? metrics.maxY : 0} step=".5" value={position.y} onChange={event => setPosition(current => clampPosition({ ...current, y: Number(event.target.value) }))} /></label>
          </section>

          <section>
            <div className="ar-ts-control-head"><strong>Rotate</strong><b>{Math.round(rotation)}°</b></div>
            <input className="ar-ts-rotation" type="range" min="-180" max="180" step="1" value={rotation} onChange={event => setRotation(Number(event.target.value))} aria-label="Rotation" />
            <div className="ar-ts-button-row">
              <button type="button" onClick={() => rotateBy(-90)} disabled={busy}>−90°</button>
              <button type="button" onClick={() => rotateBy(-1)} disabled={busy}>−1°</button>
              <button type="button" onClick={() => rotateBy(1)} disabled={busy}>+1°</button>
              <button type="button" onClick={() => rotateBy(90)} disabled={busy}>+90°</button>
            </div>
          </section>

          <section>
            <div className="ar-ts-control-head"><strong>Quick actions</strong></div>
            <div className="ar-ts-button-row">
              <button type="button" onClick={() => setPosition({ x: 0, y: 0 })} disabled={busy}>Center</button>
              <button type="button" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }} disabled={busy}>Fit</button>
              <button type="button" onClick={reset} disabled={busy}>Reset</button>
            </div>
          </section>

          {error && <div className="ar-ts-error" role="alert">{error}</div>}

          <p className="ar-ts-hint">Esc cancels · Ctrl/⌘ + Enter saves · drag on the preview to compose the crop.</p>
        </aside>
      </div>

      <footer className="ar-ts-editor-actions">
        <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="primary" onClick={exportCrop} disabled={busy || Boolean(error) || !natural.width}>{busy ? 'Rendering…' : 'Save crop'}</button>
      </footer>
    </section>
  </div>;
}

function Preview({ src, ratio, label, compact = false }) {
  return <div className={'ar-ts-preview ' + (compact ? 'compact' : '')} style={{ aspectRatio: String(ratio) }}>
    {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span>No image</span>}
    <small>{label}</small>
  </div>;
}

function numberLabel(chapter) {
  return chapter?.chapterNumber == null ? 'Special' : 'Chapter ' + chapter.chapterNumber;
}

function normalizeChapters(rows) {
  return [...(rows || [])].sort((a, b) => {
    const an = a.chapterNumber == null ? Infinity : Number(a.chapterNumber);
    const bn = b.chapterNumber == null ? Infinity : Number(b.chapterNumber);
    return an !== bn ? an - bn : String(a.id).localeCompare(String(b.id));
  });
}

export default function ThumbnailStudio() {
  const [series, setSeries] = useState('atma');
  const [mode, setMode] = useState('cards');
  const [chapters, setChapters] = useState([]);
  const [pdpklChapters, setPdpklChapters] = useState([]);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [editor, setEditor] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      await requireAdmin();
      const [atma, pdpkl] = await Promise.all([supabase.from('chapters').select('id,manga_id,language,chapter_number,title,cover_url,card_thumbnail_desktop_url,card_thumbnail_mobile_url,status,release_date,created_at').order('chapter_number', { ascending: true, nullsFirst: false }), buildPdlplChapters()]);
      if (atma.error) throw atma.error;
      setChapters((atma.data || []).map(row => ({
        id: row.id,
        mangaId: row.manga_id || null,
        language: normalizeChapterLanguage(row.language),
        chapterNumber: row.chapter_number,
        title: row.title || '',
        cover: row.cover_url || null,
        cardThumbnailDesktop: row.card_thumbnail_desktop_url || null,
        cardThumbnailMobile: row.card_thumbnail_mobile_url || null,
        status: row.status || '',
        releaseDate: row.release_date || null,
        createdAt: row.created_at || null,
      })));
      setPdpklChapters(pdpkl || []);
      setNotice({ type: '', text: '' });
    } catch (error) {
      console.error(error);
      setNotice({ type: 'error', text: error.message || 'Unable to load thumbnail studio.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const source = series === 'pdpkl' ? pdpklChapters : chapters;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return normalizeChapters(source).filter(chapter => (
      (language === 'all' || normalizeChapterLanguage(chapter.language) === language) &&
      (!needle || [numberLabel(chapter), chapter.title, chapter.id, chapterLanguageLabel(chapter.language)].join(' ').toLowerCase().includes(needle))
    ));
  }, [source, query, language]);

  const openEditor = (kind, chapter, slot = null, file = null) => {
    let ratio;
    if (kind === 'cards') ratio = CARD_TARGETS[slot].ratio;
    else ratio = LIST_TARGETS[series].ratio;
    const existing = kind === 'cards'
      ? (slot === 'desktop' ? chapter.cardThumbnailDesktop : chapter.cardThumbnailMobile)
      : chapter.cover;
    const sourceValue = file || existing;
    if (!sourceValue) return;
    setEditor({
      kind,
      chapter,
      slot,
      file,
      source: sourceValue,
      ratio,
      title: series === 'pdpkl'
        ? 'PDPKL · ' + numberLabel(chapter) + (kind === 'cards' ? ' · ' + CARD_TARGETS[slot].label : ' · Chapter List')
        : numberLabel(chapter) + (kind === 'cards' ? ' · ' + CARD_TARGETS[slot].label : ' · Chapter List'),
      subtitle: kind === 'cards'
        ? 'Compose the uploaded or saved image inside the exact card frame. Nothing else on the site changes.'
        : 'Adjust the normal chapter-list cover used by this series. The saved image remains the normal cover.',
      sourceName: (chapter.title || 'thumbnail') + (slot ? '-' + slot : '') + '.webp',
      outputLabel: kind === 'cards' ? CARD_TARGETS[slot].size : LIST_TARGETS[series].size,
    });
  };

  const renderCard = chapter => {
    const desktop = chapter.cardThumbnailDesktop || chapter.cover;
    const mobile = chapter.cardThumbnailMobile || chapter.cardThumbnailDesktop || chapter.cover;
    const slots = ['desktop', 'mobile'];

    return <article className="ar-ts-item" key={chapter.id}>
      <header className="ar-ts-item-head">
        <div><span>{chapterLanguageLabel(chapter.language)}</span><h3>{numberLabel(chapter)}</h3><p>{chapter.title || 'Untitled chapter'}</p></div>
        <code>{String(chapter.id).slice(0, 8)}</code>
      </header>
      <div className="ar-ts-card-previews">
        <section>
          <div className="ar-ts-subhead"><strong>Desktop / PC</strong><small>{chapter.cardThumbnailDesktop ? 'Custom' : 'Normal cover fallback'}</small></div>
          <Preview src={desktop} ratio={CARD_TARGETS.desktop.ratio} label="16:9" />
          <div className="ar-ts-actions">
            <label><span>{chapter.cardThumbnailDesktop ? 'Replace + crop' : 'Upload + crop'}</span><input type="file" accept="image/*" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value=''; if (file) openEditor('cards', chapter, 'desktop', file); }} /></label>
            {chapter.cardThumbnailDesktop && <button type="button" onClick={() => openEditor('cards', chapter, 'desktop')}>Adjust saved</button>}
          </div>
        </section>
        <section>
          <div className="ar-ts-subhead"><strong>Mobile</strong><small>{chapter.cardThumbnailMobile ? 'Custom' : chapter.cardThumbnailDesktop ? 'Desktop fallback' : 'Normal cover fallback'}</small></div>
          <Preview src={mobile} ratio={CARD_TARGETS.mobile.ratio} label="3:4" />
          <div className="ar-ts-actions">
            <label><span>{chapter.cardThumbnailMobile ? 'Replace + crop' : 'Upload + crop'}</span><input type="file" accept="image/*" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value=''; if (file) openEditor('cards', chapter, 'mobile', file); }} /></label>
            {chapter.cardThumbnailMobile && <button type="button" onClick={() => openEditor('cards', chapter, 'mobile')}>Adjust saved</button>}
          </div>
        </section>
      </div>
      <div className="ar-ts-meta-line"><span>Home card only</span><small>Chapter List cover is managed separately in Chapter List mode.</small></div>
    </article>;
  };

  const renderList = chapter => {
    const target = LIST_TARGETS[series];
    return <article className="ar-ts-item" key={chapter.id}>
      <header className="ar-ts-item-head">
        <div><span>{series === 'pdpkl' ? 'PDPKL · ' : ''}{chapterLanguageLabel(chapter.language)}</span><h3>{numberLabel(chapter)}</h3><p>{chapter.title || 'Untitled chapter'}</p></div>
        <code>{String(chapter.id).slice(0, 8)}</code>
      </header>
      <div className="ar-ts-list-preview-grid">
        <section>
          <div className="ar-ts-subhead"><strong>Current cover</strong><small>{chapter.cover ? 'Saved' : 'No cover'}</small></div>
          <Preview src={chapter.cover} ratio={target.ratio} label={target.size} />
        </section>
        <section>
          <div className="ar-ts-subhead"><strong>Responsive view</strong><small>{target.preview}</small></div>
          <div className="ar-ts-responsive-preview">
            <Preview src={chapter.cover} ratio={series === 'pdpkl' ? 3 / 4 : 76 / 100} compact />
            <Preview src={chapter.cover} ratio={series === 'pdpkl' ? 72 / 96 : 104 / 72} compact />
          </div>
        </section>
      </div>
      <div className="ar-ts-actions ar-ts-list-actions">
        {chapter.cover && <button type="button" onClick={() => openEditor('list', chapter)}>Adjust existing</button>}
        <label><span>{chapter.cover ? 'Replace + crop' : 'Upload + crop'}</span><input type="file" accept="image/*" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value=''; if (file) openEditor('list', chapter, null, file); }} /></label>
      </div>
      <div className="ar-ts-meta-line"><span>Normal Chapter List cover</span><small>Home-card custom thumbnails are separate and are not changed by this save.</small></div>
    </article>;
  };

  const save = async file => {
    const job = editor;
    setEditor(null);
    if (!job || !file || busy) return;
    setBusy(true);
    setNotice({ type: '', text: '' });
    let user = null;
    let uploaded = null;
    let committed = false;
    try {
      user = await requireAdmin();
      if (!(file instanceof File)) throw new Error('The edited image could not be prepared.');
      const chapter = job.chapter;

      if (series === 'atma') {
        const languageCode = normalizeChapterLanguage(chapter.language);
        const stamp = Date.now();
        let path;
        let column;
        let oldUrl;
        if (job.kind === 'cards') {
          path = 'chapters/' + chapter.id + '/card-' + job.slot + '-' + languageCode + '-' + stamp + '.webp';
          column = job.slot === 'mobile' ? 'card_thumbnail_mobile_url' : 'card_thumbnail_desktop_url';
          oldUrl = job.slot === 'mobile' ? chapter.cardThumbnailMobile : chapter.cardThumbnailDesktop;
        } else {
          path = 'chapters/' + chapter.id + '/chapter-list-' + languageCode + '-' + stamp + '.webp';
          column = 'cover_url';
          oldUrl = chapter.cover;
        }
        await cloudflareR2.from(ATMA_BUCKET).upload(path, file, { upsert: false, contentType: 'image/webp', cacheControl: '31536000' });
        uploaded = path;
        const url = publicAtmaUrl(path);
        const { error } = await supabase.from('chapters').update({ [column]: url }).eq('id', chapter.id);
        if (error) throw new Error('Atma Rekha thumbnail save failed: ' + error.message);
        committed = true;
        const oldPath = pathFromAtmaUrl(oldUrl);
        if (oldPath && oldPath !== path) {
          try { await cloudflareR2.from(ATMA_BUCKET).remove([oldPath]); } catch (cleanupError) { console.warn('Atma thumbnail cleanup failed:', cleanupError); }
        }
      } else {
        const stamp = Date.now();
        let path;
        let column;
        let oldPath;
        if (job.kind === 'cards') {
          path = 'covers/chapters/' + chapter.id + '/card-' + job.slot + '-' + stamp + '.webp';
          column = job.slot === 'mobile' ? 'card_thumbnail_mobile_path' : 'card_thumbnail_desktop_path';
          oldPath = job.slot === 'mobile' ? chapter.cardThumbnailMobilePath : chapter.cardThumbnailDesktopPath;
        } else {
          path = 'covers/chapters/' + chapter.id + '/chapter-list-' + stamp + '.webp';
          column = 'cover_path';
          oldPath = chapter.coverPath;
        }
        await uploadPdlplFile(file, path);
        uploaded = path;
        const { error } = await supabase.from('pal_do_pal_ke_lamhe_chapters').update({ [column]: path }).eq('id', chapter.id);
        if (error) throw new Error('PDPKL thumbnail save failed: ' + error.message);
        committed = true;
        if (oldPath && oldPath !== path) {
          try { await removePdlplFiles([oldPath]); } catch (cleanupError) { console.warn('PDPKL thumbnail cleanup failed:', cleanupError); }
        }
      }

      await supabase.from('admin_activity_log').insert({
        admin_user_id: user.id,
        action: job.kind === 'cards' ? 'thumbnail_studio_save_card' : 'thumbnail_studio_save_chapter_list',
        entity_type: series === 'pdpkl' ? 'pdlpl_chapter' : 'chapter',
        entity_id: chapter.id,
        details: {
          series,
          mode: job.kind,
          slot: job.slot || null,
          language: normalizeChapterLanguage(chapter.language),
          file_name: file.name,
          ratio: job.ratio,
        },
      });

      await load();
      setNotice({
        type: 'success',
        text: (series === 'pdpkl' ? 'PDPKL ' : '') + (job.kind === 'cards' ? (job.slot === 'mobile' ? 'Mobile' : 'Desktop') + ' card thumbnail saved.' : 'Chapter List cover saved.'),
      });
    } catch (error) {
      if (uploaded && !committed) {
        try {
          if (series === 'pdpkl') await removePdlplFiles([uploaded]);
          else await cloudflareR2.from(ATMA_BUCKET).remove([uploaded]);
        } catch (_) {}
      }
      console.error(error);
      setNotice({ type: 'error', text: error.message || 'Thumbnail save failed.' });
    } finally {
      setBusy(false);
    }
  };

  return <section className="admin-stack ar-ts-root">
    <section className="admin-card ar-ts-header-card">
      <div className="admin-card-title">
        <div>
          <span>LIBRARY · NEW</span>
          <h2>Thumbnail Studio</h2>
          <p>Adjust, crop, and replace thumbnails without changing existing public layouts or card behavior.</p>
        </div>
      </div>

      <div className="ar-ts-tabs" role="tablist" aria-label="Thumbnail studio mode">
        <button type="button" className={mode === 'cards' ? 'active' : ''} onClick={() => setMode('cards')} role="tab" aria-selected={mode === 'cards'}>Home / Card thumbnails</button>
        <button type="button" className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')} role="tab" aria-selected={mode === 'list'}>Chapter List thumbnails</button>
      </div>

      <div className="ar-ts-toolbar">
        <div className="ar-ts-series" role="tablist" aria-label="Series">
          <button type="button" className={series === 'atma' ? 'active' : ''} onClick={() => setSeries('atma')} role="tab" aria-selected={series === 'atma'}>Atma Rekha</button>
          <button type="button" className={series === 'pdpkl' ? 'active' : ''} onClick={() => setSeries('pdpkl')} role="tab" aria-selected={series === 'pdpkl'}>PDPKL</button>
        </div>
        <div className="ar-ts-filters">
          <label><span>Search</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Chapter or title" /></label>
          <label><span>Language</span><select value={language} onChange={event => setLanguage(event.target.value)}><option value="all">All languages</option><option value="hi">Hindi</option><option value="en">English</option></select></label>
          <button type="button" onClick={load} disabled={loading || busy}>Refresh</button>
        </div>
      </div>

      <div className="ar-ts-info">
        {mode === 'cards'
          ? <><strong>Safe separation:</strong><span>Home cards use their custom desktop/mobile fields. Chapter List covers remain independent.</span><span>Existing custom thumbnails can be reopened and adjusted.</span></>
          : <><strong>Normal covers:</strong><span>Atma Rekha uses 13:9 crop guidance for the current Chapter List desktop master.</span><span>PDPKL uses 3:4, matching its public chapter-list cover shape.</span></>}
      </div>
    </section>

    {notice.text && <div className={'ar-ts-notice ' + (notice.type === 'error' ? 'error' : 'success')} role="status">{notice.text}</div>}
    {loading ? <div className="admin-loading">Loading thumbnail studio…</div> : !visible.length ? <section className="admin-card ar-ts-empty"><strong>No chapters found</strong><span>Try a different title, number, or language.</span></section> : <div className="ar-ts-list">{visible.map(mode === 'cards' ? renderCard : renderList)}</div>}

    {editor && <CropEditor
      source={editor.file || editor.source}
      sourceName={editor.sourceName}
      ratio={editor.ratio}
      title={editor.title}
      subtitle={editor.subtitle}
      onCancel={() => setEditor(null)}
      onSave={save}
    />}
  </section>;
}
