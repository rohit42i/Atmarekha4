import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export default function HomeAnnouncement() {
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('id, title, content, image_url, published_at, created_at')
          .order('published_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && active && data) setAnnouncement(data);
      } catch (error) {
        console.error('Failed to load home announcement:', error);
      }
    };

    load();
    return () => { active = false; };
  }, []);

  if (!announcement) return null;

  const title = String(announcement.title || '').trim();
  const content = String(announcement.content || '').trim();
  const image = String(announcement.image_url || '').trim();
  const hasText = Boolean(title || content);

  return (
    <section className="home-announcement" aria-label="Latest announcement">
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
    </section>
  );
}
