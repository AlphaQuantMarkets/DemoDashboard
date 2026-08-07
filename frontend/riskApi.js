(function createRiskApi() {
  class RiskApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'RiskApiError';
      this.status = status;
    }
  }

  async function explainRisk(payload) {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/ai/risk-explanation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new RiskApiError('Unable to reach the AlphaQuant server.', 0);
    }

    let data = {};
    try {
      data = await response.json();
    } catch {
      throw new RiskApiError('The server returned an invalid response.', response.status);
    }

    if (!response.ok) {
      throw new RiskApiError(data.error || 'Unable to generate a risk explanation.', response.status);
    }

    const explanation = typeof data.explanation === 'string' ? data.explanation.trim() : '';
    if (!explanation) {
      throw new RiskApiError('The AI returned an empty explanation. Please try again.', response.status);
    }

    return explanation;
  }

  window.RiskApi = { explainRisk };
})();
