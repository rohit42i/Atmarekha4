import { useEffect, useMemo, useRef, useState } from 'react';
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
import './admin-master-system.css';
import AdminCommandPalette from './AdminCommandPalette.jsx';
import AdminChapterManager from './AdminChapterManager.jsx';
import AdminModerationQueue from './AdminModerationQueue.jsx';
import AdminCardThumbnails from './AdminCardThumbnails.jsx';
import AdminChapterHealth from './AdminChapterHealth.jsx';
import AdminOperations from './AdminOperations.jsx';
import AdminManagementTools from './AdminManagementTools.jsx';
import AdminModerationTools from './AdminModerationTools.jsx';
import AdminGroupChatTools from './AdminGroupChatTools.jsx';
import AdminProTools from './AdminProTools.jsx';
import CommunityAdmin from './CommunityAdmin.jsx';
import PrivacyRequestsAdmin from './PrivacyRequestsAdmin.jsx';
import EmailStudio from './EmailStudio.jsx';
import { buildPdlplChapters } from './palDoPalKeLamhe';
import { getPdlplMediaUrl, uploadPdlplFile, removePdlplFiles } from './pdlplR2';

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

const ADMIN_PAGE_BATCH_SIZE = 1000;

async function loadAllChapterPageRows() {
  const rows = [];
  let offset = 0;
  while (offset <= 100000) {
    const { data, error } = await supabase
      .from(PAGES)
      .select('id, chapter_id, page_number, image_url')
      .order('chapter_id', { ascending: true })
      .order('page_number', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + ADMIN_PAGE_BATCH_SIZE - 1);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < ADMIN_PAGE_BATCH_SIZE) return { data: rows, error: null };
    offset += ADMIN_PAGE_BATCH_SIZE;
  }
  throw new Error('Page inventory exceeded the safe 100,000-row refresh limit. Use the dedicated Page Editor to work with individual chapters.');
}

async function loadAllCommentReportRows() {
  const rows = [];
  let offset = 0;
  while (offset <= 100000) {
    const { data, error } = await supabase
      .from('comment_reports')
      .select('id, comment_id, reason, status, created_at, reviewed_at, reviewed_by')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + ADMIN_PAGE_BATCH_SIZE - 1);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < ADMIN_PAGE_BATCH_SIZE) return { data: rows, error: null };
    offset += ADMIN_PAGE_BATCH_SIZE;
  }
  throw new Error('Report queue exceeded the safe 100,000-row refresh limit. Refine the queue in the database before refreshing the complete history.');
}

async function captureAdminSource(work) {
  let timeoutId;
  try {
    const result = await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error('This admin data request timed out after 30 seconds.')),
          30000,
        );
      }),
    ]);
    if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'error') &&
        (Object.prototype.hasOwnProperty.call(result, 'data') || Object.prototype.hasOwnProperty.call(result, 'count'))) {
      return { data: result.data ?? null, count: result.count ?? null, error: result.error || null };
    }
    return { data: result ?? null, count: result?.count ?? null, error: null };
  } catch (error) {
    return { data: null, count: null, error };
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

function adminSourceError(error) {
  return String(error?.message || error || 'Unknown error').slice(0, 220);
}


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
    if (error) console.warn('Admin activity log failed:', error);
  } catch (error) {
    console.warn('Admin activity log failed:', error);
  }
}

const emptyForm = () => ({ number: '', language: 'hi', title: '', description: '', status: 'Published', releaseDate: '', cover: null, pages: [] });

