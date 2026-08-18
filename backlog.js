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

/* 엔드포인트 후보. 앞에서부터 시도하고 처음 성공한 것을 이후 계속 쓴다.
 *  - 127.0.0.1  Mac mini 본체에서 볼 때. 절대 기기 밖으로 안 나간다.
 *  - ts.net     다른 tailnet 기기에서 볼 때. 단 브라우저가 MagicDNS 로 해석해야 한다
 *               (공개 DNS 로 해석하면 Funnel 인그레스로 가서 tailscaled 가 503 을 낸다).
 */
const BACKLOG_ENDPOINTS = [
    // 같은 origin. 대시보드를 Mac mini 가 직접 서빙할 때(/backlog/ui/) 쓰인다.
    // Chrome 151 의 Local Network Access 는 '공개 origin → 사설 IP' 만 막으므로
    // 같은 origin 이면 애초에 차단 대상이 아니다. 이게 유일하게 항상 통하는 경로다.
    "/backlog",
    // 아래 둘은 github.io 에서 열었을 때의 시도. Chrome 151+ 는
    // ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS 로 막는다(사이트 권한 허용 시에만 통과).
    "http://127.0.0.1:8787/backlog",
    "https://bot-macmini.tail7c5820.ts.net:8443/backlog",
];
let BACKLOG_API = BACKLOG_ENDPOINTS[0];

/* Mac mini 가 대시보드를 직접 서빙하는 주소. 백로그가 확실히 조회되는 유일한 경로다. */
const BACKLOG_UI_URL = "https://bot-macmini.tail7c5820.ts.net:8443/backlog/ui/";
/* 여기서 열었으면 사설망 요청이 애초에 차단 대상이 아니다(같은 기기 / 같은 origin). */
const BACKLOG_OK_HOSTS = ["bot-macmini.tail7c5820.ts.net", "localhost", "127.0.0.1", "[::1]", ""];
const BACKLOG_TOKEN_KEY = "backlogToken";
const BACKLOG_TIMEOUT = 8000;   // ms — 응답이 없으면 매달리지 않고 끊는다
const BACKLOG_BUILD = "2026-08-18g";   // 화면에 찍어서 캐시된 구버전을 식별한다

const backlogSection = document.querySelector("#backlogSection");
const backlogOriginEl = document.querySelector("#backlogOrigin");
const backlogNoticeEl = document.querySelector("#backlogNotice");
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

/* 오류·안내는 일반 콘텐츠와 섞이면 눈에 안 들어온다. 색 있는 배지로 따로 띄운다.
 *   warn  = 사람이 조치하면 되는 것(주소·비밀번호)
 *   error = 지금 조회가 실패한 것(서버 무응답·차단·HTTP 오류)
 * sub 는 배지 안 둘째 줄(원인/빌드 등 부연). */
function setBacklogNotice(kind, html, sub) {
    if (!backlogNoticeEl) return;
    if (!kind) {
        backlogNoticeEl.className = "backlog-notice hidden";
        backlogNoticeEl.innerHTML = "";
        return;
    }
    backlogNoticeEl.className = `backlog-notice ${kind}`;
    backlogNoticeEl.innerHTML =
        `<span>${html}${sub ? `<span class="notice-sub">${sub}</span>` : ""}</span>`;
}

/* 공개 주소(github.io 등)에서 열면 Chrome 이 사설망 요청을 막아 조회가 실패한다.
 * 실패한 뒤에 알리면 늦으므로, 주소만 보고 페이지 로드 시점에 바로 안내한다. */
function backlogOriginOk() {
    return BACKLOG_OK_HOSTS.includes(location.hostname);
}

function renderBacklogOriginNotice() {
    if (!backlogOriginEl || backlogOriginOk()) return;
    backlogOriginEl.innerHTML =
        "<span>이 주소에서는 백로그가 조회되지 않습니다." +
        `<span class="notice-sub"><a href="${BACKLOG_UI_URL}">${BACKLOG_UI_URL}</a>` +
        " 로 접속해야 하며, 그 기기에서 Tailscale 이 연결돼 있어야 합니다.</span></span>";
    backlogOriginEl.classList.remove("hidden");
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

async function backlogFetch(path, withAuth = true) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), BACKLOG_TIMEOUT);
    let res;
    try {
        res = await fetch(`${BACKLOG_API}/${path}`, {
            cache: "no-store",
            signal: ctl.signal,
            headers: withAuth ? { Authorization: `Bearer ${backlogToken}` } : {},
        });
    } catch (err) {
        // fetch 가 던지는 경우 = DNS 실패 / 연결 거부 / TLS 실패 / CORS 차단 / 타임아웃.
        // 브라우저는 보안상 이들을 구분해주지 않는다.
        const e = new Error(err.name === "AbortError" ? "TIMEOUT" : "UNREACHABLE");
        throw e;
    } finally {
        clearTimeout(timer);
    }
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
    setBacklogNotice(null);   // 조회 성공 = 직전 오류 배지 제거
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

