-- Adds the premium-entitlement flag checked by requirePremiumTutorAccess
-- (backend/services/tutorAccess.js) to gate POST /api/ai/tutor.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- Local development: grant a specific test user premium access so the
-- AI Tutor can be exercised without a real subscription/billing flow.
-- UPDATE users SET is_premium = true WHERE username = 'your-test-username';
