(() => {
  const root = document.documentElement;
  const storageKey = 'resso-theme';
  let theme = 'light';
  try {
    if (localStorage.getItem(storageKey) === 'dark') theme = 'dark';
  } catch {}
  root.dataset.theme = theme;

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    toggle.setAttribute('aria-checked', String(theme === 'dark'));
    toggle.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = theme;
      toggle.setAttribute('aria-checked', String(theme === 'dark'));
      try {
        localStorage.setItem(storageKey, theme);
      } catch {}
    });
  });
})();
