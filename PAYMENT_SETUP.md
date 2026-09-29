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
