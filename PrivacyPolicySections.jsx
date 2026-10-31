const SUPPORT_EMAIL = 'atmarekhasupport@gmail.com';
const INFO_EMAIL = 'atmarekhainfo@gmail.com';
const OFFICIAL_EMAIL = 'atmarekhaoffical@gmail.com';

function Section({ title, children }) {
  return <article className="privacy-policy-section"><h2>{title}</h2>{children}</article>;
}

export default function PrivacyPolicySections() {
  return <>
    <Section title="1. Information we handle">
      <p>When you use Atma Rekha, we may handle the following information:</p>
      <ul>
        <li><strong>Account and profile:</strong> email address, account ID, display name, avatar, profile details, age confirmation and account status.</li>
        <li><strong>Reading and community:</strong> chapters viewed, reading progress, bookmarks, ratings, comments, reports and related activity.</li>
        <li><strong>Membership and payments:</strong> selected plan, subscription status, billing period, and Razorpay transaction or subscription references and payment status.</li>
        <li><strong>Email and preferences:</strong> verification events, delivery records, reader update preferences and unsubscribe status.</li>
        <li><strong>Technical and usage information:</strong> page and chapter views, basic performance metrics, and technical request information such as browser or IP data where provided by the site or its services.</li>
        <li><strong>Media:</strong> profile images, comic pages and chapter covers stored or displayed by the website.</li>
      </ul>
    </Section>

    <Section title="2. How we use your information">
      <ul>
        <li>To create and manage accounts, verify email addresses and help users recover access.</li>
        <li>To display comic pages and save reading progress, bookmarks and reader preferences.</li>
        <li>To display comments and ratings, review reports and manage community content.</li>
        <li>To confirm membership payments, maintain access and manage subscriptions.</li>
        <li>To send account, verification, security, payment and membership emails.</li>
        <li>To send chapter announcements and reader updates according to your preferences.</li>
        <li>To understand chapter views, improve site performance and investigate technical issues.</li>
      </ul>
      <p>Atma Rekha does not sell personal information.</p>
    </Section>

    <Section title="3. Services used by Atma Rekha">
      <p><strong>Supabase</strong> provides account sign in and backend data services. <strong>Cloudflare</strong> provides website infrastructure, analytics and media storage. <strong>Resend</strong> delivers email. <strong>Razorpay</strong> processes membership payments.</p>
      <p>These services receive information needed to perform their functions. Payment information is handled through Razorpay; do not send passwords, OTPs, UPI PINs, CVVs or full card details to Atma Rekha by email.</p>
    </Section>

    <Section title="4. Public content, email and browser storage">
      <p>Comments, ratings and profile details you make public can be seen by other readers. Do not put private information in public posts or comments.</p>
      <p>Reader updates and chapter announcements are enabled by default for new accounts. Turn them off in More &amp; Settings → Notification preferences or use the unsubscribe link in an update email. Essential account, verification, security and payment emails may still be sent.</p>
      <p>The website uses browser storage for sign in, preferences and reader features. Blocking it may prevent some features from working.</p>
    </Section>

    <Section title="5. Retention and account deletion">
      <p>We keep information while it is needed to run the account or feature, maintain a membership, support payments, manage community reports or address technical issues. Different services may keep their own logs or backups for different periods.</p>
      <p>To request account deletion, use the Privacy Center, confirm your password and verify the request by email OTP. A recovery window of 14 days starts after email verification. After that window, the request is reviewed and eligible information is processed for deletion. The request is not an instant erase, and some payment, security, moderation or backup records may remain for a period.</p>
    </Section>

    <Section title="6. Your choices">
      <ul>
        <li>Update available profile details in your account settings.</li>
        <li>Change reader update preferences in More &amp; Settings or unsubscribe from an update email.</li>
        <li>Use the Privacy Center to request an available data export, withdraw consent or request account deletion.</li>
        <li>Contact support to ask about correcting information or a privacy request. We may ask you to verify account ownership before acting on it.</li>
      </ul>
    </Section>

    <Section title="7. Age and policy updates">
      <p>Atma Rekha is intended for readers aged 15 and above. Account registration asks you to confirm that you are at least 15. This declaration is not independently checked using an identity document.</p>
      <p>This policy may change when the website or its features change. The date at the top of the page shows the current version date.</p>
    </Section>

    <Section title="8. Contact">
      <p>For account, privacy or payment questions, email <a href="mailto:atmarekhasupport@gmail.com">{SUPPORT_EMAIL}</a>.</p>
      <p>For general questions, email <a href="mailto:atmarekhainfo@gmail.com">{INFO_EMAIL}</a>. For official correspondence, email <a href="mailto:atmarekhaoffical@gmail.com">{OFFICIAL_EMAIL}</a>.</p>
      <p>Account emails are sent from <a href="mailto:no-reply@atmarekha.in">no-reply@atmarekha.in</a>. This address is used for sending messages, not as the support contact.</p>
    </Section>
  </>;
}
