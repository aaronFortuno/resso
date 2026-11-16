(() => {
  const storageKey = 'umami.disabled';
  const hostname = 'resso.ortogra.fi';
  const preference = document.getElementById('analytics-excluded');
  const browserPreference = window.doNotTrack || navigator.doNotTrack || navigator.msDoNotTrack;
  let excluded = false;
  try {
    excluded = Boolean(localStorage.getItem(storageKey));
  } catch {}

  window.ressoPageview = (type, payload) => {
    if (excluded || type !== 'event' || payload.name) return false;
    return {
      website: payload.website,
      hostname,
      url: location.origin + location.pathname,
      title: document.title,
      screen: payload.screen,
      language: payload.language,
      referrer: '',
    };
  };

  let loaded = false;
  function loadTracker() {
    if (loaded || excluded || location.hostname !== hostname || ['1', 'yes'].includes(String(browserPreference))) return;
    loaded = true;
    const script = document.createElement('script');
    script.src = 'https://maquestria.tail72bc84.ts.net:8443/script.js';
    script.referrerPolicy = 'no-referrer';
    script.dataset.websiteId = '35458bc2-691d-4a18-9636-a2845e2d23b1';
    script.dataset.domains = hostname;
    script.dataset.excludeSearch = 'true';
    script.dataset.excludeHash = 'true';
    script.dataset.doNotTrack = 'true';
    script.dataset.beforeSend = 'ressoPageview';
    document.head.append(script);
  }

  if (preference) {
    preference.checked = excluded;
    preference.addEventListener('change', () => {
      excluded = preference.checked;
      try {
        if (excluded) localStorage.setItem(storageKey, '1');
        else localStorage.removeItem(storageKey);
      } catch {}
      loadTracker();
    });
  }
  loadTracker();
})();
