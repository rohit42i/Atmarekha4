import FeedbackForm from './FeedbackForm.jsx';

const INSTAGRAM_URL = 'https://www.instagram.com/atma.rekha?igsh=MzQ2YWJ3ZW42MzYx';
const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

const PAGES = {
  about: {
    eyebrow: 'ATMA REKHA',
    title: 'About Atma Rekha',
    details: [
      ['Creator', 'Arkesh'], ['Languages', 'Hindi (Roman Hindi) and English'],
      ['New chapters', 'Planned for the 14th of each month'],
      ['Format', 'Digital manga'], ['Free chapters', '1 to 8'],
      ['Age guidance', '15+'], ['Team', 'Independent creator'],
    ],
    story: [
      'I’m Arkesh, the solo creator of Atma Rekha, an original Indian fantasy adventure manga about people, traditions, and powers connected by a mystery that slowly unfolds. The story follows its characters and the choices they make, with more of the world revealed as their journey continues.',
      'I create the series independently and publish it in Hindi (Roman Hindi) and English. New chapters are planned for the 14th of each month, though the schedule can shift when a chapter needs more work.',
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
      { heading: 'Complaints and support', body: 'For a broken page, comment, account, membership or privacy issue, email us. Grievance Officer: Arkesh, creator. Consumer complaints are acknowledged within 48 hours and addressed within one month where applicable. Never send passwords, OTPs, UPI PINs or full card details.', links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Support` }] },
    ],
  },
  terms: {
    eyebrow: 'TERMS', title: 'Terms of use',
    sections: [
      { heading: 'Using the site', body: 'Atma Rekha is for reading manga and using its reader and community features. Please use the site lawfully and respectfully. Do not harass others, post illegal or harmful material, impersonate people, share private information, spam, or interfere with the site. We may hide content or restrict accounts when needed to protect readers or the service.' },
      { heading: 'Stories and artwork', body: 'The story, characters, writing, branding and creative material made for Atma Rekha are provided for reading here. You may share links to the site, but do not copy, repost, sell or reuse the pages and materials without permission.' },
      { heading: 'Membership and payments', body: 'Before joining, check the price, billing frequency and chapter access shown on the membership page. Membership renews automatically when that is part of the plan you choose. You can cancel to stop future renewals, and access for the paid period follows the terms shown when you joined. For an incorrect payment or missing access, contact us with the payment or subscription reference. Refund requests are reviewed under applicable law and the transaction details. Never send passwords, OTPs, UPI PINs, CVVs or full card details to support.' },
      { heading: 'Changes and contact', body: 'Chapters, release plans and features may change, and the site may occasionally be unavailable. We may update these terms when needed. Nothing here takes away rights that cannot legally be excluded. For account, membership or other complaints, contact ' + CONTACT_EMAIL + '.' },
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
