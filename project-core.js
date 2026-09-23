(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RowMendProjects = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const PROJECT_VERSION = 1;
  const STORAGE_KEY = 'rowmend_projects_v070';
  const ACTIVE_KEY = 'rowmend_active_project_v070';
  const RUN_STORAGE_KEY = 'rowmend_project_runs_v080';
  const MAX_RUN_HISTORY = 30;
  const ARTIFACT_TYPES = ['profile', 'cleanRecipe', 'dataContract', 'importProfile', 'migrationPreset'];

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function makeId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'prj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function normalizeName(value) {
    const name = String(value || '').trim();
    if (!name) throw new Error('Project name is required.');
    return name.slice(0, 120);
  }

  function emptyArtifacts() {
    return {
      profile: null,
      cleanRecipe: null,
      dataContract: null,
      importProfile: null,
      migrationPreset: null
    };
  }

  function createProject(input = {}) {
    const timestamp = input.createdAt || nowIso();
    return {
      projectVersion: PROJECT_VERSION,
      id: input.id || makeId(),
      name: normalizeName(input.name || 'Untitled project'),
      description: String(input.description || '').trim().slice(0, 1200),
      createdAt: timestamp,
      updatedAt: input.updatedAt || timestamp,
      artifacts: {
        ...emptyArtifacts(),
        ...(clone(input.artifacts) || {})
      }
    };
  }

  function validateArtifact(type, artifact) {
    if (!ARTIFACT_TYPES.includes(type)) throw new Error('Unsupported project artifact type.');
    if (artifact === null || artifact === undefined) return true;
    if (typeof artifact !== 'object') throw new Error(`Invalid ${type} artifact.`);

    if (type === 'cleanRecipe' && !Array.isArray(artifact.recipe)) {
      throw new Error('A clean recipe artifact must include a recipe array.');
    }
    if (type === 'dataContract' && (!artifact.contract || typeof artifact.contract !== 'object')) {
      throw new Error('A data contract artifact must include a contract object.');
    }
    if (type === 'importProfile' && (!artifact.profile || typeof artifact.profile !== 'object')) {
      throw new Error('An import profile artifact must include a profile object.');
    }
    if (type === 'migrationPreset') {
      if (!Array.isArray(artifact.mappings) || !Array.isArray(artifact.keySources)) {
        throw new Error('A migration preset must include mappings and keySources.');
      }
    }
    if (type === 'profile' && (!artifact.snapshot || typeof artifact.snapshot !== 'object')) {
      throw new Error('A profile artifact must include a snapshot.');
    }

    return true;
  }

  function validateProject(project) {
    if (!project || typeof project !== 'object') throw new Error('Invalid project.');
    if (Number(project.projectVersion) !== PROJECT_VERSION) throw new Error('Unsupported project version.');
    if (!String(project.id || '').trim()) throw new Error('Project id is required.');
    normalizeName(project.name);
    if (!project.artifacts || typeof project.artifacts !== 'object') throw new Error('Project artifacts are missing.');

    ARTIFACT_TYPES.forEach(type => validateArtifact(type, project.artifacts[type] ?? null));
    return true;
  }

  function readAll() {
    if (typeof localStorage === 'undefined') return {};
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeAll(projects) {
    if (typeof localStorage === 'undefined') throw new Error('Local storage is not available.');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  function listProjects() {
    return Object.values(readAll())
      .filter(project => {
        try { validateProject(project); return true; }
        catch { return false; }
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .map(clone);
  }

  function getProject(id) {
    const project = readAll()[id];
    if (!project) return null;
    validateProject(project);
    return clone(project);
  }

  function saveProject(project) {
    validateProject(project);
    const projects = readAll();
    const next = clone(project);
    next.name = normalizeName(next.name);
    next.description = String(next.description || '').trim().slice(0, 1200);
    next.updatedAt = nowIso();
    projects[next.id] = next;
    writeAll(projects);
    return clone(next);
  }

  function addProject(input = {}) {
    const project = createProject(input);
    return saveProject(project);
  }

  function deleteProject(id) {
    const projects = readAll();
    if (!projects[id]) return false;
    delete projects[id];
    writeAll(projects);

    const runs = readRunStore();
    if (runs[id]) {
      delete runs[id];
      writeRunStore(runs);
    }

    if (typeof localStorage !== 'undefined' && localStorage.getItem(ACTIVE_KEY) === id) {
      localStorage.removeItem(ACTIVE_KEY);
    }
    return true;
  }

  function duplicateProject(id, name) {
    const source = getProject(id);
    if (!source) throw new Error('Project not found.');
    const copy = createProject({
      name: normalizeName(name || `${source.name} copy`),
      description: source.description,
      artifacts: source.artifacts
    });
    return saveProject(copy);
  }

  function setArtifact(projectId, type, payload, meta = {}) {
    validateArtifact(type, payload);
    const project = getProject(projectId);
    if (!project) throw new Error('Project not found.');

    project.artifacts[type] = payload === null ? null : {
      ...clone(payload),
      label: String(meta.label || payload.label || '').trim().slice(0, 160),
      savedAt: nowIso()
    };

    return saveProject(project);
  }

  function clearArtifact(projectId, type) {
    return setArtifact(projectId, type, null);
  }

  function setActiveProject(id) {
    if (typeof localStorage === 'undefined') return;
    if (!id) {
      localStorage.removeItem(ACTIVE_KEY);
      return;
    }
    if (!getProject(id)) throw new Error('Project not found.');
    localStorage.setItem(ACTIVE_KEY, id);
  }

  function getActiveProject() {
    if (typeof localStorage === 'undefined') return null;
    const id = localStorage.getItem(ACTIVE_KEY);
    return id ? getProject(id) : null;
  }

  function projectFromSearch(search) {
    const params = new URLSearchParams(String(search || ''));
    const id = params.get('project');
    if (!id) return null;
    const project = getProject(id);
    if (project) setActiveProject(id);
    return project;
  }

  function projectUrl(path, projectId) {
    const url = new URL(path, 'https://rowmend.local');
    if (projectId) url.searchParams.set('project', projectId);
    return url.pathname + url.search + url.hash;
  }

  function profileSnapshot(profile, fileName = '') {
    if (!profile || !profile.summary || !Array.isArray(profile.columns)) {
      throw new Error('A valid profile is required.');
    }

    return {
      fileName: String(fileName || '').slice(0, 240),
      capturedAt: nowIso(),
      summary: clone(profile.summary),
      columns: profile.columns.map(column => ({
        name: column.name,
        type: column.type,
        typeConfidence: column.typeConfidence,
        mixedTypeCount: column.mixedTypeCount,
        missing: column.missing,
        missingRate: column.missingRate,
        nonEmpty: column.nonEmpty,
        unique: column.unique,
        uniqueRate: column.uniqueRate,
        numeric: clone(column.numeric),
        date: clone(column.date),
        string: clone(column.string)
      }))
    };
  }

  function projectCompletion(project) {
    validateProject(project);
    const configured = ARTIFACT_TYPES.filter(type => Boolean(project.artifacts[type])).length;
    return {
      configured,
      total: ARTIFACT_TYPES.length,
      rate: configured / ARTIFACT_TYPES.length
    };
  }

  function readRunStore() {
    if (typeof localStorage === 'undefined') return {};
    try {
      const parsed = JSON.parse(localStorage.getItem(RUN_STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeRunStore(value) {
    if (typeof localStorage === 'undefined') throw new Error('Local storage is not available.');
    localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(value));
  }

  function sanitizeRunSummary(summary) {
    if (!summary || typeof summary !== 'object') throw new Error('A valid run summary is required.');
    const allowedStatus = summary.status === 'PASS' ? 'PASS' : 'REVIEW_REQUIRED';
    const numberOrNull = value => value === null || value === undefined
      ? null
      : (Number.isFinite(Number(value)) ? Number(value) : null);

    return {
      id: String(summary.id || makeId()),
      status: allowedStatus,
      startedAt: String(summary.startedAt || nowIso()),
      durationMs: Math.max(0, numberOrNull(summary.durationMs) || 0),
      inputRows: Math.max(0, numberOrNull(summary.inputRows) || 0),
      outputRows: Math.max(0, numberOrNull(summary.outputRows) || 0),
      validRows: numberOrNull(summary.validRows),
      invalidRows: numberOrNull(summary.invalidRows),
      contractErrors: Math.max(0, numberOrNull(summary.contractErrors) || 0),
      contractWarnings: Math.max(0, numberOrNull(summary.contractWarnings) || 0),
      warningSteps: Math.max(0, numberOrNull(summary.warningSteps) || 0),
      errorSteps: Math.max(0, numberOrNull(summary.errorSteps) || 0)
    };
  }

  function addRunSummary(projectId, summary) {
    if (!getProject(projectId)) throw new Error('Project not found.');
    const store = readRunStore();
    const run = sanitizeRunSummary(summary);
    const current = Array.isArray(store[projectId]) ? store[projectId] : [];
    store[projectId] = [run, ...current].slice(0, MAX_RUN_HISTORY);
    writeRunStore(store);
    return clone(run);
  }

  function listRunHistory(projectId) {
    if (!getProject(projectId)) return [];
    const store = readRunStore();
    return (Array.isArray(store[projectId]) ? store[projectId] : [])
      .map(sanitizeRunSummary)
      .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  }

  function clearRunHistory(projectId) {
    const store = readRunStore();
    if (!store[projectId]) return false;
    delete store[projectId];
    writeRunStore(store);
    return true;
  }

  function exportProject(project) {
    validateProject(project);
    return JSON.stringify(project, null, 2);
  }

  function importProject(value, options = {}) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : clone(value);
    validateProject(parsed);

    const project = createProject({
      id: options.keepId ? parsed.id : makeId(),
      name: options.name || parsed.name,
      description: parsed.description,
      artifacts: parsed.artifacts
    });

    return options.save === false ? project : saveProject(project);
  }

  return {
    PROJECT_VERSION,
    STORAGE_KEY,
    ACTIVE_KEY,
    RUN_STORAGE_KEY,
    MAX_RUN_HISTORY,
    ARTIFACT_TYPES,
    createProject,
    validateProject,
    validateArtifact,
    listProjects,
    getProject,
    saveProject,
    addProject,
    deleteProject,
    duplicateProject,
    setArtifact,
    clearArtifact,
    setActiveProject,
    getActiveProject,
    projectFromSearch,
    projectUrl,
    profileSnapshot,
    projectCompletion,
    addRunSummary,
    listRunHistory,
    clearRunHistory,
    exportProject,
    importProject
  };
});
