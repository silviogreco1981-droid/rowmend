(() => {
  const FORM_ID = 'QKbBZp';
  const FORM_BASE_URL = `https://tally.so/r/${FORM_ID}`;
  const PROMPT_KEY = 'rowmend_feedback_prompted_v031';

  const $ = (id) => document.getElementById(id);
  const modal = $('feedbackModal');
  const iframe = $('feedbackFrame');
  const closeBtn = $('feedbackClose');
  const prompt = $('feedbackPrompt');
  const promptOpen = $('feedbackPromptOpen');
  const proInterest = $('proInterest');
  const footerFeedback = $('footerFeedback');

  function feedbackUrl(source = 'manual') {
    const url = new URL(FORM_BASE_URL);
    url.searchParams.set('source', source);
    return url.toString();
  }

  function openFeedback(source = 'manual') {
    if (!modal || !iframe) return;
    window.RowMendAnalytics?.track('feedback_opened', { source });
    iframe.src = feedbackUrl(source);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeFeedback() {
    if (!modal || !iframe) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    iframe.src = 'about:blank';
    document.body.classList.remove('modal-open');
  }

  function showFeedbackPrompt(source) {
    if (!prompt) return;
    if (localStorage.getItem(PROMPT_KEY) === 'yes') return;
    prompt.dataset.source = source;
    prompt.classList.remove('hidden');
    localStorage.setItem(PROMPT_KEY, 'yes');
  }

  window.RowMendFeedback = { openFeedback, showFeedbackPrompt, feedbackUrl };

  promptOpen?.addEventListener('click', () => openFeedback(prompt?.dataset.source || 'prompt'));
  proInterest?.addEventListener('click', () => openFeedback('pro_interest'));
  footerFeedback?.addEventListener('click', (event) => {
    event.preventDefault();
    openFeedback('footer');
  });
  closeBtn?.addEventListener('click', closeFeedback);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeFeedback();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeFeedback();
  });
})();
