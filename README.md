# Al Akhbar

**Flutter news-reader application** with headline feeds, categories, regional news selection, article details, live search, bookmarks, light/dark themes, and English/Arabic support.

**Explore:** [Live web demo](https://news-app-five-kappa-90.vercel.app/) · [12-screen portfolio gallery](https://ahmed-gamal-portfolio-alpha.vercel.app/#work)

> **Demo note:** The web application requires sign-in. News images and articles are fetched from third-party services; publisher availability and image access can vary.

**Core technologies:** Flutter, Dart, Firebase Authentication, Vercel news API.

---


A Flutter news application for web and mobile, with Arabic/English support,
Firebase authentication, headline categories, search, saved articles, and themes.

## Local development

Use Flutter 3.50.0 and Node.js 24 or newer. Client builds need no `.env` file or
NewsAPI key. If a native Google web client override is needed, pass its public ID
with `--dart-define=GOOGLE_WEB_CLIENT_ID=...`; Android otherwise uses its Firebase
configuration.
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

Production web uses the same-origin `/api/news` server function. Native and local
web builds use the production news service. Set `NEWS_API_KEY` only in Vercel
Production and Preview. When moving the service, update `ApiConstants.baseUrl`.

The deployed API falls back to Bing News RSS if NewsAPI is unavailable,
unconfigured, or has no matching news, with Google News RSS as a final fallback.
Bing supplies article thumbnails and original publisher links. The fixed-host
`/api/news-image?id=...` proxy serves image bytes from Bing to avoid browser image
CORS restrictions; it rejects arbitrary URLs, redirects, non-image bodies, and
responses larger than 2 MB. Its generated URLs default to the production domain;
set `PUBLIC_APP_ORIGIN` when moving the app to another domain.

Regional headlines, categories, and search use the existing JSON format. Feed
results have finite pagination. Images and full text can still be absent for
individual stories, which use the existing placeholder. Date/language/source
filters are applied to fallback search; relevance and popularity follow feed
ordering. Native builds use the same server fallbacks and image proxy as web.

## Web deployment

`vercel.json` builds from source using `scripts/vercel-build.sh` and serves
`build/web`. Connect the GitHub repository to Vercel for automatic deployments.
The build pins Flutter. No client build declares a `.env` asset, so news provider
credentials remain on the server. Never upload real environment files.

Verify the same build locally with `node scripts/build-web.cjs`.

Authorize the production hostname in Firebase Authentication and enable Google
sign-in. Native notification scheduling is mobile-only; the web retains the
in-app notification list.

## Validation

```sh
flutter test
npm ci --ignore-scripts
npm test
flutter analyze --no-fatal-infos
node scripts/build-web.cjs
```

Flutter 3.50 reports informational deprecations for legacy Material imports.
They do not prevent builds; migrating these imports is a separate update.

---

## Developer & contact

**Ahmed Gamal Saeed** — Software Developer focused on Flutter and modern web applications.

- [Portfolio — selected projects and demos](https://ahmed-gamal-portfolio-alpha.vercel.app/)
- [LinkedIn — professional profile](https://www.linkedin.com/in/ahmed-gamal-saeed-717b54450/)
- [GitHub — source code](https://github.com/gamal6507-ops)

