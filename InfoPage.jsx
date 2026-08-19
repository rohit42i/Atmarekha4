const INSTAGRAM_URL = 'https://www.instagram.com/atma.rekha?igsh=MzQ2YWJ3ZW42MzYx';
const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

const PAGES = {
  about: {
    eyebrow: 'ATMA REKHA',
    title: 'About Atma Rekha',
    details: [
      ['Name', 'Atma Rekha'], ['Author', 'Arkesh'], ['Language', 'Roman Hindi'],
      ['Release Date', '14 September 2026'], ['Read Where', 'Website & Print (Working)'],
      ['Free or Paid', 'Free Online (Ch. 1–8)'], ['Age Rating', '16+'], ['Idea', 'dream'],
      ['plot', 'Random imagination'], ['Chapter Updates', 'Remaking few pages'],
      ['Support', 'Read & Share'], ['Contact', 'At Bottom'], ['Team', 'Solo Creator'],
    ],
    story: [
      'Atma Rekha is an Indian dark-fantasy manga that blends Indian culture, spiritual concepts, mysterious powers, and intense battles. Follow Arnav and his companions as they uncover the hidden reality of their world, powerful beings, and secrets tied to the human soul.',
      'Written in Roman Hindi, the manga is made to feel natural and easy to read for Indian audiences. It builds its own world, characters, lore, and mysteries while drawing inspiration from Indian ideas and traditions. AI has been used in a few parts of the process, such as backgrounds and references, while the story and core creative work remain original.',
      'Atma Rekha began with random dreams and imagination, slowly growing into an independent story built from scratch.',
    ],
  },
  contact: {
    eyebrow: 'GET IN TOUCH', title: 'Contact',
    sections: [
      { heading: 'Email', body: 'For questions, collaboration, publishing enquiries, feedback or general contact, email us directly.', links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` }] },
      { heading: 'Instagram', body: 'Follow Atma Rekha for updates, announcements, previews and behind-the-scenes content.', links: [{ label: '@atma.rekha', href: INSTAGRAM_URL }] },
    ],
  },
  report: {
    eyebrow: 'COMMUNITY', title: 'Report & Feedback',
    sections: [
      { heading: 'Send Feedback', body: 'Found a bug, broken page, incorrect chapter information, confusing feature or something that could be improved? Tell us. Clear feedback helps improve the website.', links: [{ label: 'Send Feedback by Email', href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Website%20Feedback` }] },
      { heading: 'Report Content', body: 'For a chapter, image, comment or other content that appears incorrect, inappropriate or broken, include the chapter/page name and a short explanation when contacting us.', links: [{ label: 'Report an Issue', href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Report` }] },
      { heading: 'What to Include', body: 'Please include enough information for us to reproduce the problem: page or chapter, what happened, what you expected, and a screenshot if useful.', links: [] },
    ],
  },
  privacy: {
    eyebrow: 'LEGAL', title: 'Privacy Policy',
    sections: [
      { heading: 'Information We Use', body: 'Atma Rekha may process information you provide when using community features, such as comments, ratings or messages sent to us. We aim to collect only information needed to operate and improve the website.' },
      { heading: 'Reading & Engagement', body: 'The website may use anonymous or technical identifiers to support reading progress, ratings, reactions and abuse prevention. These identifiers are not intended to identify you personally.' },
      { heading: 'Comments & Public Content', body: 'If you post a comment or other public contribution, that content may be visible to other readers. Do not post private, sensitive or unnecessary personal information.' },
      { heading: 'Cookies & Local Storage', body: 'The website may use browser storage or similar technologies for essential preferences, session functionality and reader features. Your browser controls can be used to clear locally stored data.' },
      { heading: 'Third Parties', body: 'Atma Rekha may rely on infrastructure and services such as hosting, database, authentication or content delivery providers to operate the website. Data handled by those services is subject to their applicable policies.' },
      { heading: 'Data Requests', body: `For privacy questions or requests concerning information you have provided, contact ${CONTACT_EMAIL}.` },
      { heading: 'Updates', body: 'This policy may be updated when the website or its features change. The current version will always be published on this Privacy page.' },
    ],
  },
  terms: {
    eyebrow: 'LEGAL', title: 'Terms & Conditions',
    sections: [
      { heading: '1. Acceptance', body: 'By accessing or using Atma Rekha, you agree to these Terms & Conditions. If you do not agree, please do not use the website.' },
      { heading: '2. Content & Ownership', body: 'Atma Rekha, its manga, artwork, characters, branding, text and original creative material belong to their respective creator or rights holder. You may read and share links to the website, but you may not copy, reproduce, redistribute, sell or republish the work without permission.' },
      { heading: '3. Personal Use', body: 'The website is provided primarily for personal reading and community use. Do not use the website or its content for unlawful, abusive, misleading or commercial purposes without permission.' },
      { heading: '4. Comments & Community', body: 'Comments, ratings and other contributions must be relevant and respectful. Do not post harassment, threats, spam, hate, sexual content involving minors, illegal material, impersonation, malicious links or content that violates another person’s rights.' },
      { heading: '5. Reporting & Moderation', body: 'Atma Rekha may review, hide or remove content that violates these terms or harms the community. Repeated abuse may result in restrictions on community features.' },
      { heading: '6. Availability', body: 'We aim to keep the website and chapters available, but features, chapter schedules, prices, availability and content may change. We do not guarantee uninterrupted or error-free service.' },
      { heading: '7. External Services', body: 'The website may link to third-party services such as social media or external platforms. Their use is governed by their own terms and privacy policies.' },
      { heading: '8. Limitation', body: 'To the extent permitted by applicable law, Atma Rekha is not responsible for losses caused by temporary unavailability, technical errors, third-party services or misuse of the website by users.' },
      { heading: '9. Changes', body: 'These terms may be updated as Atma Rekha grows. Continued use of the website after an update means you accept the revised terms.' },
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