const ADMIN_NAV_GROUPS = [
  { label: 'Workspace', items: [
    { key: 'Overview', icon: 'grid', label: 'Dashboard' },
    { key: 'Control Room', icon: 'chart', label: 'Control Room' },
  ]},
  { label: 'Publishing', items: [
    { key: 'Chapters', icon: 'book', label: 'Chapter Manager' },
    { key: 'Pages', icon: 'layers', label: 'Page Editor' },
    { key: 'Card Thumbnails', icon: 'image', label: 'Card Thumbnails' },
    { key: 'Media', icon: 'image', label: 'Media Library' },
  ]},
  { label: 'Community', items: [
    { key: 'Comments', icon: 'message', label: 'Comments' },
    { key: 'Reports', icon: 'flag', label: 'Reports' },
    { key: 'Announcements', icon: 'bell', label: 'Announcements' },
    { key: 'Email Campaigns', icon: 'bell', label: 'Email Campaigns' },
    { key: 'Community Posts', icon: 'message', label: 'Community Posts' },
    { key: '__notifications', icon: 'bell', label: 'Push Notifications', action: 'atma-admin-open-management', detail: { view: 'notifications' } },
    { key: '__moderation', icon: 'flag', label: 'Community Moderation', action: 'atma-admin-open-moderation' },
    { key: '__group', icon: 'message', label: 'Group Chat', action: 'atma-admin-open-group-chat' },
  ]},
  { label: 'Membership', items: [
    { key: 'Membership & Earnings', icon: 'chart', label: 'Revenue & Membership' },
    { key: '__users', icon: 'user', label: 'Users & Memberships', action: 'atma-admin-open-management', detail: { view: 'users' } },
  ]},
  { label: 'System', items: [
    { key: 'Privacy Requests', icon: 'settings', label: 'Privacy Requests' },
    { key: '__email-changes', icon: 'user', label: 'Email Change Requests', action: 'atma-admin-open-management', detail: { view: 'emailChanges' } },
    { key: '__command', icon: 'sparkle', label: 'Command Center', action: 'atma-admin-open-command' },
    { key: '__health', icon: 'pulse', label: 'Chapter Health', action: 'atma-admin-open-health' },
    { key: '__operations', icon: 'settings', label: 'Operations & Recovery', action: 'atma-admin-open-operations' },
    { key: '__activity', icon: 'calendar', label: 'Admin Activity Log', action: 'atma-admin-open-management', detail: { view: 'activity' } },
    { key: '__pro', icon: 'chart', label: 'Advanced Tools', action: 'atma-admin-open-pro' },
  ]},
];

