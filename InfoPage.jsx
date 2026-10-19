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
      { heading: 'Accounts and age', body: 'Keep your account details accurate and protect your sign-in credentials. You are responsible for activity on your account unless caused by our failure to take legally required care. Account creation is intended for readers aged 15 or older. Do not use the site to break the law, threaten or harass others, impersonate someone, infringe rights, share private information without permission, or disrupt the service.' },
      { heading: 'Stories and AI-assisted production', body: 'Atma Rekha is an independently created series. Story, characters, world and creative direction are led by Arkesh; AI tools may assist parts of production, including some visuals. Unless stated otherwise, do not copy, republish, sell or commercially reuse the series artwork, text, characters or other protected material without permission. You may share links to the site.' },
      { heading: 'Comments and community', body: 'You are responsible for what you post. Do not post illegal, abusive, hateful, deceptive, infringing or privacy-violating content. We may review, restrict or remove content and suspend accounts when reasonably necessary to protect readers, enforce these terms or comply with law. Report concerns through the Report page or contact email.' },
      { heading: 'Membership and payments', body: 'Check the plan price, included chapters, billing frequency and renewal terms shown at checkout before paying. If a plan renews automatically, it will continue until cancelled under the available account or payment-provider process. Cancellation stops future renewals but normally does not refund a period already paid for; access may continue until that period ends. This does not remove any refund or other right you have under applicable law. For an incorrect charge or payment issue, contact us.' },
      { heading: 'Availability and legal rights', body: 'We may update chapters, features or release schedules and may temporarily suspend the site for maintenance or security. We will not exclude liability where the law does not allow it, and these terms do not take away consumer rights that cannot legally be waived. We may update these terms when necessary; continued use after an update takes effect means the updated terms apply to future use, subject to applicable law. For help or complaints, email ' + CONTACT_EMAIL + '.' },
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
