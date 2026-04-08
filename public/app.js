// ===== DEBATE AUDITOR — Dynamic Rendering Engine =====

// Utility: get URL params (supports ?id=x and #id=x as fallback)
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key)
    || new URLSearchParams(window.location.hash.replace('#', '')).get(key);
}

// Utility: fetch JSON using relative paths (works on any host/subdirectory)
async function loadJSON(path) {
  const relativePath = path.startsWith('/') ? path.slice(1) : path;
  const res = await fetch(relativePath, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${relativePath}: ${res.status}`);
  return res.json();
}

// Utility: score class
function scoreClass(score) {
  if (score >= 80) return 'reliable';
  if (score >= 60) return 'caution';
  return 'unreliable';
}

function scoreColor(score) {
  if (score >= 80) return 'var(--green)';
  if (score >= 60) return 'var(--yellow)';
  return 'var(--red-light)';
}

// Utility: thesis track record strip
function verdictStripHTML(c) {
  const d = c.verdictDistribution || { intact: 0, compromised: 0, collapsed: 0 };
  const total = d.intact + d.compromised + d.collapsed;
  if (total === 0) return '';

  const segments = [
    { count: d.intact,     color: 'var(--green)',     label: 'INTACT' },
    { count: d.compromised,color: 'var(--orange)',    label: 'COMPROMISED' },
    { count: d.collapsed,  color: 'var(--red-light)', label: 'COLLAPSED' },
  ].filter(s => s.count > 0);

  const holds = d.intact === total ? 'All arguments hold' :
                d.intact === 0    ? 'No arguments hold' :
                `${d.intact} of ${total} arguments hold`;

  return `
    <div class="thesis-track">
      <div class="thesis-track-label">
        <span>Thesis Track Record</span>
        <span class="thesis-summary">${holds}</span>
      </div>
      <div class="verdict-strip">
        ${segments.map(s => `<div class="verdict-segment" style="flex:${s.count};background:${s.color}" title="${s.count} ${s.label}"></div>`).join('')}
      </div>
      <div class="verdict-strip-counts">
        ${d.intact     > 0 ? `<span style="color:var(--green)">&#9632; ${d.intact} INTACT</span>` : ''}
        ${d.compromised> 0 ? `<span style="color:var(--orange)">&#9632; ${d.compromised} COMPROMISED</span>` : ''}
        ${d.collapsed  > 0 ? `<span style="color:var(--red-light)">&#9632; ${d.collapsed} COLLAPSED</span>` : ''}
      </div>
    </div>`;
}

function verdictLabel(score) {
  if (score >= 80) return 'Reliable';
  if (score >= 60) return 'Caution';
  return 'Unreliable';
}

function claimClass(verdict) {
  if (verdict === 'true') return 'true';
  if (verdict === 'false') return 'false';
  if (verdict === 'misleading') return 'misleading';
  return 'disputed';
}

function claimLabel(verdict) {
  return verdict.charAt(0).toUpperCase() + verdict.slice(1);
}

// Utility: format date nicely
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr; // return as-is if can't parse
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ===== SEARCH =====
function initSearch(creators, allAnalyses) {
  const input = document.querySelector('.nav-search input');
  if (!input) return;

  // Create results dropdown
  let dropdown = document.querySelector('.search-results');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'search-results';
    input.parentElement.appendChild(dropdown);
  }

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (q.length < 2) { dropdown.classList.remove('active'); return; }

    const results = [];

    // Search creators
    creators.forEach(c => {
      if (c.name.toLowerCase().includes(q) || c.channel.toLowerCase().includes(q) || c.topics.some(t => t.toLowerCase().includes(q))) {
        results.push({ type: 'creator', name: c.name, subtitle: c.channel, score: c.cumulativeScore, url: `creator.html?id=${c.id}` });
      }
    });

    // Search analyses
    (allAnalyses || []).forEach(a => {
      if (a.videoTitle.toLowerCase().includes(q) || a.thesis.toLowerCase().includes(q)) {
        results.push({ type: 'video', name: a.videoTitle, subtitle: a.creatorName, score: a.dashboard.sessionScore, url: `analysis.html?id=${a.id}` });
      }
    });

    if (results.length === 0) {
      dropdown.innerHTML = '<div style="padding:12px 14px;font-size:0.8rem;color:var(--text-muted)">No results found</div>';
    } else {
      dropdown.innerHTML = results.slice(0, 8).map(r => `
        <a href="${r.url}" class="search-result-item">
          <span class="sr-score" style="background:${scoreColor(r.score)}20;color:${scoreColor(r.score)}">${r.score}%</span>
          <div>
            <div style="font-weight:600;font-size:0.8rem">${r.name}</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">${r.subtitle}</div>
          </div>
        </a>
      `).join('');
    }
    dropdown.classList.add('active');
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-search')) dropdown.classList.remove('active');
  });
}

// ===== HOMEPAGE =====
async function renderHomepage() {
  const creators = await loadJSON('/data/creators.json');

  // Hero creator pills
  const pillsEl = document.getElementById('hero-creator-pills');
  if (pillsEl) {
    pillsEl.innerHTML = creators.filter(c => c.sessions >= 2).map(c =>
      `<a href="creator.html?id=${c.id}" class="hero-creator-pill">
        <span class="hero-pill-avatar" style="background:${c.avatarColor}">${c.initials}</span>
        ${c.name}
      </a>`
    ).join('');
  }

  // Stats — only count creators with 2+ sessions
  const visibleCreators = creators.filter(c => c.sessions >= 2);
  const totalClaims = visibleCreators.reduce((s, c) => s + c.totalClaims, 0);
  document.getElementById('stat-videos').textContent = visibleCreators.reduce((s, c) => s + c.sessions, 0);
  document.getElementById('stat-creators').textContent = visibleCreators.length;
  document.getElementById('stat-claims').textContent = totalClaims.toLocaleString() + '+';


  // Pre-load all analyses in parallel so expand is instant
  const analysesMap = {};
  await Promise.all(
    creators.flatMap(c => c.analyses.map(aId =>
      loadJSON(`/data/analyses/${aId}.json`)
        .then(a => { analysesMap[aId] = a; })
        .catch(() => {})
    ))
  );

  // Set latest analysis date from loaded data
  const latestDate = Object.values(analysesMap)
    .map(a => a && a.dateAnalyzed)
    .filter(Boolean)
    .sort()
    .pop();
  // stat-latest removed from homepage UI

  // Sort helpers
  let sortMode = 'thesis-track';

  function thesisSortKey(c) {
    const d = c.verdictDistribution || { intact: 0, compromised: 0, collapsed: 0 };
    const total = d.intact + d.compromised + d.collapsed;
    return total ? d.intact / total : 0;
  }

  function renderCreatorRows(mode) {
    const sorted = [...creators].filter(c => c.sessions >= 2);
    if (mode === 'thesis-track') {
      sorted.sort((a, b) => {
        const diff = thesisSortKey(b) - thesisSortKey(a);
        if (diff !== 0) return diff;
        const da = a.verdictDistribution || {}; const db = b.verdictDistribution || {};
        return (db.intact || 0) - (da.intact || 0);
      });
    } else if (mode === 'score-asc') sorted.sort((a, b) => a.cumulativeScore - b.cumulativeScore);
    else if (mode === 'score-desc') sorted.sort((a, b) => b.cumulativeScore - a.cumulativeScore);
    else sorted.sort((a, b) => b.sessions - a.sessions);

    // Preserve open state across re-renders
    const openIds = new Set([...document.querySelectorAll('.creator-row.open')].map(el => el.dataset.id));

    const list = document.getElementById('creators-list');
    list.innerHTML = sorted.map(c => {
      const d = c.verdictDistribution || { intact: 0, compromised: 0, collapsed: 0 };
      const total = d.intact + d.compromised + d.collapsed;
      const holdText = d.intact === total ? 'All theses hold' :
                       d.intact === 0     ? 'No theses hold' :
                       `${d.intact} of ${total} theses hold`;

      const dotsHTML = `<div class="rd-dots">${c.analyses.map(aId => {
        const a = analysesMap[aId];
        if (!a || !a.structuralVerdict) return '<div class="rd-dot" style="background:var(--border)" title="No verdict"></div>';
        const status = a.structuralVerdict.status.toLowerCase();
        const color = status === 'intact' ? 'var(--green)' : status === 'compromised' ? 'var(--orange)' : 'var(--red-light)';
        return `<div class="rd-dot" style="background:${color}" title="${a.structuralVerdict.status}"></div>`;
      }).join('')}</div>`;

      const analysisRows = c.analyses.map(aId => {
        const a = analysesMap[aId];
        if (!a || !a.dashboard) return '';
        const sv = a.structuralVerdict;
        const svChip = sv ? `<span class="rd-verdict-chip rd-${sv.status.toLowerCase()}">${sv.status}</span>` : '';
        return `
          <a href="analysis.html?id=${aId}" class="rd-analysis-item">
            <span class="rd-score ${scoreClass(a.dashboard.sessionScore)}">${a.dashboard.sessionScore}%</span>
            <span class="rd-title">${a.videoTitle}</span>
            ${svChip}
            <svg class="rd-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>`;
      }).join('');

      const isOpen = openIds.has(c.id) ? ' open' : '';
      return `
        <div class="creator-row${isOpen}" data-id="${c.id}">
          <div class="creator-row-header">
            <div class="creator-avatar" style="background:${c.avatarColor};width:40px;height:40px;font-size:0.85rem;flex-shrink:0">${c.initials}</div>
            <div class="creator-row-info">
              <div class="creator-row-name">${c.name}${c.sessions === 1 ? ' <span class="early-badge">EARLY DATA</span>' : ''}</div>
              <div class="creator-row-channel">${c.channel}</div>
            </div>
            <div class="creator-row-track">
              <div class="rd-track-label">Thesis Track Record</div>
              ${dotsHTML}
              <div class="rd-hold-text">${holdText}</div>
            </div>
            <div class="creator-row-right">
              <span class="score-badge ${scoreClass(c.cumulativeScore)}" style="font-size:0.8rem;padding:4px 12px"><span class="dot"></span>${c.cumulativeScore}% accuracy score</span>
              <div class="creator-row-sessions">${c.sessions} session${c.sessions > 1 ? 's' : ''} analyzed</div>
            </div>
            <svg class="creator-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="creator-row-expand">
            <div class="rd-col-header">
              <span class="rd-col-score">Session Score</span>
              <span class="rd-col-title">Video</span>
              <span class="rd-col-verdict">Thesis</span>
            </div>
            ${analysisRows}
            <div class="rd-expand-footer">
              <div class="rd-cumulative">
                <span class="score-badge ${scoreClass(c.cumulativeScore)}" style="font-size:0.72rem;padding:3px 12px"><span class="dot"></span>${c.cumulativeScore}% cumulative</span>
                <span class="rd-cumulative-label">${c.sessions} session${c.sessions > 1 ? 's' : ''} analyzed</span>
              </div>
              <a href="creator.html?id=${c.id}" class="rd-profile-link-btn">View full profile →</a>
            </div>
          </div>
        </div>`;
    }).join('');

    // Click handlers
    list.querySelectorAll('.creator-row-header').forEach(header => {
      header.addEventListener('click', () => {
        const row = header.closest('.creator-row');
        row.classList.toggle('open');
      });
    });
  }

  renderCreatorRows(sortMode);

  // Sort buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sortMode = btn.dataset.sort;
      renderCreatorRows(sortMode);
    });
  });


  // Init search using pre-loaded analyses
  const allAnalyses = Object.values(analysesMap);
  initSearch(creators, allAnalyses);
}

