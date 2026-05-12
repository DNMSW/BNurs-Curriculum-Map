let nmc = [], units = [], programme = [];
let currentView = 'nmc';
let filters = { year: 'all', field: 'all', search: '' };

async function loadData() {
  try {
    [programme, nmc, units] = await Promise.all([
      fetch('data/programmeOutcomes.json').then(r => r.json()),
      fetch('data/nmcStandards.json').then(r => r.json()),
      fetch('data/units.json').then(r => r.json())
    ]);
    render();
  } catch (e) {
    document.getElementById('content').innerHTML =
      '<div class="empty"><p>Error loading data. Open this file via a local server (e.g. <code>npx serve .</code>) rather than directly in the browser.</p></div>';
  }
}

function setView(v, btn) {
  currentView = v;
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  render();
}

function getFilteredUnits() {
  const q = filters.search.toLowerCase();
  return units.filter(u => {
    if (filters.year !== 'all' && u.year !== +filters.year) return false;
    if (filters.field !== 'all') {
      const f = u.fields || [];
      if (!f.includes(filters.field) && !f.includes('All')) return false;
    }
    if (q) {
      const inCode  = u.code.toLowerCase().includes(q);
      const inTitle = u.title.toLowerCase().includes(q);
      const inNmc   = u.outcomes.some(o => (o.nmc || []).some(n => n.toLowerCase().includes(q)));
      const inPo    = u.outcomes.some(o => (o.po  || []).some(p => p.toLowerCase().includes(q)));
      const inText  = u.outcomes.some(o => o.text.toLowerCase().includes(q));
      if (!inCode && !inTitle && !inNmc && !inPo && !inText) return false;
    }
    return true;
  });
}

function ycls(year) { return ['', 'y1', 'y2', 'y3'][year] || ''; }

function unitChip(u) {
  const d = u.discovery ? ' discovery' : '';
  return `<span class="chip ${ycls(u.year)}${d}" title="${u.title}">${u.code}</span>`;
}

/* ── Render dispatcher ────────────────────────────────── */
function render() {
  const c = document.getElementById('content');
  const fu = getFilteredUnits();
  if      (currentView === 'nmc')       renderNMC(c, fu);
  else if (currentView === 'programme') renderProgramme(c, fu);
  else if (currentView === 'units')     renderUnits(c, fu);
  else if (currentView === 'gaps')      renderGaps(c, fu);
}

/* ── NMC Standards view ───────────────────────────────── */
function renderNMC(c, fu) {
  // build coverage map
  const cov = {};
  fu.forEach(u => u.outcomes.forEach(o => (o.nmc || []).forEach(ref => {
    if (!cov[ref]) cov[ref] = [];
    if (!cov[ref].find(x => x.code === u.code)) cov[ref].push(u);
  })));

  const mainStds = nmc.filter(s => typeof s.platform === 'number');
  const annexStds = nmc.filter(s => s.platform === 'Annexe');
  const covered = mainStds.filter(s => cov[s.id]?.length).length +
                  annexStds.filter(s => cov[s.id]?.length).length;
  const total = nmc.length;

  let html = `<div class="stats-bar">
    <div class="stat"><div class="stat-num">${total}</div><div class="stat-label">NMC Proficiencies</div></div>
    <div class="stat covered"><div class="stat-num">${covered}</div><div class="stat-label">Covered</div></div>
    <div class="stat gap"><div class="stat-num">${total - covered}</div><div class="stat-label">Gaps</div></div>
    <div class="stat"><div class="stat-num">${fu.length}</div><div class="stat-label">Units shown</div></div>
  </div>`;

  // Group by platform
  const platforms = [...new Set(mainStds.map(s => s.platform))].sort((a, b) => a - b);
  platforms.forEach(p => {
    const stds = mainStds.filter(s => s.platform === p);
    const pTitle = stds[0]?.platformTitle || '';
    html += `<div class="section-hd">Platform ${p}: ${pTitle}</div>`;
    stds.forEach(s => {
      const units = cov[s.id] || [];
      const ok = units.length > 0;
      html += `<div class="std-item ${ok ? 'covered' : 'gap'}">
        <div class="std-row">
          <span class="std-id">${s.id}</span>
          <span class="std-text">${s.text}</span>
          <span class="badge ${ok ? 'badge-ok' : 'badge-gap'}">${ok ? 'covered' : 'gap'}</span>
        </div>
        ${ok ? `<div class="chip-row">${units.map(unitChip).join('')}</div>` : ''}
      </div>`;
    });
  });

  if (annexStds.length) {
    html += `<div class="section-hd">Annexes</div>`;
    annexStds.forEach(s => {
      const units = cov[s.id] || [];
      const ok = units.length > 0;
      html += `<div class="std-item ${ok ? 'covered' : 'gap'}">
        <div class="std-row">
          <span class="std-id">${s.id}</span>
          <span class="std-text">${s.text}</span>
          <span class="badge ${ok ? 'badge-ok' : 'badge-gap'}">${ok ? 'covered' : 'gap'}</span>
        </div>
        ${ok ? `<div class="chip-row">${units.map(unitChip).join('')}</div>` : ''}
      </div>`;
    });
  }

  c.innerHTML = html;
}

