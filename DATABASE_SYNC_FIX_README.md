# Apartment Flow — Firestore Data Consistency Fix

## What this update fixes
- The `/api/db` endpoint waits for Firebase initialization and a live Firestore read before returning records.
- Browser-side direct Firestore fallback reads and writes are disabled, so the UI cannot silently switch to a second data source when the server API fails.
- A failed or partial Firestore collection read is treated as a database error, not as an empty collection or valid local/demo state.
- Startup no longer automatically copies `data.json` demo/local records into an empty Firestore database.
- API requests are blocked with HTTP 503 when the live Firestore database is unavailable; this avoids silently accepting changes into temporary/local state.

## Important before deployment
1. Export/backup the target Firestore database in Google Cloud before deploying any update.
2. Deploy the root project directory (the one containing the root `package.json`, `vercel.json`, `server.ts`, and `src/`). The `work/` folder in this archive is an older nested project copy and is not the Vercel root project.
3. Ensure Vercel's `FIREBASE_PROJECT_ID` and `FIREBASE_DATABASE_ID` target the exact intended project and named database, and that the service account has access to that project/database.
4. Redeploy the root project.
5. Open `/api/health` on the deployed domain. Confirm `firestoreConnected: true`, the expected `projectId` and `databaseId`, and sensible collection counts.
6. Open the website and verify existing apartment, room, tenant, billing, ledger, and maintenance records.

## Safety
This change does not copy, merge, delete, or reset existing Firestore records. It removes automatic import of local `data.json` into Firestore. If records are already split between two databases, this update will not merge them; first identify which database contains the authoritative records and perform a reviewed, backed-up migration only if needed.

## Validation performed
TypeScript syntax checks and ZIP integrity checks are performed for the modified files. A live production build and live Firebase/Vercel integration test must still be run in the deployment environment.