// ===== CREATOR PROFILE =====
async function renderCreator() {
  const id = getParam('id');
  const creators = await loadJSON('/data/creators.json');
  const creator = creators.find(c => c.id === id);
  if (!creator) { document.body.innerHTML = '<p style="padding:40px;text-align:center">Creator not found.</p>'; return; }

  document.title = `${creator.name} — Act17:11`;

  document.getElementById('creator-avatar').textContent = creator.initials;
  document.getElementById('creator-avatar').style.background = creator.avatarColor;
  document.getElementById('creator-name').textContent = creator.name;
  document.getElementById('creator-channel').textContent = `${creator.channel} · ${creator.platform}`;
  document.getElementById('stat-sessions').textContent = creator.sessions;
  document.getElementById('stat-claims').textContent = creator.totalClaims.toLocaleString();
  document.getElementById('stat-true').textContent = creator.trueClaims.toLocaleString();

  // score ring removed from creator header — score shown as text in thesis block

  document.getElementById('creator-topics').innerHTML = creator.topics.map(t => `<span class="topic-tag">${t}</span>`).join('');

  const posColor = scoreColor(creator.cumulativeScore);
  document.getElementById('core-positions').innerHTML = creator.corePositions.map(p =>
    `<span style="padding:6px 14px;border-radius:20px;font-size:0.8rem;background:rgba(108,92,231,0.1);color:var(--accent-light);border:1px solid rgba(108,92,231,0.2)">${p}</span>`
  ).join('');

  document.getElementById('notable-patterns').innerHTML = creator.notablePatterns.map(p => `
    <div style="display:flex;align-items:start;gap:12px">
      <div style="width:8px;height:8px;border-radius:50%;background:${posColor};margin-top:7px;flex-shrink:0"></div>
      <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.6">${p}</p>
    </div>
  `).join('');

  const analyses = [];
  for (const aId of creator.analyses) {
    try {
      const a = await loadJSON(`/data/analyses/${aId}.json`);
      analyses.push(a);
    } catch (e) { /* skip */ }
  }

  // Thesis track panel — primary signal
  const trackEl = document.getElementById('profile-thesis-track');
  if (trackEl) {
    const d = creator.verdictDistribution || {};
    const total = (d.intact||0) + (d.compromised||0) + (d.collapsed||0);
    const holdText = d.intact === total ? 'All theses hold' :
                     d.intact === 0     ? 'No theses hold' :
                     `${d.intact} of ${total} theses hold`;
    const dots = analyses.map(a => {
      if (!a.structuralVerdict) return `<div style="width:14px;height:14px;border-radius:50%;background:var(--border);flex-shrink:0"></div>`;
      const status = a.structuralVerdict.status.toLowerCase();
      const color = status === 'intact' ? 'var(--green)' : status === 'compromised' ? 'var(--orange)' : 'var(--red-light)';
      return `<div title="${a.structuralVerdict.status}" style="width:14px;height:14px;border-radius:50%;background:${color};flex-shrink:0"></div>`;
    }).join('');
    const dist = [
      d.intact     > 0 ? `<span style="color:var(--green);font-weight:600">${d.intact} INTACT</span>` : '',
      d.compromised> 0 ? `<span style="color:var(--orange);font-weight:600">${d.compromised} COMPROMISED</span>` : '',
      d.collapsed  > 0 ? `<span style="color:var(--red-light);font-weight:600">${d.collapsed} COLLAPSED</span>` : '',
    ].filter(Boolean).join('<span style="color:var(--border);margin:0 8px">·</span>');
    trackEl.innerHTML = `
      <div class="profile-track-label">Thesis Track Record</div>
      <div class="profile-track-hold">${holdText}</div>
      <div class="profile-track-dots">${dots}</div>
      <div class="profile-track-dist">${dist}</div>
      <div class="profile-track-score">
        <span style="color:${scoreColor(creator.cumulativeScore)};font-weight:700">${creator.cumulativeScore}%</span>
        <span style="color:var(--text-muted)"> · ${creator.verdict}</span>
      </div>
    `;
  }

  const trendContainer = document.getElementById('trend-sessions');
  trendContainer.innerHTML = analyses.map(a => {
    const color = scoreColor(a.dashboard.sessionScore);
    return `
      <div class="trend-session">
        <div class="trend-bar-fill" style="height:${a.dashboard.sessionScore}%;background:${color}">
          <div class="bar-label" style="color:${color}">${a.dashboard.sessionScore}%</div>
        </div>
        <div class="session-label">Session ${a.sessionNumber}<br><span style="font-size:0.65rem">${verdictLabel(a.dashboard.sessionScore)}</span></div>
      </div>
    `;
  }).join('');

  document.getElementById('analyses-list').innerHTML = analyses.map(a => {
    const sv = a.structuralVerdict;
    const svStatus = sv ? sv.status.toLowerCase() : null;
    const svColor = svStatus === 'intact' ? 'var(--green)' : svStatus === 'compromised' ? 'var(--orange)' : svStatus === 'collapsed' ? 'var(--red-light)' : 'var(--text-muted)';
    const svBg = svStatus === 'intact' ? 'rgba(0,206,201,0.1)' : svStatus === 'compromised' ? 'rgba(225,112,85,0.1)' : svStatus === 'collapsed' ? 'rgba(214,48,49,0.1)' : 'rgba(255,255,255,0.04)';
    const svLabel = sv ? sv.status : '—';
    const argType = a.argumentType || '';
    const tcCount = a.thesisCriticalErrors ? a.thesisCriticalErrors.count : null;
    return `
    <a href="analysis.html?id=${a.id}" class="analysis-row-v2" style="text-decoration:none;color:inherit">
      <div class="arv2-verdict" style="background:${svBg};border-color:${svColor}40;color:${svColor}">${svLabel}</div>
      <div class="arv2-info">
        <div class="arv2-title">${a.videoTitle}</div>
        <div class="arv2-meta">
          <span>Session ${a.sessionNumber}</span>
          ${argType ? `<span class="arv2-argtype">${argType}</span>` : ''}
          ${tcCount ? `<span style="color:var(--red-light);font-size:0.7rem">⚠ ${tcCount} thesis-critical error${tcCount !== '1' ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="arv2-score">
        <span class="score-badge ${scoreClass(a.dashboard.sessionScore)}" style="font-size:0.75rem;padding:3px 10px"><span class="dot"></span>${a.dashboard.sessionScore}%</span>
        <span class="arv2-score-label">accuracy</span>
      </div>
    </a>
  `}).join('');

  // Init search
  initSearch(creators, []);
}

// ===== ANALYSIS PAGE =====
async function renderAnalysis() {
  const id = getParam('id');
  const a = await loadJSON(`/data/analyses/${id}.json`);
  if (!a) { document.body.innerHTML = '<p style="padding:40px;text-align:center">Analysis not found.</p>'; return; }

  document.title = `${a.videoTitle} — Act17:11`;

  // Breadcrumb
  document.getElementById('breadcrumb').innerHTML = `<a href="index.html">Home</a> &rarr; <a href="creator.html?id=${a.creatorId}">${a.creatorName}</a> &rarr; Session ${a.sessionNumber}`;

  // Header
  document.getElementById('analysis-title').textContent = a.videoTitle;
  document.getElementById('date-published').textContent = `Published ${a.datePublished}`;
  document.getElementById('date-analyzed').textContent = `Analyzed ${formatDate(a.dateAnalyzed)}`;
  document.getElementById('creator-link').innerHTML = `<a href="creator.html?id=${a.creatorId}">${a.channel}</a>`;
  document.getElementById('analyzed-range').textContent = `Full transcript (${a.analyzedRange})`;

  // Source embed + link (YouTube, paper, book)
  const contentType = a.contentType || 'video';
  if (a.videoUrl) {
    const url = a.videoUrl;
    const isYouTube = url.includes('youtu.be/') || url.includes('youtube.com/');

    if (isYouTube) {
      let videoId = '';
      if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split(/[?&#]/)[0];
      else if (url.includes('v=')) videoId = url.split('v=')[1].split(/[&#]/)[0];

      document.getElementById('youtube-link').innerHTML = `
        <div style="margin-top:16px;border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);background:#000">
          <div style="position:relative;padding-bottom:56.25%;height:0">
            <iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>
          </div>
        </div>
        <a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:rgba(214,48,49,0.12);border:1px solid rgba(214,48,49,0.3);border-radius:20px;color:#ff4444;font-size:0.85rem;font-weight:600;text-decoration:none;margin-top:12px">&#9654; Open on YouTube</a>
      `;
    } else {
      const icon = contentType === 'paper' ? '&#128196;' : contentType === 'book' ? '&#128214;' : '&#128279;';
      const label = contentType === 'paper' ? 'View Paper' : contentType === 'book' ? 'View Book' : 'View Source';
      document.getElementById('youtube-link').innerHTML = `
        <a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:rgba(108,92,231,0.12);border:1px solid rgba(108,92,231,0.3);border-radius:20px;color:var(--accent-light);font-size:0.85rem;font-weight:600;text-decoration:none;margin-top:16px">${icon} ${label}</a>
      `;
    }
  }

  // View Full Report button
  if (a.reportFile) {
    const reportBtn = document.createElement('a');
    reportBtn.href = `report.html?file=${encodeURIComponent(a.reportFile)}&analysis=${a.id}`;
    reportBtn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:rgba(0,206,201,0.12);border:1px solid rgba(0,206,201,0.3);border-radius:20px;color:var(--green);font-size:0.85rem;font-weight:600;text-decoration:none;margin-top:12px;margin-left:8px';
    reportBtn.innerHTML = '&#128203; View Full Report';
    const ytLink = document.getElementById('youtube-link');
    if (ytLink) ytLink.appendChild(reportBtn);
  }

  // TL;DR Summary Card — verdict leads
  const d = a.dashboard;
  const svForTldr = a.structuralVerdict;
  const svTldrStatus = svForTldr ? svForTldr.status.toLowerCase() : null;
  const svTldrColor = svTldrStatus === 'intact' ? 'var(--green)' : svTldrStatus === 'compromised' ? 'var(--orange)' : svTldrStatus === 'collapsed' ? 'var(--red-light)' : 'var(--text-muted)';
  const svTldrBg = svTldrStatus === 'intact' ? 'rgba(0,206,201,0.1)' : svTldrStatus === 'compromised' ? 'rgba(225,112,85,0.1)' : svTldrStatus === 'collapsed' ? 'rgba(214,48,49,0.1)' : 'rgba(255,255,255,0.04)';
  document.getElementById('tldr-card').innerHTML = `
    <div class="tldr-item tldr-verdict" style="border-right:1px solid var(--border);padding-right:16px;margin-right:4px">
      <div style="font-size:1rem;font-weight:800;letter-spacing:0.05em;color:${svTldrColor};padding:6px 14px;background:${svTldrBg};border:1px solid ${svTldrColor}40;border-radius:8px">${svForTldr ? svForTldr.status : '—'}</div>
      <div class="tldr-label">Thesis Verdict</div>
    </div>
    <div class="tldr-item">
      <div class="tldr-val" style="color:var(--green)">${d.trueClaims}</div>
      <div class="tldr-label">True</div>
    </div>
    <div class="tldr-item">
      <div class="tldr-val" style="color:var(--red-light)">${d.falseMisleading}</div>
      <div class="tldr-label">False</div>
    </div>
    <div class="tldr-item">
      <div class="tldr-val" style="color:${scoreColor(d.sessionScore)}">${d.sessionScore}%</div>
      <div class="tldr-label">Accuracy</div>
    </div>
  `;

  document.getElementById('thesis-text').textContent = a.thesis;

  // Dashboard secondary row
  const cumScore = d.cumulativeScore || d.sessionScore;
  document.getElementById('session-pct').textContent = `${d.sessionScore}%`;
  document.getElementById('session-pct').style.color = scoreColor(d.sessionScore);
  document.getElementById('session-verdict').textContent = verdictLabel(d.sessionScore);
  document.getElementById('session-verdict').style.color = scoreColor(d.sessionScore);
  const cumEl = document.getElementById('cumulative-pct');
  cumEl.textContent = `${cumScore}%`;
  cumEl.style.color = scoreColor(cumScore);
  document.getElementById('cumulative-label').textContent = d.cumulativeScore
    ? `(${d.cumulativeSessions} session${d.cumulativeSessions > 1 ? 's' : ''})`
    : '(first session)';

  document.getElementById('dash-true').textContent = d.trueClaims;
  document.getElementById('dash-false').textContent = d.falseMisleading;
  document.getElementById('dash-disputed').textContent = d.disputed;
  document.getElementById('dash-total').textContent = d.totalChecked;
  document.getElementById('dash-confidence').textContent = d.confidence;
  document.getElementById('dash-stratagems').textContent = d.stratagems;
  document.getElementById('dash-weasel').textContent = d.weaselWords;
  document.getElementById('dash-error').textContent = d.errorImpact ? `${d.errorImpact}%` : 'N/A';

  document.getElementById('tab-claims-count').textContent = `All Claims (${d.totalChecked})`;

  // Structural Verdict panel
  const svPanel = document.getElementById('structural-verdict-panel');
  if (svPanel && a.structuralVerdict) {
    const sv = a.structuralVerdict;
    const statusColors = {
      'COLLAPSED':   { border: '#d63031', bg: 'rgba(214,48,49,0.07)',   text: 'var(--red-light)',   dot: '#d63031' },
      'COMPROMISED': { border: '#e17055', bg: 'rgba(225,112,85,0.07)',  text: 'var(--orange)',      dot: '#e17055' },
      'INTACT':      { border: '#00b894', bg: 'rgba(0,184,148,0.07)',   text: 'var(--green)',       dot: '#00b894' },
    };
    const sc = statusColors[sv.status] || statusColors['COMPROMISED'];
    const tcErr = a.thesisCriticalErrors;
    const argType = a.argumentType ? `<span style="display:inline-block;padding:2px 10px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:20px;font-size:0.75rem;color:var(--text-muted);margin-left:10px">${a.argumentType}</span>` : '';
    svPanel.style.display = 'block';
    svPanel.innerHTML = `
      <div style="border:1px solid ${sc.border};background:${sc.bg};border-radius:var(--radius);padding:20px 24px;border-left:4px solid ${sc.border}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <span style="width:8px;height:8px;border-radius:50%;background:${sc.dot};display:inline-block;flex-shrink:0"></span>
          <span style="font-size:0.8rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${sc.text}">Structural Verdict: ${sv.status}</span>
          ${argType}
        </div>
        <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.6;margin-bottom:${tcErr ? '14px' : '0'}">${sv.explanation}</p>
        ${tcErr ? `
        <div style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.08)">
          <span style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:${sc.text}">Load-Bearing Errors: ${tcErr.count}</span>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;line-height:1.5">${tcErr.description} — <em>marked ⚠ in the Top False Claims tab</em></p>
        </div>` : ''}
      </div>
    `;
  }

  // False claims — with filters
  const fcCategories = [...new Set(a.falseClaims.map(fc => fc.category).filter(Boolean))];
  const fcRatings = [...new Set(a.falseClaims.map(fc => fc.rating.split(' ·')[0].trim()))];

  function renderFalseClaims(catFilter, ratingFilter) {
    let filtered = a.falseClaims;
    if (catFilter !== 'all') filtered = filtered.filter(fc => fc.category === catFilter);
    if (ratingFilter !== 'all') filtered = filtered.filter(fc => fc.rating.startsWith(ratingFilter));

    return `
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Weight:</span>
          <button class="filter-btn ${catFilter === 'all' ? 'active' : ''}" data-fc-cat="all">All</button>
          ${fcCategories.map(c => `<button class="filter-btn ${catFilter === c ? 'active' : ''}" data-fc-cat="${c}">${c}</button>`).join('')}
        </div>
        <div class="filter-group">
          <span class="filter-label">Rating:</span>
          <button class="filter-btn ${ratingFilter === 'all' ? 'active' : ''}" data-fc-rating="all">All</button>
          ${fcRatings.map(r => `<button class="filter-btn ${ratingFilter === r ? 'active' : ''}" data-fc-rating="${r}">${r}</button>`).join('')}
        </div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">Showing ${filtered.length} of ${a.falseClaims.length} false/misleading claims</div>
      ${filtered.map(fc => {
        const catColor = fc.category === 'Core' ? 'var(--red-light)' : fc.category === 'Support' ? 'var(--orange)' : 'var(--text-muted)';
        const borderColor = fc.category === 'Core' ? '#d63031' : fc.category === 'Support' ? '#e17055' : '#636e72';
        return `
        <div class="false-claim-detail" style="border-left:3px solid ${borderColor}">
          <div class="fc-meta-row">
            <span class="rating">${fc.rating}</span>
            <span class="fc-confidence">${fc.confidence} Confidence</span>
            ${fc.category ? `<span class="fc-weight-tag" style="color:${catColor}">${fc.category} · ${fc.category === 'Core' ? '3×' : fc.category === 'Support' ? '2×' : '1×'} weight</span>` : ''}
            ${fc.thesisCritical ? `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:rgba(214,48,49,0.15);border:1px solid rgba(214,48,49,0.35);border-radius:20px;font-size:0.7rem;font-weight:700;color:var(--red-light);letter-spacing:0.04em">⚠ Load-Bearing</span>` : ''}
            <span class="fc-timestamp">${fc.timestamp}</span>
          </div>
          <h4>"${fc.claim}"</h4>
          <p class="evidence">${fc.evidence}</p>
          <p class="settle">What would settle it: ${fc.settle}</p>
          ${fc.sources && fc.sources.length > 0 ? `
            <div class="fc-sources">
              <div class="fc-sources-label">Sources</div>
              ${fc.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener" class="fc-source-link">${s.label} &rarr;</a>`).join('')}
            </div>
          ` : ''}
        </div>
      `}).join('')}
    `;
  }

  let fcCatFilter = 'all', fcRatingFilter = 'all';
  document.getElementById('false-claims-tab').innerHTML = renderFalseClaims(fcCatFilter, fcRatingFilter);

  document.getElementById('false-claims-tab').addEventListener('click', (e) => {
    const catBtn = e.target.closest('[data-fc-cat]');
    const ratBtn = e.target.closest('[data-fc-rating]');
    if (catBtn) { fcCatFilter = catBtn.dataset.fcCat; document.getElementById('false-claims-tab').innerHTML = renderFalseClaims(fcCatFilter, fcRatingFilter); }
    if (ratBtn) { fcRatingFilter = ratBtn.dataset.fcRating; document.getElementById('false-claims-tab').innerHTML = renderFalseClaims(fcCatFilter, fcRatingFilter); }
  });

  // Stratagems
  document.getElementById('stratagems-tab').innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-bottom:20px;border-left:4px solid var(--orange)">
      <div style="font-size:0.95rem;font-weight:700;margin-bottom:8px;color:var(--orange)">What are Rhetorical Tricks?</div>
      <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.6;margin-bottom:10px">Rhetorical tricks are argument tactics used to win a debate regardless of whether the position is actually true. We identify them using Arthur Schopenhauer's <em>The Art of Being Right</em> (1831), which cataloged 38 dishonest debate moves still widely used today.</p>
      <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.6;margin-bottom:10px">Finding these tricks doesn't mean the speaker is lying. It means they used persuasion techniques that skip past the evidence. A speaker can be right about something and still use a rhetorical trick to argue for it.</p>
      <a href="https://en.wikipedia.org/wiki/The_Art_of_Being_Right" target="_blank" rel="noopener" style="font-size:0.8rem;color:var(--accent-light);text-decoration:none">Learn more about Schopenhauer's 38 tactics &rarr;</a>
    </div>
  ` + a.stratagems.map(s => `
    <div class="stratagem-card">
      <div class="strat-header">
        <span class="strat-badge">Strat #${s.number}</span>
        <span class="strat-title">${s.name}</span>
        <span class="strat-instances">${s.instances} instance${s.instances > 1 ? 's' : ''}</span>
      </div>
      ${s.entries.map((e, i) => `
        ${i > 0 ? '<hr style="border:none;border-top:1px solid var(--border);margin:14px 0">' : ''}
        <blockquote>"${e.quote}"</blockquote>
        <p class="strat-explanation">${e.explanation}</p>
      `).join('')}
    </div>
  `).join('');

  // All claims — with verdict filters
  const verdictTypes = ['all', 'true', 'false', 'misleading', 'disputed'];
  const verdictColors = { all: 'var(--text)', true: 'var(--green)', false: 'var(--red-light)', misleading: 'var(--orange)', disputed: 'var(--yellow)' };
  const verdictCounts = { all: a.allClaims.length };
  a.allClaims.forEach(c => { verdictCounts[c.verdict] = (verdictCounts[c.verdict] || 0) + 1; });

  function renderAllClaims(filter) {
    const filtered = filter === 'all' ? a.allClaims : a.allClaims.filter(c => c.verdict === filter);
    return `
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Show:</span>
          ${verdictTypes.map(v => verdictCounts[v] ? `<button class="filter-btn ${filter === v ? 'active' : ''}" data-claim-filter="${v}" style="${filter === v ? 'color:' + verdictColors[v] : ''}">${claimLabel(v)} (${verdictCounts[v] || 0})</button>` : '').join('')}
        </div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">Showing ${filtered.length} of ${a.allClaims.length} claims</div>
      ${filtered.map(c => `
        <div class="claim-item">
          <div class="claim-num">${c.num}</div>
          <div class="claim-text">${c.text} <span class="timestamp">${c.timestamp}</span></div>
          <div class="claim-verdict ${claimClass(c.verdict)}">${claimLabel(c.verdict)}</div>
        </div>
      `).join('')}
    `;
  }

  let claimFilter = 'all';
  document.getElementById('all-claims-tab').innerHTML = renderAllClaims(claimFilter);

  document.getElementById('all-claims-tab').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-claim-filter]');
    if (btn) { claimFilter = btn.dataset.claimFilter; document.getElementById('all-claims-tab').innerHTML = renderAllClaims(claimFilter); }
  });

  // Scholarly splits
  if (a.scholarlySplits && a.scholarlySplits.length > 0) {
    document.getElementById('scholarly-tab').innerHTML = `
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:20px">Claims where there is a genuine scholarly divide — neither side is definitively settled.</p>
      ${a.scholarlySplits.map(s => `
        <div class="stratagem-card">
          <div class="strat-header">
            <span class="strat-badge" style="background:rgba(253,203,110,0.15);color:var(--yellow)">Disputed</span>
            <span class="strat-title">${s.claim}</span>
            <span class="strat-instances">${s.timestamp}</span>
          </div>
          <p class="strat-explanation">${s.nature}</p>
        </div>
      `).join('')}
    `;
  } else {
    document.getElementById('scholarly-tab').innerHTML = '<p style="font-size:0.85rem;color:var(--text-muted)">No major scholarly splits identified in this analysis.</p>';
  }

  // True claims
  document.getElementById('true-claims-tab').innerHTML = `
    <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px">Claims verified as accurate with scholarly sources.</p>
    ${a.trueClaims.map(t => `
      <div class="claim-item">
        <div class="claim-num" style="background:rgba(0,206,201,0.2);color:var(--green)">&#10003;</div>
        <div class="claim-text">${t}</div>
        <div class="claim-verdict true">True</div>
      </div>
    `).join('')}
  `;

  // Steelman — hide if empty
  const steelmanSection = document.getElementById('steelman-section');
  if (a.steelman && steelmanSection) {
    document.getElementById('steelman-text').textContent = a.steelman;
  } else if (steelmanSection) {
    steelmanSection.style.display = 'none';
  }

  // YouTube flags — hide if empty
  const ytSection = document.getElementById('youtube-flags-section');
  if (a.youtubeFlags && a.youtubeFlags.length > 0) {
    document.getElementById('youtube-flags').innerHTML = a.youtubeFlags.map(f => {
      const colors = { warning: 'var(--orange)', caution: 'var(--yellow)', info: 'var(--text-muted)' };
      return `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px 20px;display:flex;align-items:start;gap:12px">
          <div style="width:8px;height:8px;border-radius:50%;background:${colors[f.severity] || 'var(--text-muted)'};margin-top:7px;flex-shrink:0"></div>
          <div>
            <div style="font-weight:600;font-size:0.85rem;margin-bottom:4px">${f.type}</div>
            <p style="font-size:0.8rem;color:var(--text-muted);line-height:1.5">${f.text}</p>
          </div>
        </div>
      `;
    }).join('');
  } else if (ytSection) {
    ytSection.style.display = 'none';
  }

  // Weighted analysis — hide if empty
  const weightedSection = document.getElementById('weighted-section');
  if (a.weightedAnalysis) {
    const wa = a.weightedAnalysis;
    document.getElementById('weighted-analysis').innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
        <thead>
          <tr style="border-bottom:2px solid var(--border)">
            <th style="text-align:left;padding:10px 12px;color:var(--text-muted);font-weight:600">Category</th>
            <th style="text-align:center;padding:10px 12px;color:var(--text-muted);font-weight:600">Claims</th>
            <th style="text-align:center;padding:10px 12px;color:var(--text-muted);font-weight:600">Weight</th>
            <th style="text-align:center;padding:10px 12px;color:var(--green);font-weight:600">True</th>
            <th style="text-align:center;padding:10px 12px;color:var(--red-light);font-weight:600">False</th>
            <th style="text-align:center;padding:10px 12px;color:var(--yellow);font-weight:600">Disputed</th>
          </tr>
        </thead>
        <tbody>
          ${wa.categories.map(cat => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:10px 12px;font-weight:600">${cat.name}</td>
              <td style="text-align:center;padding:10px 12px">${cat.claims}</td>
              <td style="text-align:center;padding:10px 12px">${cat.weight}x</td>
              <td style="text-align:center;padding:10px 12px;color:var(--green)">${cat.trueWeighted}</td>
              <td style="text-align:center;padding:10px 12px;color:var(--red-light)">${cat.falseWeighted}</td>
              <td style="text-align:center;padding:10px 12px;color:var(--yellow)">${cat.disputedWeighted}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top:16px;padding:16px;background:rgba(214,48,49,0.08);border-radius:var(--radius-sm);border:1px solid rgba(214,48,49,0.2)">
        <div style="font-size:0.8rem;font-weight:700;color:var(--red-light);margin-bottom:6px">Weighted Error: ${wa.errorImpact}% — ${wa.interpretation.split('.')[0]}</div>
        <p style="font-size:0.8rem;color:var(--text-muted);line-height:1.5">${wa.interpretation}</p>
      </div>
    `;
  } else if (weightedSection) {
    weightedSection.style.display = 'none';
  }

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Back to top button
  const btt = document.getElementById('back-to-top');
  if (btt) {
    window.addEventListener('scroll', () => {
      btt.classList.toggle('visible', window.scrollY > 400);
    });
    btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
}

// ===== ALL VIDEOS PAGE =====
async function renderVideosPage() {
  const creators = await loadJSON('/data/creators.json');

  // Load all analyses in parallel
  const allVideos = [];
  const allIds = creators.flatMap(c => c.analyses.map(aId => ({ aId, c })));
  const results = await Promise.all(
    allIds.map(({ aId, c }) =>
      loadJSON(`/data/analyses/${aId}.json`)
        .then(a => { a._creator = c; return a; })
        .catch(() => null)
    )
  );
  allVideos.push(...results.filter(Boolean));

  // Stats bar
  const totalClaims = allVideos.reduce((s, a) => s + a.dashboard.totalChecked, 0);
  const avgScore = allVideos.length > 0
    ? Math.round(allVideos.reduce((s, a) => s + a.dashboard.sessionScore, 0) / allVideos.length)
    : 0;
  document.getElementById('stat-videos').textContent = allVideos.length;
  document.getElementById('stat-claims').textContent = totalClaims.toLocaleString() + '+';
  document.getElementById('stat-avg').textContent = avgScore + '%';

  // Populate creator dropdown
  const creatorSelect = document.getElementById('creator-filter');
  const sortedCreators = [...creators].sort((a, b) => a.name.localeCompare(b.name));
  sortedCreators.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    creatorSelect.appendChild(opt);
  });

  // State
  let verdictFilter = 'all';
  let creatorFilter = 'all';
  let sortMode = 'date-desc';
  let searchQuery = '';

  function getVerdictKey(score) {
    if (score >= 80) return 'reliable';
    if (score >= 60) return 'caution';
    return 'unreliable';
  }

  function filterAndSort() {
    let filtered = [...allVideos];

    // Verdict filter
    if (verdictFilter !== 'all') {
      filtered = filtered.filter(a => getVerdictKey(a.dashboard.sessionScore) === verdictFilter);
    }

    // Creator filter
    if (creatorFilter !== 'all') {
      filtered = filtered.filter(a => a.creatorId === creatorFilter);
    }

    // Search
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.videoTitle.toLowerCase().includes(q) ||
        a.thesis.toLowerCase().includes(q) ||
        a.creatorName.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortMode === 'score-desc') filtered.sort((a, b) => b.dashboard.sessionScore - a.dashboard.sessionScore);
    else if (sortMode === 'score-asc') filtered.sort((a, b) => a.dashboard.sessionScore - b.dashboard.sessionScore);
    else if (sortMode === 'date-desc') filtered.sort((a, b) => new Date(b.dateAnalyzed) - new Date(a.dateAnalyzed));
    else if (sortMode === 'date-asc') filtered.sort((a, b) => new Date(a.dateAnalyzed) - new Date(b.dateAnalyzed));
    else if (sortMode === 'creator-asc') filtered.sort((a, b) => a.creatorName.localeCompare(b.creatorName));

    return filtered;
  }

  function render() {
    const filtered = filterAndSort();

    document.getElementById('results-count').textContent =
      `Showing ${filtered.length} of ${allVideos.length} analyses`;

    const grid = document.getElementById('video-cards-grid');
    if (filtered.length === 0) {
      grid.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);font-size:0.9rem">No analyses match your filters.</div>';
      return;
    }

    grid.innerHTML = filtered.map(a => {
      const d = a.dashboard;
      const score = d.sessionScore;
      const cls = scoreClass(score);
      const color = scoreColor(score);
      const cType = a.contentType || 'video';
      const isYT = a.videoUrl && (a.videoUrl.includes('youtu.be/') || a.videoUrl.includes('youtube.com/'));
      let sourceLink = '';
      if (a.videoUrl) {
        if (isYT) {
          sourceLink = `<a href="${a.videoUrl}" target="_blank" rel="noopener" class="yt-link" title="Watch on YouTube" onclick="event.stopPropagation()">&#9654; YouTube</a>`;
        } else {
          const icon = cType === 'paper' ? '&#128196;' : cType === 'book' ? '&#128214;' : '&#128279;';
          const lbl = cType === 'paper' ? 'Paper' : cType === 'book' ? 'Book' : 'Source';
          sourceLink = `<a href="${a.videoUrl}" target="_blank" rel="noopener" class="yt-link" title="View ${lbl}" onclick="event.stopPropagation()">${icon} ${lbl}</a>`;
        }
      }

      return `
        <div class="video-card" onclick="window.location.href='analysis.html?id=${a.id}'" style="text-decoration:none;color:inherit">
          <div class="video-card-header">
            <div class="video-card-creator">
              <div class="video-card-avatar" style="background:${a._creator.avatarColor}">${a._creator.initials}</div>
              <div>
                <div class="video-card-creator-name">${a.creatorName}</div>
                <div class="video-card-channel">${a.channel}</div>
              </div>
            </div>
            <div class="video-card-score-badge ${cls}">
              <span class="dot"></span>${score}% <span class="badge-verdict">${verdictLabel(score)}</span>
            </div>
          </div>
          <h3 class="video-card-title">${a.videoTitle}</h3>
          <div class="video-card-stats-inline">
            <span>${d.totalChecked} claims</span>
            <span style="color:var(--green)">${d.trueClaims} true</span>
            <span style="color:var(--red-light)">${d.falseMisleading} false</span>
            <span style="color:var(--yellow)">${d.disputed} disputed</span>
          </div>
          <div class="video-card-footer">
            <span class="video-card-date">${formatDate(a.dateAnalyzed)}</span>
            ${sourceLink}
          </div>
        </div>
      `;
    }).join('');
  }

  // Initial render
  render();

  // Event listeners — verdict pills
  document.getElementById('verdict-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-verdict]');
    if (!btn) return;
    document.querySelectorAll('#verdict-filter .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    verdictFilter = btn.dataset.verdict;
    render();
  });

  // Creator dropdown
  creatorSelect.addEventListener('change', () => {
    creatorFilter = creatorSelect.value;
    render();
  });

  // Sort dropdown
  document.getElementById('sort-select').addEventListener('change', (e) => {
    sortMode = e.target.value;
    render();
  });

  // Search
  document.getElementById('video-search').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    render();
  });

  // Init search
  initSearch(creators, allVideos);
}

