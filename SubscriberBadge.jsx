const BATCHES = {
  mini_member: { mark: 'S', label: 'Supporter' },
  supporter: { mark: 'P', label: 'Premium Supporter' },
  premium: { mark: 'S', label: 'Super Supporter' },
};

export default function SubscriberBadge({ planId, show = true, size = 'inline' }) {
  const planKey = String(planId || '').trim().toLowerCase();
  const batch = BATCHES[planKey];
  if (!batch || show === false) return null;

  const sizeClass = size === 'compact'
    ? 'subscriber-badge--compact'
    : size === 'large'
      ? 'subscriber-badge--large'
      : size === 'home'
        ? 'subscriber-badge--home'
        : 'subscriber-badge--inline';

  return (
    <span
      className={'subscriber-badge ' + sizeClass}
      data-membership-plan={planKey}
      aria-label={'Active ' + batch.label}
      title={'Active ' + batch.label}
      role="img"
    >
      <span className="subscriber-badge-mark" aria-hidden="true">{batch.mark}</span>
    </span>
  );
}

export { BATCHES };
