(() => {
  'use strict';

  const core = window.RowMendProjects;
  if (!core) return;

  const RECIPE_KEY = 'rowmend_transform_recipes_v050';
  const CONTRACT_KEY = 'rowmend_data_contracts_v060';
  const IMPORT_PROFILE_KEY = 'rowmend_profiles_v02';
  const $ = id => document.getElementById(id);

  const state = { project: null };

  function track(eventName, properties = {}) {
    window.RowMendAnalytics?.track(eventName, properties);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function setMessage(message, kind = '') {
    const el = $('projectsMessage');
    el.textContent = message || '';
    el.className = `toolbox-message ${kind}`.trim();
  }

  function readStore(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  }

  function artifactLabel(artifact, fallback) {
    return artifact?.label || fallback;
  }

  function renderList() {
    const projects = core.listProjects();
    const list = $('projectsList');

    if (!projects.length) {
      list.innerHTML = '<div class="projects-empty-list">No local projects yet.</div>';
      return;
    }

    list.innerHTML = projects.map(project => {
      const completion = core.projectCompletion(project);
      const active = state.project?.id === project.id;
      return `<button type="button" class="project-list-item ${active ? 'active' : ''}" data-project-id="${escapeHtml(project.id)}">
        <strong>${escapeHtml(project.name)}</strong>
        <span>${completion.configured}/${completion.total} configured · updated ${escapeHtml(formatDate(project.updatedAt))}</span>
      </button>`;
    }).join('');

    list.querySelectorAll('[data-project-id]').forEach(button => {
      button.addEventListener('click', () => selectProject(button.dataset.projectId));
    });
  }

  function selectProject(id, updateUrl = true) {
    const project = core.getProject(id);
    if (!project) return;

    state.project = project;
    core.setActiveProject(project.id);

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('project', project.id);
      history.replaceState(null, '', url.pathname + url.search);
    }

    renderList();
    renderProject();
    track('project_opened', { configured: core.projectCompletion(project).configured });
  }

  function artifactStateHtml(artifact, emptyText, details = '') {
    if (!artifact) return `<strong>Not configured</strong><span>${escapeHtml(emptyText)}</span>`;
    return `<strong>${escapeHtml(artifact.label || 'Configured')}</strong><span>${escapeHtml(details || 'Saved in this local project')}</span>`;
  }

  function populateStandaloneStores() {
    const recipes = readStore(RECIPE_KEY);
    $('cleanRecipeSelect').innerHTML = '<option value="">Saved local recipes</option>' +
      Object.keys(recipes).sort().map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');

    const contracts = readStore(CONTRACT_KEY);
    $('contractSelect').innerHTML = '<option value="">Saved local contracts</option>' +
      Object.keys(contracts).sort().map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');

    const profiles = readStore(IMPORT_PROFILE_KEY);
    $('importProfileSelect').innerHTML = '<option value="">Saved import profiles</option>' +
      Object.keys(profiles).sort().map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  }

  function setToolLinks(projectId) {
    $('openProfileTool').href = core.projectUrl('/profile-data/', projectId);
    $('openCleanTool').href = core.projectUrl('/clean-data/', projectId);
    $('openContractTool').href = core.projectUrl('/data-contract/', projectId);
    $('openImportTool').href = core.projectUrl('/#tool', projectId);
    $('openMigrationTool').href = core.projectUrl('/migration-check/', projectId);
    $('runProject').href = core.projectUrl('/projects/run/', projectId);
  }

  function renderProject() {
    const project = state.project;
    $('projectEmpty').classList.toggle('hidden', Boolean(project));
    $('projectEditor').classList.toggle('hidden', !project);
    if (!project) return;

    $('projectTitle').textContent = project.name;
    $('projectName').value = project.name;
    $('projectDescription').value = project.description || '';
    $('projectDates').textContent = `Created ${formatDate(project.createdAt)} · updated ${formatDate(project.updatedAt)}`;

    const completion = core.projectCompletion(project);
    $('projectProgressText').textContent = `${completion.configured} of ${completion.total} workflow artifacts configured`;
    $('projectProgressBar').style.width = `${Math.round(completion.rate * 100)}%`;

    const profile = project.artifacts.profile;
    const recipe = project.artifacts.cleanRecipe;
    const contract = project.artifacts.dataContract;
    const importProfile = project.artifacts.importProfile;
    const migration = project.artifacts.migrationPreset;

    $('profileArtifact').innerHTML = artifactStateHtml(
      profile,
      'Run the profiler in project context and save the structural snapshot.',
      profile ? `${profile.snapshot?.summary?.rows ?? 0} rows · ${profile.snapshot?.summary?.columns ?? 0} columns` : ''
    );
    $('cleanArtifact').innerHTML = artifactStateHtml(
      recipe,
      'Attach a saved recipe or build one in Clean & Transform.',
      recipe ? `${recipe.recipe?.length ?? 0} transformation steps` : ''
    );
    $('contractArtifact').innerHTML = artifactStateHtml(
      contract,
      'Attach a saved contract or create one from a baseline.',
      contract ? `${contract.contract?.columns?.length ?? 0} contract columns` : ''
    );
    $('importArtifact').innerHTML = artifactStateHtml(
      importProfile,
      'Attach mapping and SQL-generation settings.',
      importProfile ? `${Object.keys(importProfile.profile?.config || {}).length} mapped source columns` : ''
    );
    $('migrationArtifact').innerHTML = artifactStateHtml(
      migration,
      'Open Migration Check in project context and save its mapping preset.',
      migration ? `${migration.mappings?.length ?? 0} mapped columns · ${migration.keySources?.length ?? 0} key columns` : ''
    );

    [
      ['stepProfile', profile, 'clearProfileArtifact'],
      ['stepClean', recipe, 'clearCleanArtifact'],
      ['stepContract', contract, 'clearContractArtifact'],
      ['stepImport', importProfile, 'clearImportArtifact'],
      ['stepMigration', migration, 'clearMigrationArtifact']
    ].forEach(([stepId, artifact, clearId]) => {
      $(stepId).classList.toggle('configured', Boolean(artifact));
      $(clearId).classList.toggle('hidden', !artifact);
    });

    setToolLinks(project.id);
    populateStandaloneStores();
  }

  function createProject() {
    try {
      const name = $('newProjectName').value.trim();
      const description = $('newProjectDescription').value.trim();
      const project = core.addProject({ name, description });
      $('newProjectName').value = '';
      $('newProjectDescription').value = '';
      state.project = project;
      renderList();
      selectProject(project.id);
      setMessage(`Project "${project.name}" created locally.`, 'success');
      track('project_created');
    } catch (error) {
      setMessage(error.message || 'Unable to create the project.', 'error');
    }
  }

  function createDemoProject() {
    try {
      let project = core.addProject({
        name:'Monthly vendor import demo',
        description:'Preconfigured RowMend demo for a recurring vendor CSV workflow.'
      });

      project = core.setArtifact(project.id, 'cleanRecipe', {
        recipe:[
          {type:'trim', columns:['NAME','EMAIL']},
          {type:'lowercase', column:'EMAIL'}
        ]
      }, { label:'Vendor cleanup' });

      project = core.setArtifact(project.id, 'dataContract', {
        contract:{
          contractVersion:1,
          name:'Monthly vendor contract',
          createdAt:new Date().toISOString(),
          updatedAt:new Date().toISOString(),
          baseline:{rows:4,columns:4},
          settings:{
            strictColumns:true,
            minRows:1,
            maxRows:100000,
            keyColumns:['ID']
          },
          columns:[
            {name:'ID',expectedType:'number',required:true,unique:true,maxMissingRate:0,maxMixedTypeRate:0},
            {name:'NAME',expectedType:'string',required:true,unique:false,maxMissingRate:0,maxMixedTypeRate:0},
            {name:'EMAIL',expectedType:'string',required:true,unique:false,maxMissingRate:0,maxMixedTypeRate:0},
            {name:'AMOUNT',expectedType:'number',required:true,unique:false,maxMissingRate:0,maxMixedTypeRate:0}
          ]
        }
      }, { label:'Monthly vendor contract' });

      project = core.setArtifact(project.id, 'importProfile', {
        profile:{
          tableName:'VENDOR_IMPORT',
          dialect:'postgres',
          keyColumn:'ID',
          config:{
            ID:{target:'ID',required:true,unique:true,email:false,type:'number'},
            NAME:{target:'SUPPLIER_NAME',required:true,unique:false,email:false,type:'string'},
            EMAIL:{target:'EMAIL',required:true,unique:false,email:true,type:'string'},
            AMOUNT:{target:'AMOUNT',required:true,unique:false,email:false,type:'number'}
          }
        }
      }, { label:'PostgreSQL vendor import' });

      state.project = project;
      renderList();
      selectProject(project.id);
      setMessage('Demo project created. Click “Run project”, then use the demo dataset in Workflow Runner.', 'success');
      track('project_created', { demo:true });
      track('project_demo_created', { configured:core.projectCompletion(project).configured });
    } catch (error) {
      setMessage(error.message || 'Unable to create the demo project.', 'error');
    }
  }

  function saveMeta() {
    if (!state.project) return;
    try {
      state.project.name = $('projectName').value.trim();
      state.project.description = $('projectDescription').value.trim();
      state.project = core.saveProject(state.project);
      renderList();
      renderProject();
      setMessage('Project details saved locally.', 'success');
      track('project_updated');
    } catch (error) {
      setMessage(error.message || 'Unable to save project details.', 'error');
    }
  }

  function attachCleanRecipe() {
    if (!state.project) return;
    const name = $('cleanRecipeSelect').value;
    const recipes = readStore(RECIPE_KEY);
    if (!name || !Array.isArray(recipes[name])) {
      setMessage('Select a saved cleanup recipe first.', 'error');
      return;
    }

    state.project = core.setArtifact(state.project.id, 'cleanRecipe', {
      recipe: recipes[name]
    }, { label:name });
    renderList();
    renderProject();
    setMessage(`Recipe "${name}" attached to the project.`, 'success');
    track('project_artifact_attached', { artifact:'clean_recipe' });
  }

  function attachContract() {
    if (!state.project) return;
    const name = $('contractSelect').value;
    const contracts = readStore(CONTRACT_KEY);
    if (!name || !contracts[name]) {
      setMessage('Select a saved data contract first.', 'error');
      return;
    }

    state.project = core.setArtifact(state.project.id, 'dataContract', {
      contract: contracts[name]
    }, { label:name });
    renderList();
    renderProject();
    setMessage(`Contract "${name}" attached to the project.`, 'success');
    track('project_artifact_attached', { artifact:'data_contract' });
  }

  function attachImportProfile() {
    if (!state.project) return;
    const name = $('importProfileSelect').value;
    const profiles = readStore(IMPORT_PROFILE_KEY);
    if (!name || !profiles[name]) {
      setMessage('Select a saved import profile first.', 'error');
      return;
    }

    state.project = core.setArtifact(state.project.id, 'importProfile', {
      profile: profiles[name]
    }, { label:name });
    renderList();
    renderProject();
    setMessage(`Import profile "${name}" attached to the project.`, 'success');
    track('project_artifact_attached', { artifact:'import_profile' });
  }

  function clearArtifact(type) {
    if (!state.project) return;
    state.project = core.clearArtifact(state.project.id, type);
    renderList();
    renderProject();
    setMessage('Project artifact removed. Standalone saved settings were not deleted.', 'success');
    track('project_artifact_removed', { artifact:type });
  }

  function duplicateCurrent() {
    if (!state.project) return;
    try {
      const copy = core.duplicateProject(state.project.id);
      state.project = copy;
      renderList();
      selectProject(copy.id);
      setMessage(`Created "${copy.name}".`, 'success');
      track('project_duplicated');
    } catch (error) {
      setMessage(error.message || 'Unable to duplicate the project.', 'error');
    }
  }

  function download(content, name, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportCurrent() {
    if (!state.project) return;
    try {
      saveMeta();
      const safeName = state.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rowmend-project';
      download(core.exportProject(state.project), `${safeName}.rowmend-project.json`, 'application/json;charset=utf-8');
      track('project_exported', { configured:core.projectCompletion(state.project).configured });
    } catch (error) {
      setMessage(error.message || 'Unable to export the project.', 'error');
    }
  }

  async function importProjectFile(file) {
    try {
      const text = await file.text();
      const project = core.importProject(text);
      state.project = project;
      renderList();
      selectProject(project.id);
      setMessage(`Imported project "${project.name}".`, 'success');
      track('project_imported', { configured:core.projectCompletion(project).configured });
    } catch (error) {
      setMessage(`Invalid project JSON: ${error.message}`, 'error');
    }
  }

  function deleteCurrent() {
    if (!state.project) return;
    const project = state.project;
    const confirmed = window.confirm(`Delete local project "${project.name}"? Standalone recipes and contracts will remain.`);
    if (!confirmed) return;

    core.deleteProject(project.id);
    state.project = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('project');
    history.replaceState(null, '', url.pathname + url.search);
    renderList();
    renderProject();
    setMessage(`Project "${project.name}" deleted.`, 'success');
    track('project_deleted');
  }

  function bind() {
    $('createProject').addEventListener('click', createProject);
    $('createDemoProject').addEventListener('click', createDemoProject);
    $('saveProjectMeta').addEventListener('click', saveMeta);
    $('duplicateProject').addEventListener('click', duplicateCurrent);
    $('exportProject').addEventListener('click', exportCurrent);
    $('attachCleanRecipe').addEventListener('click', attachCleanRecipe);
    $('attachContract').addEventListener('click', attachContract);
    $('attachImportProfile').addEventListener('click', attachImportProfile);
    $('clearProfileArtifact').addEventListener('click', () => clearArtifact('profile'));
    $('clearCleanArtifact').addEventListener('click', () => clearArtifact('cleanRecipe'));
    $('clearContractArtifact').addEventListener('click', () => clearArtifact('dataContract'));
    $('clearImportArtifact').addEventListener('click', () => clearArtifact('importProfile'));
    $('clearMigrationArtifact').addEventListener('click', () => clearArtifact('migrationPreset'));
    $('deleteProject').addEventListener('click', deleteCurrent);

    $('importProjectFile').addEventListener('change', () => {
      const file = $('importProjectFile').files[0];
      if (file) importProjectFile(file);
      $('importProjectFile').value = '';
    });
  }

  function init() {
    track('projects_opened');
    bind();
    populateStandaloneStores();
    renderList();

    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get('project');
    const first = requestedId ? core.getProject(requestedId) : null;
    if (first) selectProject(first.id, false);
    else renderProject();
  }

  init();
})();