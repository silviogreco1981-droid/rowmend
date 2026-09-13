document.addEventListener('DOMContentLoaded', function () {
  var demo = document.getElementById('loadDemo');
  var heroDemo = document.getElementById('loadDemoHero');
  var empty = document.getElementById('emptyState');
  var results = document.getElementById('results');
  function showDemo() {
    empty.classList.add('hidden');
    results.classList.remove('hidden');
    document.getElementById('metrics').textContent = '3 rows, 3 columns, 2 issues';
    document.getElementById('issuesPanel').textContent = 'Demo loaded. One invalid email and one missing email were detected.';
    document.getElementById('generateInsert').disabled = false;
    document.getElementById('generateMerge').disabled = false;
  }
  demo.addEventListener('click', showDemo);
  heroDemo.addEventListener('click', showDemo);
});
