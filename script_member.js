/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 🙋‍♂️ Member (script_member.js) — 2026-10-01 콩
   ---------------------------------------------------------------------
   🧘 혼자 방(?solo=1)에서 **본방에 지금 누가 있는지** 보는 알약.
   온라인인 사람만, 닉 · 상태 · 오늘 작업 시간. 본방 카드밭의 축소판.

   [혼자 방 원칙과의 관계]
   혼자 방은 파이어베이스를 통째로 가짜(localStorage)로 갈아끼워서
   "서버로 한 글자도 안 나간다"를 지킵니다. 이 판은 그 원칙 중 **"안
   보낸다"는 그대로**, **"안 받는다"만 하나 깹니다** — 본방 접속자
   목록(status)을 읽어 와야 하니까요. status 는 보안규칙에서 누구나
   읽을 수 있어서 로그인 없이도 됩니다.

   [2026-10-02 콩] 📊 본방 오늘 접속 현황은 이 판이 아니라 **배경판**에 —
   script_realtime.js 의 본방현황읽기() 가 같은 REST 수법으로 본방 값을
   가져와 바탕화면 막대에 그립니다 (콩: "본방과 동일하게").

   [어떻게 읽나 — REST]
   firebase.database() 가 가짜라 SDK 로는 진짜 서버에 못 닿습니다. 그래서
   주소 하나를 fetch 로 그냥 읽어요: {databaseURL}/status.json
   판이 열려 있으면 30초마다, **닫혀 있으면 1분마다**. 12명이면 몇 KB.

   [2026-10-06 콩] 알약에 인원수 — [🙋‍♂️Member - n명 접속 중]
   판을 안 열어도 몇 명인지 보이게 해 달라는 요청. 그래서 닫혀 있을 때도
   읽습니다 — 다만 느리게(1분), 프사는 안 읽고, 탭이 가려져 있으면 쉽니다.
   못 읽었거나 아직 안 읽었으면 숫자 없이 그냥 [🙋‍♂️Member] 예요 (0 을 안 보여줍니다).

   [본방에는 안 뜹니다] 맨 위에서 window.SOLO 가 아니면 바로 돌아갑니다 —
   본방은 카드밭이 있으니까요.

   [2026-10-07 콩] 알약 → **오른쪽 옆 탭**
   아래 줄의 알약이던 것을 화면 오른쪽 끝의 세로 탭으로 옮겼습니다.
     · 탭은 카드 마당이 시작되는 높이에 **딱 붙습니다** (가운데가 아니라 위).
       열리는 명단의 윗변과 탭의 윗변이 같은 높이예요.
     · 누르면 명단(250px)이 열리고, 카드 마당이 그만큼 좁아져 카드가 **다시 줄을 맞춥니다.**
     · 색은 아래 알약들과 같은 결 — 닫힘은 옅은 바탕, 열림은 강조색.
     · 좁은 화면은 신경 쓰지 않습니다 (혼자 방에서만 보는 것이라 — 콩).
     · 열어 둔 채 새로고침하면 열린 채로 다시 뜹니다 (이 기기에 기억).
   ===================================================================== */
