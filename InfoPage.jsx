import FeedbackForm from './FeedbackForm.jsx';

const INSTAGRAM_URL = 'https://www.instagram.com/atma.rekha?igsh=MzQ2YWJ3ZW42MzYx';
const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

const PAGES = {
  about: {
    eyebrow: 'ATMA REKHA',
    title: 'About Atma Rekha',
    details: [
      ['Creator', 'Arkesh'], ['Language', 'Roman Hindi'],
      ['New chapters', 'Planned for the 14th of each month'],
      ['Format', 'Digital manga'], ['Free chapters', '1 to 8'],
      ['Age guidance', '15+'], ['Team', 'Independent creator'],
    ],
    story: [
      'Atma Rekha is an original Indian fantasy adventure manga where traditions and powers become part of an unfolding story. Follow its characters as they face difficult choices, discover hidden truths, and uncover the mysteries behind their world.',
      'Created independently by Arkesh, the series is originally published in Roman Hindi. Its story, characters, world, and creative direction are developed by the creator, with each chapter shaped into the version shared with readers.',
      'AI tools are used to assist with parts of the creative and production process, including some visual work. They are tools in the process, not a replacement for the creator: Arkesh guides the story and makes the final creative decisions.',
    ],
  },
  contact: {
    eyebrow: 'CONTACT', title: 'Contact',
    sections: [
      { heading: 'Email', body: 'Have a question or need help with your account or membership? Send us an email.', links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` }] },
      { heading: 'Instagram', body: 'Follow Atma Rekha for updates and previews.', links: [{ label: '@atma.rekha', href: INSTAGRAM_URL }] },
    ],
  },
  report: {
    eyebrow: 'REPORT', title: 'Report a problem',
    sections: [
      { heading: 'What needs attention?', body: 'Use the form below to report a site problem or content concern. Include the chapter or page, if relevant, and a short description so it can be reviewed.' },
    ],
  },
  terms: {
    eyebrow: 'TERMS', title: 'Terms of use',
    sections: [
      { heading: 'Using Atma Rekha', body: 'Atma Rekha is a place to read manga and use its reader and membership features. By using the site, you agree to use it lawfully and respectfully. Do not harass others, post harmful or illegal content, misuse accounts, or interfere with the site.' },
      { heading: 'Stories and community', body: 'The stories, characters, artwork and other original content belong to their respective rights holder. You may read the work and share links to it, but please do not copy, repost or sell it without permission. Comments and other public contributions should be respectful and must not violate anyone’s rights or privacy.' },
      { heading: 'Membership', body: 'Membership plans and the chapters included in each plan are shown on the membership page before you join. Membership renews according to the terms shown during payment. You can cancel to stop future renewals; access generally continues until the current paid period ends. If a payment looks wrong or you need help, contact us. Refund requests are reviewed under applicable law and the circumstances of the payment.' },
      { heading: 'Changes and contact', body: 'Chapters, features and release plans may change, and the site may sometimes be unavailable. These terms may also be updated when needed. Nothing here limits rights that cannot be limited under applicable law. For questions about these terms or your membership, email ' + CONTACT_EMAIL + '.' },
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
    <section className="info-card info-hero">
      <h2>{page.title}</h2>
      <p className="info-hero-copy">{isAbout ? 'An independent Indian fantasy adventure manga created by Arkesh.' : type === 'contact' ? 'Questions or need a hand? Get in touch.' : type === 'terms' ? 'A few simple rules for using the site.' : 'Let us know if something needs our attention.'}</p>
    </section>
    {isAbout ? <section className="info-card info-content-card" aria-label="About Atma Rekha">
      <div className="about-details">{page.details.map(([label, value]) => <div className="about-detail" key={label}><strong>{label}:</strong><span>{value}</span></div>)}</div>
      <div className="about-story">{page.story.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    </section> : <section className="info-card info-content-card">
      <div className="info-sections">{page.sections.map(section => <Section key={section.heading} {...section}/>)}</div>
      {type === 'report' && <div className="info-feedback-card"><FeedbackForm/></div>}
    </section>}
  </main>;
}
