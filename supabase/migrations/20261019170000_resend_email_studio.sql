-- Resend Email Studio: editable templates, campaign history, and marketing opt-out records.
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'transactional',
  subject text not null,
  html_body text not null,
  text_body text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  template_id uuid references public.email_templates(id) on delete set null,
  subject text not null,
  audience jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  total_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  resend_ids jsonb not null default '[]'::jsonb,
  error_summary text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists public.email_marketing_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  marketing_unsubscribed boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_marketing_preferences enable row level security;
drop policy if exists "Admins can manage email templates" on public.email_templates;
create policy "Admins can manage email templates" on public.email_templates for all to authenticated using (exists (select 1 from public.admins a where a.user_id=auth.uid() and lower(coalesce(a.role,'')) in ('owner','admin'))) with check (exists (select 1 from public.admins a where a.user_id=auth.uid() and lower(coalesce(a.role,'')) in ('owner','admin')));
drop policy if exists "Admins can view email campaigns" on public.email_campaigns;
create policy "Admins can view email campaigns" on public.email_campaigns for select to authenticated using (exists (select 1 from public.admins a where a.user_id=auth.uid() and lower(coalesce(a.role,'')) in ('owner','admin')));
revoke all on public.email_marketing_preferences from anon, authenticated;
grant select, insert, update, delete on public.email_templates to authenticated;
grant select on public.email_campaigns to authenticated;
grant all on public.email_templates, public.email_campaigns, public.email_marketing_preferences to service_role;
insert into public.email_templates (slug,name,category,subject,html_body,text_body) values
('welcome','Welcome to Atma Rekha','transactional','Welcome to Atma Rekha','<h1>Welcome, {{name}}!</h1><p>Thanks for joining Atma Rekha. Start reading your next adventure.</p><p><a href="{{site_url}}">Visit Atma Rekha</a></p>','Welcome, {{name}}! Visit {{site_url}}'),
('verify-email','Verify your email','transactional','Verify your Atma Rekha email','<h1>Verify your email</h1><p>Hello {{name}}, please verify your email using the link below.</p><p><a href="{{action_url}}">Verify email</a></p>','Verify your email: {{action_url}}'),
('reset-password','Reset password','transactional','Reset password','<h1>Password reset</h1><p>Hello {{name}}, use this link to reset your password.</p><p><a href="{{action_url}}">Reset password</a></p>','Reset password: {{action_url}}'),
('email-changed','Email address changed','transactional','Your Atma Rekha email was changed','<p>Hello {{name}}, your account email was changed. If this was not you, secure your account.</p><p><a href="{{site_url}}">Open account</a></p>','Your account email was changed. {{site_url}}'),
('account-deletion-request','Account deletion request received','transactional','We received your account deletion request','<p>Hello {{name}}, we received your request to delete your account. We will process it according to our policy.</p>','We received your account deletion request.'),
('account-deleted','Account deleted','transactional','Your Atma Rekha account was deleted','<p>Hello {{name}}, your account deletion request has been completed.</p>','Your account was deleted.'),
('security-alert','Security alert','transactional','Security alert for your Atma Rekha account','<p>Hello {{name}}, we detected an account security event. If this was not you, review your account.</p><p><a href="{{site_url}}">Review account</a></p>','Security alert. Review your account: {{site_url}}'),
('email-change-confirmation','Confirm email address change','transactional','Confirm your new email address','<p>Hello {{name}}, confirm your email address change using the link below.</p><p><a href="{{action_url}}">Confirm email change</a></p>','Confirm your email: {{action_url}}'),
('comment-reply','Comment reply','transactional','Someone replied to your comment','<p>Hello {{name}}, someone replied to your comment on Atma Rekha.</p><p><a href="{{action_url}}">View reply</a></p>','Someone replied to your comment: {{action_url}}'),
('new-chapter','New chapter published','marketing','A new Atma Rekha chapter is here','<h1>{{chapter_title}}</h1><p>A new chapter is ready to read.</p><p><a href="{{action_url}}">Read now</a></p>','{{chapter_title}} is ready: {{action_url}}'),
('membership-confirmation','Membership confirmed','transactional','Your Atma Rekha membership is active','<p>Hello {{name}}, your membership is active. Thank you for supporting the series.</p><p><a href="{{site_url}}">Read member chapters</a></p>','Your membership is active. {{site_url}}'),
('membership-expiring','Membership expiring','transactional','Your membership is ending soon','<p>Hello {{name}}, your membership is scheduled to end on {{expiry_date}}.</p><p><a href="{{site_url}}">Manage membership</a></p>','Your membership ends {{expiry_date}}. {{site_url}}'),
('membership-renewed','Membership renewed','transactional','Your membership has renewed','<p>Hello {{name}}, your membership has renewed successfully.</p>','Your membership has renewed.'),
('payment-receipt','Payment receipt','transactional','Your Atma Rekha payment receipt','<p>Hello {{name}}, we recorded your membership payment of {{amount}}.</p><p>Reference: {{payment_reference}}</p>','Payment received: {{amount}}. Reference: {{payment_reference}}'),
('payment-failed','Payment issue','transactional','Action needed for your membership payment','<p>Hello {{name}}, your membership payment could not be confirmed. Please review your membership page.</p><p><a href="{{site_url}}">Review membership</a></p>','Membership payment needs attention: {{site_url}}'),
('announcement','Creator announcement','marketing','An update from Atma Rekha','<h1>{{announcement_title}}</h1><p>{{announcement_body}}</p><p><a href="{{site_url}}">Visit Atma Rekha</a></p>','{{announcement_title}}: {{announcement_body}}'),
('community-update','Community update','marketing','New in the Atma Rekha community','<p>Hello {{name}}, there is a new community update waiting for you.</p><p><a href="{{action_url}}">View community</a></p>','New community update: {{action_url}}'),
('feedback-request','Share your feedback','marketing','Help improve Atma Rekha','<p>Hello {{name}}, if you have a moment, share feedback to help improve the reading experience.</p><p><a href="{{action_url}}">Share feedback</a></p>','Share feedback: {{action_url}}'),
('inactive-reader','We miss you','marketing','Your next Atma Rekha read is waiting','<p>Hello {{name}}, continue where you left off when you are ready.</p><p><a href="{{site_url}}">Continue reading</a></p>','Continue reading: {{site_url}}'),
('maintenance-notice','Scheduled maintenance','transactional','Atma Rekha service notice','<p>Hello {{name}}, {{maintenance_message}}</p>','Atma Rekha service notice: {{maintenance_message}}'),
('support-follow-up','Support request update','transactional','Update on your Atma Rekha support request','<p>Hello {{name}}, {{support_message}}</p>','Support update: {{support_message}}')
on conflict (slug) do nothing;