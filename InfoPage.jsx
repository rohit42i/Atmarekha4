import FeedbackForm from './FeedbackForm.jsx';
import PrivacyPolicySections from './PrivacyPolicySections.jsx';
import TermsOfUseSections from './TermsOfUseSections.jsx';

const INSTAGRAM_URL = 'https://www.instagram.com/atma.rekha?igsh=MzQ2YWJ3ZW42MzYx';
const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';
const INFO_EMAIL = 'atmarekhainfo@gmail.com';
const OFFICIAL_EMAIL = 'atmarekhaoffical@gmail.com';

const PAGES = {
  about: {
    eyebrow: 'ABOUT',
    title: 'About Atma Rekha',
    details: [
      ['Creator', 'Arkesh Kaalvantik'], ['Languages', 'Hindi (Roman Hindi) and English'],
      ['Chapter schedule', 'Planned for the 14th of each month'],
      ['Format', 'Digital manga'], ['Free chapters', 'Chapters 1 to 8'],
      ['Age guidance', '15+'], ['Production', 'Independent creator'],
    ],
    story: [
      'Atma Rekha is an original fantasy adventure manga created independently by Arkesh Kaalvantik. It brings together an unfolding mystery, unusual powers, and a world shaped by Indian cultural and spiritual influences. The story is released in Hindi (Roman Hindi) and English for readers in India and around the world.',
      'New chapters are planned for the 14th of each month, but dates can change when more time is needed to finish a chapter. Chapters 1 to 8 are currently free to read; later chapters may require a membership, as described on the Membership page.',
      'The story, scripts, rough drawings, panel layouts, character direction, and final creative decisions are led by the creator. I use AI tools in parts of the visual process, including developing characters from my original sketches. AI generated material is not published directly as finished manga artwork; any AI-assisted reference used in a page is manually outlined or redrawn and reviewed as part of the final artwork.',
    ],
  },
  contact: {
    eyebrow: 'CONTACT', title: 'Contact Atma Rekha',
    sections: [
      { heading: 'Account and membership help', body: 'For sign-in problems, account access, memberships, payments, or privacy requests, email support. Never send your password, verification code, UPI PIN, CVV, or full card details.', links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` }] },
      { heading: 'General questions', body: 'For questions about the manga, chapter releases, or the website, contact the information inbox.', links: [{ label: INFO_EMAIL, href: `mailto:${INFO_EMAIL}` }] },
      { heading: 'Official correspondence', body: 'For official correspondence, use the official Atma Rekha inbox.', links: [{ label: OFFICIAL_EMAIL, href: `mailto:${OFFICIAL_EMAIL}` }] },
      { heading: 'Follow updates', body: 'Follow the official Instagram account for announcements and previews.', links: [{ label: '@atma.rekha', href: INSTAGRAM_URL }] },
    ],
  },
  report: {
    eyebrow: 'REPORT', title: 'Report a problem',
    sections: [
      { heading: 'What you can report', body: 'Use the form below to report a broken page or feature, a suspicious account, harmful or inappropriate comments, a membership or payment issue, a privacy concern, or another problem with the site. Include the relevant page or chapter and a clear description. Do not include passwords, OTPs, UPI PINs, CVVs, or full card details.', links: [{ label: 'Email support directly', href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Report` }] },
    ],
  },
  terms: {
    eyebrow: 'TERMS', title: 'Terms of Use',
    description: 'What to know when reading, creating an account, joining the community, or purchasing a membership.',
  },
  privacy: {
    eyebrow: 'PRIVACY', title: 'Privacy Policy',
    description: 'What information the website handles, why it is used, and the choices available to you.',
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
      <p className="info-hero-copy">An original Indian fantasy adventure manga by Arkesh Kaalvantik.</p>
    </section>}

    {isAbout ? <section className="info-card info-content-card" aria-label="About Atma Rekha">
      <div className="about-details">{page.details.map(([label, value]) => <div className="about-detail" key={label}><strong>{label}:</strong><span>{value}</span></div>)}</div>
      <div className="about-story">{page.story.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    </section> : null}

    {isTerms && <section className="info-card info-content-card terms-privacy-policy legal-document-card" aria-label="Terms of Use">
      <header className="legal-document-intro">
        <p>{page.description}</p>
        <span>Last updated: 29 October 2026</span>
      </header>
      <div className="legal-document-sections terms-document-sections"><TermsOfUseSections /></div>
    </section>}

    {isPrivacy && <section className="info-card info-content-card terms-privacy-policy legal-document-card" aria-label="Privacy Policy">
      <header className="legal-document-intro">
        <p>{page.description}</p>
        <span>Last updated: 29 October 2026</span>
      </header>
      <div className="legal-document-sections privacy-document-sections"><PrivacyPolicySections /></div>
    </section>}

    {!isAbout && !isTerms && !isPrivacy && <section className="info-card info-content-card">
      <div className="info-sections">{(page.sections || []).map(section => <Section key={section.heading} {...section} />)}</div>
      {type === 'report' && <div className="info-feedback-card"><FeedbackForm /></div>}
    </section>}
  </main>;
}
