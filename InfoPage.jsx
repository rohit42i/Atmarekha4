import FeedbackForm from './FeedbackForm.jsx';
import PrivacyPolicySections from './PrivacyPolicySections.jsx';
import TermsOfUseSections from './TermsOfUseSections.jsx';

const INSTAGRAM_URL = 'https://www.instagram.com/atma.rekha/';
const YOUTUBE_URL = 'https://www.youtube.com/@atmarekha';
const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

const PAGES = {
  about: {
    eyebrow: 'ATMA REKHA',
    title: 'About Atma Rekha',
    details: [
      ['Creator', 'Arkesh Kaalvantik'], ['Languages', 'Hindi written in Roman script and English'],
      ['Format', 'Digital comic'], ['Created', 'Project idea: 21 March 2025'],
      ['Development', 'Started: 25 April 2025'], ['First chapter', 'Published: 14 September 2026'],
      ['Release schedule', 'New chapters are planned for the 14th of each month'],
      ['Reading access', 'Chapters 1 to 8 are currently listed as free'], ['Age guidance', '15+'],
      ['Production', 'Independent solo creator'],
    ],
    story: [
      'Atma Rekha is a fantasy adventure comic created and written by Arkesh Kaalvantik. Its world draws inspiration from Indian culture and traditions. It follows Arnav, an eighteen-year-old student whose missing childhood memories and encounters with unusual powers lead him into a larger mystery. The series blends fantasy, adventure, and mystery while keeping later story developments unspoiled.',
      'The comic is published in Hindi written in Roman script and in English. The public introduction chapter is dated 7 September 2026, and Chapter 1 was published on 14 September 2026. New chapters are planned for the 14th of each month. The official chapter list is the source of truth for the latest releases and language versions.',
      'Atma Rekha began as a project idea on 21 March 2025. Development began on 25 April 2025. Arkesh Kaalvantik works independently and leads the story, dialogue, character direction, rough drawings, panel layouts, composition, and final creative decisions.',
      'AI tools assist selected parts of the visual workflow. AI-generated images are not published directly as finished comic pages. AI-assisted references used during production are manually outlined or redrawn and reviewed by the creator before publication.',
      'For official updates, follow Atma Rekha on Instagram and YouTube. For reader support, publication enquiries, or messages for the creator, use atmarekhasupport@gmail.com.',
    ],
  },
  contact: {
    eyebrow: 'CONTACT', title: 'Contact',
    sections: [
      { heading: 'Email', body: 'Have a question or need help with your account or membership? Send us an email.', links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` }] },
      { heading: 'Instagram', body: 'Follow Atma Rekha for updates and previews.', links: [{ label: '@atma.rekha', href: INSTAGRAM_URL }] },
      { heading: 'YouTube', body: 'Watch official Atma Rekha videos and updates.', links: [{ label: '@atmarekha', href: YOUTUBE_URL }] },
    ],
  },
  report: {
    eyebrow: 'REPORT', title: 'Report a problem',
    sections: [
      { heading: 'Complaints and support', body: 'For a broken page, comment, account, membership or privacy issue, email us with the details. Never send passwords, OTPs, UPI PINs or full card details.', links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Support` }] },
    ],
  },
  terms: {
    eyebrow: 'LEGAL', title: 'Terms of Use',
    description: 'Rules for reading the comic, using accounts and community features, and purchasing membership.',
  },
  privacy: {
    eyebrow: 'PRIVACY', title: 'Privacy Policy',
    description: 'What information Atma Rekha uses and how it is handled.',
  },
};

function Section({ heading, body, links = [] }) {
  return <article className="info-section">
    <h3>{heading}</h3>
    <p>{body}</p>
    {links.length > 0 && <div className="info-links">{links.map(link => <a key={link.href} href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel={link.href.startsWith('http') ? 'noreferrer' : undefined}>{link.label} ↗</a>)}</div>}
  </article>;
}

export default function InfoPage({ type, onBack }) {
  const page = PAGES[type] || PAGES.about;
  const isAbout = type === 'about';
  const isTerms = type === 'terms';
  const isPrivacy = type === 'privacy';

  return <main className={`info-page${isTerms || isPrivacy ? ' legal-info-page' : ''}`}>
    <header className="subpage-header info-page-header">
      <button className="back-button" onClick={onBack} aria-label="Back">←</button>
      <div><p className="header-kicker">{page.eyebrow}</p><h1>{page.title}</h1></div>
    </header>

    {isAbout && <section className="info-card info-hero">
      <h2>{page.title}</h2>
      <p className="info-hero-copy">{isAbout ? 'An independent fantasy adventure comic created by Arkesh.' : page.description}</p>
    </section>}

    {isAbout ? <section className="info-card info-content-card" aria-label="About Atma Rekha">
      <div className="about-details">{page.details.map(([label, value]) => <div className="about-detail" key={label}><strong>{label}:</strong><span>{value}</span></div>)}</div>
      <div className="about-story">{page.story.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    </section> : null}

    {isTerms && <section className="info-card info-content-card terms-privacy-policy legal-document-card" aria-label="Terms of Use">
      <header className="legal-document-intro">
        <p>{page.description}</p>
        <span>Last updated: 25 October 2026</span>
      </header>
      <div className="legal-document-sections terms-document-sections"><TermsOfUseSections /></div>
    </section>}

    {isPrivacy && <section className="info-card info-content-card terms-privacy-policy legal-document-card" aria-label="Privacy Policy">
      <header className="legal-document-intro">
        <p>{page.description}</p>
        <span>Last updated: 25 October 2026</span>
      </header>
      <div className="legal-document-sections privacy-document-sections"><PrivacyPolicySections /></div>
    </section>}

    {!isAbout && !isTerms && !isPrivacy && <section className="info-card info-content-card">
      <div className="info-sections">{(page.sections || []).map(section => <Section key={section.heading} {...section} />)}</div>
      {type === 'report' && <div className="info-feedback-card"><FeedbackForm/></div>}
    </section>}
  </main>;
}
