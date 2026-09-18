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
          .select('id, title, content, image_url, published_at, created_at')
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

  return (
    <section className="home-announcements" aria-label="Announcements">
      {announcements.map(item => {
        const storedTitle = String(item.title || '').trim();
        const title = storedTitle.startsWith('__image_only_') ? '' : storedTitle;
        const content = String(item.content || '').trim();
        const image = String(item.image_url || '').trim();
        const hasText = Boolean(title || content);
        return (
          <article className="home-announcement" key={item.id}>
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
