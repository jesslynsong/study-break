# Study Break — café app layout

Hosted by NUS Students’ Computing Club. The event is named Study Break.

Version 2.2.2 keeps the compact café-app layout with an illustrated cover, a blue two-icon menu and cream cards over a pale-blue gradient. The organiser desk is linked only from the top-right Team control; the bottom navigation bar has been removed. It uses one column on phones and a centred 480px app frame on larger screens. The optional interest form, shared dashboard, public cup status and COM1 directions remain functional. See DESIGN-NOTES.md for layout decisions, the existing artwork prompt and font licence. The event date remains unconfirmed and 7–9 pm remains tentative.

## What people can do

- Students submit optional interest with a name or nickname. This estimates food needs and never reserves a cup.
- Students see a public availability banner: not open yet, available with a cup balance, sold out, event ended, or unable to confirm stock.
- Students can open the COM1 building in Maps and follow a short arrival guide. The pin identifies the building; the exact table position and entrance arrangements are still for organisers to confirm.
- Organisers use the password-protected live dashboard at /#door. It shows interest, actual arrivals, cups given and cups left separately.
- Authorised volunteers can check people in from multiple connected devices. Cup 151 is blocked by the shared backend, including simultaneous requests.
- Practice mode is isolated and works without the live service. Practice never changes the public balance.

## The important change from the old version

Live data is now held centrally by Netlify Functions and Netlify Blobs. Live check-in requires a connection. Offline check-ins pause, and the public banner stops claiming stock is available if a fresh check fails. Do not use independent offline counters for the same stock. If the network fails at the door, keep a paper tally and reconcile before resuming.

The older Netlify Forms list remains in the owner's account. New responses go directly to the shared event backend so they appear in this dashboard without a separate form-detection setting. Existing response receipts in students' browsers are preserved to discourage duplicate submissions.

## First organiser setup

1. Publish the complete project with its server function. Uploading only public/ to Netlify Drop is no longer sufficient.
2. Keep the owner's separate private access file. Publication generates a one-way SHA-256 verifier from the random organiser code and packages that verifier only in the server function. The plaintext code must never go in public files, Git, a source ZIP, a URL, or screenshots. No Netlify runtime environment setting is required for organiser sign-in.
3. Open the final site's /#door page, choose Live dashboard, and enter that code. It is kept in the current tab's session storage until sign-out or the tab closes. Share it only with organisers, and sign out on borrowed phones.
4. Under Earlier interest responses, enter the genuine verified count from the older Netlify form, excluding tests and duplicates. Confirm 0 if there were none. Until reconciled, the interest total has a + suffix and explicitly says earlier responses are not included.
5. If real arrivals were already recorded by the previous phone-only version, export its JSON backup before doing anything else. The new dashboard can import a version-1 door backup only while the shared arrival counter is empty. Previous browser records remain intact and are never merged or erased automatically.
6. Leave the event paused before event night. When the team is ready, use Open check-in. This also activates the public cup balance.

Opening, pausing and closing the event all have confirmation dialogs. Closing also closes new interest collection. Pausing keeps interest open. There is no one-tap live reset.

## At the door

1. Try practice mode before starting your shift.
2. Sign in to Live dashboard and confirm the event is open.
3. Tap once per person. Use Check in + give a cup or Check in · no cup.
4. Hand over a cup only after Saved online confirms it. Mark a wrist or hand to prevent repeat claims; the app does not collect attendee identities at check-in.
5. If a request loses confirmation, use Retry the same action safely. That retry uses the original operation reference and cannot add another arrival or cup if the first attempt was already saved. An unconfirmed action survives a reload in the same tab where browser session storage is available.
6. Undo only the latest check-in. Only restore a cup to stock if it was never handed out or has been physically returned. A stale undo from a different phone cannot remove a different person's entry.
7. Download a private backup at shift changes. Interest CSV exports contain names; keep them with organisers. Full shared JSON backups are archives for recovery by the site maintainer. The app only imports the older version-1 arrival format into an empty counter; it does not restore an entire shared archive or merge event databases.

## Storage and consistency

The store name is study-break-event-v2 and the event key is study-break-night. It is project-scoped and persists across deployments; it is not a deploy-specific store.

Every write uses a strong read and a conditional write against the read ETag. A conflict re-reads and re-applies the rules. Creating the first event uses onlyIfNew. This prevents two phones from both issuing the last cup and prevents simultaneous interest writes from overwriting one another. Event operations have durable unique references so safe retries are idempotent. The service assigns timestamps; it does not trust an attendee's clock for new live records.

