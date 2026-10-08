import { useEffect, useMemo, useRef, useState } from 'react';
import './admin-thumbnail-studio.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function makeOutputFile(blob, source) {
  const base = String(source?.name || 'chapter-list-thumbnail').replace(/\.[^.]+$/, '');
  return new File([blob], base + '-cropped.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

async function loadRemoteSource(url) {
  const response = await fetch(url, { method: 'GET', credentials: 'omit', cache: 'no-store' });
  if (!response.ok) throw new Error('The current thumbnail could not be loaded for editing.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('The current thumbnail is not a supported image.');
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], 'existing-thumbnail.' + ext, { type: blob.type, lastModified: Date.now() });
}

const PRESETS = [
  { key: 'free', label: 'Free', ratio: null },
  { key: 'wide', label: '13:9', ratio: 13 / 9 },
  { key: 'portrait', label: '3:4', ratio: 3 / 4 },
  { key: 'square', label: '1:1', ratio: 1 },
];

function ratioLabel(width, height) {
  const ratio = width / Math.max(1, height);
  const common = [
    [16 / 9, '16:9'],
    [13 / 9, '13:9'],
    [4 / 5, '4:5'],
    [3 / 4, '3:4'],
    [1, '1:1'],
  ];
  const match = common.find(([value]) => Math.abs(value - ratio) < 0.02);
  return match ? match[1] : ratio.toFixed(2) + ':1';
}

