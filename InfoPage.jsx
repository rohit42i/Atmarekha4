import FeedbackForm from './FeedbackForm.jsx';

const INSTAGRAM_URL = 'https://www.instagram.com/atma.rekha?igsh=MzQ2YWJ3ZW42MzYx';
const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

const PAGES = {
  about: {
    eyebrow: 'ATMA REKHA',
    title: 'About Atma Rekha',
    details: [
      ['Name', 'Atma Rekha'], ['Creator', 'Arkesh'], ['Language', 'Roman Hindi'],
      ['Release Schedule', '14th of each month'], ['Read', 'Website & Print (Working)'],
      ['Free', 'Chapters 1–8'], ['Content Rating', '15+'], ['Minimum account age', '15+'], ['Team', 'Solo Creator'],
    ],
    story: [
      'Atma Rekha follows Arnav, an isolated teenager with gaps in his memory, as he searches for answers about his past.',
      'Arnav struggles with loneliness after years of bullying and the unexplained loss of his childhood memories. The mystery around his family is only beginning.',
      'Atma Rekha is originally published in Roman Hindi, with additional language versions available as they are published. New chapters are planned for release on the 14th of each month.',
      'The project is independently created by Arkesh as a solo creator. AI-assisted tools are used only for selected parts of the creative process, while the story, characters, direction, and final creative decisions remain original to the project.',
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
      { heading: 'Grievance Officer', body: 'Arkesh is the creator and grievance contact. Email atmarekhasupport@gmail.com for platform, community, consumer or legal grievances. Complaints can also be submitted through this page.' },
      { heading: 'Grievance handling', body: 'Complaints are handled according to the nature of the issue and applicable requirements. Where a specific process or timeframe applies, it is determined by the relevant requirements.' },
      { heading: 'Content & community reports', body: 'For incorrect, inappropriate, unlawful, infringing or broken content, tell us the chapter/page, post and what happened. Reports are reviewed according to the nature of the issue and applicable requirements.', links: [{ label: 'Report an Issue', href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Report` }] },
      { heading: 'Consumer support', body: 'For membership billing, cancellation or refund issues, include your account email and Razorpay payment/subscription reference. Never send passwords, UPI PINs, CVV or full card details.' },
      { heading: 'External support', body: 'Depending on your location and the nature of the issue, you may also contact the relevant consumer-protection authority or payment provider.' },
    ],
  },
  terms: {
    eyebrow: 'LEGAL', title: 'Terms & Conditions',
    sections: [
      { heading: '1. Acceptance', body: 'By using Atma Rekha, you agree to these Terms & Conditions. If you create an account, purchase membership or participate in the community, these terms apply to that use as well.' },
      { heading: '2. Operator & contact', body: 'Atma Rekha is an independent creator project by Arkesh. Customer, consumer and grievance contact: ' + CONTACT_EMAIL + '. The current website operator/contact details are published on the Contact and Report pages.' },
      { heading: '3. Content & Ownership', body: 'Atma Rekha, its manga, artwork, characters, branding, text and original creative material belong to their respective creator or rights holder. You may read and share website links, but may not copy, sell, redistribute or republish the work without permission.' },
      { heading: '4. Personal Use', body: 'Use the website for personal reading and community participation. Do not use it for unlawful, abusive, misleading or unauthorised commercial purposes.' },
      { heading: '5. Comments & Community', body: 'Keep comments and contributions relevant and respectful. Do not post harassment, threats, spam, hate, illegal material, impersonation, malicious links, sexual exploitation, private personal data, or content that violates another person’s rights.' },
      { heading: '6. Reporting & Moderation', body: 'Atma Rekha may review, restrict, hide or remove content that violates these terms, applicable law or community safety rules. Urgent unlawful-content reports are handled according to their nature and applicable requirements.' },
      { heading: '7. Membership & pricing', body: 'Current membership prices are shown before payment: ₹19/month Supporter, ₹29/month Premium Supporter and ₹49/month Super Supporter. Chapter access included with each plan is stated on the membership page. Prices and features may change prospectively, subject to applicable law.' },
      { heading: '8. Billing, cancellation & refunds', body: 'Membership is recurring monthly through Razorpay UPI AutoPay. Cancellation stops future renewals and access remains available through the paid period. Refunds are handled in accordance with applicable law and Razorpay/payment rules; duplicate, unauthorised or incorrect charges should be reported promptly. No refund policy removes a right that cannot lawfully be excluded.' },
      { heading: '9. Taxes & invoices', body: 'Any applicable taxes, charges and invoice details are shown or handled through the payment flow as required by law. Any GST registration status is stated only where it is applicable.' },
      { heading: '10. Fair design & consent', body: 'The website does not intentionally use pre-ticked purchase consent, hidden mandatory charges, subscription traps, forced action or misleading urgency. Optional choices are presented as optional, with reversal available where the feature supports it.' },
      { heading: '11. External services', body: 'Supabase, Cloudflare and Razorpay provide infrastructure or payment services under their own applicable terms and privacy policies. Payment credentials such as UPI PINs and full card details are handled by the payment provider, not requested by Atma Rekha.' },
      { heading: '12. AI-assisted creation', body: 'Some creative production uses AI-assisted tools for parts of the process such as backgrounds and references. The story, characters, direction and final editorial decisions are original to Atma Rekha.' },
      { heading: '13. Availability', body: 'Features, chapter schedules, prices, availability and content may change. We do not guarantee uninterrupted or error-free service.' },
      { heading: '14. Limitation', body: 'To the extent permitted by law, Atma Rekha is not responsible for losses caused by temporary unavailability, technical errors, third-party services or misuse of the website.' },
      { heading: '15. Changes', body: 'These terms may be updated as Atma Rekha grows. The current terms and effective date are shown on this page.' },
      { heading: '16. Contact', body: `Questions, consumer complaints or legal notices can be sent to ${CONTACT_EMAIL}.` },
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
      <p className="section-eyebrow">ATMA REKHA</p>
      <h2>{page.title}</h2>
      <p className="info-hero-copy">{isAbout ? 'An independent Indian fantasy adventure manga created by Arkesh.' : type === 'contact' ? 'Questions, feedback and collaboration enquiries are welcome.' : 'Use this page to send feedback, report content or raise a grievance.'}</p>
    </section>
    {isAbout ? <>
      <section className="info-card info-content-card" aria-label="Atma Rekha details">
        <div className="about-details">{page.details.map(([label, value]) => <div className="about-detail" key={label}><strong>{label}:</strong><span>{value}</span></div>)}</div>
        <div className="about-story" aria-label="About the story">{page.story.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      </section>
    </> : <>
      <section className="info-card info-content-card">
        <div className="info-sections">{page.sections.map(section => <Section key={section.heading} {...section}/>)}</div>
      </section>
      {type === 'report' && <section className="info-card info-feedback-card"><FeedbackForm/></section>}
    </>}
  </main>;
}
