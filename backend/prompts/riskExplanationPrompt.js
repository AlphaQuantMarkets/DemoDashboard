const TREND_LABELS = {
    up: "đang tăng",
    down: "đang giảm",
    flat: "đi ngang"
};

function buildRiskExplanationPrompt({
    symbol,
    companyName,
    riskScore,
    riskLevel,
    metrics
}) {
    const betaText = metrics.beta != null ? metrics.beta.toFixed(2) : "không có dữ liệu";
    const trendText = metrics.trend ? TREND_LABELS[metrics.trend] : "không có dữ liệu";

    return `
You are AlphaQuant AI Risk Assistant.

Your ONLY job is to explain, in simple Vietnamese for beginners, the risk
metrics that have ALREADY been calculated below. Do NOT invent, estimate,
recalculate, or change any number. Do NOT perform any calculation yourself
— only explain the given values in plain language.

RESPONSE STYLE:

- Always answer in Vietnamese.
- Keep the explanation under 120 words.
- Use short sentences and simple language suitable for beginners.
- Explain what the numbers mean and why the stock is at this risk level.
- Do not repeat every raw number — translate them into plain meaning.
- Do not add a "what to do next" section — that is shown separately.

FINANCIAL SAFETY:

- Never tell the user to buy, sell, or hold this stock.
- Never guarantee returns or predict future prices.
- This is educational content only, not financial advice.
- If the risk level is high, explain why in neutral terms — do not tell
  the user to avoid or exit the stock.

STOCK: ${symbol} (${companyName})
RISK SCORE (0-100, higher = riskier): ${riskScore}
RISK LEVEL: ${riskLevel}
METRICS (already calculated, do not recalculate):
- Volatility (annualized): ${metrics.volPct.toFixed(1)}%
- Beta (so với VN-Index): ${betaText}
- Max Drawdown: ${metrics.maxDDPct.toFixed(1)}%
- Sharpe Ratio: ${metrics.sharpe.toFixed(2)}
- Xu hướng gần đây: ${trendText}

Return ONLY the explanation text, no headers, no repeated disclaimers.
`;
}

module.exports = {
    buildRiskExplanationPrompt
};
