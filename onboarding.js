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

  function setStep(el, done) {
    if (!el) return;
    el.classList.toggle('done', done);
    el.classList.toggle('active', !done);
  }

  function render() {
    if (card) card.classList.toggle('hidden', state.hidden);
    if (show) show.classList.toggle('hidden', !state.hidden);
    setStep(loadStep, state.loaded);
    setStep(inspectStep, state.inspected);
    setStep(outputStep, state.output);
    if (pro) pro.classList.toggle('hidden', !state.output);
  }

  function markLoaded() {
    if (state.loaded) return;
    state.loaded = true;
    save();
    render();
  }

  function markInspected() {
    if (state.inspected) return;
    state.inspected = true;
    save();
    render();
  }

  function markOutput() {
    if (state.output) return;
    state.output = true;
    save();
    render();
  }

  function activateTab(name) {
    const tab = document.querySelector(`.tab[data-tab="${name}"]`);
    tab?.click();
    document.querySelector('#results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    window.RowMendFeedback?.openFeedback('onboarding_pro');
  });

  $('loadDemo')?.addEventListener('click', markLoaded);
  $('loadDemoHero')?.addEventListener('click', markLoaded);
  $('fileInput')?.addEventListener('change', () => {
    if ($('fileInput')?.files?.length) markLoaded();
  });
  document.querySelector('.tab[data-tab="mapping"]')?.addEventListener('click', markInspected);
  $('generateInsert')?.addEventListener('click', markOutput);
  $('generateMerge')?.addEventListener('click', markOutput);
  $('downloadClean')?.addEventListener('click', markOutput);
  $('downloadErrors')?.addEventListener('click', markOutput);

  render();
})();
