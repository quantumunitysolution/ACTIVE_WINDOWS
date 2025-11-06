document.getElementById('pingBtn').addEventListener('click', async () => {
  const res = await window.electronAPI.ping();
  document.getElementById('response').innerText = res;
});

// Tab handling
const tabChart = document.getElementById('tabChart');
const tabCurrent = document.getElementById('tabCurrent');
const tabAll = document.getElementById('tabAll');
tabChart?.addEventListener('click', () => showTab('chart'));
tabCurrent?.addEventListener('click', () => showTab('current'));
tabAll?.addEventListener('click', () => showTab('all'));
function showTab(name) {
  const chartSection = document.getElementById('chartSection');
  const allSection = document.getElementById('allSection');
  const currentSection = document.getElementById('currentSection');
  if (name === 'chart') {
    if (chartSection) chartSection.classList.add('show', 'active');
    if (currentSection) currentSection.classList.remove('show', 'active');
    if (allSection) allSection.classList.remove('show', 'active');
    tabChart?.classList.add('active');
    tabCurrent?.classList.remove('active');
    tabAll?.classList.remove('active');
  } else if (name === 'current') {
    if (chartSection) chartSection.classList.remove('show', 'active');
    if (currentSection) currentSection.classList.add('show', 'active');
    if (allSection) allSection.classList.remove('show', 'active');
    tabChart?.classList.remove('active');
    tabCurrent?.classList.add('active');
    tabAll?.classList.remove('active');
  } else {
    if (chartSection) chartSection.classList.remove('show', 'active');
    if (currentSection) currentSection.classList.remove('show', 'active');
    if (allSection) allSection.classList.add('show', 'active');
    tabChart?.classList.remove('active');
    tabCurrent?.classList.remove('active');
    tabAll?.classList.add('active');
  }
}

// Live data display: listen for updates from main and request initial data
let liveChartInstance = null;
let doughnutInstance = null;
// Store logs history
let logsHistory = [];

