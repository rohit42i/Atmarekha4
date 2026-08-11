const PAGES = {
  about: {
    eyebrow: 'ATMA REKHA',
    title: 'About Atma Rekha',
    text: 'Atma Rekha is an original Indian manga built around myth, mystery, emotion and Indian cultural identity. The story is created independently with the goal of bringing a distinct Indian manga experience to readers.',
  },
  contact: {
    eyebrow: 'GET IN TOUCH',
    title: 'Contact',
    text: 'For feedback, collaboration, publishing enquiries or other questions, reach out through the Gmail icon in the footer.',
  },
  report: {
    eyebrow: 'COMMUNITY',
    title: 'Report',
    text: 'If you find a problem with a chapter, comment or other content, use the reporting controls provided on the relevant page. Reports are reviewed by the Atma Rekha admin.',
  },
  privacy: {
    eyebrow: 'LEGAL',
    title: 'Privacy',
    text: 'Atma Rekha uses only the information needed to operate reading, ratings and community features. Anonymous viewer keys may be used to prevent duplicate engagement. We do not intentionally collect unnecessary personal information.',
  },
  terms: {
    eyebrow: 'LEGAL',
    title: 'Terms',
    text: 'Use Atma Rekha respectfully. Do not upload, copy or post material that you do not have permission to share. Ratings and comments should remain relevant and respectful.',
  },
};

export default function InfoPage({ type, onBack }) {
  const page = PAGES[type] || PAGES.about;
  return <main className="info-page">
    <header className="subpage-header info-page-header">
      <button className="back-button" onClick={onBack} aria-label="Back">←</button>
      <div><p className="header-kicker">{page.eyebrow}</p><h1>{page.title}</h1></div>
    </header>
    <section className="info-card">
      <p className="section-eyebrow">ATMA REKHA</p>
      <h2>{page.title}</h2>
      <p>{page.text}</p>
    </section>
  </main>;
}
