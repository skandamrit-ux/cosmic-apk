(() => {
"use strict";
if (document.getElementById("cosmic-evolution-toggle")) return;

const API = window.COSMIC_API_BASE + "/api/upgrades";
const style = document.createElement("style");
style.textContent = `
#cosmic-evolution-toggle{position:fixed;bottom:18px;left:18px;z-index:99990;background:#07131d;color:#68eaff;border:1px solid #31b9d5;padding:12px 17px;font:700 12px monospace;letter-spacing:2px;cursor:pointer;box-shadow:0 0 18px #00c8ff22}
#cosmic-evolution-panel{position:fixed;left:18px;bottom:68px;z-index:99989;width:min(680px,calc(100vw - 36px));max-height:80vh;overflow:auto;background:#071019;color:#d8edf4;border:1px solid #247d94;padding:18px;box-sizing:border-box;font:13px monospace;box-shadow:0 0 35px #000b}
#cosmic-evolution-panel[hidden]{display:none}
#cosmic-evolution-panel h3{color:#68eaff;letter-spacing:2px;margin:0 0 12px}
#cosmic-evolution-panel label{display:block;margin:12px 0 5px;color:#8bb7c5}
#cosmic-evolution-panel input,#cosmic-evolution-panel textarea{box-sizing:border-box;width:100%;background:#030a10;color:#d8edf4;border:1px solid #245263;padding:10px;font:12px monospace}
#cosmic-evolution-panel textarea{min-height:125px;resize:vertical}
#cosmic-evolution-panel button{background:#0b2633;color:#8beaff;border:1px solid #26778d;padding:9px 11px;margin:8px 5px 4px 0;font:700 11px monospace;cursor:pointer}
#cosmic-evolution-panel button:disabled{opacity:.4}
#cosmic-evolution-panel .ev-status{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px;background:#030a10;border-left:2px solid #28b7d2;margin:10px 0}
#cosmic-evolution-panel .ev-record{border-top:1px solid #183a46;padding:9px 0;overflow-wrap:anywhere}
#cosmic-evolution-panel .ev-small{font-size:11px;color:#8bb7c5}
#cosmic-evolution-panel .ev-approval{display:flex;gap:8px;align-items:center}
#cosmic-evolution-panel .ev-approval input{width:auto}
`;
document.head.appendChild(style);

const toggle = document.createElement("button");
toggle.id = "cosmic-evolution-toggle";
toggle.textContent = "✦ EVOLUTION";
toggle.setAttribute("aria-expanded", "false");

const panel = document.createElement("section");
panel.id = "cosmic-evolution-panel";
panel.hidden = true;
panel.innerHTML = `
<h3>COSMIC / EVOLUTION ENGINE</h3>
<div class="ev-small">SAFE-STAGED MODE · Changes require explicit approval</div>
<div id="ev-status" class="ev-status">Connecting to upgrade engine…</div>
<button id="ev-inspect">INSPECT PROJECT</button>
<button id="ev-refresh">REFRESH HISTORY</button>
<hr style="border-color:#183a46">
<label for="ev-path">Project-relative file path</label>
<input id="ev-path" placeholder="frontend/js/app.js" autocomplete="off">
<label for="ev-content">Proposed complete file content</label>
<textarea id="ev-content" spellcheck="false" placeholder="Paste the proposed file content here. Python files are syntax-checked before saving."></textarea>
<button id="ev-preview">1 · VALIDATE CHANGE</button>
<div id="ev-preview-result" class="ev-status">No change prepared.</div>
<label class="ev-approval"><input id="ev-approve" type="checkbox"> I reviewed the change and approve applying it.</label>
<button id="ev-apply" disabled>2 · APPLY APPROVED CHANGE</button>
<hr style="border-color:#183a46">
<h3>UPGRADE HISTORY / ROLLBACK</h3>
<div id="ev-history" class="ev-status">History not loaded.</div>
`;

document.body.append(toggle, panel);

const $ = id => document.getElementById(id);
const status = (text) => { $("ev-status").textContent = text; };
let prepared = false;

async function api(path, options = {}) {
    const response = await fetch(API + path, {
        ...options,
        headers: {"Content-Type":"application/json", ...(options.headers || {})}
    });
    const data = await response.json();
    if (!response.ok || data.success === false) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
}

function jsonBody(value) {
    return {method:"POST", body:JSON.stringify(value)};
}

function invalidatePreview() {
    prepared = false;
    $("ev-apply").disabled = true;
    $("ev-approve").checked = false;
}
$("ev-path").addEventListener("input", invalidatePreview);
$("ev-content").addEventListener("input", invalidatePreview);
$("ev-approve").addEventListener("change", () => {
    $("ev-apply").disabled = !(prepared && $("ev-approve").checked);
});

toggle.addEventListener("click", async () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) {
        await loadStatus();
        await loadHistory();
    }
});

