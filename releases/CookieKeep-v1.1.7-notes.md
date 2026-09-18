## CookieKeep v1.1.7

### Improvements

- Added recent-cookie dry runs and confirmed cleanup for the last 1, 2 or 24 hours, using changes observed by CookieKeep. Cookies with unknown age are excluded.
- Separated automatic scheduling and recent cleanup into independent responsive dashboard cards.
- Arranged Dry run, Clean selection and Clean all together; Clean all ignores the recent interval and preserves protected cookies.
- Added direct GitHub repository links beside dynamic manifest-version metadata in both popup and dashboard headers. Links open only when clicked.
- Polished the popup with an explicit two-line tagline and removed the unnecessary HTTP/HTTPS compatibility badge.

### Installation

1. Download and extract `CookieKeep-v1.1.7-chromium.zip`.
2. Open `chrome://extensions` or `edge://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.

### Integrity

SHA-256:

`8533D01D3322B0E4A4CE6E00B0619216A0B5D9E32669892E77D1945E45B5156C`
