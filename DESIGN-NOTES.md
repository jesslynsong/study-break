# Doodle café redesign

Inspired by the user's café mobile-screen references: cream paper, cobalt ink, loose doodles, small muted coral accents and friendly handwritten headings. The reference screenshot and video are not distributed with the website.

## Artwork

Mode: built-in image generation tool; new original illustration, transparent background. No CLI/API fallback was used. The generated alpha was preserved.

Final website asset: public/assets/study-break-doodle.png (1536 × 1024 RGBA). This asset is included in this source archive and copied to the user's Desktop project. The small cup, map-pin, clipboard, heart, book and star icons are editable inline SVGs, authored for the website.

Final generation prompt:

> Create an original website hero illustration in a charming hand-drawn cafe-menu doodle style. Two small friendly cats with simple rounded bodies and naive, slightly wonky faces are taking a study break: one holds a large takeaway bubble tea cup with a straw and round tapioca pearls, the other leans on a small stack of two study books. A few sparse hand-sketched stars, a little heart, and two tiny floating pearls surround the pair. Use loose, irregular single-line blue ink, color #1765A6, with a few very small muted red #C7695D accents. The drawings should look casually made with a felt-tip pen by a human: imperfect lines, airy composition, minimal detail, flat line drawing, very little fill. The aesthetic is a cute cream-and-cobalt Asian cafe mobile menu. Keep all figures fully in frame, balanced as one compact centered group, with generous empty space. No words, no lettering, no logos, no UI, no rectangular page, no shading, no gradients, no photorealism, no 3D, no drop shadow. Transparent background. A standalone finished illustration asset, not a mockup.

## Typography and motion

Kalam regular and bold are self-hosted in public/assets/fonts/ under the SIL Open Font License. Licence: public/assets/fonts/OFL-Kalam.txt. Source: https://github.com/google/fonts/tree/main/ofl/kalam . Body text and door controls keep a clear system sans-serif font. The gentle illustration movement is disabled when reduced motion is requested.

## Implementation

The theme is in public/doodle.css, loaded after the base styles. Existing form field IDs, API routes, organiser code, server store name, event key and data format remain unchanged. Blue-and-cream styling also covers the native form fallback page and the installable icon. Service-worker cache v4 refreshes the application shell without caching private or live API data.

## Reference layout rebuild — version 2.2, 15 November 2026

The page structure now follows the supplied café app screens: compact brand header; centred doodle artwork and wordmark; a three-column blue icon menu with dashed dividers; a small blue public-status strip; cream cards over a pale-blue gradient; a blue tea-stash card with a row of cup doodles; and fixed bottom navigation for Home, I’m coming and Team. The previous broad two-column marketing hero is replaced. No new artwork generation was used for this revision.

The app fills the screen on phones and stays at a maximum width of 480px on larger displays. The header stays visible while scrolling; anchor spacing accounts for it. Bottom padding and safe-area insets prevent the fixed menu covering the last content. Inputs use 16px text to avoid automatic iOS zoom, and the primary controls have at least 44–48px touch heights. The narrow 320px viewport was also checked. Data and organiser access use the unchanged shared backend. The native form fallback remains styled.

## Navigation simplification — version 2.2.1, 15 November 2026

At the owner’s request, the top-right Team control is the only organiser-desk link. The blue shortcut panel now contains only I’m coming and Find us, arranged as two equal columns. The fixed bottom Home / I’m coming / Team menu and its reserved bottom space were removed. Organiser sign-in remains required for the live dashboard; this is a navigation change, not a change to authorisation. The application-shell cache is v6.

## Event and host identity — version 2.2.2, 15 November 2026

The host is NUS Students’ Computing Club. The event is Study Break. The top-left brand displays the club name over two lines, and the illustrated cover displays Study Break. Browser titles, confirmation-page labels, metadata and the installable app name use the corrected event name. Storage keys and legacy backup schema identifiers remain stable for compatibility with existing records.
