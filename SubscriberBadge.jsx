export default function SubscriberBadge({ show }) {
  if (!show) return null;

  return (
    <span
      className="subscriber-badge"
      aria-label="Active subscriber"
      title="Active subscriber"
      role="img"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        marginLeft: 5,
        borderRadius: '50%',
        background: 'var(--accent-color)',
        color: 'var(--accent-contrast)',
        verticalAlign: 'middle',
        lineHeight: 1,
        fontSize: 10,
        fontWeight: 900,
        flex: '0 0 auto',
      }}
    >
      ✓
    </span>
  );
}
