/* ─── ALPHAQUANT · app.js ────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════════════
   1. SEEDED PRNG
   ═══════════════════════════════════════════════════════════════════════ */
class SeededRandom {
  constructor(seed) { this.state = seed >>> 0; }
  next() {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  normal(mean = 0, std = 1) {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }
  uniform(lo, hi) { return lo + this.next() * (hi - lo); }
  randInt(lo, hi)  { return Math.floor(lo + this.next() * (hi - lo)); }
}

function charSum(s) { return [...s].reduce((a, c) => a + c.charCodeAt(0), 0); }

/* ═══════════════════════════════════════════════════════════════════════
   2. DATA GENERATION
   ═══════════════════════════════════════════════════════════════════════ */
function generateStockData(ticker, days = 365) {
  const seed = 42 + charSum(ticker);
  const rng  = new SeededRandom(seed);
  const end  = new Date();
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end); d.setDate(d.getDate() - i); dates.push(d);
  }
  const startPrice = rng.uniform(20, 120);
  const returns    = Array.from({ length: days }, () => rng.normal(0.0003, 0.018));
  const prices = [];
  let cumProd = 1;
  for (const r of returns) { cumProd *= (1 + r); prices.push(startPrice * cumProd); }
  const highs   = prices.map(p => p * rng.uniform(1.005, 1.025));
  const lows    = prices.map(p => p * rng.uniform(0.975, 0.995));
  const opens   = prices.map(p => p * rng.uniform(0.990, 1.010));
  const volumes = Array.from({ length: days }, () => rng.randInt(500_000, 5_000_000));
  return dates.map((date, i) => ({
    date, open: opens[i], high: highs[i], low: lows[i],
    close: prices[i], volume: volumes[i]
  }));
}

function computeMetrics(rows) {
  const closes  = rows.map(r => r.close);
  const rets    = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
  const mean    = rets.reduce((a, v) => a + v, 0) / rets.length;
  const variance= rets.reduce((a, v) => a + (v - mean) ** 2, 0) / rets.length;
  const std     = Math.sqrt(variance);
  const volAnn  = std * Math.sqrt(252);
  const sharpe  = (mean * 252) / (std * Math.sqrt(252) + 1e-9);
  const betaRng = new SeededRandom(charSum(rows[0]?.date?.toString() ?? '0'));
  const beta    = betaRng.uniform(0.6, 1.6);
  let cumMax = closes[0], maxDD = 0;
  for (const c of closes) {
    if (c > cumMax) cumMax = c;
    const dd = (c - cumMax) / cumMax;
    if (dd < maxDD) maxDD = dd;
  }
  const current   = closes.at(-1);
  const prev      = closes.at(-2);
  const changePct = ((current - prev) / prev) * 100;
  let riskLevel, riskClass;
  if      (volAnn < 0.20) { riskLevel = 'THẤP / LOW';          riskClass = 'low'; }
  else if (volAnn < 0.40) { riskLevel = 'TRUNG BÌNH / MEDIUM'; riskClass = 'medium'; }
  else                    { riskLevel = 'CAO / HIGH';           riskClass = 'high'; }
  return { volAnn, sharpe, beta, maxDD, current, prev, changePct, riskLevel, riskClass };
}

/* ═══════════════════════════════════════════════════════════════════════
   3. STATE
   ═══════════════════════════════════════════════════════════════════════ */
const STATE = {
  stocks:     {},
  glossary:   [],
  selected:   'VNM',
  period:     180,
  compareSet: new Set(),
  allData:    {},
  watchlist:  ['FPT', 'HPG'],   // default watchlist
};

/* ═══════════════════════════════════════════════════════════════════════
   4. AUTH MODAL
   ═══════════════════════════════════════════════════════════════════════ */
function openModal(type) {
  const modal   = document.getElementById('authModal');
  const title   = document.getElementById('authModalTitle');
  const desc    = document.getElementById('authModalDesc');
  if (type === 'login') {
    title.textContent = 'LOGIN';
    desc.textContent  = 'Đăng nhập vào tài khoản AlphaQuant của bạn.';
  } else {
    title.textContent = 'SIGN UP';
    desc.textContent  = 'Tạo tài khoản AlphaQuant miễn phí ngay hôm nay.';
  }
  modal.classList.add('open');
}
function closeModal() {
  document.getElementById('authModal').classList.remove('open');
}
/* Expose globally so onclick= in HTML works */
window.openModal  = openModal;
window.closeModal = closeModal;