(function () {
  if (!window.SOLO) return;   // 본방에서는 아무것도 안 합니다

  /* script_core.js 의 firebaseConfig 와 같은 주소 (m.html 도 이 값) */
  const DB_URL = "https://themagam-ec0e4-default-rtdb.asia-southeast1.firebasedatabase.app";
  const TICK_MS = 30 * 1000;
  const PILL_TICK_MS = 60 * 1000;   // 판이 닫혀 있을 때 — 알약 숫자만 고치면 되니 느리게

  const el = (id) => document.getElementById(id);
  function esc(s) { return window.escapeHtml ? window.escapeHtml(s) : String(s == null ? "" : s); }

  /* 상태 이름 — script_realtime.js 의 statusLabel 과 같은 표 (그건 파일 안에 갇혀 있어요) */
  const LABEL = { idle: "☕BREAK☕", writing: "🔥WRITE🔥", focus: "💻JOB💻", multi: "💻multiT📓",
                  rest: "☕BREAK☕", away: "💤AWAY💤", repair: "🛠️REPAIR🛠️" };
  const CLS   = { idle: "status-rest", writing: "status-writing", focus: "status-focus", multi: "status-multi",
                  rest: "status-rest", away: "status-away", repair: "status-repair" };

  function whText(ms) {
    const m = Math.round(Math.max(0, Number(ms || 0)) / 60000);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}`;
  }

  let _timer = null, _rows = null, _err = "";
  let _lastFetch = 0;

  /* 프사 — users/{닉}/profile 은 누구나 읽을 수 있어서 REST 로 한 사람씩.
     한 번 읽은 건 이 창이 살아 있는 동안 다시 안 읽습니다 (옛 글자 사진은
     수백 KB 라 매번 읽으면 아까워요). 사진 고르는 법은 본편 photoSrcOf 그대로. */
  const _photo = {};          // { 닉: 주소 | "" }
  const _photoBusy = new Set();
  async function loadPhoto(nick) {
    if (nick in _photo || _photoBusy.has(nick)) return;
    _photoBusy.add(nick);
    try {
      const r = await fetch(`${DB_URL}/users/${encodeURIComponent(nick)}/profile.json`, { cache: "no-store" });
      const prof = r.ok ? ((await r.json()) || {}) : {};
      _photo[nick] = window.photoSrcOf ? window.photoSrcOf(prof) : "";
    } catch (e) { _photo[nick] = ""; }
    _photoBusy.delete(nick);
    render();
  }
  /* 사진 없는 사람 — 닉 첫 글자 동그라미 (본편 눈사람 대신 가볍게) */
  function avatarHtml(nick) {
    const src = _photo[nick];
    if (src) return `<img class="member-ava" src="${src}" alt="" decoding="async">`;
    return `<span class="member-ava member-ava-txt">${esc(String(nick).slice(0, 1))}</span>`;
  }

  async function fetchStatus() {
    try {
      const r = await fetch(`${DB_URL}/status.json`, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const all = (await r.json()) || {};
      const now = Date.now();
      _rows = Object.entries(all)
        .map(([nick, row]) => ({ nick, row: row || {} }))
        .filter(x => (typeof window.isOnline === "function") ? window.isOnline(x.row, now) : true)
        .sort((a, b) => Number(b.row.workMs || 0) - Number(a.row.workMs || 0) || a.nick.localeCompare(b.nick, "ko"));
      _err = "";
    } catch (e) {
      _err = "본방을 못 읽었어요 — " + (e.message || e);
    }
    render();
  }

  /* 알약 글자 — [🙋‍♂️Member - n명 접속 중]. 못 읽었으면 숫자를 뺍니다 */
  function paintPill() {
    const 글 = document.querySelector("#member-tab .member-tab-t");
    if (!글) return;
    글.textContent = (_rows && !_err) ? `🙋‍♂️Member - ${_rows.length}명 접속 중` : "🙋‍♂️Member";
  }

  /* ── 옆 탭과 명단 칸 ─────────────────────────────────────────── */
  const OPEN_KEY = "soloMemberOpen";
  let _open = false;
  try { _open = window.AppStore?.getItem(OPEN_KEY) === "1"; } catch (e) {}

  function 옆칸만들기() {
    if (el("member-side")) return true;
    if (!document.body) return false;
    const box = document.createElement("aside");
    box.id = "member-side";
    box.className = "member-side";
    box.setAttribute("aria-label", "본방 접속자");
    box.innerHTML = `
      <button type="button" id="member-tab" class="member-tab" aria-expanded="false" aria-controls="member-side-body"
              title="본방에 지금 누가 있나"><span class="member-tab-t">🙋‍♂️Member</span></button>
      <div class="member-side-list" id="member-side-body"></div>`;
    document.body.appendChild(box);
    el("member-tab").addEventListener("click", () => 여닫기(!_open));
    여닫기(_open, true);
    return true;
  }
  function 여닫기(on, 처음) {
    _open = !!on;
    if (!처음) { try { window.AppStore?.setItem(OPEN_KEY, _open ? "1" : "0"); } catch (e) {} }
    document.documentElement.classList.toggle("member-open", _open);
    el("member-tab")?.setAttribute("aria-expanded", String(_open));
    자리맞추기();
    if (_open) { render(); _lastFetch = 0; }       // 열자마자 쥐고 있던 명단을 그리고, 곧바로 새로 읽습니다
    /* 카드 마당 폭이 달라졌으니 화면 공유 카드 키도 다시 잽니다 */
    try { window.syncShareCardHeights?.(); } catch (e) {}
  }
  /* 탭·명단의 위아래를 **카드 마당**에 맞춥니다 — 머리말 아래에서 시작해 알약 줄 위에서 끝나요 */
  function 자리맞추기() {
    const box = el("member-side"), 마당 = document.querySelector(".cards-area");
    if (!box || !마당) return;
    const r = 마당.getBoundingClientRect();
    if (r.height < 40) return;                        // 아직 배치 전
    box.style.top = Math.round(r.top) + "px";
    box.style.height = Math.round(r.height) + "px";
  }
  window.addEventListener("resize", 자리맞추기);

  function render() {
    paintPill();
    const host = el("member-side-body");
    if (!host) return;
    /* 프사는 판이 열려 있을 때만 읽습니다 (알약 숫자에는 필요 없어요) */
    if (_rows && isOpen()) _rows.forEach(x => loadPhoto(x.nick));
    if (_rows === null) { host.innerHTML = `<div class="member-empty">본방을 들여다보는 중…</div>`; return; }
    if (_err) { host.innerHTML = `<div class="member-empty">${esc(_err)}</div>`; return; }
    if (!_rows.length) { host.innerHTML = `<div class="member-empty">지금 본방엔 아무도 없어요 🌙</div>`; return; }
    host.innerHTML = `
      <div class="member-head">본방 <b>${_rows.length}명</b> 접속 중 <span class="member-when">${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준</span></div>
      <ul class="member-list">${_rows.map(({ nick, row }) => {
        const st = row.status || "idle";
        return `<li class="member-row">
          ${avatarHtml(nick)}
          <span class="member-nick">${esc(nick)}</span>
          <span class="card-state ${CLS[st] || "status-rest"} member-state">${esc(row.statusLabel || LABEL[st] || "휴식")}</span>
          <span class="member-wh">⏱ ${whText(row.workMs)}</span>
        </li>`; }).join("")}
      </ul>`;
  }

  function isOpen() { return _open; }
  /* 알약을 누르는 순간을 잡을 손잡이가 따로 없어서 1초마다 열렸나만 봅니다.
     열려 있으면 30초마다, 닫혀 있으면 1분마다 읽어요 (알약 숫자용).
     탭이 가려져 있으면 안 읽습니다 — 안 보는 숫자를 고칠 이유가 없으니까요. */
  let _wasOpen = false;
  setInterval(() => {
    if (!옆칸만들기()) return;
    자리맞추기();                              // 배치가 바뀌어도(머리말 줄 수·창 크기) 따라갑니다 — 값 두 개 적는 일
    const open = isOpen();
    if (open && !_wasOpen) render();          // 막 열었을 때 — 쥐고 있던 명단을 바로 그립니다
    _wasOpen = open;
    if (document.hidden) return;
    const now = Date.now();
    if (now - _lastFetch < (open ? TICK_MS : PILL_TICK_MS)) return;
    _lastFetch = now;
    fetchStatus();
  }, 1000);

  window.memberRefresh = fetchStatus;
})();
