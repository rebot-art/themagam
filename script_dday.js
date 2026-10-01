/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 📅 디데이 (script_dday.js) — 2026-10-01 콩
   ---------------------------------------------------------------------
   🗂️ 나의 작업 → 📌 할 일 탭 **맨 위**에 디데이 칸. 이름 + 날짜만 적는
   일정이에요. 할 일과 **따로** 둡니다 — 할 일은 "그날이 돼야" 보이고,
   디데이는 "미리" 보여야 해서 성격이 반대라 섞으면 서로 망가져요.

   [무엇이 어디에 남는가]
     users/{닉}/events/{id} = { t: 이름, d: "YYYY-MM-DD" }   ← 본인만 읽고 씀
     status/{닉}/ddN · ddD  = 개수 · 가장 가까운 것까지 남은 날   ← 카드용 공개
   카드에는 항목 이름이 안 나갑니다 (콩) — 🚩 D-3 과 개수만.
   status 에 두 칸 얹는 건 사실상 공짜예요 (이미 모두가 듣는 가지).

   [어디에 그리나 — 셋]
     ① 할 일 탭 맨 위 칸    — #mywork-panel-todo 를 지켜보다가 그려질 때마다 맨 앞에 끼움
     ② 달력 🚩              — #mywork-cal 의 .att-day[data-d] 에 깃발
     ③ 카드 접속 점 옆      — script_realtime.js 가 status 의 ddN/ddD 로 그림
   (①②는 script_mywork.js 안의 함수를 못 건드려서 MutationObserver 로 얹습니다 —
    카드 하트가 쓰는 것과 같은 수. 그리기 전에 끼우니 깜빡이지 않아요.)

   [지난 디데이] D+1 까지 하루 보여 주고(회색) 그 뒤엔 목록에서 사라집니다.
   서버에서는 입장할 때 D+8 넘은 것을 조용히 지웁니다.
   ===================================================================== */
