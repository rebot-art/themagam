/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 💘 하트 쏘기 (script_heart.js) — 2026-09-30 콩
   ---------------------------------------------------------------------
   남의 카드 **바탕을 더블클릭**하면 그 사람에게 하트가 날아갑니다.
   받은 하트는 프사 **오른쪽 위 귀퉁이**에 빨간 하트로 붙어요 (📮 쪽지
   리본은 왼쪽 위 — 둘이 마주 봅니다).

   [누가 무엇을 보나 — 2026-09-30 콩 결정 (C안)]
     하트가 붙었다는 것    → 모두에게 보임 (응원은 보이게)
     누가 쐈나 · 몇 개인가 → **받은 본인만** (하트를 누르면 작은 판)
   그래서 자리를 둘로 나눕니다:
     cardHeartsOn/{YYYY-MM-DD}/{받는닉} = true            ← 공개 · "오늘 받았다"
     cardHearts/{YYYY-MM-DD}/{받는닉}/{쏜닉} = 오늘 쏜 횟수 ← 받는 사람만 읽음
   보안규칙이 cardHearts/{날짜}/{닉} 을 그 닉의 주인에게만 열어 줍니다.
   쏜 사람은 자기 칸(…/{쏜닉}) 하나만 읽고 씁니다 — +1 하려면 지금
   값을 알아야 해서요(transaction). 남의 칸은 못 봅니다.

   [카드의 손가락 세 곳 — 2026-09-30 콩이 정함]
     프로필 사진        한 번 클릭  → 🏅 업적 (script_note.js 가 가름)
     네임 박스(아래칸)  한 번 클릭  → 📮 쪽지 (script_note.js)
     바탕(그 밖 전부)   더블클릭    → 💘 하트 (여기)
   바탕 한 번 클릭엔 아무 일도 없어서, 더블클릭을 "미뤘다 취소"하는
   잔재주가 필요 없습니다.

   [하루만 삽니다]
   날짜가 맨 위 열쇠라서 "오늘 것"만 읽으면 자정 리셋이 끝납니다.
   지우는 코드가 따로 없어요 — 어제 가지는 방장이 들어올 때 조용히
   치웁니다(sweepOld). 총합을 어디 쌓지 않습니다 (콩: "하루만 유지").

   [통신량]
   모두가 듣는 건 cardHeartsOn/{오늘} **한 가지** — 닉 몇 개에 true 뿐.
   내 것(cardHearts/{오늘}/{내닉})은 나만 하나 더. 자정을 넘기면 둘 다
   새 날짜로 갈아 끼웁니다.
   ===================================================================== */