/* ── Programme Outcomes view ──────────────────────────── */
function renderProgramme(c, fu) {
  const cov = {};
  fu.forEach(u => u.outcomes.forEach(o => (o.po || []).forEach(ref => {
    if (!cov[ref]) cov[ref] = [];
    if (!cov[ref].find(x => x.code === u.code)) cov[ref].push(u);
  })));

  const covered = programme.filter(p => cov[p.id]?.length).length;

  let html = `<div class="stats-bar">
    <div class="stat"><div class="stat-num">${programme.length}</div><div class="stat-label">Programme Outcomes</div></div>
    <div class="stat covered"><div class="stat-num">${covered}</div><div class="stat-label">Covered</div></div>
    <div class="stat gap"><div class="stat-num">${programme.length - covered}</div><div class="stat-label">Gaps</div></div>
    <div class="stat"><div class="stat-num">${fu.length}</div><div class="stat-label">Units shown</div></div>
  </div>`;

  const cats = [...new Set(programme.map(p => p.category))];
  cats.forEach(cat => {
    const pos = programme.filter(p => p.category === cat);
    const catTitle = pos[0]?.categoryTitle || '';
    html += `<div class="section-hd">Category ${cat}: ${catTitle}</div>`;
    pos.forEach(p => {
      const units = cov[p.id] || [];
      const ok = units.length > 0;
      html += `<div class="std-item ${ok ? 'covered' : 'gap'}">
        <div class="std-row">
          <span class="std-id">${p.id}</span>
          <span class="std-text">${p.text}</span>
          <span class="badge ${ok ? 'badge-ok' : 'badge-gap'}">${ok ? 'covered' : 'gap'}</span>
        </div>
        ${ok ? `<div class="chip-row">${units.map(unitChip).join('')}</div>` : ''}
      </div>`;
    });
  });

  c.innerHTML = html;
}

/* ── Units Overview ───────────────────────────────────── */
function renderUnits(c, fu) {
  if (!fu.length) {
    c.innerHTML = '<div class="empty"><p>No units match the current filters.</p></div>';
    return;
  }

  let html = '';
  [1, 2, 3].forEach(yr => {
    const yUnits = fu.filter(u => u.year === yr);
    if (!yUnits.length) return;
    html += `<div class="section-hd">Year ${yr} – Level ${yr + 3}</div>`;
    yUnits.forEach(u => {
      const fieldTags = (u.fields || []).map(f => `<span class="meta-tag">${f}</span>`).join('');
      const assessText = (u.assessments || []).map(a =>
        `${a.type}${a.length ? ' — ' + a.length : ''}`).join(' &amp; ');

      html += `<div class="unit-card">
        <div class="unit-card-hd">
          <div class="unit-code">${u.code}</div>
          <div class="unit-title">${u.title}</div>
          <div class="unit-meta">
            <span class="meta-tag year">Year ${u.year} · L${u.level}</span>
            <span class="meta-tag">${u.credits}cr</span>
            ${fieldTags}
            ${u.discovery ? '<span class="meta-tag disc">Discovery</span>' : ''}
            ${u.note ? '<span class="meta-tag note">Note</span>' : ''}
          </div>
        </div>
        <div class="unit-card-body">
          ${u.note ? `<p style="font-size:0.8rem;color:#7a5200;background:#fff3cd;border-radius:4px;padding:0.4rem 0.6rem;margin-bottom:0.6rem">${u.note}</p>` : ''}
          ${u.outcomes.map(o => {
            const nmcRefs = (o.nmc || []).map(n => `<span class="nmc-ref">${n}</span>`).join('');
            const poRefs  = (o.po  || []).map(p => `<span class="po-ref">${p}</span>`).join('');
            return `<div class="outcome-item">
              <div class="outcome-cat">${o.category}</div>
              <div class="outcome-text">${o.text}</div>
              ${nmcRefs ? `<div class="nmc-ref-row"><span class="ref-label">NMC</span>${nmcRefs}</div>` : ''}
              ${poRefs  ? `<div class="nmc-ref-row" style="margin-top:0.2rem"><span class="ref-label">PO</span>${poRefs}</div>`  : ''}
            </div>`;
          }).join('')}
          <div class="assessment-block"><strong>Assessment:</strong> ${assessText || 'See unit specification'}</div>
        </div>
      </div>`;
    });
  });

  c.innerHTML = html;
}

