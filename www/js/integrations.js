(() => {
"use strict";

const API = window.COSMIC_API_BASE;
const $ = s => document.querySelector(s);
const state = {
  session: localStorage.getItem("cosmic_session_id") || newSession(),
  panel: "history"
};

function newSession() {
  const id = "chat-" + Date.now() + "-" +
    Math.random().toString(36).slice(2, 9);
  localStorage.setItem("cosmic_session_id", id);
  return id;
}

function escapeText(value) {
  return String(value ?? "");
}

async function request(path, options = {}) {
  const response = await fetch(API + path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.message || `HTTP ${response.status}`);
  }
  return data;
}

/* Attach the active conversation ID to existing chat requests. */
const originalFetch = window.fetch.bind(window);
window.fetch = function(resource, options) {
  const url = typeof resource === "string" ? resource :
    (resource && resource.url) || "";
  if (url.includes("/api/chat") && options && options.body) {
    try {
      const body = JSON.parse(options.body);
      body.session_id = state.session;
      options = {...options, body: JSON.stringify(body)};
    } catch (_) {}
  }
  return originalFetch(resource, options);
};

const style = document.createElement("style");
style.textContent = `
#cosmicIntegrationPanel {
 position:fixed; inset:5vh 3vw 5vh auto; width:min(440px,94vw);
 z-index:99999; display:none; flex-direction:column; overflow:hidden;
 background:#080e18; color:#dceaff; border:1px solid #24415a;
 border-radius:12px; box-shadow:0 18px 70px #000b;
 font:14px/1.45 system-ui,sans-serif;
}
#cosmicIntegrationPanel.open {display:flex}
#cosmicIntegrationPanel * {box-sizing:border-box}
#cosmicIntegrationPanel .ci-head {
 padding:15px; display:flex; justify-content:space-between; align-items:center;
 border-bottom:1px solid #23374b; letter-spacing:1.5px;font-weight:700;
}
#cosmicIntegrationPanel .ci-tabs {display:flex;gap:6px;padding:10px;border-bottom:1px solid #23374b}
#cosmicIntegrationPanel button {
 background:#101e2c;color:#cfe8ff;border:1px solid #29445c;
 border-radius:6px;padding:9px 11px;font:inherit;cursor:pointer;
}
#cosmicIntegrationPanel button:hover {border-color:#53d9ff}
#cosmicIntegrationPanel button.ci-active {background:#123346;border-color:#53d9ff}
#cosmicIntegrationPanel .ci-content {padding:12px;overflow:auto;flex:1}
#cosmicIntegrationPanel .ci-item {
 display:block;width:100%;text-align:left;margin:0 0 8px;
 padding:11px;background:#0c1724;border:1px solid #1f354a;
 border-radius:7px;overflow-wrap:anywhere;
}
#cosmicIntegrationPanel .ci-muted {color:#8da6bc;font-size:12px}
#cosmicIntegrationPanel .ci-error {color:#ff9b9b}
#cosmicIntegrationPanel .ci-actions {display:flex;gap:8px;flex-wrap:wrap;padding:10px;border-top:1px solid #23374b}
#cosmicQuickNav {display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}
#cosmicQuickNav button {font-size:11px;letter-spacing:.5px}
@media(max-width:600px) {
 #cosmicIntegrationPanel {inset:4vh 3vw 4vh;width:94vw}
}
`;
document.head.appendChild(style);

const panel = document.createElement("section");
panel.id = "cosmicIntegrationPanel";
panel.innerHTML = `
 <div class="ci-head"><span>COSMIC / CONTROL CENTER</span>
 <button id="ciClose" aria-label="Close">✕</button></div>
 <div class="ci-tabs">
  <button data-ci-tab="history">HISTORY</button>
  <button data-ci-tab="models">MODELS</button>
  <button data-ci-tab="memory">MEMORY</button>
 </div>
 <div class="ci-content" id="ciContent">Initializing…</div>
 <div class="ci-actions">
  <button id="ciNewChat">＋ NEW CHAT</button>
  <button id="ciRefresh">↻ REFRESH</button>
 </div>`;
document.body.appendChild(panel);

function showPanel(tab) {
  state.panel = tab;
  panel.classList.add("open");
  panel.querySelectorAll("[data-ci-tab]").forEach(b =>
    b.classList.toggle("ci-active", b.dataset.ciTab === tab));
  loadPanel();
}

function itemButton(title, detail, action) {
  const b = document.createElement("button");
  b.className = "ci-item";
  const strong = document.createElement("div");
  strong.textContent = title;
  const small = document.createElement("div");
  small.className = "ci-muted";
  small.textContent = detail || "";
  b.append(strong, small);
  if (action) b.addEventListener("click", action);
  return b;
}

function showError(error) {
  const content = $("#ciContent");
  content.replaceChildren();
  const message = document.createElement("p");
  message.className = "ci-error";
  message.textContent = error.message || String(error);
  content.appendChild(message);
}

async function loadPanel() {
  const content = $("#ciContent");
  content.replaceChildren();
  const loading = document.createElement("p");
  loading.textContent = "Loading…";
  content.appendChild(loading);

  try {
    if (state.panel === "history") {
      const data = await request("/api/chats");
      const chats = Array.isArray(data) ? data :
        (data.chats || data.items || data.conversations || []);
      content.replaceChildren();

      if (!chats.length) {
        const empty = document.createElement("p");
        empty.textContent = "No saved conversations found yet.";
        content.appendChild(empty);
      }

      chats.forEach(chat => {
        const id = chat.session_id || chat.id || chat.session;
        const title = chat.title || chat.first_message ||
          chat.message || "Untitled conversation";
        const count = chat.message_count ? `${chat.message_count} messages` : "";
        content.appendChild(itemButton(title, count, async () => {
          if (!id) return;
          state.session = String(id);
          localStorage.setItem("cosmic_session_id", state.session);
          try {
            const data = await request(
              "/api/history?session_id=" + encodeURIComponent(state.session)
            );
            const rows = Array.isArray(data) ? data :
              (data.history || data.messages || data.items || []);
            const stream = $("#responseStream");
            if (stream) {
              stream.replaceChildren();
              rows.forEach(row => {
                if (row.message) appendStream("user-message", row.message);
                if (row.response) appendStream("assistant-message", row.response);
              });
            }
            panel.classList.remove("open");
          } catch (e) { showError(e); }
        }));
      });
    } else if (state.panel === "models") {
      const data = await request("/api/ai/models");
      const models = Array.isArray(data) ? data :
        (data.models || data.items || []);
      content.replaceChildren();

      if (!models.length) {
        const empty = document.createElement("p");
        empty.textContent = "The API returned no model entries.";
        content.appendChild(empty);
      }

      models.forEach(m => {
        const provider = m.provider || "unknown";
        const id = m.id || m.model || m.name || "Unnamed model";
        content.appendChild(itemButton(
          m.label || id,
          `${provider.toUpperCase()} · ${m.configured ? "KEY CONFIGURED" : "NOT CONFIGURED"}`,
          () => {
            const ps = $("#providerSelector");
            const ms = $("#modelSelector");
            if (ps) {
              const option = [...ps.options].find(o => o.value === provider);
              if (option) ps.value = provider;
            }
            if (ms) {
              let option = [...ms.options].find(o => o.value === id);
              if (!option) {
                option = document.createElement("option");
                option.value = id;
                option.textContent = m.label || id;
                ms.appendChild(option);
              }
              ms.value = id;
            }
            $("#providerSelector")?.dispatchEvent(new Event("change"));
            $("#modelSelector")?.dispatchEvent(new Event("change"));
          }
        ));
      });
    } else {
      const data = await request("/api/memories");
      const memories = Array.isArray(data) ? data :
        (data.memories || data.items || data.results || []);
      content.replaceChildren();

      if (!memories.length) {
        const empty = document.createElement("p");
        empty.textContent = "No memory entries returned by the API.";
        content.appendChild(empty);
      }

      memories.forEach(m => {
        const text = m.content || m.memory || m.text ||
          m.message || JSON.stringify(m);
        content.appendChild(itemButton(
          text,
          m.created_at || m.category || m.type || "Saved memory"
        ));
      });
    }
  } catch (e) {
    showError(e);
  }
}

function appendStream(type, text) {
  const stream = $("#responseStream");
  if (!stream) return;
  $("#emptyCore")?.remove();
  const item = document.createElement("div");
  item.className = `stream-item ${type}`;
  const tag = document.createElement("span");
  tag.className = "stream-tag";
  tag.textContent = type === "user-message" ? "YOU" : "COSMIC";
  const body = document.createElement("span");
  body.className = "stream-text";
  body.textContent = String(text ?? "");
  item.append(tag, body);
  stream.appendChild(item);
}
window.COSMIC_APPEND_HISTORY_MESSAGE = appendStream;

/* Add working navigation controls without depending on the original layout. */
const quick = document.createElement("div");
quick.id = "cosmicQuickNav";
["history", "models", "memory"].forEach(tab => {
  const b = document.createElement("button");
  b.textContent = tab.toUpperCase();
  b.addEventListener("click", () => showPanel(tab));
  quick.appendChild(b);
});
const rail = $(".rail") || $(".left-rail") || $(".sidebar") ||
  $(".navigation-rail") || $(".rail-items");
if (rail) rail.appendChild(quick);
else document.body.appendChild(quick);

$("#ciClose").addEventListener("click", () => panel.classList.remove("open"));
panel.querySelectorAll("[data-ci-tab]").forEach(b =>
  b.addEventListener("click", () => showPanel(b.dataset.ciTab)));
$("#ciRefresh").addEventListener("click", loadPanel);
$("#ciNewChat").addEventListener("click", () => {
  state.session = newSession();
  const stream = $("#responseStream");
  if (stream) {
    stream.replaceChildren();
    appendStream("system-message", "NEW CONVERSATION READY");
  }
  panel.classList.remove("open");
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") panel.classList.remove("open");
});

console.log("COSMIC integrations loaded: History, Models, Memory.");
})();