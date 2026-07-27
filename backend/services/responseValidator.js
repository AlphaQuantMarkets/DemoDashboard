// Heuristic backstop against directive buy/sell/hold advice slipping into an
// AI-generated response. This is defense-in-depth, not a guarantee — the
// prompt instructions given to the model are the primary defense. Shared by
// the risk-explanation and AI Tutor routes.
//
// Vocabulary is kept deliberately in step with what the prompts forbid
// (see prompts/tutorPrompt.js and prompts/riskExplanationPrompt.js): buy,
// sell, AND hold, in both Vietnamese and English.
//
// The "hold" patterns are narrower than the buy/sell ones on purpose. Bare
// "nên giữ" also appears in legitimate educational advice ("nên giữ bình
// tĩnh" — you should stay calm), so hold only matches the unambiguously
// financial "nắm giữ", or "giữ" followed by a position noun.
//
// Note on \b: Vietnamese diacritics (ữ, ế, ...) are not \w characters, so a
// trailing \b after them never matches. Patterns ending in a diacritic
// intentionally omit it.
const DIRECTIVE_PATTERNS = [
    /\bn(e|ê)n (mua|b(a|á)n)\b/,
    /\bh(a|ã)y (mua|b(a|á)n)\b/,
    /\b(mua|b(a|á)n) ngay\b/,
    /\bkhuy(e|ê|ế)n.{0,15}(mua|b(a|á)n)\b/,
    /\b(n(e|ê)n|h(a|ã)y) n(a|ắ)m gi(u|ữ)/,
    /\b(n(e|ê)n|h(a|ã)y) gi(u|ữ) (c(o|ổ) phi(e|ế)u|m(a|ã)|v(i|ị) th(e|ế))/,
    /\byou should (buy|sell|hold)\b/,
    /\b(buy|sell) now\b/
];

// A correctly-behaving model often declines by *quoting* the thing it won't
// do ("we cannot advise you on whether you should buy or sell"), which would
// otherwise trip the patterns above and throw away a good answer. A sentence
// carrying one of these refusal cues is treated as a refusal, not advice.
//
// Note this is deliberately about refusals, not plain negation: "bạn không
// nên mua" (you should not buy) carries no refusal cue and stays flagged,
// because recommending *against* a trade is still a recommendation.
const REFUSAL_PATTERNS = [
    /kh(o|ô)ng th(e|ể)/,
    /kh(o|ô)ng (dua|đưa) ra/,
    /kh(o|ô)ng (duoc|được) ph(e|é)p/,
    /\b(cannot|can not|can't|unable to|won't|will not)\b/,
    /\b(do|does) not (provide|give)\b/,
    /\bdon't (provide|give)\b/
];

const DEFAULT_FALLBACK_MESSAGE = "Nội dung không đáp ứng tiêu chuẩn an toàn, vui lòng thử lại.";

// Scoped per sentence so a refusal in one sentence can't excuse directive
// advice in another.
function splitIntoSentences(text) {
    return text.toLowerCase().split(/[.!?\n]+/);
}

function isDirectiveSentence(sentence) {
    if (REFUSAL_PATTERNS.some((pattern) => pattern.test(sentence))) {
        return false;
    }

    return DIRECTIVE_PATTERNS.some((pattern) => pattern.test(sentence));
}

function containsDirectiveAdvice(text) {
    if (typeof text !== "string" || !text) {
        return false;
    }

    return splitIntoSentences(text).some(isDirectiveSentence);
}

// Returns the text unchanged, or a safe fallback if it contains directive
// advice. Flagged responses are logged in full so they can be reviewed later
// and used to tune the patterns above.
function sanitizeExplanation(text, { fallbackMessage = DEFAULT_FALLBACK_MESSAGE, source = "unknown" } = {}) {
    if (!containsDirectiveAdvice(text)) {
        return text;
    }

    console.warn(`[responseValidator] Blocked directive advice from ${source}:`, text);

    return fallbackMessage;
}

module.exports = {
    containsDirectiveAdvice,
    sanitizeExplanation
};
