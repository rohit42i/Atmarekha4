const sections = [
  {
    heading: "1. Using Atma Rekha",
    paragraphs: [
      "Atma Rekha is a fantasy adventure comic website created by Arkesh Kaalvantik. These Terms cover the website, comic reader, accounts, community features and memberships."
    ]
  },
  {
    heading: "2. Age and accounts",
    paragraphs: [
      "Atma Rekha is intended for readers aged 15 and above. Account registration asks you to confirm that you are at least 15 years old.",
      "Use an email address you control, enter accurate account details, and keep your password and verification codes private. Contact support if you suspect someone has accessed your account."
    ]
  },
  {
    heading: "3. Comic and community",
    paragraphs: [
      "Atma Rekha stories, characters, writing, artwork, comic pages and covers belong to Arkesh Kaalvantik or their respective rights holders. A membership gives access to the included chapters; it does not transfer ownership."
    ],
    bullets: [
      "Do not copy, repost, sell, distribute, translate or adapt comic pages or chapters without permission.",
      "Keep comments respectful. Do not harass, threaten, impersonate or expose another person’s private information.",
      "Only post content you have the right to share. Comments and other public profile details may be visible to other readers.",
      "Use the website’s reporting controls for problematic content. Content may be removed and accounts may be restricted when needed to protect the community."
    ]
  },
  {
    heading: "4. Membership and payments",
    paragraphs: [
      "Chapters 1 to 8 of Atma Rekha are free. Membership is needed from Chapter 9 onward. The membership options are:"
    ],
    bullets: [
      "Free: ₹0. Chapters 1 to 8, reading progress, bookmarks, ratings and comments.",
      "Supporter: ₹19 per month. Atma Rekha Chapter 9 onward and every Atma Rekha chapter.",
      "Premium Supporter: ₹29 per month. Atma Rekha Chapter 9 onward and every Pal Do Pal Ke Lamhe chapter when available.",
      "Super Supporter: ₹299 per year. Both stories, the Super Supporter badge and priority comments."
    ],
    tail: [
      "Pal Do Pal Ke Lamhe is planned to begin on 25 April 2027. The ₹19 Supporter plan does not include it.",
      "Membership renews automatically through the Razorpay UPI AutoPay mandate approved at checkout. Supporter and Premium Supporter renew monthly; Super Supporter renews yearly at ₹299. Cancellation stops future renewals, while access continues until the current paid period ends.",
      "Membership payments are not refundable. Cancelling stops future renewals and does not return a payment already made."
    ]
  },
  {
    heading: "5. Emails and reader updates",
    paragraphs: [
      "Atma Rekha may send account and service emails such as verification, password reset, account recovery, security, membership and payment messages.",
      "Chapter announcements and reader updates are enabled by default for new accounts. Turn them off in More & Settings → Notification preferences or use the unsubscribe link in an update email. Turning updates off does not stop essential account or payment messages.",
      "Account emails are sent from no-reply@atmarekha.in. For help, contact atmarekhasupport@gmail.com."
    ]
  },
  {
    heading: "6. Account deletion",
    paragraphs: [
      "Use the Privacy Center to request deletion. The flow asks for password confirmation and an email OTP, and a recovery window of 14 days starts after email verification.",
      "A deletion request is reviewed after the recovery window; it is not an instant erase. Some payment, security, moderation or backup records may remain for a period."
    ]
  },
  {
    heading: "7. Website changes",
    paragraphs: [
      "Chapters, release dates and website features may change or be temporarily unavailable as the project develops. These Terms may also be updated; the current version date appears above."
    ]
  },
  {
    heading: "8. Contact",
    links: [
      { label: "atmarekhasupport@gmail.com", href: "mailto:atmarekhasupport@gmail.com" },
      { label: "atmarekhainfo@gmail.com", href: "mailto:atmarekhainfo@gmail.com" },
      { label: "atmarekhaoffical@gmail.com", href: "mailto:atmarekhaoffical@gmail.com" }
    ],
    paragraphs: [
      "For account, membership, payment or privacy questions, contact support. For general questions, use the information address. For official correspondence, use the official Atma Rekha address.",
      "Do not send passwords, OTPs, UPI PINs, CVVs or full payment card details by email."
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
      {section.links?.length > 0 && <div className="info-links">{section.links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</div>}
    </article>
  );
}

export default function TermsOfUseSections() {
  return <div className="info-sections terms-of-use-sections">{sections.map(section => <Section key={section.heading} section={section} />)}</div>;
}
