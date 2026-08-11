import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CommunitySheet({ isOpen, onClose, chapterId, chapterTitle, viewerKey }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem('atma-rekha-comment-name') || '');
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [liked, setLiked] = useState(() => new Set());

  const load = async () => {
    if (!chapterId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('id, user_id, author_name, content, created_at, parent_comment_id')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const rows = data || [];
      const ids = rows.map(row => row.id);
      let likeRows = [];
      if (ids.length) {
        const result = await supabase.from('comment_likes').select('comment_id, viewer_key').in('comment_id', ids);
        if (!result.error) likeRows = result.data || [];
      }
      const likeMap = {};
      for (const row of likeRows) {
        likeMap[row.comment_id] = (likeMap[row.comment_id] || 0) + 1;
      }
      setLiked(new Set(likeRows.filter(row => row.viewer_key === viewerKey).map(row => row.comment_id)));
      setComments(rows.map(row => ({ ...row, likes: likeMap[row.id] || 0 })));
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, chapterId]);

  const tree = useMemo(() => {
    const roots = comments.filter(comment => !comment.parent_comment_id);
    return roots.map(root => ({
      ...root,
      replies: comments.filter(comment => comment.parent_comment_id === root.id),
    }));
  }, [comments]);

  const submit = async () => {
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('comments').insert({
        chapter_id: chapterId,
        user_id: user?.id || null,
        author_name: name.trim() || 'Reader',
        content: text,
        parent_comment_id: replyTo || null,
      }).select('id, user_id, author_name, content, created_at, parent_comment_id').single();
      if (error) throw error;
      localStorage.setItem('atma-rekha-comment-name', name.trim());
      setContent('');
      setReplyTo(null);
      await load();
    } catch (error) {
      console.error('Failed to post comment:', error);
      window.alert(error.message || 'Could not post your comment.');
    } finally {
      setSending(false);
    }
  };

  const toggleLike = async (commentId) => {
    const alreadyLiked = liked.has(commentId);
    try {
      if (alreadyLiked) return;
      const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId, viewer_key: viewerKey });
      if (error) throw error;
      setLiked(previous => new Set([...previous, commentId]));
      setComments(previous => previous.map(comment => comment.id === commentId ? { ...comment, likes: comment.likes + 1 } : comment));
    } catch (error) {
      console.error('Failed to like comment:', error);
    }
  };

  const report = async (commentId) => {
    const reason = window.prompt('Why are you reporting this comment?', 'Inappropriate content');
    if (reason === null) return;
    try {
      const { error } = await supabase.from('comment_reports').insert({ comment_id: commentId, viewer_key: viewerKey, reason: reason.trim() || 'Reported by reader' });
      if (error) throw error;
      window.alert('Thanks. The comment has been reported for moderation.');
    } catch (error) {
      console.error('Failed to report comment:', error);
      window.alert(error.message || 'Could not report this comment.');
    }
  };

  if (!isOpen) return null;

  const CommentItem = ({ comment, reply = false }) => (
    <article className={`${reply ? 'ml-5 border-l-2 pl-4 sm:ml-8' : ''} border-zinc-800`}>
      <div className="rounded-2xl bg-zinc-900/80 p-4 ring-1 ring-white/5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-white">{comment.author_name || 'Reader'}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{formatDate(comment.created_at)}</p>
          </div>
          <button onClick={() => report(comment.id)} className="text-xs text-zinc-600 transition hover:text-rose-400">Report</button>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{comment.content}</p>
        <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-zinc-500">
          <button onClick={() => toggleLike(comment.id)} className={`transition ${liked.has(comment.id) ? 'text-blue-400' : 'hover:text-white'}`}>♥ {comment.likes || 0}</button>
          {!reply && <button onClick={() => { setReplyTo(comment.id); document.getElementById('community-input')?.focus(); }} className="transition hover:text-white">Reply</button>}
        </div>
      </div>
      {comment.replies?.map(replyComment => <div key={replyComment.id} className="mt-3"><CommentItem comment={replyComment} reply /></div>)}
    </article>
  );

  return (
    <>
      <div className="fixed inset-0 z-[1900] bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <section className="fixed inset-x-0 bottom-0 z-[2000] mx-auto flex h-[82vh] max-h-[760px] w-full flex-col overflow-hidden rounded-t-[28px] border border-zinc-800 bg-zinc-950 text-white shadow-2xl sm:max-w-2xl sm:rounded-[28px] sm:bottom-5 sm:border">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">Community</p><h2 className="truncate text-lg font-black">{chapterTitle || 'Chapter'} · Comments</h2></div>
          <button onClick={onClose} aria-label="Close comments" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-xl text-zinc-400 hover:text-white">×</button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          {loading ? <div className="py-16 text-center text-sm text-zinc-500">Loading comments…</div> : tree.length ? <div className="space-y-4">{tree.map(comment => <CommentItem key={comment.id} comment={comment} />)}</div> : <div className="py-16 text-center"><p className="font-semibold">No comments yet.</p><p className="mt-1 text-sm text-zinc-500">Be the first reader to say something.</p></div>}
        </div>

        <div className="border-t border-zinc-800 bg-zinc-950 p-4 sm:p-5">
          {replyTo && <div className="mb-2 flex items-center justify-between rounded-xl bg-blue-950/40 px-3 py-2 text-xs text-blue-300"><span>Replying to a reader</span><button onClick={() => setReplyTo(null)}>Cancel</button></div>}
          <div className="mb-2 flex gap-2">
            <input value={name} onChange={event => setName(event.target.value)} placeholder="Name" maxLength={60} className="w-32 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 sm:w-40" />
            <input id="community-input" value={content} onChange={event => setContent(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={replyTo ? 'Write a reply…' : 'Write a comment…'} maxLength={2000} className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600" />
            <button disabled={sending || !content.trim()} onClick={submit} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40">→</button>
          </div>
          <p className="text-[10px] text-zinc-600">Comments are moderated. Please keep the discussion respectful.</p>
        </div>
      </section>
    </>
  );
}