/* ── Coverage Gaps view ───────────────────────────────── */
function renderGaps(c, fu) {
  const nmcCov = new Set();
  const poCov  = new Set();
  fu.forEach(u => u.outcomes.forEach(o => {
    (o.nmc || []).forEach(n => nmcCov.add(n));
    (o.po  || []).forEach(p => poCov.add(p));
  }));

  const nmcGaps = nmc.filter(s => !nmcCov.has(s.id));
  const poGaps  = programme.filter(p => !poCov.has(p.id));

  let html = `<div class="stats-bar">
    <div class="stat gap"><div class="stat-num">${nmcGaps.length}</div><div class="stat-label">NMC Gaps</div></div>
    <div class="stat gap"><div class="stat-num">${poGaps.length}</div><div class="stat-label">Programme Outcome Gaps</div></div>
    <div class="stat covered"><div class="stat-num">${nmc.length - nmcGaps.length}</div><div class="stat-label">NMC Covered</div></div>
    <div class="stat"><div class="stat-num">${fu.length}</div><div class="stat-label">Units in view</div></div>
  </div>`;

  if (nmcGaps.length === 0 && poGaps.length === 0) {
    html += '<div class="empty"><p>No coverage gaps for the current filter selection. All standards are addressed.</p></div>';
  } else {
    if (nmcGaps.length) {
      html += `<div class="section-hd">Uncovered NMC Standards (${nmcGaps.length})</div>`;
      const platforms = [...new Set(nmcGaps.map(s => s.platform))];
      platforms.forEach(p => {
        const gaps = nmcGaps.filter(s => s.platform === p);
        const pTitle = typeof p === 'number' ? `Platform ${p}: ${gaps[0]?.platformTitle}` : `${gaps[0]?.platformTitle}`;
        html += `<div class="subsection-hd">${pTitle}</div>`;
        gaps.forEach(s => {
          html += `<div class="std-item gap">
            <div class="std-row">
              <span class="std-id">${s.id}</span>
              <span class="std-text">${s.text}</span>
              <span class="badge badge-gap">gap</span>
            </div>
          </div>`;
        });
      });
    }

    if (poGaps.length) {
      html += `<div class="section-hd" style="margin-top:2rem">Uncovered Programme Outcomes (${poGaps.length})</div>`;
      const cats = [...new Set(poGaps.map(p => p.category))];
      cats.forEach(cat => {
        const gaps = poGaps.filter(p => p.category === cat);
        html += `<div class="subsection-hd">Category ${cat}: ${gaps[0]?.categoryTitle}</div>`;
        gaps.forEach(p => {
          html += `<div class="std-item gap">
            <div class="std-row">
              <span class="std-id">${p.id}</span>
              <span class="std-text">${p.text}</span>
              <span class="badge badge-gap">gap</span>
            </div>
          </div>`;
        });
      });
    }
  }

  c.innerHTML = html;
}

/* ── Filter event wiring ──────────────────────────────── */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const ft = this.dataset.filter;
    document.querySelectorAll(`.filter-btn[data-filter="${ft}"]`).forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    filters[ft] = this.dataset.value;
    render();
  });
});

document.getElementById('search').addEventListener('input', function () {
  filters.search = this.value.trim();
  render();
});

loadData();