export default function AdminPanel({ onLogout, adminUser }) {
  const [tab, setTab] = useState('Control Room');
  const [chapters, setChapters] = useState([]);
  const [pdpklChapters, setPdpklChapters] = useState([]);
  const [pageCounts, setPageCounts] = useState({});
  const [pageCountsAvailable, setPageCountsAvailable] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsAvailable, setCommentsAvailable] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportsAvailable, setReportsAvailable] = useState(false);
  const [openReportCount, setOpenReportCount] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsAvailable, setAnnouncementsAvailable] = useState(false);
  const [media, setMedia] = useState([]);
  const [mediaAvailable, setMediaAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' });
  const [announcement, setAnnouncement] = useState({ title: '', content: '', thumbnail: null, is_pinned: false, pin_target: 'none', display_position: '' });
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [mediaForm, setMediaForm] = useState({ title: '', file: null, category: '' });
  const [chapterPublishProject, setChapterPublishProject] = useState('atma');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const loadSequence = useRef(0);
  const hasLoaded = useRef(false);
  const [chapterPerformance, setChapterPerformance] = useState({});
  const [adminTheme, setAdminTheme] = useState(() => {
    try { return window.localStorage.getItem('ar-admin-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const handleEscape = event => {
      if (event.key === 'Escape') setMobileSidebarOpen(false);
    };
    const drawerBreakpoint = window.matchMedia('(max-width: 980px)');
    const previousOverflow = document.body.style.overflow;
    const syncBodyScroll = () => {
      document.body.style.overflow = drawerBreakpoint.matches ? 'hidden' : previousOverflow;
    };
    syncBodyScroll();
    if (drawerBreakpoint.matches) {
      document.querySelector('.ar-admin-sidebar .ar-admin-mobile-close')?.focus();
    }
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', syncBodyScroll);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', syncBodyScroll);
      document.body.style.overflow = previousOverflow;
      if (drawerBreakpoint.matches) document.querySelector('.ar-admin-menu-button')?.focus();
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    try { window.localStorage.setItem('ar-admin-theme', adminTheme); } catch { /* storage can be unavailable */ }
    if (typeof document === 'undefined') return undefined;
    const body = document.body;
    const previousTheme = body.getAttribute('data-admin-theme');
    const hadDarkClass = body.classList.contains('dark-theme-variables');
    body.setAttribute('data-admin-theme', adminTheme);
    body.classList.toggle('dark-theme-variables', adminTheme === 'dark');
    return () => {
      if (previousTheme === null) body.removeAttribute('data-admin-theme');
      else body.setAttribute('data-admin-theme', previousTheme);
      body.classList.toggle('dark-theme-variables', hadDarkClass);
    };
  }, [adminTheme]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const fontLinks = [
      ['ar-admin-poppins-font', 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap'],
      ['ar-admin-material-icons-sharp', 'https://fonts.googleapis.com/icon?family=Material+Icons+Sharp'],
    ];
    const created = [];
    for (const [id, href] of fontLinks) {
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      created.push(link);
    }
    return () => created.forEach(link => link.remove());
  }, []);

  const sorted = useMemo(() => [...chapters].sort((a, b) => {
    const an = Number(a.chapterNumber), bn = Number(b.chapterNumber);
    if (!Number.isFinite(an) && !Number.isFinite(bn)) return 0;
    if (!Number.isFinite(an)) return 1;
    if (!Number.isFinite(bn)) return -1;
    return an - bn;
  }), [chapters]);

  const resetForm = () => { setEditing(null); setForm(emptyForm()); setProgress({ current: 0, total: 0, text: '' }); };

  const load = async () => {
    const requestId = ++loadSequence.current;
    const initialLoad = !hasLoaded.current;
    if (initialLoad) setLoading(true);
    setNotice({ type: '', text: '' });
    const warnings = [];
    try {
      const user = initialLoad && adminUser ? adminUser : await requireAdmin();
      if (requestId !== loadSequence.current) return;
      setEmail(user.email || '');
      // Render the authenticated admin workspace before waiting for optional data sources.
      if (initialLoad) {
        hasLoaded.current = true;
        setLoading(false);
      }

      const [chapterResult, pdpklResult, pageResult, commentResult, reportResult, openReportResult, announcementResult, mediaResult, performanceResult] = await Promise.all([
        captureAdminSource(() => buildChapters()),
        captureAdminSource(() => buildPdlplChapters()),
        captureAdminSource(() => loadAllChapterPageRows()),
        captureAdminSource(() => supabase.from('comments').select('id, user_id, chapter_id, announcement_id, author_name, content, created_at, parent_comment_id').order('created_at', { ascending: false }).limit(100)),
        captureAdminSource(() => loadAllCommentReportRows()),
        captureAdminSource(() => supabase.from('comment_reports').select('id', { count: 'exact', head: true }).or('status.is.null,status.eq.open')),
        captureAdminSource(() => supabase.from('announcements').select('id, title, content, image_url, is_pinned, pin_target, display_position, published_at, created_at').order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(10)),
        captureAdminSource(() => supabase.from('media').select('id, title, image_url, category, created_at').order('created_at', { ascending: false }).limit(200)),
        captureAdminSource(() => supabase.functions.invoke('get-admin-console-data', { body: { action: 'analytics', days: 30 } }).then(result => ({ data: result.data?.data || null, error: result.error }))),
      ]);
      if (requestId !== loadSequence.current) return;
      if (chapterResult.error) {
        warnings.push('Chapters: ' + adminSourceError(chapterResult.error));
      } else {
        setChapters(Array.isArray(chapterResult.data) ? chapterResult.data : []);
      }

      if (pdpklResult.error) warnings.push('PDPKL chapters: ' + adminSourceError(pdpklResult.error));
      else setPdpklChapters(Array.isArray(pdpklResult.data) ? pdpklResult.data : []);

      if (pageResult.error) {
        setPageCountsAvailable(false);
        warnings.push('Page inventory: ' + adminSourceError(pageResult.error));
      } else {
        const counts = {};
        for (const row of pageResult.data || []) counts[row.chapter_id] = (counts[row.chapter_id] || 0) + 1;
        setPageCounts(counts);
        setPageCountsAvailable(true);
      }

      if (commentResult.error) {
        setCommentsAvailable(false);
        warnings.push('Comments: ' + adminSourceError(commentResult.error));
      } else {
        let mergedComments = commentResult.data || [];
        if (!reportResult.error) {
          try {
            mergedComments = await mergeReportedComments(reportResult.data || [], mergedComments);
          } catch (error) {
            warnings.push('Older reported comments: ' + adminSourceError(error));
          }
        }
        const commenterIds = [...new Set(mergedComments.map(row => row.user_id).filter(Boolean))];
        let commenterProfiles = {};
        if (commenterIds.length) {
          const profileResult = await captureAdminSource(() => supabase
            .from('profiles')
            .select('id, display_name, username')
            .in('id', commenterIds));
          if (profileResult.error) warnings.push('Comment author profiles: ' + adminSourceError(profileResult.error));
          else commenterProfiles = Object.fromEntries((profileResult.data || []).map(profile => [profile.id, profile]));
        }
        setCommentsAvailable(true);
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
      }

      if (reportResult.error) {
        setReportsAvailable(false);
        warnings.push('Report queue: ' + adminSourceError(reportResult.error));
      } else {
        setReports(reportResult.data || []);
        setReportsAvailable(true);
      }
      if (openReportResult.error) {
        warnings.push('Open report count: ' + adminSourceError(openReportResult.error));
        setOpenReportCount(null);
      } else {
        setOpenReportCount(Number(openReportResult.count ?? 0));
      }

      if (announcementResult.error) {
        setAnnouncementsAvailable(false);
        warnings.push('Announcements: ' + adminSourceError(announcementResult.error));
      } else {
        setAnnouncements(announcementResult.data || []);
        setAnnouncementsAvailable(true);
      }

      if (mediaResult.error) {
        setMediaAvailable(false);
        warnings.push('Media library: ' + adminSourceError(mediaResult.error));
      } else {
        setMedia(mediaResult.data || []);
        setMediaAvailable(true);
      }

      if (performanceResult.error) {
        warnings.push('Chapter performance metrics: ' + adminSourceError(performanceResult.error));
      } else {
        const performanceMap = {};
        for (const row of performanceResult.data?.chapter_stats || []) {
          performanceMap[row.id] = {
            views: Number(row.period_views ?? row.views ?? 0),
            likes: Number(row.period_likes ?? row.likes ?? 0),
            shares: Number(row.period_shares ?? row.shares ?? 0),
          };
        }
        setChapterPerformance(performanceMap);
      }
      setLastRefreshedAt(new Date());
      if (warnings.length) {
        setNotice({ type: 'error', text: 'Admin panel loaded with limited data: ' + warnings.join(' · ') });
      }
    } catch (error) {
      console.error(error);
      setNotice({ type: 'error', text: error.message || 'Unable to load admin data.' });
    } finally {
      if (requestId === loadSequence.current) {
        hasLoaded.current = true;
        setLoading(false);
      }
    }
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

  useEffect(() => {
    void load();
    return () => { loadSequence.current += 1; };
  }, []);

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
      if (isTyping(event) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (key === 'n') {
        event.preventDefault();
        setChapterPublishProject('atma');
        activateTab('Chapters');
        resetForm();
      } else if (key === 'r') {
        event.preventDefault();
        load();
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
      let notificationText = '';
      if (String(form.status).toLowerCase() === 'published' && String(editing?.status || '').toLowerCase() !== 'published') {
        const { data: notification, error: notificationError } = await supabase.functions.invoke('send-reader-event-notification', { body: { eventType: 'new_chapters', eventId: chapterId } });
        notificationText = notificationError || !notification?.ok ? ' Chapter saved, but notification delivery could not be confirmed.' : ` Email: ${Number(notification.emailSent || 0)} sent${notification.emailFailed ? `, ${Number(notification.emailFailed)} failed` : ''}; push: ${Number(notification.sent || 0)} sent.`;
      }
      resetForm();
      await load();
      setNotice({ type: 'success', text: savedLabel + ' ' + (wasEditing ? 'updated' : 'uploaded') + ' successfully.' + notificationText });
    } catch (error) {
      console.error(error);
      for (const item of uploadedPaths) {
        const committed = (item.kind === 'page' && pagesCommitted) || (item.kind === 'cover' && coverCommitted);
        if (!committed) {
          try { await removeFiles(item.bucket, [item.path]); }
          catch (cleanupError) {
            await logAdminAction(adminUser, 'r2_cleanup_failed', item.kind === 'page' ? 'chapter_pages' : 'chapter_cover', chapterId, { bucket: item.bucket, paths: [item.path], error: cleanupError.message });
          }
        }
      }

      if (chapterCreated && !pagesCommitted && chapterId) {
        try {
          await supabase.from(CHAPTERS).delete().eq('id', chapterId);
          // The new chapter was never valid without its required page set.
          // Mark committed uploads as cleanable so they do not become R2 orphans.
          for (const item of uploadedPaths) {
            try { await removeFiles(item.bucket, [item.path]); } catch (_) {}
          }
        } catch (_) {}
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
    setTab('Chapters'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function deleteChapter(chapter) {
    if (!window.confirm('Delete ' + (chapter.chapterNumber ? 'Chapter ' + chapter.chapterNumber : 'this unnumbered entry') + ' permanently?')) return;
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
    if (!window.confirm('Delete this comment and its replies?')) return;
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
    setTab('Announcements');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelAnnouncementEdit() {
    setEditingAnnouncementId(null);
    setAnnouncement({ title: '', content: '', thumbnail: null, is_pinned: false, pin_target: 'none', display_position: '' });
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
          try { await removeFiles(item.bucket, [item.path]); } catch (_) {}
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
        try { await removeFiles(COVER_BUCKET, [uploadedPath]); } catch (_) {}
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
      if (oldPath) { try { await removePdlplFiles([oldPath]); } catch (e) { console.warn('PDPKL old thumbnail cleanup failed:', e); } }
      await logAdminAction(adminUser, 'save_pdpkl_card_thumbnail', 'pdlpl_chapter', chapter.id, { slot, path });
      await load(); setNotice({ type: 'success', text: 'PDPKL ' + (slot === 'mobile' ? 'mobile' : 'desktop') + ' card thumbnail saved.' });
    } catch (error) {
      if (uploadedPath && !committed) { try { await removePdlplFiles([uploadedPath]); } catch (_) {} }
      console.error(error); setNotice({ type: 'error', text: error.message || 'PDPKL card thumbnail upload failed.' });
    } finally { setBusy(false); }
  }

  async function clearPdpklCardThumbnail(chapter, slot) {
    if (!chapter?.id || busy) return;
    if (!window.confirm('Remove the custom PDPKL ' + (slot === 'mobile' ? 'mobile' : 'desktop') + ' card thumbnail?')) return;
    setBusy(true); setNotice({ type: '', text: '' });
    try {
      const column = slot === 'mobile' ? 'card_thumbnail_mobile_path' : 'card_thumbnail_desktop_path';
      const oldPath = slot === 'mobile' ? chapter.cardThumbnailMobilePath : chapter.cardThumbnailDesktopPath;
      const { error } = await supabase.from('pal_do_pal_ke_lamhe_chapters').update({ [column]: null }).eq('id', chapter.id);
      if (error) throw new Error('PDPKL card thumbnail reset failed: ' + error.message);
      if (oldPath) { try { await removePdlplFiles([oldPath]); } catch (e) { console.warn('PDPKL thumbnail cleanup failed:', e); } }
      await load(); setNotice({ type: 'success', text: 'PDPKL custom card thumbnail removed.' });
    } catch (error) { console.error(error); setNotice({ type: 'error', text: error.message || 'PDPKL card thumbnail reset failed.' }); }
    finally { setBusy(false); }
  }

  async function clearCardThumbnail(chapter, slot) {
    if (!chapter?.id || !['desktop', 'mobile'].includes(slot) || busy) return;
    const label = slot === 'mobile' ? 'mobile' : 'desktop';
    if (!window.confirm('Remove the custom ' + label + ' card thumbnail for ' + (chapter.chapterNumber ? 'Chapter ' + chapter.chapterNumber : 'this chapter') + '? The normal chapter thumbnail will be used again.')) return;
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
    let uploadedPath = null;
    let mediaCommitted = false;

    try {
      adminUser = await requireAdmin();
      const file = mediaForm.file;
      if (!mediaForm.title.trim() || !file || !mediaForm.category.trim()) {
        throw new Error('Title, image file, and category are required.');
      }
      if (!isSupportedImageFile(file)) {
        throw new Error('Unsupported image format. Use JPG, PNG, WEBP, GIF, BMP, or AVIF.');
      }

      const safeName = String(file.name || 'media-image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
      uploadedPath = `media/${crypto.randomUUID()}-${safeName}`;
      const imageUrl = await upload(COVER_BUCKET, file, uploadedPath);
      const { data, error } = await supabase.from('media').insert({
        title: mediaForm.title.trim(),
        image_url: imageUrl,
        category: mediaForm.category.trim(),
      }).select('id').single();
      if (error) throw error;
      mediaCommitted = true;

      await logAdminAction(adminUser, 'create_media', 'media', data?.id || null, {
        title: mediaForm.title.trim(),
        category: mediaForm.category.trim(),
        storage: 'cloudflare-r2',
        path: uploadedPath,
      });
      setMediaForm({ title: '', file: null, category: '' });
      await load();
      setNotice({ type: 'success', text: 'Media uploaded to R2 and added.' });
    } catch (error) {
      if (uploadedPath && !mediaCommitted) {
        try {
          await removeFiles(COVER_BUCKET, [uploadedPath]);
        } catch (cleanupError) {
          await logAdminAction(adminUser, 'r2_cleanup_failed', 'media', null, {
            bucket: COVER_BUCKET,
            paths: [uploadedPath],
            error: cleanupError.message,
          });
        }
      }
      await logAdminAction(adminUser, 'create_media_failed', 'media', null, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Media upload failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnnouncement(item) {
    if (!window.confirm('Delete this announcement permanently?')) return;
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

  async function deleteMedia(item) {
    if (!item?.id || !window.confirm('Delete this media item permanently?')) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const { error } = await supabase.from('media').delete().eq('id', item.id);
      if (error) throw error;

      let cleanupPending = false;
      const oldPath = pathFromUrl(item.image_url, COVER_BUCKET);
      if (oldPath) {
        try {
          await removeFiles(COVER_BUCKET, [oldPath]);
        } catch (cleanupError) {
          cleanupPending = true;
          await logAdminAction(adminUser, 'r2_cleanup_failed', 'media', item.id, {
            bucket: COVER_BUCKET,
            paths: [oldPath],
            error: cleanupError.message,
          });
        }
      }

      await logAdminAction(adminUser, 'delete_media', 'media', item.id, { cleanup_pending: cleanupPending });
      await load();
      setNotice({
        type: 'success',
        text: cleanupPending ? 'Media record deleted. R2 cleanup is pending in Operations.' : 'Media deleted.',
      });
    } catch (error) {
      await logAdminAction(adminUser, 'delete_media_failed', 'media', item?.id || null, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Media delete failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function logout() { await supabase.auth.signOut(); onLogout?.(); }

  const tabs = ['Overview', 'Control Room', 'Chapters', 'Pages', 'Comments', 'Reports', 'Announcements', 'Email Campaigns', 'Community Posts', 'Membership & Earnings', 'Card Thumbnails', 'Media', 'Privacy Requests'];
  const chapterName = id => { const chapter = chapters.find(item => item.id === id); return chapter ? `Chapter ${chapter.chapterNumber ?? 'Special'} — ${chapter.title} · ${chapterLanguageLabel(chapter.language)}` : 'Unknown chapter'; };
  const commentById = id => comments.find(comment => comment.id === id);
  const reportCount = openReportCount ?? reports.filter(report => (report.status || 'open') === 'open').length;
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
  return <main className="admin-page ar-admin-v3" data-admin-root="true" data-admin-theme={adminTheme}>
    <div className={`ar-admin-app${hasUtilityRail ? ' has-utility-rail' : ''}`}>
      <AdminSidebar
        groups={ADMIN_NAV_GROUPS}
        activeKey={tab}
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        onSelect={item => {
          setMobileSidebarOpen(false);
          if (item.action) openAdminTool(item.action, item.detail);
          else activateTab(item.key);
        }}
        email={email}
        reportCount={reportCount}
        connectionState={loading ? 'Loading admin data…' : notice.type === 'error' ? 'Needs attention' : 'Operational'}
        connectionError={notice.type === 'error'}
      />
      {mobileSidebarOpen && <button type="button" className="ar-admin-drawer-backdrop" onClick={() => setMobileSidebarOpen(false)} aria-label="Close admin navigation" />}
      <div className="ar-admin-main">
        <header className="ar-admin-topbar">
          <div className="ar-admin-topbar-left">
            <button type="button" className="ar-admin-menu-button" onClick={() => setMobileSidebarOpen(value => !value)} aria-label={mobileSidebarOpen ? 'Close navigation' : 'Open navigation'} aria-controls="ar-admin-sidebar" aria-expanded={mobileSidebarOpen}>
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
            <button type="button" className="ar-admin-icon-button ar-admin-theme-toggle" onClick={() => setAdminTheme(value => value === 'dark' ? 'light' : 'dark')} aria-label={adminTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={adminTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} aria-pressed={adminTheme === 'light'}>
              <span className={adminTheme === 'light' ? 'active' : ''} aria-hidden="true"><span className="material-icons-sharp">light_mode</span></span>
              <span className={adminTheme === 'dark' ? 'active' : ''} aria-hidden="true"><span className="material-icons-sharp">dark_mode</span></span>
            </button>
            <button type="button" className="ar-admin-icon-button ar-admin-refresh" onClick={load} disabled={busy} aria-label="Refresh admin data" title="Refresh">
              <AdminIcon name="refresh" size={16}/>
            </button>
            <div className="ar-admin-profile-wrap">
              <button type="button" className="ar-admin-profile" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen} aria-haspopup="menu">
                <span className="ar-admin-avatar">A</span>
                <span className="sr-only">Admin account</span>
              </button>
              {profileOpen && <div className="ar-admin-profile-menu" role="menu">
                <div><strong>Admin account</strong><span>{email || 'Protected by Supabase'}</span></div>
                <button type="button" role="menuitem" onClick={logout}><AdminIcon name="logout" size={14}/>Sign out</button>
              </div>}
            </div>
          </div>
        </header>
        <div className="ar-admin-content">
          {notice.text && <div className={`ar-admin-notice ${notice.type === 'error' ? 'error' : 'success'}`} role="status">{notice.type === 'error' ? <AdminIcon name="flag" size={16}/> : <AdminIcon name="sparkle" size={16}/>}<span>{notice.text}</span></div>}
    {loading ? <div className="admin-loading">Loading dashboard…</div> : tab === 'Privacy Requests' ? <PrivacyRequestsAdmin /> : tab === 'Control Room' ? <AdminControlRoom chapters={sorted} comments={comments} reports={reports} pageCounts={pageCounts} announcements={announcements} media={media} onTab={activateTab} /> : tab === 'Overview' ? <AdminOverview chapters={sorted} comments={comments} reports={reports} pageCounts={pageCounts} onTab={activateTab} chapterName={chapterName} /> : tab === 'Membership & Earnings' ? <AdminMembership /> : tab === 'Pages' ? <AdminChapterPages chapters={sorted} /> : tab === 'Chapters' ? <AdminChapterManager
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
      onNewChapter={() => { setChapterPublishProject('atma'); resetForm(); }}
    /> : tab === 'Comments' ? <section className="admin-card"><div className="admin-card-title"><div><span>MODERATION</span><h2>Comments</h2><p>{comments.length} recent comments · replies included</p></div></div><div className="admin-comment-list">{comments.map(comment => <article key={comment.id} data-admin-comment-id={comment.id}><div className="admin-comment-avatar">{(comment.author_display_name || comment.author_name || 'R').slice(0, 1).toUpperCase()}</div><div><div className="admin-comment-meta"><strong>{comment.author_display_name || comment.author_name || 'Reader'}</strong><span>{new Date(comment.created_at).toLocaleString('en-IN')}</span></div><p>{comment.content}</p><small>{comment.announcement_id ? 'Announcement' : chapterName(comment.chapter_id)}{comment.parent_comment_id ? ' · Reply' : ''}</small></div><button type="button" className="danger-text" onClick={() => deleteComment(comment.id)} disabled={busy}>Delete</button></article>)}{!comments.length && <p className="muted center">No comments yet.</p>}</div></section> : tab === 'Card Thumbnails' ? <AdminCardThumbnails chapters={sorted} pdpklChapters={pdpklChapters} busy={busy} onUpload={(chapter, slot, file) => chapter.cardThumbnailDesktopPath !== undefined || chapter.coverPath !== undefined ? savePdpklCardThumbnail(chapter, slot, file) : saveCardThumbnail(chapter, slot, file)} onClear={(chapter, slot) => chapter.cardThumbnailDesktopPath !== undefined || chapter.coverPath !== undefined && chapter.mangaId === undefined ? clearPdpklCardThumbnail(chapter, slot) : clearCardThumbnail(chapter, slot)} /> : tab === 'Reports' ? <AdminModerationQueue
      reports={reports}
      comments={comments}
      reportCount={reportCount}
      onDeleteComment={deleteComment}
      onSetReportStatus={setReportStatus}
    />: tab === 'Email Campaigns' ? <EmailStudio adminEmail={email} /> : tab === 'Community Posts' ? <section className="admin-stack"><section className="admin-card"><div className="admin-card-title"><div><span>COMMUNITY</span><h2>Community Posts</h2><p>Create and publish reader-facing community posts from the admin panel.</p></div></div><button type="button" className="admin-submit" onClick={() => window.dispatchEvent(new CustomEvent('atma-admin-open-community'))}>Create community post</button></section></section> : tab === 'Announcements' ? <section className="admin-stack">
      <form onSubmit={saveAnnouncement} className="admin-card admin-form">
        <div className="admin-card-title">
          <div><span>CONTENT</span><h2>Announcements</h2><p>{editingAnnouncementId ? 'Edit an existing announcement without losing its record.' : 'Publish up to 10 announcements. The oldest is automatically removed when an 11th is published.'}</p></div>
          {editingAnnouncementId && <button type="button" onClick={cancelAnnouncementEdit}>Cancel edit</button>}
        </div>
        <input value={announcement.title} onChange={e => setAnnouncement({ ...announcement, title: e.target.value })} placeholder="Title (optional for image-only update)"/>
        <textarea value={announcement.content} onChange={e => setAnnouncement({ ...announcement, content: e.target.value })} placeholder="Text (optional for image-only update)" rows="7"/>
        <label className="admin-file-field"><span>Thumbnail / image (optional)</span><input type="file" accept={SUPPORTED_IMAGE_ACCEPT} onChange={e => setAnnouncement({ ...announcement, thumbnail: e.target.files?.[0] || null })}/>{announcement.thumbnail && <em>{announcement.thumbnail.name}</em>}</label>
        <div className="admin-form-grid">
          <label><span>Placement</span><select value={announcement.display_position} onChange={e => setAnnouncement({ ...announcement, display_position: e.target.value })}><option value="">Automatic · normal order</option>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'} card</option>)}</select></label>
          <label className="check-row"><input type="checkbox" checked={announcement.is_pinned} onChange={e => setAnnouncement({ ...announcement, is_pinned: e.target.checked, pin_target: e.target.checked ? (announcement.pin_target === 'none' ? 'atma' : announcement.pin_target) : 'none' })}/> Pin to top</label>
          {announcement.is_pinned && <label><span>Pin on</span><select value={announcement.pin_target} onChange={e => setAnnouncement({ ...announcement, pin_target: e.target.value })}><option value="atma">Atma Rekha</option><option value="pdpkl">PDPKL</option></select></label>}
        </div>
        <p className="admin-form-hint">Announcement text is shown in full. Pinning always puts this announcement above the others. Placement controls the position among unpinned announcements; Automatic keeps the normal newest-first order.</p>
        <button type="submit" className="admin-submit" disabled={busy}>{busy ? (editingAnnouncementId ? 'Saving…' : 'Publishing…') : (editingAnnouncementId ? 'Save announcement changes' : 'Publish announcement')}</button>
      </form>
      <div className="admin-card">
        <div className="admin-card-title"><div><span>PUBLISHED</span><h2>Announcements <small>Max 10</small></h2></div></div>
        <div className="admin-mini-list">{announcements.map(item => <div key={item.id}>
          <div className="admin-announcement-admin-row">{item.image_url && <img src={item.image_url} alt="" loading="lazy"/>}<div><strong>{item.title?.startsWith('__image_only_') ? 'Image-only announcement' : item.title || 'Announcement'}</strong><p>{item.content || (item.image_url ? 'Image-only announcement' : '')}</p><small>{item.is_pinned ? 'Pinned · ' : ''}{item.display_position ? 'Position ' + item.display_position + ' · ' : ''}{new Date(item.published_at || item.created_at).toLocaleString('en-IN')}</small></div></div>
          <div className="admin-row-actions"><button type="button" onClick={() => editAnnouncement(item)} disabled={busy}>Edit</button><button type="button" className="danger-text" onClick={() => deleteAnnouncement(item)} disabled={busy}>Delete</button></div>
        </div>)}</div>
        {!announcements.length && <p className="muted center">No announcements yet.</p>}
      </div>
    </section> : <section className="admin-stack"><form onSubmit={saveMedia} className="admin-card admin-form"><div className="admin-card-title"><div><span>CONTENT</span><h2>Media library</h2></div></div><div className="admin-form-grid"><input value={mediaForm.title} onChange={e => setMediaForm({ ...mediaForm, title: e.target.value })} placeholder="Title" required/><input value={mediaForm.category} onChange={e => setMediaForm({ ...mediaForm, category: e.target.value })} placeholder="Category" required/><label className="admin-file-field wide"><span>Image file</span><input type="file" accept={SUPPORTED_IMAGE_ACCEPT} required onChange={e => { const file = e.target.files?.[0] || null; e.target.value = ''; setMediaForm({ ...mediaForm, file }); }}/>{mediaForm.file && <em>{mediaForm.file.name}</em>}</label></div><button type="submit" className="admin-submit" disabled={busy}>Add media</button></form><div className="admin-media-grid">{media.map(item => <article key={item.id}>{item.image_url && <img src={item.image_url} alt="" loading="lazy"/>}<div><strong>{item.title}</strong><span>{item.category}</span><button type="button" className="danger-text" onClick={() => deleteMedia(item)}>Delete</button></div></article>)}</div></section>}

        </div>

        <nav className="admin-bottom-nav" aria-label="Admin quick navigation">
          <button type="button" className={tab === 'Control Room' ? 'active' : ''} onClick={() => activateTab('Control Room')}><AdminIcon name="chart" size={16}/><span>Control Room</span></button>
          <button type="button" className={tab === 'Chapters' ? 'active' : ''} onClick={() => activateTab('Chapters')}><AdminIcon name="book" size={16}/><span>Chapters</span></button>
          <button type="button" className={tab === 'Reports' ? 'active' : ''} onClick={() => activateTab('Reports')}><AdminIcon name="flag" size={16}/><span>Reports</span>{reportCount > 0 ? <b>{reportCount}</b> : null}</button>
          <button type="button" onClick={() => setMobileSidebarOpen(value => !value)} aria-controls="ar-admin-sidebar" aria-expanded={mobileSidebarOpen}><AdminIcon name="menu" size={16}/><span>Menu</span></button>
        </nav>
        <AdminCommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          chapters={sorted}
          comments={comments}
          pageCounts={pageCounts}
          onSelectTab={activateTab}
          onOpenTool={openAdminTool}
          onNewChapter={() => { setChapterPublishProject('atma'); activateTab('Chapters'); resetForm(); }}
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
}
    </div>
  </main>;
}