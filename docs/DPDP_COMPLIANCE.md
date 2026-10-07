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
- Nomination: nominee details can be saved and updated in Privacy Center.

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