import { useEffect } from 'react';

/**
 * SEOHead - Dynamic Search Engine Optimization & Social Metadata Manager
 * Manages document title, meta descriptions, canonical URLs, Open Graph,
 * Twitter Cards, robots directives, and dynamic JSON-LD structured data schemas.
 */
const SEOHead = ({
  title,
  description,
  keywords,
  canonicalUrl,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  structuredData,
}) => {
  useEffect(() => {
    const baseTitle = 'Evalix — AI Technical Interview Preparation Platform';
    const finalTitle = title 
      ? (title.includes('Evalix') ? title : `${title} | ${baseTitle}`)
      : baseTitle;
    document.title = finalTitle;

    const setMeta = (name, content, isProperty = false) => {
      if (!content) return;
      const attr = isProperty ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (el) {
        el.setAttribute('content', content);
      } else {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        el.setAttribute('content', content);
        document.head.appendChild(el);
      }
    };

    const defaultDesc =
      'Practice AI voice mock interviews, scan your PDF resume against job descriptions, and take timed technical MCQ assessments.';
    const rawDesc = description || defaultDesc;
    const finalDescription =
      rawDesc.length > 130 ? `${rawDesc.slice(0, 127).trim()}...` : rawDesc;
    setMeta('description', finalDescription);

    // Remove obsolete meta-keywords if present in DOM (Google ignores it)
    const existingKeywords = document.querySelector('meta[name="keywords"]');
    if (existingKeywords) {
      existingKeywords.remove();
    }
    setMeta('robots', robots);

    // Canonical link
    const currentUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : 'https://interview-ai-ten-psi.vercel.app/';
    const href = canonicalUrl || currentUrl;
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', href);
    } else {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute('href', href);
      document.head.appendChild(canonicalLink);
    }

    // Hreflang links for language/region discovery
    const ensureHreflang = (lang) => {
      let link = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'alternate');
        link.setAttribute('hreflang', lang);
        document.head.appendChild(link);
      }
      link.setAttribute('href', href);
    };
    ensureHreflang('en');
    ensureHreflang('en-US');
    ensureHreflang('x-default');

    // Open Graph
    const finalOgTitle = ogTitle || finalTitle;
    const finalOgDesc = ogDescription || finalDescription;
    const finalOgImage = ogImage || 'https://interview-ai-ten-psi.vercel.app/og-image.png';

    setMeta('og:title', finalOgTitle, true);
    setMeta('og:description', finalOgDesc, true);
    setMeta('og:type', ogType, true);
    setMeta('og:url', href, true);
    setMeta('og:image', finalOgImage, true);
    setMeta('og:site_name', 'Evalix', true);
    setMeta('og:locale', 'en_US', true);

    // Twitter Card
    setMeta('twitter:card', twitterCard);
    setMeta('twitter:title', finalOgTitle);
    setMeta('twitter:description', finalOgDesc);
    setMeta('twitter:image', finalOgImage);

    // Dynamic JSON-LD structured data (prevent duplicate FAQPage with root schema)
    let scriptTag = null;
    const rootSchemaEl = document.getElementById('root-structured-data');
    const savedRootSchemaText = rootSchemaEl ? rootSchemaEl.textContent : null;

    if (structuredData) {
      if (rootSchemaEl) {
        rootSchemaEl.remove();
      }
      scriptTag = document.createElement('script');
      scriptTag.type = 'application/ld+json';
      scriptTag.id = 'page-structured-data';
      scriptTag.text = JSON.stringify(structuredData);
      document.head.appendChild(scriptTag);
    }

    return () => {
      if (scriptTag && scriptTag.parentNode) {
        scriptTag.parentNode.removeChild(scriptTag);
      }
      if (structuredData && savedRootSchemaText && !document.getElementById('root-structured-data')) {
        const restored = document.createElement('script');
        restored.type = 'application/ld+json';
        restored.id = 'root-structured-data';
        restored.textContent = savedRootSchemaText;
        document.head.appendChild(restored);
      }
    };
  }, [title, description, keywords, canonicalUrl, ogTitle, ogDescription, ogImage, ogType, twitterCard, robots, structuredData]);

  return null;
};

export default SEOHead;
