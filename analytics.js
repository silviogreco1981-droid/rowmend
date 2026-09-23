(() => {
  const WEBSITE_ID = '4adb76f1-32af-43d9-ac91-0e335a04bf03';
  const SCRIPT_URL = 'https://cloud.umami.is/script.js';
  const ACQ_KEY = 'rowmend_acquisition_v1';
  const queue = [];

  function cleanCampaignValue(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 80);
  }

  function acquisitionContext() {
    try {
      const params = new URLSearchParams(window.location.search);
      const incoming = {
        acq_source: cleanCampaignValue(params.get('utm_source')),
        acq_medium: cleanCampaignValue(params.get('utm_medium')),
        acq_campaign: cleanCampaignValue(params.get('utm_campaign')),
        landing_path: window.location.pathname.slice(0, 120)
      };

      if (incoming.acq_source || incoming.acq_medium || incoming.acq_campaign) {
        sessionStorage.setItem(ACQ_KEY, JSON.stringify(incoming));
        return incoming;
      }

      const saved = JSON.parse(sessionStorage.getItem(ACQ_KEY) || 'null');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  }

  const campaign = acquisitionContext();

  function eventProperties(properties) {
    return {
      ...campaign,
      ...(properties || {})
    };
  }

  function flushQueue() {
    if (!window.umami?.track) return;
    while (queue.length) {
      const { eventName, properties } = queue.shift();
      window.umami.track(eventName, eventProperties(properties));
    }
  }

  function loadUmami() {
    if (document.querySelector('script[data-rowmend-analytics="umami"]')) return;

    const script = document.createElement('script');
    script.defer = true;
    script.src = SCRIPT_URL;
    script.dataset.websiteId = WEBSITE_ID;
    script.dataset.rowmendAnalytics = 'umami';
    script.addEventListener('load', flushQueue);
    document.head.appendChild(script);
  }

  function track(eventName, properties) {
    if (!eventName) return;
    if (window.umami?.track) {
      window.umami.track(eventName, eventProperties(properties));
      return;
    }
    queue.push({ eventName, properties: properties || {} });
  }

  window.RowMendAnalytics = { track };
  loadUmami();
})();