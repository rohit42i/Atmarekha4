import { AdminButton, AdminCard, AdminEmptyState } from './admin-studio-ui.jsx';

export default function EmailCampaigns({ adminEmail = '' }) {
  return (
    <section className="admin-stack">
      <AdminCard
        eyebrow="AUDIENCE · EMAIL"
        title="Email campaigns"
        description={adminEmail ? `Campaign workspace for ${adminEmail}.` : 'Campaign workspace for the Atma Rekha publishing account.'}
      >
        <AdminEmptyState
          icon="message"
          title="No campaign data is connected"
          description="Email campaign delivery, audience segments and campaign history are not exposed by the current admin data layer. Nothing is estimated here."
          action={(
            <AdminButton type="button" variant="ghost" disabled>
              Campaigns unavailable
            </AdminButton>
          )}
        />
      </AdminCard>
    </section>
  );
}
