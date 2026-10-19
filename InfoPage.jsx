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
      'Atma Rekha is an original Indian fantasy adventure manga about people, traditions, and powers connected by a mystery that slowly unfolds. The story is told through its characters and the choices they make, with more of the world revealed as the journey continues.',
      'It is an independent project created by Arkesh and first published in Roman Hindi. Chapters are made one at a time, with a planned release on the 14th of each month. The schedule is a goal rather than a guarantee, because each chapter takes time to prepare.',
      'AI-assisted tools are part of the creative process for selected visual work, such as exploring references and developing some backgrounds or visual elements. Their use can vary from page to page.',
      'The story, characters, world, dialogue, and overall direction are developed for Atma Rekha by its creator. AI-assisted material is selected, reviewed, edited, and worked into the final pages as part of that process. The series is not presented as entirely hand-drawn or entirely AI-generated; the workflow can include both digital drawing and AI-assisted elements.',
      'Atma Rekha is made independently by one creator, not a studio team. The aim is to keep building an original story and share it with readers as each chapter is ready.',
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
      { heading: 'How can we help?', body: 'Tell us what went wrong and where it happened, such as the chapter, page, comment or account feature. For account, membership or privacy help, email us. Please do not send passwords, OTPs, UPI PINs or full card details.', links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Support` }] },
    ],
  },
  terms: {
    eyebrow: 'TERMS', title: 'Terms of use',
    sections: [
      { heading: 'Using the site', body: 'Atma Rekha is for reading manga and using its reader and community features. Please use the site lawfully and respectfully. Do not harass others, post illegal or harmful material, impersonate people, share private information, spam, or interfere with the site. We may hide content or restrict accounts when needed to protect readers or the service.' },
      { heading: 'Stories and artwork', body: 'Atma Rekha’s original story, characters, artwork, text and branding belong to their respective rights holder. You may read the work and share links to it, but may not copy, repost, sell or use it commercially without permission.' },
      { heading: 'Membership and payments', body: 'Before joining, check the current price, billing frequency and chapter access shown on the membership page. Membership may renew automatically as shown during payment. You can cancel to stop future renewals; access for the current paid period follows the terms shown when you joined. If a payment is incorrect or access does not work, contact us with the payment or subscription reference. Refund requests are handled under applicable law and the details of the transaction. Never send passwords, OTPs, UPI PINs, CVVs or full card details to support.' },
      { heading: 'Changes and contact', body: 'Chapters, release plans and features may change, and the site may occasionally be unavailable. We may update these terms when needed. Nothing here takes away rights that cannot legally be excluded. For questions about the site or membership, contact ' + CONTACT_EMAIL + '.' },
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
