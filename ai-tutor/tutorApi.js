(function createTutorApi() {
  class TutorApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'TutorApiError';
      this.status = status;
    }
  }

  function apiUrl(path) {
    const baseUrl = window.ALPHAQUANT_API_BASE_URL || '';
    return baseUrl ? new URL(path, baseUrl).toString() : path;
  }

  async function askTutor({ question, userLevel, stockContext }) {
    let response;
    try {
      response = await fetch(apiUrl('/api/ai/tutor'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, userLevel, stockContext })
      });
    } catch {
      throw new TutorApiError('Unable to reach the AlphaQuant server.', 0);
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      throw new TutorApiError('The server returned an invalid response.', response.status);
    }

    if (!response.ok) {
      throw new TutorApiError(payload.error || 'Unable to answer your question.', response.status);
    }

    const answer = typeof payload.answer === 'string' ? payload.answer.trim() : '';
    if (!answer) {
      throw new TutorApiError('The tutor returned an empty response. Please try again.', response.status);
    }

    return answer;
  }

  window.TutorApi = { askTutor };
})();
