const status = document.getElementById("status");
const message = document.getElementById("message");
const send = document.getElementById("send");
const response = document.getElementById("response");

async function health() {
    try {
        const r = await fetch("http://127.0.0.1:8000/api/health");
        const data = await r.json();
        status.textContent = data.status === "healthy"
            ? "COSMIC ONLINE"
            : "COSMIC OFFLINE";
    } catch {
        status.textContent = "COSMIC OFFLINE";
    }
}

async function chat() {
    const text = message.value.trim();
    if (!text) return;

    response.textContent = "Processing...";

    try {
        const r = await fetch("http://127.0.0.1:8000/api/chat", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({message: text})
        });

        const data = await r.json();
        response.textContent = data.message || data.error;
    } catch (error) {
        response.textContent = "Connection failed.";
    }
}

send.addEventListener("click", chat);
message.addEventListener("keydown", e => {
    if (e.key === "Enter") chat();
});

health();
setInterval(health, 10000);
