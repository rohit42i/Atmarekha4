/* Lightweight SPA SEO metadata manager. No dependencies. */
(function () {
  const base = 'https://www.atmarekha.in';
  const routes = {
    '/': {
      title: 'Atma Rekha — Original Indian Manga & Mythical Fantasy',
      description: 'Read Atma Rekha, an original Indian manga and mythical fantasy story inspired by Indian culture, spirituality, traditions and original storytelling.'
    },
    '/manga': {
      title: 'Manga Chapters — Atma Rekha',
      description: 'Read the latest published Atma Rekha manga chapters and follow the story from the beginning.'
    },
    '/community': {
      title: 'Community — Atma Rekha',
      description: 'Join the Atma Rekha reader community, discuss chapters and share your thoughts.'
    },
    '/membership': {
      title: 'Membership — Support Atma Rekha',
      description: 'Support Atma Rekha and get access to member benefits while helping the manga continue.'
    }
  };

  function ensureMeta(name, content) {
    let node = document.head.querySelector(`meta[name="${name}"]`);
    if (!node) {
      node = document.createElement('meta');
      node.name = name;
      document.head.appendChild(node);
    }
    node.content = content;
  }

  function ensureProperty(property, content) {
    let node = document.head.querySelector(`meta[property="${property}"]`);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute('property', property);
      document.head.appendChild(node);
    }
    node.content = content;
  }

  function update() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const hash = window.location.hash;
    let data = routes[path];

    if (!data && /read-chapter/i.test(hash)) {
      data = {
        title: 'Read Atma Rekha — Manga Chapter',
        description: 'Read an Atma Rekha manga chapter online.'
      };
    }
    if (!data) data = routes['/'];

    document.title = data.title;
    ensureMeta('description', data.description);
    ensureMeta('robots', 'index,follow,max-image-preview:large');
    ensureProperty('og:title', data.title);
    ensureProperty('og:description', data.description);
    ensureProperty('og:url', `${base}${path}`);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${base}${path}`;
  }

  update();
  window.addEventListener('hashchange', update, { passive: true });
  window.addEventListener('popstate', update, { passive: true });
})();
