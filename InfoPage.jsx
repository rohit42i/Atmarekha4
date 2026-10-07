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
    eyebrow: 'LEGAL', title: 'Privacy Policy',
    sections: [
      { heading: 'Effective date', body: '7 October 2026. This policy is designed for the current Atma Rekha service and will be updated when the service, processing purposes or applicable law changes.' },
      { heading: 'Operator & grievance contact', body: 'Atma Rekha is an independent creator project by Arkesh. Privacy and grievance contact: ' + CONTACT_EMAIL + '. The website publishes its grievance mechanism on the Report & Feedback page.' },
      { heading: 'What personal data we process', body: 'Depending on the feature you use, Atma Rekha may process your email address, name, username, avatar, bio, account timestamps, reading history, bookmarks, ratings, comments, community activity, notification subscriptions, membership and payment-related records, and technical identifiers used for security and abuse prevention.' },
      { heading: 'Why we process it', body: 'We use personal data to create and secure accounts, provide reading and profile features, save progress and favourites, operate community features, provide memberships and payments, prevent abuse, troubleshoot faults, communicate important service information, and meet applicable legal obligations.' },
      { heading: 'Standalone notice & consent', body: 'Our signup notice explains the categories of data and purposes before account creation. Consent is recorded through an affirmative, unticked checkbox. Where processing depends on consent, you can withdraw it through Privacy & Data; withdrawal does not affect processing that has another lawful basis.' },
      { heading: 'Your rights', body: 'You can request access to personal data, correction of inaccurate information, erasure of eligible personal data, withdrawal of consent where applicable, grievance redressal, and nomination. The Digital Personal Data Protection Act, 2023 and the notified 2025 Rules have a phased commencement, so some statutory rights and obligations become operative on later dates.' },
      { heading: 'Privacy Center', body: 'The Privacy page combines this policy with signed-in controls to export data, correct profile information, withdraw consent where applicable, submit an erasure request, nominate a person, and raise a grievance.' },
      { heading: 'Public community content', body: 'Comments and community contributions may be visible to other readers. Do not publish passwords, payment credentials, private contact details or other sensitive information in public areas.' },
      { heading: 'Security safeguards', body: 'We use access controls, row-level database policies, protected server-side functions for privileged operations, HTTPS/security headers, controlled media delivery, logging and backups appropriate to the service. Secret keys are not stored in browser code.' },
      { heading: 'Processors & third-party services', body: 'Infrastructure may involve Supabase for authentication/database services, Cloudflare for content delivery, storage and Workers, and Razorpay for payments. These providers process data only as needed for the services they provide and under their applicable terms and policies. Transfers and disclosures remain subject to applicable Indian law.' },
      { heading: 'Cookies & local storage', body: 'Browser storage is used for essential preferences, reading progress, offline copies, attribution continuity and other reader features. You can clear local storage or site data through your browser. Clearing local data may remove offline copies and local progress.' },
      { heading: 'Retention', body: 'We retain personal data only while it is needed for the stated purpose or to comply with legal, security, accounting or payment obligations. When a purpose is no longer served, eligible data is deleted or de-identified according to our operational retention rules.' },
      { heading: 'Personal data breaches', body: 'If we become aware of a qualifying personal data breach, we will assess, contain and investigate it, maintain relevant records, and provide notices to affected Data Principals and the Data Protection Board as required by applicable law and the notified Rules.' },
      { heading: 'Children', body: 'Atma Rekha does not intentionally create accounts for children below 18. Account creation requires an age declaration of 18 or older. Readers below 18 may read public content where permitted by the service, but should not create an account.' },
      { heading: 'Grievance & requests', body: 'For privacy requests, correction, deletion, consent withdrawal or grievances, email ' + CONTACT_EMAIL + ' with “DPDP Request” in the subject or use Privacy & Data. We may verify account ownership before disclosing or changing personal data.' },
      { heading: 'Updates', body: 'This policy may change as the website and applicable law change. The current version is published here with its effective date.' },
    ],
  },  terms: {
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