async function loadStatus() {
    try {
        const data = await api("/status");
        status(`${data.engine} v${data.version}\nMode: ${data.mode}\nAutomatic execution: ${data.automatic_execution ? "ON" : "OFF"}\nFeatures: ${(data.features || []).join(", ")}`);
    } catch (e) {
        status("API ERROR: " + e.message + "\nKeep COSMIC's backend running on port 8001.");
    }
}

$("ev-inspect").addEventListener("click", async () => {
    try {
        const data = await api("/project");
        status(`Project inspection complete.\nFiles inspected: ${data.file_count}\nProtected items skipped: ${data.protected_items_skipped}\n\n` + data.files.slice(0, 35).map(f => `${f.path} (${f.bytes} bytes)`).join("\n") + (data.file_count > 35 ? "\n…more files omitted" : ""));
    } catch (e) { status("Inspection failed: " + e.message); }
});

$("ev-preview").addEventListener("click", async () => {
    invalidatePreview();
    $("ev-preview-result").textContent = "Validating…";
    try {
        const data = await api("/preview", jsonBody({
            path: $("ev-path").value.trim(),
            content: $("ev-content").value
        }));
        prepared = true;
        $("ev-preview-result").textContent = `VALIDATION PASSED\nFile: ${data.path}\nExists: ${data.exists}\nNew size: ${data.new_bytes} bytes\n${data.validation}\n\nReview the complete content above before approving.`;
        $("ev-apply").disabled = !$("ev-approve").checked;
    } catch (e) {
        $("ev-preview-result").textContent = "VALIDATION FAILED\n" + e.message;
    }
});

$("ev-apply").addEventListener("click", async () => {
    if (!prepared || !$("ev-approve").checked) return;
    if (!confirm("Apply this complete file replacement? A backup will be created when the file already exists.")) return;
    $("ev-apply").disabled = true;
    try {
        const data = await api("/apply", jsonBody({
            path: $("ev-path").value.trim(),
            content: $("ev-content").value,
            approved: true
        }));
        prepared = false;
        $("ev-preview-result").textContent = "CHANGE APPLIED\n" + JSON.stringify(data, null, 2);
        await loadHistory();
    } catch (e) {
        $("ev-preview-result").textContent = "APPLY FAILED\n" + e.message;
    } finally {
        $("ev-apply").disabled = true;
    }
});

async function loadHistory() {
    try {
        const data = await api("/history");
        const box = $("ev-history");
        box.replaceChildren();
        if (!data.items.length) {
            box.textContent = "No upgrades applied yet.";
            return;
        }
        data.items.forEach(item => {
            const record = document.createElement("div");
            record.className = "ev-record";
            const details = document.createElement("div");
            details.textContent = `${item.path} · ${item.status} · ${item.timestamp}`;
            record.appendChild(details);
            const meta = document.createElement("div");
            meta.className = "ev-small";
            meta.textContent = `ID: ${item.id}`;
            record.appendChild(meta);
            if (item.status === "applied") {
                const button = document.createElement("button");
                button.textContent = "ROLL BACK";
                button.addEventListener("click", async () => {
                    if (!confirm(`Roll back ${item.path}?`)) return;
                    try {
                        const result = await api("/rollback", jsonBody({id:item.id, approved:true}));
                        alert("Rollback completed: " + result.rolled_back);
                        await loadHistory();
                    } catch (e) { alert("Rollback failed: " + e.message); }
                });
                record.appendChild(button);
            }
            box.appendChild(record);
        });
    } catch (e) {
        $("ev-history").textContent = "History error: " + e.message;
    }
}

$("ev-refresh").addEventListener("click", loadHistory);
loadStatus();
})();