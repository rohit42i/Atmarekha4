import { useEffect, useMemo, useRef, useState } from 'react';
import { cloudflareR2, supabase } from './supabase';
import { getAdminRole } from './adminAuth';
import { chapterLanguageLabel, normalizeChapterLanguage } from './chapters';
import { getPdlplMediaUrl, removePdlplFiles, uploadPdlplFile } from './pdlplR2';
import ThumbnailStudioCropEditor from './ThumbnailStudioCropEditor.jsx';
import './thumbnail-studio.css';

const CHAPTERS_TABLE = 'chapters';
const COVER_BUCKET = 'covers';

const SLOT_CONFIG = {
  card: {
    desktop: { label: 'Desktop / PC', ratio: 16 / 9, outputWidth: 1600, shape: 'landscape' },
    mobile: { label: 'Mobile', ratio: 3 / 4, outputWidth: 1200, shape: 'portrait' },
  },
  'chapter-list-atma': {
    desktop: { label: 'Desktop Chapter List', ratio: 13 / 9, outputWidth: 1300, shape: 'landscape' },
    mobile: { label: 'Mobile Chapter List', ratio: 19 / 25, outputWidth: 1140, shape: 'portrait' },
  },
  'chapter-list-pdpkl': {
    desktop: { label: 'Desktop Chapter List', ratio: 3 / 4, outputWidth: 1200, shape: 'portrait' },
    mobile: { label: 'Mobile Chapter List', ratio: 3 / 4, outputWidth: 1200, shape: 'portrait' },
  },
};

function atmaPathFromPublicUrl(url) {
  const clean = String(url || '');
  const marker = '/storage/v1/object/public/' + COVER_BUCKET + '/';
  const index = clean.indexOf(marker);
  if (index < 0) return null;
  try { return decodeURIComponent(clean.slice(index + marker.length)); } catch { return clean.slice(index + marker.length); }
}

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Your Supabase session has expired. Please sign in again.');
  const role = await getAdminRole(user.id);
  if (!(role === 'owner' || role === 'admin')) throw new Error('Admin access required.');
  return user;
}

