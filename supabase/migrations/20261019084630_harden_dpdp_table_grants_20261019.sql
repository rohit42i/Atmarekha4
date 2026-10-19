-- Route privacy writes through the authenticated data-rights Edge Function.
-- Readers retain SELECT access governed by row-level security.
revoke insert, update, delete, truncate, references, trigger
  on table public.dpdp_consent_records, public.dpdp_deletion_requests, public.dpdp_nominations
  from anon, authenticated;
grant select on public.dpdp_consent_records, public.dpdp_deletion_requests, public.dpdp_nominations
  to authenticated;
grant all on public.dpdp_consent_records, public.dpdp_deletion_requests, public.dpdp_nominations
  to service_role;
