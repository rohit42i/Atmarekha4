import { useEffect, useMemo, useState } from 'react';
import { supabase, cloudflareR2, isSupportedImageFile } from './supabase';
import { buildChapters, normalizeChapterLanguage, chapterLanguageLabel } from './chapters';
import AdminOverview from './AdminOverview';
import AdminControlRoom from './AdminControlRoom.jsx';
import AdminMembership from './AdminMembership.jsx';
import AdminChapterPages from './AdminChapterPages';
import PalDoPalAdmin from './PalDoPalAdmin';
import { getAdminRole } from './adminAuth';
import { AdminIcon } from './admin-redesign-ui.jsx';
import { AdminSidebar } from './admin-studio-ui.jsx';
import './admin-command-center-system.css';
import './admin-ultimate-ui.css';
import AdminCommandPalette from './AdminCommandPalette.jsx';
import AdminChapterManager from './AdminChapterManager.jsx';
import AdminModerationQueue from './AdminModerationQueue.jsx';
import AdminCardThumbnails from './AdminCardThumbnails.jsx';
import AdminComments from './AdminComments.jsx';
import AdminChapterHealth from './AdminChapterHealth.jsx';
import AdminOperations from './AdminOperations.jsx';
import AdminManagementTools from './AdminManagementTools.jsx';
import AdminModerationTools from './AdminModerationTools.jsx';
import AdminGroupChatTools from './AdminGroupChatTools.jsx';
import AdminProTools from './AdminProTools.jsx';
import CommunityAdmin from './CommunityAdmin.jsx';
import './admin-workspace-ux.css';
import './admin-pro-studio.css';
import { buildPdlplChapters } from './palDoPalKeLamhe';
import { getPdlplMediaUrl, uploadPdlplFile, removePdlplFiles } from './pdlplR2';
import { requestAdminConfirm, notifyAdminToast } from './admin-feedback';

const CHAPTERS = 'chapters';
const PAGES = 'chapter_pages';
const MAX_PAGE_SIZE = 95 * 1024 * 1024;
const IMAGE_MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif',
};
const PAGE_BUCKET = 'chapter-pages';
const COVER_BUCKET = 'covers';
const SUPPORTED_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif';

function imageExtension(file) {
  const name = String(file?.name || '');
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (name.includes('.') && IMAGE_MIME_BY_EXT[ext]) return ext;
  const type = String(file?.type || '').toLowerCase();
  return Object.entries(IMAGE_MIME_BY_EXT).find(([, mime]) => mime === type)?.[0] || 'jpg';
}

const publicUrl = (bucket, path) => cloudflareR2.from(bucket).getPublicUrl(path).data.publicUrl;
const pathFromUrl = (url, bucket) => {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length));
};

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Your Supabase session has expired. Please sign in again.');
  const role = await getAdminRole(user.id);
  if (!role) throw new Error('Admin access required.');
  return user;
}

