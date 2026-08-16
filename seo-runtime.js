/* Lightweight SPA SEO metadata manager. Hash routing is preserved for compatibility. */
(function () {
  const base = 'https://www.atmarekha.in';
  const defaults = {
    title: 'Atma Rekha — Original Indian Manga & Mythical Fantasy',
    description: 'Read Atma Rekha, an original Indian manga and mythical fantasy story inspired by Indian culture, spirituality, traditions and original storytelling.'
  };
  const routes = {
    '/': defaults,
    '/manga': { title: 'Manga Chapters — Atma Rekha', description: 'Read the latest published Atma Rekha manga chapters and follow the story from the beginning.' },
    '/community': { title: 'Community — Atma Rekha', description: 'Join the Atma Rekha reader community, discuss chapters and share your thoughts.' },
    '/membership': { title: 'Membership — Support Atma Rekha', description: 'Support Atma Rekha and get member benefits while helping Atma Rekha continue.' },
    '/profile': { title: 'Profile — Atma Rekha', description: 'Manage your Atma Rekha profile, reading history, bookmarks, membership and reader activity.' },
    '/chapter': { title: 'Read Chapter — Atma Rekha', description: 'Read an Atma Rekha manga chapter online.' }
  };

  function ensureMeta(name, content) {
    let node = document.head.querySelector(`meta[name="${name}"]`);
    if (!node) { node = document.createElement('meta'); node.name = name; document.head.appendChild(node); }
    node.content = content;
  }
  function ensureProperty(property, content) {
    let node = document.head.querySelector(`meta[property="${property}"]`);
    if (!node) { node = document.createElement('meta'); node.setAttribute('property', property); document.head.appendChild(node); }
    node.content = content;
  }
  function ensureCanonical(url) {
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = url;
  }
  function ensureJsonLd(data) {
    let node = document.head.querySelector('#atma-seo-jsonld');
    if (!node) { node = document.createElement('script'); node.id = 'atma-seo-jsonld'; node.type = 'application/ld+json'; document.head.appendChild(node); }
    node.textContent = JSON.stringify(data);
  }

  function update() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const hash = window.location.hash || '';
    let data = routes[path] || defaults;
    let canonicalPath = path;
    let schema = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Atma Rekha', url: base + '/', description: defaults.description };

    const chapterMatch = hash.match(/^#(?:read-chapter|chapter)\/([^/?#]+)/i);
    if (chapterMatch) {
      const number = decodeURIComponent(chapterMatch[1]);
      data = { title: `Read Chapter — Atma Rekha`, description: `Read Chapter ${number} of Atma Rekha, an original Indian manga and mythical fantasy story.` };
      canonicalPath = '/manga';
      schema = { '@context': 'https://schema.org', '@type': 'ComicIssue', name: data.title, description: data.description, url: `${base}/manga#read-chapter/${encodeURIComponent(number)}`, isPartOf: { '@type': 'ComicSeries', name: 'Atma Rekha', url: base + '/' } };
    } else if (hash === '#manga' || hash.startsWith('#manga/')) {
      data = routes['/manga']; canonicalPath = '/manga';
    } else if (hash === '#community' || hash.startsWith('#community/')) {
      data = routes['/community']; canonicalPath = '/community';
    } else if (hash === '#membership' || hash.startsWith('#membership/')) {
      data = routes['/membership']; canonicalPath = '/membership';
    } else if (hash === '#profile' || hash.startsWith('#profile/')) {
      data = routes['/profile']; canonicalPath = '/profile';
    }

    document.title = data.title;
    ensureMeta('description', data.description);
    ensureMeta('robots', 'index,follow,max-image-preview:large');
    ensureProperty('og:title', data.title);
    ensureProperty('og:description', data.description);
    ensureProperty('og:url', `${base}${canonicalPath}`);
    ensureProperty('og:type', chapterMatch ? 'article' : 'website');
    ensureProperty('twitter:title', data.title);
    ensureProperty('twitter:description', data.description);
    ensureCanonical(`${base}${canonicalPath}`);
    ensureJsonLd(schema);
  }

  update();
  window.addEventListener('hashchange', update, { passive: true });
  window.addEventListener('popstate', update, { passive: true });
})();
