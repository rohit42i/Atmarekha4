const BATCHES = {
  mini_member: { emoji: '🧸', label: 'Teddy Member' },
  supporter: { emoji: '🌸', label: 'Flower Member' },
  premium: { emoji: '🦚', label: 'Peacock Member' },
};

export default function SubscriberBadge({ planId, show = true, size = 'inline' }) {
  const normalizedPlanId = String(planId || '').trim().toLowerCase();
  const batch = BATCHES[normalizedPlanId];
  if (!batch || show === false) return null;

  const scale = size === 'compact' ? 0.8 : size === 'large' ? 1.05 : 0.88;
  return (
    <span
      className={'subscriber-badge subscriber-badge--' + size}
      data-plan={normalizedPlanId}
      aria-label={'Active ' + batch.label}
      title={'Active ' + batch.label}
      role="img"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: '0.28em',
        fontSize: 'calc(1em * ' + scale + ')',
        lineHeight: 1,
        width: '1.18em',
        height: '1.18em',
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
      }}
    >
      {batch.emoji}
    </span>
  );
}

export { BATCHES };
