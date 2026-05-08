# TestMail Lens

Frontend-only TestMail inbox viewer for temporary email testing. Paste your TestMail API key and read messages directly in the browser. No backend, no server storage.

Live site: https://astroisback.github.io/testmail/

## Highlights
- TestMail inbox viewer with a clean split layout and message preview.
- Frontend-only fetches; your API key stays in the browser.
- Monochrome mode toggle and raw JSON inspector.

## Usage
- Open the site and paste your TestMail API key.
- Provide your TestMail namespace (required).
- Optional: add the email address or a tag if you want to target a specific tag.
- Click "Fetch inbox" to load messages.

## Notes
All requests go directly from your browser to the TestMail API. No backend is used.