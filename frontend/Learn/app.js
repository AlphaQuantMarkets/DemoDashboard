/* AlphaQuant Interactive Learning Platform */

const LESSONS = [
  {
    id: 'price',
    title: 'Price',
    label: 'Price',
    body: 'Price là mức giá gần nhất mà người mua và người bán đồng ý giao dịch.',
    example: 'Nếu FPT đang ở 96.000 VND, đó là mức thị trường đang dùng để định giá một cổ phiếu FPT.',
    question: 'Price cho bạn biết điều gì?',
    answers: ['Giá giao dịch hiện tại', 'Số lượng nhân viên', 'Tên ngành kinh doanh'],
    correct: 0,
  },
  {
    id: 'candlestick',
    title: 'Candlestick',
    label: 'Candlestick',
    body: 'Candlestick là cách gói câu chuyện giá trong một phiên: mở cửa, cao nhất, thấp nhất và đóng cửa.',
    example: 'Một cây nến xanh thường cho thấy giá đóng cửa cao hơn giá mở cửa.',
    question: 'Một cây nến thường chứa thông tin nào?',
    answers: ['Open, High, Low, Close', 'Doanh thu, lợi nhuận, nợ vay', 'Số nhân viên, số cửa hàng, vốn điều lệ'],
    correct: 0,
  },
  {
    id: 'volume',
    title: 'Volume là gì?',
    label: 'Volume',
    body: 'Volume là số lượng cổ phiếu được giao dịch trong một khoảng thời gian.',
    example: 'Hãy tưởng tượng một khu chợ. Bình thường có 100 người. Hôm nay có 10.000 người. Đó chính là Volume tăng.',
    question: 'Volume tăng thường thể hiện điều gì?',
    answers: ['Thị trường quan tâm nhiều hơn', 'Công ty đổi tên', 'Giá chắc chắn sẽ tăng'],
    correct: 0,
  },
  {
    id: 'pe',
    title: 'PE',
    label: 'PE',
    body: 'PE cho biết nhà đầu tư đang trả bao nhiêu đồng cho 1 đồng lợi nhuận của doanh nghiệp.',
    example: 'PE 15 nghĩa là thị trường trả 15 đồng cho mỗi 1 đồng lợi nhuận một năm.',
    question: 'PE chủ yếu liên quan đến điều gì?',
    answers: ['Giá so với lợi nhuận', 'Khối lượng khớp lệnh', 'Màu của nến'],
    correct: 0,
  },
  {
    id: 'eps',
    title: 'EPS',
    label: 'EPS',
    body: 'EPS là lợi nhuận trên mỗi cổ phiếu, giúp bạn nhìn doanh nghiệp kiếm được bao nhiêu cho một cổ phần.',
    example: 'EPS 4.000 VND nghĩa là mỗi cổ phiếu tạo ra khoảng 4.000 VND lợi nhuận.',
    question: 'EPS nói về điều gì?',
    answers: ['Lợi nhuận trên mỗi cổ phiếu', 'Tốc độ đặt lệnh', 'Số người theo dõi'],
    correct: 0,
  },
  {
    id: 'rsi',
    title: 'RSI',
    label: 'RSI',
    body: 'RSI là chỉ báo động lượng, thường dùng để xem cổ phiếu đang nóng lên hay nguội đi.',
    example: 'RSI cao có thể cho thấy giá đã tăng nhanh, nhưng không có nghĩa là phải bán ngay.',
    question: 'RSI thường dùng để xem gì?',
    answers: ['Động lượng giá', 'Số cổ phiếu niêm yết', 'Lãi suất ngân hàng'],
    correct: 0,
  },
  {
    id: 'macd',
    title: 'MACD',
    label: 'MACD',
    body: 'MACD giúp quan sát xu hướng và sự thay đổi động lượng của giá.',
    example: 'Khi MACD đổi hướng, đó có thể là tín hiệu để bạn quan sát kỹ hơn, không phải nút mua bán tự động.',
    question: 'MACD hỗ trợ quan sát điều gì?',
    answers: ['Xu hướng và động lượng', 'Thuế giao dịch', 'Cổ tức tiền mặt'],
    correct: 0,
  },
];

