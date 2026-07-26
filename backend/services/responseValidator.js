// Heuristic backstop against directive buy/sell/hold advice slipping into an
// AI-generated response. This is defense-in-depth, not a guarantee — the
// prompt instructions given to the model are the primary defense. Written
// generically (not risk-explanation-specific) so it can also be wired into
// the AI Tutor's /tutor route in the future with just one new call site.
const DIRECTIVE_PATTERNS = [
    /\bn(e|ê)n (mua|b(a|á)n)\b/,
    /\bh(a|ã)y (mua|b(a|á)n)\b/,
    /\b(mua|b(a|á)n) ngay\b/,
    /\bkhuy(e|ê)n.{0,15}(mua|b(a|á)n)\b/,
    /\byou should (buy|sell|hold)\b/,
    /\b(buy|sell) now\b/
];

function containsDirectiveAdvice(text) {
    if (typeof text !== "string" || !text) {
        return false;
    }

    const normalized = text.toLowerCase();
    return DIRECTIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sanitizeExplanation(text, fallbackMessage = "Nội dung không đáp ứng tiêu chuẩn an toàn, vui lòng thử lại.") {
    return containsDirectiveAdvice(text) ? fallbackMessage : text;
}

module.exports = {
    containsDirectiveAdvice,
    sanitizeExplanation
};
