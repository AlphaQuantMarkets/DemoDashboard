function isDevelopmentTutorMode() {
    return process.env.AI_TUTOR_PREMIUM_MODE !== "required";
}

function requirePremiumTutorAccess(req, res, next) {
    if (isDevelopmentTutorMode()) {
        req.tutorAccess = { mode: "development" };
        return next();
    }

    return res.status(403).json({
        error: "AI Investment Tutor requires a Premium subscription",
        code: "PREMIUM_REQUIRED"
    });
}

module.exports = {
    requirePremiumTutorAccess
};