// ===== PATTERNS PAGE =====
async function renderPatterns() {
  const creators = await loadJSON('/data/creators.json');

  const analysesMap = {};
  await Promise.all(
    creators.flatMap(c => c.analyses.map(aId =>
      loadJSON(`/data/analyses/${aId}.json`)
        .then(a => { analysesMap[aId] = a; })
        .catch(() => {})
    ))
  );

  const allAnalyses = Object.values(analysesMap).filter(Boolean);
  const visibleCreators = creators.filter(c => c.sessions >= 2);

  // Meta line
  const metaEl = document.getElementById('patterns-meta');
  if (metaEl) {
    metaEl.innerHTML = `<strong>${allAnalyses.length}</strong> analyses across <strong>${visibleCreators.length}</strong> creators — patterns update automatically as data grows`;
  }

  // Lookup maps
  const creatorMap = {};
  creators.forEach(c => { creatorMap[c.id] = c; });

  // ── Featured example block ────────────────────────────────────

  function featuredAnalysis(a, type, highlightStat) {
    if (!a) return '';
    const creator = creatorMap[a.creatorId];
    const bg = creator ? creator.avatarColor : 'var(--border)';
    const init = creator ? creator.initials : '??';
    const sv = a.structuralVerdict?.status || '';
    const svColor = sv === 'INTACT' ? 'var(--green)' : sv === 'COMPROMISED' ? 'var(--orange)' : 'var(--red-light)';
    const title = a.videoTitle.length > 65 ? a.videoTitle.slice(0, 62) + '…' : a.videoTitle;
    return `<a href="analysis.html?id=${a.id}" class="pattern-featured ${type}">
      <div class="pf-header">
        <span class="pf-avatar" style="background:${bg}">${init}</span>
        <span class="pf-creator">${a.creatorName}</span>
        ${sv ? `<span class="pf-verdict" style="color:${svColor}">${sv}</span>` : ''}
      </div>
      <div class="pf-title">${title}</div>
      <div class="pf-stat">${highlightStat}</div>
    </a>`;
  }

  function featuredCreator(c, type, highlightStat) {
    if (!c) return '';
    return `<a href="creator.html?id=${c.id}" class="pattern-featured ${type}">
      <div class="pf-header">
        <span class="pf-avatar" style="background:${c.avatarColor}">${c.initials}</span>
        <span class="pf-creator">${c.name}</span>
        <span class="pf-verdict" style="color:${scoreColor(c.cumulativeScore)}">${c.cumulativeScore}%</span>
      </div>
      <div class="pf-stat">${highlightStat}</div>
    </a>`;
  }

  // ── Chip helpers ──────────────────────────────────────────────

  function creatorChip(c) {
    return `<a href="creator.html?id=${c.id}" class="pattern-chip">
      <span class="pattern-chip-avatar" style="background:${c.avatarColor}">${c.initials}</span>
      <span>${c.name}</span>
      <span class="pattern-chip-score" style="color:${scoreColor(c.cumulativeScore)}">${c.cumulativeScore}%</span>
    </a>`;
  }

  function analysisChip(a, sublabel) {
    const creator = creatorMap[a.creatorId];
    const bg = creator ? creator.avatarColor : 'var(--border)';
    const init = creator ? creator.initials : '??';
    const title = a.videoTitle.length > 38 ? a.videoTitle.slice(0, 35) + '…' : a.videoTitle;
    const sub = sublabel || a.creatorName;
    return `<a href="analysis.html?id=${a.id}" class="pattern-chip">
      <span class="pattern-chip-avatar" style="background:${bg}">${init}</span>
      <span>${title}</span>
      <span class="pattern-chip-label">${sub}</span>
    </a>`;
  }

  // ── Good pattern computations ─────────────────────────────────

  // 1. Every thesis holds — all verdicts INTACT across all sessions
  const allIntactCreators = visibleCreators.filter(c => {
    const d = c.verdictDistribution || {};
    const total = (d.intact || 0) + (d.compromised || 0) + (d.collapsed || 0);
    return total > 0 && (d.intact || 0) === total;
  });

  // 2. Errors stay on the edges — no thesisCritical false claims
  const noLoadBearingAnalyses = allAnalyses.filter(a =>
    !a.falseClaims?.some(fc => fc.thesisCritical)
  );
  const noLoadBearingCreatorIds = [...new Set(noLoadBearingAnalyses.map(a => a.creatorId))];
  const noLoadBearingCreators = noLoadBearingCreatorIds.map(id => creatorMap[id]).filter(Boolean);

  // 3. Clean argumentation — zero rhetorical tricks
  const noTricksAnalyses = allAnalyses
    .filter(a => (a.dashboard?.stratagems || 0) === 0)
    .sort((a, b) => (b.dashboard?.sessionScore || 0) - (a.dashboard?.sessionScore || 0));

  // 4. Score and weight agree — high session score AND low error impact
  const scoreHonestAnalyses = allAnalyses
    .filter(a => (a.dashboard?.sessionScore || 0) >= 80 && (a.dashboard?.errorImpact || 100) < 20)
    .sort((a, b) => (b.dashboard?.sessionScore || 0) - (a.dashboard?.sessionScore || 0));

  // ── Bad pattern computations ──────────────────────────────────

  // 1. Main argument fails — COLLAPSED verdict
  const collapsedAnalyses = allAnalyses.filter(a =>
    a.structuralVerdict?.status === 'COLLAPSED'
  );

  // 2. Core claim is wrong — at least one thesisCritical false claim
  const loadBearingAnalyses = allAnalyses.filter(a =>
    a.falseClaims?.some(fc => fc.thesisCritical)
  );

  // 3. Persuasion over evidence — 3+ rhetorical tricks
  const trickClusterAnalyses = allAnalyses
    .filter(a => (a.dashboard?.stratagems || 0) >= 3)
    .sort((a, b) => (b.dashboard?.stratagems || 0) - (a.dashboard?.stratagems || 0));

  // 4. Score flatters — decent session score but high weighted error
  const scoreFlatterAnalyses = allAnalyses.filter(a =>
    (a.dashboard?.sessionScore || 0) >= 65 && (a.dashboard?.errorImpact || 0) >= 30
  );

  // ── Pick best featured examples ───────────────────────────────

  // Good: creator with highest cumulative score among all-INTACT
  const featuredIntactCreator = [...allIntactCreators].sort((a, b) => b.cumulativeScore - a.cumulativeScore)[0];

  // Good: highest-scoring analysis with no load-bearing errors
  const featuredEdgeAnalysis = [...noLoadBearingAnalyses].sort((a, b) =>
    (b.dashboard?.sessionScore || 0) - (a.dashboard?.sessionScore || 0)
  )[0];

  // Good: highest-scoring analysis with 0 tricks (already sorted)
  const featuredNoTricksAnalysis = noTricksAnalyses[0];

  // Good: highest score, lowest error impact (already sorted)
  const featuredHonestAnalysis = scoreHonestAnalyses[0];

  // Bad: COLLAPSED with most false claims
  const featuredCollapsed = [...collapsedAnalyses].sort((a, b) =>
    (b.dashboard?.falseMisleading || 0) - (a.dashboard?.falseMisleading || 0)
  )[0];

  // Bad: most thesisCritical errors
  const featuredLoadBearing = [...loadBearingAnalyses].sort((a, b) =>
    (b.falseClaims?.filter(fc => fc.thesisCritical).length || 0) -
    (a.falseClaims?.filter(fc => fc.thesisCritical).length || 0)
  )[0];

  // Bad: most rhetorical tricks (already sorted)
  const featuredTrickCluster = trickClusterAnalyses[0];

  // Bad: biggest gap between session score and error impact
  const featuredFlatter = [...scoreFlatterAnalyses].sort((a, b) =>
    ((b.dashboard?.errorImpact || 0) - (b.dashboard?.sessionScore || 0)) -
    ((a.dashboard?.errorImpact || 0) - (a.dashboard?.sessionScore || 0))
  )[0];

  // ── Pattern definitions ────────────────────────────────────────

  const goodPatterns = [
    {
      name: 'Every Thesis Holds',
      desc: 'When a creator\'s main argument survives fact-checking across every session we\'ve analyzed, that\'s the clearest signal of reliability we track. One INTACT verdict could be luck. A consistent record is a pattern.',
      stat: `${allIntactCreators.length} of ${visibleCreators.length} creators`,
      featured: featuredCreator(featuredIntactCreator, 'good',
        (() => { const d = featuredIntactCreator?.verdictDistribution || {}; const t = (d.intact||0)+(d.compromised||0)+(d.collapsed||0); return `${d.intact || 0} of ${t} sessions INTACT`; })()
      ),
      examples: allIntactCreators.slice(0, 4).map(c => creatorChip(c)).join(''),
      emptyMsg: 'No creators with 2+ sessions yet — grows as data is added.',
    },
    {
      name: 'Errors Stay on the Edges',
      desc: 'Every teacher gets something wrong. What matters is where the errors land. When false claims are peripheral — background details that don\'t affect the main point — the core argument remains honest even when imperfect.',
      stat: `${noLoadBearingAnalyses.length} of ${allAnalyses.length} analyses`,
      featured: featuredAnalysis(featuredEdgeAnalysis, 'good',
        `${featuredEdgeAnalysis?.dashboard?.sessionScore || 0}% accuracy · 0 load-bearing errors`
      ),
      examples: noLoadBearingCreators.slice(0, 4).map(c => creatorChip(c)).join(''),
      emptyMsg: 'Growing as analyses are added.',
    },
    {
      name: 'No Rhetorical Tricks',
      desc: 'Some sessions have zero rhetorical tricks. The argument stands on evidence alone — no false dilemmas, no emotional pressure, no bait-and-switch. When we find this, the listener is being informed, not moved.',
      stat: `${noTricksAnalyses.length} of ${allAnalyses.length} analyses`,
      featured: featuredAnalysis(featuredNoTricksAnalysis, 'good',
        `0 rhetorical tricks · ${featuredNoTricksAnalysis?.dashboard?.sessionScore || 0}% accuracy`
      ),
      examples: noTricksAnalyses.slice(0, 4).map(a => analysisChip(a)).join(''),
      emptyMsg: 'Growing as analyses are added.',
    },
    {
      name: 'The Score Is Honest',
      desc: 'A high accuracy score means more when the weighted error analysis agrees. These are sessions where the creator scored well and their false claims didn\'t damage the core argument. The number reflects the reality.',
      stat: `${scoreHonestAnalyses.length} of ${allAnalyses.length} analyses`,
      featured: featuredAnalysis(featuredHonestAnalysis, 'good',
        `${featuredHonestAnalysis?.dashboard?.sessionScore || 0}% accuracy · ${featuredHonestAnalysis?.dashboard?.errorImpact || 0}% weighted error`
      ),
      examples: scoreHonestAnalyses.slice(0, 4).map(a =>
        analysisChip(a, `${a.dashboard.sessionScore}% · ${a.dashboard.errorImpact}% weighted error`)
      ).join(''),
      emptyMsg: 'Growing as analyses are added.',
    },
  ];

  const badPatterns = [
    {
      name: 'The Main Argument Fails',
      desc: 'A COLLAPSED verdict means the central thesis — the main point of the video — depends on claims that don\'t hold up. It\'s not a few wrong details. The argument itself breaks down when the evidence is checked.',
      stat: `${collapsedAnalyses.length} of ${allAnalyses.length} analyses`,
      featured: featuredAnalysis(featuredCollapsed, 'bad',
        `${featuredCollapsed?.dashboard?.falseMisleading || 0} false claims · thesis does not survive`
      ),
      examples: collapsedAnalyses.slice(0, 4).map(a => analysisChip(a)).join(''),
      emptyMsg: 'None found yet.',
    },
    {
      name: 'The Core Claim Is Wrong',
      desc: 'Load-bearing errors are false claims the main argument cannot survive without. Remove the error and the thesis collapses. These are the most serious findings in any analysis — the argument is built on a false foundation.',
      stat: `${loadBearingAnalyses.length} of ${allAnalyses.length} analyses`,
      featured: featuredAnalysis(featuredLoadBearing, 'bad',
        (() => {
          const n = featuredLoadBearing?.falseClaims?.filter(fc => fc.thesisCritical).length || 0;
          return `${n} load-bearing error${n !== 1 ? 's' : ''} — thesis depends on false claims`;
        })()
      ),
      examples: loadBearingAnalyses.slice(0, 4).map(a => analysisChip(a)).join(''),
      emptyMsg: 'None found yet.',
    },
    {
      name: 'Persuasion Over Evidence',
      desc: 'Three or more rhetorical tricks in a single session is a pattern, not a slip. The argument is built to win, not to be true. The listener is being moved toward a conclusion rather than shown evidence for it.',
      stat: `${trickClusterAnalyses.length} of ${allAnalyses.length} analyses`,
      featured: featuredAnalysis(featuredTrickCluster, 'bad',
        `${featuredTrickCluster?.dashboard?.stratagems || 0} rhetorical tricks in one session`
      ),
      examples: trickClusterAnalyses.slice(0, 4).map(a =>
        analysisChip(a, `${a.dashboard.stratagems} rhetorical tricks`)
      ).join(''),
      emptyMsg: 'None found yet.',
    },
    {
      name: 'The Score Flatters',
      desc: 'A 70% accuracy score sounds reasonable — until the weighted error analysis shows those false claims hit the core argument hard. The raw number masks the real problem. This pattern flags the gap between what the score shows and what the errors actually cost.',
      stat: `${scoreFlatterAnalyses.length} of ${allAnalyses.length} analyses`,
      featured: featuredAnalysis(featuredFlatter, 'bad',
        `${featuredFlatter?.dashboard?.sessionScore || 0}% accuracy score · ${featuredFlatter?.dashboard?.errorImpact || 0}% weighted error`
      ),
      examples: scoreFlatterAnalyses.slice(0, 4).map(a =>
        analysisChip(a, `${a.dashboard.sessionScore}% score · ${a.dashboard.errorImpact}% weighted error`)
      ).join(''),
      emptyMsg: 'None found yet.',
    },
  ];

  // ── Render ────────────────────────────────────────────────────

  function renderPatternCard(p, type) {
    return `
      <div class="pattern-card ${type}">
        <div class="pattern-name">${p.name}</div>
        <div class="pattern-desc">${p.desc}</div>
        <div class="pattern-stat">${p.stat}</div>
        ${p.featured || ''}
        ${p.examples ? `<div class="pattern-examples">${p.examples}</div>` : `<span class="pattern-empty">${p.emptyMsg}</span>`}
      </div>
    `;
  }

  const goodEl = document.getElementById('good-patterns');
  const badEl = document.getElementById('bad-patterns');
  if (goodEl) goodEl.innerHTML = goodPatterns.map(p => renderPatternCard(p, 'good')).join('');
  if (badEl) badEl.innerHTML = badPatterns.map(p => renderPatternCard(p, 'bad')).join('');

  initSearch(creators, allAnalyses);
}
