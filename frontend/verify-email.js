function showPanel(id) {
    ["verifyLoading", "verifySuccess", "verifyFailed"].forEach((panelId) => {
        document.getElementById(panelId).hidden = panelId !== id;
    });
}

function setFailedMessage(title, message) {
    document.getElementById("verifyFailedTitle").textContent = title;
    document.getElementById("verifyFailedMessage").textContent = message;
}

async function verifyToken(token) {

    if (!token) {
        setFailedMessage(
            "❌ Thiếu mã xác nhận",
            "Liên kết không hợp lệ. Vui lòng yêu cầu gửi lại email xác nhận bên dưới."
        );
        showPanel("verifyFailed");
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/auth/verify-email`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ token })
            }
        );

        const data = await response.json();

        if (data.status === "verified") {
            showPanel("verifySuccess");
            return;
        }

        if (data.status === "expired") {
            setFailedMessage(
                "⏰ Liên kết đã hết hạn",
                "Liên kết xác nhận này đã hết hạn. Vui lòng yêu cầu gửi lại email xác nhận bên dưới."
            );
        } else {
            setFailedMessage(
                "❌ Liên kết không hợp lệ",
                "Liên kết xác nhận không đúng hoặc đã được sử dụng. Vui lòng yêu cầu gửi lại email xác nhận bên dưới."
            );
        }

        showPanel("verifyFailed");

    } catch {
        setFailedMessage(
            "❌ Không thể kết nối",
            "Không thể kết nối tới máy chủ. Vui lòng thử lại sau."
        );
        showPanel("verifyFailed");
    }
}

document.addEventListener("DOMContentLoaded", () => {

    const token = new URLSearchParams(window.location.search).get("token");
    verifyToken(token);

    const resendForm = document.getElementById("resendForm");

    resendForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("resendEmail").value.trim();
        const messageEl = document.getElementById("resendMessage");
        const submitBtn = resendForm.querySelector("button");

        submitBtn.disabled = true;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/auth/resend-verification`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email })
                }
            );

            const data = await response.json();
            messageEl.textContent = data.message || data.error;
            messageEl.hidden = false;

        } catch {
            messageEl.textContent = "Không thể kết nối tới máy chủ.";
            messageEl.hidden = false;
        } finally {
            submitBtn.disabled = false;
        }
    });
});
