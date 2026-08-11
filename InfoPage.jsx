const PAGES = {
  about: {
    eyebrow: 'ATMA REKHA',
    title: 'About Atma Rekha',
    details: [
      ['Name', 'Atma Rekha'],
      ['Author', 'Arkesh'],
      ['Language', 'Roman Hindi'],
      ['Release Date', '14 September 2026'],
      ['Read Where', 'Website & Print (Working)'],
      ['Free or Paid', 'Free Online (Ch. 1–8)'],
      ['Age Rating', '16+'],
      ['Idea', 'dream'],
      ['plot', 'Random imagination'],
      ['Chapter Updates', 'Remaking few pages'],
      ['Support', 'Read & Share'],
      ['Contact', 'At Bottom'],
      ['Team', 'Solo Creator'],
    ],
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
  const isAbout = type === 'about';

  return <main className="info-page">
    <header className="subpage-header info-page-header">
      <button className="back-button" onClick={onBack} aria-label="Back">←</button>
      <div><p className="header-kicker">{page.eyebrow}</p><h1>{page.title}</h1></div>
    </header>
    <section className={`info-card ${isAbout ? 'about-card' : ''}`}>
      <p className="section-eyebrow">ATMA REKHA</p>
      <h2>{page.title}</h2>
      {isAbout ? <div className="about-details" aria-label="Atma Rekha details">
        {page.details.map(([label, value]) => <div className="about-detail" key={label}>
          <strong>{label}:</strong><span>{value}</span>
        </div>)}
      </div> : <p>{page.text}</p>}
    </section>
  </main>;
}
