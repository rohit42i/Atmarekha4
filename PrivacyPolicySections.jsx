const SUPPORT_EMAIL = 'atmarekhasupport@gmail.com';
const INFO_EMAIL = 'atmarekhainfo@gmail.com';

function Section({ title, children }) {
  return <article className="privacy-policy-section"><h2>{title}</h2>{children}</article>;
}

function List({ items }) {
  return <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>;
}

export default function PrivacyPolicySections() {
  return <>
    <Section title="1. Introduction and scope">
      <p>This policy explains how Atma Rekha, an original fantasy adventure manga website created by Arkesh Kaalvantik, handles information when you visit the site, create an account, read manga, use community features or purchase a membership.</p>
      <p>Atma Rekha uses Supabase for authentication and backend data, Cloudflare for hosting, Workers, analytics and R2 media storage, Resend for email delivery, and Razorpay for membership payments.</p>
    </Section>

    <Section title="2. What data we collect">
      <h3>Account data</h3>
      <p>Email address, account ID, account creation date, account status, username and authentication information. Passwords are handled by the authentication service and are not intended to be stored in plain text by Atma Rekha.</p>
      <h3>Profile data</h3>
      <p>Display name, optional biography, avatar, profile preferences and verification status.</p>
      <h3>Reading data</h3>
      <p>Chapters viewed, reading progress, bookmarks, ratings and reading history timestamps.</p>
      <h3>Community data</h3>
      <p>Comments, discussions, ratings, reports, community interactions and information needed to review reports or moderate content. Comments and profile details you choose to make public may be visible to other readers.</p>
      <h3>Membership data</h3>
      <p>Membership tier and status, subscription identifiers, period dates, benefits applied, renewal or cancellation status and membership history.</p>
      <h3>Payment data</h3>
      <p>Razorpay order, payment and subscription references, amount, currency, timestamps, payment status, refund information and receipt or invoice references. Atma Rekha does not ask for or intend to store full card credentials, CVVs or UPI PINs.</p>
      <h3>Analytics data</h3>
      <p>Chapter views, page visits, engagement and feature usage metrics, referral sources, performance data and technical information such as IP address, browser and operating system where available through hosting or analytics services.</p>
      <h3>Administrative data</h3>
      <p>Moderation decisions, removed-content records, report status, announcements, membership management actions, administrative notes and account restrictions.</p>
      <h3>Email data</h3>
      <p>Email address, verification status, temporary OTP or verification events, timestamps and delivery records. Open or click tracking may be processed only where the relevant tracking feature is enabled.</p>
      <h3>Security data</h3>
      <p>Authentication events, password-reset requests, failed sign-in events and technical or access logs when recorded by the application or its providers. These records help protect accounts and investigate suspicious activity.</p>
      <h3>Uploaded media</h3>
      <p>Manga pages and chapter covers stored in Cloudflare R2, profile avatars and other media supported by the site. Media metadata may include file type, size and upload time.</p>
    </Section>

    <Section title="3. Why we use your data">
      <List items={[
        'Create accounts, verify email addresses, sign users in and support password recovery.',
        'Display manga, save reading progress and bookmarks, apply reader preferences and display ratings.',
        'Publish comments, support discussions, receive reports and moderate content.',
        'Create and manage memberships, verify payments, maintain subscription status and handle payment or refund questions.',
        'Measure chapter popularity, website usage and service performance where analytics are enabled.',
        'Send account, security, payment and membership emails, and reader updates according to your recorded preferences.',
        'Protect accounts and the website, investigate abuse, resolve disputes and meet applicable legal obligations.',
        'Respond to requests to access, correct, export, delete or withdraw consent for personal data.'
      ]}/>
    </Section>

    <Section title="4. Legal basis and consent">
      <p>Atma Rekha processes information for the purposes explained in this policy. Depending on the activity and the law applicable at the time, this may be based on your consent, providing an account or feature you request, processing a membership transaction, protecting the service, or meeting a legal obligation.</p>
      <p>Signup records the privacy notice version and the purposes accepted. New chapter announcements and Atma Rekha reader updates are enabled by default for new accounts as disclosed during signup; you can turn them off in More &amp; Settings → Notification preferences or through the unsubscribe link in an update email. Promotional messages, if offered, are handled separately from essential service emails and must follow the applicable consent and preference records.</p>
      <p>Where processing relies on consent, you can withdraw that consent. Withdrawal does not make earlier lawful processing unlawful, and information may still be processed where another legal ground or a legal retention obligation applies.</p>
    </Section>

    <Section title="5. How long we keep information">
      <p>We keep information while it is needed for the purpose for which it was collected, to operate the relevant feature, to protect the service, to handle disputes or to meet an applicable legal or accounting obligation. We do not promise a fixed retention period for provider logs or backups where that period depends on the provider product or account configuration.</p>
      <div className="privacy-table-wrap"><table className="privacy-table">
        <thead><tr><th>Data category</th><th>Retention approach</th><th>Important details</th></tr></thead>
        <tbody>
          <tr><td>Account and profile</td><td>While the account is active, unless a shorter period applies.</td><td>Verified deletion requests include a 14-day recovery period, followed by review and erasure of eligible data.</td></tr>
          <tr><td>Reading progress and bookmarks</td><td>While needed to provide reader features.</td><td>Eligible records are removed or handled as part of account deletion.</td></tr>
          <tr><td>Ratings and comments</td><td>While published or needed for discussion.</td><td>Removed content may remain temporarily in backups or restricted records for moderation, security or legal needs.</td></tr>
          <tr><td>Reports and moderation</td><td>As long as needed for the report or case.</td><td>Records support abuse review, user protection, disputes and legal obligations.</td></tr>
          <tr><td>Membership and payment references</td><td>For subscription management and payment support.</td><td>Records may be retained for accounting, refunds, disputes and legal obligations. Razorpay also applies its own retention practices.</td></tr>
          <tr><td>Analytics and security logs</td><td>According to the active provider or application configuration.</td><td>Periods vary with the service, troubleshooting needs and abuse-prevention requirements.</td></tr>
          <tr><td>Email and verification records</td><td>OTP or verification information is temporary.</td><td>Delivery and support logs are retained as needed for delivery, support and security.</td></tr>
          <tr><td>Avatars and other user media</td><td>While associated with an active profile or feature.</td><td>Eligible media is removed during account erasure; backup copies may persist temporarily.</td></tr>
          <tr><td>Manga pages and chapter covers</td><td>While the content remains published.</td><td>These are creator-owned publication assets, not account profile data.</td></tr>
        </tbody>
      </table></div>
      <p>Account deletion requests require password confirmation and email OTP verification and include a 14-day recovery period after confirmation. A request is queued for review, not instantly erased. After the recovery period, authorised administration processes the erasure of eligible data. Records needed for law, payment, security or disputes may be retained for the relevant period.</p>
    </Section>

    <Section title="6. Who processes your data">
      <h3>Supabase</h3>
      <p>Supabase provides authentication, database and backend services. It may process account details, authentication data, profiles, reading records, comments, membership records and other application data. The specific project region is determined by the project configuration.</p>
      <h3>Cloudflare</h3>
      <p>Cloudflare provides website hosting, Workers, analytics and R2 storage. It may process traffic and performance information, IP addresses and browser details available from requests, and the manga pages, covers and media stored in R2. Cloudflare operates a global network; processing location depends on the service and configuration.</p>
      <h3>Resend</h3>
      <p>Resend delivers account and reader-update emails. It receives the recipient address, message content and delivery information needed for sending. Email open or click data is processed only if that tracking feature is enabled.</p>
      <h3>Razorpay</h3>
      <p>Razorpay processes membership payments and related payment details. Atma Rekha receives transaction or subscription references and the status information needed to provide membership access and support payments. Payment details are also subject to Razorpay's terms, security controls and retention practices.</p>
      <p>These providers process information to provide their services and under their own applicable terms and obligations. The providers' precise storage regions and retention settings depend on the relevant project or account configuration. Atma Rekha does not sell personal information.</p>
    </Section>

    <Section title="7. Your choices and rights">
      <List items={[
        'Access: view available account information and request an export of personal data.',
        'Correction: update profile details or ask us to correct inaccurate information.',
        'Deletion: request account or eligible data deletion, subject to the recovery flow and lawful retention.',
        'Consent withdrawal: withdraw consent for processing that relies on consent, including optional reader updates.',
        'Grievance: contact us if you believe your data or privacy request has been handled incorrectly.',
        'Data export: request a structured JSON or CSV export as a website feature. The export may identify categories that could not be retrieved and should not be treated as complete if it contains warnings.'
      ]}/>
      <p>Available controls depend on the data and feature involved. Some records may remain for a limited period where needed to resolve a payment, security issue or dispute.</p>
    </Section>

    <Section title="8. How to make a privacy request">
      <p>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or use the Privacy Center where the relevant control is available. Explain what you need and provide the account email so we can locate the relevant records. We may verify account ownership before exporting, correcting or deleting information.</p>
      <p>Profile details can be updated in the account settings. The Privacy Center supports data export, consent withdrawal and an account deletion request with password confirmation and email OTP. A deletion request has a 14-day recovery period and is reviewed before eligible data is erased. These controls do not guarantee immediate deletion from every backup or from records required by law.</p>
      <p>We will review requests and contact you if we need more information to identify your account or understand the request.</p>
    </Section>

    <Section title="9. Cookies and browser storage">
      <p>The website uses necessary browser storage for login sessions, preferences and reader features. Cloudflare may use security or service technologies, and Cloudflare analytics or traffic logs may process usage information according to the active configuration.</p>
      <p>The exact cookies and scripts depend on the live site configuration. You can manage or block cookies through your browser settings, but doing so may prevent login or some features from working. We do not claim that Google Analytics or other optional third-party trackers are in use unless they are added and disclosed.</p>
    </Section>

    <Section title="10. Security measures">
      <p>Account and site information is handled by the services described in this policy. Keep your password and verification codes private. If you notice suspicious activity, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </Section>

    <Section title="11. Personal data breaches">
      <p>If a personal data breach is identified, Atma Rekha will assess it, take reasonable steps to contain and address it, and notify affected people or authorities where required by applicable law. Any notice will explain the known type of incident, information affected, measures taken and practical steps you can take, to the extent that information is available and appropriate to share.</p>
    </Section>

    <Section title="12. Children's privacy">
      <p>Atma Rekha is intended for readers aged 15 and above. Account registration asks users to confirm they are at least 15 years old. The website does not currently verify this declaration through an identity document.</p>
      <p>Registration asks users to confirm that they are at least 15. It does not itself verify age or collect parental consent.</p>
    </Section>

    <Section title="13. International processing">
      <p>Atma Rekha is accessible globally and uses service providers that operate infrastructure in more than one location. Supabase data location depends on the project's selected region; Cloudflare uses a global network; Resend and Razorpay process data under their respective service configurations. We do not claim that all data is stored only in India.</p>
      <p>Information may therefore be processed outside India. The precise location depends on the provider and service configuration.</p>
    </Section>

    <Section title="14. Changes to this policy">
      <p>We may update this policy when the site, data practices, service providers or applicable law changes. The current version will display its last-updated date. Material changes will be communicated through an appropriate website notice or email where required or appropriate. Where renewed consent is required by law, continued use alone does not replace it.</p>
    </Section>

    <Section title="15. Contact and complaints">
      <p>For privacy, account or payment questions, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. For general questions, email <a href={`mailto:${INFO_EMAIL}`}>{INFO_EMAIL}</a>.</p>
      <p>Include relevant details, but never send a password, OTP, UPI PIN, CVV or full card number.</p>
    </Section>

  </>;
}
