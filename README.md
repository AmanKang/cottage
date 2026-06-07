# Cottage Weekend

Static GitHub Pages app for the June 26-29, 2026 cottage trip.

## What it includes

- Trip summary, Airbnb link, Google Maps link, and copyable cottage address.
- Collapsible grocery checklist with categories.
- Editable travel and departure timeline with add/remove travel rows.
- Editable meal slots with click-to-assign chef, helper, and cleaners.
- Firebase Firestore persistence when configured.
- LocalStorage fallback when Firebase config is blank.

## Firebase setup

1. Create a Firebase project.
2. Enable Firestore.
3. Create a web app in Firebase project settings.
4. Copy the web app config into `firebase-config.js`.
5. Publish `firestore.rules` in Firebase.

The Firestore rules intentionally allow public read/write access only under:

```text
trips/cottage-2026/**
```

This is deliberate for a short-lived shared trip page where anyone with the URL can edit. Delete or lock the Firestore data after the trip.

## Local preview

You can open `index.html` directly, or run a tiny local server:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

With blank Firebase config, edits persist in your browser's localStorage only.

## GitHub Pages

1. Push this repository to GitHub.
2. Open repository settings.
3. Go to Pages.
4. Set source to deploy from the root of the main branch.
5. Open the generated GitHub Pages URL.

No build step is required.
