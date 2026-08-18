/*
 * Backlog widget — 라이브 조회 방식
 *
 * 데이터는 저장소에 없다. Mac mini 의 백로그 API 를 매번 조회한다.
 *   https://bot-macmini.tail7c5820.ts.net:8443/backlog/{summary,detail}
 *
 * 이 엔드포인트는 tailnet 전용이다. Tailscale 이 연결된 기기에서만 닿는다.
 * 그리고 토큰(=비밀번호)이 있어야 응답한다 — CORS 는 인증이 아니기 때문.
 *
 * 조회 시점:
 *   - 저장된 토큰이 있으면 페이지 로드 시 summary 1회.
 *   - detail 은 '자세히' 를 누른 시점에 1회.
 *   - ↻ 로 언제든 다시 조회. 응답은 항상 그 순간의 backlog.md 상태다.
 */

const BACKLOG_API = "https://bot-macmini.tail7c5820.ts.net:8443/backlog";
const BACKLOG_TOKEN_KEY = "backlogToken";

const backlogSection = document.querySelector("#backlogSection");
const backlogSummaryEl = document.querySelector("#backlogSummary");
const backlogProjectsEl = document.querySelector("#backlogProjects");
const backlogDetailEl = document.querySelector("#backlogDetail");
const backlogMetaEl = document.querySelector("#backlogMeta");
const backlogUnlockForm = document.querySelector("#BacklogUnlockForm");
const backlogPasswordInput = document.querySelector("#backlogPasswordInput");
const backlogRememberInput = document.querySelector("#backlogRememberInput");
const backlogUnlockBtn = document.querySelector("#backlogUnlockBtn");
const backlogRefreshBtn = document.querySelector("#backlogRefreshBtn");
const backlogLockBtn = document.querySelector("#backlogLockBtn");
const backlogDetailBtn = document.querySelector("#backlogDetailBtn");

let backlogToken = localStorage.getItem(BACKLOG_TOKEN_KEY) || null;

function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

function backlogStaleClass(days) {
    if (days === null || days === undefined) return "";
    if (days >= 21) return "stale-high";
    if (days >= 14) return "stale-mid";
    return "stale-low";
}

function backlogDaysLabel(days, floor) {
    if (days === null || days === undefined) return "–";
    return floor ? `${days}일+` : `${days}일`;
}

/* 프로젝트의 '마지막 활동' — 저장소 커밋이 있으면 그걸, 없으면 백로그 최종 수정을 쓴다. */
function backlogLastActivity(p) {
    if (p.last_commit_days !== null && p.last_commit_days !== undefined) {
        return { days: p.last_commit_days, src: "커밋" };
    }
    if (p.stalest_days !== null && p.stalest_days !== undefined) {
        return { days: p.stalest_days, src: "백로그" };
    }
    return { days: null, src: null };
}