const STOCKS = [
  { ticker: 'FPT', name: 'FPT Corp', price: 96200, change: 2.8, volume: 2.4, coach: 'Bạn vừa mở FPT. Hôm nay bạn chỉ cần chú ý Price và Volume. Bạn chưa cần quan tâm RSI.' },
  { ticker: 'VCB', name: 'Vietcombank', price: 87400, change: 0.7, volume: 1.1, coach: 'VCB biến động nhẹ. Hãy tập đọc Price trước, rồi nhìn Volume để xem dòng tiền có xác nhận hay không.' },
  { ticker: 'HPG', name: 'Hoa Phat', price: 28700, change: 1.9, volume: 1.9, coach: 'HPG có Volume Alert. Đây là ví dụ tốt để luyện cách nhận biết sự quan tâm bất thường của thị trường.' },
  { ticker: 'MWG', name: 'Mobile World', price: 59400, change: -1.4, volume: 0.8, coach: 'MWG đang giảm nhẹ nhưng Volume chưa cao. Người mới chưa cần vội kết luận xu hướng chỉ từ một phiên.' },
  { ticker: 'VNM', name: 'Vinamilk', price: 69200, change: 0.2, volume: 1.0, coach: 'VNM là mã ổn định để học Price. Hãy so sánh giá hôm nay với hôm qua trước khi đọc chỉ báo nâng cao.' },
];

const STORAGE_KEY = 'alphaquant_learning_state_v1';
const DEFAULT_STATE = {
  route: 'home',
  lessonIndex: 2,
  lessonStep: 'lesson',
  xp: 0,
  streak: 1,
  completed: ['price', 'candlestick'],
  cash: 100000000,
  holdings: { FPT: 0, VCB: 0, HPG: 0 },
};

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_STATE, ...saved, holdings: { ...DEFAULT_STATE.holdings, ...(saved?.holdings || {}) } };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatMoney(value) {
  return value.toLocaleString('vi-VN') + ' VND';
}

function getUnlockedIndex() {
  return Math.min(state.completed.length, LESSONS.length - 1);
}

function isLessonUnlocked(index) {
  return index <= getUnlockedIndex();
}

function addXP(amount) {
  state.xp += amount;
  state.streak = Math.max(1, state.streak);
  saveState();
}

function setRoute(route) {
  state.route = route;
  saveState();
  render();
}

