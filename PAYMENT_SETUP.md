# ApartmentPro Messenger Manual Payment Setup

The Messenger **💳 Send Payment** flow now works as:

1. Tenant taps **Send Payment**.
2. Bot asks **GCash** or **Bank Transfer**.
3. Bot sends the configured payment details.
4. If configured, the bot sends the corresponding QR code as a separate Messenger image.
5. Tenant submits either:
   - a transaction/reference number, or
   - a payment receipt screenshot/photo.
6. The submission is stored as **PENDING VERIFICATION**. The bot does **not** mark the tenant's bill as paid automatically.
7. An admin notification and transaction log are created for verification.

## Required environment variables

Set these in Vercel and the Google Cloud Run / AI Studio webhook environment. Do **not** put real account numbers in source code or commit them to Git.

- `APARTMENTPRO_GCASH_NAME`
- `APARTMENTPRO_GCASH_NUMBER`
- `APARTMENTPRO_GCASH_QR_URL` (optional HTTPS image URL)
- `APARTMENTPRO_BANK_NAME`
- `APARTMENTPRO_BANK_ACCOUNT_NAME`
- `APARTMENTPRO_BANK_ACCOUNT_NUMBER`
- `APARTMENTPRO_BANK_QR_URL` (optional HTTPS image URL)

## Security behavior

- Only a verified/linked ApartmentPro tenant can start a payment submission.
- Payment references are sanitized and length-limited.
- Receipt uploads must be image content and are limited to 5 MB.
- Receipt URLs are never echoed back to the tenant.
- Payment submissions remain `pending_verification` until management verifies them.
- The bot never changes a billing record to `paid` solely because a tenant submitted a reference or screenshot.
- Diagnostic logging does not print payment receipt URLs or full receipt contents.
- Payment sessions expire after two hours.


## Admin Payment Verification

The admin portal now includes **Payment Verification**. Administrators can review Messenger payment submissions, open tenant receipt images, confirm or reject the submission, and—when confirmed—post the verified amount to the tenant's oldest outstanding bill.

Security measures:
- Verification endpoints require a cryptographically signed admin session token.
- Receipt files are served through an authenticated endpoint and are not exposed as public URLs.
- Receipt images are validated as images and capped at 5 MB.
- Payment submissions remain `pending_verification` until an administrator confirms them.
- Confirming a payment updates the billing record and sends a Messenger confirmation to the linked tenant.
- Rejecting a submission sends the tenant a Messenger notice asking them to resubmit.
- Set `ADMIN_SESSION_SECRET` to a long random server-only value in production.

## Messenger notification restriction handling

ApartmentPro treats Meta error code 10 / subcode 1893063 as a recipient/conversation restriction, not as proof that the payment failed. The payment remains confirmed, no deprecated message tag is attempted, and the admin sees `FAILED_RECIPIENT_RESTRICTED` for the notification.
