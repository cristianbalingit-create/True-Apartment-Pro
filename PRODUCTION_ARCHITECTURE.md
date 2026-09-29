# ApartmentPro Production Architecture

## Messenger production path

Facebook Messenger -> Meta Webhook -> Vercel `/api/webhook/facebook` -> live Cloud Firestore -> Vercel Admin Maintenance UI.

The Google AI Studio/Cloud Run webhook must not remain the Meta production callback after migration.

## Maintenance source of truth

The Maintenance admin page refreshes `maintenanceRequests` directly from the configured Cloud Firestore database. Build-time/sample `initialData.maintenanceRequests` must not be treated as production maintenance data.

## Photo handling

Messenger image attachments are extracted from `message.attachments[]` (with a defensive singular-attachment fallback). The server attempts to persist the image permanently. When Firebase Storage credentials are unavailable, only small validated image data URLs are accepted as a temporary serverless-safe fallback; large or invalid images are not stored as successful attachments.

## Security

- Never expose Facebook Page Access Tokens or Firebase service-account credentials to the browser.
- Do not log raw PSIDs, phone numbers, tokens, or private keys.
- Validate attachment type and size before persistence.
- Do not trust client-provided tenant IDs or Firestore document paths.
- Keep production writes awaited before reporting success.
- Review and tighten Firestore security rules before exposing direct client Firestore access in production.

## Important existing security issue

The supplied project currently contains permissive Firestore rules (`allow read, write: if true`). Those rules are not safe for production because they allow unauthenticated clients to read and write Firestore. They should be replaced as part of the authentication/authorization hardening work rather than silently changing them here and breaking the current client architecture.
