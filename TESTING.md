# Upgrade verification — 13–14 November 2026

19 automated tests pass, including the production-style server-only code verifier. Netlify's function packager builds the server function successfully with its /api/* route. The packaged function was also started from an isolated extracted archive to confirm its storage-library imports are present.

Observed in the local browser against isolated preview data:

- An interest response saved and appeared as interested = 1, with arrivals = 0 and cups = 0.
- The live dashboard required an organiser code. Opening check-in required confirmation.
- A cup check-in produced a saved confirmation, arrivals = 1 and cups remaining = 149.
- A separate public browser tab showed 149 cups remaining from the same shared preview service.
- The dashboard fit a 390-pixel phone viewport (375-pixel content width with scrollbar) without horizontal overflow.
- Stopping the preview server disabled live check-in and undo, and changed the public banner to unable to confirm stock.
- Practice remains separate and the event starts paused. Earlier interest reconciliation is explicit.

Concurrent final-cup and lost-confirmation cases are covered by backend tests using competing conditional writes. No sample preview data has been copied to the production store.

Production checks passed on 14 November 2026:

- The public /api/status endpoint returned HTTP 200, phase before, and 150 cups remaining.
- Unauthorised /api/admin returned HTTP 401.
- The protected dashboard returned HTTP 200 with the owner's private code, and displayed in the real browser.
- Shared storage saved the already-paused state and safely replayed the identical request without a second update. No attendees, interest responses or cups were added.
- The published page displayed the public pre-event banner and the COM1 building address, map link and foyer guide.
- The live dashboard showed 0 new interests, 0 arrivals and 0 cups given. Earlier Netlify interest reconciliation remains explicitly unconfirmed; the organiser must enter that genuine subtotal or confirm 0.
- Browser sign-in was tested, the screenshot was saved without the private code, and the browser was signed out afterwards.

Interest receipt and automatic public cup changes were tested end-to-end in the isolated local preview. The real event was not opened or seeded with dummy interest or arrival records to reproduce those tests in production.

## Doodle redesign — 14 November 2026

All 19 automated tests pass after the visual update. Browser checks confirmed the original cat illustration and self-hosted Kalam font load on the live site. The 390-pixel phone viewport has a 375-pixel content area and no horizontal overflow. The illustrated directions, public form, and organiser practice counter render correctly. In isolated local preview, a nickname response saved successfully; a practice cup check-in showed 1 arrival and 149 cups left. No preview records were sent to production.

After deploy 6af802e59c42608e7abb3b5e, the real public API returned 200 (before, 150 cups remaining), unauthorised admin access returned 401, and authorised read access returned 200 (0 new interests, 0 arrivals, 0 cups given; earlier-interest subtotal still unconfirmed). Production data and the owner code were preserved. The service-worker shell cache is version 4 and includes the new theme, illustration and fonts; API requests remain excluded.

## Reference layout rebuild — 15 November 2026

All 19 automated checks passed after the markup and navigation update. Browser observations:

- The reference-style layout has a compact cover, blue icon menu, separate cream cards, blue gradient background and fixed bottom menu.
- At 320px and 390px viewport widths, there was no horizontal overflow (305px and 375px content width with the browser scrollbar).
- A tablet-size 768px viewport kept the app at 480px wide with no overflow. The default desktop view uses the same centred app frame.
- No duplicate HTML IDs or unresolved in-page anchors were found.
- In the isolated local preview, the rebuilt form accepted a nickname and displayed saved confirmation.
- The mobile practice button produced 1 arrival, 149 cups left and a saved confirmation. Practice and preview data were not copied to the event.
- The bottom navigation opens the public form and volunteer desk and marks the selected destination.

Production deploy: 6af95635e88314ea3f9da809. Live read-only checks returned public status 200 (before; 150 cups), unauthorised admin 401, and authorised admin 200 (0 new interests, 0 arrivals, 0 cups given; earlier-interest reconciliation still unconfirmed). The published mobile view loaded its artwork and fonts with no horizontal overflow at 390px. No production records were added. The application-shell cache is v5; API traffic remains excluded.

## Navigation simplification — version 2.2.1, 15 November 2026

The updated route module passed its JavaScript syntax check. Static validation and the real published browser both confirmed exactly one link to the organiser desk, inside the top-right header; no bottom navigation bar; and two equal-width public shortcuts. The top-right control opened the volunteer desk, and its Event page link returned to the public page. The 390px phone view had no horizontal overflow. No production event records were added. This small navigation update did not change server code or data rules, so the existing backend tests were not rerun.

Successful deployment: 6af98a25889afe3924cb6d40. Application-shell cache: v6.

## Corrected event identity — version 2.2.2, 15 November 2026

Verified on the live website: the top-left host label reads NUS Students’ Computing Club and the main event heading reads Study Break. The browser title uses Study Break. The 390px phone view has no horizontal overflow. Static checks confirmed the corrected confirmation page and installable-app name, and the route module passed its syntax check. Only copy and branding styles changed; server data, storage keys and legacy backup schemas were preserved. No production records were added.

Successful deployment: 6af9ad089035a30744aea22f. Application-shell cache: v7.
