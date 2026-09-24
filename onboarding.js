(() => {
  const STORAGE_KEY = 'rowmend_onboarding_v033';
  const $ = (id) => document.getElementById(id);
  const card = $('onboardingCard');
  const hide = $('onboardingHide');
  const show = $('onboardingShow');
  const pro = $('onboardingPro');
  const proCta = $('onboardingProCta');
  const loadStep = $('onboardingStepLoad');
  const inspectStep = $('onboardingStepInspect');
  const outputStep = $('onboardingStepOutput');

  let state = { loaded: false, inspected: false, output: false, hidden: false };

  try {
    state = { ...state, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')) };
  } catch {}

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setStep(el, done, active) {
    if (!el) return;
    el.classList.toggle('done', done);
    el.classList.toggle('active', active);
  }

  function render() {
    if (card) card.classList.toggle('hidden', state.hidden);
    if (show) show.classList.toggle('hidden', !state.hidden);
    setStep(loadStep, state.loaded, !state.loaded);
    setStep(inspectStep, state.inspected, state.loaded && !state.inspected);
    setStep(outputStep, state.output, state.loaded && state.inspected && !state.output);
    if (pro) pro.classList.toggle('hidden', !state.output);
  }

  function markLoaded() {
    if (state.loaded) return;
    state.loaded = true;
    save();
    render();
  }

  function markInspected() {
    if (state.inspected || !state.loaded) return;
    state.inspected = true;
    save();
    render();
  }

  function markOutput() {
    if (state.output || !state.loaded) return;
    state.output = true;
    save();
    render();
  }

  function activateTab(name) {
    const tab = document.querySelector(`.tab[data-tab="${name}"]`);
    if (!tab || tab.disabled) return;
    tab.click();
    document.querySelector('#results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function syncFromSuccessfulAction(event) {
    const { action } = event.detail || {};
    if (action === 'loaded') markLoaded();
    if (action === 'output') markOutput();
  }

  loadStep?.addEventListener('click', () => {
    $('fileInput')?.click();
  });
  inspectStep?.addEventListener('click', () => activateTab('mapping'));
  outputStep?.addEventListener('click', () => activateTab('sql'));

  hide?.addEventListener('click', () => {
    state.hidden = true;
    save();
    render();
  });

  show?.addEventListener('click', () => {
    state.hidden = false;
    save();
    render();
  });

  proCta?.addEventListener('click', () => {
    window.RowMendAnalytics?.track('pro_interest', { source: 'onboarding' });
    window.RowMendFeedback?.openFeedback('onboarding_pro');
  });

  document.querySelector('.tab[data-tab="mapping"]')?.addEventListener('click', markInspected);
  document.addEventListener('rowmend:action-success', syncFromSuccessfulAction);

  render();
})();
