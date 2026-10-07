const BATCHES = {
  mini_member: { emoji: '🧸', label: 'Teddy Member' },
  supporter: { emoji: '🌸', label: 'Flower Member' },
  premium: { emoji: '🦚', label: 'Peacock Member' },
};

export default function SubscriberBadge({ planId, show = true, size = 'inline' }) {
  const planKey = String(planId || '').trim().toLowerCase();
  const batch = BATCHES[planKey];
  if (!batch || show === false) return null;

  const sizeClass = size === 'compact'
    ? 'subscriber-badge--compact'
    : size === 'large'
      ? 'subscriber-badge--large'
      : 'subscriber-badge--inline';

  return (
    <span
      className={'subscriber-badge ' + sizeClass}
      data-membership-plan={planKey}
      aria-label={'Active ' + batch.label}
      title={'Active ' + batch.label}
      role="img"
    >
      <span className="subscriber-badge-mark" aria-hidden="true">{batch.emoji}</span>
    </span>
  );
}

export { BATCHES };