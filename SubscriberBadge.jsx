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
        .subscriber-badge--inline,
        .subscriber-badge--compact{
          width:1.55em!important;
          height:1.55em!important;
          min-width:1.55em!important;
          min-height:1.55em!important;
          margin-left:.3em!important;
          border-width:1px!important;
        }
        .subscriber-badge--inline .subscriber-badge-mark,
        .subscriber-badge--compact .subscriber-badge-mark{
          display:grid!important;
          place-items:center!important;
          width:100%!important;
          height:100%!important;
          font-size:.82em!important;
          line-height:1!important;
        }
        .subscriber-badge--large{
          min-height:30px!important;
          padding:4px 10px!important;
          font-size:12px!important;
        }
        .user-auth-name .subscriber-badge--inline{
          width:1.35em!important;
          height:1.35em!important;
          min-width:1.35em!important;
          min-height:1.35em!important;
          margin-left:.35em!important;
          font-size:.92em!important;
        }
        @media(max-width:600px){
          .subscriber-badge--large{
            min-height:28px!important;
            padding:4px 9px!important;
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