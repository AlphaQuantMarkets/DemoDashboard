// Mirrors backend/utils/validators.js — keep both in sync if a rule changes.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VN_PHONE_PATTERN = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
const GENDERS = ["male", "female", "other", "prefer_not_to_say"];
const MIN_PASSWORD_LENGTH = 8;

function isValidEmail(value) {
    return typeof value === "string" && EMAIL_PATTERN.test(value.trim());
}

function isValidVnPhoneNumber(value) {
    return typeof value === "string" && VN_PHONE_PATTERN.test(value.trim());
}

function isValidGender(value) {
    return GENDERS.includes(value);
}

function isValidPassword(value) {
    return typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH;
}

function passwordsMatch(password, confirmPassword) {
    return password === confirmPassword;
}

window.AlphaQuantValidators = {
    GENDERS,
    MIN_PASSWORD_LENGTH,
    isValidEmail,
    isValidVnPhoneNumber,
    isValidGender,
    isValidPassword,
    passwordsMatch
};
