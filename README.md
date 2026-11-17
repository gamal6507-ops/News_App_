# Al Akhbar

A Flutter news application for web and mobile, with Arabic/English support,
Firebase authentication, headline categories, search, saved articles, and themes.

## Local development

Use Flutter 3.50.0 and Node.js 24 or newer. Create an ignored `.env` file with
`NEWS_API_KEY` and, for mobile Google sign-in, `GOOGLE_WEB_CLIENT_ID`.
Firebase client configuration is in `lib/firebase_options.dart`.
The web app uses `news-app-five` via `lib/firebase_web_options.dart`.
Native apps retain their existing Firebase project. Accounts are specific to
each project and are not transferred automatically.

```sh
flutter pub get
flutter run -d chrome
flutter test
flutter analyze --no-fatal-infos
```

Local web uses the NewsAPI key from `.env`. Production web uses the same-origin
`/api/news` server function. Set `NEWS_API_KEY` in Vercel Production and Preview.

## Web deployment

`vercel.json` builds from source using `scripts/vercel-build.sh` and serves
`build/web`. Connect the GitHub repository to Vercel for automatic deployments.
The build pins Flutter, temporarily empties the `.env` asset, and removes its
generated public copy. Never upload real environment files.

Verify the same build locally with `node scripts/build-web.cjs`.

Authorize the production hostname in Firebase Authentication and enable Google
sign-in. Native notification scheduling is mobile-only; the web retains the
in-app notification list.

## Validation

```sh
flutter test
node --test test/api_news_test.cjs
flutter analyze --no-fatal-infos
node scripts/build-web.cjs
```

Flutter 3.50 reports informational deprecations for legacy Material imports.
They do not prevent builds; migrating these imports is a separate update.