(function () {
  const MAX_TEXT = 30;
  const MAX_N    = 20;         // 한 사람이 둘 수 있는 디데이 — 넘치면 안내
  const KEEP_PAST_DAYS = 1;    // 지난 것은 D+1 까지 보여 줌
  const SWEEP_PAST_DAYS = 8;   // 서버에서 지우는 선

  let _ref = null;
  let _ev = {};                // { id: {t, d} }
  let _draft = { t: "", d: "" };

  const el = (id) => document.getElementById(id);
  function esc(s) { return window.escapeHtml ? window.escapeHtml(s) : String(s == null ? "" : s); }
  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }
  function todayStr(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function dayOf(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); }
  /* 오늘 0시 기준 남은 날 — 0 이면 D-DAY, 음수면 지남 */
  function diffDays(s) {
    const a = dayOf(s), b = dayOf(todayStr());
    return Math.round((a - b) / 864e5);
  }
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(dayOf(s));

  /* 살아 있는 것 — 가까운 순 */
  function live() {
    return Object.entries(_ev)
      .map(([id, v]) => ({ id, t: String(v?.t || ""), d: String(v?.d || "") }))
      .filter(x => x.t && isDate(x.d) && diffDays(x.d) >= -KEEP_PAST_DAYS)
      .map(x => ({ ...x, n: diffDays(x.d) }))
      .sort((a, b) => a.n - b.n || a.t.localeCompare(b.t, "ko"));
  }
  /* 카드에 실을 요약 — 지난 건 안 셉니다 */
  function summary() {
    const up = live().filter(x => x.n >= 0);
    return up.length ? { n: up.length, days: up[0].n } : null;
  }
  window.myDday = summary;

  /* ---------------------------------------------------------------
     듣기 · 저장
     --------------------------------------------------------------- */
  function listenDday() {
    if (!me() || _ref || !window.db) return;
    _ref = db.ref(`users/${me()}/events`);
    _ref.on("value", snap => {
      _ev = snap.val() || {};
      renderAll();
      /* 카드 요약이 바뀌었을 수 있으니 status 를 한 번 */
      try { window.updateStatus?.(true); } catch (e) {}
    });
    sweepOld();
  }
  function detachDday() {
    try { _ref && _ref.off(); } catch (e) {}
    _ref = null; _ev = {};
  }
  async function sweepOld() {
    try {
      if (!me() || !window.db) return;
      const snap = await db.ref(`users/${me()}/events`).once("value");
      const all = snap.val() || {};
      const upd = {};
      Object.entries(all).forEach(([id, v]) => {
        if (!isDate(v?.d) || diffDays(v.d) < -SWEEP_PAST_DAYS) upd[id] = null;
      });
      if (Object.keys(upd).length) await db.ref(`users/${me()}/events`).update(upd);
    } catch (e) {}
  }
  async function addDday(t, d) {
    t = String(t || "").trim().slice(0, MAX_TEXT);
    if (!t || !isDate(d) || !me() || !window.db) return false;
    if (Object.keys(_ev).length >= MAX_N) { window.heartToast?.(`디데이는 ${MAX_N}개까지예요`); return false; }
    const id = "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    try { await db.ref(`users/${me()}/events/${id}`).set({ t, d }); } catch (e) { console.warn("[dday]", e); return false; }
    return true;
  }
  async function removeDday(id) {
    if (!id || !me() || !window.db) return;
    try { await db.ref(`users/${me()}/events/${id}`).remove(); } catch (e) {}
  }

  /* ---------------------------------------------------------------
     그리기 ① — 할 일 탭 맨 위 칸
     --------------------------------------------------------------- */
  function badgeHtml(n) {
    if (n === 0) return `<span class="dd-badge is-day">D-DAY</span>`;
    if (n < 0)  return `<span class="dd-badge is-past">D+${-n}</span>`;
    if (n <= 3) return `<span class="dd-badge is-hot">D-${n}</span>`;
    if (n <= 7) return `<span class="dd-badge is-warm">D-${n}</span>`;
    return `<span class="dd-badge">D-${n}</span>`;
  }
  function kdate(s) { const x = dayOf(s); return `${x.getMonth() + 1}/${x.getDate()} (${"일월화수목금토"[x.getDay()]})`; }
  function blockHtml() {
    const rows = live();
    const list = rows.length
      ? `<ul class="dd-list">${rows.map(x => `
          <li class="dd-row${x.n < 0 ? " is-past" : ""}">
            ${badgeHtml(x.n)}
            <span class="dd-t" title="${esc(x.t)}">${esc(x.t)}</span>
            <span class="dd-when">${kdate(x.d)}</span>
            <button type="button" class="dd-x" data-dd-del="${esc(x.id)}" title="지우기" aria-label="${esc(x.t)} 지우기">✕</button>
          </li>`).join("")}</ul>`
      : `<p class="mw-empty">아직 디데이가 없어요 — 마감이나 미팅을 적어 두면 카드에 🚩 D-N 이 붙어요.</p>`;
    return `
      <div class="dd-block" id="dd-block">
        <div class="mw-dayhead">
          <span class="mw-daytitle">📅 디데이</span>
          <span class="mw-daycount">${rows.filter(x => x.n >= 0).length}개</span>
        </div>
        ${list}
        <div class="mw-add dd-add">
          <label class="sr-only" for="dd-add-t">디데이 이름</label>
          <input type="text" id="dd-add-t" class="mw-add-in" data-dd-in="t" maxlength="${MAX_TEXT}"
                 value="${esc(_draft.t)}" placeholder="일정 이름 (예: 2권 마감)" enterkeyhint="next">
          <label class="sr-only" for="dd-add-d">디데이 날짜</label>
          <input type="date" id="dd-add-d" class="mw-add-in dd-date" data-dd-in="d" value="${esc(_draft.d || todayStr())}">
          <button type="button" class="mw-add-btn" data-dd-add="1" aria-label="디데이 추가">＋</button>
        </div>
        <p class="mw-hint">지난 디데이는 다음 날까지 회색으로 남았다가 사라져요 · 카드엔 가장 가까운 것 하나만 🚩 D-N 으로</p>
      </div>`;
  }
  function renderBlock() {
    const host = el("mywork-panel-todo");
    if (!host) return;
    let b = host.querySelector("#dd-block");
    const act = document.activeElement;
    const keep = act && act.dataset && act.dataset.ddIn;
    if (keep) _draft[keep === "t" ? "t" : "d"] = act.value;   // 치던 글 지키기
    const html = blockHtml();
    if (b) { b.outerHTML = html; } else { host.insertAdjacentHTML("afterbegin", html); }
    if (keep) { const inp = host.querySelector(`[data-dd-in="${keep}"]`); try { inp?.focus(); } catch (e) {} }
  }

  /* ---------------------------------------------------------------
     그리기 ② — 달력 🚩
     --------------------------------------------------------------- */
  function renderCalFlags() {
    const cal = el("mywork-cal");
    if (!cal) return;
    const days = new Set(live().map(x => x.d));
    cal.querySelectorAll(".att-day[data-d]").forEach(c => {
      const has = days.has(c.getAttribute("data-d"));
      let f = c.querySelector(".dd-flag");
      if (has && !f) { f = document.createElement("i"); f.className = "dd-flag"; f.setAttribute("aria-hidden", "true"); f.textContent = "🚩"; c.appendChild(f); }
      if (!has && f) f.remove();
    });
  }
  function renderAll() { renderBlock(); renderCalFlags(); }

  /* ---------------------------------------------------------------
     손가락 — 추가 · 지우기 · 엔터
     --------------------------------------------------------------- */
  function bind() {
    const host = el("mywork-panel-todo");
    if (host && !host.__ddBound) {
      host.__ddBound = true;
      host.addEventListener("click", async (e) => {
        const del = e.target.closest("[data-dd-del]");
        if (del) { e.preventDefault(); removeDday(del.getAttribute("data-dd-del")); return; }
        if (e.target.closest("[data-dd-add]")) { e.preventDefault(); await submit(); }
      });
      host.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        if (!e.target.closest("[data-dd-in]")) return;
        e.preventDefault(); await submit();
      });
      host.addEventListener("input", (e) => {
        const k = e.target.dataset?.ddIn;
        if (k) _draft[k] = e.target.value;
      });
    }
    async function submit() {
      const t = el("dd-add-t")?.value || "", d = el("dd-add-d")?.value || "";
      if (!t.trim()) { el("dd-add-t")?.focus(); return; }
      if (!isDate(d)) { el("dd-add-d")?.focus(); return; }
      /* 비우기를 먼저 — 저장이 끝나면 목록이 다시 그려지면서 지금 입력칸의
         값을 "치던 글"로 다시 집어 가거든요. 먼저 비워 두면 빈 채로 남아요. */
      const ti = el("dd-add-t"), di = el("dd-add-d");
      if (ti) ti.value = ""; if (di) di.value = todayStr();
      _draft = { t: "", d: "" };
      if (!(await addDday(t, d))) { if (ti) ti.value = t; if (di) di.value = d; _draft = { t, d }; }
      else { try { ti?.focus(); } catch (e) {} }
    }
    /* 할 일 탭·달력이 다시 그려지면 내 것도 다시 얹습니다 (그리기 전에) */
    if (typeof MutationObserver === "function") {
      const todo = el("mywork-panel-todo");
      if (todo && !todo.__ddWatched) {
        todo.__ddWatched = true;
        new MutationObserver(muts => {
          if (!muts.some(m => Array.from(m.addedNodes).some(n => n.nodeType === 1 && !n.closest?.("#dd-block") && n.id !== "dd-block"))) return;
          if (!todo.querySelector("#dd-block")) { try { renderBlock(); } catch (e) {} }
        }).observe(todo, { childList: true });
      }
      const cal = el("mywork-cal");
      if (cal && !cal.__ddWatched) {
        cal.__ddWatched = true;
        new MutationObserver(() => { try { renderCalFlags(); } catch (e) {} }).observe(cal, { childList: true });
      }
    }
  }

  /* 자정 — D-N 이 하루씩 줄어야 합니다 */
  let _day = todayStr();
  setInterval(() => {
    if (_day !== todayStr()) { _day = todayStr(); renderAll(); try { window.updateStatus?.(true); } catch (e) {} }
  }, 60000);

  window.listenDday = listenDday;
  window.detachDday = detachDday;
  window.addDday    = addDday;

  (function install() {
    const _leave = window.leaveRoom;
    if (typeof _leave === "function" && !_leave.__ddPatched) {
      const wrapped = async function () { try { detachDday(); } catch (e) {} return _leave.apply(this, arguments); };
      wrapped.__ddPatched = true;
      window.leaveRoom = wrapped;
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
    else bind();
  })();
})();
