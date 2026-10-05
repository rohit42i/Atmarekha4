import { useEffect, useState } from 'react';
import { chapterPath } from './routes';

function resumePath(chapter) {
  const path = chapterPath(chapter);
  if (!path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export default function ContinueReading({ chapters }) {
  const [resume, setResume] = useState(null);

  const load = () => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('atma-reading-last') || 'null');
      if (!saved?.chapterId) return setResume(null);
      const chapter = chapters.find(item => String(item.id) === String(saved.chapterId));
      const pageNumber = Number(saved.pageNumber);
      if (!chapter || !Number.isInteger(pageNumber) || pageNumber < 2) return setResume(null);
      setResume({ chapter, pageNumber });
    } catch {
      setResume(null);
    }
  };

  useEffect(() => {
    load();
    const onProgress = () => load();
    window.addEventListener('atma-reading-progress', onProgress);
    window.addEventListener('storage', onProgress);
    window.addEventListener('popstate', onProgress);
    return () => {
      window.removeEventListener('atma-reading-progress', onProgress);
      window.removeEventListener('storage', onProgress);
      window.removeEventListener('popstate', onProgress);
    };
  }, [chapters]);

  if (!resume) return null;

  return (
    <section className="continue-reading-card" aria-label="Continue reading">
      <div className="continue-reading-art">
        {resume.chapter.cover ? <img src={resume.chapter.cover} alt="" loading="lazy" /> : <span>AR</span>}
      </div>
      <div className="continue-reading-copy">
        <p className="section-eyebrow">CONTINUE READING</p>
        <h2>{resume.chapter.title || `Chapter ${resume.chapter.chapterNumber ?? ''}`}</h2>
        <span>Chapter {resume.chapter.chapterNumber ?? 'Special'} · Page {resume.pageNumber}</span>
        <button type="button" className="continue-reading-button" onClick={() => resumePath(resume.chapter)}>
          Resume →
        </button>
      </div>
    </section>
  );
}
