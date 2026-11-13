const sections = [
  {
    heading: "1. Using Atma Rekha",
    paragraphs: [
      "Atma Rekha is a fantasy adventure comic website created by Arkesh Kaalvantik. These Terms apply to the comic, website, accounts, community features and memberships. By creating an account or using these features, you agree to these Terms."
    ]
  },
  {
    heading: "2. Age and accounts",
    paragraphs: [
      "Atma Rekha is intended for readers aged 15 and above. You must confirm that you are at least 15 to create an account.",
      "Use an email address you control, provide accurate details and keep your password and verification codes private. You are responsible for activity on your account. Contact support if you suspect unauthorised access."
    ]
  },
  {
    heading: "3. Comic and community",
    paragraphs: [
      "Atma Rekha stories, characters, writing, artwork, comic pages and covers belong to Arkesh Kaalvantik or their respective rights holders. Membership gives access to included chapters, not ownership of the content."
    ],
    bullets: [
      "Do not copy, repost, sell, distribute, translate or adapt comic content without permission.",
      "Be respectful. Harassment, threats, impersonation, spam and sharing another person's private information are not allowed.",
      "Only post content you have the right to share. Comments, ratings and public profile details may be visible to other readers.",
      "Use the reporting controls to flag problems. Content may be removed and accounts restricted when necessary to protect the community."
    ]
  },
  {
    heading: "4. Membership and payments",
    paragraphs: [
      "Chapters 1 to 8 are free. Membership is required from Chapter 9 onward. Current options are:"
    ],
    bullets: [
      "Free: ₹0.",
      "Supporter: ₹19 per month for Atma Rekha chapters from Chapter 9 onward.",
      "Premium Supporter: ₹29 per month for Atma Rekha and Pal Do Pal Ke Lamhe chapters when available.",
      "Super Supporter: ₹299 per year for both stories, the Super Supporter badge and priority comments."
    ],
    tail: [
      "Pal Do Pal Ke Lamhe is planned to begin on 25 April 2027. The Supporter plan does not include it.",
      "Paid memberships renew automatically through the UPI AutoPay mandate approved at checkout. Monthly plans renew monthly and Super Supporter renews yearly. You can cancel to stop future renewals; access continues until the paid period ends.",
      "Membership payments are non-refundable, except where required by applicable law or where a transaction was made in error. Cancelling does not refund a payment already made."
    ]
  },
  {
    heading: "5. Account deletion and updates",
    paragraphs: [
      "You can request account deletion through the Privacy Center. After password confirmation and email OTP verification, a 14-day recovery period begins. Deletion is not instant; some payment, security, moderation or backup records may be kept for a limited period.",
      "We may change chapters, release dates or website features. These Terms may also be updated; the latest version date is shown above."
    ]
  },
  {
    heading: "6. Contact",
    paragraphs: [
      "For account, membership, payment or privacy questions, contact atmarekhasupport@gmail.com. For general questions, use atmarekhainfo@gmail.com. Official correspondence: atmarekhaoffical@gmail.com.",
      "Never email passwords, OTPs, UPI PINs, CVVs or full payment card details."
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
    </article>
  );
}

export default function TermsOfUseSections() {
  return <div className="info-sections terms-of-use-sections">{sections.map(section => <Section key={section.heading} section={section} />)}</div>;
}
