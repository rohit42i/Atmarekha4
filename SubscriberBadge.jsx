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
    <>
      <style>{`
        /* Membership badge: one consistent physical size; never scales with surrounding text. */
        .subscriber-badge.subscriber-badge--inline,
        .subscriber-badge.subscriber-badge--compact{
          width:36px!important;
          height:36px!important;
          min-width:36px!important;
          min-height:36px!important;
          flex:0 0 36px!important;
          margin:0 0 0 8px!important;
          padding:0!important;
          border:1px solid var(--border-color,#deded9)!important;
          border-radius:50%!important;
          box-sizing:border-box!important;
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
          vertical-align:middle!important;
          line-height:1!important;
        }
        .subscriber-badge.subscriber-badge--inline .subscriber-badge-mark,
        .subscriber-badge.subscriber-badge--compact .subscriber-badge-mark{
          display:grid!important;
          place-items:center!important;
          width:100%!important;
          height:100%!important;
          font-size:20px!important;
          line-height:1!important;
        }
        .subscriber-badge.subscriber-badge--large{
          min-width:120px!important;
          min-height:36px!important;
          padding:0 12px!important;
          margin-left:8px!important;
          box-sizing:border-box!important;
          border-radius:999px!important;
          font-size:13px!important;
          font-weight:750!important;
        }
        .subscriber-badge.subscriber-badge--large .subscriber-badge-mark{
          font-size:20px!important;
          line-height:1!important;
        }
        html[data-theme="dark"] .subscriber-badge.subscriber-badge--inline,
        html[data-theme="dark"] .subscriber-badge.subscriber-badge--compact,
        html[data-theme="dark"] .subscriber-badge.subscriber-badge--large{
          background:#0b0b0b!important;
          color:#fff!important;
          border-color:#2e2e2e!important;
        }
        html[data-theme="light"] .subscriber-badge.subscriber-badge--inline,
        html[data-theme="light"] .subscriber-badge.subscriber-badge--compact,
        html[data-theme="light"] .subscriber-badge.subscriber-badge--large{
          background:#f4f4f1!important;
          color:#111!important;
          border-color:#deded9!important;
        }
        @media(max-width:600px){
          .subscriber-badge.subscriber-badge--inline,
          .subscriber-badge.subscriber-badge--compact{
            width:34px!important;
            height:34px!important;
            min-width:34px!important;
            min-height:34px!important;
            flex-basis:34px!important;
          }
          .subscriber-badge.subscriber-badge--inline .subscriber-badge-mark,
          .subscriber-badge.subscriber-badge--compact .subscriber-badge-mark{
            font-size:19px!important;
          }
          .subscriber-badge.subscriber-badge--large{
            min-width:112px!important;
            min-height:34px!important;
            font-size:12px!important;
          }
        }
      `}</style>
      <span
        className={'subscriber-badge ' + sizeClass}
        data-membership-plan={planKey}
        aria-label={'Active ' + batch.label}
        title={'Active ' + batch.label}
        role="img"
      >
        <span className="subscriber-badge-mark" aria-hidden="true">{batch.emoji}</span>
      </span>
    </>
  );
}

export { BATCHES };
