# Atma Rekha — India DPDP readiness

Effective date: 7 October 2026

This document records product and engineering controls implemented for readiness against the Digital Personal Data Protection Act, 2023 and the notified Digital Personal Data Protection Rules, 2025. The Act and Rules have phased commencement: most substantive provisions are scheduled to take effect eighteen months after 13 November 2025 (13 May 2027), with limited provisions effective earlier. This is an engineering-readiness document, not a claim of present statutory compliance.

## Data Fiduciary contact

Atma Rekha
Privacy / grievance contact: atmarekhasupport@gmail.com

The current service is not represented as a Significant Data Fiduciary and therefore no DPO designation is asserted by this document.

## Personal data inventory

The application can process account email, display name, username, avatar, bio, account timestamps, reading history, bookmarks, ratings, comments, community activity, notification subscriptions, membership/subscription records, payment-related records, moderation records, and technical identifiers used for security or abuse prevention.

Public comments are intentionally visible to other readers. Payment credentials are handled by Razorpay rather than stored as full card/UPI credentials in the application database.

## Purpose controls

Data is used for account access, reading features, reading progress, favourites, ratings, comments/community features, membership access and billing, notifications, security/abuse prevention, support, troubleshooting, and applicable legal obligations.

Signup now presents an independent notice describing categories of data and purposes and records the notice version and purposes accepted.

## Data Principal controls

Implemented in the product:

- Access/portability: Privacy Center data export.
- Correction: profile editing.
- Erasure: account deletion request flow with lawful-retention caveat.
- Withdrawal of consent where applicable: consent withdrawal action.
- Grievance redressal: dedicated feedback/privacy form and support email.
- Nomination: nominee details can be saved, updated and removed in Privacy Center.

Account ownership is verified before sensitive data is exported or changed.

## Security controls

Implemented:

- Row Level Security on privacy-rights tables.
- Server-side service-role functions for privileged data-rights and admin operations.
- Rate limiting for feedback submissions.
- Honeypot spam protection.
- HTTPS redirect/security wrapper and security headers.
- Content Security Policy and clickjacking protection.
- Frontend error logging hook with optional Sentry transport.
- Audit/incident storage for personal-data breach handling.
- Controlled media access and separate media Workers.
- Production dependency security audit.

## Breach readiness

A private breach-incident record is available for discovery, containment, affected-data tracking, mitigation, notification timestamps and resolution. The privacy policy describes breach assessment, containment and notification steps. The exact statutory notification duties and timelines will be applied according to the provisions in force at the time of the incident.

## Retention

The policy follows purpose-based retention: personal data is retained only while needed for the stated purpose or a legal/security/accounting/payment obligation. Automated deletion periods are not hard-coded where doing so could conflict with a legal or financial retention requirement.

## Processors

Current infrastructure may involve Supabase, Cloudflare and Razorpay. Their use is documented in the privacy policy and data export metadata.

## Children

Account creation is limited to readers who confirm they are 15 or older. Public reading access is separate from account creation.

## India consumer / platform compliance readiness

The website also publishes a grievance mechanism for community/platform complaints and consumer complaints. The current Terms and Report pages disclose membership pricing, recurring billing, cancellation, refund handling, contact details and content-reporting routes. The Consumer Protection (E-Commerce) (Amendment) Rules, 2026 were notified on 9 September 2026 and take effect from 1 January 2027; the product should be re-audited before that date for the new requirements covering legal/operator details, sponsored listings, price-reduction disclosures, dark-pattern self-audits and other applicable e-commerce duties.

## Operational verification added 19 October 2026

- The production Supabase project has the consent, deletion-request and nomination tables with row-level security. The applied migration is tracked as `20261019083955_dpdp_privacy_controls_20261019`; use `supabase/migrations/20261019083955_dpdp_privacy_controls_20261019.sql` for other environments before relying on these controls.
- Community-post comments are enabled in the production schema through `20261019084004_community_post_comments_20261019`.
- Direct client writes to privacy-rights tables are revoked; privileged writes run through the JWT-verified `dpdp-data-rights` Edge Function. The grant-hardening migration is `supabase/migrations/20261019084630_harden_dpdp_table_grants_20261019.sql`.
- Signup consent metadata is copied into a durable consent record by an auth-user trigger, including signups that need email confirmation.
- Reader deletion requests are tracked and visible in the admin workspace under **Privacy Requests**. This is a review-and-erasure workflow, not instant self-service deletion. The legacy `delete-account` Edge Function now only queues a request and no longer immediately deletes the auth user, preventing automatic cascades into payment/subscription records: an authorised administrator must verify the request, perform erasure in the relevant systems, review lawful retention, and only then record a resolution note. Do not mark a request resolved before the underlying work is complete.
- Data exports now include explicit warnings for categories that could not be retrieved; a download with warnings must not be described as a complete export.
- The profile editor saves profile fields independently of Auth email updates and explains that an email change may remain pending until confirmation.
- Notification opt-in waits for five minutes of active use. After the first dismissal, the next prompt waits until cumulative active use reaches 30 hours; later dismissals wait another 30 minutes of active use. Readers can permanently opt out in the prompt.

## India consumer-law release gate

The public grievance page now states the consumer-complaint target of acknowledgement within 48 hours and redress within one month where the Consumer Protection (E-Commerce) Rules apply. The Consumer Protection (E-Commerce) (Amendment) Rules, 2026 are scheduled to commence on 1 January 2027, so review the live website before that date.

**Not complete until the creator confirms it:** the repository does not contain a verified legal operator name beyond “Arkesh” or a principal geographic/postal address to publish. Do not invent or publish a guessed address. Confirm the correct legal name, whether a registered business/entity exists, the address that may lawfully be published, and whether the e-commerce disclosure rules apply to this membership model. The current contact email and grievance-officer designation alone may not satisfy every required operator disclosure.

**Under-18 account decision:** signup currently permits readers aged 15 and over. Under the DPDP framework, a child is generally a person under 18, and verifiable parental consent requirements may apply when the relevant provisions commence. The current age checkbox is not a parental-consent verification system. Before the relevant provisions take effect, either implement a legally reviewed verifiable parental-consent flow for under-18 accounts or change account eligibility to 18+. Public reading age guidance and account eligibility are separate decisions; do not claim this item is complete yet.

## Operational items requiring account/legal administration

Some controls cannot be completed purely in application code:

- Supabase leaked-password protection requires the available Supabase plan/dashboard setting.
- Cloudflare account-level minimum TLS/zone settings require a token with Zone Settings permission.
- Cloudflare Analytics Engine must be enabled for the custom analytics Worker.
- Optional Sentry production logging requires a VITE_SENTRY_DSN.
- CAPTCHA/Turnstile requires a site key and server secret.
- The legal operator's exact legal name, principal geographic/business address, customer-care contact details, tax registration status (GSTIN/MSME if applicable), processor contracts, retention schedules, breach procedures and any required DPO/SDF determinations must be reviewed against the actual business/legal structure before claiming formal legal compliance.
- If Atma Rekha is treated as an e-commerce entity, the public site must show the legally correct operator name and principal address; these details must not be invented in application code.

## Official sources

- Digital Personal Data Protection Act, 2023 — Ministry of Electronics and Information Technology.
- Digital Personal Data Protection Rules, 2025 — Ministry of Electronics and Information Technology.
- MeitY explanatory note on the 2025 Rules.

This file describes engineering readiness and product controls; it is not a legal opinion.