async function removeFiles(bucket, paths) {
  const clean = paths.filter(Boolean);
  if (!clean.length) return;
  const { error } = await cloudflareR2.from(bucket).remove(clean);
  if (error) {
    const cleanupError = new Error('Cloudflare R2 cleanup failed: ' + error.message);
    cleanupError.r2Cleanup = { bucket, paths: clean };
    throw cleanupError;
  }
}
async function logAdminAction(user, action, entityType, entityId = null, details = {}) {
  if (!user?.id) return;
  try {
    const { error } = await supabase.from('admin_activity_log').insert({
      admin_user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
    if (error) { console.warn('Admin activity log failed:', error); notifyAdminToast('Admin activity log failed: ' + error.message, 'warning'); }
  } catch (error) {
    console.warn('Admin activity log failed:', error);
    notifyAdminToast('Admin activity log failed: ' + (error?.message || 'unknown error'), 'warning');
  }
}

const emptyForm = () => ({ number: '', language: 'hi', title: '', description: '', status: 'Published', releaseDate: '', cover: null, pages: [] });

const ADMIN_NAV_GROUPS = [
  { label: 'Workspace', items: [
    { key: 'Overview', icon: 'grid', label: 'Dashboard' },
    { key: 'Control Room', icon: 'chart', label: 'Control Room' },
  ]},
  { label: 'Community', items: [
    { key: 'Comments', icon: 'message', label: 'Comments' },
    { key: 'Reports', icon: 'flag', label: 'Reports' },
    { key: 'Announcements', icon: 'bell', label: 'Announcements' },
    { key: 'Community Posts', icon: 'message', label: 'Community Posts' },
    { key: '__notifications', icon: 'bell', label: 'Push Notifications', action: 'atma-admin-open-management', detail: { view: 'notifications' } },
    { key: '__moderation', icon: 'flag', label: 'Community Moderation', action: 'atma-admin-open-moderation' },
    { key: '__group', icon: 'message', label: 'Group Chat', action: 'atma-admin-open-group-chat' },
  ]},
  { label: 'Monetization', items: [
    { key: 'Membership & Earnings', icon: 'chart', label: 'Revenue & Membership' },
    { key: '__users', icon: 'user', label: 'Users & Memberships', action: 'atma-admin-open-management', detail: { view: 'users' } },
  ]},
  { label: 'Library', items: [
    { key: 'Chapters', icon: 'book', label: 'Chapter Manager' },
    { key: 'Pages', icon: 'layers', label: 'Page Editor' },
    { key: 'Card Thumbnails', icon: 'image', label: 'Card Thumbnails' },
    { key: 'Media', icon: 'image', label: 'Media Library' },
  ]},
  { label: 'Tools', items: [
    { key: '__command', icon: 'sparkle', label: 'Command Center', action: 'atma-admin-open-command' },
    { key: '__health', icon: 'pulse', label: 'Chapter Health', action: 'atma-admin-open-health' },
    { key: '__operations', icon: 'settings', label: 'Operations & Recovery', action: 'atma-admin-open-operations' },
    { key: '__activity', icon: 'calendar', label: 'Admin Activity Log', action: 'atma-admin-open-management', detail: { view: 'activity' } },
    { key: '__pro', icon: 'chart', label: 'Advanced Tools', action: 'atma-admin-open-pro' },
  ]},
];

export default function AdminPanel({ onLogout }) {
  const [tab, setTab] = useState('Overview');
  const [chapters, setChapters] = useState([]);
  const [pdpklChapters, setPdpklChapters] = useState([]);
  const [pageCounts, setPageCounts] = useState({});
  const [comments, setComments] = useState([]);
  const [reports, setReports] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [media, setMedia] = useState([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' });
  const [announcement, setAnnouncement] = useState({ title: '', content: '', thumbnail: null, is_pinned: false, pin_target: 'none', display_position: '' });
  const [announcementPreview, setAnnouncementPreview] = useState('');
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [mediaForm, setMediaForm] = useState({ title: '', image_url: '', category: '' });
  const [chapterPublishProject, setChapterPublishProject] = useState('atma');
  const [chapterEditorOpen, setChapterEditorOpen] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaCategoryFilter, setMediaCategoryFilter] = useState('all');
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [chapterPerformance, setChapterPerformance] = useState({});

  useEffect(() => () => { if (announcementPreview.startsWith('blob:')) URL.revokeObjectURL(announcementPreview); }, [announcementPreview]);

  const sorted = useMemo(() => [...chapters].sort((a, b) => {
    const an = Number(a.chapterNumber), bn = Number(b.chapterNumber);
    if (!Number.isFinite(an) && !Number.isFinite(bn)) return 0;
    if (!Number.isFinite(an)) return 1;
    if (!Number.isFinite(bn)) return -1;
    return an - bn;
  }), [chapters]);

  const resetForm = () => { setEditing(null); setForm(emptyForm()); setProgress({ current: 0, total: 0, text: '' }); };

  const load = async () => {
    setLoading(true); setNotice({ type: '', text: '' });
    try {
      const user = await requireAdmin();
      setEmail(user.email || '');
      const [chapterData, pdpklData, pageResult, commentResult, reportResult, announcementResult, mediaResult, performanceResult] = await Promise.all([
        buildChapters(),
        buildPdlplChapters(),
        supabase.from(PAGES).select('id, chapter_id, page_number, image_url').order('page_number', { ascending: true }),
        supabase.from('comments').select('id, user_id, chapter_id, announcement_id, author_name, content, created_at, parent_comment_id').order('created_at', { ascending: false }).limit(100),
        supabase.from('comment_reports').select('id, comment_id, reason, status, created_at, reviewed_at, reviewed_by').order('created_at', { ascending: false }).limit(100),
        supabase.from('announcements').select('id, title, content, image_url, is_pinned, pin_target, display_position, published_at, created_at').order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(10),
        supabase.from('media').select('id, title, image_url, category, created_at').order('created_at', { ascending: false }).limit(200),
        supabase.functions.invoke('get-admin-console-data', { body: { action: 'analytics', days: 30 } }).then(result => ({ data: result.data?.data || null, error: result.error })).catch(error => ({ data: null, error })),
      ]);
      for (const result of [pageResult, commentResult, reportResult, announcementResult, mediaResult]) if (result.error) throw result.error;
      const performanceMap = {};
      for (const row of performanceResult?.data?.chapter_stats || []) {
        performanceMap[row.id] = {
          views: Number(row.period_views ?? row.views ?? 0),
          likes: Number(row.period_likes ?? row.likes ?? 0),
          shares: Number(row.period_shares ?? row.shares ?? 0),
        };
      }
      const counts = {};
      for (const row of pageResult.data || []) counts[row.chapter_id] = (counts[row.chapter_id] || 0) + 1;
      setChapters(chapterData || []);
      setPdpklChapters(pdpklData || []);
      setPageCounts(counts);
      const mergedComments = await mergeReportedComments(reportResult.data || [], commentResult.data || []);
      const commenterIds = [...new Set(mergedComments.map(row => row.user_id).filter(Boolean))];
      let commenterProfiles = {};
      if (commenterIds.length) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, username')
          .in('id', commenterIds);
        if (profileError) console.warn('Comment author profile lookup failed:', profileError);
        else commenterProfiles = Object.fromEntries((profileRows || []).map(profile => [profile.id, profile]));
      }
      setComments(mergedComments.map(comment => {
        const profile = commenterProfiles[comment.user_id];
        const displayName = String(profile?.display_name || '').trim();
        const username = String(profile?.username || '').trim();
        const storedName = String(comment.author_name || '').trim();
        return {
          ...comment,
          author_display_name: displayName || username || (storedName && storedName.toLowerCase() !== 'reader' ? storedName : 'Reader'),
        };
      }));
      setReports(reportResult.data || []);
      setAnnouncements(announcementResult.data || []);
      setMedia(mediaResult.data || []);
      setChapterPerformance(performanceMap);
      setLastRefreshedAt(new Date());
    } catch (error) {
      console.error(error); setNotice({ type: 'error', text: error.message || 'Unable to load admin data.' });
    } finally { setLoading(false); }
  };

  // Reports can reference comments outside the latest comments page.
  // Load those missing comment rows so moderation actions never show a dead record.
  const mergeReportedComments = async (reportRows, commentRows) => {
    const ids = [...new Set((reportRows || []).map(row => row.comment_id).filter(Boolean))];
    const known = new Set((commentRows || []).map(row => row.id));
    const missing = ids.filter(id => !known.has(id));
    if (!missing.length) return commentRows || [];
    const { data, error } = await supabase
      .from('comments')
      .select('id, user_id, chapter_id, announcement_id, author_name, content, created_at, parent_comment_id')
      .in('id', missing);
    if (error) throw error;
    return [...(commentRows || []), ...(data || [])];
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onConfirmRequest = event => {
      event.preventDefault();
      setConfirmDialog(event.detail || null);
    };
    const onToast = event => {
      if (!event.detail?.message) return;
      setToasts(current => [...current, event.detail].slice(-5));
    };
    window.addEventListener('atma-admin-confirm-request', onConfirmRequest);
    window.addEventListener('atma-admin-toast', onToast);
    return () => {
      window.removeEventListener('atma-admin-confirm-request', onConfirmRequest);
      window.removeEventListener('atma-admin-toast', onToast);
    };
  }, []);

  useEffect(() => {
    if (!confirmDialog) return undefined;
    const onEscape = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      confirmDialog.resolve?.(false);
      setConfirmDialog(null);
    };
    document.addEventListener('keydown', onEscape, true);
    return () => document.removeEventListener('keydown', onEscape, true);
  }, [confirmDialog]);

  useEffect(() => {
    const refreshHandler = () => load();
    window.addEventListener('atma-admin-refresh', refreshHandler);
    return () => window.removeEventListener('atma-admin-refresh', refreshHandler);
  }, []);

  useEffect(() => {
    const openCommand = () => setCommandOpen(true);
    window.addEventListener('atma-admin-open-command', openCommand);
    return () => window.removeEventListener('atma-admin-open-command', openCommand);
  }, []);

  useEffect(() => {
    const isTyping = event => {
      const target = event.target;
      return target instanceof HTMLElement && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
    };
    const onKeyDown = event => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (key === 'escape') {
        if (chapterEditorOpen) setChapterEditorOpen(false);
        if (mediaModalOpen) setMediaModalOpen(false);
        if (shortcutHelpOpen) setShortcutHelpOpen(false);
        if (mobileSidebarOpen) setMobileSidebarOpen(false);
        if (profileOpen) setProfileOpen(false);
        if (commandOpen) setCommandOpen(false);
        if (replyTarget) { setReplyTarget(null); setReplyText(''); }
        return;
      }
      if (isTyping(event) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (key === 'n') {
        event.preventDefault();
        setChapterPublishProject('atma');
        activateTab('Chapters');
        resetForm();
        setChapterEditorOpen(true);
      } else if (key === 'r') {
        event.preventDefault();
        load();
      } else if (key === '?') {
        event.preventDefault();
        setShortcutHelpOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  const choosePages = event => {
    const selected = Array.from(event.target.files || []);
    const files = selected.filter(isSupportedImageFile);
    const unsupportedCount = selected.length - files.length;
    const tooLarge = files.find(file => file.size > MAX_PAGE_SIZE);
    event.target.value = '';
    if (tooLarge) { setNotice({ type: 'error', text: tooLarge.name + ' is larger than 95 MB.' }); return; }
    if (unsupportedCount) {
      setNotice({ type: 'error', text: 'Skipped ' + unsupportedCount + ' unsupported image(s). Use JPG, PNG, WEBP, GIF, BMP, or AVIF.' });
    } else {
      setNotice({ type: '', text: '' });
    }
    setForm(value => ({ ...value, pages: files }));
  };

  async function upload(bucket, file, path) {
    if (!isSupportedImageFile(file)) {
      throw new Error('Unsupported image format. Use JPG, PNG, WEBP, GIF, BMP, or AVIF.');
    }
    const declaredType = String(file?.type || '').toLowerCase();
    const ext = imageExtension(file);
    const contentType = IMAGE_MIME_BY_EXT[ext] || declaredType;
    if (!contentType || !contentType.startsWith('image/')) throw new Error('Please select a supported image file.');
    const { error } = await cloudflareR2.from(bucket).upload(path, file, { upsert: false, contentType, cacheControl: '31536000' });
    if (error) throw new Error(`Upload to ${bucket} failed: ${error.message}`);
    return publicUrl(bucket, path);
  }

  async function saveChapter(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice({ type: '', text: '' });

    let adminUser = null;
    let chapterId = editing?.id || null;
    let pagesCommitted = false;
    let coverCommitted = false;
    let chapterCreated = false;
    const uploadedPaths = [];

    try {
      adminUser = await requireAdmin();
      const rawNumber = String(form.number ?? '').trim();
      const number = rawNumber === '' ? null : Number(rawNumber);
      const language = normalizeChapterLanguage(form.language);
      if (number !== null && (!Number.isInteger(number) || number < 1)) throw new Error('Enter a valid chapter number or leave it blank.');
      if (!form.title.trim()) throw new Error('Chapter title is required.');

      const existingMangaId = editing?.mangaId || chapters.find(chapter => chapter.mangaId)?.mangaId || null;
      let mangaId = existingMangaId;
      if (!mangaId) {
        const { data: series, error: seriesError } = await supabase.from('manga_series').select('id').eq('slug', 'atma-rekha').single();
        if (seriesError) throw new Error('Atma Rekha series could not be resolved: ' + seriesError.message);
        mangaId = series.id;
      }

      const duplicate = chapters.find(chapter =>
        chapter.id !== editing?.id &&
        chapter.mangaId === mangaId &&
        normalizeChapterLanguage(chapter.language) === language &&
        ((chapter.chapterNumber == null && number == null) || Number(chapter.chapterNumber) === number)
      );
      if (duplicate) {
        const chapterLabel = number == null ? 'Special / unnumbered entry' : 'Chapter ' + number;
        throw new Error(chapterLabel + ' already exists in ' + chapterLanguageLabel(language) + '. Edit that variant instead.');
      }
      if (!editing && !form.pages.length) throw new Error('Select at least one manga page.');
      if (String(form.status).trim().toLowerCase() === 'scheduled' && !form.releaseDate) {
        throw new Error('Scheduled chapters need a release date.');
      }

      const payload = {
        manga_id: mangaId,
        language,
        chapter_number: number,
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        release_date: form.releaseDate
          ? new Date(form.releaseDate).toISOString()
          : String(form.status).trim().toLowerCase() === 'published'
            ? (editing?.releaseDate || new Date().toISOString())
            : null,
      };

      if (editing) {
        const { error } = await supabase.from(CHAPTERS).update(payload).eq('id', editing.id);
        if (error) throw new Error('Chapter update failed: ' + error.message);
      } else {
        const { data, error } = await supabase.from(CHAPTERS).insert(payload).select('id, chapter_number').single();
        if (error) throw new Error('Chapter creation failed: ' + error.message);
        chapterId = data.id;
        chapterCreated = true;
      }

      let oldCoverPath = null;
      if (form.cover) {
        const ext = imageExtension(form.cover);
        const path = 'covers/chapters/' + chapterId + '/cover-' + language + '-' + Date.now() + '.' + ext;
        await upload(COVER_BUCKET, form.cover, path);
        uploadedPaths.push({ bucket: COVER_BUCKET, path, kind: 'cover' });
        oldCoverPath = pathFromUrl(editing?.cover, COVER_BUCKET);

        const url = publicUrl(COVER_BUCKET, path);
        const { error } = await supabase.from(CHAPTERS).update({ cover_url: url }).eq('id', chapterId);
        if (error) throw new Error('Cover save failed: ' + error.message);
        coverCommitted = true;

        if (oldCoverPath) {
          try { await removeFiles(COVER_BUCKET, [oldCoverPath]); }
          catch (cleanupError) {
            await logAdminAction(adminUser, 'r2_cleanup_failed', 'chapter_cover', chapterId, { bucket: COVER_BUCKET, paths: [oldCoverPath], error: cleanupError.message });
          }
        }
      }

      if (form.pages.length) {
        setProgress({ current: 0, total: form.pages.length, text: 'Uploading manga pages…' });
        const old = await supabase.from(PAGES).select('id, image_url').eq('chapter_id', chapterId);
        if (old.error) throw new Error('Could not read existing pages: ' + old.error.message);
        const oldPaths = (old.data || []).map(row => pathFromUrl(row.image_url, PAGE_BUCKET)).filter(Boolean);
        const revision = Date.now();
        const rows = [];

        for (let i = 0; i < form.pages.length; i += 1) {
          const file = form.pages[i];
          const ext = imageExtension(file);
          const pagePath = 'chapters/' + chapterId + '/pages/' + language + '-' + revision + '/' + String(i + 1).padStart(4, '0') + '.' + ext;
          const url = await upload(PAGE_BUCKET, file, pagePath);
          uploadedPaths.push({ bucket: PAGE_BUCKET, path: pagePath, kind: 'page' });
          rows.push({ chapter_id: chapterId, page_number: i + 1, image_url: url });
          setProgress({ current: i + 1, total: form.pages.length, text: 'Uploaded page ' + (i + 1) + ' of ' + form.pages.length });
        }

        const { error: pagesError } = await supabase.rpc('replace_chapter_pages', {
          p_chapter_id: chapterId,
          p_pages: rows.map(({ page_number, image_url }) => ({ page_number, image_url })),
        });
        if (pagesError) throw new Error('Saving chapter pages failed: ' + pagesError.message);
        // replace_chapter_pages is transactional: existing rows remain untouched
        // when validation/insertion fails, and the entire replacement commits together.
        pagesCommitted = true;

        if (oldPaths.length) {
          try { await removeFiles(PAGE_BUCKET, oldPaths); }
          catch (cleanupError) {
            await logAdminAction(adminUser, 'r2_cleanup_failed', 'chapter_pages', chapterId, { bucket: PAGE_BUCKET, paths: oldPaths, error: cleanupError.message });
          }
        }
      }

      await logAdminAction(adminUser, editing ? 'update_chapter' : 'create_chapter', 'chapter', chapterId, {
        chapter_number: number,
        title: form.title.trim(),
        status: form.status,
        pages: form.pages.length || 0,
        language,
        cover_changed: Boolean(form.cover),
      });

      const savedLabel = number === null ? 'Special / unnumbered' : 'Chapter ' + number;
      const wasEditing = Boolean(editing);
      resetForm();
      await load();
      setChapterEditorOpen(false);
      setNotice({ type: 'success', text: savedLabel + ' ' + (wasEditing ? 'updated' : 'uploaded') + ' successfully.' });
    } catch (error) {
      console.error(error);
      for (const item of uploadedPaths) {
        const committed = (item.kind === 'page' && pagesCommitted) || (item.kind === 'cover' && coverCommitted);
        if (!committed) {
          try { await removeFiles(item.bucket, [item.path]); }
          catch (cleanupError) {
            await logAdminAction(adminUser, 'r2_cleanup_failed', item.kind === 'page' ? 'chapter_pages' : 'chapter_cover', chapterId, { bucket: item.bucket, paths: [item.path], error: cleanupError.message });
            notifyAdminToast('Upload rollback could not remove ' + item.path + ': ' + cleanupError.message, 'warning');
          }
        }
      }

      if (chapterCreated && !pagesCommitted && chapterId) {
        try {
          await supabase.from(CHAPTERS).delete().eq('id', chapterId);
          // The new chapter was never valid without its required page set.
          // Mark committed uploads as cleanable so they do not become R2 orphans.
          for (const item of uploadedPaths) {
            try { await removeFiles(item.bucket, [item.path]); } catch (cleanupError) { await logAdminAction(adminUser, 'r2_cleanup_failed', item.kind === 'page' ? 'chapter_pages' : 'chapter_cover', chapterId, { bucket: item.bucket, paths: [item.path], error: cleanupError.message }); notifyAdminToast('Upload rollback could not remove ' + item.path + ': ' + cleanupError.message, 'warning'); }
          }
        } catch (rollbackError) { await logAdminAction(adminUser, 'chapter_rollback_failed', 'chapter', chapterId, { error: rollbackError?.message || 'rollback failed' }); notifyAdminToast('Chapter rollback failed: ' + (rollbackError?.message || 'unknown error'), 'warning'); }
      }

      if (adminUser) await logAdminAction(adminUser, 'chapter_operation_failed', 'chapter', chapterId, {
        error: error.message,
        r2_cleanup: error.r2Cleanup || null,
      });
      setNotice({ type: 'error', text: error.message || 'Chapter upload failed.' });
      setProgress({ current: 0, total: 0, text: '' });
    } finally {
      setBusy(false);
    }
  }

  const editChapter = chapter => {
    setEditing(chapter);
    setForm({ number: chapter.chapterNumber || '', language: normalizeChapterLanguage(chapter.language), title: chapter.title || '', description: chapter.description || '', status: chapter.status || 'Published', releaseDate: chapter.releaseDate ? new Date(chapter.releaseDate).toISOString().slice(0, 16) : '', cover: null, pages: [] });
    setTab('Chapters'); setChapterEditorOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function deleteChapter(chapter) {
    if (!(await requestAdminConfirm({
      title: 'Delete chapter permanently?',
      message: 'Delete ' + (chapter.chapterNumber ? 'Chapter ' + chapter.chapterNumber : (chapter.title || 'this unnumbered entry')) + '?',
      consequence: 'Removes the chapter record and its ' + (Number(pageCounts[chapter.id] || 0)) + ' page images, cover, and card-thumbnail files. This cannot be undone.',
      confirmLabel: 'Delete chapter',
    }))) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const pages = await supabase.from(PAGES).select('image_url').eq('chapter_id', chapter.id);
      if (pages.error) throw new Error('Could not read chapter pages: ' + pages.error.message);
      const pagePaths = (pages.data || []).map(row => pathFromUrl(row.image_url, PAGE_BUCKET)).filter(Boolean);
      const coverPath = pathFromUrl(chapter.cover, COVER_BUCKET);
      const cardDesktopPath = pathFromUrl(chapter.cardThumbnailDesktop, COVER_BUCKET);
      const cardMobilePath = pathFromUrl(chapter.cardThumbnailMobile, COVER_BUCKET);
      const deleted = await supabase.from(CHAPTERS).delete().eq('id', chapter.id);
      if (deleted.error) throw new Error('Chapter delete failed: ' + deleted.error.message);

      const cleanupFailures = [];
      if (pagePaths.length) {
        try { await removeFiles(PAGE_BUCKET, pagePaths); }
        catch (error) { cleanupFailures.push({ bucket: PAGE_BUCKET, paths: pagePaths, error: error.message }); }
      }
      const coverAndCardPaths = [...new Set([coverPath, cardDesktopPath, cardMobilePath].filter(Boolean))];
      if (coverAndCardPaths.length) {
        try { await removeFiles(COVER_BUCKET, coverAndCardPaths); }
        catch (error) { cleanupFailures.push({ bucket: COVER_BUCKET, paths: coverAndCardPaths, error: error.message }); }
      }
      for (const failure of cleanupFailures) {
        await logAdminAction(adminUser, 'r2_cleanup_failed', 'chapter', chapter.id, failure);
      }
      await logAdminAction(adminUser, 'delete_chapter', 'chapter', chapter.id, {
        chapter_number: chapter.chapterNumber,
        title: chapter.title,
        cleanup_pending: cleanupFailures.length > 0,
      });

      if (editing?.id === chapter.id) resetForm();
      await load();
      setNotice({
        type: 'success',
        text: cleanupFailures.length
          ? 'Chapter deleted. Some old R2 files need cleanup retry in Operations.'
          : (chapter.chapterNumber ? 'Chapter ' + chapter.chapterNumber : 'Unnumbered entry') + ' deleted.',
      });
    } catch (error) {
      await logAdminAction(adminUser, 'delete_chapter_failed', 'chapter', chapter.id, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Delete failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(id) {
    const targetComment = comments.find(comment => String(comment.id) === String(id));
    if (!(await requestAdminConfirm({
      title: 'Delete comment?',
      message: 'Delete the comment from ' + (targetComment?.author_display_name || targetComment?.author_name || 'this reader') + '?',
      consequence: 'Removes this comment from the discussion. Replies associated with it may also be affected by database relationships.',
      confirmLabel: 'Delete comment',
    }))) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (error) throw error;
      await logAdminAction(adminUser, 'delete_comment', 'comment', id);
      await load();
      setNotice({ type: 'success', text: 'Comment deleted.' });
    } catch (error) {
      await logAdminAction(adminUser, 'delete_comment_failed', 'comment', id, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Comment deletion failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function setReportStatus(id, status) {
    if (busy) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const patch = {
        status,
        reviewed_at: status === 'open' ? null : new Date().toISOString(),
        reviewed_by: status === 'open' ? null : adminUser.id,
      };
      const { error } = await supabase.from('comment_reports').update(patch).eq('id', id);
      if (error) throw error;
      await logAdminAction(adminUser, 'report_' + status, 'comment_report', id, patch);
      await load();
      setNotice({ type: 'success', text: 'Report marked ' + status + '.' });
    } catch (error) {
      await logAdminAction(adminUser, 'report_status_failed', 'comment_report', id, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Report update failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function clearReport(id) {
    await setReportStatus(id, 'resolved');
  }

  async function markCommentReportsReviewed(commentId) {
    const openReports = reports.filter(report => String(report.comment_id) === String(commentId) && (report.status || 'open') === 'open');
    if (!openReports.length || busy) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const patch = { status: 'resolved', reviewed_at: new Date().toISOString(), reviewed_by: adminUser.id };
      const { data, error } = await supabase.from('comment_reports').update(patch).eq('comment_id', commentId).eq('status', 'open').select('id');
      if (error) throw error;
      const updatedIds = (data || []).map(row => row.id);
      for (const reportId of updatedIds) await logAdminAction(adminUser, 'report_resolved', 'comment_report', reportId, { comment_id: commentId, reviewed_from_comments: true });
      await load();
      setNotice({ type: 'success', text: updatedIds.length + ' open report(s) marked resolved.' });
    } catch (error) {
      await logAdminAction(adminUser, 'report_status_failed', 'comment_report', null, { comment_id: commentId, status: 'resolved', error: error.message });
      setNotice({ type: 'error', text: error.message || 'Could not mark reports reviewed.' });
    } finally { setBusy(false); }
  }

  async function replyToComment(event) {
    event.preventDefault();
    if (!replyTarget || !replyText.trim() || busy) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const payload = {
        user_id: adminUser.id,
        chapter_id: replyTarget.chapter_id || null,
        announcement_id: replyTarget.announcement_id || null,
        parent_comment_id: replyTarget.id,
        author_name: email || 'Admin',
        content: replyText.trim(),
      };
      const { data, error } = await supabase.from('comments').insert(payload).select('id').single();
      if (error) throw error;
      await logAdminAction(adminUser, 'reply_to_comment', 'comment', data?.id || null, { parent_comment_id: replyTarget.id, chapter_id: payload.chapter_id, announcement_id: payload.announcement_id });
      setReplyTarget(null);
      setReplyText('');
      await load();
      setNotice({ type: 'success', text: 'Reply posted to the thread.' });
    } catch (error) {
      await logAdminAction(adminUser, 'reply_to_comment_failed', 'comment', replyTarget.id, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Reply could not be posted.' });
    } finally { setBusy(false); }
  }

  function editAnnouncement(item) {
    setEditingAnnouncementId(item.id);
    setAnnouncement({
      title: item.title?.startsWith('__image_only_') ? '' : (item.title || ''),
      content: item.content || '',
      thumbnail: null,
      is_pinned: Boolean(item.is_pinned),
      pin_target: item.pin_target || (item.is_pinned ? 'atma' : 'none'),
      display_position: item.display_position ? String(item.display_position) : '',
    });
    setAnnouncementPreview(item.image_url || '');
    setTab('Announcements');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelAnnouncementEdit() {
    setEditingAnnouncementId(null);
    setAnnouncement({ title: '', content: '', thumbnail: null, is_pinned: false, pin_target: 'none', display_position: '' });
    setAnnouncementPreview('');
  }

  async function saveAnnouncement(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const uploadedPaths = [];
    let adminUser = null;
    let imageCommitted = false;

    try {
      adminUser = await requireAdmin();
      const title = announcement.title.trim();
      const content = announcement.content.trim();
      const displayPositionRaw = String(announcement.display_position ?? '').trim();
      const displayPosition = displayPositionRaw === '' ? null : Number(displayPositionRaw);
      const existing = editingAnnouncementId
        ? announcements.find(item => item.id === editingAnnouncementId)
        : null;

      // pin_target is constrained to "atma" or "pdpkl" by the database.
      // Keep that field valid even when is_pinned is false; is_pinned controls visibility.
      const isPinned = Boolean(announcement.is_pinned);
      const pinTarget = isPinned
        ? (['atma', 'pdpkl'].includes(announcement.pin_target) ? announcement.pin_target : 'atma')
        : (['atma', 'pdpkl'].includes(existing?.pin_target) ? existing.pin_target : 'atma');

      if (displayPosition !== null && (!Number.isInteger(displayPosition) || displayPosition < 1 || displayPosition > 10)) {
        throw new Error('Choose a valid announcement position from 1 to 10, or leave it on Automatic.');
      }
      if (!title && !content && !announcement.thumbnail) throw new Error('Add a title, text, or thumbnail before publishing.');

      let imageUrl = existing?.image_url || null;
      const oldImagePath = announcement.thumbnail ? pathFromUrl(existing?.image_url, COVER_BUCKET) : null;

      if (announcement.thumbnail) {
        const ext = imageExtension(announcement.thumbnail);
        const rawSafeName = announcement.thumbnail.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
        const safeName = /\\.[^.]+$/.test(rawSafeName) ? rawSafeName : (rawSafeName || 'thumbnail') + '.' + ext;
        const path = 'announcements/' + Date.now() + '-' + safeName;
        imageUrl = await upload(COVER_BUCKET, announcement.thumbnail, path);
        uploadedPaths.push({ bucket: COVER_BUCKET, path });
      }

      const storedTitle = title || (
        existing?.title?.startsWith('__image_only_')
          ? existing.title
          : '__image_only_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
      );

      if (existing) {
        const { error } = await supabase.from('announcements').update({
          title: storedTitle,
          content: content || '',
          image_url: imageUrl,
          is_pinned: isPinned,
          pin_target: pinTarget,
          display_position: displayPosition,
        }).eq('id', existing.id);
        if (error) throw error;
        imageCommitted = Boolean(announcement.thumbnail);

        if (oldImagePath) {
          try { await removeFiles(COVER_BUCKET, [oldImagePath]); }
          catch (cleanupError) {
            await logAdminAction(adminUser, 'r2_cleanup_failed', 'announcement', existing.id, {
              bucket: COVER_BUCKET,
              paths: [oldImagePath],
              error: cleanupError.message,
            });
          }
        }

        await logAdminAction(adminUser, 'update_announcement', 'announcement', existing.id, {
          title: storedTitle,
          pinned: isPinned,
          pin_target: pinTarget,
          display_position: displayPosition,
          image_changed: Boolean(announcement.thumbnail),
        });
      } else {
        const { data, error } = await supabase.from('announcements').insert({
          title: storedTitle,
          content: content || '',
          image_url: imageUrl,
          is_pinned: isPinned,
          pin_target: pinTarget,
          display_position: displayPosition,
          published_at: new Date().toISOString(),
        }).select('id').single();
        if (error) throw error;
        imageCommitted = Boolean(announcement.thumbnail);
        await logAdminAction(adminUser, 'create_announcement', 'announcement', data?.id || null, {
          title: storedTitle,
          pinned: announcement.is_pinned,
          display_position: displayPosition,
          image_changed: Boolean(announcement.thumbnail),
        });

        // Keep the public announcement rail intentionally small and predictable.
        // Remove anything beyond the 10 newest records after the new item commits.
        try {
          const { data: overflow, error: overflowError } = await supabase
            .from('announcements')
            .select('id, image_url')
            .order('published_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .range(10, 200);
          if (overflowError) throw overflowError;
          if (overflow?.length) {
            const overflowIds = overflow.map(item => item.id);
            const overflowPaths = overflow.map(item => pathFromUrl(item.image_url, COVER_BUCKET)).filter(Boolean);
            const { error: overflowDeleteError } = await supabase
              .from('announcements')
              .delete()
              .in('id', overflowIds);
            if (overflowDeleteError) throw overflowDeleteError;

            if (overflowPaths.length) {
              try {
                await removeFiles(COVER_BUCKET, overflowPaths);
              } catch (cleanupError) {
                await logAdminAction(adminUser, 'r2_cleanup_failed', 'announcements', null, {
                  bucket: COVER_BUCKET,
                  paths: overflowPaths,
                  error: cleanupError.message,
                });
              }
            }

            await logAdminAction(adminUser, 'trim_announcements', 'announcements', null, {
              removed: overflowIds.length,
            });
          }
        } catch (retentionError) {
          // The new announcement is already safely saved. Do not turn a
          // retention/cleanup issue into a false "publish failed" message.
          await logAdminAction(adminUser, 'announcement_retention_failed', 'announcements', null, {
            error: retentionError.message,
          });
        }
      }

      cancelAnnouncementEdit();
      await load();
      setNotice({ type: 'success', text: existing ? 'Announcement updated.' : 'Announcement published.' });
    } catch (error) {
      for (const item of uploadedPaths) {
        if (!imageCommitted) {
          try { await removeFiles(item.bucket, [item.path]); } catch (cleanupError) { await logAdminAction(adminUser, 'r2_cleanup_failed', 'announcements', editingAnnouncementId || null, { bucket: item.bucket, paths: [item.path], error: cleanupError.message }); notifyAdminToast('Announcement rollback could not remove ' + item.path + ': ' + cleanupError.message, 'warning'); }
        }
      }
      await logAdminAction(adminUser, editingAnnouncementId ? 'update_announcement_failed' : 'create_announcement_failed', 'announcement', editingAnnouncementId || null, {
        error: error.message,
        r2_cleanup: error.r2Cleanup || null,
      });
      setNotice({ type: 'error', text: error.message || 'Announcement save failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function saveCardThumbnail(chapter, slot, file) {
    if (!chapter?.id || !['desktop', 'mobile'].includes(slot) || !file || busy) return;
    setBusy(true);
    setNotice({ type: '', text: '' });
    let adminUser = null;
    let uploadedPath = null;
    let committed = false;
    try {
      adminUser = await requireAdmin();
      if (!isSupportedImageFile(file)) throw new Error('Unsupported image format. Use JPG, PNG, WEBP, GIF, BMP, or AVIF.');
      const language = normalizeChapterLanguage(chapter.language);
      const ext = imageExtension(file);
      const stamp = Date.now();
      const path = 'chapters/' + chapter.id + '/card-' + slot + '-' + language + '-' + stamp + '.' + ext;
      const url = await upload(COVER_BUCKET, file, path);
      uploadedPath = path;

      const column = slot === 'mobile' ? 'card_thumbnail_mobile_url' : 'card_thumbnail_desktop_url';
      const oldUrl = slot === 'mobile' ? chapter.cardThumbnailMobile : chapter.cardThumbnailDesktop;
      const { error } = await supabase.from(CHAPTERS).update({ [column]: url }).eq('id', chapter.id);
      if (error) throw new Error('Card thumbnail save failed: ' + error.message);
      committed = true;

      const oldPath = pathFromUrl(oldUrl, COVER_BUCKET);
      if (oldPath) {
        try { await removeFiles(COVER_BUCKET, [oldPath]); }
        catch (cleanupError) {
          await logAdminAction(adminUser, 'r2_cleanup_failed', 'chapter_card_thumbnail', chapter.id, {
            bucket: COVER_BUCKET,
            paths: [oldPath],
            error: cleanupError.message,
          });
        }
      }

      await logAdminAction(adminUser, 'update_chapter_card_thumbnail', 'chapter', chapter.id, {
        chapter_number: chapter.chapterNumber,
        language,
        slot,
        file_name: file.name,
      });
      await load();
      setNotice({
        type: 'success',
        text: 'Chapter ' + (chapter.chapterNumber ?? 'Special') + ' ' + (slot === 'mobile' ? 'mobile' : 'desktop') + ' card thumbnail updated.',
      });
    } catch (error) {
      if (uploadedPath && !committed) {
        try { await removeFiles(COVER_BUCKET, [uploadedPath]); } catch (cleanupError) { await logAdminAction(adminUser, 'r2_cleanup_failed', 'chapter_card_thumbnail', chapter?.id || null, { bucket: COVER_BUCKET, paths: [uploadedPath], error: cleanupError.message }); notifyAdminToast('Thumbnail upload rollback failed: ' + cleanupError.message, 'warning'); }
      }
      await logAdminAction(adminUser, 'update_chapter_card_thumbnail_failed', 'chapter', chapter?.id || null, {
        error: error.message,
        slot,
      });
      setNotice({ type: 'error', text: error.message || 'Card thumbnail upload failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function savePdpklCardThumbnail(chapter, slot, file) {
    if (!chapter?.id || !file || busy) return;
    setBusy(true); setNotice({ type: '', text: '' });
    let adminUser = null; let uploadedPath = null; let committed = false;
    try {
      adminUser = await requireAdmin();
      const path = 'covers/chapters/' + chapter.id + '/card-' + slot + '-' + Date.now() + '.' + (String(file.name || 'jpg').split('.').pop()?.toLowerCase() || 'jpg');
      await uploadPdlplFile(file, path); uploadedPath = path;
      const column = slot === 'mobile' ? 'card_thumbnail_mobile_path' : 'card_thumbnail_desktop_path';
      const oldPath = slot === 'mobile' ? chapter.cardThumbnailMobilePath : chapter.cardThumbnailDesktopPath;
      const { error } = await supabase.from('pal_do_pal_ke_lamhe_chapters').update({ [column]: path }).eq('id', chapter.id);
      if (error) throw new Error('PDPKL card thumbnail save failed: ' + error.message);
      committed = true;
      if (oldPath) { try { await removePdlplFiles([oldPath]); } catch (e) { await logAdminAction(adminUser, 'r2_cleanup_failed', 'pdlpl_card_thumbnail', chapter.id, { path: oldPath, slot, error: e.message }); notifyAdminToast('Thumbnail saved, but the old PDPKL image could not be removed: ' + e.message, 'warning'); } }
      await logAdminAction(adminUser, 'save_pdpkl_card_thumbnail', 'pdlpl_chapter', chapter.id, { slot, path });
      await load(); setNotice({ type: 'success', text: 'PDPKL ' + (slot === 'mobile' ? 'mobile' : 'desktop') + ' card thumbnail saved.' });
    } catch (error) {
      if (uploadedPath && !committed) { try { await removePdlplFiles([uploadedPath]); } catch (cleanupError) { await logAdminAction(adminUser, 'r2_cleanup_failed', 'pdlpl_card_thumbnail', chapter?.id || null, { path: uploadedPath, slot, error: cleanupError.message }); notifyAdminToast('PDPKL thumbnail rollback failed: ' + cleanupError.message, 'warning'); } }
      console.error(error); setNotice({ type: 'error', text: error.message || 'PDPKL card thumbnail upload failed.' });
    } finally { setBusy(false); }
  }

  async function clearPdpklCardThumbnail(chapter, slot) {
    if (!chapter?.id || busy) return;
    if (!(await requestAdminConfirm({
      title: 'Remove PDPKL card thumbnail?',
      message: 'Remove the custom ' + (slot === 'mobile' ? 'mobile' : 'desktop') + ' thumbnail for ' + (chapter.title || ('Chapter ' + (chapter.chapterNumber ?? 'Special'))) + '?',
      consequence: 'Deletes the custom thumbnail reference and attempts to remove its stored image. The default thumbnail will be used again.',
      confirmLabel: 'Remove thumbnail',
    }))) return;
    setBusy(true); setNotice({ type: '', text: '' });
    try {
      const column = slot === 'mobile' ? 'card_thumbnail_mobile_path' : 'card_thumbnail_desktop_path';
      const oldPath = slot === 'mobile' ? chapter.cardThumbnailMobilePath : chapter.cardThumbnailDesktopPath;
      const { error } = await supabase.from('pal_do_pal_ke_lamhe_chapters').update({ [column]: null }).eq('id', chapter.id);
      if (error) throw new Error('PDPKL card thumbnail reset failed: ' + error.message);
      if (oldPath) { try { await removePdlplFiles([oldPath]); } catch (e) { notifyAdminToast('PDPKL thumbnail removed from the chapter, but its stored file could not be cleaned up: ' + e.message, 'warning'); } }
      await load(); setNotice({ type: 'success', text: 'PDPKL custom card thumbnail removed.' });
    } catch (error) { console.error(error); setNotice({ type: 'error', text: error.message || 'PDPKL card thumbnail reset failed.' }); }
    finally { setBusy(false); }
  }

  async function clearCardThumbnail(chapter, slot) {
    if (!chapter?.id || !['desktop', 'mobile'].includes(slot) || busy) return;
    const label = slot === 'mobile' ? 'mobile' : 'desktop';
    if (!(await requestAdminConfirm({
      title: 'Remove card thumbnail?',
      message: 'Remove the custom ' + label + ' thumbnail for ' + (chapter.chapterNumber ? 'Chapter ' + chapter.chapterNumber : (chapter.title || 'this chapter')) + '?',
      consequence: 'Deletes the custom thumbnail file and falls back to the chapter’s normal thumbnail.',
      confirmLabel: 'Remove thumbnail',
    }))) return;
    setBusy(true);
    setNotice({ type: '', text: '' });
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const column = slot === 'mobile' ? 'card_thumbnail_mobile_url' : 'card_thumbnail_desktop_url';
      const oldUrl = slot === 'mobile' ? chapter.cardThumbnailMobile : chapter.cardThumbnailDesktop;
      const { error } = await supabase.from(CHAPTERS).update({ [column]: null }).eq('id', chapter.id);
      if (error) throw new Error('Card thumbnail reset failed: ' + error.message);
      const oldPath = pathFromUrl(oldUrl, COVER_BUCKET);
      if (oldPath) {
        try { await removeFiles(COVER_BUCKET, [oldPath]); }
        catch (cleanupError) {
          await logAdminAction(adminUser, 'r2_cleanup_failed', 'chapter_card_thumbnail', chapter.id, {
            bucket: COVER_BUCKET,
            paths: [oldPath],
            error: cleanupError.message,
          });
        }
      }
      await logAdminAction(adminUser, 'clear_chapter_card_thumbnail', 'chapter', chapter.id, {
        chapter_number: chapter.chapterNumber,
        language: normalizeChapterLanguage(chapter.language),
        slot,
      });
      await load();
      setNotice({ type: 'success', text: 'Custom ' + label + ' card thumbnail removed.' });
    } catch (error) {
      await logAdminAction(adminUser, 'clear_chapter_card_thumbnail_failed', 'chapter', chapter?.id || null, {
        error: error.message,
        slot,
      });
      setNotice({ type: 'error', text: error.message || 'Card thumbnail reset failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function saveMedia(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      if (!mediaForm.title.trim() || !mediaForm.image_url.trim() || !mediaForm.category.trim()) {
        throw new Error('Title, image URL, and category are required.');
      }
      const { data, error } = await supabase.from('media').insert({
        title: mediaForm.title.trim(),
        image_url: mediaForm.image_url.trim(),
        category: mediaForm.category.trim(),
      }).select('id').single();
      if (error) throw error;
      await logAdminAction(adminUser, 'create_media', 'media', data?.id || null, { title: mediaForm.title.trim(), category: mediaForm.category.trim() });
      setMediaForm({ title: '', image_url: '', category: '' });
      setMediaModalOpen(false);
      await load();
      setNotice({ type: 'success', text: 'Media added.' });
    } catch (error) {
      await logAdminAction(adminUser, 'create_media_failed', 'media', null, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Media save failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnnouncement(item) {
    if (!(await requestAdminConfirm({
      title: 'Delete announcement?',
      message: 'Delete “' + (item.title?.startsWith('__image_only_') ? 'Image-only announcement' : (item.title || 'Untitled announcement')) + '”?',
      consequence: 'Removes this announcement from the public site and attempts to delete its stored image.',
      confirmLabel: 'Delete announcement',
    }))) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const { error } = await supabase.from('announcements').delete().eq('id', item.id);
      if (error) throw error;

      const oldImagePath = pathFromUrl(item.image_url, COVER_BUCKET);
      let cleanupPending = false;
      if (oldImagePath) {
        try { await removeFiles(COVER_BUCKET, [oldImagePath]); }
        catch (cleanupError) {
          cleanupPending = true;
          await logAdminAction(adminUser, 'r2_cleanup_failed', 'announcement', item.id, {
            bucket: COVER_BUCKET,
            paths: [oldImagePath],
            error: cleanupError.message,
          });
        }
      }

      await logAdminAction(adminUser, 'delete_announcement', 'announcement', item.id, { cleanup_pending: cleanupPending });
      if (editingAnnouncementId === item.id) cancelAnnouncementEdit();
      await load();
      setNotice({
        type: 'success',
        text: cleanupPending ? 'Announcement deleted. Image cleanup is pending in Operations.' : 'Announcement deleted.',
      });
    } catch (error) {
      await logAdminAction(adminUser, 'delete_announcement_failed', 'announcement', item.id, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Announcement delete failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function deleteMedia(id) {
    const targetMedia = media.find(item => String(item.id) === String(id));
    if (!(await requestAdminConfirm({
      title: 'Delete media item?',
      message: 'Delete “' + (targetMedia?.title || 'this media item') + '”?',
      consequence: 'Removes this item from the media library. Any external copies of its image are not affected.',
      confirmLabel: 'Delete media',
    }))) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const { error } = await supabase.from('media').delete().eq('id', id);
      if (error) throw error;
      await logAdminAction(adminUser, 'delete_media', 'media', id);
      await load();
      setNotice({ type: 'success', text: 'Media deleted.' });
    } catch (error) {
      await logAdminAction(adminUser, 'delete_media_failed', 'media', id, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Media delete failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function logout() { await supabase.auth.signOut(); onLogout?.(); }

  const tabs = ['Overview', 'Control Room', 'Chapters', 'Pages', 'Comments', 'Reports', 'Announcements', 'Community Posts', 'Membership & Earnings', 'Card Thumbnails', 'Media'];
  const chapterName = id => { const chapter = chapters.find(item => item.id === id); return chapter ? `Chapter ${chapter.chapterNumber ?? 'Special'} — ${chapter.title} · ${chapterLanguageLabel(chapter.language)}` : 'Unknown chapter'; };
  const commentById = id => comments.find(comment => comment.id === id);
  const reportCount = reports.filter(report => (report.status || 'open') === 'open').length;
  const navLabel = key => ADMIN_NAV_GROUPS.flatMap(group => group.items).find(item => item.key === key)?.label || key;
  const activateTab = item => { setTab(item); setMobileSidebarOpen(false); setProfileOpen(false); };
  useEffect(() => {
    const handler = event => {
      const nextTab = event?.detail?.tab;
      if (tabs.includes(nextTab)) activateTab(nextTab);
    };
    window.addEventListener('atma-admin-select-tab', handler);
    return () => window.removeEventListener('atma-admin-select-tab', handler);
  }, []);

  // Custom-tool actions use the same command palette as the global search shortcut.
  useEffect(() => {
    const openPalette = () => {
      setCommandOpen(true);
      setMobileSidebarOpen(false);
      setProfileOpen(false);
    };
    window.addEventListener('atma-admin-open-command', openPalette);
    return () => window.removeEventListener('atma-admin-open-command', openPalette);
  }, []);

  useEffect(() => {
    const handler = event => {
      const id = event?.detail?.commentId;
      if (!id) return;
      activateTab('Comments');
      window.setTimeout(() => {
        document.querySelector(`[data-admin-comment-id="${id}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      }, 0);
    };
    window.addEventListener('atma-admin-focus-comment', handler);
    return () => window.removeEventListener('atma-admin-focus-comment', handler);
  }, []);
  const openAdminTool = (action, detail) => {
    setMobileSidebarOpen(false);
    setProfileOpen(false);
    window.dispatchEvent(new CustomEvent(action, { detail }));
  };
  return <main className="admin-page ar-admin-v3" data-admin-root="true">
    <div className={`ar-admin-app${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <AdminSidebar
        groups={ADMIN_NAV_GROUPS}
        activeKey={tab}
        mobileOpen={mobileSidebarOpen}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(value => !value)}
        onClose={() => setMobileSidebarOpen(false)}
        onSelect={item => item.action ? openAdminTool(item.action, item.detail) : activateTab(item.key)}
        email={email}
        reportCount={reportCount}
        connectionState={loading ? 'Loading admin data…' : notice.type === 'error' ? 'Needs attention' : 'Operational'}
        connectionError={notice.type === 'error'}
      />
      {mobileSidebarOpen && <button type="button" className="ar-admin-drawer-backdrop" onClick={() => setMobileSidebarOpen(false)} aria-label="Close admin navigation" />}
      <div className="ar-admin-main">
        <header className="ar-admin-topbar">
          <div className="ar-admin-topbar-left">
            <button type="button" className="ar-admin-menu-button" onClick={() => setMobileSidebarOpen(true)} aria-label="Open navigation">
              <AdminIcon name="menu" size={19}/>
            </button>
            <div className="ar-admin-page-context"><span>ATMA REKHA</span><strong>{navLabel(tab)}</strong></div>
          </div>
          <div className="ar-admin-search">
            <button type="button" className="ar-admin-command-trigger" onClick={() => setCommandOpen(true)} aria-label="Open command palette">
              <AdminIcon name="search" size={16}/>
              <span>Search chapters, readers, comments, tools…</span>
              <kbd>⌘K</kbd>
            </button>
          </div>
          <div className="ar-admin-top-actions">
            <span className="ar-admin-freshness" title={lastRefreshedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(lastRefreshedAt) : 'Not loaded yet'}>
              <i className={notice.type === 'error' ? 'is-error' : ''}/>{lastRefreshedAt ? 'Updated ' + new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(lastRefreshedAt) : 'Updating'}
            </span>
            <button type="button" className="ar-admin-icon-button" onClick={() => activateTab('Reports')} aria-label={'Reports' + (reportCount ? ', ' + reportCount + ' open' : '')}>
              <AdminIcon name="bell" size={17}/>{reportCount > 0 && <i>{reportCount}</i>}
            </button>
            <button type="button" className="ar-admin-refresh" onClick={load} disabled={busy}>
              <AdminIcon name="refresh" size={16}/><span>Refresh</span>
            </button>
            <div className="ar-admin-profile-wrap">
              <button type="button" className="ar-admin-profile" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen} aria-haspopup="menu">
                <span className="ar-admin-avatar">A</span>
                <span><strong>Admin</strong><small>{email || 'Protected'}</small></span>
                <AdminIcon name="chevron" size={13}/>
              </button>
              {profileOpen && <div className="ar-admin-profile-menu" role="menu">
                <div><strong>Admin account</strong><span>{email || 'Protected by Supabase'}</span></div>
                <button type="button" role="menuitem" onClick={logout}><AdminIcon name="logout" size={14}/>Sign out</button>
              </div>}
            </div>
          </div>
        </header>
        <div className="ar-admin-content">
          <div className="ar-admin-command-row"><div><span className="ar-kicker">PUBLISHER · CONTROL CENTER</span><h1>Atma Rekha Admin</h1><p>Publish, maintain and monitor Atma Rekha from one workspace.</p></div><div className="ar-admin-quick-actions"><button type="button" onClick={() => { setChapterPublishProject('atma'); setTab('Chapters'); resetForm(); setChapterEditorOpen(true); }} className="ar-admin-primary-action">New chapter</button></div></div>
          {notice.text && <div className={`ar-admin-notice ${notice.type === 'error' ? 'error' : 'success'}`} role={notice.type === 'error' ? 'alert' : 'status'} aria-live="polite">{notice.type === 'error' ? <AdminIcon name="flag" size={16}/> : <AdminIcon name="sparkle" size={16}/>}<span>{notice.text}</span><button type="button" className="ar-admin-toast-close" aria-label="Dismiss notification" onClick={() => setNotice({ type: '', text: '' })}>×</button></div>}
    {loading ? <div className="admin-loading">Loading dashboard…</div> : tab === 'Control Room' ? <AdminControlRoom chapters={sorted} comments={comments} reports={reports} pageCounts={pageCounts} announcements={announcements} media={media} onTab={activateTab} /> : tab === 'Overview' ? <AdminOverview chapters={sorted} comments={comments} reports={reports} pageCounts={pageCounts} onTab={activateTab} chapterName={chapterName} /> : tab === 'Membership & Earnings' ? <AdminMembership /> : tab === 'Pages' ? <AdminChapterPages chapters={sorted} /> : tab === 'Chapters' ? <AdminChapterManager
      chapters={sorted}
      pageCounts={pageCounts}
      form={form}
      setForm={setForm}
      editing={editing}
      progress={progress}
      busy={busy}
      chapterPublishProject={chapterPublishProject}
      setChapterPublishProject={setChapterPublishProject}
      onSubmit={saveChapter}
      onReset={resetForm}
      onEdit={editChapter}
      onDelete={deleteChapter}
      onReload={load}
      chapterPerformance={chapterPerformance}
      onNewChapter={() => { setChapterPublishProject('atma'); resetForm(); setChapterEditorOpen(true); }}
      editorOpen={chapterEditorOpen}
      onEditorOpenChange={setChapterEditorOpen}
    /> : tab === 'Comments' ? <AdminComments comments={comments} reports={reports} chapters={sorted} pdpklChapters={pdpklChapters} busy={busy} onDeleteComment={deleteComment} onReply={comment => { setReplyTarget(comment); setReplyText(''); }} onReviewReports={markCommentReportsReviewed} /> : tab === 'Card Thumbnails' ? <AdminCardThumbnails chapters={sorted} pdpklChapters={pdpklChapters} busy={busy} onUpload={(chapter, slot, file) => chapter.source === 'pdpkl' ? savePdpklCardThumbnail(chapter, slot, file) : saveCardThumbnail(chapter, slot, file)} onClear={(chapter, slot) => chapter.source === 'pdpkl' ? clearPdpklCardThumbnail(chapter, slot) : clearCardThumbnail(chapter, slot)} /> : tab === 'Reports' ? <AdminModerationQueue
      reports={reports}
      comments={comments}
      reportCount={reportCount}
      onDeleteComment={deleteComment}
      onSetReportStatus={setReportStatus}
    />: tab === 'Community Posts' ? <section className="admin-stack"><section className="admin-card"><div className="admin-card-title"><div><span>COMMUNITY</span><h2>Community Posts</h2><p>Create and publish reader-facing community posts from the admin panel.</p></div></div><button type="button" className="admin-submit" onClick={() => window.dispatchEvent(new CustomEvent('atma-admin-open-community'))}>Create community post</button></section></section> : tab === 'Announcements' ? <section className="admin-stack">
             <div className="ar-admin-announcement-workspace">
       <form onSubmit={saveAnnouncement} className="admin-card admin-form">
        <div className="admin-card-title">
          <div><span>CONTENT</span><h2>Announcements</h2><p>{editingAnnouncementId ? 'Edit an existing announcement without losing its record.' : 'Publish up to 10 announcements. The oldest is automatically removed when an 11th is published.'}</p></div>
          {editingAnnouncementId && <button type="button" onClick={cancelAnnouncementEdit}>Cancel edit</button>}
        </div>
        <label><span>Title</span><input value={announcement.title} onChange={e => setAnnouncement({ ...announcement, title: e.target.value })} placeholder="Title (optional for image-only update)" /></label>
        <label><span>Text</span><textarea value={announcement.content} onChange={e => setAnnouncement({ ...announcement, content: e.target.value })} placeholder="Text (optional for image-only update)" rows="7" /></label>
        <label className="admin-file-field"><span>Thumbnail / image (optional)</span><input type="file" accept={SUPPORTED_IMAGE_ACCEPT} onChange={e => { const file = e.target.files?.[0] || null; setAnnouncement({ ...announcement, thumbnail: file }); setAnnouncementPreview(file ? URL.createObjectURL(file) : ''); }}/>{announcement.thumbnail && <em>{announcement.thumbnail.name}</em>}</label>
        <div className="admin-form-grid">
          <label><span>Placement</span><select value={announcement.display_position} onChange={e => setAnnouncement({ ...announcement, display_position: e.target.value })}><option value="">Automatic · normal order</option>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'} card</option>)}</select></label>
          <label className="check-row"><input type="checkbox" checked={announcement.is_pinned} onChange={e => setAnnouncement({ ...announcement, is_pinned: e.target.checked, pin_target: e.target.checked ? (announcement.pin_target === 'none' ? 'atma' : announcement.pin_target) : 'none' })}/> Pin to top</label>
          {announcement.is_pinned && <div className="ar-admin-pin-target-control" role="group" aria-label="Pin announcement to"><span>Pin on</span><div><button type="button" aria-pressed={announcement.pin_target === 'atma'} className={announcement.pin_target === 'atma' ? 'active' : ''} onClick={() => setAnnouncement({ ...announcement, pin_target: 'atma' })}>Atma Rekha</button><button type="button" aria-pressed={announcement.pin_target === 'pdpkl'} className={announcement.pin_target === 'pdpkl' ? 'active' : ''} onClick={() => setAnnouncement({ ...announcement, pin_target: 'pdpkl' })}>PDPKL</button></div></div>}
        </div>
        <p className="admin-form-hint">Announcement text is shown in full. Pinning always puts this announcement above the others. Placement controls the position among unpinned announcements; Automatic keeps the normal newest-first order.</p>
         <aside className="ar-admin-announcement-preview" aria-live="polite" aria-label="Live announcement preview">
           <span>LIVE PREVIEW</span>
           {announcementPreview && <img src={announcementPreview} alt="Announcement image preview" />}
           <strong>{announcement.title.trim() || 'Announcement title'}</strong>
           <p>{announcement.content.trim() || 'Your announcement text will appear here as readers see it.'}</p>
           <div><span>{announcement.display_position ? 'Slot ' + announcement.display_position : 'Automatic placement'}</span>{announcement.is_pinned && <span className="ar-admin-pinned-badge">Pinned · {announcement.pin_target === 'pdpkl' ? 'PDPKL' : 'Atma Rekha'}</span>}</div>
         </aside>
        <button className="admin-submit" disabled={busy}>{busy ? (editingAnnouncementId ? 'Saving…' : 'Publishing…') : (editingAnnouncementId ? 'Save announcement changes' : 'Publish announcement')}</button>
      </form>
      <div className="admin-card">
        <div className="admin-card-title"><div><span>PUBLISHED</span><h2>Announcements <small>Max 10</small></h2></div></div>
        <div className="admin-mini-list">{announcements.map((item, index) => <div key={item.id}>
          <div className="admin-announcement-admin-row"><span className="ar-admin-announcement-slot">Slot {item.display_position || index + 1}</span>{item.image_url && <img src={item.image_url} alt="" loading="lazy"/>}<div><strong>{item.title?.startsWith('__image_only_') ? 'Image-only announcement' : item.title || 'Announcement'}</strong><p>{item.content || (item.image_url ? 'Image-only announcement' : '')}</p><small>{item.is_pinned ? 'Pinned · ' : ''}{item.display_position ? 'Position ' + item.display_position + ' · ' : ''}{new Date(item.published_at || item.created_at).toLocaleString(undefined)}</small></div></div>
          <div className="admin-row-actions"><button type="button" onClick={() => editAnnouncement(item)} disabled={busy}>Edit</button><button type="button" className="danger-text" onClick={() => deleteAnnouncement(item)} disabled={busy}>Delete</button></div>
        </div>)}</div>
        {!announcements.length && <p className="muted center">No announcements yet.</p>}
      </div>
       </div>
    </section> : <section className="admin-stack">
          <section className="admin-card admin-media-library">
            <div className="admin-card-title">
              <div><span>LIBRARY</span><h2>Media library</h2><p>{media.length} stored items · searchable and reusable across publishing workflows.</p></div>
              <button type="button" className="admin-submit" onClick={() => setMediaModalOpen(true)}>Add media</button>
            </div>
            <div className="admin-form-grid admin-media-filters">
              <label><span>Search media</span><input value={mediaSearch} onChange={event => setMediaSearch(event.target.value)} placeholder="Search title or category…" /></label>
              <label><span>Category</span><select value={mediaCategoryFilter} onChange={event => setMediaCategoryFilter(event.target.value)}><option value="all">All categories</option>{Array.from(new Set(media.map(item => String(item.category || '').trim()).filter(Boolean))).sort().map(category => <option key={category} value={category}>{category}</option>)}</select></label>
            </div>
          </section>
          <div className="admin-media-grid">
            {media.filter(item => {
              const query = mediaSearch.trim().toLowerCase();
              const searchable = (String(item.title || '') + ' ' + String(item.category || '')).toLowerCase();
              return (!query || searchable.includes(query)) && (mediaCategoryFilter === 'all' || item.category === mediaCategoryFilter);
            }).map(item => <article key={item.id}>
              {item.image_url && <img src={item.image_url} alt={item.title ? item.title + ' preview' : 'Media preview'} loading="lazy" />}
              <div><strong>{item.title}</strong><span>{item.category}</span>
                <div className="admin-row-actions">
                  <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(item.image_url); notifyAdminToast('Media URL copied.', 'success'); } catch (error) { notifyAdminToast('Could not copy URL: ' + (error?.message || 'clipboard unavailable'), 'error'); } }} disabled={!item.image_url} title={!item.image_url ? 'This media item has no URL to copy.' : 'Copy the media URL'}>Copy URL</button>
                  <button type="button" className="danger-text" onClick={() => deleteMedia(item.id)} disabled={busy} title={busy ? 'Wait for the current admin operation to finish.' : 'Delete this media item'}>Delete</button>
                </div>
              </div>
            </article>)}
            {!media.some(item => {
              const query = mediaSearch.trim().toLowerCase();
              const searchable = (String(item.title || '') + ' ' + String(item.category || '')).toLowerCase();
              return (!query || searchable.includes(query)) && (mediaCategoryFilter === 'all' || item.category === mediaCategoryFilter);
            }) && <div className="admin-card admin-empty-state"><strong>No media matches these filters.</strong><p>Try a different search or category, or add a media item.</p><button type="button" className="admin-submit" onClick={() => { setMediaSearch(''); setMediaCategoryFilter('all'); setMediaModalOpen(true); }}>Add media</button></div>}
          </div>
          {mediaModalOpen && <div className="ar-admin-confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMediaModalOpen(false); }}>
            <form onSubmit={saveMedia} className="admin-card admin-form ar-admin-media-dialog" role="dialog" aria-modal="true" aria-labelledby="ar-admin-media-title">
              <div className="admin-card-title"><div><span>LIBRARY</span><h2 id="ar-admin-media-title">Add media item</h2><p>Store a reusable image URL and category.</p></div><button type="button" aria-label="Close add media dialog" onClick={() => setMediaModalOpen(false)}>×</button></div>
              <label><span>Title</span><input value={mediaForm.title} onChange={event => setMediaForm({ ...mediaForm, title: event.target.value })} required placeholder="e.g. Chapter banner" /></label>
              <label><span>Category</span><input value={mediaForm.category} onChange={event => setMediaForm({ ...mediaForm, category: event.target.value })} required placeholder="e.g. Covers" /></label>
              <label><span>Image URL</span><input type="url" value={mediaForm.image_url} onChange={event => setMediaForm({ ...mediaForm, image_url: event.target.value })} required placeholder="https://…" /></label>
              <div className="admin-form-actions"><button type="button" onClick={() => setMediaModalOpen(false)}>Cancel</button><button className="admin-submit" disabled={busy} title={busy ? 'Wait for the current admin operation to finish.' : undefined}>{busy ? 'Saving…' : 'Add media'}</button></div>
            </form>
          </div>}
        </section>

        </div>
        <nav className="admin-bottom-nav" aria-label="Admin quick navigation">
          <button type="button" className={tab === 'Control Room' ? 'active' : ''} onClick={() => activateTab('Control Room')}><AdminIcon name="chart" size={16}/><span>Control Room</span></button>
          <button type="button" className={tab === 'Chapters' ? 'active' : ''} onClick={() => activateTab('Chapters')}><AdminIcon name="book" size={16}/><span>Chapters</span></button>
          <button type="button" className={tab === 'Reports' ? 'active' : ''} onClick={() => activateTab('Reports')}><AdminIcon name="flag" size={16}/><span>Reports</span>{reportCount > 0 ? <b>{reportCount}</b> : null}</button>
          <button type="button" onClick={() => setMobileSidebarOpen(true)}><AdminIcon name="menu" size={16}/><span>Menu</span></button>
        </nav>
        <div className="ar-admin-toast-region" aria-live="polite" aria-relevant="additions text">
          {toasts.map(toast => <div className={`ar-admin-toast ${toast.type || 'error'}`} role={toast.type === 'error' ? 'alert' : 'status'} key={toast.id}>
            <span>{toast.message}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))}>×</button>
          </div>)}
        </div>
        {replyTarget && <div className="ar-admin-confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) { setReplyTarget(null); setReplyText(''); } }}>
          <form className="ar-admin-confirm-dialog ar-admin-reply-dialog" role="dialog" aria-modal="true" aria-labelledby="ar-admin-reply-title" onSubmit={replyToComment}>
            <h2 id="ar-admin-reply-title">Reply to comment</h2>
            <p>Replying to <strong>{replyTarget.author_display_name || replyTarget.author_name || 'Reader'}</strong>. Your reply will be added to the existing thread.</p>
            <label htmlFor="ar-admin-reply-content">Reply text</label>
            <textarea id="ar-admin-reply-content" value={replyText} onChange={event => setReplyText(event.target.value)} rows={5} required maxLength={5000} placeholder="Write a thoughtful response…" />
            <div className="ar-admin-confirm-actions">
              <button type="button" className="ar-admin-confirm-cancel" onClick={() => { setReplyTarget(null); setReplyText(''); }}>Cancel</button>
              <button type="submit" className="ar-admin-confirm-accept" disabled={busy || !replyText.trim()} title={busy ? 'Wait for the current admin operation to finish.' : !replyText.trim() ? 'Enter a reply before posting.' : undefined}>{busy ? 'Posting…' : 'Post reply'}</button>
            </div>
          </form>
        </div>}
        {confirmDialog && <div className="ar-admin-confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) { confirmDialog.resolve?.(false); setConfirmDialog(null); } }}>
          <section className="ar-admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ar-admin-confirm-title" aria-describedby="ar-admin-confirm-message ar-admin-confirm-consequence">
            <div className="ar-admin-confirm-icon"><AdminIcon name="flag" size={20}/></div>
            <h2 id="ar-admin-confirm-title">{confirmDialog.title || 'Confirm action'}</h2>
            <p id="ar-admin-confirm-message">{confirmDialog.message}</p>
            {confirmDialog.consequence && <p id="ar-admin-confirm-consequence" className="ar-admin-confirm-consequence">{confirmDialog.consequence}</p>}
            <div className="ar-admin-confirm-actions">
              <button type="button" className="ar-admin-confirm-cancel" autoFocus onClick={() => { confirmDialog.resolve?.(false); setConfirmDialog(null); }}>Cancel</button>
              <button type="button" className="ar-admin-confirm-accept" onClick={() => { confirmDialog.resolve?.(true); setConfirmDialog(null); }}>{confirmDialog.confirmLabel || 'Confirm'}</button>
            </div>
          </section>
        </div>}
        {shortcutHelpOpen && <div className="ar-admin-confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShortcutHelpOpen(false); }}>
          <section className="ar-admin-confirm-dialog ar-admin-shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="ar-admin-shortcuts-title">
            <h2 id="ar-admin-shortcuts-title">Keyboard shortcuts</h2>
            <dl><div><dt>⌘K / Ctrl+K</dt><dd>Open command search</dd></div><div><dt>N</dt><dd>Create a new chapter</dd></div><div><dt>R</dt><dd>Refresh admin data</dd></div><div><dt>Esc</dt><dd>Close the open dialog</dd></div><div><dt>?</dt><dd>Show this shortcut list</dd></div></dl>
            <div className="ar-admin-confirm-actions"><button type="button" className="ar-admin-confirm-cancel" autoFocus onClick={() => setShortcutHelpOpen(false)}>Close</button></div>
          </section>
        </div>}
        <AdminCommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          chapters={sorted}
          comments={comments}
          pageCounts={pageCounts}
          onSelectTab={activateTab}
          onOpenTool={openAdminTool}
          onNewChapter={() => { setChapterPublishProject('atma'); activateTab('Chapters'); resetForm(); setChapterEditorOpen(true); }}
          onRefresh={load}
        />
        {/* Mount event-driven tools once so sidebar, dashboard and command-palette actions share real handlers. */}
        <AdminChapterHealth />
        <AdminOperations />
        <AdminManagementTools />
        <AdminModerationTools />
        <AdminGroupChatTools />
        <AdminProTools />
        <CommunityAdmin />
      </div>
    </div>
  </main>;
}