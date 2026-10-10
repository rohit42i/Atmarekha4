# Atma Rekha: 100-Point Website Standards Audit

**Release status: NOT APPROVED FOR LAUNCH until the manual gates below are evidenced.**

This document is the working release gate for the checklist. A successful build or source scan is not proof that a real device, browser, visual or legal check has passed. The previous checkmarks are not treated as verification unless there is current evidence.

## Status legend

- **Code guard**: an implementation has been added, but a browser check is still required.
- **Static check**: validated by `npm run check`.
- **Manual gate**: requires visual, device, service, legal or human review.
- **Policy conflict**: the literal requirement conflicts with the published product and needs a deliberate owner decision before launch.

## Design standards (1–25)

| # | Requirement | Current status / evidence needed |
|---:|---|---|
| 1 | No purple/aesthetic-only gradients | Manual gate. Inspect the complete site and admin at every breakpoint; no whole-site visual audit has been run. |
| 2 | Rectangular buttons, not pills | Code guard in `website-standards.css`; verify every real component, including compact icon controls. |
| 3 | No emoji icons | Manual source/content audit; status is not yet verified across every route. |
| 4 | No excessive scroll animations | Manual audit of React/GSAP behavior and real scrolling. |
| 5 | No custom cursor | Static source scan rejects CSS `cursor: url(...)`; still inspect runtime behavior. |
| 6 | Clear type hierarchy | Manual visual audit and 200% text resizing. |
| 7 | No stylistic em dashes | Manual content audit; fix any remaining user-facing instances. |
| 8 | Specific, actionable hero text | Manual content approval on homepage and each landing route. |
| 9 | Documented design rationale | This file documents guardrails; finish rationale for existing components during visual audit. |
| 10 | Consistent spacing | Manual audit across pages and breakpoints. |
| 11 | Limited intentional color palette | Manual token and rendered-color audit. |
| 12 | Consistent, functional icons | Manual review of every icon button and accessible name. |
| 13 | UI transitions under 300 ms | Interactive transitions capped at 180 ms by code guard; inspect remaining JS/GSAP animations manually. |
| 14 | Purposeful borders, shadows and depth | Manual visual review. |
| 15 | Clear font-size scale | Manual typography audit. |
| 16 | WCAG AA contrast | Manual/automated contrast measurement still required; do not mark passed based on CSS alone. |
| 17 | No visual noise | Manual review. |
| 18 | Consistent hover states | Manual mouse/keyboard review. |
| 19 | Visible keyboard focus | Code guard added for light/dark themes; verify focus in every dialog and route. |
| 20 | Purpose-built mobile layout | Manual real-device audit. |
| 21 | Default/hover/active/disabled button states | Manual interaction audit across components. |
| 22 | Labeled forms and clear error states | Manual keyboard and screen-reader audit. |
| 23 | Visible loading states | Existing states need route-by-route failure/loading simulation. |
| 24 | Helpful empty states | Manually test empty chapters, comments, search, history and community views. |
| 25 | Dark-mode readability | Manual light/dark contrast and screenshot review. |

## Content standards (26–50)

| # | Requirement | Current status / evidence needed |
|---:|---|---|
| 26 | Human-written copy | Human editorial review required; source code cannot prove authorship. |
| 27 | No vague marketing language | Manual copy review. |
| 28 | Specific product descriptions | Manual copy review. |
| 29 | Concise benefit-led descriptions | Manual copy review. |
| 30 | Verifiable claims | Evidence review required for every public claim. |
| 31 | No placeholders | Static scan rejects common placeholders; manual review still required. |
| 32 | Descriptive headings | Manual content hierarchy review. |
| 33 | Scannable body content | Manual review on mobile and desktop. |
| 34 | Clear CTA labels | Manually test buttons and action outcomes. |
| 35 | No AI-generated images | **Policy conflict:** published manga artwork is core product content and the site discloses AI-assisted parts of production. Do not delete story art blindly; owner must resolve this criterion explicitly. |
| 36 | Real/licensed/original photos | Manual asset provenance review. |
| 37 | No AI art or synthetic imagery | **Policy conflict** for the same reason as #35; not compliant as literally written while current artwork remains. |
| 38 | Descriptive alt text | Automated/source review plus manual assistive-technology checks required. |
| 39 | No fake testimonials | Source/content audit required. |
| 40 | Testimonials real and verifiable | Manual check of any displayed testimonials. |
| 41 | No fake metrics/counters | Manual runtime/content review. |
| 42 | No fabricated social proof | Manual content review. |
| 43 | Verifiable customer counts | Remove unless supported by reliable data. |
| 44 | No lorem ipsum | Static scan rejects common placeholder copy; manual review required. |
| 45 | Clear pricing and fees | Reconcile every price/access tier with the live payment flow. |
| 46 | Proofread copy | Full editorial review required. |
| 47 | No outdated/future-dated content | Verify all release dates, policy dates and current feature descriptions. |
| 48 | Working links | Automated link crawl and manual outbound-link review required. |
| 49 | No excessive punctuation/text effects | Manual copy and visual review. |
| 50 | Consistent tone | Editorial review across every public route. |

## Technical checklist (51–75)