/* ═══════════════════════════════════════════════════════════════════════
   5. SEARCH BAR
   ═══════════════════════════════════════════════════════════════════════ */
function initSearch() {
  const input    = document.getElementById('headerSearch');
  const dropdown = document.getElementById('searchDropdown');

  input.addEventListener('input', () => {
    const q = input.value.trim().toUpperCase();
    dropdown.innerHTML = '';
    if (!q) { dropdown.classList.add('hidden'); return; }
    const matches = Object.entries(STATE.stocks).filter(
      ([t, info]) => t.includes(q) || info.name.toUpperCase().includes(q)
    );
    if (!matches.length) { dropdown.classList.add('hidden'); return; }
    dropdown.classList.remove('hidden');
    matches.forEach(([ticker, info]) => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <span class="search-result-ticker">${ticker}</span>
        <span class="search-result-name">${info.name}</span>
      `;
      item.addEventListener('click', () => {
        STATE.selected = ticker;
        document.getElementById('stockSelect').value = ticker;
        STATE.compareSet.delete(ticker);
        buildCompareList();
        render();
        input.value = '';
        dropdown.classList.add('hidden');
      });
      dropdown.appendChild(item);
    });
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.topnav-search')) dropdown.classList.add('hidden');
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   6. WATCHLIST
   ═══════════════════════════════════════════════════════════════════════ */
function renderWatchlist() {
  const container = document.getElementById('watchlistItems');
  container.innerHTML = '';

  STATE.watchlist.forEach(ticker => {
    if (!STATE.allData[ticker]) return;
    const rows = STATE.allData[ticker].slice(-1)[0];
    const m    = computeMetrics(STATE.allData[ticker].slice(-30));
    const price = rows.close.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const up    = m.changePct >= 0;

    const item = document.createElement('div');
    item.className = 'watchlist-item';
    item.innerHTML = `
      <div class="watchlist-left">
        <div>
          <div class="watchlist-ticker">${ticker}</div>
          <div class="watchlist-name">${STATE.stocks[ticker]?.name ?? ''}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
        <span class="watchlist-price">${price}</span>
        <span class="${up ? 'watchlist-change-up' : 'watchlist-change-down'}">${up ? '▲' : '▼'} ${Math.abs(m.changePct).toFixed(2)}%</span>
      </div>
      <button class="watchlist-remove" data-ticker="${ticker}" title="Xóa khỏi watchlist">✕</button>
    `;
    /* click row → select stock */
    item.addEventListener('click', e => {
      if (e.target.closest('.watchlist-remove')) return;
      STATE.selected = ticker;
      document.getElementById('stockSelect').value = ticker;
      STATE.compareSet.delete(ticker);
      buildCompareList();
      render();
    });
    /* remove button */
    item.querySelector('.watchlist-remove').addEventListener('click', e => {
      e.stopPropagation();
      STATE.watchlist = STATE.watchlist.filter(t => t !== ticker);
      renderWatchlist();
    });
    container.appendChild(item);
  });
}

function initWatchlist() {
  document.getElementById('addWatchlistBtn').addEventListener('click', () => {
    const ticker = STATE.selected;
    if (!STATE.watchlist.includes(ticker)) {
      STATE.watchlist.push(ticker);
      renderWatchlist();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   7. SIDEBAR — STOCK SELECT + COMPARE
   ═══════════════════════════════════════════════════════════════════════ */
function buildSidebar() {
  const sel = document.getElementById('stockSelect');
  for (const [ticker, info] of Object.entries(STATE.stocks)) {
    const opt = document.createElement('option');
    opt.value = ticker;
    opt.textContent = `${ticker} — ${info.name}`;
    sel.appendChild(opt);
  }
  sel.value = STATE.selected;
  sel.addEventListener('change', () => {
    STATE.selected = sel.value;
    STATE.compareSet.delete(sel.value);
    buildCompareList();
    renderWatchlist();
    render();
  });

  const slider  = document.getElementById('periodSlider');
  const periods = [30, 60, 90, 180, 365];
  slider.min = 0; slider.max = periods.length - 1;
  slider.value = periods.indexOf(STATE.period);
  const label = document.getElementById('periodLabel');
  label.textContent = `${STATE.period} ngày`;
  slider.addEventListener('input', () => {
    STATE.period = periods[+slider.value];
    label.textContent = `${STATE.period} ngày`;
    render();
  });

  buildCompareList();
}

function buildCompareList() {
  const container = document.getElementById('compareList');
  const baseLabel = document.getElementById('compareBaseLabel');
  if (baseLabel) baseLabel.textContent = `Base: ${STATE.selected}`;
  container.innerHTML = '';
  for (const [ticker, info] of Object.entries(STATE.stocks)) {
    if (ticker === STATE.selected) continue;
    const lbl = document.createElement('label');
    lbl.className = 'compare-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = ticker;
    cb.checked = STATE.compareSet.has(ticker);
    cb.addEventListener('change', () => {
      if (cb.checked) STATE.compareSet.add(ticker);
      else            STATE.compareSet.delete(ticker);
      render();
    });
    lbl.innerHTML = `<span class="compare-ticker">${ticker}</span><span style="color:var(--muted);font-size:.76rem">${info.name}</span>`;
    lbl.prepend(cb);
    container.appendChild(lbl);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   8. CLOCK
   ═══════════════════════════════════════════════════════════════════════ */
function updateClock() {
  const el = document.getElementById('clockEl');
  if (el) el.textContent = new Date().toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   9. TABS
   ═══════════════════════════════════════════════════════════════════════ */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   10. RENDER ORCHESTRATOR
   ═══════════════════════════════════════════════════════════════════════ */
function initAIAnalysis() {
  const select = document.getElementById('aiStockSelect');
  const runBtn = document.getElementById('aiRunBtn');
  if (!select) return;

  for (const [ticker, info] of Object.entries(STATE.stocks)) {
    const opt = document.createElement('option');
    opt.value = ticker;
    opt.textContent = `${ticker} — ${info.name}`;
    select.appendChild(opt);
  }
  select.value = STATE.selected;

  select.addEventListener('change', renderAIAnalysis);
  if (runBtn) runBtn.addEventListener('click', renderAIAnalysis);
  document.querySelectorAll('.ai-segmented button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ai-segmented button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAIAnalysis();
    });
  });
  renderAIAnalysis();
}

function renderAIAnalysis() {
  const select = document.getElementById('aiStockSelect');
  if (!select || !STATE.allData[select.value]) return;

  const ticker = select.value;
  const info = STATE.stocks[ticker];
  const metrics = computeMetrics(STATE.allData[ticker].slice(-STATE.period));
  const volPct = metrics.volAnn * 100;
  const ddPct = Math.abs(metrics.maxDD * 100);
  const riskScore = Math.min(99, Math.max(1, Math.round(volPct * 1.25 + ddPct * 0.9 + metrics.beta * 12)));
  const tone = riskScore >= 70 ? 'cao' : riskScore >= 45 ? 'trung bình' : 'thấp';
  const action = riskScore >= 70
    ? 'nên ưu tiên quản trị vị thế và chờ vùng giá ổn định hơn.'
    : riskScore >= 45
      ? 'phù hợp để theo dõi thêm, đặc biệt khi kết hợp với điểm mua rõ ràng.'
      : 'đang có hồ sơ rủi ro tương đối dễ kiểm soát trong giai đoạn quan sát.';

  setText('aiResultTitle', `${ticker} — ${info.name}`);
  setText('aiRiskScore', riskScore);
  setText('aiRiskHeadline', `Mức rủi ro mô phỏng: ${tone.toUpperCase()}`);
  setText('aiRiskSummary', `AI demo đánh giá ${ticker} có rủi ro ${tone} trong khung ${STATE.period} ngày. Với volatility ${volPct.toFixed(1)}%, beta ${metrics.beta.toFixed(2)} và drawdown tối đa ${(metrics.maxDD * 100).toFixed(1)}%, mã này ${action}`);

  setText('aiVolValue', `${volPct.toFixed(1)}%`);
  setText('aiVolText', volPct > 40 ? 'Biến động cao, cần giới hạn tỷ trọng và đặt ngưỡng cắt lỗ rõ.' : volPct > 20 ? 'Biến động ở mức vừa, phù hợp theo dõi cùng xu hướng giá.' : 'Biến động thấp, phù hợp khẩu vị thận trọng hơn.');
  setText('aiSharpeValue', metrics.sharpe.toFixed(2));
  setText('aiSharpeText', metrics.sharpe > 1 ? 'Hiệu suất điều chỉnh rủi ro đang tích cực trong dữ liệu demo.' : 'Hiệu suất chưa thật nổi bật so với mức biến động.');
  setText('aiDrawdownValue', `${(metrics.maxDD * 100).toFixed(1)}%`);
  setText('aiDrawdownText', ddPct > 15 ? 'Drawdown sâu, nên kiểm tra vùng hỗ trợ và quản trị lỗ.' : 'Drawdown còn trong vùng dễ kiểm soát hơn.');

  const list = document.getElementById('aiRecommendationList');
  if (list) {
    list.innerHTML = `
      <li>Không dùng kết quả demo này như tín hiệu mua bán trực tiếp.</li>
      <li>Theo dõi thêm xu hướng giá, khối lượng và biến động 20 phiên.</li>
      <li>Nếu đưa vào danh mục, nên đặt trước tỷ trọng tối đa và điểm thoát rủi ro.</li>
    `;
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function render() {
  const rows = STATE.allData[STATE.selected].slice(-STATE.period);
  const m    = computeMetrics(rows);
  renderMetrics(m);
  renderRiskBadge(m);
  renderCandlestick(rows);
  renderVolume(rows);
  renderPriceLine(rows);
  renderComparison();
  renderAIAnalysis();
}

function renderMetrics(m) {
  const cards = [
    { id: 'mPrice',    value: m.current.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      sub: `${m.changePct >= 0 ? '🔺' : '🔻'} ${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(2)}%`,
      color: m.changePct >= 0 ? 'var(--green)' : 'var(--red)' },
    { id: 'mVol',      value: `${(m.volAnn * 100).toFixed(1)}%`, sub: 'Annualized', color: 'var(--green)' },
    { id: 'mSharpe',   value: m.sharpe.toFixed(2), sub: '> 1.0 là tốt', color: 'var(--green)' },
    { id: 'mBeta',     value: m.beta.toFixed(2),   sub: '< 1: ít rủi ro', color: 'var(--amber)' },
    { id: 'mDrawdown', value: `${(m.maxDD * 100).toFixed(1)}%`, sub: 'Mức giảm tối đa', color: 'var(--red)' },
  ];
  for (const c of cards) {
    const valEl = document.getElementById(c.id + 'Val');
    const subEl = document.getElementById(c.id + 'Sub');
    if (valEl) { valEl.textContent = c.value; valEl.style.color = c.color; }
    if (subEl)   subEl.textContent = c.sub;
  }
}

function renderRiskBadge(m) {
  const el = document.getElementById('riskBadge');
  if (!el) return;
  el.textContent = m.riskLevel;
  el.className   = `risk-badge risk-${m.riskClass}`;
}

/* ═══════════════════════════════════════════════════════════════════════
   11. PLOTLY CHARTS
   ═══════════════════════════════════════════════════════════════════════ */
const LAYOUT_BASE = {
  paper_bgcolor: '#060b14',
  plot_bgcolor:  '#0a1628',
  font:          { color: '#e0e0e0', family: 'DM Sans, sans-serif', size: 11 },
  margin:        { l: 55, r: 20, t: 10, b: 40 },
  xaxis:         { gridcolor: '#0d2137', linecolor: '#0d2137', tickfont: { size: 10 } },
  yaxis:         { gridcolor: '#0d2137', linecolor: '#0d2137', tickfont: { size: 10 } },
  showlegend:    false,
};
const CONFIG = { displayModeBar: false, responsive: true };

function renderCandlestick(rows) {
  const trace = {
    type: 'candlestick',
    x: rows.map(r => r.date),
    open:  rows.map(r => r.open),
    high:  rows.map(r => r.high),
    low:   rows.map(r => r.low),
    close: rows.map(r => r.close),
    increasing: { line: { color: '#00ff94' }, fillcolor: '#00ff9450' },
    decreasing: { line: { color: '#ff4b4b' }, fillcolor: '#ff4b4b50' },
    name: STATE.selected,
  };
  Plotly.react('chartCandle', [trace], {
    ...LAYOUT_BASE, height: 300,
    xaxis:  { ...LAYOUT_BASE.xaxis, rangeslider: { visible: false } },
    yaxis:  { ...LAYOUT_BASE.yaxis, title: { text: 'Giá (nghìn VNĐ)', font: { size: 10 } } },
    margin: { l: 60, r: 20, t: 10, b: 40 },
  }, CONFIG);
}

function renderVolume(rows) {
  const trace = {
    type: 'bar',
    x: rows.map(r => r.date), y: rows.map(r => r.volume),
    marker: { color: rows.map(r => r.close >= r.open ? '#00ff94' : '#ff4b4b'), opacity: 0.8 },
  };
  Plotly.react('chartVolume', [trace], {
    ...LAYOUT_BASE, height: 190,
    margin: { l: 60, r: 20, t: 10, b: 40 },
    yaxis:  { ...LAYOUT_BASE.yaxis, title: { text: 'KL', font: { size: 10 } } },
  }, CONFIG);
}

function renderPriceLine(rows) {
  const closes = rows.map(r => r.close);
  const dates  = rows.map(r => r.date);
  const rets   = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
  const rollVol = rets.map((_, i) => {
    if (i < 20) return null;
    const w = rets.slice(i - 20, i);
    const m = w.reduce((a, v) => a + v, 0) / 20;
    const s = Math.sqrt(w.reduce((a, v) => a + (v - m) ** 2, 0) / 20);
    return s * Math.sqrt(252) * 100;
  });
  const t1 = { type: 'scatter', mode: 'lines', x: dates, y: closes,
               name: 'Giá / Price', line: { color: '#00ff94', width: 2 } };
  const t2 = { type: 'scatter', mode: 'lines', x: dates.slice(1), y: rollVol,
               name: 'Volatility 20D (%)', line: { color: '#f5a623', width: 1.5, dash: 'dot' }, yaxis: 'y2' };
  Plotly.react('chartLine', [t1, t2], {
    ...LAYOUT_BASE, height: 190, showlegend: true,
    legend: { orientation: 'h', y: 1.18, font: { size: 10 } },
    margin: { l: 55, r: 55, t: 24, b: 40 },
    yaxis:  { ...LAYOUT_BASE.yaxis, title: { text: 'Giá', font: { size: 10 } } },
    yaxis2: { title: { text: 'Volatility %', font: { size: 10 } }, overlaying: 'y', side: 'right',
              gridcolor: '#0d2137', showgrid: false, tickfont: { size: 10 } },
  }, CONFIG);
}

/* ═══════════════════════════════════════════════════════════════════════
   12. COMPARISON
   ═══════════════════════════════════════════════════════════════════════ */
const CMP_COLORS = ['#00ff94', '#7ec8e3', '#f5a623', '#ff4b4b', '#c084fc', '#fb923c'];

function renderComparison() {
  const tickers = [STATE.selected, ...STATE.compareSet];
  const info    = document.getElementById('compareInfo');
  const charts  = document.getElementById('compareCharts');
  const body    = document.getElementById('compareBody');

  if (tickers.length < 2) {
    info.style.display = 'block'; charts.style.display = 'none'; return;
  }
  info.style.display = 'none'; charts.style.display = 'block';

  /* Normalized chart */
  const traces = tickers.map((t, i) => {
    const rows = STATE.allData[t].slice(-STATE.period);
    const base = rows[0].close;
    return {
      type: 'scatter', mode: 'lines',
      x: rows.map(r => r.date), y: rows.map(r => (r.close / base) * 100),
      name: `${t} — ${STATE.stocks[t].name}`,
      line: { color: CMP_COLORS[i % CMP_COLORS.length], width: 2 },
    };
  });
  Plotly.react('chartNorm', traces, {
    ...LAYOUT_BASE, height: 280, showlegend: true,
    legend: { orientation: 'h', y: 1.18, font: { size: 10 } },
    margin: { l: 55, r: 20, t: 30, b: 40 },
    yaxis: { ...LAYOUT_BASE.yaxis, title: { text: 'Giá chuẩn hóa (Base = 100)', font: { size: 10 } } },
  }, CONFIG);

  /* Table + vol bar */
  body.innerHTML = '';
  const rowData = [];
  for (const t of tickers) {
    const m = computeMetrics(STATE.allData[t].slice(-STATE.period));
    rowData.push({ t, m });
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--green);font-weight:700">${t}</td>
      <td class="td-name">${STATE.stocks[t].name}</td>
      <td>${m.current.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
      <td>${(m.volAnn * 100).toFixed(1)}%</td>
      <td>${m.sharpe.toFixed(2)}</td>
      <td>${m.beta.toFixed(2)}</td>
      <td style="color:var(--red)">${(m.maxDD * 100).toFixed(1)}%</td>
      <td><span class="risk-badge risk-${m.riskClass}" style="font-size:.68rem;padding:2px 8px">${m.riskLevel}</span></td>
    `;
    body.appendChild(tr);
  }

  const volColors = rowData.map(({ m }) => {
    const v = m.volAnn * 100;
    return v > 40 ? '#ff4b4b' : v > 20 ? '#f5a623' : '#00ff94';
  });
  Plotly.react('chartVolBar', [{
    type: 'bar',
    x: rowData.map(d => d.t), y: rowData.map(d => d.m.volAnn * 100),
    text: rowData.map(d => `${(d.m.volAnn * 100).toFixed(1)}%`),
    textposition: 'outside',
    marker: { color: volColors },
  }], {
    ...LAYOUT_BASE, height: 230,
    margin: { l: 50, r: 20, t: 30, b: 40 },
    yaxis: { ...LAYOUT_BASE.yaxis, title: { text: 'Volatility (%)', font: { size: 10 } } },
  }, CONFIG);
}

/* ═══════════════════════════════════════════════════════════════════════
   13. GLOSSARY
   ═══════════════════════════════════════════════════════════════════════ */
function buildGlossary() {
  const grid = document.getElementById('glossaryGrid');
  for (const item of STATE.glossary) {
    const card = document.createElement('div');
    card.className = 'glossary-card';
    card.innerHTML = `
      <div class="glossary-term">📌 ${item.term}</div>
      <div class="glossary-def">🇻🇳 ${item.vi}</div>
      <div class="glossary-en">🇬🇧 ${item.en}</div>
    `;
    grid.appendChild(card);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   14. INIT
   ═══════════════════════════════════════════════════════════════════════ */
async function init() {
  const res       = await fetch('stocks.json');
  const json      = await res.json();
  STATE.stocks    = json.stocks;
  STATE.glossary  = json.glossary;

  /* Pre-generate data */
  for (const ticker of Object.keys(STATE.stocks)) {
    STATE.allData[ticker] = generateStockData(ticker, 365);
  }

  initTabs();
  buildSidebar();
  initAIAnalysis();
  buildGlossary();
  initSearch();
  initWatchlist();
  renderWatchlist();
  render();
  updateClock();
  setInterval(updateClock, 1000);

  /* Hide loader */
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('hidden');
  setTimeout(() => overlay.remove(), 500);


  /* ── Dropdown: giữ 0.5s sau khi chuột rời ── */
  document.querySelectorAll('.topnav-dropdown-wrap').forEach(wrap => {
    let closeTimer = null;
    wrap.addEventListener('mouseenter', () => {
      clearTimeout(closeTimer);
      wrap.querySelector('.topnav-dropdown').classList.add('dropdown-open');
    });
    wrap.addEventListener('mouseleave', () => {
      closeTimer = setTimeout(() => {
        wrap.querySelector('.topnav-dropdown').classList.remove('dropdown-open');
      }, 500);
    });
  });
}

window.addEventListener('DOMContentLoaded', init);
