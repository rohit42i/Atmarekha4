import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';
import { AdminIcon } from './admin-redesign-ui.jsx';

const TOOL_RESULTS = [
  { id: 'tool-command', type: 'Tool', title: 'Command Center', hint: 'Open platform activity and health', event: 'atma-admin-open-command' },
  { id: 'tool-health', type: 'Tool', title: 'Chapter Health', hint: 'Inspect publishing readiness', event: 'atma-admin-open-health' },
  { id: 'tool-operations', type: 'Tool', title: 'Operations & Recovery', hint: 'Recovery, notifications and audit', event: 'atma-admin-open-operations' },
  { id: 'tool-users', type: 'Tool', title: 'Users & Memberships', hint: 'Manage readers and memberships', event: 'atma-admin-open-management', detail: { view: 'users' } },
  { id: 'tool-moderation', type: 'Tool', title: 'Community Moderation', hint: 'Automatic reports and bans', event: 'atma-admin-open-moderation' },
  { id: 'tool-group', type: 'Tool', title: 'Group Chat', hint: 'Moderate group messages', event: 'atma-admin-open-group-chat' },
  { id: 'tool-pro', type: 'Tool', title: 'Advanced Tools', hint: 'Open advanced admin tools', event: 'atma-admin-open-pro' },
];

const TAB_RESULTS = [
  ['Overview', 'Dashboard'],
  ['Chapters', 'Chapter Manager'],
  ['Pages', 'Page Editor'],
  ['Comments', 'Comments'],
  ['Reports', 'Reported comments'],
  ['Announcements', 'Announcements'],
  ['Membership & Earnings', 'Revenue & Membership'],
  ['Media', 'Media Library'],
].map(([id, title]) => ({ id: `tab-${id}`, type: 'Section', title, hint: `Open ${title}`, tab: id }));

const ACTION_RESULTS = [
  { id: 'action-new', type: 'Action', title: 'New chapter', hint: 'Open a blank Atma Rekha chapter form', shortcut: 'N', action: 'new' },
  { id: 'action-refresh', type: 'Action', title: 'Refresh admin data', hint: 'Reload chapters, comments, reports and media', shortcut: 'R', action: 'refresh' },
];

function fuzzy(value, query) {
  const text = String(value || '').toLowerCase();
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return text.includes(q);
}

