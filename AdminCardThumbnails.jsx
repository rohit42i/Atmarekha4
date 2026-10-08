import { useMemo, useState } from 'react';
import { chapterLanguageLabel, normalizeChapterLanguage } from './chapters';

const numberLabel = chapter => chapter?.chapterNumber == null ? 'Special' : 'Chapter ' + chapter.chapterNumber;

export default function AdminCardThumbnails({ chapters = [], busy = false, onUpload, onClear }) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('all');

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
        const an = a.chapterNumber == null ? Number.POSITIVE_INFINITY : Number(a.chapterNumber);
        const bn = b.chapterNumber == null ? Number.POSITIVE_INFINITY : Number(b.chapterNumber);
        if (an !== bn) return an - bn;
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
  }, [chapters, query, language]);

  const renderSlot = (chapter, slot) => {
    const custom = slot === 'desktop' ? chapter.cardThumbnailDesktop : chapter.cardThumbnailMobile;
    const fallback = slot === 'mobile'
      ? (chapter.cardThumbnailDesktop || chapter.cover)
      : chapter.cover;
    const preview = custom || fallback;
    const sourceLabel = custom
      ? 'Custom card thumbnail'
      : slot === 'mobile' && chapter.cardThumbnailDesktop
        ? 'Using desktop card thumbnail'
        : chapter.cover
          ? 'Using chapter thumbnail'
          : 'No thumbnail set';
    const ratio = slot === 'desktop' ? '16:9 recommended' : '3:4 recommended';
    const label = slot === 'desktop' ? 'Desktop / PC' : 'Mobile';
    const action = custom ? 'Replace' : 'Upload';

    return (
      <section className={'ar-card-thumb-slot ar-card-thumb-slot--' + slot}>
        <div className="ar-card-thumb-slot-head">
          <div>
            <strong>{label}</strong>
            <span>{ratio}</span>
          </div>
          <small className={custom ? 'is-custom' : ''}>{sourceLabel}</small>
        </div>
        <div className="ar-card-thumb-preview">
          {preview ? <img src={preview} alt="" loading="lazy" decoding="async" /> : <span>AR</span>}
        </div>
        <div className="ar-card-thumb-actions">
          <label className={'ar-card-thumb-upload' + (busy ? ' is-disabled' : '')}>
            {action}
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={event => {
                const file = event.target.files?.[0] || null;
                event.target.value = '';
                if (file) onUpload?.(chapter, slot, file);
              }}
            />
          </label>
          {custom && (
            <button type="button" onClick={() => onClear?.(chapter, slot)} disabled={busy}>
              Clear override
            </button>
          )}
        </div>
      </section>
    );
  };

  return (
    <section className="admin-stack ar-card-thumb-manager">
      <section className="admin-card">
        <div className="admin-card-title">
          <div>
            <span>LIBRARY · CARD ART</span>
            <h2>Chapter Card Thumbnails</h2>
            <p>Upload separate PC and mobile artwork for chapter cards. A custom card thumbnail always overrides the normal chapter thumbnail.</p>
          </div>
        </div>
        <div className="ar-card-thumb-note">
          <strong>Fallback order</strong>
          <span>PC: Desktop card → chapter thumbnail</span>
          <span>Mobile: Mobile card → Desktop card → chapter thumbnail</span>
        </div>
        <div className="ar-card-thumb-controls">
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
          <small>{visible.length} chapter{visible.length === 1 ? '' : 's'}</small>
        </div>
      </section>

      <div className="ar-card-thumb-grid">
        {visible.map(chapter => (
          <article className="admin-card ar-card-thumb-card" key={chapter.id}>
            <header className="ar-card-thumb-card-head">
              <div>
                <span>{chapterLanguageLabel(chapter.language)}</span>
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
  );
}
