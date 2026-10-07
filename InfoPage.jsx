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
      ['Free', 'Chapters 1–8'], ['Age Rating', '16+'], ['Team', 'Solo Creator'],
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
      { heading: 'Feedback', body: 'Found a bug or something that could be better? Tell us.', links: [{ label: 'Send Feedback', href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Website%20Feedback` }] },
      { heading: 'Report Content', body: 'For incorrect, inappropriate or broken content, tell us the chapter or page and what happened.', links: [{ label: 'Report an Issue', href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Report` }] },
    ],
  },
  privacy: {
    eyebrow: 'LEGAL', title: 'Privacy Policy',
    sections: [
      { heading: 'Effective date', body: '7 October 2026. This policy is designed for the current Atma Rekha service and will be updated when the service, processing purposes or applicable law changes.' },
      { heading: 'What personal data we process', body: 'Depending on the feature you use, Atma Rekha may process your email address, name, username, avatar, bio, account timestamps, reading history, bookmarks, ratings, comments, community activity, notification subscriptions, membership and payment-related records, and technical identifiers used for security and abuse prevention.' },
      { heading: 'Why we process it', body: 'We use personal data to create and secure accounts, provide reading and profile features, save progress and favourites, operate community features, provide memberships and payments, prevent abuse, troubleshoot faults, communicate important service information, and meet applicable legal obligations.' },
      { heading: 'Standalone notice & consent', body: 'Our signup notice is intended to explain the data collected and the purposes of processing in clear language before account creation. Your signup records the privacy notice version and purposes you accepted. Where processing depends on consent, you can withdraw consent through the Privacy page.' },
      { heading: 'Your rights', body: 'You can request access to personal data, correction of inaccurate information, erasure of eligible personal data, withdrawal of consent where applicable, grievance redressal, and nomination in accordance with the Digital Personal Data Protection Act, 2023 and applicable Rules.' },
      { heading: 'Privacy Center', body: 'The Privacy page combines this policy with signed-in controls to export data, correct profile information, withdraw consent where applicable, submit an erasure request, nominate a person, and raise a grievance.' },
      { heading: 'Public community content', body: 'Comments and community contributions may be visible to other readers. Do not publish passwords, payment credentials, private contact details or other sensitive information in public areas.' },
      { heading: 'Security safeguards', body: 'We use access controls, row-level database policies, protected server-side functions for privileged operations, HTTPS/security headers, controlled media delivery, logging and backups appropriate to the service. Secret keys are not stored in browser code.' },
      { heading: 'Processors & third-party services', body: 'Infrastructure may involve Supabase for authentication/database services, Cloudflare for content delivery, storage and Workers, and Razorpay for payments. These providers process data only as needed for the services they provide and under their applicable terms and policies. Transfers and disclosures remain subject to applicable Indian law.' },
      { heading: 'Cookies & local storage', body: 'Browser storage is used for essential preferences, reading progress, offline copies, attribution continuity and other reader features. You can clear local storage or site data through your browser. Clearing local data may remove offline copies and local progress.' },
      { heading: 'Retention', body: 'We retain personal data only while it is needed for the stated purpose or to comply with legal, security, accounting or payment obligations. When a purpose is no longer served, eligible data is deleted or de-identified according to our operational retention rules.' },
      { heading: 'Personal data breaches', body: 'If we become aware of a qualifying personal data breach, we will assess, contain and investigate it, maintain relevant records, and provide notices to affected Data Principals and the Data Protection Board as required by applicable law and the notified Rules.' },
      { heading: 'Children', body: 'Atma Rekha does not intentionally create accounts for children below 18. Account creation requires an age declaration of 18 or older. Readers below 18 may read public content where permitted by the service, but should not create an account.' },
      { heading: 'Grievance & requests', body: 'For privacy requests, correction, deletion, consent withdrawal or grievances, email ' + CONTACT_EMAIL + ' with “DPDP Request” in the subject. We may verify account ownership before disclosing or changing personal data.' },
      { heading: 'Updates', body: 'This policy may change as the website and applicable law change. The current version is published here with its effective date.' },
    ],
  },  terms: {
    eyebrow: 'LEGAL', title: 'Terms & Conditions',
    sections: [
      { heading: '1. Acceptance', body: 'By using Atma Rekha, you agree to these Terms & Conditions.' },
      { heading: '2. Content & Ownership', body: 'Atma Rekha, its manga, artwork, characters, branding, text and original creative material belong to their respective creator or rights holder. You may read and share website links, but may not copy, sell, redistribute or republish the work without permission.' },
      { heading: '3. Personal Use', body: 'Use the website for personal reading and community participation. Do not use it for unlawful, abusive, misleading or unauthorised commercial purposes.' },
      { heading: '4. Comments & Community', body: 'Keep comments and contributions relevant and respectful. Do not post harassment, threats, spam, hate, illegal material, impersonation, malicious links or content that violates another person’s rights.' },
      { heading: '5. Reporting & Moderation', body: 'Atma Rekha may review, hide or remove content that violates these terms or harms the community.' },
      { heading: '6. Availability', body: 'Features, chapter schedules, prices, availability and content may change. We do not guarantee uninterrupted or error-free service.' },
      { heading: '7. External Services', body: 'Third-party services linked from the website have their own terms and privacy policies.' },
      { heading: '8. Cancellation & Refunds', body: 'You can cancel a recurring membership to stop future renewals. Access continues through the current paid period. Because membership provides digital access, completed charges are generally non-refundable except where required by applicable law or for duplicate or incorrect charges. Contact support with your payment details if a billing issue occurs.' },
      { heading: '9. Limitation', body: 'To the extent permitted by law, Atma Rekha is not responsible for losses caused by temporary unavailability, technical errors, third-party services or misuse of the website.' },
      { heading: '10. Changes', body: 'These terms may be updated as Atma Rekha grows. Continued use after an update means you accept the revised terms.' },
      { heading: '11. Contact', body: `Questions about these terms can be sent to ${CONTACT_EMAIL}.` },
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