# FieldPulse Lite Android Compatibility

FieldPulse Lite supports Android phones through the local worker web app and PWA-ready frontend. This keeps the app local-first: the Windows PC runs the backend and SQLite database, and phones submit worker logs to that PC over the local network.

## Supported Android path

1. Install and open FieldPulse Lite on the Windows PC.
2. Keep the PC and Android phone on the same Wi-Fi network.
3. On the PC, open the setup page and scan the worker QR code with the phone.
4. Open the worker page in Chrome on Android.
5. Use Chrome's menu to choose **Add to Home screen**. Chrome may show **Install app** when the page is served from an origin it treats as installable.

The phone interface is the same worker UI at `/worker`. It is touch-friendly, home-screen friendly, and can queue a submission locally when the API is temporarily unreachable after the page has loaded.

## What stays on the PC

- SQLite data
- Uploaded photos
- Editable `.env` settings
- ClickUp API token and list ID
- Email/SMTP settings
- Desktop and backend logs

Android phones only call the backend API. ClickUp secrets are never placed in frontend code or the PWA manifest.

## Network requirements

- PC and phone must be on the same non-guest Wi-Fi network.
- Windows Firewall must allow FieldPulse Lite on the private network.
- If the default backend port is busy, the desktop app automatically tries the next port. Use the QR code on the setup page because it reflects the active port.

## PWA and native APK status

The current Android compatibility target is the local web app plus home-screen/PWA readiness, not a Play Store APK. That is the smallest reliable path because it preserves the local SQLite backend on the Windows PC and avoids putting backend secrets on the phone.

Over plain local-network HTTP, Chrome can still open the worker page and create a home-screen shortcut. Full service-worker-backed PWA install behavior can depend on whether the browser treats the origin as secure, so the reliable Android MVP is the local worker page plus home-screen shortcut.

A later native Android wrapper is possible with a WebView/Capacitor shell, but it would still need to point at the PC backend or a hosted backend. Building a fully standalone Android app with its own SQLite database and sync engine would be a larger product track.
