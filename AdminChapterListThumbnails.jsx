import { useMemo, useState } from 'react';
import ImageCropEditor from './ImageCropEditor.jsx';
import { chapterLanguageLabel, normalizeChapterLanguage } from './chapters';

const numberLabel = chapter => chapter?.chapterNumber == null ? 'Special' : 'Chapter ' + chapter.chapterNumber;

export default function AdminChapterListThumbnails({
  chapters = [],
  busy = false,
  onSave,
}) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('all');
  const [editor, setEditor] = useState(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...chapters]
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
  }, [chapters, query, language]);

  const openFile = (chapter, event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (file) setEditor({ chapter, file, src: '', aspect: 13 / 9 });
  };

  const openExisting = chapter => {
    if (!chapter.cover) return;
    setEditor({ chapter, file: null, src: chapter.cover, aspect: 13 / 9 });
  };

  const finishEdit = file => {
    const job = editor;
    setEditor(null);
    if (file && job) onSave?.(job.chapter, file);
  };

  return (
    <>
      <section className="admin-stack ar-list-thumb-manager">
        <section className="admin-card ar-list-thumb-manager-head">
          <div className="admin-card-title">
            <div>
              <span>LIBRARY · CHAPTER LIST</span>
              <h2>Chapter List Thumbnails</h2>
              <p>Adjust the normal thumbnail used in the Chapter List. This is separate from the custom Home/Card artwork.</p>
            </div>
          </div>

          <div className="ar-list-thumb-note">
            <strong>Normal thumbnail</strong>
            <span>One master image</span>
            <span>Desktop preview · 104 × 72</span>
            <span>Mobile preview · 76 × 100</span>
            <span>Crop is saved back to the chapter cover</span>
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

        <div className="ar-list-thumb-grid">
          {visible.map(chapter => (
            <article className="admin-card ar-list-thumb-card" key={chapter.id}>
              <header className="ar-list-thumb-card-head">
                <div>
                  <span>{chapterLanguageLabel(chapter.language)}</span>
                  <h3>{numberLabel(chapter)}</h3>
                  <p>{chapter.title || 'Untitled chapter'}</p>
                </div>
                <span className="ar-card-thumb-id">{String(chapter.id).slice(0, 8)}</span>
              </header>

              <div className="ar-list-thumb-preview-row">
                <div className="ar-list-thumb-preview-block">
                  <span>Desktop · 104 × 72</span>
                  <div className="ar-list-thumb-preview ar-list-thumb-preview--desktop">
                    {chapter.cover ? <img src={chapter.cover} alt="" loading="lazy" decoding="async" /> : <b>NO COVER</b>}
                  </div>
                </div>
                <div className="ar-list-thumb-preview-block">
                  <span>Mobile · 76 × 100</span>
                  <div className="ar-list-thumb-preview ar-list-thumb-preview--mobile">
                    {chapter.cover ? <img src={chapter.cover} alt="" loading="lazy" decoding="async" /> : <b>NO COVER</b>}
                  </div>
                </div>
              </div>

              <div className="ar-list-thumb-actions">
                <label className={'ar-card-thumb-upload' + (busy ? ' is-disabled' : '')}>
                  <span>{chapter.cover ? 'Replace & Crop' : 'Upload & Crop'}</span>
                  <input type="file" accept="image/*" disabled={busy} onChange={event => openFile(chapter, event)} />
                </label>
                {chapter.cover && (
                  <button type="button" onClick={() => openExisting(chapter)} disabled={busy}>
                    Adjust existing
                  </button>
                )}
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
          title={'Chapter List · ' + numberLabel(editor.chapter)}
          subtitle="Crop the normal Chapter List cover. The same saved master is previewed in both desktop and mobile layouts."
          outputLabel="13:9 · Chapter List master"
          onCancel={() => setEditor(null)}
          onSave={finishEdit}
        />
      )}
    </>
  );
}
