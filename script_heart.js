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
  const NODE    = "cardHearts";     // 받는 사람만 읽는 자리 — 누가
  const NODE_ON = "cardHeartsOn";   // 모두가 읽는 자리 — 받았다/안 받았다
  const NODE_BY = "cardHeartsBy";   // 쏜 사람만 읽는 자리 — 오늘 내가 누구에게 쐈나
  /* ★ [2026-09-30 콩] **하루에 한 사람당 한 번.** 두 번째 더블클릭엔 토스트만.
     보안규칙도 !data.exists() 로 잠가서 두 번째 쓰기는 서버가 거절합니다.
     그래서 이제 숫자 딱지는 "몇 번"이 아니라 **몇 명**이에요. */
  const MAX_PER_DAY = 1;

  let _day = "", _onRef = null, _mineRef = null, _byRef = null;
  let _on   = {};                   // { 받는닉: true }       ← 공개
  let _mine = {};                   // { 쏜닉: 1 }            ← 내 것만
  let _by   = {};                   // { 받는닉: true }       ← 내가 오늘 쏜 사람들
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

  /* 💘 꽉 찬 하트 + 흰 테두리 스티커 (콩 선택 5번 · 2026-09-30)
     ★ [2026-09-30 밤 — 콩, 하트색_내것구분 C안] 색이 둘입니다.
         남이 쏜 카드  → 코랄 #f4866a  ("누가 쐈네, 나도 쏠까")
         내가 쏜 카드  → 진빨강 #c0121e ("아, 내가 쐈지")
       남도 쐈고 나도 쐈으면 내 색이 이겨요 — "내가 했나?"가 궁금한 거니까.
       내 카드에 붙는 건 남이 쏜 것뿐이라 코랄. */
  const COLOR_OTHER = "#f4866a";
  const COLOR_MINE  = "#c0121e";
  const HEART_PATH = "M32 57 C14 44 3 32 5 19 C7 8 20 4 32 15 C44 4 57 8 59 19 C61 32 50 44 32 57Z";
  function heartSvg(color) {
    return `<svg viewBox="0 0 64 62" width="40" height="38" aria-hidden="true">
      <path d="${HEART_PATH}" fill="${color}" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
      <path d="${HEART_PATH}" fill="${color}"/>
      <path d="M14 20 C16 14 21 12 25 13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
    </svg>`;
  }
  const HEART_SVG = heartSvg(COLOR_OTHER);

  /* ---------------------------------------------------------------
     듣기 — 공개 가지 하나 + 내 가지 하나
     --------------------------------------------------------------- */
  function subscribe(day) {
    try { _onRef && _onRef.off(); } catch (e) {}
    try { _mineRef && _mineRef.off(); } catch (e) {}
    try { _byRef && _byRef.off(); } catch (e) {}
    _onRef = _mineRef = _byRef = null; _on = {}; _mine = {}; _by = {};
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
      /* 내가 오늘 누구에게 쐈나 — 색을 가르고, 두 번째를 막는 데 씁니다 */
      _byRef = db.ref(`${NODE_BY}/${day}/${me()}`);
      _byRef.on("value", snap => {
        _by = snap.val() || {};
        renderHeartBadges();
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
    try { _byRef && _byRef.off(); } catch (e) {}
    _onRef = _mineRef = _byRef = null; _on = {}; _mine = {}; _by = {}; _day = "";
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
      for (const node of [NODE_ON, NODE, NODE_BY]) {
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
  function myHeartCount() {            // 몇 명이 쐈나 (하루 한 번이라 = 몇 개)
    return Object.values(myHearts()).filter(n => Number(n) > 0).length;
  }
  function hasHeart(nick) {            // 모두가 아는 것 — 오늘 받았나
    if (nick === me()) return myHeartCount() > 0 || _on[nick] === true;
    return _on[nick] === true || _by[nick] === true;
  }
  function sentTo(nick) { return _by[nick] === true; }   // 오늘 내가 이 사람에게 쐈나

  /* ---------------------------------------------------------------
     카드에 붙이기 — 프사 **오른쪽 변, 위에서 60% 쯤**, 카드 밖으로 살짝
       ([2026-09-30 콩, 세 번째 자리] 프사 귀퉁이 → 카드 모서리 → 여기.
        방장 딱지(프사 오른쪽 아래 모서리)보다 조금 위. 프사를 따라가야
        하니 프사 칸(.card-avatar-wrap)에 답니다 — 자리는 CSS 가 정해요)
       남의 카드: 하트만 (숫자 없음 · 눌러도 아무 일 없음)
       내 카드:   하트 + 둘 이상이면 숫자 · 누르면 누가 쐈나
     --------------------------------------------------------------- */
  function renderHeartBadges() {
    const list = el("user-cards");
    if (!list) return;
    list.querySelectorAll(".user-card[data-card-nick]").forEach(card => {
      const nick = card.getAttribute("data-card-nick");
      const mine = nick === me();
      const wrap = card.querySelector(".card-avatar-wrap");
      if (!wrap) return;
      let b = wrap.querySelector(".card-heart");
      if (!hasHeart(nick)) { if (b) b.remove(); _shown.delete(nick); return; }
      /* 색 — 내가 쏜 카드면 진빨강, 아니면 코랄 (내 카드는 늘 코랄) */
      const color = (!mine && sentTo(nick)) ? COLOR_MINE : COLOR_OTHER;
      if (!b) {
        b = document.createElement(mine ? "button" : "span");
        if (mine) { b.type = "button"; b.setAttribute("data-heart-open", nick); }
        b.className = "card-heart" + (mine ? " is-mine" : "") + (_shown.has(nick) ? "" : " is-new");
        b.innerHTML = heartSvg(color) + (mine ? `<span class="card-heart-n"></span>` : "");
        b.setAttribute("data-heart-color", color);
        wrap.appendChild(b);
        _shown.add(nick);
      } else if (b.getAttribute("data-heart-color") !== color) {
        /* 남이 쏜 코랄 → 내가 쏘면 진빨강으로 바뀝니다 (svg 만 갈아 끼움) */
        const old = b.querySelector("svg");
        if (old) old.outerHTML = heartSvg(color);
        b.setAttribute("data-heart-color", color);
      }
      if (mine) {
        const n = myHeartCount();
        const nEl = b.querySelector(".card-heart-n");
        if (nEl) nEl.textContent = n > 1 ? String(n) : "";
        b.title = `오늘 ${n}명이 하트를 쐈어요 — 눌러서 누가인지 봐요`;
      } else {
        b.title = sentTo(nick) ? `${nick} 님에게 오늘 하트를 쐈어요` : `${nick} 님이 오늘 하트를 받았어요`;
      }
      b.setAttribute("aria-label", b.title);
    });
  }

  /* ---------------------------------------------------------------
     쏘기 — 하루 한 번. 세 자리에 한꺼번에 (받는이 칸 · 공개 · 내 보낸 목록)
     --------------------------------------------------------------- */
  let _busy = false;
  async function sendHeart(to, card) {
    const from = me();
    to = String(to || "").trim();
    if (!from || !to || to === from || !window.db) return;
    if (sentTo(to)) { toast("오늘 이미 보냈어요 💘"); return; }   // ★ 하루 한 번
    if (_busy) return;
    _busy = true;
    fly(card);
    const day = dayKey();
    try {
      /* 한 번에 세 자리 — 셋이 어긋나지 않게 (multi-path update) */
      await db.ref().update({
        [`${NODE}/${day}/${to}/${from}`]: MAX_PER_DAY,
        [`${NODE_ON}/${day}/${to}`]:       true,
        [`${NODE_BY}/${day}/${from}/${to}`]: true
      });
    } catch (e) {
      /* 서버가 거절 = 이미 쐈다 (다른 창에서 쐈다든지). 화면만 맞춰 줍니다 */
      console.warn("[heart]", e);
      toast("오늘 이미 보냈어요 💘");
    }
    _busy = false;
  }
  /* 작은 안내 — 화면 아래 가운데, 1.4초 */
  let _toastT = null;
  function toast(msg) {
    let t = document.getElementById("card-heart-toast");
    if (!t) { t = document.createElement("div"); t.id = "card-heart-toast"; t.className = "card-heart-toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(_toastT);
    _toastT = setTimeout(() => t.classList.remove("on"), 1400);
  }
  window.heartToast = toast;
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
    watchCards();
  })();

  /* [2026-09-30 저녁] 카드 마당을 지켜봅니다 — 화공 응원(script_cheer.js)과
     같은 이유. 카드를 다시 그리는 길이 window.renderUserCards 를 안 거칠 수도
     있어서, 카드가 새로 태어나면 하트를 다시 붙입니다. */
  let _watchTimer = null;
  function watchCards() {
    const list = el("user-cards");
    if (!list || list.__heartWatched || typeof MutationObserver !== "function") return;
    list.__heartWatched = true;
    new MutationObserver(muts => {
      if (!muts.some(m => Array.from(m.addedNodes).some(n => n.nodeType === 1 && n.classList?.contains("user-card") && !n.classList.contains("share-card")))) return;
      /* 미루지 않습니다 — 그리기 전에 바로 (script_cheer.js 와 같은 이유) */
      clearTimeout(_watchTimer); _watchTimer = null;
      try { renderHeartBadges(); } catch (e) {}
    }).observe(list, { childList: true });
  }
})();
