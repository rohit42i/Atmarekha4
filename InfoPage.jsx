import FeedbackForm from './FeedbackForm.jsx';
import PrivacyPolicySections from './PrivacyPolicySections.jsx';
import TermsOfUseSections from './TermsOfUseSections.jsx';

const INSTAGRAM_URL = 'https://www.instagram.com/atma.rekha?igsh=MzQ2YWJ3ZW42MzYx';
const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

const PAGES = {
  about: {
    eyebrow: 'ATMA REKHA',
    title: 'About Atma Rekha',
    details: [
      ['Creator', 'Arkesh Kaalvantik'], ['Languages', 'Hindi (Roman Hindi) and English'],
      ['New chapters', 'Planned for the 14th of each month'],
      ['Format', 'Digital manga'], ['Free chapters', '1 to 8'],
      ['Age guidance', '15+'], ['Team', 'Independent creator'],
    ],
    story: [
      'Atma Rekha is an original Indian fantasy adventure manga created by Arkesh Kaalvantik, also credited as Arkesh. The series follows a young student whose missing childhood memories, isolation, and encounters with unusual powers lead toward a larger mystery. It is a digital manga and comic for readers aged 15 and above.',
      'Atma Rekha began as an original story idea and grew into an independently produced manga. Its world brings fantasy adventure together with Indian cultural and spiritual influences. The story is developed through its characters, their choices, and the mysteries revealed along their journey.',
      'The mission of Atma Rekha is to tell original fantasy and adventure stories with a distinct Indian creative identity, memorable characters, and emotional stakes. The series is published in Hindi written in Roman Hindi and in English so readers can follow the story in either language.',
      'Atma Rekha is currently a solo creator project. Arkesh Kaalvantik leads the writing, scripts, rough drawings, panel layouts, character direction, and final creative decisions. No outside publisher or studio is presented as part of the core team.',
      'New chapters are planned for the 14th of each month, although the schedule can change when a chapter needs more work. The official chapter catalogue is the source of truth for published chapters and current reading access.',
      'Every scene and panel begins with my own rough drawings and design decisions. I determine the composition, pose, camera angle, perspective, proportions, shapes, and character placement. I use AI tools in parts of the visual process to enhance my rough sketches and help develop characters while following my original designs and direction.',
      'AI generated material is not used directly as finished artwork in the published manga. When AI-assisted imagery is used as a background reference, I manually outline and redraw it as part of the artwork. I retain creative control over the story, character designs, panel composition, and final artistic decisions, and review the pages before publication.',
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
      { heading: 'Complaints and support', body: 'For a broken page, comment, account, membership or privacy issue, email us with the details. Never send passwords, OTPs, UPI PINs or full card details.', links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Support` }] },
    ],
  },
  terms: {
    eyebrow: 'LEGAL', title: 'Terms of Use',
    description: 'Rules for reading manga, using accounts and community features, and purchasing membership.',
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
      <p className="info-hero-copy">{isAbout ? 'An independent fantasy adventure manga created by Arkesh.' : page.description}</p>
    </section>}

    {isAbout ? <section className="info-card info-content-card" aria-label="About Atma Rekha">
      <div className="about-details">{page.details.map(([label, value]) => <div className="about-detail" key={label}><strong>{label}:</strong><span>{value}</span></div>)}</div>
      <div className="about-story">
        <h2>What Atma Rekha is</h2><p>{page.story[0]}</p>
        <h2>How the project began</h2><p>{page.story[1]}</p>
        <h2>Mission</h2><p>{page.story[2]}</p>
        <h2>Creator and team</h2><p>{page.story[3]}</p>
        <h2>Publication</h2><p>{page.story[4]}</p>
        <h2>How the manga is made</h2><p>{page.story[5]}</p><p>{page.story[6]}</p>
      </div>
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