(function () {
  const NODE    = "cardHearts";     // 받는 사람만 읽는 자리 — 누가 · 몇 개
  const NODE_ON = "cardHeartsOn";   // 모두가 읽는 자리 — 받았다/안 받았다
  const MAX_PER_DAY = 99;           // 한 사람이 한 사람에게 하루에 — 보안규칙과 같은 값

  let _day = "", _onRef = null, _mineRef = null;
  let _on   = {};                   // { 받는닉: true }       ← 공개
  let _mine = {};                   // { 쏜닉: n }            ← 내 것만
  let _pop = null;
  /* 오늘 이미 하트를 붙여 본 닉 — 카드가 다시 그려질 때 또 "퐁" 하지 않게.
     ★ [2026-09-30 콩 제보 "간헐적으로 깜빡인다"] 카드는 15초마다 오는
       하트비트로 다시 그려지고, 그때 하트도 새로 태어나서 등장 애니가
       매번 다시 돌았습니다. 처음 붙을 때만 퐁, 그 뒤엔 조용히. */
  const _shown = new Set();

  const el = (id) => document.getElementById(id);
  function esc(s) { return window.escapeHtml ? window.escapeHtml(s) : String(s == null ? "" : s); }
  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }
  /* 날짜 열쇠 — 업적(script_achv.js)과 같은 셈, 이 방의 하루 = 이 컴퓨터의 하루 */
  function dayKey(d) {
    d = d || new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dd}`;
  }

  /* 💘 꽉 찬 하트 + 흰 테두리 스티커 (콩 선택 5번 · 2026-09-30) */
  const HEART_SVG = `<svg viewBox="0 0 64 62" width="40" height="38" aria-hidden="true">
      <path d="M32 57 C14 44 3 32 5 19 C7 8 20 4 32 15 C44 4 57 8 59 19 C61 32 50 44 32 57Z"
            fill="#e6323c" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
      <path d="M32 57 C14 44 3 32 5 19 C7 8 20 4 32 15 C44 4 57 8 59 19 C61 32 50 44 32 57Z" fill="#e6323c"/>
      <path d="M14 20 C16 14 21 12 25 13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
    </svg>`;

  /* ---------------------------------------------------------------
     듣기 — 공개 가지 하나 + 내 가지 하나
     --------------------------------------------------------------- */
  function subscribe(day) {
    try { _onRef && _onRef.off(); } catch (e) {}
    try { _mineRef && _mineRef.off(); } catch (e) {}
    _onRef = _mineRef = null; _on = {}; _mine = {};
    if (_day !== day) _shown.clear();     // 새 날 — 다시 퐁 해도 됩니다
    if (!window.db) return;
    _day = day;
    _onRef = db.ref(`${NODE_ON}/${day}`);
    _onRef.on("value", snap => {
      _on = snap.val() || {};
      renderHeartBadges();
    });
    if (me()) {
      _mineRef = db.ref(`${NODE}/${day}/${me()}`);
      _mineRef.on("value", snap => {
        _mine = snap.val() || {};
        renderHeartBadges();
        if (_pop) refreshPop();
      });
    }
  }
  function listenHearts() {
    if (!me() || _onRef) return;
    subscribe(dayKey());
    sweepOld();
  }
  function detachHearts() {
    try { _onRef && _onRef.off(); } catch (e) {}
    try { _mineRef && _mineRef.off(); } catch (e) {}
    _onRef = _mineRef = null; _on = {}; _mine = {}; _day = "";
    closePop();
  }
  /* 자정을 넘겨 켜 둔 창 — 새 날짜 가지로 갈아 끼웁니다 (하트가 싹 사라져요) */
  setInterval(() => {
    if (_onRef && _day && _day !== dayKey()) { subscribe(dayKey()); renderHeartBadges(); }
  }, 60000);

  /* 어제 가지 치우기 — 방장만 (보안규칙이 그렇게 잠겨 있어요). 남들은 조용히 넘어갑니다. */
  async function sweepOld() {
    try {
      if (!window.canAdmin?.() || !window.db) return;
      const today = dayKey();
      for (const node of [NODE_ON, NODE]) {
        const snap = await db.ref(node).once("value");
        const all = snap.val() || {};
        const upd = {};
        Object.keys(all).forEach(k => { if (k !== today) upd[k] = null; });
        if (Object.keys(upd).length) await db.ref(node).update(upd);
      }
    } catch (e) {}
  }

  /* ---------------------------------------------------------------
     세기 — 내 것만 셀 수 있습니다
     --------------------------------------------------------------- */
  function myHearts() {                // { 쏜닉: n }
    return (_mine && typeof _mine === "object") ? _mine : {};
  }
  function myHeartCount() {
    return Object.values(myHearts()).reduce((s, n) => s + (Number(n) || 0), 0);
  }
  function hasHeart(nick) {            // 모두가 아는 것 — 오늘 받았나
    if (nick === me()) return myHeartCount() > 0 || _on[nick] === true;
    return _on[nick] === true;
  }

  /* ---------------------------------------------------------------
     카드에 붙이기 — **카드** 오른쪽 위 모서리, 바깥으로 살짝
       ([2026-09-30 콩] 프사 모서리 → 카드 모서리. 상태 스티커처럼
        카드 밖으로 튀어나오게. 그래서 프사 칸이 아니라 카드에 답니다)
       남의 카드: 하트만 (숫자 없음 · 눌러도 아무 일 없음)
       내 카드:   하트 + 둘 이상이면 숫자 · 누르면 누가 쐈나
     --------------------------------------------------------------- */
  function renderHeartBadges() {
    const list = el("user-cards");
    if (!list) return;
    list.querySelectorAll(".user-card[data-card-nick]").forEach(card => {
      const nick = card.getAttribute("data-card-nick");
      const mine = nick === me();
      let b = card.querySelector(":scope > .card-heart");
      if (!hasHeart(nick)) { if (b) b.remove(); _shown.delete(nick); return; }
      if (!b) {
        b = document.createElement(mine ? "button" : "span");
        if (mine) { b.type = "button"; b.setAttribute("data-heart-open", nick); }
        b.className = "card-heart" + (mine ? " is-mine" : "") + (_shown.has(nick) ? "" : " is-new");
        b.innerHTML = HEART_SVG + (mine ? `<span class="card-heart-n"></span>` : "");
        card.appendChild(b);
        _shown.add(nick);
      }
      if (mine) {
        const n = myHeartCount();
        const nEl = b.querySelector(".card-heart-n");
        if (nEl) nEl.textContent = n > 1 ? String(n) : "";
        b.title = `오늘 받은 하트 ${n} — 눌러서 누가 쐈는지 봐요`;
      } else {
        b.title = `${nick} 님이 오늘 하트를 받았어요`;
      }
      b.setAttribute("aria-label", b.title);
    });
  }

  /* ---------------------------------------------------------------
     쏘기 — 내 칸에 +1, 공개 가지에 true
     --------------------------------------------------------------- */
  let _busy = false;
  async function sendHeart(to, card) {
    const from = me();
    to = String(to || "").trim();
    if (!from || !to || to === from || !window.db) return;
    if (_busy) return;
    _busy = true;
    fly(card);
    try {
      await db.ref(`${NODE}/${dayKey()}/${to}/${from}`)
        .transaction(n => Math.min(MAX_PER_DAY, (Number(n) || 0) + 1));
      await db.ref(`${NODE_ON}/${dayKey()}/${to}`).set(true);
    } catch (e) { console.warn("[heart]", e); }
    _busy = false;
  }
  /* 카드에서 ❤️ 가 퐁 떠오릅니다 — 눌렸다는 손맛 */
  function fly(card) {
    if (!card) return;
    const f = document.createElement("span");
    f.className = "card-heart-fly";
    f.textContent = "❤️";
    card.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  /* ---------------------------------------------------------------
     누가 쐈나 — 내 하트를 누르면 작은 판 (본인만)
     --------------------------------------------------------------- */
  function openPop(anchor) {
    closePop();
    const p = document.createElement("div");
    p.className = "card-heart-pop";
    p.setAttribute("role", "dialog");
    document.body.appendChild(p);
    _pop = p;
    refreshPop();
    if (!_pop) return;
    const r = anchor.getBoundingClientRect();
    const w = p.offsetWidth || 190;
    let left = r.right - w, top = r.bottom + 6;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    if (top + p.offsetHeight > window.innerHeight - 8) top = r.top - p.offsetHeight - 6;
    p.style.left = left + "px";
    p.style.top = top + "px";
  }
  function refreshPop() {
    if (!_pop) return;
    const rows = Object.entries(myHearts())
      .map(([from, n]) => ({ from, n: Number(n) || 0 }))
      .filter(r => r.n > 0)
      .sort((a, b) => b.n - a.n || a.from.localeCompare(b.from, "ko"));
    const total = rows.reduce((s, r) => s + r.n, 0);
    if (!total) { closePop(); return; }
    _pop.innerHTML = `
      <div class="card-heart-pop-h">💘 오늘 받은 하트 <b>${total}</b></div>
      <ul>${rows.map(r =>
        `<li><span>${esc(r.from)}</span>${r.n > 1 ? `<span class="x">×${r.n}</span>` : ""}</li>`).join("")}
      </ul>
      <div class="card-heart-pop-f">나만 볼 수 있어요 🤫 · 자정에 사라져요 🌙</div>`;
  }
  function closePop() {
    if (_pop) { _pop.remove(); _pop = null; }
  }

  /* ---------------------------------------------------------------
     손가락 붙이기
     --------------------------------------------------------------- */
  function bindHeartClicks() {
    const list = el("user-cards");
    if (list && !list.__heartBound) {
      list.__heartBound = true;

      /* 내 하트 누르기 → 누가 쐈나 */
      list.addEventListener("click", (e) => {
        const b = e.target.closest("[data-heart-open]");
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        if (_pop) { closePop(); return; }
        openPop(b);
      });

      /* 바탕 더블클릭 → 쏘기.
         ★ 프사·아래칸(네임 박스)·상태 알약·작업 스티커 자리·공유 액자는
           제각기 제 손이 있으니 비켜 줍니다. 그 밖(카드 바탕) 만. */
      list.addEventListener("dblclick", (e) => {
        const card = e.target.closest(".user-card[data-card-nick]");
        if (!card) return;
        if (e.target.closest(".card-avatar-wrap, .card-foot, .card-state, [data-pick-worktag], .share-card, [data-heart-open], button, a")) return;
        const nick = card.getAttribute("data-card-nick");
        if (!nick || nick === me()) return;
        e.preventDefault();
        /* 더블클릭이 글자를 파랗게 긁어 놓는 것을 지웁니다 */
        try { window.getSelection()?.removeAllRanges(); } catch (x) {}
        sendHeart(nick, card);
      });
    }

    /* 판 바깥을 누르면 닫힘 · Esc 도 */
    document.addEventListener("click", (e) => {
      if (!_pop) return;
      if (e.target.closest(".card-heart-pop, [data-heart-open]")) return;
      closePop();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });
  }

  /* ---------------------------------------------------------------
     창구
     --------------------------------------------------------------- */
  window.listenHearts  = listenHearts;
  window.detachHearts  = detachHearts;
  window.sendHeart     = sendHeart;
  window.myHeartCount  = myHeartCount;

  /* 접속자 카드를 다시 그리면 하트도 다시 붙입니다 (쪽지 리본과 같은 수) */
  (function installHeartHooks() {
    const _render = window.renderUserCards;
    if (typeof _render === "function" && !_render.__heartPatched) {
      const wrapped = function () {
        const r = _render.apply(this, arguments);
        try { renderHeartBadges(); } catch (e) {}
        return r;
      };
      wrapped.__heartPatched = true;
      window.renderUserCards = wrapped;
    }
    const _leave = window.leaveRoom;
    if (typeof _leave === "function" && !_leave.__heartPatched) {
      const wrapped = async function () {
        try { detachHearts(); } catch (e) {}
        return _leave.apply(this, arguments);
      };
      wrapped.__heartPatched = true;
      window.leaveRoom = wrapped;
    }
    bindHeartClicks();
  })();
})();