async function backlogFetch(path) {
    const res = await fetch(`${BACKLOG_API}/${path}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${backlogToken}` },
    });
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (res.status === 429) {
        let wait = 0;
        try { wait = (await res.json()).retry_after || 0; } catch (_) {}
        const e = new Error("LOCKED");
        e.retryAfter = wait;
        throw e;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function setBacklogState(mode) {
    // mode: "locked" | "ready" | "offline"
    backlogUnlockForm.classList.toggle("hidden", mode !== "locked");
    backlogLockBtn.classList.toggle("hidden", mode !== "ready");
    backlogDetailBtn.classList.toggle("hidden", mode !== "ready");
    if (mode !== "ready") {
        backlogProjectsEl.innerHTML = "";
        backlogDetailEl.innerHTML = "";
    }
}

function renderBacklogSummary(data) {
    const t = data.totals;
    backlogSummaryEl.innerHTML = `
        <span class="backlog-chip red">🔴 ${t.red}</span>
        <span class="backlog-chip yellow">🟡 ${t.yellow}</span>
        <span class="backlog-chip green">🟢 ${t.green}</span>
        <span class="backlog-chip total">${t.open}건 · ${data.projects.length}개 프로젝트</span>`;

    backlogProjectsEl.innerHTML = "";
    for (const p of data.projects) {
        const act = backlogLastActivity(p);
        const li = document.createElement("li");
        li.className = "backlog-project";
        const bar = [
            p.red ? `<i class="seg red" style="flex:${p.red}"></i>` : "",
            p.yellow ? `<i class="seg yellow" style="flex:${p.yellow}"></i>` : "",
            p.green ? `<i class="seg green" style="flex:${p.green}"></i>` : "",
        ].join("");
        const actLabel = act.days === null
            ? "활동기록 없음"
            : `${act.src} ${act.days}일 전`;
        li.innerHTML = `
            <div class="backlog-project-head">
                <span class="backlog-project-name">${esc(p.name)}</span>
                <span class="backlog-project-count">${p.open}</span>
            </div>
            <div class="backlog-bar">${bar}</div>
            <div class="backlog-project-meta">
                <span class="${backlogStaleClass(act.days)}">${esc(actLabel)}</span>
                <span>최고령 ${backlogDaysLabel(p.oldest_days, p.oldest_is_floor)}</span>
                ${p.dirty ? `<span class="dirty">미커밋 ${p.dirty}</span>` : ""}
            </div>`;
        backlogProjectsEl.appendChild(li);
    }

    const floorNote = data.age_floor_date ? ` · 나이 측정 시작 ${data.age_floor_date}` : "";
    backlogMetaEl.textContent =
        `조회 ${new Date().toTimeString().slice(0, 5)} · 백로그 ${data.backlog_mtime}${floorNote}`;
}

function renderBacklogDetail(detail) {
    backlogDetailEl.innerHTML = "";
    const list = document.createElement("ul");
    list.className = "backlog-items";
    for (const it of detail.items) {
        const li = document.createElement("li");
        li.className = `backlog-item${it.auto ? " auto" : ""}`;
        li.innerHTML = `
            <span class="backlog-item-prio">${esc(it.prio)}</span>
            <span class="backlog-item-body">
                <span class="backlog-item-title">${esc(it.title)}</span>
                <span class="backlog-item-meta">
                    <b class="${backlogStaleClass(it.stale_days)}">${it.stale_days ?? "–"}일 방치</b>
                    · 최초 ${it.first_seen ? backlogDaysLabel(it.age_days, it.age_floor) + " 전" : "미상"}
                    · ${esc(it.project)}
                </span>
            </span>`;
        list.appendChild(li);
    }
    const autoCount = detail.items.filter((i) => i.auto).length;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "backlog-auto-toggle";
    toggle.textContent = `자동생성 로그 항목 ${autoCount}건 보기`;
    let shown = false;
    toggle.addEventListener("click", () => {
        shown = !shown;
        list.classList.toggle("show-auto", shown);
        toggle.textContent = `자동생성 로그 항목 ${autoCount}건 ${shown ? "숨기기" : "보기"}`;
    });
    backlogDetailEl.appendChild(toggle);
    backlogDetailEl.appendChild(list);
}

function backlogError(e) {
    if (e.message === "UNAUTHORIZED") {
        backlogToken = null;
        localStorage.removeItem(BACKLOG_TOKEN_KEY);
        setBacklogState("locked");
        backlogSummaryEl.textContent = "비밀번호가 맞지 않습니다.";
        backlogMetaEl.textContent = "";
        return;
    }
    if (e.message === "LOCKED") {
        // 연속 실패로 서버가 잠근 상태. 비밀번호가 맞아도 안 열린다.
        const min = Math.ceil((e.retryAfter || 0) / 60);
        setBacklogState("locked");
        backlogSummaryEl.textContent = `연속 실패로 잠겼습니다. ${min}분 후 다시 시도하세요.`;
        backlogMetaEl.textContent =
            "Mac mini 에서 비밀번호 파일을 저장하면 즉시 풀립니다.";
        return;
    }
    // fetch 자체가 실패 = Mac mini 꺼짐 또는 Tailscale 미연결
    setBacklogState("offline");
    backlogSummaryEl.textContent = "백로그 서버에 닿지 않습니다.";
    backlogMetaEl.textContent = e.message.startsWith("HTTP")
        ? `응답 ${e.message}`
        : "Mac mini 가 꺼져 있거나 이 기기에 Tailscale 이 연결돼 있지 않습니다.";
}

async function loadBacklogSummary() {
    if (!backlogToken) {
        setBacklogState("locked");
        backlogSummaryEl.textContent = "비밀번호를 입력하면 백로그를 조회합니다.";
        backlogMetaEl.textContent = "";
        return;
    }
    backlogSummaryEl.textContent = "조회 중…";
    try {
        renderBacklogSummary(await backlogFetch("summary"));
        setBacklogState("ready");
    } catch (e) {
        backlogError(e);
    }
}

async function showBacklogDetail() {
    backlogDetailBtn.disabled = true;
    try {
        renderBacklogDetail(await backlogFetch("detail"));
    } catch (e) {
        backlogError(e);
    } finally {
        backlogDetailBtn.disabled = false;
    }
}

async function unlockBacklog(event) {
    event.preventDefault();
    const pw = backlogPasswordInput.value.trim();
    if (!pw) return;
    backlogToken = pw;
    if (backlogRememberInput.checked) localStorage.setItem(BACKLOG_TOKEN_KEY, pw);
    backlogPasswordInput.value = "";
    await loadBacklogSummary();
}

function lockBacklog() {
    backlogToken = null;
    localStorage.removeItem(BACKLOG_TOKEN_KEY);
    setBacklogState("locked");
    backlogSummaryEl.textContent = "잠금. 비밀번호를 입력하면 다시 조회합니다.";
    backlogMetaEl.textContent = "";
}

if (backlogSection) {
    backlogUnlockForm.addEventListener("submit", unlockBacklog);
    backlogRefreshBtn.addEventListener("click", () => { backlogDetailEl.innerHTML = ""; loadBacklogSummary(); });
    backlogLockBtn.addEventListener("click", lockBacklog);
    backlogDetailBtn.addEventListener("click", showBacklogDetail);
    loadBacklogSummary();
}
