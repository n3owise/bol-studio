# Authentication email setup

Prepared 14 October 2026. Templates are ready but are not applied to hosted Supabase yet.

Verify bol-studio.me in Resend. Preserve Cloudflare inbound MX records; use a separate sending subdomain (such as send.bol-studio.me) for any Resend return-path MX record. Add only the DNS values Resend actually supplies. Disable email link tracking for authentication emails.

Supabase Authentication → Email → SMTP Settings:
- Sender: no-reply@bol-studio.me
- Name: Bol Studio
- SMTP host: smtp.resend.com
- Port: 465
- Username: resend
- Password: Resend sending API key, entered by the owner directly in Supabase, never in chat or frontend code.

Confirm signup subject: Confirm your Bol Studio account
Reset password subject: Reset your Bol Studio password
Paste the corresponding HTML templates into Supabase. They use the native ConfirmationURL placeholder. Verify the production Site URL and allowed redirects include https://www.bol-studio.me. Configure server email rate limits to match provider capacity; the UI cooldown is not a security rate limit.

Acceptance: new-account confirmation, resend cooldown, correction of address, password reset with a new password, expired links, spam placement, and rate-limit error. Credential entry and accepting account-creation terms require owner handoff. Public contact hello@bol-studio.me is temporarily selected by the owner.