export default function ThumbnailCropEditor({
  file = null,
  src: sourceUrl = '',
  title = 'Edit chapter-list thumbnail',
  subtitle = 'Resize the crop frame, drag the artwork, zoom, and rotate. The live previews show both list breakpoints.',
  previewConfigs = [],
  onCancel,
  onSave,
}) {
  const [sourceFile, setSourceFile] = useState(file);
  const [src, setSrc] = useState('');
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [preset, setPreset] = useState('free');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(Boolean(!file && sourceUrl));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const panRef = useRef(null);
  const resizeRef = useRef(null);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setError('');
    setLoading(Boolean(!file && sourceUrl));

    const prepare = async () => {
      try {
        const resolvedFile = file || (sourceUrl ? await loadRemoteSource(sourceUrl) : null);
        if (!resolvedFile) throw new Error('No image was provided.');
        if (!active) return;
        objectUrl = URL.createObjectURL(resolvedFile);
        setSourceFile(resolvedFile);
        setSrc(objectUrl);
        setNaturalSize({ width: 0, height: 0 });
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
      } catch (loadError) {
        if (active) setError(loadError?.message || 'Unable to prepare this thumbnail.');
      } finally {
        if (active) setLoading(false);
      }
    };

    prepare();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, sourceUrl]);

  useEffect(() => {
    if (!stageRef.current) return undefined;
    const measure = () => {
      const rect = stageRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setStageSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(stageRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [src]);

  const defaultCrop = (width, height, ratio = null) => {
    const maxW = Math.max(100, width * 0.82);
    const maxH = Math.max(100, height * 0.82);
    if (!ratio) return { width: maxW, height: maxH };
    let nextW = maxW;
    let nextH = nextW / ratio;
    if (nextH > maxH) {
      nextH = maxH;
      nextW = nextH * ratio;
    }
    return { width: Math.max(90, nextW), height: Math.max(90, nextH) };
  };

  useEffect(() => {
    if (!stageSize.width || !stageSize.height) return;
    setCrop(current => {
      if (current.width && current.height) return current;
      const size = defaultCrop(stageSize.width, stageSize.height, PRESETS.find(item => item.key === preset)?.ratio || null);
      return { x: (stageSize.width - size.width) / 2, y: (stageSize.height - size.height) / 2, ...size };
    });
  }, [stageSize.width, stageSize.height, preset]);

  const rotatedNatural = useMemo(() => {
    const quarter = ((rotation % 180) + 180) % 180 !== 0;
    return {
      width: quarter ? naturalSize.height : naturalSize.width,
      height: quarter ? naturalSize.width : naturalSize.height,
    };
  }, [naturalSize, rotation]);

  const metrics = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height || !stageSize.width || !stageSize.height || !crop.width || !crop.height) return null;
    const baseScale = Math.max(
      crop.width / Math.max(1, rotatedNatural.width),
      crop.height / Math.max(1, rotatedNatural.height),
    );
    const drawW = naturalSize.width * baseScale * zoom;
    const drawH = naturalSize.height * baseScale * zoom;
    const visibleW = rotatedNatural.width * baseScale * zoom;
    const visibleH = rotatedNatural.height * baseScale * zoom;
    return {
      drawW,
      drawH,
      maxPanX: Math.max(0, (visibleW - crop.width) / 2),
      maxPanY: Math.max(0, (visibleH - crop.height) / 2),
    };
  }, [naturalSize, stageSize, crop, rotatedNatural, zoom]);

  useEffect(() => {
    if (!stageSize.width || !stageSize.height || !crop.width || !crop.height) return;
    setCrop(current => ({
      width: clamp(current.width || crop.width, 90, stageSize.width - 18),
      height: clamp(current.height || crop.height, 90, stageSize.height - 18),
    }));
  }, [stageSize.width, stageSize.height]);

  useEffect(() => {
    setPan(current => metrics ? {
      x: clamp(current.x, -metrics.maxPanX, metrics.maxPanX),
      y: clamp(current.y, -metrics.maxPanY, metrics.maxPanY),
    } : current);
  }, [metrics?.maxPanX, metrics?.maxPanY]);

  const applyPreset = key => {
    if (!stageSize.width || !stageSize.height) return;
    const ratio = PRESETS.find(item => item.key === key)?.ratio || null;
    setPreset(key);
    const size = defaultCrop(stageSize.width, stageSize.height, ratio);
    setCrop({ x: (stageSize.width - size.width) / 2, y: (stageSize.height - size.height) / 2, ...size });
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const resetAll = () => {
    if (!stageSize.width || !stageSize.height) return;
    const ratio = PRESETS.find(item => item.key === preset)?.ratio || null;
    const size = defaultCrop(stageSize.width, stageSize.height, ratio);
    setCrop({ x: (stageSize.width - size.width) / 2, y: (stageSize.height - size.height) / 2, ...size });
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const startPan = event => {
    if (busy || error || !metrics) return;
    if (event.target instanceof HTMLElement && event.target.dataset?.cropHandle) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...pan },
    };
  };

  const movePan = event => {
    const drag = panRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !metrics) return;
    event.preventDefault();
    setPan({
      x: clamp(drag.origin.x + event.clientX - drag.startX, -metrics.maxPanX, metrics.maxPanX),
      y: clamp(drag.origin.y + event.clientY - drag.startY, -metrics.maxPanY, metrics.maxPanY),
    });
  };

  const stopPan = event => {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  };

  const startResize = (handle, event) => {
    if (busy || error || !crop.width || !crop.height) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeRef.current = {
      pointerId: event.pointerId,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...crop },
    };
  };

  const moveResize = event => {
    const drag = resizeRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stageSize.width || !stageSize.height) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    let width = drag.origin.width;
    let height = drag.origin.height;
    const fixedRatio = PRESETS.find(item => item.key === preset)?.ratio || null;
    const minSize = 90;
    let left = drag.origin.x;
    let top = drag.origin.y;

    if (fixedRatio) {
      const sx = drag.handle.includes('w') ? -1 : 1;
      const sy = drag.handle.includes('n') ? -1 : 1;
      const rawWidth = drag.origin.width + dx * sx;
      const rawHeight = drag.origin.height + dy * sy;
      let nextWidth = Math.max(minSize, rawWidth);
      let nextHeight = Math.max(minSize, rawHeight);
      if (Math.abs(dx) >= Math.abs(dy)) nextHeight = nextWidth / fixedRatio;
      else nextWidth = nextHeight * fixedRatio;

      const maxWidth = drag.handle.includes('w') ? drag.origin.x + drag.origin.width : stageSize.width - drag.origin.x;
      const maxHeight = drag.handle.includes('n') ? drag.origin.y + drag.origin.height : stageSize.height - drag.origin.y;
      const scaleDown = Math.min(1, maxWidth / nextWidth, maxHeight / nextHeight);
      nextWidth *= scaleDown;
      nextHeight *= scaleDown;
      width = clamp(nextWidth, minSize, maxWidth);
      height = clamp(nextHeight, minSize, maxHeight);
      if (drag.handle.includes('w')) left = drag.origin.x + drag.origin.width - width;
      if (drag.handle.includes('n')) top = drag.origin.y + drag.origin.height - height;
    } else {
      if (drag.handle.includes('e')) width = clamp(drag.origin.width + dx, minSize, stageSize.width - drag.origin.x - 9);
      if (drag.handle.includes('w')) {
        const nextLeft = clamp(drag.origin.x + dx, 9, drag.origin.x + drag.origin.width - minSize);
        left = nextLeft;
        width = drag.origin.x + drag.origin.width - nextLeft;
      }
      if (drag.handle.includes('s')) height = clamp(drag.origin.height + dy, minSize, stageSize.height - drag.origin.y - 9);
      if (drag.handle.includes('n')) {
        const nextTop = clamp(drag.origin.y + dy, 9, drag.origin.y + drag.origin.height - minSize);
        top = nextTop;
        height = drag.origin.y + drag.origin.height - nextTop;
      }
    }

    if (fixedRatio) {
      if (drag.handle.includes('e')) left = drag.origin.x;
      if (drag.handle.includes('s')) top = drag.origin.y;
      if (!drag.handle.includes('w')) left = drag.origin.x;
      if (!drag.handle.includes('n')) top = drag.origin.y;
      left = clamp(left, 9, stageSize.width - width - 9);
      top = clamp(top, 9, stageSize.height - height - 9);
    }

    setPreset(fixedRatio ? preset : 'free');
    setCrop({
      x: left,
      y: top,
      width: clamp(width, minSize, stageSize.width - 18),
      height: clamp(height, minSize, stageSize.height - 18),
    });
  };

  const stopResize = event => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
  };

  const rotate = direction => {
    const next = ((rotation + direction) % 360 + 360) % 360;
    setRotation(next);
    setPan({ x: 0, y: 0 });
  };

  const zoomTo = value => {
    const next = clamp(Number(value) || 1, 1, 4);
    setZoom(next);
  };

  const exportCrop = async () => {
    if (!imageRef.current || !metrics || !crop.width || !crop.height || busy) return;
    setBusy(true);
    setError('');
    try {
      const cropAspect = crop.width / crop.height;
      const targetLongEdge = 1600;
      const targetW = cropAspect >= 1 ? targetLongEdge : Math.max(960, Math.round(targetLongEdge * cropAspect));
      const targetH = Math.round(targetW / cropAspect);
      const scale = targetW / crop.width;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, targetW);
      canvas.height = Math.max(1, targetH);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas encoding is unavailable in this browser.');

      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2 + pan.x * scale, canvas.height / 2 + pan.y * scale);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(
        imageRef.current,
        -(metrics.drawW * scale) / 2,
        -(metrics.drawH * scale) / 2,
        metrics.drawW * scale,
        metrics.drawH * scale,
      );
      ctx.restore();

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.94));
      if (!blob) throw new Error('Could not create the cropped thumbnail.');
      onSave?.(makeOutputFile(blob, sourceFile));
    } catch (exportError) {
      console.error(exportError);
      setError(exportError?.message || 'Could not save this crop.');
    } finally {
      setBusy(false);
    }
  };

  const cropStyle = stageSize.width && crop.width ? {
    width: crop.width + 'px',
    height: crop.height + 'px',
  } : { width: '0px', height: '0px' };

  const imageStyle = metrics ? {
    left: (crop.x + crop.width / 2) + 'px',
    top: (crop.y + crop.height / 2) + 'px',
    width: metrics.drawW + 'px',
    height: metrics.drawH + 'px',
    transform: 'translate3d(calc(-50% + ' + pan.x + 'px), calc(-50% + ' + pan.y + 'px), 0) rotate(' + rotation + 'deg)',
  } : undefined;

  const previewItems = previewConfigs.length ? previewConfigs : [
    { key: 'default', label: 'Preview', width: 160, height: 110 },
  ];

  return (
    <div className="ar-ts-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <section className="ar-ts-modal">
        <header className="ar-ts-head">
          <div>
            <span>THUMBNAIL STUDIO</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Close editor">×</button>
        </header>

        <div className="ar-ts-body">
          <section className="ar-ts-editor-area">
            <div className="ar-ts-toolbar">
              <div className="ar-ts-tool-group">
                <span>Crop ratio</span>
                <div className="ar-ts-segmented">
                  {PRESETS.map(item => (
                    <button key={item.key} type="button" className={preset === item.key ? 'active' : ''} onClick={() => applyPreset(item.key)} disabled={busy}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ar-ts-tool-group ar-ts-tool-group--compact">
                <span>Zoom</span>
                <div className="ar-ts-zoom">
                  <button type="button" onClick={() => zoomTo(zoom - .1)} disabled={busy || zoom <= 1} aria-label="Zoom out">−</button>
                  <input type="range" min="1" max="4" step=".01" value={zoom} onChange={event => zoomTo(event.target.value)} aria-label="Zoom" />
                  <b>{zoom.toFixed(2)}×</b>
                  <button type="button" onClick={() => zoomTo(zoom + .1)} disabled={busy || zoom >= 4} aria-label="Zoom in">+</button>
                </div>
              </div>
            </div>

            <div
              ref={stageRef}
              className="ar-ts-stage"
              onPointerDown={startPan}
              onPointerMove={movePan}
              onPointerUp={stopPan}
              onPointerCancel={stopPan}
              onWheel={event => { if (!busy) { event.preventDefault(); zoomTo(zoom - event.deltaY * 0.0015); } }}
            >
              {src && <img ref={imageRef} className="ar-ts-image" src={src} alt="" style={imageStyle} draggable="false" onLoad={event => {
                setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
                setError('');
              }} onError={() => setError('This image could not be loaded for editing.')} />}
              <div className="ar-ts-dim" aria-hidden="true" />
              <div className="ar-ts-crop-box" style={cropStyle} aria-label="Crop frame">
                <div className="ar-ts-grid ar-ts-grid-v1" />
                <div className="ar-ts-grid ar-ts-grid-v2" />
                <div className="ar-ts-grid ar-ts-grid-h1" />
                <div className="ar-ts-grid ar-ts-grid-h2" />
                {['nw', 'ne', 'sw', 'se'].map(handle => (
                  <button
                    key={handle}
                    type="button"
                    className={'ar-ts-handle ar-ts-handle--' + handle}
                    data-crop-handle="true"
                    onPointerDown={event => startResize(handle, event)}
                    onPointerMove={moveResize}
                    onPointerUp={stopResize}
                    onPointerCancel={stopResize}
                    aria-label={'Resize crop ' + handle}
                  />
                ))}
              </div>
              <span className="ar-ts-drag-hint">Drag image · Drag corners to crop</span>
              {(loading || !stageSize.width) && <div className="ar-ts-loading">Preparing image…</div>}
            </div>

            <div className="ar-ts-controls">
              <button type="button" onClick={() => rotate(-90)} disabled={busy || !naturalSize.width}>Rotate left</button>
              <button type="button" onClick={() => rotate(90)} disabled={busy || !naturalSize.width}>Rotate right</button>
              <button type="button" onClick={() => { setPan({ x: 0, y: 0 }); }} disabled={busy}>Center image</button>
              <button type="button" onClick={resetAll} disabled={busy}>Reset</button>
            </div>

            {error && <div className="ar-ts-error" role="alert">{error}</div>}
          </section>

          <aside className="ar-ts-preview-panel">
            <div className="ar-ts-preview-head">
              <span>LIVE LIST PREVIEW</span>
              <strong>{crop.width && crop.height ? ratioLabel(crop.width, crop.height) : '—'}</strong>
            </div>
            <p>These previews use the same saved image with the existing Chapter List object-fit behavior.</p>
            <div className="ar-ts-preview-grid">
              {previewItems.map(item => (
                <figure key={item.key} className="ar-ts-preview-card">
                  <div className="ar-ts-preview-frame" style={{ width: item.width + 'px', height: item.height + 'px' }}>
                    {src ? <div className="ar-ts-preview-image-wrap" style={{
                      width: metrics ? metrics.drawW * (item.width / Math.max(1, crop.width)) + 'px' : 'auto',
                      height: metrics ? metrics.drawH * (item.width / Math.max(1, crop.width)) + 'px' : 'auto',
                      left: '50%',
                      top: '50%',
                      transform: 'translate3d(calc(-50% + ' + pan.x * (item.width / Math.max(1, crop.width)) + 'px), calc(-50% + ' + pan.y * (item.width / Math.max(1, crop.width)) + 'px), 0) rotate(' + rotation + 'deg)',
                    }}><img src={src} alt="" /></div> : null}
                  </div>
                  <figcaption><strong>{item.label}</strong><span>{item.width}×{item.height}</span></figcaption>
                </figure>
              ))}
            </div>
            <div className="ar-ts-summary">
              <span>Output</span>
              <strong>Up to 1600px long edge</strong>
              <small>JPEG · high quality · cropped only inside this studio</small>
            </div>
          </aside>
        </div>

        <footer className="ar-ts-footer">
          <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="ar-ts-save" onClick={exportCrop} disabled={busy || Boolean(error) || !naturalSize.width}>
            {busy ? 'Saving crop…' : 'Save cropped thumbnail'}
          </button>
        </footer>
      </section>
    </div>
  );
}
