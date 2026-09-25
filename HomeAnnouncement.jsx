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
          .select('id, title, content, image_url, is_pinned, display_position, published_at, created_at')
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

  const orderedAnnouncements = [...announcements].sort((a, b) => {
    const pinnedDiff = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
    if (pinnedDiff) return pinnedDiff;

    const aPosition = Number.isInteger(Number(a.display_position)) ? Number(a.display_position) : null;
    const bPosition = Number.isInteger(Number(b.display_position)) ? Number(b.display_position) : null;
    if (aPosition !== null && bPosition !== null && aPosition !== bPosition) return aPosition - bPosition;
    if (aPosition !== null && bPosition === null) return -1;
    if (aPosition === null && bPosition !== null) return 1;

    return new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0);
  });

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