export default function AdminCommandPalette({
  open,
  onClose,
  chapters = [],
  comments = [],
  onSelectTab,
  onOpenTool,
  onNewChapter,
  onRefresh,
  pageCounts = {},
}) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [users, setUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setUsers([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(async () => {
      setUserLoading(true);
      try {
        const term = query.trim();
        const [{ data: byName }, { data: byUsername }] = await Promise.all([
          supabase.from('profiles').select('id,username,display_name,avatar_url').ilike('display_name', `%${term}%`).limit(6),
          supabase.from('profiles').select('id,username,display_name,avatar_url').ilike('username', `%${term}%`).limit(6),
        ]);
        if (!alive) return;
        const map = new Map();
        [...(byName || []), ...(byUsername || [])].forEach(row => map.set(row.id, row));
        setUsers([...map.values()].slice(0, 8));
      } catch {
        if (alive) setUsers([]);
      } finally {
        if (alive) setUserLoading(false);
      }
    }, 180);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const chapterResults = useMemo(() => {
    if (!query.trim()) return [];
    return chapters
      .filter(chapter => fuzzy(
        `${chapter.chapterNumber ?? ''} ${chapter.title} ${chapter.language} ${chapter.status}`,
        query,
      ))
      .slice(0, 8)
      .map(chapter => ({
        id: `chapter-${chapter.id}`,
        type: 'Chapter',
        title: chapter.chapterNumber ? `Chapter ${chapter.chapterNumber} · ${chapter.title || 'Untitled'}` : (chapter.title || 'Special chapter'),
        hint: `${chapterLanguage(chapter.language)} · ${chapter.status || 'Draft'} · ${Number(pageCounts[chapter.id] || 0)} pages`,
        run: () => {
          onSelectTab?.('Chapters');
          onClose?.();
          window.setTimeout(() => window.dispatchEvent(new CustomEvent('atma-admin-focus-chapter', { detail: { chapterId: chapter.id } })), 0);
        },
      }));
  }, [chapters, query, onSelectTab, onClose]);

  const commentResults = useMemo(() => {
    if (!query.trim()) return [];
    return comments
      .filter(comment => fuzzy(`${comment.author_name} ${comment.content}`, query))
      .slice(0, 8)
      .map(comment => ({
        id: `comment-${comment.id}`,
        type: 'Comment',
        title: comment.author_name || 'Reader',
        hint: String(comment.content || '').slice(0, 110) || 'Empty comment',
        run: () => {
          onSelectTab?.('Comments');
          onClose?.();
          window.setTimeout(() => window.dispatchEvent(new CustomEvent('atma-admin-focus-comment', { detail: { commentId: comment.id } })), 0);
        },
      }));
  }, [comments, query, onSelectTab, onClose]);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return [];
    return users.map(user => ({
      id: `user-${user.id}`,
      type: 'Reader',
      title: user.display_name || user.username || 'Reader',
      hint: user.username ? `@${user.username}` : user.id.slice(0, 8),
      run: () => {
        onOpenTool?.('atma-admin-open-management', { view: 'users', userId: user.id });
        onClose?.();
      },
    }));
  }, [users, query, onOpenTool, onClose]);

  const results = useMemo(() => {
    const sections = [];
    const base = query.trim()
      ? [...chapterResults, ...commentResults, ...filteredUsers, ...TOOL_RESULTS.filter(item => fuzzy(item.title + ' ' + item.hint, query))]
      : [...ACTION_RESULTS, ...TAB_RESULTS, ...TOOL_RESULTS];
    sections.push(...base);
    return sections;
  }, [query, chapterResults, commentResults, filteredUsers]);

  useEffect(() => {
    setCursor(value => Math.min(value, Math.max(results.length - 1, 0)));
  }, [results.length]);

  const execute = item => {
    if (!item) return;
    if (item.run) {
      item.run();
      return;
    }
    if (item.tab) {
      onSelectTab?.(item.tab);
      onClose?.();
      return;
    }
    if (item.event) {
      onOpenTool?.(item.event, item.detail);
      onClose?.();
      return;
    }
    if (item.action === 'new') {
      onNewChapter?.();
      onClose?.();
      return;
    }
    if (item.action === 'refresh') {
      onRefresh?.();
      onClose?.();
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="admin-command-palette-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <section className="admin-command-palette" role="dialog" aria-modal="true" aria-label="Admin command palette">
        <div className="admin-command-palette-search">
          <AdminIcon name="search" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={event => { setQuery(event.target.value); setCursor(0); }}
            onKeyDown={event => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setCursor(value => Math.min(value + 1, Math.max(results.length - 1, 0)));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setCursor(value => Math.max(value - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                execute(results[cursor]);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose?.();
              }
            }}
            placeholder="Search chapters, readers, comments, tools…"
            aria-label="Search chapters, readers, comments and admin tools"
            autoComplete="off"
          />
          <kbd>ESC</kbd>
        </div>

        <div className="admin-command-palette-hints">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>⌘</kbd><kbd>K</kbd> Command palette</span>
        </div>

        <div className="admin-command-palette-results" role="listbox" aria-label="Command results">
          {!results.length && (
            <div className="admin-command-empty">
              <AdminIcon name="search" size={20} />
              <strong>{userLoading ? 'Searching readers…' : 'Nothing found'}</strong>
              <span>Try a chapter number, reader name, comment text, or tool.</span>
            </div>
          )}
          {results.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === cursor}
              className={index === cursor ? 'is-active' : ''}
              onMouseEnter={() => setCursor(index)}
              onClick={() => execute(item)}
            >
              <span className="admin-command-result-icon"><AdminIcon name={item.type === 'Chapter' ? 'book' : item.type === 'Comment' ? 'message' : item.type === 'Reader' ? 'user' : item.type === 'Tool' ? 'settings' : item.type === 'Action' ? 'sparkle' : 'grid'} size={14} /></span>
              <span className="admin-command-result-copy">
                <strong>{item.title}</strong>
                <small>{item.hint}</small>
              </span>
              {item.shortcut ? <kbd>{item.shortcut}</kbd> : <span className="admin-command-result-type">{item.type}</span>}
            </button>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function chapterLanguage(language) {
  return String(language || '').toLowerCase() === 'en' ? 'English' : 'Hindi';
}

