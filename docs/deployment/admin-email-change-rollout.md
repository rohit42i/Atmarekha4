# Admin email-change rollout

## Deployment order

1. Require the pull request build and CodeQL checks to finish successfully before merging.
2. Apply `supabase/migrations/20261019190000_admin_email_change_requests.sql` to the production Supabase project using the normal migration process.
3. Deploy the updated `get-admin-console-data` and `send-email-to-users` Edge Functions from this commit.
4. Confirm the deployed project has `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `RESEND_API_KEY` configured for the relevant function. Never put secret values in Git.
5. In Supabase Auth, confirm secure email-change verification is enabled and the redirect URL `https://www.atmarekha.in/` is allow-listed.
6. Confirm the configured Resend sender is verified and check delivery logs before inviting readers to use the feature.

## Smoke tests

- A signed-in reader can submit an email change and sees a clear result if request tracking fails.
- A reader cannot read another user's request or write request-history events.
- A non-admin cannot fetch the admin request queue or resend verification.
- An admin can see pending requests and history; resend attempts send separate confirmation messages to the current and requested addresses.
- Confirming both email links completes the auth-provider email change; refreshing the queue reflects the final status.
- Test expired links, duplicate requests, partial delivery, Resend failure, and unavailable/deleted accounts.
- Confirm the existing login, profile update, and general email-sending workflows still work.

## Rollback

If a smoke test fails, disable the new admin resend action first, then revert the application change. Do not drop the request or event tables during rollback; preserve the audit history. Restore the previous Edge Function versions if needed and investigate before retrying.

## Important

This checklist is not evidence of deployment. Do not mark the feature live until migration, function versions, CI checks, and production smoke tests are verified.