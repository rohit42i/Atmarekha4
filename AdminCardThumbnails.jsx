import { useMemo, useState } from 'react';
import ImageCropEditor from './ImageCropEditor.jsx';
import { chapterLanguageLabel, normalizeChapterLanguage } from './chapters';

const numberLabel = chapter => chapter?.chapterNumber == null ? 'Special' : 'Chapter ' + chapter.chapterNumber;

export default function AdminCardThumbnails({
  chapters = [],
  pdpklChapters = [],
  busy = false,
  onUpload,
  onClear,
}) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('all');
  const [series, setSeries] = useState('atma');
  const [editor, setEditor] = useState(null);

  const source = series === 'pdpkl' ? pdpklChapters : chapters;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...source]
      .filter(chapter => language === 'all' || normalizeChapterLanguage(chapter.language) === language)
      .filter(chapter => !needle || [
        numberLabel(chapter),
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

  const renderSlot = (chapter, slot) => {
    const custom = slot === 'desktop' ? chapter.cardThumbnailDesktop : chapter.cardThumbnailMobile;
    const fallback = slot === 'mobile'
      ? (chapter.cardThumbnailDesktop || chapter.cover)
      : chapter.cover;
    const preview = custom || fallback;
    const sourceLabel = custom
      ? 'Custom card thumbnail'
      : (slot === 'mobile' && chapter.cardThumbnailDesktop
        ? 'Using desktop card thumbnail'
        : (chapter.cover ? 'Normal chapter thumbnail' : 'No thumbnail set'));
    const ratio = slot === 'desktop' ? 16 / 9 : 3 / 4;
    const label = slot === 'desktop' ? 'Desktop / PC' : 'Mobile';
    const action = custom ? 'Replace' : 'Upload';

    const openFile = event => {
      const selected = event.target.files?.[0] || null;
      event.target.value = '';
      if (selected) setEditor({ chapter, slot, file: selected, aspect: ratio });
    };

    return (
      <section className={'ar-card-thumb-slot ar-card-thumb-slot--' + slot}>
        <div className="ar-card-thumb-slot-head">
          <div>
            <strong>{label}</strong>
            <span>{slot === 'desktop' ? '16:9 output' : '3:4 output'}</span>
          </div>
          <small className={custom ? 'is-custom' : ''}>{sourceLabel}</small>
        </div>

        <div className="ar-card-thumb-preview">
          {preview ? <img src={preview} alt="" loading="lazy" decoding="async" /> : <span>AR</span>}
          <div className="ar-card-thumb-preview-badge">{custom ? 'Custom' : 'Fallback'}</div>
        </div>

        <div className="ar-card-thumb-actions">
          <label className={'ar-card-thumb-upload' + (busy ? ' is-disabled' : '')}>
            <span>{action}</span>
            <input type="file" accept="image/*" disabled={busy} onChange={openFile} />
          </label>
          {custom && (
            <>
              <button type="button" onClick={() => onClear?.(chapter, slot, series)} disabled={busy}>Clear</button>
              <button type="button" onClick={() => setEditor({ chapter, slot, file: null, src: custom, aspect: ratio })} disabled={busy}>
                Adjust
              </button>
            </>
          )}
        </div>
      </section>
    );
  };

  const finishEdit = file => {
    const job = editor;
    setEditor(null);
    if (file && job) onUpload?.(job.chapter, job.slot, file, series);
  };

  return (
    <>
      <section className="admin-stack ar-card-thumb-manager">
        <section className="admin-card ar-card-thumb-manager-head">
          <div className="admin-card-title">
            <div>
              <span>LIBRARY · CARD ART</span>
              <h2>Chapter Card Thumbnails</h2>
              <p>Set a separate desktop and mobile image for the main/home card. Chapter List thumbnails stay unchanged.</p>
            </div>
          </div>

          <div className="ar-card-thumb-series" role="tablist" aria-label="Series">
            <button type="button" className={series === 'atma' ? 'active' : ''} onClick={() => setSeries('atma')} role="tab" aria-selected={series === 'atma'}>Atma Rekha</button>
            <button type="button" className={series === 'pdpkl' ? 'active' : ''} onClick={() => setSeries('pdpkl')} role="tab" aria-selected={series === 'pdpkl'}>PDPKL</button>
          </div>

          <div className="ar-card-thumb-note">
            <strong>Fallback</strong>
            <span>PC → normal chapter thumbnail</span>
            <span>Mobile → custom mobile → desktop custom → normal chapter thumbnail</span>
          </div>

          <div className="ar-card-thumb-controls">
            <label>
              <span>Search</span>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Chapter or title" />
            </label>
            <label>
              <span>Language</span>
              <select value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="all">All languages</option>
                <option value="hi">Hindi</option>
                <option value="en">English</option>
              </select>
            </label>
            <small>{visible.length} chapter{visible.length === 1 ? '' : 's'}</small>
          </div>
        </section>

        <div className="ar-card-thumb-grid">
          {visible.map(chapter => (
            <article className="admin-card ar-card-thumb-card" key={chapter.id}>
              <header className="ar-card-thumb-card-head">
                <div>
                  <span>{series === 'pdpkl' ? 'PDPKL · ' : ''}{chapterLanguageLabel(chapter.language)}</span>
                  <h3>{numberLabel(chapter)}</h3>
                  <p>{chapter.title || 'Untitled chapter'}</p>
                </div>
                <span className="ar-card-thumb-id">{String(chapter.id).slice(0, 8)}</span>
              </header>
              <div className="ar-card-thumb-slots">
                {renderSlot(chapter, 'desktop')}
                {renderSlot(chapter, 'mobile')}
              </div>
            </article>
          ))}
        </div>

        {!visible.length && (
          <section className="admin-card ar-card-thumb-empty">
            <strong>No chapters found</strong>
            <span>Try another chapter title, number, or language.</span>
          </section>
        )}
      </section>

      {editor && (editor.file || editor.src) && (
        <ImageCropEditor
          file={editor.file}
          src={editor.src}
          aspect={editor.aspect}
          title={(series === 'pdpkl' ? 'PDPKL · ' : '') + numberLabel(editor.chapter) + ' · ' + (editor.slot === 'desktop' ? 'Desktop / PC' : 'Mobile')}
          onCancel={() => setEditor(null)}
          onSave={finishEdit}
        />
      )}
    </>
  );
}
