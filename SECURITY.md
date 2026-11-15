# Security and public-sharing review

Review date: **15 November 2026**. This is a scoped source/history review and automated dependency check, not a penetration test or a guarantee that the application has no vulnerabilities.

## Public repository boundary

The repository contains application source, test fixtures, documentation, and visual assets. The checked-in organiser verifier is **null**. The live organiser code, production verifier, hosting credentials, interest responses, arrival records, and private backups are not included.

The development-only preview code and test codes are fixtures. They grant no access to the deployed event. The preview uses isolated memory and does not connect to production storage.

## Checks performed

- Reviewed all eight existing commits and all 39 unique historical file blobs for the known live organiser code and production verifier, common credential formats, private keys, local credential directories, and exported records. No matching production secrets or private event records were found.
- Reviewed organiser authentication, public status fields, private exports, input handling, and API cache exclusions. Read-only live checks returned public status 200, unauthenticated organiser/dashboard/export responses 401, and private server-file requests 404. No production records were created.
- Confirmed that the public interface renders submitted names as text rather than executable HTML.
- Added ignore rules for local keys, private exports, logs, and local databases.
- Updated the publishing helper to restore the repository verifier placeholder after a successful or failed publishing process, and to redact the supplied code from captured output. Tests exercise both outcomes with a fake CLI, without publishing a real event.

Git author identities are public metadata. The original commits contain the account's configured author email. The repository owner reviewed this finding and chose to keep the existing author email public. No email address is reproduced in this document.

## Access controls

Live organiser reads, writes, and exports require the private organiser code. Public stock status exposes event phase and cup availability, not names or arrival logs. Missing organiser setup fails closed. The shared store applies revision checks before accepting writes; client-side buttons are not the only cup-limit enforcement.

The service worker bypasses `/api/` and `/.netlify/` traffic. API responses request no caching. An offline live dashboard pauses counting instead of creating a separate cup balance.

## Dependency audit

The publishing tool was updated to **Netlify CLI 27.19.0**, the current supported release checked during this review.

The registry audit reports **no known production-dependency advisories**. The full development-tool tree still reports the following transitive advisories; no high or critical advisory was reported:

| Package | Severity | Scope and advisory |
| --- | --- | --- |
| deepmerge | Low | Development publishing/configuration tooling; [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). The registry lists no published fixed version. |
| glob | Moderate | Development packaging tooling; [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). The supported CLI dependency tree still resolves an affected major version. |
| minimatch | Moderate | Development packaging tooling; [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). The supported CLI dependency tree still resolves an affected major version. |

These are recorded rather than hidden with audit exceptions or forced, unverified major-version overrides. Use trusted source when running publishing tools, and re-run the audit when updating dependencies.

```sh
pnpm audit --prod
pnpm audit
```

## Remaining application limits

- The public interest endpoint is intentionally open. Validation, a honeypot, idempotent references, and a response limit are not a full anti-spam service. Nicknames can be duplicated across browsers; a larger or hostile deployment needs host-level abuse controls.
- Organiser access uses a shared code, with no individual volunteer accounts or per-user audit trail. Rotate it if it is disclosed, and sign out on borrowed devices.
- The code is stored in the current tab's session storage after sign-in. Protect the device and keep third-party scripts out of the page.
- The publishing cleanup runs when the process can finish normally. After a forcibly terminated publishing process, review the working tree before committing.

For deployment and event-night procedures, see [the organiser guide](docs/OPERATIONS.md).
