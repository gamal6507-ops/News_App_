# External News Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide live regional news when the current provider cannot.
**Architecture:** Google News RSS fallback behind the existing `/api/news` JSON
interface, with optional thumbnails preserved in Flutter.
**Tech Stack:** Node fetch, fast-xml-parser 5.12.1, Flutter.
**Spec:** `docs/superpowers/specs/2026-11-17-external-news-design.md`.

## Global Constraints
- Secrets stay server-side; upstream destinations are fixed.
- Native builds keep existing NewsAPI behavior.
- No fabricated content or images; publisher attribution and original links remain.

## Review Focus
- An empty headline response must trigger fallback.
- Missing keys and upstream failures must still permit feeds.
- Invalid/oversized XML and unsafe article links must be rejected.
- Pages beyond the finite feed must be empty, not repeat page one.
- Articles without images must remain visible.

## Task 1: External feed adapter and API fallback
- [ ] Add failing handler tests for missing-key/empty/error fallback, Egyptian
  categories, search filters, malformed XML, unsafe links, and pagination.
- [ ] Install pinned XML parser; create `server/google_news.cjs`.
- [ ] Update `api/news.js` with bounded upstream requests and fallback policy.
- [ ] Run Node suite and live Egyptian headline/search checks.

## Task 2: Render and deploy
- [ ] Add failing Flutter regression for articles without images; remove image filter.
- [ ] Enable `npm ci` on Vercel, ignore node_modules, document fallback limits.
- [ ] Run Flutter suite and analyzer, request focused review, push GitHub.
- [ ] Verify automatic production build and Egyptian headlines in browser.
