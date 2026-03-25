// ===== DEBATE AUDITOR — Dynamic Rendering Engine =====

// Utility: get URL params (supports ?id=x and #id=x as fallback)
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key)
    || new URLSearchParams(window.location.hash.replace('#', '')).get(key);
}

// Utility: fetch JSON using relative paths (works on any host/subdirectory)
async function loadJSON(path) {
  const relativePath = path.startsWith('/') ? path.slice(1) : path;
  const res = await fetch(relativePath);
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

  // Stats
  const totalSessions = creators.reduce((s, c) => s + c.sessions, 0);
  const totalClaims = creators.reduce((s, c) => s + c.totalClaims, 0);
  document.getElementById('stat-videos').textContent = totalSessions;
  document.getElementById('stat-creators').textContent = creators.length;
  document.getElementById('stat-claims').textContent = totalClaims.toLocaleString() + '+';

  // Sort state
  let sortMode = 'score-asc'; // worst first (most interesting)

  function renderCreatorGrid(mode) {
    const sorted = [...creators];
    if (mode === 'score-asc') sorted.sort((a, b) => a.cumulativeScore - b.cumulativeScore);
    else if (mode === 'score-desc') sorted.sort((a, b) => b.cumulativeScore - a.cumulativeScore);
    else sorted.sort((a, b) => b.sessions - a.sessions); // most analyzed

    const grid = document.getElementById('creators-grid');
    grid.innerHTML = sorted.map(c => `
      <a href="creator.html?id=${c.id}" class="creator-card" style="text-decoration:none;color:inherit">
        <div class="creator-card-top">
          <div class="creator-avatar" style="background:${c.avatarColor}">${c.initials}</div>
          <div class="creator-info">
            <h3>${c.name}</h3>
            <div class="channel">${c.channel}</div>
          </div>
        </div>
        <div class="creator-score">
          <div class="score-badge ${scoreClass(c.cumulativeScore)}"><span class="dot"></span>${c.cumulativeScore}%</div>
        </div>
        <div class="creator-meta">
          <span>${c.sessions} session${c.sessions > 1 ? 's' : ''}</span>
          <span>${c.totalClaims} claims checked</span>
          <span>Verdict: ${c.verdict}</span>
        </div>
        <div class="creator-topics">
          ${c.topics.map(t => `<span class="topic-tag">${t}</span>`).join('')}
        </div>
        <div class="score-bar-track">
          <div class="score-bar-fill" style="width:${c.cumulativeScore}%;background:${scoreColor(c.cumulativeScore)}"></div>
        </div>
      </a>
    `).join('');
  }

  renderCreatorGrid(sortMode);

  // Sort buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sortMode = btn.dataset.sort;
      renderCreatorGrid(sortMode);
    });
  });

  // Recent analyses — load all
  const allAnalyses = [];
  for (const c of creators) {
    for (const aId of c.analyses) {
      try {
        const a = await loadJSON(`/data/analyses/${aId}.json`);
        a._creator = c;
        allAnalyses.push(a);
      } catch (e) { /* skip missing */ }
    }
  }
  allAnalyses.sort((a, b) => new Date(b.dateAnalyzed) - new Date(a.dateAnalyzed));

  const list = document.getElementById('analyses-list');
  list.innerHTML = allAnalyses.map(a => `
    <a href="analysis.html?id=${a.id}" class="analysis-row" style="text-decoration:none;color:inherit">
      <div class="analysis-score-mini ${scoreClass(a.dashboard.sessionScore)}">${a.dashboard.sessionScore}%</div>
      <div class="analysis-info">
        <h4>${a.videoTitle}</h4>
        <div class="subtitle">${a.creatorName} &middot; ${a._creator.channel}</div>
      </div>
      <div class="analysis-claims">
        <span style="color:var(--green)">${a.dashboard.trueClaims} true</span>
        <span style="color:var(--red-light)">${a.dashboard.falseMisleading} false</span>
        <span style="color:var(--yellow)">${a.dashboard.disputed} disputed</span>
      </div>
      <div class="analysis-date">${formatDate(a.dateAnalyzed)}</div>
    </a>
  `).join('');

  // Init search
  initSearch(creators, allAnalyses);
}