| # | Requirement | Current status / evidence needed |
|---:|---|---|
| 51 | Custom domain live | Manual live HTTP/DNS confirmation required. |
| 52 | DNS correct | Verify production DNS resolution and canonical redirect externally. |
| 53 | HTTPS enforced | Verify redirects, certificate, response headers and mixed-content behavior. |
| 54 | Favicon valid | HTML reference exists; verify asset response and dimensions. |
| 55 | Title and description metadata | Static source check; verify route-specific metadata at runtime. |
| 56 | Open Graph configured | Static source check; test real share previews. |
| 57 | No “Made with AI” badge | Static source scan; check rendered pages and external embeds. |
| 58 | No tool watermark/attribution | Manual asset audit. |
| 59 | Privacy page exists | Source exists; verify live route, full render and all links. |
| 60 | Service-specific privacy notice | Legal/privacy review required. |
| 61 | Terms page exists | Source exists; verify live route and full render. |
| 62 | Specific terms, not boilerplate | Legal review required. |
| 63 | Working contact page/form | Submit test messages and verify success/error states. |
| 64 | Footer legal links | Static check; verify each link works at runtime. |
| 65 | Sitemap generated/submitted | Generation script exists; verify deployed sitemap and search-console submission. |
| 66 | Robots configured | Static check; verify actual deployed response and crawl rules. |
| 67 | No broken internal links | Run a full authenticated and public route crawl. |
| 68 | No console errors | Capture browser console on all routes and flows. |
| 69 | No JS warnings/deprecations | Capture browser console and fix recurring warnings. |
| 70 | No mixed content | Browser security panel/network audit required. |
| 71 | Forms submit and confirm | Submit every form successfully and with invalid input. |
| 72 | Email confirmations delivered | Send controlled test submissions and confirm inbox delivery. |
| 73 | Mobile viewport configured | Static source check; validate on devices. |
| 74 | Assets minified | Vite build configuration supports minification; inspect built output. |
| 75 | No unused CSS/dead code | Bundle/CSS coverage and code audit required. |

## Performance (76–85)

| # | Requirement | Current status / evidence needed |
|---:|---|---|
| 76 | Under 3 seconds on 4G | Not verified. Capture repeatable mobile performance results on representative routes. |
| 77 | Lighthouse mobile >80 | Not verified. Run Lighthouse against deployed production URLs. |
| 78 | Lighthouse desktop >85 | Not verified. Run Lighthouse against deployed production URLs. |
| 79 | Images optimized | Image inventory and transfer-size review required. |
| 80 | Images sized for display | Verify responsive image sizes and real image transfer sizes. |
| 81 | Below-fold lazy loading | Inspect rendered image requests and above-fold priority. |
| 82 | No render-blocking resources | Lighthouse/network waterfall review required. |
| 83 | Critical CSS optimized | Inspect production CSS delivery and first render. |
| 84 | Appropriate JS loading | Inspect production bundle/network waterfall. |
| 85 | No synchronous heavy third-party scripts | Inspect third-party requests and main-thread work. |

## Accessibility (86–90)

| # | Requirement | Current status / evidence needed |
|---:|---|---|
| 86 | Logical heading hierarchy | Automated accessibility scan plus per-route manual review. |
| 87 | Descriptive image alt text | Audit meaningful images and verify decorative images are ignored by assistive tech. |
| 88 | Tab/Enter/Escape works | Keyboard test all menus, forms, modals, reader controls and navigation. |
| 89 | Focus indicators visible | Code guard added; runtime keyboard verification remains. |
| 90 | Meaning not conveyed by color alone | Manual UI-state review and contrast/accessibility test. |

## Testing and quality (91–100)

| # | Requirement | Current status / evidence needed |
|---:|---|---|
| 91 | Desktop Chrome, Firefox, Safari and Edge | Not verified; attach a dated test record. |
| 92 | iOS Safari and Chrome | Not verified; test actual iOS browsers/devices. |
| 93 | Real-device tests | Not verified; browser emulation does not satisfy this item. |
| 94 | Form validation and errors | Test invalid, empty, duplicate and successful submissions. |
| 95 | Final proofreading | Full route-by-route content pass required. |
| 96 | Dates/numbers/facts verified | Reconcile public metadata, release schedule, age/content rules and membership prices. |
| 97 | 320/768/1024/1440 px | Capture and inspect all key routes at all listed widths. |
| 98 | No layout shifts/reflows | Record CLS/layout shifts and inspect slow-network loads. |
| 99 | No sensitive data in logs | Raw error/context logging removed; audit remaining logs and telemetry end-to-end. |
| 100 | Stakeholder launch approval | Not approved. Record explicit final sign-off after all blockers are closed. |

## Pre-launch gate

Do not deploy this branch as a release until every manual gate is completed with dated evidence. Specifically:

- [ ] Complete visual/content audit on the public site and admin.
- [ ] Resolve the AI-art policy conflict without silently deleting published story content.
- [ ] Complete browser, device, keyboard, assistive technology and responsive tests.
- [ ] Attach mobile/desktop Lighthouse results and route-crawl results.
- [ ] Verify form delivery, emails, live domain, HTTPS and security headers.
- [ ] Complete privacy/terms review.
- [ ] Confirm backup and rollback references.
- [ ] Obtain final launch sign-off.

## Re-run static checks

```sh
npm run check
npm run build
```

The static check is a guardrail, not a replacement for the manual release gate.
