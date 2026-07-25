const express = require("express");
const router = express.Router();

const { askGemini } = require("../services/geminiServices");
const { buildTutorPrompt } = require("../prompts/tutorPrompt");
const { requirePremiumTutorAccess } = require("../services/tutorAccess");

router.post("/tutor", requirePremiumTutorAccess, async (req, res) => {
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

        const answer = await askGemini(prompt);

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

module.exports = router;
