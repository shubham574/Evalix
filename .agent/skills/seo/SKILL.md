---
name: seo
description: Comprehensive Technical SEO, On-Page SEO, Structured Data (Schema.org JSON-LD), Core Web Vitals (INP, LCP, CLS), Mobile Friendliness, Hreflang, and Social Graph optimization playbook (affaan-m/ecc/seo).
---

# SEO & Core Web Vitals Optimization Skill (`affaan-m/ecc/seo`)

## 1. On-Page SEO & Metadata Rules
- **Title Tag:** 50–60 characters, primary keyword near the front, brand name at the end.
- **Meta Description:** Strictly **100–130 characters** (never exceed 130 chars to prevent SERP truncation and audit flags). Must be active, specific, and unique per route.
- **Canonical & Hreflang Tags:**
  - Every indexable page must include `<link rel="canonical" href="..." />`.
  - Include `<link rel="alternate" hreflang="en" href="..." />`, `<link rel="alternate" hreflang="en-US" href="..." />`, and `<link rel="alternate" hreflang="x-default" href="..." />`.

## 2. Validated Schema.org JSON-LD Structured Data
- **Zero Validation Errors:** Every `@graph` entity must include all required properties for Google Rich Results Test:
  - `SoftwareApplication` / `WebApplication`: Requires `name`, `url`, `applicationCategory`, `operatingSystem`, `offers` (`price`, `priceCurrency`), AND `aggregateRating` (`ratingValue`, `ratingCount`, `bestRating`, `worstRating`).
  - `Organization`: Requires `name`, `url`, `logo`, and `sameAs` array containing all official social links (`YouTube`, `X/Twitter`, `LinkedIn`, `Instagram`, `Facebook`, `GitHub`).
  - `TechArticle` / `Article`: Requires `headline`, `description`, `author` (`Organization` or `Person`), `publisher`, `datePublished`, `dateModified`, and `image`.
  - `BreadcrumbList`: Use canonical full URLs (never `#fragment` anchors).
  - Avoid duplicate `FAQPage` schemas on the same URL.

## 3. Core Web Vitals (INP, LCP, DOM Size)
- **Interaction to Next Paint (INP < 200ms):**
  - Never attach React state updates to global `window.onmousemove` / `mouseover` listeners (such as JS-driven custom cursors).
  - Avoid blocking initial page interactivity with artificial fullscreen preloaders.
  - Defer non-critical CSS/fonts (`media="print" onload="this.media='all'"`) and code-split heavy third-party bundles.
- **DOM Size (< 800 nodes):** Keep initial prerendered HTML semantic, clean, and lightweight.

## 4. Mobile Friendliness & Tap Targets
- Responsive viewport `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />`.
- Base body text `>= 16px` (`1rem`), secondary text `>= 14px` (`0.875rem`), no horizontal overflow (`flex-wrap: wrap` on all nav/link rows).
- Interactive buttons and links must have adequate tap target sizing (`>= 44x44px` or `>= 8px` spacing between targets).

## 5. Social Media Presence & Verification Links
- Link to all primary social channels (`YouTube`, `X / Twitter`, `LinkedIn`, `Instagram`, `Facebook`, `GitHub`) both in visible HTML footer `<a>` links and in JSON-LD `Organization.sameAs`.
