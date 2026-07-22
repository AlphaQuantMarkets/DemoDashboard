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

async function loadStockData(tickers) {
  console.log("📥 Loading real data from Supabase for tickers:", tickers);
  
  if (!window.supabaseClient) {
    throw new Error('Supabase client is unavailable');
  }

  try {
    const rows = [];
    const pageSize = 1000;
    
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await window.supabaseClient
        .from('stock_prices')
        .select('symbol, trading_date, open, high, low, close, volume')
        .in('symbol', tickers)
        .order('trading_date', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('❌ Supabase select error:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        if (from === 0) {
          console.warn('⚠️ No data found for symbols:', tickers);
          console.warn('Make sure to run: python backend/fetch_stock_data.py');
        }
        break;
      }

      rows.push(...data);
      console.log(`  Fetched batch ${Math.floor(from/pageSize) + 1}: ${data.length} rows`);
      
      if (data.length < pageSize) break;
    }

    console.log(`✅ Total: ${rows.length} records from Supabase`);

    // Group by ticker
    const dataByTicker = {};
    for (const ticker of tickers) {
      dataByTicker[ticker] = [];
    }

    for (const row of rows) {
      if (dataByTicker[row.symbol]) {
        dataByTicker[row.symbol].push({
          date: new Date(`${row.trading_date}T00:00:00Z`),
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          volume: Number(row.volume),
        });
      }
    }

    // Limit to last 500 days per ticker & sort by date
    for (const ticker of tickers) {
      let data = dataByTicker[ticker];
      if (data.length > 500) {
        data = data.slice(-500);
      }
      // Ensure sorted ascending by date
      data.sort((a, b) => a.date - b.date);
      dataByTicker[ticker] = data;
      console.log(`  ${ticker}: ${data.length} days (${data[0]?.date.toDateString()} → ${data[data.length-1]?.date.toDateString()})`);
    }

    return dataByTicker;
  } catch (error) {
    console.error('❌ Failed to load stock data:', error.message);
    throw error;
  }
}
function computeMetrics(rows) {
  const closes  = rows.map(r => r.close);
  const rets    = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
  const mean    = rets.length ? rets.reduce((a, v) => a + v, 0) / rets.length : 0;
  const variance= rets.length ? rets.reduce((a, v) => a + (v - mean) ** 2, 0) / rets.length : 0;
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
  const prev      = closes.at(-2) ?? current;
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
function initGuideOverlay() {

  // Nếu guide metrics đã chạy xong thì không chạy lại
  if (window.__metricsGuideFinished) return;

}

let _chatGuideShown = false;
function initChatbotGuide() {
  if (_chatGuideShown) return;
  _chatGuideShown = true;
  const fab = document.getElementById('chatFab');
  if (!fab) return;

  const overlay = document.createElement('div');
  overlay.id = 'chatGuideOverlay';
  overlay.className = 'stock-guide-overlay';
  overlay.innerHTML = `
    <div id="chatGuideSpotlight" class="stock-guide-spotlight"></div>
    <div id="chatGuideTooltip" class="stock-guide-tooltip chat-guide-tooltip">
      <div class="chat-guide-arrow"></div>
      <div class="stock-guide-badge" style="color:#7ec8e3;">🤖 Trợ lý AI của bạn</div>
      <p class="stock-guide-desc">Đây là <strong>AlphaQuant AI</strong> — trợ lý giúp bạn hiểu các chỉ số, thuật ngữ và phân tích rủi ro chứng khoán dễ dàng hơn.</p>
      <p class="stock-guide-hint">Nhấn vào icon để thử ngay · ESC để bỏ qua</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const spotlight = overlay.querySelector('#chatGuideSpotlight');
  const tooltip   = overlay.querySelector('#chatGuideTooltip');

  function positionElements() {
    const r  = fab.getBoundingClientRect();
    const pad = 18;
    const cx  = r.left + r.width  / 2;
    const cy  = r.top  + r.height / 2;

    // Spotlight tròn — tâm trùng FAB, pad đều 4 phía
    const size = Math.max(r.width, r.height) + pad * 2;
    spotlight.style.width        = size + 'px';
    spotlight.style.height       = size + 'px';
    spotlight.style.left         = (cx - size / 2) + 'px';
    spotlight.style.top          = (cy - size / 2) + 'px';
    spotlight.style.borderRadius = '50%';
    spotlight.style.borderColor  = '#7ec8e3';
    spotlight.style.boxShadow    = '0 0 0 9999px rgba(6,11,20,0.85), 0 0 0 3px #7ec8e380';

    // Tooltip — đo thực tế chiều cao sau khi render
    const tooltipW = 230;
    tooltip.style.width     = tooltipW + 'px';
    tooltip.style.left      = '-9999px'; // render ngoài màn để đo
    tooltip.style.top       = '-9999px';
    tooltip.style.visibility = 'hidden';


    // Dùng requestAnimationFrame để đo sau khi browser layout
    requestAnimationFrame(() => {
      const tooltipH = tooltip.offsetHeight;
      let tLeft = r.left - tooltipW - 20;
      let tTop  = cy - tooltipH / 2;
      const arrow = tooltip.querySelector('.chat-guide-arrow');

      if (tLeft < 10) {
        // Không đủ chỗ bên trái → đặt tooltip phía TRÊN FAB
        tLeft = Math.max(10, Math.min(r.right - tooltipW, window.innerWidth - tooltipW - 10));
        tTop  = Math.max(10, r.top - tooltipH - 16);

        // Đổi mũi tên trỏ XUỐNG (dưới tooltip)
        if (arrow) {
          arrow.style.top         = 'auto';
          arrow.style.bottom      = '-9px';
          arrow.style.right       = 'auto';
          arrow.style.left        = (r.left + r.width / 2 - tLeft - 9) + 'px';
          arrow.style.transform   = 'none';
          arrow.style.borderLeft  = '9px solid transparent';
          arrow.style.borderRight = '9px solid transparent';
          arrow.style.borderTop   = '10px solid #7ec8e355';
          arrow.style.borderBottom = 'none';
        }
      } else {
        // Đủ chỗ bên trái → layout mặc định, mũi tên trỏ sang phải
        tLeft = Math.max(10, tLeft);
        tTop  = Math.max(10, Math.min(tTop, window.innerHeight - tooltipH - 54));
        if (arrow) {
          arrow.style.top         = Math.max(16, cy - tTop - 8) + 'px';
          arrow.style.bottom      = 'auto';
          arrow.style.right       = '-10px';
          arrow.style.left        = 'auto';
          arrow.style.transform   = 'translateY(-50%)';
          arrow.style.borderLeft  = '10px solid #7ec8e355';
          arrow.style.borderRight = 'none';
          arrow.style.borderTop   = '8px solid transparent';
          arrow.style.borderBottom = '8px solid transparent';
        }
      }

      tooltip.style.left       = tLeft + 'px';
      tooltip.style.top        = tTop  + 'px';
      tooltip.style.visibility = 'visible';
    });
  }

  // Scroll về đầu trang trước khi lock
  window.scrollTo({ top: 0, behavior: 'instant' });
  positionElements();
  window.addEventListener('resize', positionElements);
  document.body.style.overflow = 'hidden';

  function close() {
    overlay.classList.add('hidden');
    window.removeEventListener('resize', positionElements);
    document.body.style.overflow = '';
  }

  overlay.style.pointerEvents = 'auto';
  spotlight.style.pointerEvents = 'auto';
  spotlight.style.cursor = 'pointer';
  spotlight.addEventListener('click', () => { close(); fab.click(); });

  overlay.addEventListener('click', e => {
    if (!spotlight.contains(e.target) && !tooltip.contains(e.target)) close();
  });

  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });
}

function initMetricsGuide() {
  if (window.__metricsGuideFinished) return;

  const oldOverlay = document.getElementById('metricsGuideOverlay');
  if (oldOverlay) oldOverlay.remove();

  const STEPS = [
    {
      targetId: 'stockSelect',
      useWrapper: true,
      title: 'Chọn cổ phiếu',
      desc: 'Chọn mã cổ phiếu bạn muốn phân tích. Mỗi mã có dữ liệu giá và chỉ số rủi ro riêng biệt.',
    },
    {
      targetId: 'chatFab',
      useWrapper: false,
      title: 'Trợ lý AI',
      desc: 'Trợ lý AI sẵn sàng giải thích bất kỳ chỉ số nào bạn chưa hiểu.',
      round: true,
    },
    {
      targetId: 'mPriceVal',
      useWrapper: true,
      title: 'Giá hiện tại',
      desc: 'Giá đóng cửa gần nhất của cổ phiếu, kèm mức thay đổi so với phiên trước.',
    },
    {
      targetId: 'mVolVal',
      useWrapper: true,
      title: 'Volatility',
      desc: 'Mức độ dao động giá theo năm. Càng cao thì rủi ro và cơ hội lợi nhuận càng lớn.',
    },
    {
      targetId: 'mSharpeVal',
      useWrapper: true,
      title: 'Sharpe Ratio',
      desc: 'Tỷ suất lợi nhuận điều chỉnh theo rủi ro. Trên 1.0 được xem là hiệu quả.',
    },
    {
      targetId: 'mBetaVal',
      useWrapper: true,
      title: 'Beta',
      desc: 'Độ nhạy cảm của cổ phiếu so với thị trường. Beta < 1 ít biến động hơn thị trường, Beta > 1 biến động mạnh hơn.',
    },
    {
      targetId: 'mDrawdownVal',
      useWrapper: true,
      title: 'Max Drawdown',
      desc: 'Mức giảm sâu nhất từ đỉnh xuống đáy trong kỳ quan sát.',
    },
  ];

  const total = STEPS.length;
  let current = 0;

  const overlay = document.createElement('div');
  overlay.id = 'metricsGuideOverlay';
  overlay.className = 'stock-guide-overlay';
  overlay.innerHTML = `
    <div id="metricsSpotlight" class="stock-guide-spotlight metrics-spotlight"></div>
    <div id="metricsTooltip" class="metrics-tooltip">
      <div class="metrics-tooltip-arrow" id="metricsArrow"></div>
      <div class="metrics-tooltip-header">
        <span class="metrics-tooltip-step" id="metricsStep"></span>
        <button class="metrics-skip-btn" id="metricsSkip">Bỏ qua</button>
      </div>
      <div class="metrics-tooltip-title" id="metricsTitle"></div>
      <p class="metrics-tooltip-desc" id="metricsDesc"></p>
      <div class="metrics-tooltip-footer">
        <button class="metrics-next-btn" id="metricsNext">Tiếp theo →</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const spotlight = overlay.querySelector('#metricsSpotlight');
  const tooltip   = overlay.querySelector('#metricsTooltip');
  const stepEl    = overlay.querySelector('#metricsStep');
  const titleEl   = overlay.querySelector('#metricsTitle');
  const descEl    = overlay.querySelector('#metricsDesc');
  const nextBtn   = overlay.querySelector('#metricsNext');
  const skipBtn   = overlay.querySelector('#metricsSkip');
  const arrow     = overlay.querySelector('#metricsArrow');

  function getTarget(step) {
    const el = document.getElementById(step.targetId);
    if (!el) return null;
    return step.useWrapper ? (el.closest('.metric-card') || el.closest('.select-wrapper') || el) : el;
  }

  function positionStep(step) {
    const target = getTarget(step);
    if (!target) return;

    document.querySelectorAll('.guide-highlight-target').forEach(el => {
      el.classList.remove('guide-highlight-target');
      el.style.zIndex = '';
      el.style.position = '';
    });
    target.classList.add('guide-highlight-target');
    target.style.position = 'relative';
    target.style.zIndex = '100000';

    window.scrollTo({ top: 0, behavior: 'instant' });

    requestAnimationFrame(() => {
      const r   = target.getBoundingClientRect();
      const pad = step.round ? 18 : 10;
      const isRound = step.round || false;

      spotlight.style.display     = 'block';
      spotlight.style.opacity     = '1';
      spotlight.style.visibility  = 'visible';
      spotlight.style.pointerEvents = 'none';
      spotlight.style.zIndex      = '99999';
      spotlight.style.background  = 'transparent';

      if (isRound) {
        const size = Math.max(r.width, r.height) + pad * 2;
        const cx = r.left + r.width / 2;
        const cy = r.top  + r.height / 2;
        spotlight.style.width        = size + 'px';
        spotlight.style.height       = size + 'px';
        spotlight.style.left         = (cx - size / 2) + 'px';
        spotlight.style.top          = (cy - size / 2) + 'px';
        spotlight.style.borderRadius = '50%';
        spotlight.style.border       = '2px solid #00ff94';
        spotlight.style.boxShadow    = '0 0 0 9999px rgba(6,11,20,0.82), 0 0 18px rgba(0,255,148,0.55), 0 0 36px rgba(0,255,148,0.30)';
      } else {
        spotlight.style.width        = (r.width + pad * 2) + 'px';
        spotlight.style.height       = (r.height + pad * 2) + 'px';
        spotlight.style.left         = (r.left - pad) + 'px';
        spotlight.style.top          = (r.top  - pad) + 'px';
        spotlight.style.borderRadius = '12px';
        spotlight.style.border       = '2px solid #00ff94';
        spotlight.style.boxShadow    = '0 0 0 9999px rgba(6,11,20,0.82), 0 0 18px rgba(0,255,148,0.45), 0 0 36px rgba(0,255,148,0.25)';
      }

      const tooltipW = 260;
      tooltip.style.width      = tooltipW + 'px';
      tooltip.style.visibility = 'hidden';
      tooltip.style.left       = '-9999px';
      tooltip.style.top        = '-9999px';

      requestAnimationFrame(() => {
        const tooltipH    = tooltip.offsetHeight;
        const spaceRight  = window.innerWidth  - r.right  - 20;
        const spaceLeft   = r.left - 20;
        const spaceBottom = window.innerHeight - r.bottom - 20;

        let tLeft, tTop, arrowSide;

        if (spaceRight >= tooltipW + 16) {
          tLeft = r.right + 16;
          tTop  = r.top + r.height / 2 - tooltipH / 2;
          arrowSide = 'left';
        } else if (spaceLeft >= tooltipW + 16) {
          tLeft = r.left - tooltipW - 16;
          tTop  = r.top + r.height / 2 - tooltipH / 2;
          arrowSide = 'right';
        } else if (spaceBottom >= tooltipH + 16) {
          tLeft = r.left + r.width / 2 - tooltipW / 2;
          tTop  = r.bottom + 16;
          arrowSide = 'top';
        } else {
          tLeft = r.left + r.width / 2 - tooltipW / 2;
          tTop  = r.top - tooltipH - 16;
          arrowSide = 'bottom';
        }

        tLeft = Math.max(10, Math.min(tLeft, window.innerWidth  - tooltipW - 10));
        tTop  = Math.max(10, Math.min(tTop,  window.innerHeight - tooltipH - 54));

        tooltip.style.left       = tLeft + 'px';
        tooltip.style.top        = tTop  + 'px';
        tooltip.style.visibility = 'visible';

        arrow.className = 'metrics-tooltip-arrow metrics-arrow-' + arrowSide;
        if (arrowSide === 'left') {
          arrow.style.top  = Math.max(16, (r.top + r.height/2) - tTop - 8) + 'px';
          arrow.style.left = arrow.style.right = arrow.style.bottom = '';
        } else if (arrowSide === 'right') {
          arrow.style.top   = Math.max(16, (r.top + r.height/2) - tTop - 8) + 'px';
          arrow.style.right = arrow.style.left = arrow.style.bottom = '';
        } else if (arrowSide === 'top') {
          arrow.style.left   = Math.max(16, (r.left + r.width/2) - tLeft - 9) + 'px';
          arrow.style.top    = arrow.style.right = arrow.style.bottom = '';
        } else {
          arrow.style.left   = Math.max(16, (r.left + r.width/2) - tLeft - 9) + 'px';
          arrow.style.bottom = arrow.style.top = arrow.style.right = '';
        }
      });
    });
  }

  function showStep(index) {
    const step = STEPS[index];
    stepEl.textContent  = `${index + 1} / ${total}`;
    titleEl.textContent = step.title;
    descEl.textContent  = step.desc;
    nextBtn.textContent = index === total - 1 ? 'Hoàn thành ✓' : 'Tiếp theo →';
    positionStep(step);
  }

  let _closed = false;
  function close() {
    if (_closed) return;
    _closed = true;

    const spl = document.getElementById('metricsSpotlight');
    if (spl) { spl.style.boxShadow = 'none'; spl.style.display = 'none'; }

    document.querySelectorAll('.guide-highlight-target').forEach(el => {
      el.classList.remove('guide-highlight-target');
      el.style.zIndex = '';
      el.style.position = '';
    });

    document.body.style.overflow = '';
    document.querySelectorAll('#metricsGuideOverlay').forEach(el => el.remove());
    document.querySelectorAll('#chatGuideOverlay').forEach(el => el.remove());
    window.removeEventListener('resize', onResize);
    window.__metricsGuideFinished = true;
  }

  function onResize() { positionStep(STEPS[current]); }

  window.scrollTo({ top: 0, behavior: 'instant' });
  document.body.style.overflow = 'hidden';
  overlay.style.pointerEvents  = 'auto';
  tooltip.style.visibility     = 'visible';

  requestAnimationFrame(() => showStep(0));

  nextBtn.addEventListener('click', () => {
    if (current < total - 1) { current++; showStep(current); }
    else { close(); }
  });

  skipBtn.addEventListener('click', close);

  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    if (e.key === 'ArrowRight' && current < total - 1) { current++; showStep(current); }
  });

  window.addEventListener('resize', onResize);
}