function updateLiveDataView(data) {
  const container = document.getElementById('liveList') || (() => {
    const s = document.createElement('div');
    s.id = 'liveList';
    return s;
  })();
  // normalize to array (itemsLatestFirst for table)
  const items = Array.isArray(data) ? data.slice().reverse() : [data]; // show latest first

  // Update summary cards with latest data
  updateSummaryCards(items[0]);

  // update chart and full data list (chart uses chronological order)
  renderChart(items.slice().reverse());
  renderAdditionalCharts(items.slice().reverse());

  // Update logs
  if (!Array.isArray(data)) {
    // Single item update, add to history
    logsHistory.unshift({
      ...data,
      timestamp: new Date().toISOString()
    });
  } else {
    // Bulk update, replace history
    logsHistory = data.map(item => ({
      ...item,
      timestamp: new Date().toISOString()
    }));
  }
  updateLogsTable();

  const tbody = document.getElementById('liveTableBody');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8"><em>No live data yet.</em></td></tr>';
    return;
  }

  // populate table rows (latest first)
  const rows = items.map((it, idx) => {
    const profile = escapeHtml(it?.profile || it?.profileName || '');
    const appTitle = escapeHtml(it?.title || it?.owner?.name || it?.historyMatches?.optionString || '');
  const hist = it?.historyMatches || it?.history || null;
  const histTitle = escapeHtml(hist?.optionString || hist?.title || '');
  const histUrl = hist?.url || '';
  const domain = escapeHtml(getDomain(histUrl));
    const score = (hist && typeof hist.score !== 'undefined') ? Number(hist.score).toFixed(3) : '';
    const memoryMB = it?.memoryUsage ? Math.round((it.memoryUsage / (1024*1024)) * 100) / 100 : '';

    const urlHtml = histUrl ? `<a href="#" class="external-link" data-href="${escapeAttr(histUrl)}">${escapeHtml(histUrl)}</a>` : '';

    return `<tr>
      <td>${idx + 1}</td>
      <td>${profile}</td>
      <td>${appTitle}</td>
      <td>${domain}</td>
      <td>${histTitle}</td>
      <td>${urlHtml}</td>
      <td>${escapeHtml(score)}</td>
      <td>${escapeHtml(memoryMB)}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;

  // wire external link clicks to main process
  document.querySelectorAll('.external-link').forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const url = a.dataset.href;
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    });
  });

  // update current tab view (latest item)
  try {
    const latest = items[0];
    updateCurrentTabView(latest);
  } catch (err) {
    updateCurrentTabView(null);
  }
}

function updateCurrentTabView(item) {
  const titleEl = document.getElementById('currentTitle');
  const profileEl = document.getElementById('currentProfile');
  const domainEl = document.getElementById('currentDomain');
  const matchedEl = document.getElementById('currentMatched');
  const memoryEl = document.getElementById('currentMemory');
  const actionsEl = document.getElementById('currentActions');

  if (!item) {
    if (titleEl) titleEl.innerText = 'No active tab';
    if (profileEl) profileEl.innerText = '';
    if (domainEl) domainEl.innerHTML = '';
    if (matchedEl) matchedEl.innerHTML = '';
    if (memoryEl) memoryEl.innerHTML = '';
    if (actionsEl) actionsEl.innerHTML = '';
    return;
  }

  const profile = escapeHtml(item?.profile || item?.profileName || '');
  const title = escapeHtml(item?.title || item?.owner?.name || '');
  const hist = item?.historyMatches || item?.history || null;
  const url = hist?.url || '';
  const domain = escapeHtml(getDomain(url));
  const matched = escapeHtml(hist?.optionString || hist?.title || '');
  const score = (hist && typeof hist.score !== 'undefined') ? Number(hist.score).toFixed(3) : '';
  const memoryMB = item?.memoryUsage ? Math.round((item.memoryUsage / (1024*1024)) * 100) / 100 : '';

  if (titleEl) titleEl.innerText = title || 'No title';
  if (profileEl) profileEl.innerText = profile ? `Profile: ${profile}` : '';
  if (domainEl) domainEl.innerHTML = domain ? `<strong>Domain:</strong> ${domain}` : '';
  if (matchedEl) matchedEl.innerHTML = matched ? `<strong>Matched:</strong> ${matched} ${score ? `(<small>${score}</small>)` : ''}` : '';
  if (memoryEl) memoryEl.innerHTML = memoryMB ? `<strong>Memory:</strong> ${memoryMB} MB` : '';

  if (actionsEl) {
    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-sm btn-primary me-2';
    openBtn.innerText = 'Open URL';
    openBtn.disabled = !url;
    openBtn.addEventListener('click', () => {
      if (!url) return;
      if (window.electronAPI && window.electronAPI.openExternal) window.electronAPI.openExternal(url);
      else window.open(url, '_blank');
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-sm btn-outline-secondary';
    copyBtn.innerText = 'Copy URL';
    copyBtn.disabled = !url;
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url || '');
        copyBtn.innerText = 'Copied';
        setTimeout(() => copyBtn.innerText = 'Copy URL', 1500);
      } catch (err) {
        console.warn('copy failed', err);
      }
    });

    actionsEl.innerHTML = '';
    actionsEl.appendChild(openBtn);
    actionsEl.appendChild(copyBtn);
  }
}

// Render a chart showing top URLs by occurrence (or optionString), latest-first input
function renderChart(items) {
  // Items here are chronological (oldest -> newest)
  // extract domain per item
  const domains = items.map(it => {
    const hist = it?.historyMatches || it?.history || null;
    const url = hist?.url || '';
    return getDomain(url) || 'unknown';
  });

  // count totals per domain to pick top domains
  const totals = {};
  for (const d of domains) totals[d] = (totals[d] || 0) + 1;
  const topDomains = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]);

  if (topDomains.length === 0) {
    // nothing to chart
    const ctxEmpty = document.getElementById('liveChart').getContext('2d');
    if (liveChartInstance) {
      liveChartInstance.data.labels = [];
      liveChartInstance.data.datasets = [];
      liveChartInstance.update();
    }
    return;
  }

  // Build cumulative series for each top domain across the item index
  const labels = items.map((_, i) => `${i + 1}`); // simple step index labels
  const datasets = topDomains.map((domain, di) => {
    const values = [];
    let cum = 0;
    for (const d of domains) {
      if (d === domain) cum++;
      values.push(cum);
    }
    const hue = (di * 60) % 360;
    return {
      label: domain,
      data: values,
      borderColor: `hsl(${hue} 70% 40%)`,
      backgroundColor: `hsl(${hue} 70% 60% / 0.15)`,
      fill: false,
      tension: 0.25,
      pointRadius: 2
    };
  });

  const ctx = document.getElementById('liveChart').getContext('2d');
  if (liveChartInstance) {
    liveChartInstance.data.labels = labels;
    liveChartInstance.data.datasets = datasets;
    liveChartInstance.update();
    return;
  }

  try {
    liveChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { title: { display: true, text: 'Entry index (chronological)' } },
          y: { title: { display: true, text: 'Cumulative occurrences' }, beginAtZero: true }
        }
      }
    });
  } catch (err) {
    console.warn('Failed to create line chart', err);
  }
}

// Render additional charts: domain distribution (doughnut)
function renderAdditionalCharts(items) {
  // chronological items (oldest -> newest)
  const domains = items.map(it => {
    const hist = it?.historyMatches || it?.history || null;
    const url = hist?.url || '';
    return getDomain(url) || 'unknown';
  });

  // totals per domain
  const totals = {};
  for (const d of domains) {
    totals[d] = (totals[d] || 0) + 1;
  }

  // pick top domains by total
  const top = Object.entries(totals).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const labels = top.map(e => e[0]);
  const counts = top.map(e => e[1]);

  // Doughnut (distribution)
  const doughCtx = document.getElementById('domainDoughnut')?.getContext('2d');
  if (doughCtx) {
    const colors = labels.map((_, i) => `hsl(${(i*45)%360} 70% 50%)`);
    if (doughnutInstance) {
      doughnutInstance.data.labels = labels;
      doughnutInstance.data.datasets[0].data = counts;
      doughnutInstance.data.datasets[0].backgroundColor = colors;
      doughnutInstance.update();
    } else {
      try {
        doughnutInstance = new Chart(doughCtx, {
          type: 'doughnut',
          data: { labels: labels, datasets: [{ data: counts, backgroundColor: colors }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
      } catch (err) { console.warn('doughnut create failed', err); }
    }
  }
}

function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

// Update the summary cards at the top of the dashboard
function updateSummaryCards(item) {
  const appNameEl = document.getElementById('currentAppName');
  const urlEl = document.getElementById('currentUrl');
  const profileEl = document.getElementById('currentProfileName');

  if (!item) {
    if (appNameEl) appNameEl.textContent = '-';
    if (urlEl) urlEl.textContent = '-';
    if (profileEl) profileEl.textContent = '-';
    return;
  }

  // Update application name
  if (appNameEl) {
    const appName = item?.title || item?.owner?.name || '-';
    appNameEl.textContent = appName;
  }

  // Update URL
  if (urlEl) {
    const hist = item?.historyMatches || item?.history || null;
    const url = hist?.url || '-';
    urlEl.textContent = url;
    urlEl.title = url; // For full URL on hover
    if (url !== '-') {
      urlEl.style.cursor = 'pointer';
      urlEl.onclick = () => {
        if (window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal(url);
        } else {
          window.open(url, '_blank');
        }
      };
    }
  }

  // Update profile name
  if (profileEl) {
    const profileName = item?.profile || item?.profileName || '-';
    profileEl.textContent = profileName;
  }
}

function getDomain(url) {
  if (!url) return '';
  try {
    // Ensure URL has protocol; URL constructor requires it
    const normalized = url.startsWith('http') ? url : 'https://' + url;
    const h = new URL(normalized).hostname.toLowerCase();
    return h.replace(/^www\./, '');
  } catch (err) {
    return '';
  }
}

// Update logs table with current data
function updateLogsTable() {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;

  logsHistory.reverse();
  const rows = logsHistory.map((item, index) => {
    const timestamp = new Date(item.timestamp).toLocaleString();
    const profile = escapeHtml(item?.profile || item?.profileName || '');
    const appTitle = escapeHtml(item?.title || item?.owner?.name || '');
    const hist = item?.historyMatches || item?.history || null;
    const url = hist?.url || '';
    const score = (hist && typeof hist.score !== 'undefined') ? Number(hist.score).toFixed(3) : '';
    const memoryMB = item?.memoryUsage ? Math.round((item.memoryUsage / (1024*1024)) * 100) / 100 : '';

    return `
      <tr>
        <td><small>${timestamp}</small></td>
        <td>${profile}</td>
        <td>${appTitle}</td>
        <td>
          ${url ? `<a href="#" class="external-link" data-href="${escapeAttr(url)}">${escapeHtml(getDomain(url))}</a>` : ''}
        </td>
        <td>${score}</td>
        <td>${memoryMB}</td>
        <td>
          ${url ? `<button class="btn btn-sm btn-outline-secondary copy-url" data-url="${escapeAttr(url)}">Copy URL</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows || '<tr><td colspan="7" class="text-center">No logs available</td></tr>';

  // Wire up event handlers
  tbody.querySelectorAll('.external-link').forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const url = a.dataset.href;
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    });
  });

  tbody.querySelectorAll('.copy-url').forEach(button => {
    button.addEventListener('click', async () => {
      const url = button.dataset.url;
      try {
        await navigator.clipboard.writeText(url);
        button.textContent = 'Copied!';
        setTimeout(() => button.textContent = 'Copy URL', 1500);
      } catch (err) {
        console.warn('Copy failed', err);
      }
    });
  });
}

// Handle clear logs button
document.getElementById('clearLogs')?.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all logs?')) {
    logsHistory = [];
    updateLogsTable();
  }
});

// Handle export logs button
document.getElementById('exportLogs')?.addEventListener('click', () => {
  const csv = [
    ['Timestamp', 'Profile', 'Application', 'Domain', 'URL', 'Match Score', 'Memory (MB)'].join(','),
    ...logsHistory.map(item => {
      const timestamp = new Date(item.timestamp).toLocaleString();
      const profile = item?.profile || item?.profileName || '';
      const appTitle = item?.title || item?.owner?.name || '';
      const hist = item?.historyMatches || item?.history || null;
      const url = hist?.url || '';
      const domain = getDomain(url);
      const score = (hist && typeof hist.score !== 'undefined') ? Number(hist.score).toFixed(3) : '';
      const memoryMB = item?.memoryUsage ? Math.round((item.memoryUsage / (1024*1024)) * 100) / 100 : '';
      
      return [
        timestamp,
        profile,
        appTitle,
        domain,
        url,
        score,
        memoryMB
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    })
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `activity_logs_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
});

// subscribe to live updates
if (window.electronAPI && window.electronAPI.onLiveData) {
  window.electronAPI.onLiveData((data) => {
    updateLiveDataView(data);
  });

  // request initial snapshot
  (async () => {
    try {
      const snapshot = await window.electronAPI.getLiveData();
      updateLiveDataView(snapshot);
    } catch (err) {
      console.warn('Failed to get initial live data', err);
    }
  })();
}
