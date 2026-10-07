const BATCHES = {
  mini_member: { emoji: '🧸', label: 'Teddy Member' },
  supporter: { emoji: '🌸', label: 'Flower Member' },
  premium: { emoji: '🦚', label: 'Peacock Member' },
};

export default function SubscriberBadge({ planId, show = true, size = 'inline' }) {
  const key = String(planId || '').trim().toLowerCase();
  const batch = BATCHES[key];
  if (!batch || show === false) return null;

  const profileSize = size === 'large';
  return (
    <span
      className={`subscriber-badge subscriber-badge--${size}`}
      aria-label={`Active ${batch.label}`}
      title={`Active ${batch.label}`}
      role="img"
    >
      <span className="subscriber-badge-icon" aria-hidden="true">{batch.emoji}</span>
      {profileSize && <span className="subscriber-badge-label">{batch.label}</span>}
    </span>
  );
}

export { BATCHES };
