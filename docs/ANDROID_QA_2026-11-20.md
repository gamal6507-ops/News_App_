# Android follow-up QA — 20 November 2026

## Corrections

The Android manifest omitted the scheduled-notification receiver and reboot/package-update receiver required by flutter_local_notifications 19.5.0. Both receivers are now registered and non-exported. The reboot receiver includes boot and package-replacement actions.

The application uses `inexactAllowWhileIdle` for its 24-hour inactivity reminder. It no longer declares or requests special exact-alarm access.

These changes follow the [installed plugin version's Android setup documentation](https://pub.dev/packages/flutter_local_notifications/versions/19.5.0#androidmanifestxml-setup).

## Automated coverage

Direct NewsAPI requests returned zero Egyptian headlines during this review. Native and local web clients now use the existing production news service, including feed and image fallback. Deployed web continues using its own origin. The API key and `.env` asset have been removed from client initialization and packaging; the server keeps its own credentials. Native Google configuration can still use a public `GOOGLE_WEB_CLIENT_ID` compile-time override.

- Two configuration regression tests fail against the original manifest/service and pass with the correction. The Node suite passes 31 tests, including cross-origin news access limited to local web development origins.
- The complete Flutter unit/widget suite passes 36 tests, including a new native request-routing regression. Analyzer output contains 57 informational notices, with no errors or warnings.
- All three native integration tests passed on the Android emulator. They retrieved Egyptian news and a real image, initialized Firebase and the Google SDK using Android configuration, and scheduled, listed and canceled the application reminder through the Android notification plugin.

Run the native tests with a booted Android emulator or connected Android device:

```powershell
flutter pub get
flutter test integration_test/native_services_test.dart -d <android-device-id> --no-pub
```

The integration tests do not sign in to a Google account, grant notification permission, send remote push messages or wait 24 hours for the reminder. They use an isolated temporary Hive directory and cancel their scheduled reminder during cleanup. Run them on a test emulator/device without an existing application reminder, since they exercise the application's reminder ID.

## Environment and limits

An existing Android 36.1 emulator with Google APIs/Play Store image was cold-booted headlessly for this follow-up. An initial compilation attempt encountered a shared Flutter SDK Kotlin incremental-cache error. A retry built the test APK successfully with process-scoped Kotlin settings, but installation failed because the emulator data partition was almost full. A separate workspace-owned AVD with an 8 GB data partition was then created; its guest filesystem had 6.9 GB available. The original emulator data, SDK caches and global Gradle configuration were preserved. Unit tests were rerun successfully with a workspace-local temporary directory after a compiler temporary file disappeared during an earlier attempt.

Android Firebase remains `alakhbar-5f66d`, preserving the earlier decision to migrate only web to `news-app-five`. The downloaded Android configuration contains a web OAuth client; successful initialization does not establish that package/signing-certificate registration is correct for a full Google sign-in.

Full Google account authentication, remote push delivery, notification display/permission behavior, reboot delivery and OEM background restrictions still need separate runtime acceptance checks. The generated APK is a debug build; Play Store signing/release publication is outside this validation.
