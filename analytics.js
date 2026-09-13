(() => {
  const WEBSITE_ID = '4adb76f1-32af-43d9-ac91-0e335a04bf03';
  const SCRIPT_URL = 'https://cloud.umami.is/script.js';

  function loadUmami() {
    if (document.querySelector('script[data-rowmend-analytics="umami"]')) return;

    const script = document.createElement('script');
    script.defer = true;
    script.src = SCRIPT_URL;
    script.dataset.websiteId = WEBSITE_ID;
    script.dataset.rowmendAnalytics = 'umami';
    document.head.appendChild(script);
  }

  function track(eventName, properties) {
    if (!eventName) return;
    if (window.umami?.track) {
      window.umami.track(eventName, properties || {});
    }
  }

  window.RowMendAnalytics = { track };
  loadUmami();
})();
