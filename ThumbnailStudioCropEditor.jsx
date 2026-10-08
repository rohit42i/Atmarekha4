import { useEffect, useMemo, useRef, useState } from 'react';
import './thumbnail-studio.css';

function normalizeRotation(value) {
  const next = Number(value) || 0;
  return ((next % 360) + 360) % 360;
}

function extensionFromMime(mime) {
  const type = String(mime || '').toLowerCase();
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export default function ThumbnailStudioCropEditor({
  file = null,
  src: sourceUrl = '',
  aspect = 16 / 9,
  title = 'Adjust thumbnail',
  subtitle = 'Drag the image inside the frame. Use zoom, position, and rotation for a precise crop.',
  outputLabel = '',
  outputWidth = 1600,
  onCancel,
  onSave,
}) {
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const objectUrlRef = useRef('');
  const [src, setSrc] = useState('');
  const [imageInfo, setImageInfo] = useState(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const safeAspect = Number(aspect) > 0 ? Number(aspect) : 16 / 9;
  const output = useMemo(() => {
    const width = Math.max(320, Math.round(Number(outputWidth) || 1600));
    return { width, height: Math.max(1, Math.round(width / safeAspect)) };
  }, [outputWidth, safeAspect]);

  useEffect(() => {
    setError('');
    setImageInfo(null);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    }

    if (file) {
      const nextUrl = URL.createObjectURL(file);
      objectUrlRef.current = nextUrl;
      setSrc(nextUrl);
    } else {
      setSrc(String(sourceUrl || ''));
    }

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    };
  }, [file, sourceUrl]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;

    const update = () => setStage({
      width: node.clientWidth,
      height: node.clientHeight,
    });

    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!src) return undefined;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => setImageInfo({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
    image.onerror = () => {
      setImageInfo(null);
      setError('This image could not be loaded for editing. Try uploading it again.');
    };
    image.src = src;
    return undefined;
  }, [src]);

  const geometry = useMemo(() => {
    if (!imageInfo || stage.width <= 0 || stage.height <= 0) return null;
    const quarterTurn = normalizeRotation(rotation) % 180 !== 0;
    const rotatedWidth = quarterTurn ? imageInfo.height : imageInfo.width;
    const rotatedHeight = quarterTurn ? imageInfo.width : imageInfo.height;
    const scale = Math.max(stage.width / rotatedWidth, stage.height / rotatedHeight) * zoom;
    const imageWidth = imageInfo.width * scale;
    const imageHeight = imageInfo.height * scale;
    const frameWidth = rotatedWidth * scale;
    const frameHeight = rotatedHeight * scale;
    const maxX = Math.max(0, (frameWidth - stage.width) / 2);
    const maxY = Math.max(0, (frameHeight - stage.height) / 2);
    return {
      imageWidth,
      imageHeight,
      frameWidth,
      frameHeight,
      maxX,
      maxY,
      offsetX: position.x * maxX,
      offsetY: position.y * maxY,
    };
  }, [imageInfo, position, rotation, stage.height, stage.width, zoom]);

  useEffect(() => {
    setPosition(current => ({
      x: Math.max(-1, Math.min(1, current.x)),
      y: Math.max(-1, Math.min(1, current.y)),
    }));
  }, [zoom, rotation, stage.width, stage.height, imageInfo]);

  const nudgeZoom = amount => {
    setZoom(value => Math.max(1, Math.min(5, Number((value + amount).toFixed(2)))));
  };

  const rotateBy = amount => {
    setRotation(value => normalizeRotation(value + amount));
  };

  const reset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setError('');
  };

  const onPointerDown = event => {
    if (!imageInfo || event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  const onPointerMove = event => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !geometry) return;
    const divisorX = Math.max(1, geometry.maxX);
    const divisorY = Math.max(1, geometry.maxY);
    setPosition({
      x: Math.max(-1, Math.min(1, drag.startX + (event.clientX - drag.clientX) / divisorX)),
      y: Math.max(-1, Math.min(1, drag.startY + (event.clientY - drag.clientY) / divisorY)),
    });
  };

  const onPointerUp = event => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const onWheel = event => {
    if (!imageInfo) return;
    event.preventDefault();
    nudgeZoom(event.deltaY < 0 ? 0.12 : -0.12);
  };

  const exportCrop = async () => {
    if (!imageInfo || !src || !geometry || saving) return;
    setSaving(true);
    setError('');

    try {
      const image = imageRef.current;
      if (!image?.complete || image.naturalWidth === 0) throw new Error('The source image is not ready yet.');

      const canvas = document.createElement('canvas');
      canvas.width = output.width;
      canvas.height = output.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not create the crop canvas.');

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      const quarterTurn = normalizeRotation(rotation) % 180 !== 0;
      const rotatedWidth = quarterTurn ? imageInfo.height : imageInfo.width;
      const rotatedHeight = quarterTurn ? imageInfo.width : imageInfo.height;
      const scale = Math.max(output.width / rotatedWidth, output.height / rotatedHeight) * zoom;
      const drawWidth = imageInfo.width * scale;
      const drawHeight = imageInfo.height * scale;
      const maxOffsetX = Math.max(0, (rotatedWidth * scale - output.width) / 2);
      const maxOffsetY = Math.max(0, (rotatedHeight * scale - output.height) / 2);
      const offsetX = position.x * maxOffsetX;
      const offsetY = position.y * maxOffsetY;

      context.save();
      context.translate(output.width / 2 + offsetX, output.height / 2 + offsetY);
      context.rotate((normalizeRotation(rotation) * Math.PI) / 180);
      context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      context.restore();

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(value => value ? resolve(value) : reject(new Error('The crop could not be exported.')), 'image/jpeg', 0.92);
      });

      const safeName = String(file?.name || 'thumbnail').replace(/\.[^.]+$/, '') || 'thumbnail';
      const outputFile = new File(
        [blob],
        safeName + '-cropped.' + extensionFromMime('image/jpeg'),
        { type: 'image/jpeg', lastModified: Date.now() },
      );

      await onSave?.(outputFile);
    } catch (saveError) {
      setError(saveError?.message || 'Unable to save this crop.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ts-editor-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <section className="ts-editor">
        <header className="ts-editor-head">
          <div>
            <span className="ts-kicker">THUMBNAIL STUDIO</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="ts-icon-button" onClick={onCancel} aria-label="Close crop editor">×</button>
        </header>

        <div className="ts-editor-layout">
          <div className="ts-stage-column">
            <div
              ref={stageRef}
              className="ts-crop-stage"
              style={{ aspectRatio: String(safeAspect) }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
            >
              <div className="ts-crop-grid" aria-hidden="true">
                <i /><i /><i /><i />
              </div>
              {geometry && (
                <div
                  className="ts-crop-image-frame"
                  style={{
                    width: geometry.frameWidth,
                    height: geometry.frameHeight,
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%) translate(' + geometry.offsetX + 'px, ' + geometry.offsetY + 'px)',
                  }}
                >
                  <img
                    ref={imageRef}
                    crossOrigin="anonymous"
                    src={src}
                    alt=""
                    draggable="false"
                    style={{
                      width: geometry.imageWidth,
                      height: geometry.imageHeight,
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%) rotate(' + normalizeRotation(rotation) + 'deg)',
                    }}
                  />
                </div>
              )}
              {!imageInfo && src && <div className="ts-stage-status">Loading image…</div>}
              {!src && <div className="ts-stage-status">Choose an image to start</div>}
              <span className="ts-crop-label">{safeAspect.toFixed(2)} : 1</span>
            </div>

            <div className="ts-editor-help">
              <span><b>Drag</b> to reframe</span>
              <span><b>Scroll</b> to zoom</span>
              <span><b>Grid</b> marks the focal area</span>
            </div>
          </div>

          <aside className="ts-controls">
            <section className="ts-control-group">
              <div className="ts-control-heading"><strong>Zoom</strong><output>{Math.round(zoom * 100)}%</output></div>
              <div className="ts-stepper">
                <button type="button" onClick={() => nudgeZoom(-0.1)} aria-label="Zoom out">−</button>
                <input aria-label="Zoom" type="range" min="1" max="5" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} />
                <button type="button" onClick={() => nudgeZoom(0.1)} aria-label="Zoom in">+</button>
              </div>
            </section>

            <section className="ts-control-group">
              <div className="ts-control-heading"><strong>Position</strong><span>Fine tune</span></div>
              <label className="ts-range-row"><span>Horizontal</span><input type="range" min="-1" max="1" step="0.01" value={position.x} onChange={event => setPosition(current => ({ ...current, x: Number(event.target.value) }))} /></label>
              <label className="ts-range-row"><span>Vertical</span><input type="range" min="-1" max="1" step="0.01" value={position.y} onChange={event => setPosition(current => ({ ...current, y: Number(event.target.value) }))} /></label>
            </section>

            <section className="ts-control-group">
              <div className="ts-control-heading"><strong>Rotation</strong><output>{normalizeRotation(rotation)}°</output></div>
              <div className="ts-rotation-actions">
                <button type="button" onClick={() => rotateBy(-90)}>↶ 90°</button>
                <button type="button" onClick={() => rotateBy(90)}>↷ 90°</button>
              </div>
            </section>

            <section className="ts-output-card">
              <span>OUTPUT</span>
              <strong>{output.width} × {output.height}px</strong>
              <small>{outputLabel || (safeAspect.toFixed(2) + ':1 thumbnail')}</small>
            </section>

            {error && <p className="ts-editor-error" role="alert">{error}</p>}

            <div className="ts-editor-actions">
              <button type="button" onClick={reset} disabled={saving}>Reset</button>
              <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
              <button type="button" className="ts-save-button" onClick={exportCrop} disabled={saving || !imageInfo}>
                {saving ? 'Saving…' : 'Save crop'}
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