async function uploadAtma(file, path) {
  const result = await cloudflareR2.from(COVER_BUCKET).upload(path, file, {
    upsert: false,
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  });
  if (result?.error) throw result.error;
  return cloudflareR2.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function removeAtma(path) {
  if (!path) return;
  const result = await cloudflareR2.from(COVER_BUCKET).remove([path]);
  if (result?.error) throw result.error;
}

function getChapterLabel(chapter) {
  return chapter?.chapterNumber === null || chapter?.chapterNumber === undefined || chapter?.chapterNumber === ''
    ? 'Special'
    : 'Chapter ' + chapter.chapterNumber;
}

function getLanguage(chapter) {
  return normalizeChapterLanguage(chapter?.language || 'hi');
}

function chapterMatches(chapter, query, language) {
  if (language !== 'all' && getLanguage(chapter) !== language) return false;
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return true;
  return [
    chapter?.title,
    chapter?.chapterNumber,
    getChapterLabel(chapter),
    chapter?.id,
  ].join(' ').toLowerCase().includes(needle);
}

function resolveState({ series, mode, slot, chapter }) {
  const config = mode === 'card'
    ? SLOT_CONFIG.card[slot]
    : SLOT_CONFIG[series === 'pdpkl' ? 'chapter-list-pdpkl' : 'chapter-list-atma'][slot];

  if (mode === 'card') {
    const custom = slot === 'mobile' ? chapter?.cardThumbnailMobile : chapter?.cardThumbnailDesktop;
    return { source: custom || chapter?.cover || '', custom: Boolean(custom), config };
  }

  const custom = series === 'pdpkl'
    ? (slot === 'mobile' ? chapter?.chapterListThumbnailMobilePath : chapter?.chapterListThumbnailDesktopPath)
    : (slot === 'mobile' ? chapter?.chapterListThumbnailMobile : chapter?.chapterListThumbnailDesktop);

  const source = series === 'pdpkl'
    ? (custom ? getPdlplMediaUrl(custom) : chapter?.cover || '')
    : (custom || chapter?.cover || '');

  return { source, custom: Boolean(custom), config };
}

export default function AdminThumbnailStudio({
  chapters = [],
  pdpklChapters = [],
  busy = false,
  onRefresh,
}) {
  const [mode, setMode] = useState('chapter-list');
  const [series, setSeries] = useState('atma');
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('all');
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputs = useRef(new Map());

  const sourceChapters = series === 'pdpkl' ? pdpklChapters : chapters;

  const visible = useMemo(
    () => sourceChapters.filter(chapter => chapterMatches(chapter, query, language)),
    [sourceChapters, query, language],
  );

  useEffect(() => {
    if (series === 'pdpkl') setLanguage('all');
  }, [series]);

  useEffect(() => {
    if (language !== 'all' && !sourceChapters.some(chapter => getLanguage(chapter) === language)) {
      setLanguage('all');
    }
  }, [language, sourceChapters]);

  const openEditor = ({ chapter, slot, file = null }) => {
    const key = mode === 'card' ? 'card' : (series === 'pdpkl' ? 'chapter-list-pdpkl' : 'chapter-list-atma');
    const state = resolveState({ series, mode, slot, chapter });
    if (!file && !state.source) {
      setEditor({
        error: 'There is no existing image to adjust. Use Upload & crop first.',
        chapter,
        slot,
        config: state.config,
      });
      return;
    }
    setEditor({
      chapter,
      slot,
      file,
      source: file ? '' : state.source,
      custom: state.custom,
      config: state.config,
      mode,
      series,
      key,
    });
  };

  const onFile = (event, payload) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    if (!String(file.type || '').toLowerCase().startsWith('image/')) return;
    openEditor({ ...payload, file });
  };

  const saveAsset = async file => {
    if (!editor?.chapter?.id || !file || saving) return;
    setSaving(true);
    try {
      const adminUser = await requireAdmin();
      const chapter = editor.chapter;
      const slot = editor.slot;
      const currentMode = editor.mode;
      const currentSeries = editor.series;
      const language = getLanguage(chapter);
      const stamp = Date.now();
      let oldPath = null;

      if (currentMode === 'card') {
        const path = 'chapters/' + chapter.id + '/thumbnail-studio-card-' + slot + '-' + language + '-' + stamp + '.jpg';
        const url = await uploadAtma(file, path);
        const column = slot === 'mobile' ? 'card_thumbnail_mobile_url' : 'card_thumbnail_desktop_url';
        const oldUrl = slot === 'mobile' ? chapter.cardThumbnailMobile : chapter.cardThumbnailDesktop;
        oldPath = atmaPathFromPublicUrl(oldUrl);

        const { error } = await supabase.from(CHAPTERS_TABLE).update({ [column]: url }).eq('id', chapter.id);
        if (error) {
          try { await removeAtma(path); } catch (_) {}
          throw new Error('Home card thumbnail save failed: ' + error.message);
        }

        if (oldPath) {
          try { await removeAtma(oldPath); } catch (cleanupError) { console.warn('Old card thumbnail cleanup failed:', cleanupError); }
        }

        await logStudioAction(adminUser, 'thumbnail_studio_card_save', 'chapter', chapter.id, {
          slot,
          language,
          file_name: file.name,
        });
      } else if (currentSeries === 'pdpkl') {
        const path = 'covers/chapters/' + chapter.id + '/thumbnail-studio-chapter-list-' + slot + '-' + stamp + '.jpg';
        await uploadPdlplFile(file, path);
        const column = slot === 'mobile' ? 'chapter_list_thumbnail_mobile_path' : 'chapter_list_thumbnail_desktop_path';
        oldPath = slot === 'mobile' ? chapter.chapterListThumbnailMobilePath : chapter.chapterListThumbnailDesktopPath;

        const { error } = await supabase
          .from('pal_do_pal_ke_lamhe_chapters')
          .update({ [column]: path })
          .eq('id', chapter.id);

        if (error) {
          try { await removePdlplFiles([path]); } catch (_) {}
          throw new Error('PDPKL Chapter List thumbnail save failed: ' + error.message);
        }

        if (oldPath) {
          try { await removePdlplFiles([oldPath]); } catch (cleanupError) { console.warn('Old PDPKL thumbnail cleanup failed:', cleanupError); }
        }

        await logStudioAction(adminUser, 'thumbnail_studio_pdpkl_chapter_list_save', 'pdlpl_chapter', chapter.id, {
          slot,
          language,
          file_name: file.name,
        });
      } else {
        const path = 'chapters/' + chapter.id + '/thumbnail-studio-chapter-list-' + slot + '-' + language + '-' + stamp + '.jpg';
        const url = await uploadAtma(file, path);
        const column = slot === 'mobile' ? 'chapter_list_thumbnail_mobile_url' : 'chapter_list_thumbnail_desktop_url';
        oldPath = slot === 'mobile' ? atmaPathFromPublicUrl(chapter.chapterListThumbnailMobile) : atmaPathFromPublicUrl(chapter.chapterListThumbnailDesktop);

        const { error } = await supabase.from(CHAPTERS_TABLE).update({ [column]: url }).eq('id', chapter.id);
        if (error) {
          try { await removeAtma(path); } catch (_) {}
          throw new Error('Chapter List thumbnail save failed: ' + error.message);
        }

        if (oldPath) {
          try { await removeAtma(oldPath); } catch (cleanupError) { console.warn('Old Chapter List thumbnail cleanup failed:', cleanupError); }
        }

        await logStudioAction(adminUser, 'thumbnail_studio_chapter_list_save', 'chapter', chapter.id, {
          slot,
          language,
          file_name: file.name,
        });
      }

      setEditor(null);
      await onRefresh?.();
    } finally {
      setSaving(false);
    }
  };

  const clearChapterList = async (chapter, slot) => {
    if (saving || busy || !chapter?.id) return;
    const label = slot === 'mobile' ? 'mobile' : 'desktop';
    if (!window.confirm('Use the normal ' + label + ' Chapter List thumbnail again for ' + getChapterLabel(chapter) + '? The normal cover will not be deleted.')) return;

    setSaving(true);
    try {
      const adminUser = await requireAdmin();
      if (series === 'pdpkl') {
        const column = slot === 'mobile' ? 'chapter_list_thumbnail_mobile_path' : 'chapter_list_thumbnail_desktop_path';
        const oldPath = slot === 'mobile' ? chapter.chapterListThumbnailMobilePath : chapter.chapterListThumbnailDesktopPath;
        const { error } = await supabase.from('pal_do_pal_ke_lamhe_chapters').update({ [column]: null }).eq('id', chapter.id);
        if (error) throw new Error('PDPKL Chapter List reset failed: ' + error.message);
        if (oldPath) { try { await removePdlplFiles([oldPath]); } catch (cleanupError) { console.warn('PDPKL thumbnail cleanup failed:', cleanupError); } }
        await logStudioAction(adminUser, 'thumbnail_studio_pdpkl_chapter_list_reset', 'pdlpl_chapter', chapter.id, { slot });
      } else {
        const column = slot === 'mobile' ? 'chapter_list_thumbnail_mobile_url' : 'chapter_list_thumbnail_desktop_url';
        const oldUrl = slot === 'mobile' ? chapter.chapterListThumbnailMobile : chapter.chapterListThumbnailDesktop;
        const { error } = await supabase.from(CHAPTERS_TABLE).update({ [column]: null }).eq('id', chapter.id);
        if (error) throw new Error('Chapter List reset failed: ' + error.message);
        const oldPath = atmaPathFromPublicUrl(oldUrl);
        if (oldPath) { try { await removeAtma(oldPath); } catch (cleanupError) { console.warn('Chapter List thumbnail cleanup failed:', cleanupError); } }
        await logStudioAction(adminUser, 'thumbnail_studio_chapter_list_reset', 'chapter', chapter.id, { slot, language: getLanguage(chapter) });
      }
      await onRefresh?.();
    } catch (error) {
      console.error(error);
      window.dispatchEvent(new CustomEvent('atma-admin-toast', { detail: { type: 'error', text: error.message || 'Thumbnail reset failed.' } }));
    } finally {
      setSaving(false);
    }
  };

  const languages = series === 'pdpkl'
    ? ['all']
    : ['all', 'hi', 'en'].filter(value => value === 'all' || chapters.some(chapter => getLanguage(chapter) === value));

  return (
    <section className="ts-studio">
      <header className="ts-studio-header">
        <div>
          <span className="ts-studio-kicker">LIBRARY · NEW TOOL</span>
          <h2>Thumbnail Studio</h2>
          <p>Edit a thumbnail without touching the existing source cover. Home Card edits use the existing custom card fields; Chapter List edits are stored as separate overrides and fall back to the normal cover until you save one.</p>
        </div>
      </header>

      <div className="ts-mode-row" role="tablist" aria-label="Thumbnail studio mode">
        <button type="button" className={mode === 'card' ? 'active' : ''} onClick={() => setMode('card')}>Home Card</button>
        <button type="button" className={mode === 'chapter-list' ? 'active' : ''} onClick={() => setMode('chapter-list')}>Chapter List</button>
      </div>

      <div className="ts-series-row" role="tablist" aria-label="Series">
        <button type="button" className={series === 'atma' ? 'active' : ''} onClick={() => setSeries('atma')}>Atma Rekha</button>
        <button type="button" className={series === 'pdpkl' ? 'active' : ''} onClick={() => setSeries('pdpkl')}>PDPKL</button>
      </div>

      <div className="ts-filter-row">
        <label>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search chapter, title, or ID…" aria-label="Search chapters" />
        </label>
        <label>
          <select value={language} onChange={event => setLanguage(event.target.value)} aria-label="Filter language" disabled={series === 'pdpkl'}>
            {languages.map(value => <option key={value} value={value}>{value === 'all' ? 'All languages' : chapterLanguageLabel(value)}</option>)}
          </select>
        </label>
      </div>

      {mode === 'chapter-list' && (
        <p className="ts-normal-note"><strong>Safe override:</strong> the existing normal cover stays exactly where it is. Saving here creates a separate desktop/mobile Chapter List crop. “Use normal” removes only that override.</p>
      )}

      {!visible.length ? (
        <div className="ts-empty">No matching chapters.</div>
      ) : (
        <div className="ts-grid">
          {visible.map(chapter => {
            const slots = ['desktop', 'mobile'];
            return (
              <article key={chapter.id} className={'ts-chapter-card ' + (mode === 'chapter-list' ? 'ts-list-card ' + series : '')}>
                <header className="ts-card-head">
                  <div>
                    <span className="ts-card-eyebrow">{chapterLanguageLabel(getLanguage(chapter))} · {series === 'pdpkl' ? 'PDPKL' : 'Atma Rekha'}</span>
                    <h3>{getChapterLabel(chapter)}{chapter?.title ? ' · ' + chapter.title : ''}</h3>
                    <p>{mode === 'card' ? 'Home / main card thumbnail' : 'Chapter List thumbnail override'}</p>
                  </div>
                  <span className="ts-card-id">{String(chapter.id).slice(0, 8)}</span>
                </header>

                <div className="ts-preview-grid">
                  {slots.map(slot => {
                    const state = resolveState({ series, mode, slot, chapter });
                    const config = state.config;
                    const customValue = mode === 'card'
                      ? (slot === 'mobile' ? chapter.cardThumbnailMobile : chapter.cardThumbnailDesktop)
                      : series === 'pdpkl'
                        ? (slot === 'mobile' ? chapter.chapterListThumbnailMobilePath : chapter.chapterListThumbnailDesktopPath)
                        : (slot === 'mobile' ? chapter.chapterListThumbnailMobile : chapter.chapterListThumbnailDesktop);

                    return (
                      <section className="ts-preview-slot" key={slot}>
                        <header>
                          <div>
                            <strong>{config.label}</strong>
                            <span>{mode === 'card' ? 'Custom card crop' : 'Independent override'}</span>
                          </div>
                        </header>
                        <div className="ts-preview">
                          {state.source ? <img src={state.source} alt="" loading="lazy" decoding="async" /> : <span className="ts-preview-empty">No image</span>}
                        </div>
                        <div className="ts-preview-source">
                          <span>Currently using</span>
                          <strong>{customValue ? 'Custom' : state.source ? 'Normal cover' : 'None'}</strong>
                        </div>
                        <div className="ts-slot-actions">
                          <button type="button" disabled={busy || saving || !state.source} onClick={() => openEditor({ chapter, slot })}>
                            {customValue ? 'Adjust existing' : 'Adjust normal'}
                          </button>
                          <label>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp"
                              onChange={event => onFile(event, { chapter, slot })}
                              disabled={busy || saving}
                            />
                            {customValue ? 'Replace image' : 'Upload & crop'}
                          </label>
                          {mode === 'chapter-list' && customValue && (
                            <button type="button" disabled={busy || saving} onClick={() => clearChapterList(chapter, slot)}>Use normal</button>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editor?.error && (
        <div className="ts-editor-backdrop" role="dialog" aria-modal="true" aria-label="Thumbnail editor">
          <section className="ts-editor" style={{ maxWidth: '520px', padding: '19px' }}>
            <header className="ts-editor-head" style={{ borderBottom: 0 }}>
              <div><span className="ts-kicker">THUMBNAIL STUDIO</span><h2>Nothing to adjust</h2><p>{editor.error}</p></div>
              <button type="button" className="ts-icon-button" onClick={() => setEditor(null)} aria-label="Close">×</button>
            </header>
          </section>
        </div>
      )}

      {editor && !editor.error && (
        <ThumbnailStudioCropEditor
          key={(editor.chapter?.id || '') + '-' + editor.mode + '-' + editor.series + '-' + editor.slot + '-' + (editor.file?.name || 'existing')}
          file={editor.file}
          src={editor.source}
          aspect={editor.config.ratio}
          outputWidth={editor.config.outputWidth}
          title={(editor.mode === 'card' ? 'Home Card' : 'Chapter List') + ' · ' + getChapterLabel(editor.chapter) + ' · ' + editor.config.label}
          subtitle={editor.file ? 'Crop the new upload before it becomes the thumbnail. The original upload remains untouched on your device.' : 'Reframe the saved thumbnail or the normal cover, then save a new crop without changing the underlying normal cover.'}
          outputLabel={editor.config.label + ' · exact site ratio'}
          onCancel={() => setEditor(null)}
          onSave={saveAsset}
        />
      )}
    </section>
  );
}

async function logStudioAction(user, action, entityType, entityId, details) {
  if (!user?.id) return;
  try {
    const { error } = await supabase.from('admin_activity_log').insert({
      admin_user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details || {},
    });
    if (error) console.warn('Thumbnail Studio activity log failed:', error);
  } catch (error) {
    console.warn('Thumbnail Studio activity log failed:', error);
  }
}