Only the public stock summary is readable without an organiser code. Names, attendance details, exports, event controls and check-in writes require the owner code, checked against its server-only one-way verifier using a constant-time comparison. The generated owner code has 256 bits of randomness. Its plaintext is not sent in URLs or embedded in a browser JavaScript bundle. Responses use no-store headers; the service worker bypasses all /api/ traffic and never caches private dashboard data.

The public banner checks about every 15 seconds while visible, plus manual refresh and reconnection. It is a recent snapshot, not a reservation or a guarantee that a cup will still be there on arrival. A failed refresh changes the banner to unable to confirm stock; it never intentionally falls back to a cached green status.

## Limits and failure cases

| Situation | Behaviour |
| --- | --- |
| Network or shared storage unavailable | Live writes are unconfirmed or paused. Do not issue a cup based on an error. Retry the same request after reconnecting. |
| Lost response after the server saved | Retry with the same reference. The server returns confirmation without double-counting. |
| Someone uses a second browser to express interest again | There is no identity verification. Review duplicate nicknames; interest remains an estimate. |
| A volunteer counts someone twice or misses a person | Human error still needs reconciliation. Use a hand/wrist stamp and latest-entry Undo. |
| Older Netlify interests exist | Enter their genuine subtotal explicitly; it is shown separately from new responses. Names in the old form are not automatically copied into the new store. |
| Older phone arrivals exist | Preserve the old backup. Import once into an empty shared arrival counter; stop using the old counter. |
| Organiser code is shared or lost | The site owner must generate a new private code and republish, which regenerates the server verifier. Sign out on borrowed devices. |
| Requests conflict continuously | After bounded retries, the app asks the volunteer to retry the same action. It never deliberately over-allocates cups to keep the queue moving. |
| Event data is damaged | The backend fails closed instead of silently resetting to zero. Recovery uses an organiser archive and the site maintainer. |
| Free hosting allowance is exhausted | Netlify may pause service; the website does not configure paid upgrades or automatic top-ups. Use the existing free plan's included allowance and review account usage. |

The event has a 150-cup hard limit, a 5,000-new-interest safety limit, a 5,000-earlier-interest subtotal limit, and a 30,000-operation history limit. These fit this one event. There are no automated Telegram messages, authenticated attendee identities, online cup reservations, event-series management or automatic interest cancellation.

## Local preview and tests

Install Node.js 20 or newer and the dependencies, then run:

    npm install
    npm start

Open http://localhost:4183 . The local server uses isolated in-memory demo data, never the production event. Its organiser code is local-preview-organiser-code-2026. Restarting the server resets that preview. This development-only code is not accepted by the production function.

Run the tests with:

    npm test

The automated tests cover capacity, concurrent last-cup claims, idempotent retries, protected data, old-backup imports, prior-interest reconciliation, native form fallback, CSV escaping, storage failure and service-worker exclusions. See TESTING.md for actual browser observations.

## Repository and publishing access

This repository contains source code only. Live event records, interest names, private backups, Netlify login credentials and the organiser code are not included. The checked-in server/access-verifier.mjs is an unconfigured placeholder; the existing deployed website keeps its own verifier. Local preview works without production credentials.

To publish from this clone, use the owner’s existing private organiser code with the documented publish script. It regenerates the private server verifier before uploading. Keep that code outside Git, and do not configure automatic deployment from this repository without arranging the private access setup first.

## Publishing to the existing Netlify project

Keep the same site, gilded-liger-22b522, and its address. The project includes a dependency lockfile, netlify.toml and netlify/functions/event.mjs. Authorise the official Netlify publishing tool and link this existing site. The publish script takes the private owner code from ORGANISER_KEY in your local process, or from a private .cache/organiser-code.private.txt file containing just the code. It regenerates the server-only verifier before publishing. The private code file is excluded from source archives.

    npx netlify login
    npx netlify link
    npm run deploy

Never deploy the in-memory preview server as production storage, and never upload only public/ and assume the online features have been deployed. Netlify's production build publishes the function and static assets together. The pnpm workspace uses a hoisted dependency layout so the storage library is packaged correctly on Windows. Verify /api/status returns JSON and test the protected dashboard after publication. Start the production event paused. The successful deployment and verification are recorded in DEPLOYMENT.md.

## References

- Shared storage and atomic writes: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- Publishing functions: https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/
- COM1 address, checked against NUS Computing: https://www.comp.nus.edu.sg/studentlife/