function backlogError(e, opts = {}) {
    const silent = opts.silent === true;   // 페이지 로드 시 자동조회 = 조용히 처리
    if (e.message === "UNAUTHORIZED") {
        // 저장돼 있던 토큰이 더 이상 안 맞는 경우. 새로고침마다 '오류' 를 띄우지 않는다.
        backlogToken = null;
        localStorage.removeItem(BACKLOG_TOKEN_KEY);
        setBacklogState("locked");
        backlogSummaryEl.textContent = "비밀번호를 입력하면 백로그를 조회합니다.";
        setBacklogNotice(silent ? null : "warn", "비밀번호가 맞지 않습니다.");
        backlogMetaEl.textContent = "";
        return;
    }
    if (e.message === "TIMEOUT") {
        setBacklogState("offline");
        backlogSummaryEl.textContent = "";
        setBacklogNotice("error", "서버가 응답하지 않습니다.",
            `${BACKLOG_TIMEOUT / 1000}초 내 무응답 · build ${BACKLOG_BUILD}`);
        backlogMetaEl.textContent = "";
        return;
    }
    if (e.message === "LOCKED") {
        // 연속 실패로 서버가 잠근 상태. 비밀번호가 맞아도 안 열린다.
        const min = Math.ceil((e.retryAfter || 0) / 60);
        setBacklogState("locked");
        backlogSummaryEl.textContent = "";
        setBacklogNotice("error", `연속 실패로 잠겼습니다. ${min}분 후 다시 시도하세요.`,
            "Mac mini 에서 비밀번호 파일을 저장하면 즉시 풀립니다.");
        backlogMetaEl.textContent = "";
        return;
    }
    setBacklogState("offline");
    backlogSummaryEl.textContent = "";
    backlogMetaEl.textContent = "";
    if (e.message.startsWith("HTTP")) {
        // 서버에는 닿았고 응답만 이상한 경우 — 원인이 전혀 다르므로 문구를 나눈다.
        setBacklogNotice("error", `서버가 ${e.message} 를 반환했습니다.`, `build ${BACKLOG_BUILD}`);
        return;
    }
    // UNREACHABLE — DNS/연결/TLS/CORS 중 하나. 브라우저가 구분해주지 않는다.
    setBacklogNotice("error", "백로그 서버에 닿지 않습니다.",
        "공개 주소에서는 Chrome 이 사설망 요청을 차단합니다. " +
        `<a href="${BACKLOG_UI_URL}">Mac mini 주소로 열기</a>` +
        ` — Tailscale 연결 상태여야 합니다. · build ${BACKLOG_BUILD}`);
}

/* 인증 없이 서버 생존만 확인하면서, 닿는 엔드포인트를 고른다.
 * '못 닿음' 과 '비밀번호 문제' 를 갈라주는 역할도 겸한다. */
async function backlogReachable() {
    const tried = [];
    for (const base of [BACKLOG_API, ...BACKLOG_ENDPOINTS]) {
        if (tried.includes(base)) continue;
        tried.push(base);
        BACKLOG_API = base;
        try {
            await backlogFetch("health", false);
            return true;
        } catch (e) {
            lastBacklogError = e;
        }
    }
    backlogError(lastBacklogError || new Error("UNREACHABLE"), { silent: true });
    return false;
}

let lastBacklogError = null;

async function loadBacklogSummary(opts = {}) {
    const silent = opts.silent === true;
    if (!backlogToken) {
        setBacklogState("locked");
        backlogSummaryEl.textContent = "비밀번호를 입력하면 백로그를 조회합니다.";
        backlogMetaEl.textContent = "";
        return;
    }
    backlogSummaryEl.textContent = "조회 중…";
    setBacklogNotice(null);
    // 서버부터 확인 — 안 닿으면 토큰을 지우지 않는다(꺼져 있을 뿐인데 비번을 날리면 안 됨).
    if (!(await backlogReachable())) return;
    try {
        renderBacklogSummary(await backlogFetch("summary"));
        setBacklogState("ready");
    } catch (e) {
        backlogError(e, { silent });
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
    await loadBacklogSummary({ silent: false });
}

function lockBacklog() {
    backlogToken = null;
    localStorage.removeItem(BACKLOG_TOKEN_KEY);
    setBacklogState("locked");
    backlogSummaryEl.textContent = "잠금. 비밀번호를 입력하면 다시 조회합니다.";
    setBacklogNotice(null);
    backlogMetaEl.textContent = "";
}

if (backlogSection) {
    renderBacklogOriginNotice();
    backlogUnlockForm.addEventListener("submit", unlockBacklog);
    backlogRefreshBtn.addEventListener("click", () => {
        backlogDetailEl.innerHTML = "";
        loadBacklogSummary({ silent: false });   // 사람이 누른 것이므로 오류를 그대로 보여준다
    });
    backlogLockBtn.addEventListener("click", lockBacklog);
    backlogDetailBtn.addEventListener("click", showBacklogDetail);
    loadBacklogSummary({ silent: true });   // 새로고침 시 비밀번호 오류를 띄우지 않는다
}
