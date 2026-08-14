import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const labels = { 1: 'Not for me', 2: 'Needs work', 3: 'It was okay', 4: 'Really enjoyed it', 5: 'Loved it', 6: 'Great', 7: 'Very good', 8: 'Excellent', 9: 'Outstanding', 10: 'Masterpiece' };

export default function RatingModal({ isOpen, currentRating = 0, onSetRating, onSubmit, chapterId }) {
  const [selected, setSelected] = useState(Number(currentRating) || 0);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { setSelected(Number(currentRating) || 0); }, [currentRating, isOpen]);

  useEffect(() => {
    if (!isOpen || !chapterId) return;
    let active = true;
    supabase.from('chapter_ratings').select('rating').eq('chapter_id', chapterId).then(({ data, error }) => {
      if (!active || error) return;
      const values = (data || []).map(row => Number(row.rating)).filter(Number.isFinite);
      setCount(values.length);
      setAverage(values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
    });
    return () => { active = false; };
  }, [isOpen, chapterId]);

  const choose = value => { setSelected(value); setMessage(''); onSetRating?.(value); };
  const submit = async () => {
    if (!selected) { setMessage('Choose a rating first.'); return; }
    setLoading(true); setMessage('');
    try {
      if (onSubmit) {
        await onSubmit(selected);
      } else if (chapterId) {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) throw new Error('Please sign in to rate this chapter.');
        const { error } = await supabase.from('chapter_ratings').upsert({ user_id: auth.user.id, chapter_id: chapterId, rating: selected }, { onConflict: 'user_id,chapter_id' });
        if (error) throw error;
      }
      setMessage('Your rating was saved.');
      setAverage(previous => count ? ((previous * count) - (Number(currentRating) || 0) + selected) / count : selected);
      if (!count) setCount(1);
    } catch (error) {
      setMessage(error?.message || 'Could not save your rating.');
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return <div className="rating-modal-backdrop" role="presentation">
    <section className="rating-modal-card" role="dialog" aria-modal="true" aria-labelledby="rating-title">
      <div className="rating-modal-head"><div><p className="section-eyebrow">YOUR RATING</p><h3 id="rating-title">How was this chapter?</h3></div><button type="button" className="rating-close" onClick={onSubmit ? () => onSubmit(null) : undefined} aria-label="Close">×</button></div>
      <div className="rating-summary"><strong>{average ? average.toFixed(1) : '—'}</strong><span>/ 10</span><small>{count ? `${count} rating${count === 1 ? '' : 's'}` : 'Be the first to rate'}</small></div>
      <div className="rating-scale" role="radiogroup" aria-label="Rate from 1 to 10">{Array.from({ length: 10 }, (_, index) => { const value = index + 1; return <button key={value} type="button" className={selected >= value ? 'selected' : ''} onClick={() => choose(value)} role="radio" aria-checked={selected === value}>{value}</button>; })}</div>
      <div className="rating-selected">{selected ? <><span>{selected}/10</span> · {labels[selected]}</> : 'Select a score from 1 to 10'}</div>
      {message && <p className="rating-message" role="status">{message}</p>}
      <button type="button" className="rating-submit" disabled={loading || !selected} onClick={submit}>{loading ? 'Saving…' : 'Save rating'}</button>
    </section>
  </div>;
}
