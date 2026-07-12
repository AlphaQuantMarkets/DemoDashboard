console.log("auth.js đã được load");

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
        "https://alphaquant-api-cg7b.onrender.com/api/auth/signup",
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

    localStorage.setItem(
        "user",
        JSON.stringify({
            id: data.id,
            username: data.username
        })
    );

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
        "https://alphaquant-api-cg7b.onrender.com/api/auth/login",
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

    localStorage.setItem(
        "user",
        JSON.stringify(data.user)
    );

    alert("Đăng nhập thành công!");

    closeModal();

    updateNavbar();
}
function logout() {

    localStorage.removeItem("user");

    updateNavbar();

}
function updateNavbar() {

    const user = JSON.parse(localStorage.getItem("user"));

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

document.addEventListener("DOMContentLoaded", () => {

    updateNavbar();

});