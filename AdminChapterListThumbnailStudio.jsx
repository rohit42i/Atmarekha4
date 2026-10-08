import { useMemo, useState } from 'react';
import ThumbnailCropEditor from './ThumbnailCropEditor.jsx';
import { chapterLanguageLabel, normalizeChapterLanguage } from './chapters';

const labelFor = chapter => chapter?.chapterNumber == null ? 'Special' : 'Chapter ' + chapter.chapterNumber;

const dimensionsFor = series => series === 'pdpkl'
  ? { desktop: [72, 96], mobile: [56, 76] }
  : { desktop: [104, 72], mobile: [76, 100] };

export default function AdminChapterListThumbnailStudio({
  chapters = [],
  pdpklChapters = [],
  busy = false,
  onSave,
}) {
  const [series, setSeries] = useState('atma');
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('all');
  const [editor, setEditor] = useState(null);

  const source = series === 'pdpkl' ? pdpklChapters : chapters;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...source]
      .filter(chapter => language === 'all' || normalizeChapterLanguage(chapter.language) === language)
      .filter(chapter => !needle || [
        labelFor(chapter),
        chapter.title,
        chapter.id,
        chapterLanguageLabel(chapter.language),
      ].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => {
        const an = a.chapterNumber == null ? Infinity : Number(a.chapterNumber);
        const bn = b.chapterNumber == null ? Infinity : Number(b.chapterNumber);
        return an !== bn ? an - bn : new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
  }, [source, query, language]);

  const openUpload = (chapter, file) => {
    setEditor({ chapter, file, series });
  };

  const openCurrent = chapter => {
    if (!chapter?.cover) return;
    setEditor({ chapter, src: chapter.cover, series });
  };

  const dims = dimensionsFor(series);

  return (
    <>
      <section className="admin-stack ar-ts-manager">
        <section className="admin-card ar-ts-manager-head">
          <div className="admin-card-title">
            <div>
              <span>LIBRARY · CHAPTER LIST</span>
              <h2>Chapter List Thumbnail Studio</h2>
              <p>Edit the normal chapter-list thumbnail without touching the separate Home Card thumbnail settings. Works for Atma Rekha and PDPKL.</p>
            </div>
          </div>

          <div className="ar-ts-series" role="tablist" aria-label="Series">
            <button type="button" className={series === 'atma' ? 'active' : ''} onClick={() => setSeries('atma')} role="tab" aria-selected={series === 'atma'}>Atma Rekha</button>
            <button type="button" className={series === 'pdpkl' ? 'active' : ''} onClick={() => setSeries('pdpkl')} role="tab" aria-selected={series === 'pdpkl'}>PDPKL</button>
          </div>

          <div className="ar-ts-note">
            <strong>How it works</strong>
            <span>Upload a new image and crop it.</span>
            <span>Open an existing thumbnail and adjust it again.</span>
            <span>No Home Card thumbnail fields are changed.</span>
          </div>

          <div className="ar-ts-controls-row">
            <label>
              <span>Search</span>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Chapter or title" />
            </label>
            <label>
              <span>Language</span>
              <select value={language} onChange={event => setLanguage(event.target.value)}>
                <option value="all">All languages</option>
                <option value="hi">Hindi</option>
                <option value="en">English</option>
              </select>
            </label>
            <small>{visible.length} result{visible.length === 1 ? '' : 's'}</small>
          </div>
        </section>

        <section className="ar-ts-list">
          {visible.map(chapter => (
            <article className="admin-card ar-ts-chapter-card" key={chapter.id}>
              <header>
                <div>
                  <span>{series === 'pdpkl' ? 'PDPKL · ' : ''}{chapterLanguageLabel(chapter.language)}</span>
                  <h3>{labelFor(chapter)}</h3>
                  <p>{chapter.title || 'Untitled chapter'}</p>
                </div>
                <code>{String(chapter.id).slice(0, 8)}</code>
              </header>

              <div className="ar-ts-thumb-grid">
                <figure className="ar-ts-thumb-preview">
                  <div className="ar-ts-preview-frame" style={{ width: dims.desktop[0] + 'px', height: dims.desktop[1] + 'px' }}>
                    {chapter.cover ? <img src={chapter.cover} alt="" loading="lazy" decoding="async" /> : <span>{series === 'pdpkl' ? 'PDPKL' : 'AR'}</span>}
                  </div>
                  <figcaption><strong>Desktop list</strong><span>{dims.desktop[0]}×{dims.desktop[1]}</span></figcaption>
                </figure>
                <figure className="ar-ts-thumb-preview">
                  <div className="ar-ts-preview-frame" style={{ width: dims.mobile[0] + 'px', height: dims.mobile[1] + 'px' }}>
                    {chapter.cover ? <img src={chapter.cover} alt="" loading="lazy" decoding="async" /> : <span>{series === 'pdpkl' ? 'PDPKL' : 'AR'}</span>}
                  </div>
                  <figcaption><strong>Mobile list</strong><span>{dims.mobile[0]}×{dims.mobile[1]}</span></figcaption>
                </figure>
                <div className="ar-ts-actions">
                  <label className={'ar-ts-upload' + (busy ? ' is-disabled' : '')}>
                    <span>{chapter.cover ? 'Replace + Crop' : 'Upload + Crop'}</span>
                    <input type="file" accept="image/*" disabled={busy} onChange={event => {
                      const file = event.target.files?.[0] || null;
                      event.target.value = '';
                      if (file) openUpload(chapter, file);
                    }} />
                  </label>
                  {chapter.cover && (
                    <button type="button" onClick={() => openCurrent(chapter)} disabled={busy}>Adjust current</button>
                  )}
                </div>
              </div>
            </article>
          ))}

          {!visible.length && (
            <section className="admin-card ar-ts-empty">
              <strong>No chapters found</strong>
              <span>Try another chapter number, title, or language.</span>
            </section>
          )}
        </section>
      </section>

      {editor && (editor.file || editor.src) && (
        <ThumbnailCropEditor
          file={editor.file}
          src={editor.src}
          title={(editor.series === 'pdpkl' ? 'PDPKL · ' : '') + labelFor(editor.chapter)}
          subtitle="Resize the crop frame, drag the artwork, zoom, and rotate. Nothing is saved until you press Save cropped thumbnail."
          previewConfigs={editor.series === 'pdpkl'
            ? [
                { key: 'desktop', label: 'Desktop list', width: 144, height: 192 },
                { key: 'mobile', label: 'Mobile list', width: 112, height: 152 },
              ]
            : [
                { key: 'desktop', label: 'Desktop list', width: 208, height: 144 },
                { key: 'mobile', label: 'Mobile list', width: 114, height: 150 },
              ]}
          onCancel={() => setEditor(null)}
          onSave={file => {
            const job = editor;
            setEditor(null);
            onSave?.(job.chapter, job.series, file);
          }}
        />
      )}
    </>
  );
}
