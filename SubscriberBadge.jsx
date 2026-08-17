const BATCHES = {
  mini_member: { emoji: '🧸', label: 'Teddy Member' },
  supporter: { emoji: '🌸', label: 'Flower Member' },
  premium: { emoji: '🦚', label: 'Peacock Member' },
};

export default function SubscriberBadge({ planId, show, size = 'inline' }) {
  const batch = BATCHES[planId];
  if (!batch || show === false) return null;

  return (
    <span
      className={`subscriber-badge subscriber-badge--${size}`}
      aria-label={`Active ${batch.label}`}
      title={`Active ${batch.label}`}
      role="img"
    >
      {batch.emoji}
    </span>
  );
}

export { BATCHES };