function openModal(type = 'login') {
  const modal = document.getElementById('authModal');
  const title = document.getElementById('authModalTitle');
  const desc = document.getElementById('authModalDesc');
  if (!modal) return;
  title.textContent = type === 'signup' ? 'SIGN UP' : 'LOGIN';
  desc.textContent = type === 'signup'
    ? 'Tạo tài khoản AlphaQuant Learning để lưu tiến độ học.'
    : 'Đăng nhập vào tài khoản AlphaQuant của bạn.';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeModal() {
  const modal = document.getElementById('authModal');
  modal?.classList.add('hidden');
  modal?.classList.remove('flex');
}

window.openModal = openModal;
window.closeModal = closeModal;

function render() {
  renderRoute();
  renderNavigation();
  renderStatus();
  renderLessons();
  renderCoach();
  renderStocks();
  renderPractice();
  renderSandbox();
  renderAchievements();
}

function renderRoute() {
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
  document.getElementById(`view${capitalize(state.route)}`)?.classList.add('active');
}

function renderNavigation() {
  document.querySelectorAll('[data-route]').forEach(item => {
    item.classList.toggle('active', item.dataset.route === state.route);
  });
}

function renderStatus() {
  const level = Math.floor(state.xp / 100) + 1;
  const progress = Math.round((state.completed.length / LESSONS.length) * 100);
  setText('sidebarLevel', level);
  setText('sidebarXP', state.xp);
  setText('homeLevel', `Level ${level}`);
  setText('homeXP', `${state.xp} XP`);
  setText('homeStreak', `Daily streak ${state.streak}`);
  setText('sidebarProgressText', `${progress}% roadmap`);
  setStyle('sidebarProgress', 'width', `${progress}%`);
  setStyle('roadmapProgress', 'width', `${progress}%`);
  setText('roadmapProgressText', `${state.completed.length} of ${LESSONS.length} completed`);
  setText('missionStatus', state.completed.includes('volume') ? 'Completed' : 'Ready');
}

function renderLessons() {
  const lesson = LESSONS[state.lessonIndex];
  const isQuiz = state.lessonStep === 'quiz';

  setText('lessonSectionTitle', isQuiz ? 'Quiz' : 'Lesson');
  setText('lessonTitle', isQuiz ? lesson.question : lesson.title);
  setText('lessonBody', isQuiz ? 'Chọn một đáp án. Nếu đúng, bạn nhận XP và mở bài tiếp theo.' : lesson.body);

  const example = document.getElementById('lessonExample');
  if (example) {
    example.innerHTML = isQuiz
      ? lesson.answers.map((answer, index) => `<button class="quiz-option" data-answer="${index}">${answer}</button>`).join('')
      : lesson.example;
  }

  setText('prevLessonBtn', state.lessonStep === 'quiz' ? 'Back to Lesson' : 'Previous');
  setText('nextLessonBtn', state.lessonStep === 'quiz' ? 'Skip Quiz' : 'Next');

  const chips = document.getElementById('lessonChips');
  if (chips) {
    chips.innerHTML = LESSONS.map((item, index) => {
      const done = state.completed.includes(item.id);
      const unlocked = isLessonUnlocked(index);
      const symbol = done ? '✓' : unlocked ? '▶' : '🔒';
      return `<button class="lesson-chip ${done ? 'done' : ''} ${!unlocked ? 'locked' : ''}" data-lesson-index="${index}" ${!unlocked ? 'disabled' : ''}>${item.label} ${symbol}</button>`;
    }).join('');
  }

  const list = document.getElementById('roadmapList');
  if (list) {
    list.innerHTML = LESSONS.map((item, index) => {
      const done = state.completed.includes(item.id);
      const unlocked = isLessonUnlocked(index);
      return `
        <button class="roadmap-item ${done ? 'done' : ''} ${state.lessonIndex === index ? 'active' : ''}" data-lesson-index="${index}" ${!unlocked ? 'disabled' : ''}>
          <span>${item.label}</span>
          <strong>${done ? '✓' : unlocked ? 'Open' : '🔒'}</strong>
        </button>
      `;
    }).join('');
  }
}

function renderCoach(stock = STOCKS[0]) {
  setText('coachTitle', `Bạn vừa mở ${stock.ticker}`);
  setText('coachMessage', stock.coach);
}

function renderStocks() {
  const grid = document.getElementById('stockCards');
  if (!grid) return;
  grid.innerHTML = STOCKS.map(stock => `
    <button class="stock-card" data-stock="${stock.ticker}">
      <span class="stock-ticker">${stock.ticker}</span>
      <span>${stock.name}</span>
      <strong>${formatMoney(stock.price)}</strong>
      <em class="${stock.change >= 0 ? 'up' : 'down'}">${stock.change >= 0 ? '+' : ''}${stock.change}% · ${stock.volume}x volume</em>
    </button>
  `).join('');
}

function renderPractice() {
  const target = 'HPG';
  const grid = document.getElementById('practiceChoices');
  if (!grid) return;
  grid.innerHTML = STOCKS.slice(0, 4).map(stock => `
    <button class="practice-choice" data-practice="${stock.ticker}" data-correct="${stock.ticker === target}">
      <strong>${stock.ticker}</strong>
      <span>${stock.change >= 0 ? '+' : ''}${stock.change}%</span>
      <em>${stock.volume}x average volume</em>
    </button>
  `).join('');
}

function renderSandbox() {
  setText('cashValue', formatMoney(state.cash));

  const sandbox = document.getElementById('sandboxStocks');
  if (sandbox) {
    sandbox.innerHTML = STOCKS.slice(0, 3).map(stock => `
      <div class="sandbox-stock">
        <div>
          <strong>${stock.ticker}</strong>
          <span>${formatMoney(stock.price)}</span>
        </div>
        <div class="sandbox-actions">
          <button class="btn-outline" data-trade="sell" data-stock="${stock.ticker}">Sell</button>
          <button class="btn-solid" data-trade="buy" data-stock="${stock.ticker}">Buy</button>
        </div>
      </div>
    `).join('');
  }

  const portfolio = document.getElementById('portfolioList');
  if (portfolio) {
    portfolio.innerHTML = Object.entries(state.holdings).map(([ticker, qty]) => {
      const stock = STOCKS.find(item => item.ticker === ticker);
      return `
        <div class="portfolio-item">
          <span>${ticker}</span>
          <strong>${qty} shares</strong>
          <em>${formatMoney((stock?.price || 0) * qty)}</em>
        </div>
      `;
    }).join('');
  }
}

function renderAchievements() {
  const level = Math.floor(state.xp / 100) + 1;
  setText('achievementLevel', `Level ${level}`);
  setText('achievementXP', `${state.xp} XP`);
  setText('achievementStreak', `${state.streak} day${state.streak > 1 ? 's' : ''}`);

  const badges = [
    { name: 'First Steps', unlocked: state.completed.length >= 1 },
    { name: 'Volume Rookie', unlocked: state.completed.includes('volume') },
    { name: 'Practice Mindset', unlocked: state.xp >= 80 },
    { name: 'Sandbox Explorer', unlocked: Object.values(state.holdings).some(Boolean) },
  ];
  const grid = document.getElementById('badgeGrid');
  if (grid) {
    grid.innerHTML = badges.map(badge => `
      <div class="badge-card ${badge.unlocked ? 'unlocked' : 'locked'}">
        <strong>${badge.unlocked ? '✓' : '🔒'}</strong>
        <span>${badge.name}</span>
      </div>
    `).join('');
  }
}

function initEvents() {
  document.addEventListener('click', event => {
    const routeEl = event.target.closest('[data-route]');
    if (routeEl) {
      event.preventDefault();
      setRoute(routeEl.dataset.route);
      return;
    }

    const lessonEl = event.target.closest('[data-lesson-index]');
    if (lessonEl && !lessonEl.disabled) {
      state.lessonIndex = Number(lessonEl.dataset.lessonIndex);
      state.lessonStep = 'lesson';
      setRoute('learn');
      return;
    }

    const answerEl = event.target.closest('[data-answer]');
    if (answerEl) {
      handleQuizAnswer(Number(answerEl.dataset.answer));
      return;
    }

    const stockEl = event.target.closest('[data-stock]');
    if (stockEl && stockEl.classList.contains('stock-card')) {
      const stock = STOCKS.find(item => item.ticker === stockEl.dataset.stock);
      renderCoach(stock);
      return;
    }

    const coachEl = event.target.closest('[data-coach-action]');
    if (coachEl) {
      handleCoachAction(coachEl.dataset.coachAction);
      return;
    }

    const practiceEl = event.target.closest('[data-practice]');
    if (practiceEl) {
      handlePractice(practiceEl);
      return;
    }

    const tradeEl = event.target.closest('[data-trade]');
    if (tradeEl) {
      handleTrade(tradeEl.dataset.stock, tradeEl.dataset.trade);
    }
  });

  document.getElementById('startLessonBtn')?.addEventListener('click', () => {
    state.lessonIndex = LESSONS.findIndex(lesson => lesson.id === 'volume');
    state.lessonStep = 'lesson';
    setRoute('learn');
  });

  document.getElementById('nextLessonBtn')?.addEventListener('click', () => {
    state.lessonStep = state.lessonStep === 'lesson' ? 'quiz' : 'lesson';
    saveState();
    renderLessons();
  });

  document.getElementById('prevLessonBtn')?.addEventListener('click', () => {
    if (state.lessonStep === 'quiz') {
      state.lessonStep = 'lesson';
    } else {
      state.lessonIndex = Math.max(0, state.lessonIndex - 1);
    }
    saveState();
    render();
  });

  document.getElementById('resetSandboxBtn')?.addEventListener('click', () => {
    state.cash = DEFAULT_STATE.cash;
    state.holdings = { ...DEFAULT_STATE.holdings };
    saveState();
    renderSandbox();
    renderAchievements();
  });

  document.getElementById('headerSearch')?.addEventListener('input', handleSearch);
}

function handleQuizAnswer(index) {
  const lesson = LESSONS[state.lessonIndex];
  const options = document.querySelectorAll('.quiz-option');
  options.forEach(option => option.disabled = true);

  if (index === lesson.correct) {
    options[index]?.classList.add('correct');
    if (!state.completed.includes(lesson.id)) {
      state.completed.push(lesson.id);
      addXP(50);
    }
    setTimeout(() => {
      state.lessonIndex = Math.min(state.lessonIndex + 1, LESSONS.length - 1);
      state.lessonStep = 'lesson';
      saveState();
      render();
    }, 700);
  } else {
    options[index]?.classList.add('wrong');
    options[lesson.correct]?.classList.add('correct');
  }
}

function handleCoachAction(action) {
  if (action === 'practice') {
    setRoute('practice');
    return;
  }

  const message = action === 'example'
    ? 'Ví dụ: giá FPT tăng cùng Volume 2.4x nghĩa là nhiều người tham gia hơn bình thường. Đó là tín hiệu đáng quan sát.'
    : 'Volume không tự nói mua hay bán. Nó chỉ nói mức độ quan tâm. Người mới nên đọc Volume cùng Price trước.';
  setText('coachMessage', message);
}

function handlePractice(choice) {
  const correct = choice.dataset.correct === 'true';
  const feedback = document.getElementById('practiceFeedback');
  document.querySelectorAll('.practice-choice').forEach(btn => btn.classList.remove('correct', 'wrong'));
  choice.classList.add(correct ? 'correct' : 'wrong');

  if (correct) {
    feedback.textContent = 'Đúng. HPG có Volume 1.9x trung bình, nghĩa là dòng tiền đang chú ý hơn bình thường. +30 XP';
    addXP(30);
  } else {
    feedback.textContent = 'Chưa đúng. Hãy tìm mã có volume cao hơn trung bình rõ nhất. Trong bộ này, HPG là tín hiệu nổi bật.';
  }
  renderStatus();
  renderAchievements();
}

function handleTrade(ticker, action) {
  const stock = STOCKS.find(item => item.ticker === ticker);
  if (!stock) return;

  if (action === 'buy' && state.cash >= stock.price) {
    state.cash -= stock.price;
    state.holdings[ticker] = (state.holdings[ticker] || 0) + 1;
  }

  if (action === 'sell' && state.holdings[ticker] > 0) {
    state.cash += stock.price;
    state.holdings[ticker] -= 1;
  }

  saveState();
  renderSandbox();
  renderAchievements();
}

function handleSearch(event) {
  const value = event.target.value.trim().toLowerCase();
  const dropdown = document.getElementById('searchDropdown');
  if (!dropdown) return;

  if (!value) {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
    return;
  }

  const lessonMatches = LESSONS
    .map((lesson, index) => ({ type: 'lesson', label: lesson.label, index }))
    .filter(item => item.label.toLowerCase().includes(value));
  const stockMatches = STOCKS
    .filter(stock => stock.ticker.toLowerCase().includes(value) || stock.name.toLowerCase().includes(value))
    .map(stock => ({ type: 'stock', label: `${stock.ticker} — ${stock.name}` }));

  const results = [...lessonMatches, ...stockMatches].slice(0, 6);
  dropdown.innerHTML = results.map(item => `
    <button class="search-result-item search-action" data-search-type="${item.type}" data-search-index="${item.index ?? ''}">
      <span class="search-result-ticker">${item.type === 'lesson' ? 'LESSON' : 'STOCK'}</span>
      <span class="search-result-name">${item.label}</span>
    </button>
  `).join('');
  dropdown.classList.toggle('hidden', !results.length);

  dropdown.querySelectorAll('.search-action').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.searchType === 'lesson') {
        state.lessonIndex = Number(btn.dataset.searchIndex);
        state.lessonStep = 'lesson';
        setRoute('learn');
      } else {
        setRoute('home');
      }
      dropdown.classList.add('hidden');
      event.target.value = '';
    });
  });
}

function updateClock() {
  const el = document.getElementById('clockEl');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setStyle(id, prop, value) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = value;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function init() {
  initEvents();
  render();
  updateClock();
  setInterval(updateClock, 1000);

  const overlay = document.getElementById('loadingOverlay');
  const elapsed = Date.now() - (window.__loadStart || Date.now());
  setTimeout(() => overlay?.classList.add('hidden'), Math.max(0, 500 - elapsed));
}

window.addEventListener('DOMContentLoaded', init);
