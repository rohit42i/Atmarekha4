const sections = [
  {
    heading: "1. About these terms",
    paragraphs: [
      "Atma Rekha is an original fantasy adventure manga website created by Arkesh Kaalvantik. These Terms apply when you browse the site, read chapters, create an account, use reader or community features, or purchase a membership."
    ]
  },
  {
    heading: "2. Age and account security",
    paragraphs: [
      "The site is intended for readers aged 15 and above. During registration, you are asked to confirm that you are at least 15 years old.",
      "Use an email address you control and keep your password and verification codes private. You are responsible for activity through your account. Contact support if you think someone else has accessed it."
    ]
  },
  {
    heading: "3. Manga and community features",
    paragraphs: [
      "The story, scripts, characters, artwork, chapter pages, and covers are owned by Arkesh Kaalvantik or the relevant rights holders. Reading or purchasing a membership does not transfer ownership or grant permission to republish the work."
    ],
    bullets: [
      "Do not copy, repost, sell, distribute, translate, or adapt manga content without permission.",
      "Do not harass, threaten, impersonate, spam, or publish another person's private information.",
      "Only post material you have the right to share. Comments, ratings, and public profile details may be visible to other readers.",
      "Use the report form or in-product reporting controls to flag a problem. Content or accounts may be restricted when action is needed."
    ]
  },
  {
    heading: "4. Chapters and memberships",
    paragraphs: [
      "Chapters 1 to 8 are currently free. Membership access and included benefits are shown on the Membership page and at checkout. Current plans include:"
    ],
    bullets: [
      "Free: ₹0, with access to free chapters and available reader features.",
      "Supporter: ₹19 per month, for Atma Rekha chapters from Chapter 9 onward.",
      "Premium Supporter: ₹29 per month, for Atma Rekha and Pal Do Pal Ke Lamhe chapters when available.",
      "Super Supporter: ₹299 per year, for both stories when available, plus the listed badge and priority-comment benefits."
    ],
    tail: [
      "Pal Do Pal Ke Lamhe is planned to begin on 25 April 2027. The ₹19 Supporter plan does not include that story. Availability and release dates can change; check the Membership page for the current offer before paying.",
      "Membership renews automatically only when checkout confirms a recurring Razorpay UPI AutoPay mandate. The selected plan renews at the stated interval until cancelled. Cancellation stops future renewals; access to a paid period may continue until that period ends. The payment and cancellation terms shown at checkout also apply.",
      "If you have a billing concern, contact support with the transaction reference. Do not email payment credentials."
    ]
  },
  {
    heading: "5. Emails and updates",
    paragraphs: [
      "We may send essential account, verification, security, recovery, membership, and payment messages. Chapter announcements and reader updates can be turned off in More & Settings → Notification preferences or through the unsubscribe link in an update email. Turning off updates does not stop essential account or payment messages.",
      "Account emails are sent from no-reply@atmarekha.in. For help, use atmarekhasupport@gmail.com."
    ]
  },
  {
    heading: "6. Account deletion",
    paragraphs: [
      "Use the Privacy Center to request account deletion. The process asks you to confirm your password and verify the request by email OTP. A 14-day recovery window begins after email verification, so the request is not an instant deletion.",
      "Some records needed for payment history, security, moderation, or backups may remain for a period after a deletion request."
    ]
  },
  {
    heading: "7. Changes and availability",
    paragraphs: [
      "Chapters, release dates, memberships, and website features may change or be temporarily unavailable. We may update these Terms as the project changes; the latest update date appears above."
    ]
  },
  {
    heading: "8. Contact",
    links: [
      { label: "Support", href: "mailto:atmarekhasupport@gmail.com" },
      { label: "General questions", href: "mailto:atmarekhainfo@gmail.com" },
      { label: "Official correspondence", href: "mailto:atmarekhaoffical@gmail.com" }
    ],
    paragraphs: [
      "For account, membership, payment, or privacy questions, contact support. For general questions, use the information address; for official correspondence, use the official inbox.",
      "Never send passwords, OTPs, UPI PINs, CVVs, or full payment card details by email."
    ]
  }
];

function Section({ section }) {
  return (
    <article className="info-section">
      <h3>{section.heading}</h3>
      {section.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      {section.bullets?.length > 0 && <ul>{section.bullets.map(item => <li key={item}>{item}</li>)}</ul>}
      {section.tail?.map((paragraph, index) => <p key={"tail-" + index}>{paragraph}</p>)}
      {section.links?.length > 0 && <div className="info-links">{section.links.map(link => <a key={link.href} href={link.href}>{link.label} ↗</a>)}</div>}
    </article>
  );
}

export default function TermsOfUseSections() {
  return <div className="info-sections terms-of-use-sections">{sections.map(section => <Section key={section.heading} section={section} />)}</div>;
}
