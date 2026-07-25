(function initializeTutorPage() {
  const SUGGESTED_QUESTIONS = [
    'What is Beta?',
    'Explain P/E Ratio',
    'What is volatility?',
    'Why is this stock considered risky?',
    'How do I evaluate a stock?'
  ];
  const STOCK_CONTEXT_KEY = 'alphaquant_tutor_stock_context_v1';

  function readStockContext() {
    try {
      const context = JSON.parse(localStorage.getItem(STOCK_CONTEXT_KEY));
      if (!context || typeof context !== 'object' || Array.isArray(context)) return null;

      return {
        symbol: context.symbol,
        companyName: context.companyName,
        currentPrice: context.currentPrice,
        beta: context.beta,
        volatility: context.volatility,
        sharpe: context.sharpe,
        maxDrawdown: context.maxDrawdown,
        riskLevel: context.riskLevel
      };
    } catch {
      return null;
    }
  }

  function friendlyError(error) {
    if (error.status === 401) return 'Please sign in again before using the AI Tutor.';
    if (error.status === 403) return 'AI Investment Tutor is available with Premium access.';
    if (error.status === 429) return 'The tutor is busy right now. Please wait a moment and try again.';
    if (error.status >= 500) return 'The tutor is temporarily unavailable. Please try again shortly.';
    return error.message || 'Something went wrong. Please try again.';
  }

  function initializePage() {
    const premiumGate = document.getElementById('premiumGate');
    const tutorApp = document.getElementById('tutorApp');
    const access = window.TutorPremiumAccess.getTutorAccess();
    premiumGate.hidden = access.isPremium;
    tutorApp.hidden = !access.isPremium;
    if (!access.isPremium) return;

    const form = document.getElementById('tutorForm');
    const input = document.getElementById('tutorInput');
    const sendButton = document.getElementById('tutorSend');
    const messages = document.getElementById('tutorMessages');
    const suggestions = document.getElementById('tutorSuggestions');
    const errorMessage = document.getElementById('tutorError');
    const contextLabel = document.getElementById('stockContextLabel');
    const userLevel = document.getElementById('userLevel');
    const stockContext = readStockContext();
    let isLoading = false;

    contextLabel.textContent = stockContext?.symbol
      ? `Using ${stockContext.symbol} as stock context`
      : 'General investment learning mode';

    function scrollToNewestMessage() {
      messages.scrollTop = messages.scrollHeight;
    }

    function appendMessage(role, text, loading = false) {
      const message = document.createElement('article');
      message.className = `tutor-message tutor-message--${role}`;
      const label = document.createElement('span');
      label.className = 'tutor-message__label';
      label.textContent = role === 'user' ? 'You' : 'AI Tutor';
      const content = document.createElement('p');
      content.className = 'tutor-message__content';

      if (loading) {
        content.classList.add('tutor-message__loading');
        content.setAttribute('aria-label', 'AI Tutor is thinking');
        for (let index = 0; index < 3; index += 1) {
          const dot = document.createElement('span');
          dot.className = 'tutor-loading-dot';
          content.appendChild(dot);
        }
      } else {
        content.textContent = text;
      }

      message.append(label, content);
      messages.appendChild(message);
      scrollToNewestMessage();
      return message;
    }

    function setLoading(loading) {
      isLoading = loading;
      input.disabled = loading;
      sendButton.disabled = loading;
      sendButton.setAttribute('aria-busy', String(loading));
    }

    async function sendQuestion(question) {
      const normalizedQuestion = question.trim();
      if (!normalizedQuestion || isLoading) return;

      errorMessage.hidden = true;
      appendMessage('user', normalizedQuestion);
      input.value = '';
      setLoading(true);
      const loadingMessage = appendMessage('assistant', '', true);

      try {
        const answer = await window.TutorApi.askTutor({
          question: normalizedQuestion,
          userLevel: userLevel.value,
          stockContext
        });
        loadingMessage.remove();
        appendMessage('assistant', answer);
      } catch (error) {
        loadingMessage.remove();
        errorMessage.textContent = friendlyError(error);
        errorMessage.hidden = false;
      } finally {
        setLoading(false);
        input.focus();
      }
    }

    SUGGESTED_QUESTIONS.forEach(question => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tutor-suggestion';
      button.textContent = question;
      button.addEventListener('click', () => sendQuestion(question));
      suggestions.appendChild(button);
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      sendQuestion(input.value);
    });

    appendMessage(
      'assistant',
      stockContext?.symbol
        ? `Hello! I can help you learn investing and explain ${stockContext.symbol}'s risk metrics.`
        : 'Hello! What would you like to learn about investing today?'
    );
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('developmentUpgradeButton')?.addEventListener('click', () => {
      if (window.TutorPremiumAccess.enableDevelopmentPremiumAccess()) initializePage();
    });
    initializePage();
  });
})();
