// ===== DEBATE AUDITOR — Dynamic Rendering Engine =====

// Utility: get URL params (supports ?id=x and #id=x as fallback)
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key)
    || new URLSearchParams(window.location.hash.replace('#', '')).get(key);
}

// Utility: fetch JSON using relative paths (works on any host/subdirectory)
async function loadJSON(path) {
  // Strip leading slash to make path relative
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

// Utility: verdict from score
function verdictLabel(score) {
  if (score >= 80) return 'Reliable';
  if (score >= 60) return 'Caution';
  return 'Unreliable';
}

// Utility: verdict class for claim
function claimClass(verdict) {
  if (verdict === 'true') return 'true';
  if (verdict === 'false') return 'false';
  if (verdict === 'misleading') return 'misleading';
  return 'disputed';
}

function claimLabel(verdict) {
  return verdict.charAt(0).toUpperCase() + verdict.slice(1);
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

  // Creator cards
  const grid = document.getElementById('creators-grid');
  grid.innerHTML = creators.map(c => `
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
    </a>
  `).join('');

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
      <div class="analysis-date">${a.dateAnalyzed}</div>
    </a>
  `).join('');
}

// ===== CREATOR PROFILE =====
async function renderCreator() {
  const id = getParam('id');
  const creators = await loadJSON('/data/creators.json');
  const creator = creators.find(c => c.id === id);
  if (!creator) { document.body.innerHTML = '<p style="padding:40px;text-align:center">Creator not found.</p>'; return; }

  document.title = `${creator.name} — Debate Auditor`;

  // Header
  document.getElementById('creator-avatar').textContent = creator.initials;
  document.getElementById('creator-avatar').style.background = creator.avatarColor;
  document.getElementById('creator-name').textContent = creator.name;
  document.getElementById('creator-channel').textContent = `${creator.channel} · ${creator.platform}`;
  document.getElementById('stat-sessions').textContent = creator.sessions;
  document.getElementById('stat-claims').textContent = creator.totalClaims;
  document.getElementById('stat-true').textContent = creator.trueClaims;

  // Score ring
  const ring = document.getElementById('score-ring');
  ring.className = `score-ring ${scoreClass(creator.cumulativeScore)}`;
  document.getElementById('score-pct').textContent = `${creator.cumulativeScore}%`;
  document.getElementById('score-verdict').textContent = creator.verdict;

  // Topics
  document.getElementById('creator-topics').innerHTML = creator.topics.map(t => `<span class="topic-tag">${t}</span>`).join('');

  // Core positions
  const posColors = {'Unreliable': 'var(--red-light)', 'Caution': 'var(--yellow)', 'Reliable': 'var(--green)'};
  const posColor = posColors[creator.verdict] || 'var(--accent-light)';
  document.getElementById('core-positions').innerHTML = creator.corePositions.map(p =>
    `<span style="padding:6px 14px;border-radius:20px;font-size:0.8rem;background:rgba(108,92,231,0.1);color:var(--accent-light);border:1px solid rgba(108,92,231,0.2)">${p}</span>`
  ).join('');

  // Notable patterns
  document.getElementById('notable-patterns').innerHTML = creator.notablePatterns.map(p => `
    <div style="display:flex;align-items:start;gap:12px">
      <div style="width:8px;height:8px;border-radius:50%;background:${posColor};margin-top:7px;flex-shrink:0"></div>
      <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.6">${p}</p>
    </div>
  `).join('');

  // Load analyses
  const analysesList = document.getElementById('analyses-list');
  const analyses = [];
  for (const aId of creator.analyses) {
    try {
      const a = await loadJSON(`/data/analyses/${aId}.json`);
      analyses.push(a);
    } catch (e) { /* skip */ }
  }

  // Score trend
  const trendContainer = document.getElementById('trend-sessions');
  trendContainer.innerHTML = analyses.map((a, i) => {
    const cls = scoreClass(a.dashboard.sessionScore);
    const color = cls === 'reliable' ? 'var(--green)' : cls === 'caution' ? 'var(--yellow)' : 'var(--red-light)';
    return `
      <div class="trend-session">
        <div class="trend-bar-fill" style="height:${a.dashboard.sessionScore}%;background:${color}">
          <div class="bar-label" style="color:${color}">${a.dashboard.sessionScore}%</div>
        </div>
        <div class="session-label">Session ${a.sessionNumber}<br><span style="font-size:0.65rem">${verdictLabel(a.dashboard.sessionScore)}</span></div>
      </div>
    `;
  }).join('');

  // Analyzed videos
  analysesList.innerHTML = analyses.map(a => `
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
      <div class="analysis-date">Analyzed<br>${a.dateAnalyzed}</div>
    </a>
  `).join('');
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
  document.getElementById('date-analyzed').textContent = `Analyzed ${a.dateAnalyzed}`;
  document.getElementById('creator-link').innerHTML = `<a href="creator.html?id=${a.creatorId}">${a.channel}</a>`;
  document.getElementById('analyzed-range').textContent = `Full transcript (${a.analyzedRange})`;

  // YouTube embed + link
  if (a.videoUrl) {
    // Extract video ID from various YouTube URL formats
    let videoId = '';
    const url = a.videoUrl;
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split(/[?&#]/)[0];
    } else if (url.includes('v=')) {
      videoId = url.split('v=')[1].split(/[&#]/)[0];
    }

    document.getElementById('youtube-link').innerHTML = `
      <div style="margin-top:16px;border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);background:#000">
        <div style="position:relative;padding-bottom:56.25%;height:0">
          <iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>
        </div>
      </div>
      <a href="${a.videoUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:rgba(214,48,49,0.12);border:1px solid rgba(214,48,49,0.3);border-radius:20px;color:#ff4444;font-size:0.85rem;font-weight:600;text-decoration:none;margin-top:12px">&#9654; Open on YouTube</a>
    `;
  }
  document.getElementById('thesis-text').textContent = a.thesis;

  // Dashboard
  const d = a.dashboard;
  const ring = document.getElementById('score-ring');
  ring.className = `score-ring ${scoreClass(d.sessionScore)}`;
  document.getElementById('session-pct').textContent = `${d.sessionScore}%`;
  document.getElementById('session-verdict').textContent = verdictLabel(d.sessionScore);
  document.getElementById('cumulative-pct').textContent = `${d.cumulativeScore}%`;
  document.getElementById('cumulative-label').textContent = `Cumulative (${d.cumulativeSessions} session${d.cumulativeSessions > 1 ? 's' : ''})`;
  document.getElementById('dash-true').textContent = d.trueClaims;
  document.getElementById('dash-false').textContent = d.falseMisleading;
  document.getElementById('dash-disputed').textContent = d.disputed;
  document.getElementById('dash-total').textContent = d.totalChecked;
  document.getElementById('dash-confidence').textContent = d.confidence;
  document.getElementById('dash-stratagems').textContent = d.stratagems;
  document.getElementById('dash-weasel').textContent = d.weaselWords;
  document.getElementById('dash-error').textContent = d.errorImpact ? `${d.errorImpact}%` : 'N/A';

  // Tab: total claims count
  document.getElementById('tab-claims-count').textContent = `All Claims (${d.totalChecked})`;

  // False claims
  document.getElementById('false-claims-tab').innerHTML = a.falseClaims.map(fc => `
    <div class="false-claim-detail">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span class="rating">${fc.rating} · ${fc.confidence} Confidence</span>
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

  // Steelman
  if (a.steelman) {
    document.getElementById('steelman-text').textContent = a.steelman;
  }

  // YouTube flags
  if (a.youtubeFlags && a.youtubeFlags.length > 0) {
    document.getElementById('youtube-flags').innerHTML = a.youtubeFlags.map(f => {
      const colors = { warning: 'var(--orange)', caution: 'var(--yellow)', info: 'var(--text-muted)' };
      return `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px 20px;display:flex;align-items:start;gap:12px">
          <div style="width:8px;height:8px;border-radius:50%;background:${colors[f.severity]};margin-top:7px;flex-shrink:0"></div>
          <div>
            <div style="font-weight:600;font-size:0.85rem;margin-bottom:4px">${f.type}</div>
            <p style="font-size:0.8rem;color:var(--text-muted);line-height:1.5">${f.text}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  // Weighted analysis table
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
}
