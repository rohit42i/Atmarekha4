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
      ['Free', 'Chapters 1–8'], ['Content Rating', '16+'], ['Accounts', '18+'], ['Team', 'Solo Creator'],
    ],
    story: [
      'Atma Rekha is an Indian fantasy adventure manga about ancient traditions, spiritual concepts, mysterious powers and mythical beings.',
      'It is a Roman Hindi adventure manga made for Indian readers. New chapters are released on the 14th of each month. The story, characters and world are original, with AI used only in parts of the creative process such as backgrounds and references.',
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
      { heading: 'Grievance Officer', body: 'Arkesh — Creator & Grievance Officer. Email atmarekhasupport@gmail.com for platform, community, consumer or legal grievances. Complaints can also be submitted through this page.' },
      { heading: 'Grievance handling', body: 'For applicable intermediary complaints, the grievance mechanism is intended to acknowledge complaints within 24 hours and resolve them within 15 days. Consumer grievances are acknowledged within 48 hours and handled within one month, as applicable.' },
      { heading: 'Content & community reports', body: 'For incorrect, inappropriate, unlawful, infringing or broken content, tell us the chapter/page, post and what happened. Removal requests are reviewed promptly.', links: [{ label: 'Report an Issue', href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Report` }] },
      { heading: 'Consumer support', body: 'For membership billing, cancellation or refund issues, include your account email and Razorpay payment/subscription reference. Never send passwords, UPI PINs, CVV or full card details.' },
      { heading: 'National Consumer Helpline', body: 'If a consumer issue is not resolved through our grievance mechanism, you may also use the Government of India National Consumer Helpline.', links: [{ label: 'National Consumer Helpline', href: 'https://consumerhelpline.gov.in/' }] },
    ],
  },
  privacy: {
    eyebrow: 'LEGAL', title: 'Privacy',
    sections: [
      { heading: 'Effective date', body: '7 October 2026. This notice explains how the current Atma Rekha service handles personal information and is updated when our service, data practices or applicable requirements change.' },
      { heading: 'Applicability', body: 'Depending on where you live and how you interact with Atma Rekha, different privacy laws may apply. You keep any rights that cannot lawfully be waived under applicable law.' },
      { heading: 'Operator & contact', body: 'Atma Rekha is an independent creator project by Arkesh, operated from India and available to readers elsewhere. Privacy and grievance contact: ' + CONTACT_EMAIL + '.' },
      { heading: 'What we process', body: 'Depending on the feature you use, we may process account details, profile information, reading progress and history, bookmarks, ratings, comments, reactions, community activity, membership and payment records, privacy requests and limited technical or security information.' },
      { heading: 'Why we use it', body: 'We use information to provide accounts and reading features, remember progress and favourites, operate community and membership features, process payments, keep the service secure, prevent abuse, troubleshoot faults, provide support and meet applicable obligations.' },
      { heading: 'Sharing & international processing', body: 'Infrastructure may include Supabase for authentication and databases, Cloudflare for storage, delivery and Workers, and Razorpay for payments. Because the service is available worldwide, information may be processed or stored outside your home country.' },
      { heading: 'Cookies & browser storage', body: 'Atma Rekha uses browser storage and similar technologies for essential preferences and reader features such as theme, language, local progress, offline reading, drafts and pseudonymous chapter-view measurement. We do not currently use advertising cookies or sell personal information for money.' },
      { heading: 'Community privacy', body: 'Comments, usernames, reactions and other community contributions may be visible to other readers. Do not publish passwords, payment credentials, private addresses, government identifiers or other sensitive information in public areas.' },
      { heading: 'Your rights', body: 'Depending on your location and circumstances, you may have rights to access, correct, delete, receive or transfer your information, object to or limit certain processing, withdraw consent where consent is the basis, and raise a complaint or grievance.' },
      { heading: 'Privacy controls', body: 'The Privacy page provides signed-in tools for data export, consent withdrawal where applicable, deletion requests and profile correction, plus email support for other privacy requests.' },
      { heading: 'Retention', body: 'We keep information only for as long as reasonably needed for the purposes described here, or longer where security, payment, accounting, dispute, fraud-prevention or other lawful requirements require it. Eligible data is then deleted, anonymised or de-identified.' },
      { heading: 'Security incidents', body: 'When Atma Rekha becomes aware of a personal-data security incident, we assess, contain and investigate it and take notification or other protective steps required by applicable law.' },
      { heading: 'Age', body: 'The current account product requires users to be 18 or older. Public reading availability may differ from account eligibility.' },
      { heading: 'AI-assisted creation', body: 'Some creative production uses AI-assisted tools for parts of the process. This does not change how reader personal information is handled.' },
      { heading: 'Updates', body: 'The current version and effective date are shown on the Privacy page. Material changes may be highlighted through the service when appropriate.' },
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
      { heading: '6. Reporting & Moderation', body: 'Atma Rekha may review, restrict, hide or remove content that violates these terms, applicable law or community safety rules. Urgent unlawful-content reports are reviewed as quickly as practicable.' },
      { heading: '7. Membership & pricing', body: 'Current membership prices are shown before payment: ₹19/month Supporter, ₹29/month Premium Supporter and ₹49/month Super Supporter. Chapter access included with each plan is stated on the membership page. Prices and features may change prospectively, subject to applicable law.' },
      { heading: '8. Billing, cancellation & refunds', body: 'Membership is recurring monthly through Razorpay UPI AutoPay. Cancellation stops future renewals and access remains available through the paid period. Refunds are handled in accordance with applicable law and Razorpay/payment rules; duplicate, unauthorised or incorrect charges should be reported promptly. No refund policy removes a right that cannot lawfully be excluded.' },
      { heading: '9. Taxes & invoices', body: 'Any applicable taxes, charges and invoice details are shown or handled through the payment flow as required by law. Atma Rekha will not represent itself as GST-registered unless it is actually registered.' },
      { heading: '10. Fair design & consent', body: 'The website does not intentionally use pre-ticked purchase consent, hidden mandatory charges, subscription traps, forced action or misleading urgency. Optional choices should remain clear and reversible.' },
      { heading: '11. External services', body: 'Supabase, Cloudflare and Razorpay provide infrastructure or payment services under their own applicable terms and privacy policies. Payment credentials such as UPI PINs and full card details are handled by the payment provider, not requested by Atma Rekha.' },
      { heading: '12. AI-assisted creation', body: 'Some creative production uses AI-assisted tools for parts of the process such as backgrounds and references. The story, characters, direction and final editorial decisions are original to Atma Rekha.' },
      { heading: '13. Availability', body: 'Features, chapter schedules, prices, availability and content may change. We do not guarantee uninterrupted or error-free service.' },
      { heading: '14. Limitation', body: 'To the extent permitted by law, Atma Rekha is not responsible for losses caused by temporary unavailability, technical errors, third-party services or misuse of the website.' },
      { heading: '15. Changes', body: 'These terms may be updated as Atma Rekha grows. Material changes will be published with an updated effective date.' },
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
    <section className={`info-card ${isAbout ? 'about-card' : 'legal-card'}`}>
      <p className="section-eyebrow">ATMA REKHA</p><h2>{page.title}</h2>
      {isAbout ? <>
        <div className="about-details" aria-label="Atma Rekha details">{page.details.map(([label, value]) => <div className="about-detail" key={label}><strong>{label}:</strong><span>{value}</span></div>)}</div>
        <div className="about-story" aria-label="About the story">
          {page.story.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </> : <><div className="info-sections">{page.sections.map(section => <Section key={section.heading} {...section}/>)}</div>{type==='report' && <FeedbackForm/>}</>}
    </section>
  </main>;
}