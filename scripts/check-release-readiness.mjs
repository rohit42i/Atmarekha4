import { readFile, appendFile } from 'node:fs/promises';

const gateLabels = {
  visualContentReview: 'Full visual and content review',
  accessibilityContrastReview: 'Accessibility, keyboard and contrast review',
  responsiveRealDeviceQA: 'Responsive QA on real devices, including 320/768/1024/1440px',
  crossBrowserQA: 'Chrome, Firefox, Safari, Edge and iOS browser QA',
  performanceLighthouse: 'Mobile and desktop Lighthouse/performance evidence',
  liveLinksDomainTLS: 'Live internal links, domain, DNS, HTTPS and TLS verification',
  formsEmailDelivery: 'Forms and email-delivery tests',
  securityReview: 'Security review, including production and development dependencies',
  privacyTermsLegalReview: 'Privacy, terms, consumer and legal review',
  backupRollback: 'Verified backup and rollback plan',
  monitoringAnalytics: 'Monitoring and analytics verification',
  contentPolicyResolution: 'Owner decision resolving the no-AI-art policy versus existing published manga',
  stakeholderSignoff: 'Final stakeholder sign-off'
};

let readiness = {};
try {
  readiness = JSON.parse(await readFile('docs/release-readiness.json', 'utf8'));
} catch (error) {
  console.warn('Release gate: readiness file missing or invalid; production deployment will be skipped.');
}

const incompleteGates = Object.keys(gateLabels).filter(key => readiness.gates?.[key] !== true);
const missingEvidence = Object.keys(gateLabels).filter(key =>
  typeof readiness.evidence?.[key] !== 'string' || readiness.evidence[key].trim().length < 4
);
const validApprovalIdentity = typeof readiness.approvedBy === 'string' && readiness.approvedBy.trim().length > 0;
const approvedAt = typeof readiness.approvedAt === 'string' ? Date.parse(readiness.approvedAt) : NaN;
const validApprovalTime = Number.isFinite(approvedAt);
const approved = readiness.approved === true
  && incompleteGates.length === 0
  && missingEvidence.length === 0
  && validApprovalIdentity
  && validApprovalTime;

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, 'approved=' + String(approved) + '\n');
} else {
  console.log('approved=' + String(approved));
}

if (approved) {
  console.log('Release gate approved by ' + readiness.approvedBy + ' at ' + readiness.approvedAt + '. Deployment may proceed.');
} else {
  console.warn('Release gate is CLOSED. Production deployment will be skipped.');
  for (const key of incompleteGates) console.warn('  Incomplete: ' + gateLabels[key]);
  for (const key of missingEvidence) console.warn('  Evidence missing: ' + gateLabels[key]);
  if (!validApprovalIdentity) console.warn('  Approval identity missing.');
  if (!validApprovalTime) console.warn('  Approval timestamp missing or invalid.');
}
