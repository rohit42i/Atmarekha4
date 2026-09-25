import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import './home-announcement.css';
import './admin-announcement.css';

export default function HomeAnnouncement() {
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('id, title, content, image_url, is_pinned, pin_target, display_position, published_at, created_at')
          .order('published_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(10);

        if (!error && active) setAnnouncements(data || []);
      } catch (error) {
        console.error('Failed to load home announcement:', error);
      }
    };

    load();
    return () => { active = false; };
  }, []);

  if (!announcements.length) return null;

  const dateNewestFirst = (a, b) =>
    new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0);

  const pinTarget = document.body?.dataset?.announcementTarget || (window.location.pathname.toLowerCase().includes('pdpkl') ? 'pdpkl' : 'atma');
  const pinned = announcements.filter(item => Boolean(item.is_pinned) && (item.pin_target || 'atma') === pinTarget).sort(dateNewestFirst);
  const unpinned = announcements.filter(item => !item.is_pinned).sort(dateNewestFirst);

  // Explicit positions occupy their exact requested slots. Automatic announcements
  // fill whatever slots remain, preserving newest-first order.
  const positioned = new Map();
  const automatic = [];
  for (const item of unpinned) {
    const position = Number(item.display_position);
    if (Number.isInteger(position) && position >= 1 && position <= 10 && !positioned.has(position)) {
      positioned.set(position, item);
    } else {
      automatic.push(item);
    }
  }

  const orderedUnpinned = [];
  let automaticIndex = 0;
  for (let slot = 1; slot <= unpinned.length; slot += 1) {
    const item = positioned.get(slot);
    orderedUnpinned.push(item || automatic[automaticIndex++]);
  }

  const orderedAnnouncements = [...pinned, ...orderedUnpinned.filter(Boolean)];

  return (
    <section className="home-announcements" aria-label="Announcements">
      {orderedAnnouncements.map(item => {
        const storedTitle = String(item.title || '').trim();
        const title = storedTitle.startsWith('__image_only_') ? '' : storedTitle;
        const content = String(item.content || '').trim();
        const image = String(item.image_url || '').trim();
        const hasText = Boolean(title || content);
        return (
          <article className="home-announcement" key={item.id} data-announcement-id={item.id}>
            <button
              type="button"
              className="home-announcement-comments"
              aria-label="Comments for announcement"
              title="Comments"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6.2 18.3 3.5 21l.8-4A7.5 7.5 0 0 1 4 13.2C4 8.7 7.8 5 12.5 5S21 8.7 21 13.2 17.2 21.4 12.5 21.4c-2.3 0-4.4-.8-6.3-2.2Z" />
              </svg>
            </button>
            {image && (
              <div className={`home-announcement-image ${hasText ? '' : 'image-only'}`}>
                <img src={image} alt={title || 'Atma Rekha announcement'} loading="lazy" />
              </div>
            )}
            {hasText && (
              <div className={`home-announcement-copy ${image ? '' : 'text-only'}`}>
                {title && <h2>{title}</h2>}
                {content && <p>{content}</p>}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
