console.log("auth.js đã được load");

const API_BASE_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? `${window.location.protocol}//${window.location.host}`
    : "https://alphaquant-api-cg7b.onrender.com";

const SIGNUP_ONLY_FIELD_IDS = ["authEmail", "authPhone", "authGender", "authConfirmPassword"];

let authMode = "login";
let pendingVerificationEmail = null;

function showAuthMessage(message, { isError = true } = {}) {
    const messageEl = document.getElementById("authErrorMessage");
    messageEl.textContent = message;
    messageEl.classList.remove("hidden");
    messageEl.classList.toggle("text-red", isError);
    messageEl.classList.toggle("text-green", !isError);
}

function hideAuthMessage() {
    const messageEl = document.getElementById("authErrorMessage");
    messageEl.textContent = "";
    messageEl.classList.add("hidden");
}

function setAuthLoading(isLoading) {
    const btn = document.getElementById("authSubmit");
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Đang xử lý..." : "Continue →";
}

function showCheckEmailPanel() {
    document.getElementById("authFormFields").style.display = "none";
    document.getElementById("authSubmit").style.display = "none";
    document.getElementById("authCheckEmailPanel").classList.remove("hidden");
    document.getElementById("authResendBtn").classList.remove("hidden");
}

function openModal(type) {

    authMode = type;
    pendingVerificationEmail = null;

    const modal = document.getElementById("authModal");
    const title = document.getElementById("authModalTitle");
    const desc = document.getElementById("authModalDesc");

    document.getElementById("authFormFields").style.display = "";
    document.getElementById("authSubmit").style.display = "";
    document.getElementById("authCheckEmailPanel").classList.add("hidden");
    document.getElementById("authResendBtn").classList.add("hidden");
    hideAuthMessage();

    ["authUsername", "authEmail", "authPhone", "authGender", "authPassword", "authConfirmPassword"]
        .forEach((id) => { document.getElementById(id).value = ""; });

    const signupOnlyDisplay = type === "signup" ? "" : "none";
    SIGNUP_ONLY_FIELD_IDS.forEach((id) => {
        document.getElementById(id).style.display = signupOnlyDisplay;
    });

    if (type === "login") {
        title.textContent = "LOGIN";
        desc.textContent = "Đăng nhập vào tài khoản AlphaQuant của bạn.";
    } else {
        title.textContent = "SIGN UP";
        desc.textContent = "Tạo tài khoản AlphaQuant miễn phí ngay hôm nay.";
    }

    modal.classList.add("open");
}

function closeModal() {
    document.getElementById("authModal").classList.remove("open");
}

function validateSignupInput({ username, email, phone, gender, password, confirmPassword }) {
    const v = window.AlphaQuantValidators;

    if (!username) {
        return "Username là bắt buộc.";
    }

    if (!v.isValidEmail(email)) {
        return "Vui lòng nhập email hợp lệ.";
    }

    if (!v.isValidVnPhoneNumber(phone)) {
        return "Vui lòng nhập số điện thoại hợp lệ (VD: 0912345678).";
    }

    if (!v.isValidGender(gender)) {
        return "Vui lòng chọn giới tính.";
    }

    if (!v.isValidPassword(password)) {
        return `Mật khẩu phải có ít nhất ${v.MIN_PASSWORD_LENGTH} ký tự.`;
    }

    if (!v.passwordsMatch(password, confirmPassword)) {
        return "Mật khẩu xác nhận không khớp.";
    }

    return null;
}

async function signUp({ username, email, phone, gender, password, confirmPassword }) {

    setAuthLoading(true);

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/auth/signup`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    email,
                    phoneNumber: phone,
                    gender,
                    password,
                    confirmPassword
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            showAuthMessage(data.error);
            return;
        }

        pendingVerificationEmail = data.email;
        showCheckEmailPanel();

    } catch {
        showAuthMessage("Không thể kết nối tới máy chủ.");
    } finally {
        setAuthLoading(false);
    }
}

async function handleAuth() {

    hideAuthMessage();

    const username = document.getElementById("authUsername").value.trim();
    const password = document.getElementById("authPassword").value;

    if (authMode === "signup") {

        const email = document.getElementById("authEmail").value.trim();
        const phone = document.getElementById("authPhone").value.trim();
        const gender = document.getElementById("authGender").value;
        const confirmPassword = document.getElementById("authConfirmPassword").value;

        const validationError = validateSignupInput({ username, email, phone, gender, password, confirmPassword });

        if (validationError) {
            showAuthMessage(validationError);
            return;
        }

        await signUp({ username, email, phone, gender, password, confirmPassword });

    } else {

        await login(username, password);

    }

}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("authSubmit");

    if (!btn) {
        console.error("Không tìm thấy nút authSubmit");
        return;
    }

    btn.addEventListener("click", handleAuth);

    document.getElementById("authResendBtn")?.addEventListener("click", resendVerificationEmail);
});

async function login(username, password) {

    setAuthLoading(true);

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    password
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            showAuthMessage(data.error);

            if (data.code === "EMAIL_NOT_VERIFIED") {
                pendingVerificationEmail = data.email;
                document.getElementById("authResendBtn").classList.remove("hidden");
            }

            return;
        }

        localStorage.setItem("authToken", data.token);

        closeModal();

        updateNavbar();

    } catch {
        showAuthMessage("Không thể kết nối tới máy chủ.");
    } finally {
        setAuthLoading(false);
    }
}

async function resendVerificationEmail() {

    if (!pendingVerificationEmail) {
        return;
    }

    const resendBtn = document.getElementById("authResendBtn");
    resendBtn.disabled = true;

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/auth/resend-verification`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email: pendingVerificationEmail })
            }
        );

        const data = await response.json();
        showAuthMessage(data.message || data.error, { isError: !response.ok });

    } catch {
        showAuthMessage("Không thể kết nối tới máy chủ.");
    } finally {
        resendBtn.disabled = false;
    }
}

function logout() {

    localStorage.removeItem("authToken");

    updateNavbar();

}

function decodeToken(token) {
    try {
        const payload = token.split(".")[1];
        return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
        return null;
    }
}

function getCurrentUser() {
    const token = localStorage.getItem("authToken");

    if (!token) {
        return null;
    }

    const payload = decodeToken(token);

    if (!payload || (payload.exp && Date.now() >= payload.exp * 1000)) {
        return null;
    }

    return {
        id: payload.id,
        username: payload.username
    };
}

function updateNavbar() {

    const user = getCurrentUser();

    const loginBtn = document.getElementById("loginBtn");
    const signupBtn = document.getElementById("signupBtn");
    const userInfo = document.getElementById("userInfo");
    const logoutBtn = document.getElementById("logoutBtn");

    if (user) {

        loginBtn.style.display = "none";
        signupBtn.style.display = "none";

        userInfo.textContent = `👤 ${user.username}`;
        userInfo.style.display = "inline-block";

        logoutBtn.style.display = "inline-block";

    } else {

        loginBtn.style.display = "inline-block";
        signupBtn.style.display = "inline-block";

        userInfo.style.display = "none";

        logoutBtn.style.display = "none";

    }

}
window.openModal = openModal;
window.closeModal = closeModal;
window.logout = logout;
window.getCurrentUser = getCurrentUser;

document.addEventListener("DOMContentLoaded", () => {

    updateNavbar();

});
