import { useCallback, useEffect, useRef, useState } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeQuarterTurn = value => ((value % 360) + 360) % 360;
const isQuarterTurn = rotation => normalizeQuarterTurn(rotation) % 180 !== 0;

function makeOutputFile(blob, source) {
  const base = String(source?.name || 'card-thumbnail').replace(/\.[^.]+$/, '');
  const type = blob.type || 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], base + '-cropped.' + ext, { type, lastModified: Date.now() });
}

export default function ImageCropEditor({
  file = null,
  src: sourceUrl = '',
  aspect = 16 / 9,
  title = 'Adjust thumbnail',
  onCancel,
  onSave,
}) {
  const [src, setSrc] = useState('');
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    if (!file && !sourceUrl) return undefined;
    const objectUrl = file ? URL.createObjectURL(file) : '';
    setSrc(objectUrl || sourceUrl);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setError('');
    setNaturalSize({ width: 0, height: 0 });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, sourceUrl]);

  useEffect(() => {
    if (!stageRef.current) return undefined;
    const update = () => {
      const rect = stageRef.current.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(stageRef.current);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [src]);

  const getMetrics = useCallback((nextZoom = zoom, nextRotation = rotation) => {
    const nw = naturalSize.width;
    const nh = naturalSize.height;
    const sw = stageSize.width;
    const sh = stageSize.height;
    if (!nw || !nh || !sw || !sh) return null;

    const quarterTurn = isQuarterTurn(nextRotation);
    const coverW = quarterTurn ? nh : nw;
    const coverH = quarterTurn ? nw : nh;
    const baseScale = Math.max(sw / coverW, sh / coverH);
    const drawW = nw * baseScale * nextZoom;
    const drawH = nh * baseScale * nextZoom;
    const visibleW = quarterTurn ? drawH : drawW;
    const visibleH = quarterTurn ? drawW : drawH;

    return {
      drawW,
      drawH,
      maxX: Math.max(0, (visibleW - sw) / 2),
      maxY: Math.max(0, (visibleH - sh) / 2),
    };
  }, [naturalSize, stageSize, zoom, rotation]);

  const clampPosition = useCallback((next, nextZoom = zoom, nextRotation = rotation) => {
    const metrics = getMetrics(nextZoom, nextRotation);
    if (!metrics) return next;
    return {
      x: clamp(next.x, -metrics.maxX, metrics.maxX),
      y: clamp(next.y, -metrics.maxY, metrics.maxY),
    };
  }, [getMetrics, zoom, rotation]);

  useEffect(() => {
    setPosition(current => clampPosition(current));
  }, [clampPosition]);

  const setZoomSafe = nextValue => {
    const nextZoom = clamp(Number(nextValue) || 1, 1, 4);
    setZoom(nextZoom);
    setPosition(current => clampPosition(current, nextZoom, rotation));
  };

  const rotateBy = degrees => {
    const nextRotation = normalizeQuarterTurn(rotation + degrees);
    setRotation(nextRotation);
    setPosition(current => clampPosition(current, zoom, nextRotation));
  };

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
      x: drag.origin.x + (event.clientX - drag.startX),
      y: drag.origin.y + (event.clientY - drag.startY),
    }));
  };

  const stopDrag = event => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const handleImageLoad = event => {
    const image = event.currentTarget;
    setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
    setError('');
  };

  const exportCrop = async () => {
    if (!imageRef.current || busy || !naturalSize.width || !naturalSize.height) return;
    setBusy(true);
    setError('');
    try {
      const image = imageRef.current;
      const targetW = 1440;
      const targetH = Math.round(targetW / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable in this browser.');

      const quarterTurn = isQuarterTurn(rotation);
      const coverW = quarterTurn ? image.naturalHeight : image.naturalWidth;
      const coverH = quarterTurn ? image.naturalWidth : image.naturalHeight;
      const baseScale = Math.max(targetW / coverW, targetH / coverH);
      const drawW = image.naturalWidth * baseScale * zoom;
      const drawH = image.naturalHeight * baseScale * zoom;
      const previewScaleX = stageSize.width ? targetW / stageSize.width : 1;
      const previewScaleY = stageSize.height ? targetH / stageSize.height : 1;

      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.translate(
        targetW / 2 + position.x * previewScaleX,
        targetH / 2 + position.y * previewScaleY,
      );
      ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .94));
      if (!blob) throw new Error('Could not create the edited thumbnail.');
      onSave?.(makeOutputFile(blob, file || { name: 'card-thumbnail.jpg' }));
    } catch (exportError) {
      console.error(exportError);
      setError(exportError?.message || 'Could not create the edited thumbnail.');
    } finally {
      setBusy(false);
    }
  };

  if ((!file && !sourceUrl) || !src) return null;

  const metrics = getMetrics() || { drawW: 0, drawH: 0 };
  const imageStyle = {
    width: metrics.drawW ? metrics.drawW + 'px' : '100%',
    height: metrics.drawH ? metrics.drawH + 'px' : 'auto',
    transform:
      'translate3d(calc(-50% + ' + position.x + 'px), calc(-50% + ' + position.y + 'px), 0) rotate(' +
      rotation +
      'deg)',
  };

  return (
    <div className="ar-crop-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <section className="ar-crop-modal">
        <header className="ar-crop-head">
          <div>
            <span>CARD ART EDITOR</span>
            <h2>{title}</h2>
            <p>Drag the artwork inside the frame. Zoom and rotate, then save the exact crop.</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Close editor">×</button>
        </header>

        <div className="ar-crop-workspace">
          <div className="ar-crop-stage-wrap">
            <div
              ref={stageRef}
              className="ar-crop-stage"
              style={{ aspectRatio: String(aspect) }}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
            >
              <img
                ref={imageRef}
                src={src}
                crossOrigin="anonymous"
                alt=""
                style={imageStyle}
                draggable="false"
                onLoad={handleImageLoad}
                onError={() => setError('This image could not be loaded for editing.')}
              />
              <div className="ar-crop-dim" aria-hidden="true" />
              <div className="ar-crop-frame" aria-hidden="true">
                <i className="ar-crop-grid ar-crop-grid-v1" />
                <i className="ar-crop-grid ar-crop-grid-v2" />
                <i className="ar-crop-grid ar-crop-grid-h1" />
                <i className="ar-crop-grid ar-crop-grid-h2" />
                <b className="ar-crop-handle ar-crop-handle-tl" />
                <b className="ar-crop-handle ar-crop-handle-tr" />
                <b className="ar-crop-handle ar-crop-handle-bl" />
                <b className="ar-crop-handle ar-crop-handle-br" />
              </div>
              <span className="ar-crop-drag-hint">Drag to reposition</span>
            </div>
            <div className="ar-crop-output-meta">
              <span>Output</span>
              <strong>{aspect >= 1 ? '16:9 · Desktop / PC' : '3:4 · Mobile'}</strong>
              <small>Fixed card ratio</small>
            </div>
          </div>

          <aside className="ar-crop-toolbar" aria-label="Crop controls">
            <section className="ar-crop-tool-group">
              <div className="ar-crop-tool-title"><strong>Zoom</strong><b>{zoom.toFixed(2)}×</b></div>
              <div className="ar-crop-zoom-row">
                <button type="button" onClick={() => setZoomSafe(zoom - .1)} disabled={busy || zoom <= 1} aria-label="Zoom out">−</button>
                <input aria-label="Zoom" type="range" min="1" max="4" step=".01" value={zoom} onChange={e => setZoomSafe(e.target.value)} />
                <button type="button" onClick={() => setZoomSafe(zoom + .1)} disabled={busy || zoom >= 4} aria-label="Zoom in">+</button>
              </div>
            </section>

            <section className="ar-crop-tool-group">
              <div className="ar-crop-tool-title"><strong>Rotate</strong><b>{rotation}°</b></div>
              <div className="ar-crop-button-row">
                <button type="button" onClick={() => rotateBy(-90)} disabled={busy}>Rotate left</button>
                <button type="button" onClick={() => rotateBy(90)} disabled={busy}>Rotate right</button>
              </div>
            </section>

            <section className="ar-crop-tool-group">
              <div className="ar-crop-tool-title"><strong>Position</strong><span>Drag the image</span></div>
              <div className="ar-crop-button-row compact">
                <button type="button" onClick={() => setPosition({ x: 0, y: 0 })} disabled={busy}>Center</button>
                <button type="button" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }} disabled={busy}>Fit</button>
                <button type="button" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); setRotation(0); }} disabled={busy}>Reset</button>
              </div>
            </section>

            {error && <div className="ar-crop-error" role="alert">{error}</div>}
          </aside>
        </div>

        <footer className="ar-crop-actions">
          <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="ar-crop-save" onClick={exportCrop} disabled={busy || Boolean(error) || !naturalSize.width}>
            {busy ? 'Processing…' : 'Save crop'}
          </button>
        </footer>
      </section>
    </div>
  );
}
