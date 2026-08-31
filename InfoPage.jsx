const INSTAGRAM_URL = 'https://www.instagram.com/atma.rekha?igsh=MzQ2YWJ3ZW42MzYx';
const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

const PAGES = {
  about: {
    eyebrow: 'ATMA REKHA',
    title: 'About Atma Rekha',
    details: [
      ['Name', 'Atma Rekha'], ['Creator', 'Arkesh'], ['Language', 'Roman Hindi'],
      ['Release', '14 September 2026'], ['Read', 'Website & Print (Working)'],
      ['Free', 'Chapters 1–5'], ['Age Rating', '16+'], ['Team', 'Solo Creator'],
    ],
    story: [
      'Atma Rekha is an Indian mythical-fantasy manga built around Indian culture, spiritual ideas, mysterious powers and intense battles.',
      'It is written in Roman Hindi and made for Indian readers. The story, characters and world are original, with AI used only in parts of the creative process such as backgrounds and references.',
    ],
  },
  contact: {
    eyebrow: 'CONTACT', title: 'Contact',
    sections: [
      { heading: 'Email', body: 'Questions, feedback, collaboration or publishing enquiries? Email us.', links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` }] },
      { heading: 'Instagram', body: 'Follow Atma Rekha for updates and previews.', links: [{ label: '@atma.rekha', href: INSTAGRAM_URL }] },
    ],
  },
  report: {
    eyebrow: 'COMMUNITY', title: 'Report & Feedback',
    sections: [
      { heading: 'Feedback', body: 'Found a bug or something that could be better? Tell us.', links: [{ label: 'Send Feedback', href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Website%20Feedback` }] },
      { heading: 'Report Content', body: 'For incorrect, inappropriate or broken content, tell us the chapter or page and what happened.', links: [{ label: 'Report an Issue', href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Report` }] },
    ],
  },
  privacy: {
    eyebrow: 'LEGAL', title: 'Privacy Policy',
    sections: [
      { heading: 'Information We Use', body: 'Atma Rekha may process information you provide through comments, ratings or messages. We aim to use only what is needed to run and improve the website.' },
      { heading: 'Reading & Engagement', body: 'The website may use anonymous or technical identifiers for reading progress, ratings, reactions and abuse prevention.' },
      { heading: 'Comments & Public Content', body: 'Public comments and contributions may be visible to other readers. Avoid posting private or sensitive information.' },
      { heading: 'Cookies & Local Storage', body: 'Browser storage may be used for essential preferences, sessions and reader features. You can clear locally stored data through your browser.' },
      { heading: 'Third Parties', body: 'Hosting, database, authentication and content delivery may be provided by third-party services, subject to their policies.' },
      { heading: 'Data Requests', body: `For privacy questions or requests, contact ${CONTACT_EMAIL}.` },
      { heading: 'Updates', body: 'This policy may change as the website changes. The latest version will be published here.' },
    ],
  },
  terms: {
    eyebrow: 'LEGAL', title: 'Terms & Conditions',
    sections: [
      { heading: '1. Acceptance', body: 'By using Atma Rekha, you agree to these Terms & Conditions.' },
      { heading: '2. Content & Ownership', body: 'Atma Rekha, its manga, artwork, characters, branding, text and original creative material belong to their respective creator or rights holder. You may read and share website links, but may not copy, sell, redistribute or republish the work without permission.' },
      { heading: '3. Personal Use', body: 'Use the website for personal reading and community participation. Do not use it for unlawful, abusive, misleading or unauthorised commercial purposes.' },
      { heading: '4. Comments & Community', body: 'Keep comments and contributions relevant and respectful. Do not post harassment, threats, spam, hate, illegal material, impersonation, malicious links or content that violates another person’s rights.' },
      { heading: '5. Reporting & Moderation', body: 'Atma Rekha may review, hide or remove content that violates these terms or harms the community.' },
      { heading: '6. Availability', body: 'Features, chapter schedules, prices, availability and content may change. We do not guarantee uninterrupted or error-free service.' },
      { heading: '7. External Services', body: 'Third-party services linked from the website have their own terms and privacy policies.' },
      { heading: '8. Limitation', body: 'To the extent permitted by law, Atma Rekha is not responsible for losses caused by temporary unavailability, technical errors, third-party services or misuse of the website.' },
      { heading: '9. Changes', body: 'These terms may be updated as Atma Rekha grows. Continued use after an update means you accept the revised terms.' },
      { heading: '10. Contact', body: `Questions about these terms can be sent to ${CONTACT_EMAIL}.` },
    ],
  },
};

function Section({ heading, body, links = [] }) {
  return <article className="info-section"><h3>{heading}</h3><p>{body}</p>{links.length > 0 && <div className="info-links">{links.map(link => <a key={link.href} href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel={link.href.startsWith('http') ? 'noreferrer' : undefined}>{link.label} ↗</a>)}</div>}</article>;
}

export default function InfoPage({ type, onBack }) {
  const page = PAGES[type] || PAGES.about;
  const isAbout = type === 'about';
  return <main className="info-page">
    <header className="subpage-header info-page-header">
      <button className="back-button" onClick={onBack} aria-label="Back">←</button>
      <div><p className="header-kicker">{page.eyebrow}</p><h1>{page.title}</h1></div>
    </header>
    <section className={`info-card ${isAbout ? 'about-card' : 'legal-card'}`}>
      <p className="section-eyebrow">ATMA REKHA</p><h2>{page.title}</h2>
      {isAbout ? <>
        <div className="about-details" aria-label="Atma Rekha details">{page.details.map(([label, value]) => <div className="about-detail" key={label}><strong>{label}:</strong><span>{value}</span></div>)}</div>
        <div className="about-story" aria-label="About the story">
          {page.story.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </> : <div className="info-sections">{page.sections.map(section => <Section key={section.heading} {...section}/>)}</div>}
    </section>
  </main>;
}
