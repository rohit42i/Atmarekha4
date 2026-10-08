import { useEffect, useMemo, useRef, useState } from 'react';

function makeOutputFile(blob, source) {
  const base = String(source?.name || 'card-thumbnail').replace(/\.[^.]+$/, '');
  const type = blob.type || 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], base + '-cropped.' + ext, { type, lastModified: Date.now() });
}

export default function ImageCropEditor({ file = null, src: sourceUrl = '', aspect = 16 / 9, title = 'Adjust thumbnail', onCancel, onSave }) {
  const [src, setSrc] = useState('');
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const imageRef = useRef(null);

  useEffect(() => {
    if (!file && !sourceUrl) return undefined;
    const url = file ? URL.createObjectURL(file) : sourceUrl;
    setSrc(url);
    setZoom(1); setX(50); setY(50); setRotation(0);
    return () => URL.revokeObjectURL(url);
  }, [file, sourceUrl]);

  const previewStyle = useMemo(() => ({
    transform: 'translate(' + ((x - 50) / 8) + 'px,' + ((y - 50) / 8) + 'px) scale(' + zoom + ') rotate(' + rotation + 'deg)',
  }), [x, y, zoom, rotation]);

  const exportCrop = async () => {
    if (!imageRef.current || busy) return;
    setBusy(true);
    try {
      const image = imageRef.current;
      const targetW = 1280;
      const targetH = Math.round(targetW / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = targetW; canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable in this browser.');
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, targetW, targetH);
      const naturalW = image.naturalWidth;
      const naturalH = image.naturalHeight;
      const baseScale = Math.max(targetW / naturalW, targetH / naturalH) * zoom;
      const drawW = naturalW * baseScale;
      const drawH = naturalH * baseScale;
      const maxOffsetX = Math.max(0, (drawW - targetW) / 2);
      const maxOffsetY = Math.max(0, (drawH - targetH) / 2);
      const offsetX = (x - 50) / 50 * maxOffsetX;
      const offsetY = (y - 50) / 50 * maxOffsetY;
      ctx.save();
      ctx.translate(targetW / 2 + offsetX, targetH / 2 + offsetY);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
      if (!blob) throw new Error('Could not create the edited thumbnail.');
      onSave?.(makeOutputFile(blob, file || { name: 'card-thumbnail.jpg' }));
    } catch (error) {
      console.error(error);
      alert(error.message || 'Could not edit this image.');
    } finally {
      setBusy(false);
    }
  };

  if ((!file && !sourceUrl) || !src) return null;
  return <div className="ar-crop-backdrop" role="dialog" aria-modal="true" aria-label={title}>
    <section className="ar-crop-modal">
      <header className="ar-crop-head">
        <div><span>CARD ART EDITOR</span><h2>{title}</h2><p>Crop, zoom, reposition and rotate before saving.</p></div>
        <button type="button" onClick={onCancel} disabled={busy} aria-label="Close editor">×</button>
      </header>
      <div className="ar-crop-stage" style={{ aspectRatio: String(aspect) }}>
        <img ref={imageRef} src={src} crossOrigin="anonymous" alt="" style={previewStyle} draggable="false" />
        <div className="ar-crop-frame" aria-hidden="true" />
      </div>
      <div className="ar-crop-controls">
        <label><span>Zoom</span><input type="range" min="1" max="3" step=".01" value={zoom} onChange={e => setZoom(Number(e.target.value))}/><b>{zoom.toFixed(2)}×</b></label>
        <label><span>Horizontal</span><input type="range" min="0" max="100" value={x} onChange={e => setX(Number(e.target.value))}/></label>
        <label><span>Vertical</span><input type="range" min="0" max="100" value={y} onChange={e => setY(Number(e.target.value))}/></label>
        <label><span>Rotate</span><input type="range" min="-180" max="180" step="1" value={rotation} onChange={e => setRotation(Number(e.target.value))}/><b>{rotation}°</b></label>
      </div>
      <div className="ar-crop-presets">
        <button type="button" onClick={() => { setZoom(1); setX(50); setY(50); setRotation(0); }}>Reset</button>
        <button type="button" onClick={() => { setX(50); setY(50); }}>Center</button>
      </div>
      <footer className="ar-crop-actions"><button type="button" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="ar-crop-save" onClick={exportCrop} disabled={busy}>{busy ? 'Processing…' : 'Use edited thumbnail'}</button></footer>
    </section>
  </div>;
}
