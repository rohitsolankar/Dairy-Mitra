# Solankar Dairy – Smart Dairy Manager

A responsive installable web app for dairy farmers, built with HTML, CSS and JavaScript. It supports local-first records, optional Firebase account sync, milk entries, feed expense entries, 15-day reports and CSV/PDF export.

## Run locally
Because `app.js` uses JavaScript modules, run the folder through a local web server (not by double-clicking `index.html`). For example:
- VS Code: install Live Server and open `index.html` with Live Server.
- Or use any static hosting provider.

## Enable optional cloud account / phone transfer
Without Firebase configuration, the app works in local-only mode. Data is stored in this browser's local storage. To sync records between phones:

1. Create a project at https://console.firebase.google.com/
2. Add a Web App and copy its Firebase config.
3. In **Authentication → Sign-in method**, enable **Email/Password**.
4. Create a **Firestore Database**.
5. Replace the placeholder values in `app.js` under `firebaseConfig`.
6. Publish the app on an HTTPS host (Firebase Hosting, Vercel, Netlify, etc.).
7. In Firebase Firestore Rules, use this owner-only rule:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /dairies/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

8. Open the hosted app, choose **Account → Create account**, and use the same email/password on a new phone. After signing in, the app loads and syncs the account's dairy data.

**Important:** Do not publish with open Firestore rules. Keep the Firebase config in the app and secure data with Authentication + the owner-only rule above.

## Data safety
- Local records persist in the current browser.
- Export backup regularly from History.
- Import merges records by record ID and keeps existing records.
- Deleting an individual record is available only after confirmation.
- Signing out does not delete local or cloud records.
- Cloud sync is optional and requires Firebase setup.

## Notes about calculations
- Milk sale = litres × rate per litre.
- Blank milk rate is not treated as zero; the report marks sales incomplete if any milk record in the period has no rate.
- Feed entries collect only a feed name and optional total price; no feed quantity is requested.
- Net = milk sales − recorded feed prices. If any feed price is missing, net is marked incomplete.
- The current report covers today and the previous 14 calendar days.

## Deploy
Upload the complete folder contents to your static host. Keep `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest` and `icon.svg` together. Use HTTPS for installability and Firebase authentication.
