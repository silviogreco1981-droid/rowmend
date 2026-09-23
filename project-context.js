(function () {
  'use strict';

  const projects = window.RowMendProjects;
  if (!projects) return;

  let project = projects.projectFromSearch(window.location.search);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function renderBar() {
    if (!project) return;

    let bar = document.getElementById('rowmendProjectContext');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'rowmendProjectContext';
      bar.className = 'project-context-bar';
      const header = document.querySelector('.topbar');
      if (header?.parentNode) header.parentNode.insertBefore(bar, header.nextSibling);
      else document.body.prepend(bar);
    }

    const completion = projects.projectCompletion(project);
    bar.innerHTML = `
      <div class="shell project-context-inner">
        <div class="project-context-copy">
          <span class="project-context-label">LOCAL PROJECT</span>
          <strong>${escapeHtml(project.name)}</strong>
          <span>${completion.configured}/${completion.total} workflow artifacts configured</span>
        </div>
        <div class="project-context-actions" id="rowmendProjectActions">
          <a class="mini-btn" href="/projects/?project=${encodeURIComponent(project.id)}">Back to project</a>
        </div>
      </div>`;
  }

  function refresh() {
    if (!project) return null;
    project = projects.getProject(project.id);
    if (project) renderBar();
    return project;
  }

  function addAction(label, handler, options = {}) {
    if (!project || typeof handler !== 'function') return null;
    renderBar();
    const wrap = document.getElementById('rowmendProjectActions');
    if (!wrap) return null;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = options.className || 'mini-btn';
    button.textContent = label;
    button.addEventListener('click', handler);
    wrap.insertBefore(button, wrap.firstChild);
    return button;
  }

  function saveArtifact(type, payload, meta = {}) {
    if (!project) throw new Error('No project context is active.');
    project = projects.setArtifact(project.id, type, payload, meta);
    renderBar();
    return project;
  }

  function clearArtifact(type) {
    if (!project) throw new Error('No project context is active.');
    project = projects.clearArtifact(project.id, type);
    renderBar();
    return project;
  }

  function getArtifact(type) {
    return project?.artifacts?.[type] || null;
  }

  if (project) renderBar();

  window.RowMendProjectContext = {
    get project() { return project; },
    refresh,
    addAction,
    saveArtifact,
    clearArtifact,
    getArtifact
  };
})();