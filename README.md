# SmartBuddy

A lightweight, offline timetable app for Android and iOS. Upload a weekly calendar PDF, review detected classes, and schedule local notifications five minutes before class.

## Features

- PDF import runs entirely on the device with a bundled PDF.js worker. No server, account, API key, or external upload.
- Reads dated columns, class names, venues / MS Teams, and times from colored calendar blocks. Tested against the supplied scheduler.pdf: all 24 classes, including Monday 09:00–09:55 and Tuesday Backend Development 14:00–15:55.
- Editable import preview before replacing dated classes in the PDF's date range. Merge is also available. Weekly repeating entries are kept. Duplicate dated entries are skipped.
- Today, week, and all-class views; manual add/edit/delete; specific dates or weekly repeats; optional course code, faculty, and online link.
- Timetable saved locally with Capacitor Preferences. Existing browser localStorage schedules migrate automatically.
- Native local reminders five minutes before class, including offline and while closed. Edits/deletions rebuild pending reminders. Permission and scheduling failures are shown.
- CSV import and backup. Native backup uses the phone share sheet; browser backup downloads a CSV. Optional metadata is retained.

## Preview

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

The browser is a timetable preview. Background phone notifications require the native Android or iOS app. Native app assets are bundled; no network is needed after installation. PDF code loads only during import to keep the timetable fast.

## Build for phones

Android and iOS projects are included. After every web change:

```sh
npm run sync
```

Android: install Android Studio and its Capacitor 8 compatible JDK/SDK, run `npm run android`, then build/run on a phone. Allow notifications and enable **Alarms & reminders** when asked.

iOS: use a Mac with Xcode, run `npm ci`, `npm run sync`, then `npm run ios`. Choose a signing team and run on an iPhone. Allow notifications. The default app ID is `com.smartbuddy.timetable`; set a unique production ID and signing configuration before distribution.

No signed APK, IPA, or store release is included. Native projects have been generated and synced; actual device builds and reminder delivery need device verification.

## PDF import

Tap **Upload PDF**, select the calendar export, and enter the timetable year. Review detected rows, then tap **Update timetable & reminders**. Imports are date-specific so changes in one week do not silently repeat forever.

The reader supports text-based, colored weekly calendar exports with day/date columns and a time axis, matching the supplied PDF. Scans, photos, arbitrary tables, and other layouts are not supported yet. Failures keep existing data. Full names embedded in a PDF may be recovered even if visually clipped; absent information cannot be reconstructed. End times are inferred from block heights and rounded to five minutes, so the preview labels them as estimated. Partial detections are reported.

## CSV format

```csv
Day,Start,End,Subject,Room,Date,CourseCode,Faculty,Link
Monday,09:00,09:55,Example class,Room 102,2026-11-02,,,
```

The original five-column format and six-column dated format are also supported. Leave Date blank for weekly repeats. Use `YYYY-MM-DD` and 24-hour times. End time must be later on the same day. Quoted names containing commas are supported.

## Reminder behavior

- Weekly classes use repeating OS calendar requests, one per class, rather than a finite rolling window.
- Dated triggers already in the past are skipped; no late alerts are generated.
- At most 64 pending requests are scheduled. Excess classes produce a visible warning; reduce the active schedule to cover all classes. Reopening the app refreshes permissions and schedules.
- Times use the phone's time zone. Reopen after changing time zones or permissions.
- Android requires exact-alarm permission. OS battery settings, Do Not Disturb, force-stop, and notification settings can affect delivery. Closely spaced Android reminders may be limited during Doze.
- Export a backup before uninstalling; uninstalling removes local data.

References: [Capacitor local notifications](https://capacitorjs.com/docs/apis/local-notifications), [PDF.js](https://mozilla.github.io/pdf.js/).

## Validation

`npm test` covers five-minute timing, weekly repeats, midnight rollover, skipped past triggers, capacity warnings, CSV handling, date/time validation, and next-week rollover. `npm run build` produces production assets; `npm run sync` updates both native projects.

Mobile browser verification imported all 24 classes from the supplied PDF, checked 09:00–09:55, saved classes, and retained them after reload. Production browser checks block external network requests to verify bundled PDF assets. Phone notification delivery, reboot behavior, signing, and store distribution remain device acceptance checks.
