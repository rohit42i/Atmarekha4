const SUPPORT_EMAIL = 'atmarekhasupport@gmail.com';
const INFO_EMAIL = 'atmarekhainfo@gmail.com';
const OFFICIAL_EMAIL = 'atmarekhaoffical@gmail.com';

function Section({ title, children }) {
  return <article className="privacy-policy-section"><h2>{title}</h2>{children}</article>;
}

export default function PrivacyPolicySections() {
  return <>
    <Section title="1. Information the site handles">
      <p>Depending on how you use Atma Rekha, the site and its service providers may handle:</p>
      <ul>
        <li><strong>Account details:</strong> account ID, email address, display name, avatar, profile details, age confirmation, and account status.</li>
        <li><strong>Reading and community activity:</strong> chapters viewed, reading progress, bookmarks, ratings, comments, reports, and related activity.</li>
        <li><strong>Membership and payment records:</strong> selected plan, subscription status, billing period, and Razorpay transaction or subscription references and payment status.</li>
        <li><strong>Email preferences:</strong> verification and delivery events, reader-update preferences, and unsubscribe status.</li>
        <li><strong>Technical information:</strong> page and chapter views, performance data, and request information such as browser or IP data where provided by the site or its services.</li>
        <li><strong>Media:</strong> profile images, manga pages, and chapter covers used by the website.</li>
      </ul>
    </Section>

    <Section title="2. How we use your information">
      <ul>
        <li>Create and manage accounts, verify email addresses, and support account recovery.</li>
        <li>Display chapters and save reading progress, bookmarks, and preferences.</li>
        <li>Display ratings and comments, review reports, and manage community content.</li>
        <li>Confirm membership payments, maintain access, and manage subscriptions.</li>
        <li>Send account, verification, security, payment, membership, and reader-update emails according to your preferences.</li>
        <li>Measure chapter views, improve performance, and investigate technical problems.</li>
      </ul>
      <p>Atma Rekha does not sell personal information.</p>
    </Section>

    <Section title="3. Services that support the site">
      <p><strong>Supabase</strong> supports sign-in and backend data. <strong>Cloudflare</strong> supports website delivery, analytics, and media storage. <strong>Resend</strong> delivers email. <strong>Razorpay</strong> processes membership payments.</p>
      <p>These providers receive information needed for their role and may process it under their own service terms. Payment credentials should be entered only through the payment flow, not sent to Atma Rekha by email.</p>
    </Section>

    <Section title="4. Public content, emails, and browser storage">
      <p>Comments, ratings, and profile details you choose to make public may be visible to other readers. Avoid including private information in public posts or comments.</p>
      <p>Chapter announcements and reader updates can be turned off in More &amp; Settings → Notification preferences or through an unsubscribe link in an update email. Essential account, verification, security, and payment messages may still be sent.</p>
      <p>The site uses browser storage for sign-in, preferences, and reader features. Blocking or clearing it may affect some features or sign-in state.</p>
    </Section>

    <Section title="5. Retention and account deletion">
      <p>Information is kept while needed to operate an account or feature, manage a membership or payment, handle reports, or investigate technical issues. Service providers may retain their own logs and backups for different periods.</p>
      <p>To request account deletion, use the Privacy Center, confirm your password, and verify the request by email OTP. A 14-day recovery window starts after email verification. After that, the request is reviewed and eligible information is processed for deletion. This is not an instant erase; some payment, security, moderation, or backup records may remain for a period.</p>
    </Section>

    <Section title="6. Your available choices">
      <ul>
        <li>Update profile details through account settings where those controls are available.</li>
        <li>Change reader-update preferences or unsubscribe from an update email.</li>
        <li>Use the Privacy Center to request an available data export, withdraw consent, or request account deletion.</li>
        <li>Contact support to ask about correcting information or a privacy request. We may ask you to verify account ownership before responding.</li>
      </ul>
    </Section>

    <Section title="7. Age and policy changes">
      <p>Atma Rekha is intended for readers aged 15 and above. Registration asks users to confirm they are at least 15; the site does not independently verify this using an identity document.</p>
      <p>This policy may change as the website develops. The date at the top of the page shows when this version was last updated.</p>
    </Section>

    <Section title="8. Contact">
      <p>For account, privacy, or payment questions, contact <a href="mailto:atmarekhasupport@gmail.com">{SUPPORT_EMAIL}</a>.</p>
      <p>For general questions, email <a href="mailto:atmarekhainfo@gmail.com">{INFO_EMAIL}</a>. For official correspondence, email <a href="mailto:atmarekhaoffical@gmail.com">{OFFICIAL_EMAIL}</a>.</p>
      <p>Account emails are sent from <a href="mailto:no-reply@atmarekha.in">no-reply@atmarekha.in</a>. This is a sending address, not the support inbox.</p>
    </Section>
  </>;
}