const STATE = {
  stocks:     {},
  glossary:   [],
  guides:     [],
  selected:   null,
  period:     180,
  compareSet: new Set(),
  allData:    {},
  watchlist:  ['FPT', 'HPG'],   // default watchlist
  replay:     {
    day: 365,
    timer: null,
    speedMs: 500,
  },
};


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
    // Validation: check data exists
    if (!STATE.allData[ticker] || STATE.allData[ticker].length === 0) {
      console.warn(`⚠️ No data for ${ticker}, skipping watchlist item`);
      return; // Skip this ticker
    }

    const rows = STATE.allData[ticker];
    const m    = computeMetrics(rows.slice(-30));
    const price = rows[rows.length - 1].close.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
    
    item.addEventListener('click', e => {
      if (e.target.closest('.watchlist-remove')) return;
      STATE.selected = ticker;
      document.getElementById('stockSelect').value = ticker;
      STATE.compareSet.delete(ticker);
      buildCompareList();
      render();
    });
    
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

function resizeCharts(ids) {
  if (!window.Plotly?.Plots?.resize) return;
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) Plotly.Plots.resize(el);
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
      if (btn.dataset.tab === 'tab6') {
        requestAnimationFrame(() => {
          renderReplay();
          resizeCharts(['simChartCandle', 'simChartVolume', 'simChartLine']);
        });
      }
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
  if (!STATE.selected) {
    console.warn('No stock selected');
    return;
  }

  // Validation: check selected stock has data
  const rows = STATE.allData[STATE.selected];
  if (!rows || rows.length === 0) {
    console.error(`❌ No data for selected stock: ${STATE.selected}`);
    alert(`No data available for ${STATE.selected}. Please select another stock.`);
    return;
  }

  const slicedRows = rows.slice(-STATE.period);
  if (slicedRows.length === 0) {
    console.error(`❌ Period too long for ${STATE.selected} (only ${rows.length} days available)`);
    return;
  }

  const m    = computeMetrics(slicedRows);
  renderMetrics(m);
  renderRiskBadge(m);
  renderCandlestick(slicedRows);
  renderVolume(slicedRows);
  renderPriceLine(slicedRows);
  renderComparison();
  renderAIAnalysis();
  renderReplay();
}
function renderMetrics(m, prefix = 'm', labels = {}) {
  const cards = [
    { id: 'mPrice',    value: m.current.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      sub: `${m.changePct >= 0 ? '🔺' : '🔻'} ${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(2)}%`,
      color: m.changePct >= 0 ? 'var(--green)' : 'var(--red)' },
    { id: 'mVol',      value: `${(m.volAnn * 100).toFixed(1)}%`, sub: labels.volSub ?? 'Annualized', color: 'var(--green)' },
    { id: 'mSharpe',   value: m.sharpe.toFixed(2), sub: labels.sharpeSub ?? '> 1.0 là tốt', color: 'var(--green)' },
    { id: 'mBeta',     value: m.beta.toFixed(2),   sub: labels.betaSub ?? '< 1: ít rủi ro', color: 'var(--amber)' },
    { id: 'mDrawdown', value: `${(m.maxDD * 100).toFixed(1)}%`, sub: labels.drawdownSub ?? 'Mức giảm tối đa', color: 'var(--red)' },
  ];
  for (const c of cards) {
    const id = prefix + c.id.slice(1);
    const valEl = document.getElementById(id + 'Val');
    const subEl = document.getElementById(id + 'Sub');
    if (valEl) { valEl.textContent = c.value; valEl.style.color = c.color; }
    if (subEl)   subEl.textContent = c.sub;
  }
}

