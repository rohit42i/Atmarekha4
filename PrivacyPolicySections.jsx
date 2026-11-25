const SUPPORT_EMAIL = 'atmarekhasupport@gmail.com';
const INFO_EMAIL = 'atmarekhainfo@gmail.com';
const OFFICIAL_EMAIL = 'atmarekhaoffical@gmail.com';

function Section({ title, children }) {
  return <article className="privacy-policy-section"><h2>{title}</h2>{children}</article>;
}

export default function PrivacyPolicySections() {
  return <>
    <Section title="1. Information we collect">
      <p>Depending on how you use Atma Rekha, we may collect:</p>
      <ul>
        <li><strong>Account details:</strong> email address, account ID, display name, avatar, profile information and age confirmation.</li>
        <li><strong>Reading and community activity:</strong> chapters viewed, reading progress, bookmarks, ratings, comments and reports.</li>
        <li><strong>Membership and payment details:</strong> selected plan, subscription status, billing period and payment references or status. Payments are processed by the payment provider; we do not ask you to email card or UPI security details.</li>
        <li><strong>Technical information:</strong> basic device, browser, usage, performance and security information, including information needed to understand reading activity and improve the website.</li>
        <li><strong>Email and preferences:</strong> verification and delivery records, update preferences and unsubscribe status.</li>
      </ul>
    </Section>

    <Section title="2. How we use information">
      <p>We use information to operate accounts, deliver comic pages, save reading progress, manage comments and reports, process memberships, send essential account or payment messages, deliver updates you have chosen to receive, improve the website and protect it from misuse.</p>
      <p>We do not sell personal information.</p>
    </Section>

    <Section title="3. Sharing and public content">
      <p>Information may be shared with service providers that help run the website, store data, deliver email or process payments. They receive only the information needed for their services.</p>
      <p>Comments, ratings and profile details you make public can be seen by other readers. Do not include private information in public posts.</p>
    </Section>

    <Section title="4. Emails and browser storage">
      <p>Account, verification, security, membership and payment emails may be sent when needed. Chapter announcements and reader updates are enabled by default for new accounts. You can turn them off in More &amp; Settings → Notification preferences or unsubscribe from an update email. Essential account and payment emails may still be sent.</p>
      <p>Atma Rekha uses browser storage for sign-in, preferences and reader features. Blocking it may affect some website functions.</p>
    </Section>

    <Section title="5. Retention and your choices">
      <p>We keep information for as long as needed to operate your account and services, manage memberships and payments, handle reports, and maintain security. Some records may remain in service logs or backups for a limited period.</p>
      <p>Use the Privacy Center to request an available data export, withdraw consent or request account deletion. Deletion requires password and email OTP verification, followed by a 14-day recovery period. It is not instant, and some records may need to be retained. Contact support to ask about correcting your information or a privacy request; we may verify account ownership first.</p>
      <p>You can also update profile details and change reader update preferences in your account settings.</p>
    </Section>

    <Section title="6. Age, changes and contact">
      <p>Atma Rekha is intended for readers aged 15 and above. Account registration asks you to confirm that you are at least 15.</p>
      <p>This policy may change as the website develops. The date at the top of this page shows the current version. Depending on where you live and how you interact with Atma Rekha, different privacy laws may apply.</p>
      <p>For account, privacy or payment questions, email <a href="mailto:atmarekhasupport@gmail.com">{SUPPORT_EMAIL}</a>. For general questions, email <a href="mailto:atmarekhainfo@gmail.com">{INFO_EMAIL}</a>. For official correspondence, email <a href="mailto:atmarekhaoffical@gmail.com">{OFFICIAL_EMAIL}</a>.</p>
      <p>Account emails are sent from <a href="mailto:no-reply@atmarekha.in">no-reply@atmarekha.in</a>; this is not a support address.</p>
    </Section>
  </>;
}