// ===== CREATOR PROFILE =====
async function renderCreator() {
  const id = getParam('id');
  const creators = await loadJSON('/data/creators.json');
  const creator = creators.find(c => c.id === id);
  if (!creator) { document.body.innerHTML = '<p style="padding:40px;text-align:center">Creator not found.</p>'; return; }

  document.title = `${creator.name} — Debate Auditor`;

  document.getElementById('creator-avatar').textContent = creator.initials;
  document.getElementById('creator-avatar').style.background = creator.avatarColor;
  document.getElementById('creator-name').textContent = creator.name;
  document.getElementById('creator-channel').textContent = `${creator.channel} · ${creator.platform}`;
  document.getElementById('stat-sessions').textContent = creator.sessions;
  document.getElementById('stat-claims').textContent = creator.totalClaims;
  document.getElementById('stat-true').textContent = creator.trueClaims;

  const ring = document.getElementById('score-ring');
  ring.className = `score-ring ${scoreClass(creator.cumulativeScore)}`;
  document.getElementById('score-pct').textContent = `${creator.cumulativeScore}%`;
  document.getElementById('score-verdict').textContent = creator.verdict;

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

  document.getElementById('analyses-list').innerHTML = analyses.map(a => `
    <a href="analysis.html?id=${a.id}" class="analysis-row" style="text-decoration:none;color:inherit">
      <div class="analysis-score-mini ${scoreClass(a.dashboard.sessionScore)}">${a.dashboard.sessionScore}%</div>
      <div class="analysis-info">
        <h4>${a.videoTitle}</h4>
        <div class="subtitle">Session ${a.sessionNumber} &middot; ${a.dashboard.totalChecked} claims</div>
      </div>
      <div class="analysis-claims">
        <span style="color:var(--green)">${a.dashboard.trueClaims} true</span>
        <span style="color:var(--red-light)">${a.dashboard.falseMisleading} false</span>
        <span style="color:var(--yellow)">${a.dashboard.disputed} disputed</span>
      </div>
      <div class="analysis-date">Analyzed<br>${formatDate(a.dateAnalyzed)}</div>
    </a>
  `).join('');

  // Init search
  initSearch(creators, []);
}