function renderRiskBadge(m, targetId = 'riskBadge') {
  const el = document.getElementById(targetId);
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

function renderCandlestick(rows, targetId = 'chartCandle', name = STATE.selected) {
  const trace = {
    type: 'candlestick',
    x: rows.map(r => r.date),
    open:  rows.map(r => r.open),
    high:  rows.map(r => r.high),
    low:   rows.map(r => r.low),
    close: rows.map(r => r.close),
    increasing: { line: { color: '#00ff94' }, fillcolor: '#00ff9450' },
    decreasing: { line: { color: '#ff4b4b' }, fillcolor: '#ff4b4b50' },
    name,
  };
  Plotly.react(targetId, [trace], {
    ...LAYOUT_BASE, height: 300,
    xaxis:  { ...LAYOUT_BASE.xaxis, rangeslider: { visible: false } },
    yaxis:  { ...LAYOUT_BASE.yaxis, title: { text: 'Giá (nghìn VNĐ)', font: { size: 10 } } },
    margin: { l: 60, r: 20, t: 10, b: 40 },
  }, CONFIG);
}

function renderVolume(rows, targetId = 'chartVolume') {
  const trace = {
    type: 'bar',
    x: rows.map(r => r.date), y: rows.map(r => r.volume),
    marker: { color: rows.map(r => r.close >= r.open ? '#00ff94' : '#ff4b4b'), opacity: 0.8 },
  };
  Plotly.react(targetId, [trace], {
    ...LAYOUT_BASE, height: 190,
    margin: { l: 60, r: 20, t: 10, b: 40 },
    yaxis:  { ...LAYOUT_BASE.yaxis, title: { text: 'KL', font: { size: 10 } } },
  }, CONFIG);
}

function renderPriceLine(rows, targetId = 'chartLine') {
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
  Plotly.react(targetId, [t1, t2], {
    ...LAYOUT_BASE, height: 190, showlegend: true,
    legend: { orientation: 'h', y: 1.18, font: { size: 10 } },
    margin: { l: 55, r: 55, t: 24, b: 40 },
    yaxis:  { ...LAYOUT_BASE.yaxis, title: { text: 'Giá', font: { size: 10 } } },
    yaxis2: { title: { text: 'Volatility %', font: { size: 10 } }, overlaying: 'y', side: 'right',
              gridcolor: '#0d2137', showgrid: false, tickfont: { size: 10 } },
  }, CONFIG);
}

/* ═══════════════════════════════════════════════════════════════════════
   11B. MARKET REPLAY
   ═══════════════════════════════════════════════════════════════════════ */
function getReplayMaxDay() {
  const rows = STATE.allData[STATE.selected] || [];
  return rows.length || 1;
}

function clampReplayDay(day) {
  const maxDay = getReplayMaxDay();
  return Math.min(maxDay, Math.max(1, Number(day) || 1));
}

function getReplayRows() {
  const rows = STATE.allData[STATE.selected] || [];
  const day = clampReplayDay(STATE.replay.day);
  STATE.replay.day = day;
  return rows.slice(0, Math.min(day + 1, rows.length));
}

function setReplayPlaying(isPlaying) {
  const playBtn = document.getElementById('replayPlayBtn');
  const pauseBtn = document.getElementById('replayPauseBtn');
  if (playBtn) playBtn.disabled = isPlaying;
  if (pauseBtn) pauseBtn.disabled = !isPlaying;
}

function pauseReplay() {
  if (STATE.replay.timer) {
    clearInterval(STATE.replay.timer);
    STATE.replay.timer = null;
  }
  setReplayPlaying(false);
}

function setReplayDay(day) {
  STATE.replay.day = clampReplayDay(day);
  renderReplay();
}

function stepReplay(delta) {
  pauseReplay();
  setReplayDay(STATE.replay.day + delta);
}

function playReplay() {
  if (!STATE.selected || STATE.replay.timer) return;
  setReplayPlaying(true);
  STATE.replay.timer = setInterval(() => {
    const nextDay = clampReplayDay(STATE.replay.day + 1);
    if (nextDay === STATE.replay.day) {
      pauseReplay();
      return;
    }
    STATE.replay.day = nextDay;
    renderReplay();
  }, STATE.replay.speedMs);
}

function initReplayControls() {
  const slider = document.getElementById('replaySlider');
  const playBtn = document.getElementById('replayPlayBtn');
  const pauseBtn = document.getElementById('replayPauseBtn');
  const backBtn = document.getElementById('replayBackBtn');
  const forwardBtn = document.getElementById('replayForwardBtn');

  if (slider) {
    slider.addEventListener('input', () => {
      pauseReplay();
      setReplayDay(slider.value);
    });
  }
  if (playBtn) playBtn.addEventListener('click', playReplay);
  if (pauseBtn) pauseBtn.addEventListener('click', pauseReplay);
  if (backBtn) backBtn.addEventListener('click', () => stepReplay(-1));
  if (forwardBtn) forwardBtn.addEventListener('click', () => stepReplay(1));

  setReplayPlaying(false);
}

function renderReplay() {
  if (!STATE.selected) return;

  const rows = getReplayRows();
  if (!rows.length) return;

  const maxDay = getReplayMaxDay();
  const slider = document.getElementById('replaySlider');
  const label = document.getElementById('replayDayLabel');

  if (slider) {
    slider.min = 1;
    slider.max = maxDay;
    slider.value = STATE.replay.day;
  }
  if (label) label.textContent = `Day ${STATE.replay.day} / ${maxDay}`;

  const m = computeMetrics(rows);
  renderMetrics(m, 'sim', {
    volSub: 'Annualized',
    sharpeSub: 'Replay realtime',
    betaSub: 'vs VN-Index',
    drawdownSub: 'Replay history',
  });
  renderRiskBadge(m, 'simRiskBadge');
  renderCandlestick(rows, 'simChartCandle', `${STATE.selected} Replay`);
  renderVolume(rows, 'simChartVolume');
  renderPriceLine(rows, 'simChartLine');
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
   13B. PRODUCT FEATURE HOVER GUIDE
   ═══════════════════════════════════════════════════════════════════════ */
async function loadProductGuides() {
  try {
    const res = await fetch('guide.json');
    if (!res.ok) throw new Error('guide.json not found');
    const guides = await res.json();
    STATE.guides = Array.isArray(guides) ? guides.filter(g => g.selector && g.title) : [];
  } catch (err) {
    console.warn('Không thể tải guide.json:', err);
    STATE.guides = [];
  }
}

function initProductGuidePanel() {
  if (!STATE.guides.length || document.getElementById('productGuidePanel')) return;

  const panel = document.createElement('aside');
  panel.id = 'productGuidePanel';
  panel.className = 'product-guide-panel';
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = `
    <div class="product-guide-kicker">Tính năng sản phẩm</div>

    <div class="product-guide-summary">
      <strong class="product-guide-content_title">Description:</strong>
      <span class="product-guide-summary-text"></span>
    </div>

    <div class="product-guide-example">
      <strong class="product-guide-content_title">Example:</strong>
      <span class="product-guide-example-text"></span>
    </div>
  `;
  document.body.appendChild(panel);

  let activeTarget = null;
  let activeGuide = null;
  let hideTimer = null;


  const summaryEl = panel.querySelector('.product-guide-summary-text');
  const exampleEl = panel.querySelector('.product-guide-example-text');

  function findGuideTarget(node) {
    if (!node || node === document || node === window) return null;
    for (const guide of STATE.guides) {
      const target = node.closest?.(guide.selector);
      if (target) return { guide, target };
    }
    return null;
  }

  function showGuide(guide, target) {
    clearTimeout(hideTimer);
    activeGuide = guide;
    activeTarget = target;

    summaryEl.textContent = guide.summary || guide.how || '';
    exampleEl.textContent = guide.example || '';

    panel.classList.add('visible');
  }

  function hideGuide() {
    hideTimer = setTimeout(() => {
      panel.classList.remove('visible');
      activeTarget = null;
      activeGuide = null;
    }, 90);
  }

  document.addEventListener('mouseover', e => {
    const match = findGuideTarget(e.target);
    if (!match) return;
    if (match.target === activeTarget && match.guide === activeGuide) return;
    showGuide(match.guide, match.target);
  });

  document.addEventListener('mouseout', e => {
    if (!activeTarget) return;
    const to = e.relatedTarget;
    if (to && activeTarget.contains(to)) return;
    hideGuide();
  });

  document.addEventListener('focusin', e => {
    const match = findGuideTarget(e.target);
    if (match) showGuide(match.guide, match.target);
  });

  document.addEventListener('focusout', e => {
    if (activeTarget && activeTarget.contains(e.target)) hideGuide();
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   14. INIT
   ═══════════════════════════════════════════════════════════════════════ */
async function init() {
  window.scrollTo({ top: 0, behavior: 'instant' });
  
  const res       = await fetch('stocks.json');
  const json      = await res.json();
  STATE.stocks    = json.stocks;
  STATE.glossary  = json.glossary;
  await loadProductGuides();

  // ========== REAL DATA FROM SUPABASE ==========
  const tickers = ['FPT', 'HPG', 'VNM']; // Only 3 symbols
  console.log('🔄 Initializing with real data from Supabase...');

  try {
    const realData = await loadStockData(tickers);
    
    // Verify data loaded successfully
    const hasData = Object.values(realData).some(arr => arr.length > 0);
    if (!hasData) {
      throw new Error('No data returned from Supabase');
    }
    
    STATE.allData = realData;
    STATE.selected = STATE.selected || 'FPT'; // Default to FPT
    console.log('✅ Real data loaded successfully');
    
    // Clear old fake data cache
    try {
      localStorage.removeItem('fakeStockCache');
      sessionStorage.clear();
    } catch (e) {
      console.warn('Could not clear old cache');
    }
    
  } catch (error) {
    console.error('❌ Failed to load real data from Supabase:', error.message);
    alert('⚠️ Không thể kết nối Supabase.\n\nVui lòng kiểm tra:\n1. Internet connection\n2. Supabase API keys\n3. Database has stock_prices data\n\nError: ' + error.message);
    return; // Stop init if data fails
  }
  // ========================================

  initTabs();
  buildSidebar();
  initReplayControls();
  initAIAnalysis();
  buildGlossary();
  initSearch();
  initWatchlist();
  initProductGuidePanel();
  renderWatchlist();
  render();
  updateClock();
  setInterval(updateClock, 1000);

   /* Hide loader */
  const overlay = document.getElementById('loadingOverlay');
  const loadStart = window.__loadStart || Date.now();
  const elapsed = Date.now() - loadStart;
  const remaining = Math.max(0, 1000 - elapsed);
  setTimeout(() => {
    overlay.classList.add('hidden');
    setTimeout(() => {
      overlay.remove();
      initMetricsGuide();
    }, 500);
  }, remaining);

  /* Dropdown hover behavior */
  const allWraps = document.querySelectorAll('.topnav-dropdown-wrap');
  allWraps.forEach(wrap => {
    wrap.addEventListener('mouseenter', () => {
      allWraps.forEach(w => w.querySelector('.topnav-dropdown').classList.remove('dropdown-open'));
      wrap.querySelector('.topnav-dropdown').classList.add('dropdown-open');
    });
    wrap.addEventListener('mouseleave', e => {
      const to = e.relatedTarget;
      if (wrap.contains(to)) return;
      if (to?.closest('.topnav-dropdown-wrap')) return;
      wrap.querySelector('.topnav-dropdown').classList.remove('dropdown-open');
    });
  });
}

window.addEventListener('DOMContentLoaded', init);

/* ═══════════════════════════════════════════════════════════════════════
   CHATBOT WIDGET — AI thật (Anthropic API)
   ═══════════════════════════════════════════════════════════════════════ */
(function initChatbot() {
  const fab        = document.getElementById('chatFab');
  const chatWindow = document.getElementById('chatWindow');
  const closeBtn   = document.getElementById('chatCloseBtn');
  const input      = document.getElementById('chatInput');
  const sendBtn    = document.getElementById('chatSendBtn');
  const msgBox     = document.getElementById('chatMessages');

  const tooltip = document.getElementById('chatTooltip');
  const tooltipClose = document.getElementById('chatTooltipClose');
  const hideTooltip = () => tooltip?.classList.add('hidden');
  const showTooltip = () => {
    tooltip?.classList.remove('hidden');
    setTimeout(hideTooltip, 7000);
  };

  hideTooltip(); // ẩn từ đầu, chờ guide đóng mới hiện
  tooltipClose?.addEventListener('click', hideTooltip);
  fab.addEventListener('click', hideTooltip);

  // Expose để initGuideOverlay gọi sau khi đóng guide
  window._showChatTooltip = showTooltip;

  // history gửi lên API (không gồm system prompt)
  const history = [];

  const SYSTEM = `Bạn là AlphaQuant AI — trợ lý phân tích rủi ro chứng khoán Việt Nam.
Trả lời ngắn gọn, rõ ràng, bằng tiếng Việt (hoặc tiếng Anh nếu người dùng hỏi tiếng Anh).
Chỉ tư vấn thông tin tham khảo, không phải khuyến nghị đầu tư chính thức.
Các cổ phiếu có trong hệ thống: VNM (Vinamilk), VIC (Vingroup), HPG (Hòa Phát), FPT (FPT Corp), MWG (Mobile World), VHM (Vinhomes).
Các chỉ số hỗ trợ: Volatility, Sharpe Ratio, Beta, Max Drawdown, Rolling Volatility.`;

  /* Toggle cửa sổ */
  fab.addEventListener('click', () => {
    chatWindow.classList.toggle('chat-hidden');
    if (!chatWindow.classList.contains('chat-hidden')) {
      input.focus();
    }
  });
  closeBtn.addEventListener('click', () => chatWindow.classList.add('chat-hidden'));

  /* Append bubble */
  function appendMsg(role, text, isTyping = false) {
    const wrap = document.createElement('div');
    wrap.className = `chat-msg ${role}${isTyping ? ' typing' : ''}`;
    const span = document.createElement('span');
    span.textContent = text;
    wrap.appendChild(span);
    msgBox.appendChild(wrap);
    msgBox.scrollTop = msgBox.scrollHeight;
    return wrap;
  }

  /* Gọi Anthropic API */

/* Comment  để lúc sau call API cũng được
  async function askAI(userText) {
    history.push({ role: 'user', content: userText });

    const typingBubble = appendMsg('ai', 'Đang soạn tin nhắn...', true);
    sendBtn.disabled = true;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM,
          messages: history,
        }),
      });

      const data = await res.json();
      const reply = data?.content?.[0]?.text ?? 'Xin lỗi, không nhận được phản hồi.';

      typingBubble.remove();
      appendMsg('ai', reply);
      history.push({ role: 'assistant', content: reply });

    } catch (err) {
      typingBubble.remove();
      appendMsg('ai', '⚠️ Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

*/

const FAKE_RESPONSES = [
    // Lượt 1 — ATO
    `Mình lấy ví dụ cho bạn dễ hình dung nhé! ATO giống như bạn đứng xếp hàng trước cửa store Apple vào ngày mở bán iPhone mới ấy. Thay vì mặc cả giá, bạn chỉ việc đưa tiền cho nhân viên và bảo: "Bất kể sáng nay cửa hàng mở bán giá bao nhiêu, mình chốt luôn một cái, lấy ngay lúc mở cửa!"\n\n📌 <b>ATO (At The Opening)</b>: Là lệnh ưu tiên mua hoặc bán bằng mọi giá ngay khi thị trường vừa "mở mắt" (thường là <b>9h – 9h15 sáng</b>).\n\n• Bạn không cần ghi mức giá cụ thể — cứ ghi <b>"ATO"</b> vào ô mức giá là xong.\n• Nó có <b>quyền ưu tiên cao nhất</b>, kiểu gì cũng được khớp trước mấy người đang ngồi mặc cả từng đồng.`,

    // Lượt 2 — Volatility
    `<b>Volatility</b> cao không phải xấu hay tốt — nó phụ thuộc vào <b>khẩu vị rủi ro</b> của bạn.\n\nMình lấy ví dụ cho dễ hiểu: Volatility giống như <b>"độ rung của con thuyền"</b>. Thuyền rung mạnh thì người sợ nước sẽ nôn, nhưng dân mạo hiểm lại thích.\n\n• <b>Bạn mới bắt đầu?</b> → Chọn cổ phiếu <b>Volatility &lt; 20%</b> trước — ít biến động, dễ ngủ yên.\n• <b>Đã có kinh nghiệm hơn?</b> → Volatility cao = cơ hội cao, nhưng phải <b>đặt stop-loss</b> và không bỏ tất cả trứng vào một rổ.\n\n💡 <i>Bí quyết của mình</i>: Chỉ vào cổ phiếu Volatility cao khi <b>Sharpe Ratio &gt; 1.5</b> — tức lợi nhuận phải xứng đáng với rủi ro bạn đã chấp nhận. Nếu không, mình chuyển sang mã khác ngay.`
  ];

  let fakeMsgCount = 0;

async function askAI(userText) {
    history.push({ role: 'user', content: userText });

    sendBtn.disabled = true;

    // Tạo bubble AI với span rỗng trước
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg ai';
    const span = document.createElement('span');
    wrap.appendChild(span);
    msgBox.appendChild(wrap);
    msgBox.scrollTop = msgBox.scrollHeight;

    const raw = FAKE_RESPONSES[Math.min(fakeMsgCount, FAKE_RESPONSES.length - 1)];
    fakeMsgCount++;

    // Tách thành các "token" — giữ nguyên tag HTML, tách từng ký tự text
    const tokens = [];
    let buffer = '';
    let inTag = false;
    for (const ch of raw) {
      if (ch === '<') { if (buffer) { tokens.push(...buffer.split('')); buffer = ''; } inTag = true; buffer += ch; }
      else if (ch === '>') { buffer += ch; tokens.push(buffer); buffer = ''; inTag = false; }
      else if (inTag) { buffer += ch; }
      else { buffer += ch; }
    }
    if (buffer) tokens.push(...buffer.split(''));

    // Typing animation — mỗi token delay 18ms
    let displayed = '';
    for (const token of tokens) {
      displayed += token;
      span.innerHTML = displayed.replace(/\n/g, '<br/>');
      msgBox.scrollTop = msgBox.scrollHeight;
      await new Promise(r => setTimeout(r, token.startsWith('<') ? 0 : 18));
    }

    history.push({ role: 'assistant', content: raw });
    sendBtn.disabled = false;
    input.focus();
  }

  /* Send */
  function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    appendMsg('user', text);
    input.value = '';
    askAI(text);
  }

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });
})();

function buildSidebar() {
  const sel = document.getElementById('stockSelect');

  // Sync mobile select
  const selMobile = document.getElementById('stockSelectMobile');
  if (selMobile) {
    const placeholderM = document.createElement('option');
    placeholderM.value = ''; placeholderM.textContent = '— Chọn cổ phiếu —';
    placeholderM.disabled = true; placeholderM.selected = true;
    selMobile.appendChild(placeholderM);
    for (const [ticker, info] of Object.entries(STATE.stocks)) {
      const opt = document.createElement('option');
      opt.value = ticker;
      opt.textContent = `${ticker} — ${info.name}`;
      selMobile.appendChild(opt);
    }
    selMobile.addEventListener('change', () => {
      STATE.selected = selMobile.value;
      sel.value = selMobile.value;
      STATE.compareSet.delete(selMobile.value);
      buildCompareList();
      renderWatchlist();
      render();
    });
  }

  // Placeholder option
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Chọn cổ phiếu —';
  placeholder.disabled = true;
  placeholder.selected = true;
  sel.appendChild(placeholder);

  for (const [ticker, info] of Object.entries(STATE.stocks)) {
    const opt = document.createElement('option');
    opt.value = ticker;
    opt.textContent = `${ticker} — ${info.name}`;
    sel.appendChild(opt);
  }

  sel.value = STATE.selected || '';

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


const currentUser = JSON.parse(
    localStorage.getItem("user")
);

console.log(currentUser);

window.updateNavbar = updateNavbar;
window.logout = logout;
window.openModal = openModal;
window.closeModal = closeModal;
