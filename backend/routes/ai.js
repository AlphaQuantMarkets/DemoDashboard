const express = require("express");
const router = express.Router();

const { askGemini } = require("../services/geminiServices");
const { buildTutorPrompt } = require("../prompts/tutorPrompt");
const { buildRiskExplanationPrompt } = require("../prompts/riskExplanationPrompt");
const { requirePremiumTutorAccess } = require("../services/tutorAccess");
const { sanitizeExplanation } = require("../services/responseValidator");
const authMiddleware = require("../middleware/authMiddleware");

const RISK_LEVELS = ["low", "medium", "high"];
const TRENDS = ["up", "down", "flat"];

// Shown instead of a tutor answer that slipped past the prompt's safety rules
// and gave a directive buy/sell/hold recommendation. Steers the user back to
// what the tutor is for rather than just refusing.
const TUTOR_SAFETY_FALLBACK = "Mình không thể đưa ra khuyến nghị mua, bán hay nắm giữ một cổ phiếu cụ thể. Bạn có thể hỏi mình về cách đọc các chỉ số rủi ro hoặc các khái niệm đầu tư nhé.";

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function validateRiskExplanationRequest(body) {
    const { symbol, companyName, riskScore, riskLevel, metrics } = body;

    if (typeof symbol !== "string" || !symbol.trim() || symbol.length > 10) {
        return "A valid stock symbol is required.";
    }

    if (typeof companyName !== "string" || !companyName.trim() || companyName.length > 100) {
        return "A valid company name is required.";
    }

    if (!isFiniteNumber(riskScore) || riskScore < 0 || riskScore > 100) {
        return "riskScore must be a number between 0 and 100.";
    }

    if (!RISK_LEVELS.includes(riskLevel)) {
        return `riskLevel must be one of: ${RISK_LEVELS.join(", ")}`;
    }

    if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
        return "metrics is required.";
    }

    if (!isFiniteNumber(metrics.volPct) || !isFiniteNumber(metrics.sharpe) || !isFiniteNumber(metrics.maxDDPct)) {
        return "metrics.volPct, metrics.sharpe, and metrics.maxDDPct must be numbers.";
    }

    if (metrics.beta !== null && !isFiniteNumber(metrics.beta)) {
        return "metrics.beta must be a number or null.";
    }

    if (metrics.trend != null && !TRENDS.includes(metrics.trend)) {
        return `metrics.trend must be one of: ${TRENDS.join(", ")}`;
    }

    return null;
}

router.post("/tutor", authMiddleware, requirePremiumTutorAccess, async (req, res) => {
    try {
        const {
            question,
            userLevel,
            stockContext
        } = req.body;

        if (typeof question !== "string" || !question.trim()) {
            return res.status(400).json({
                error: "Question is required"
            });
        }

        if (question.length > 1200) {
            return res.status(400).json({
                error: "Question must be 1200 characters or fewer"
            });
        }

        const prompt = buildTutorPrompt({
            question: question.trim(),
            userLevel: ["beginner", "intermediate", "advanced"].includes(userLevel)
                ? userLevel
                : "beginner",
            stockContext: stockContext && typeof stockContext === "object" && !Array.isArray(stockContext)
                ? stockContext
                : null
        });

        const rawAnswer = await askGemini(prompt);
        const answer = sanitizeExplanation(rawAnswer, {
            fallbackMessage: TUTOR_SAFETY_FALLBACK,
            source: "tutor"
        });

        res.json({
            answer
        });

    } catch (error) {
        console.error("AI Tutor error:", error);

        const status = Number(error.status || error.response?.status);
        const responseStatus = [401, 403, 429].includes(status) ? status : 500;

        res.status(responseStatus).json({
            error: responseStatus === 429
                ? "AI Tutor is temporarily rate limited"
                : "Failed to generate AI response"
        });
    }
});

router.post("/risk-explanation", async (req, res) => {
    try {
        const validationError = validateRiskExplanationRequest(req.body);

        if (validationError) {
            return res.status(400).json({
                error: validationError
            });
        }

        const { symbol, companyName, riskScore, riskLevel, metrics } = req.body;

        const prompt = buildRiskExplanationPrompt({ symbol, companyName, riskScore, riskLevel, metrics });
        const rawExplanation = await askGemini(prompt);
        const explanation = sanitizeExplanation(rawExplanation, { source: "risk-explanation" });

        res.json({
            explanation
        });

    } catch (error) {
        console.error("AI Risk Explanation error:", error);

        const status = Number(error.status || error.response?.status);
        const responseStatus = [401, 403, 429].includes(status) ? status : 500;

        res.status(responseStatus).json({
            error: responseStatus === 429
                ? "AI Risk Explanation is temporarily rate limited"
                : "Failed to generate AI response"
        });
    }
});

module.exports = router;