// ===== ANALYSIS PAGE =====
async function renderAnalysis() {
  const id = getParam('id');
  const a = await loadJSON(`/data/analyses/${id}.json`);
  if (!a) { document.body.innerHTML = '<p style="padding:40px;text-align:center">Analysis not found.</p>'; return; }

  document.title = `${a.videoTitle} — Debate Auditor`;

  // Breadcrumb
  document.getElementById('breadcrumb').innerHTML = `<a href="index.html">Home</a> &rarr; <a href="creator.html?id=${a.creatorId}">${a.creatorName}</a> &rarr; Session ${a.sessionNumber}`;

  // Header
  document.getElementById('analysis-title').textContent = a.videoTitle;
  document.getElementById('date-published').textContent = `Published ${a.datePublished}`;
  document.getElementById('date-analyzed').textContent = `Analyzed ${formatDate(a.dateAnalyzed)}`;
  document.getElementById('creator-link').innerHTML = `<a href="creator.html?id=${a.creatorId}">${a.channel}</a>`;
  document.getElementById('analyzed-range').textContent = `Full transcript (${a.analyzedRange})`;

  // YouTube embed + link
  if (a.videoUrl) {
    let videoId = '';
    const url = a.videoUrl;
    if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split(/[?&#]/)[0];
    else if (url.includes('v=')) videoId = url.split('v=')[1].split(/[&#]/)[0];

    document.getElementById('youtube-link').innerHTML = `
      <div style="margin-top:16px;border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);background:#000">
        <div style="position:relative;padding-bottom:56.25%;height:0">
          <iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>
        </div>
      </div>
      <a href="${a.videoUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:rgba(214,48,49,0.12);border:1px solid rgba(214,48,49,0.3);border-radius:20px;color:#ff4444;font-size:0.85rem;font-weight:600;text-decoration:none;margin-top:12px">&#9654; Open on YouTube</a>
    `;
  }

  // TL;DR Summary Card
  const d = a.dashboard;
  document.getElementById('tldr-card').innerHTML = `
    <div class="tldr-item">
      <div class="tldr-val" style="color:${scoreColor(d.sessionScore)}">${d.sessionScore}%</div>
      <div class="tldr-label">Truth Score</div>
    </div>
    <div class="tldr-item">
      <div class="tldr-val" style="color:var(--green)">${d.trueClaims}</div>
      <div class="tldr-label">True Claims</div>
    </div>
    <div class="tldr-item">
      <div class="tldr-val" style="color:var(--red-light)">${d.falseMisleading}</div>
      <div class="tldr-label">False / Misleading</div>
    </div>
    <div class="tldr-item">
      <div class="tldr-val" style="color:var(--orange)">${d.stratagems}</div>
      <div class="tldr-label">Rhetorical Tricks</div>
    </div>
  `;

  document.getElementById('thesis-text').textContent = a.thesis;

  // Dashboard
  const ring = document.getElementById('score-ring');
  ring.className = `score-ring ${scoreClass(d.sessionScore)}`;
  document.getElementById('session-pct').textContent = `${d.sessionScore}%`;
  document.getElementById('session-verdict').textContent = verdictLabel(d.sessionScore);

  // Fix: cumulative score color
  const cumEl = document.getElementById('cumulative-pct');
  const cumScore = d.cumulativeScore || d.sessionScore;
  cumEl.textContent = `${cumScore}%`;
  cumEl.style.color = scoreColor(cumScore);

  document.getElementById('cumulative-label').textContent = d.cumulativeScore
    ? `Cumulative (${d.cumulativeSessions} session${d.cumulativeSessions > 1 ? 's' : ''})`
    : 'First session';

  document.getElementById('dash-true').textContent = d.trueClaims;
  document.getElementById('dash-false').textContent = d.falseMisleading;
  document.getElementById('dash-disputed').textContent = d.disputed;
  document.getElementById('dash-total').textContent = d.totalChecked;
  document.getElementById('dash-confidence').textContent = d.confidence;
  document.getElementById('dash-stratagems').textContent = d.stratagems;
  document.getElementById('dash-weasel').textContent = d.weaselWords;
  document.getElementById('dash-error').textContent = d.errorImpact ? `${d.errorImpact}%` : 'N/A';

  document.getElementById('tab-claims-count').textContent = `All Claims (${d.totalChecked})`;

  // False claims
  document.getElementById('false-claims-tab').innerHTML = a.falseClaims.map(fc => `
    <div class="false-claim-detail">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <span class="rating">${fc.rating} · ${fc.confidence} Confidence</span>
        ${fc.category ? `<span style="padding:3px 10px;border-radius:12px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;${fc.category === 'Core' ? 'background:rgba(214,48,49,0.15);color:var(--red-light)' : fc.category === 'Support' ? 'background:rgba(225,112,85,0.15);color:var(--orange)' : 'background:rgba(136,136,160,0.15);color:var(--text-muted)'}">${fc.category} · ${fc.category === 'Core' ? '3x' : fc.category === 'Support' ? '2x' : '1x'} weight</span>` : ''}
        <span style="font-size:0.75rem;color:var(--text-muted)">${fc.timestamp}</span>
      </div>
      <h4>"${fc.claim}"</h4>
      <p class="evidence" style="margin-top:12px">${fc.evidence}</p>
      <p class="settle">What would settle it: ${fc.settle}</p>
      ${fc.sources && fc.sources.length > 0 ? `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent-light);font-weight:600;margin-bottom:8px">Sources</div>
          ${fc.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener" style="display:block;font-size:0.8rem;color:var(--accent-light);margin-bottom:4px;text-decoration:none;opacity:0.85">${s.label} &rarr;</a>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Stratagems
  document.getElementById('stratagems-tab').innerHTML = a.stratagems.map(s => `
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

  // All claims
  document.getElementById('all-claims-tab').innerHTML = `
    <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px">All ${d.totalChecked} claims extracted from the transcript, in chronological order.</p>
    ${a.allClaims.map(c => `
      <div class="claim-item">
        <div class="claim-num">${c.num}</div>
        <div class="claim-text">${c.text} <span class="timestamp">${c.timestamp}</span></div>
        <div class="claim-verdict ${claimClass(c.verdict)}">${claimLabel(c.verdict)}</div>
      </div>
    `).join('')}
  `;

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
        <div style="font-size:0.8rem;font-weight:700;color:var(--red-light);margin-bottom:6px">Error Impact: ${wa.errorImpact}% — ${wa.interpretation.split('.')[0]}</div>
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
