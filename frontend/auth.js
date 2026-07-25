console.log("auth.js đã được load");

const API_BASE_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? `${window.location.protocol}//${window.location.host}`
    : "https://alphaquant-api-cg7b.onrender.com";

let authMode = "login";

function openModal(type) {

    authMode = type;

    const modal = document.getElementById("authModal");
    const title = document.getElementById("authModalTitle");
    const desc = document.getElementById("authModalDesc");

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

async function signUp(username, password) {

    const response = await fetch(
        `${API_BASE_URL}/api/auth/signup`,
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
        alert(data.error);
        return;
    }

    localStorage.setItem("authToken", data.token);

    alert("Đăng ký thành công!");

    closeModal();

    updateNavbar();
}





async function handleAuth() {

    const username =
    document.getElementById("authUsername").value;

    const password =
    document.getElementById("authPassword").value;

    if (authMode === "signup") {

        await signUp(username, password);

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
});


async function login(username, password) {

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
        alert(data.error);
        return;
    }

    localStorage.setItem("authToken", data.token);

    alert("Đăng nhập thành công!");

    closeModal();

    updateNavbar();
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