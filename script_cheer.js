/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 🔥 화공 응원 (script_cheer.js) — 2026-09-30 콩
   ---------------------------------------------------------------------
   남의 **화면 공유 카드**를 더블클릭하면 작은 고르기 판이 뜨고, 넷 중
   하나를 골라 응원을 보냅니다. 받은 응원은 화공 카드 **윗변**에 나란히
   붙어요 (오른쪽 70% 지점에서 왼쪽으로 늘어남).

     🔥 불꽃   👍 따봉(파랑)   ⭐ 별(노랑)   ❤️ 하트
   넷 다 프로필 카드의 💘 하트와 같은 결(꽉 찬 색 + 흰 테두리 · 40×38)이고
   숫자 딱지도 같은 것을 씁니다 (.card-heart-n).

   [누가 무엇을 보나 — 프로필 카드 하트와 같은 규칙 (C안)]
     어떤 응원이 붙었나      → 모두에게
     누가 · 몇 개            → **화공 주인만** (스티커를 누르면 작은 판)
       shareCheersOn/{YYYY-MM-DD}/{받는닉}/{종류} = true          ← 공개
       shareCheers/{YYYY-MM-DD}/{받는닉}/{종류}/{쏜닉} = 횟수     ← 주인만 읽음
   하루만 삽니다 — 날짜가 맨 위 열쇠라 자정에 새 가지로 갈아 끼우면 끝.
   어제 가지는 방장이 들어올 때 조용히 치웁니다 (script_heart.js 와 같은 수).

   [손가락]
     화공 카드        더블클릭 (아무 데나)  → 고르기 판
       ★ **내 화공 카드에도** 붙일 수 있습니다 (2026-09-30 콩 — 화공하는
         사람이 적어서, 스스로 붙여 두면 화공 홍보가 됩니다). 프로필
         하트(나에겐 못 쏨)와 다른 점이에요.
     내 화공 카드     off 단추 · "○○의 화면" · 빨간 불은 제 손이 있으니
                      그 위에서만 비켜 줍니다
     내 카드의 스티커  한 번 클릭 → 누가 쐈나
   화공 카드는 프사도 네임 박스도 없어서 하트처럼 가릴 자리가 없어요.

   [화공을 끄면] 카드가 사라지니 스티커도 같이. 다시 켜면 그날 받은 건
   다시 붙습니다 (renderShareCards 뒤에 다시 그리므로).

   [통신량] 모두가 듣는 건 shareCheersOn/{오늘} 하나 — 닉 몇 개 × 종류
   몇 개에 true 뿐. 내 것은 나만 하나 더. 프로필 하트와 같은 수준입니다.
   ===================================================================== */
(function () {
  const NODE    = "shareCheers";
  const NODE_ON = "shareCheersOn";
  const NODE_BY = "shareCheersBy";   // 붙인 사람만 읽는 자리 — 오늘 내가 누구 화면에 뭘 붙였나
  /* ★ [2026-09-30 콩] 하루에 한 사람 화면에 **종류마다 한 번**. 두 번째는 토스트만.
     보안규칙도 !data.exists() 로 잠급니다. 색은 하트와 달리 따로 안 바꿉니다(콩). */
  const MAX_PER_DAY = 1;

  /* 종류 — 순서가 곧 윗줄에 늘어서는 순서 (왼쪽 → 오른쪽) */
  const KINDS = ["fire", "thumb", "star", "heart"];
  const KIND_LABEL = { fire: "🔥 불꽃", thumb: "👍 따봉", star: "⭐ 별", heart: "❤️ 하트" };
  const KIND_EMOJI = { fire: "🔥", thumb: "👍", star: "⭐", heart: "❤️" };

  /* 그림 — 전부 64×62 판에 40×38 로 그립니다 (프로필 하트와 같은 크기) */
  const HEART_PATH = "M32 57 C14 44 3 32 5 19 C7 8 20 4 32 15 C44 4 57 8 59 19 C61 32 50 44 32 57Z";
  const THUMB_PATH = "M22 27h-9a3 3 0 0 0-3 3v21a3 3 0 0 0 3 3h9zM26 54h20.5a6 6 0 0 0 5.8-4.5l4.2-16a5 5 0 0 0-4.8-6.3H39l2-9.4A5 5 0 0 0 36.2 12c-1.4 0-2.7.7-3.4 1.9L26 27z";
  const STAR_PATH  = "M32 5l7.8 16.5L58 24l-13 12.6L48 55 32 45.8 16 55l3-18.4L6 24l18.2-2.5z";
  const FIRE_PATH  = "M34 5c2 10 12 14 12 28a14 14 0 0 1-28 0c0-6 3-10 6-13 0 5 2 8 5 9 0-9 2-17 5-24z";
  /* [2026-09-30 콩] 넷의 **중심선을 나란히** — 판(64×62)의 세로 한가운데(31)에
     모양의 한가운데를 맞춥니다. 불꽃은 원래 그림이 작아서(세로 42) 1.3배,
     따봉은 손이 아래로 처져 있어서 3 만큼 올립니다. 하트·별은 그대로. */
  function sticker(path, color, extra, xf) {
    return `<svg viewBox="0 0 64 62" width="40" height="38" aria-hidden="true"><g${xf ? ` transform="${xf}"` : ""}>
      <path d="${path}" fill="${color}" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
      <path d="${path}" fill="${color}"/>${extra || ""}</g></svg>`;
  }
  const SVG = {
    fire:  sticker(FIRE_PATH,  "#f0642b", `<path d="M32 29c3 4 6 6 6 11a6 6 0 0 1-12 0c0-4 3-6 6-11z" fill="#ffd36b"/>`,
                   "translate(32 31) scale(1.3) translate(-32 -26)"),
    thumb: sticker(THUMB_PATH, "#1f6fd1", `<path d="M14 32v18" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`,
                   "translate(0 -3)"),
    star:  sticker(STAR_PATH,  "#f2a51c", `<path d="M22 23l7-2" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`),
    heart: sticker(HEART_PATH, "#e6323c", `<path d="M14 20 C16 14 21 12 25 13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`)
  };
  const COLOR = { fire: "#f0642b", thumb: "#1f6fd1", star: "#f2a51c", heart: "#e6323c" };

  let _day = "", _onRef = null, _mineRef = null, _byRef = null;
  let _on   = {};        // { 받는닉: { 종류: true } }
  let _mine = {};        // { 종류: { 쏜닉: 1 } }
  let _by   = {};        // { 받는닉: { 종류: true } }  ← 내가 오늘 붙인 것
  let _pop = null, _picker = null;
  const _shown = new Set();   // "닉|종류" — 처음 붙을 때만 퐁

  const el = (id) => document.getElementById(id);
  function esc(s) { return window.escapeHtml ? window.escapeHtml(s) : String(s == null ? "" : s); }
  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }
  function dayKey(d) {
    d = d || new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dd}`;
  }

  /* ---------------------------------------------------------------
     듣기
     --------------------------------------------------------------- */
  function subscribe(day) {
    try { _onRef && _onRef.off(); } catch (e) {}
    try { _mineRef && _mineRef.off(); } catch (e) {}
    try { _byRef && _byRef.off(); } catch (e) {}
    _onRef = _mineRef = _byRef = null; _on = {}; _mine = {}; _by = {};
    if (_day !== day) _shown.clear();
    if (!window.db) return;
    _day = day;
    _onRef = db.ref(`${NODE_ON}/${day}`);
    _onRef.on("value", snap => { _on = snap.val() || {}; renderCheers(); });
    if (me()) {
      _mineRef = db.ref(`${NODE}/${day}/${me()}`);
      _mineRef.on("value", snap => { _mine = snap.val() || {}; renderCheers(); if (_pop) refreshPop(); });
      _byRef = db.ref(`${NODE_BY}/${day}/${me()}`);
      _byRef.on("value", snap => { _by = snap.val() || {}; });
    }
  }
  function listenCheers() {
    if (!me() || _onRef) return;
    subscribe(dayKey());
    sweepOld();
  }
  function detachCheers() {
    try { _onRef && _onRef.off(); } catch (e) {}
    try { _mineRef && _mineRef.off(); } catch (e) {}
    try { _byRef && _byRef.off(); } catch (e) {}
    _onRef = _mineRef = _byRef = null; _on = {}; _mine = {}; _by = {}; _day = "";
    closePop(); closePicker();
  }
  setInterval(() => {
    if (_onRef && _day && _day !== dayKey()) { subscribe(dayKey()); renderCheers(); }
  }, 60000);

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
     세기
     --------------------------------------------------------------- */
  function mineOf(kind) {
    const v = _mine && _mine[kind];
    return (v && typeof v === "object") ? v : {};
  }
  function myCount(kind) {             // 몇 명이 붙였나 (하루 한 번이라 = 몇 개)
    return Object.values(mineOf(kind)).filter(n => Number(n) > 0).length;
  }
  function sentTo(nick, kind) { const v = _by && _by[nick]; return !!(v && v[kind] === true); }
  function hasCheer(nick, kind) {
    if (nick === me() && myCount(kind) > 0) return true;
    const v = _on && _on[nick];
    return !!(v && v[kind] === true);
  }

  /* ---------------------------------------------------------------
     카드에 붙이기 — 윗변, 종류 순서대로 나란히
     --------------------------------------------------------------- */
  function renderCheers() {
    const list = el("user-cards");
    if (!list) return;
    list.querySelectorAll(".share-card[data-share-nick]").forEach(card => {
      const nick = card.getAttribute("data-share-nick");
      const mine = nick === me();
      let row = card.querySelector(":scope > .share-cheers");
      const kinds = KINDS.filter(k => hasCheer(nick, k));
      if (!kinds.length) { if (row) row.remove(); return; }
      if (!row) {
        row = document.createElement("div");
        row.className = "share-cheers";
        card.appendChild(row);
      }
      /* 있어야 할 것만 남기고, 없는 건 뗍니다 */
      row.querySelectorAll(".card-heart").forEach(b => {
        if (!kinds.includes(b.getAttribute("data-cheer-kind"))) { b.remove(); _shown.delete(nick + "|" + b.getAttribute("data-cheer-kind")); }
      });
      kinds.forEach(kind => {
        const key = nick + "|" + kind;
        let b = row.querySelector(`.card-heart[data-cheer-kind="${kind}"]`);
        if (!b) {
          b = document.createElement(mine ? "button" : "span");
          if (mine) { b.type = "button"; b.setAttribute("data-cheer-open", kind); }
          b.className = "card-heart is-cheer" + (mine ? " is-mine" : "") + (_shown.has(key) ? "" : " is-new");
          b.setAttribute("data-cheer-kind", kind);
          b.innerHTML = SVG[kind] + (mine ? `<span class="card-heart-n" style="color:${COLOR[kind]}"></span>` : "");
          /* 종류 순서를 지켜 끼워 넣습니다 */
          const after = Array.from(row.children).find(c => KINDS.indexOf(c.getAttribute("data-cheer-kind")) > KINDS.indexOf(kind));
          row.insertBefore(b, after || null);
          _shown.add(key);
        }
        if (mine) {
          const n = myCount(kind);
          const nEl = b.querySelector(".card-heart-n");
          if (nEl) nEl.textContent = n > 1 ? String(n) : "";
          b.title = `${KIND_LABEL[kind]} ${n}명 — 눌러서 누가 보냈는지 봐요`;
        } else {
          b.title = `${nick} 님 화면에 ${KIND_LABEL[kind]} 응원`;
        }
        b.setAttribute("aria-label", b.title);
      });
    });
  }

  /* ---------------------------------------------------------------
     보내기
     --------------------------------------------------------------- */
  let _busy = false;
  async function sendCheer(to, kind, card) {
    const from = me();
    to = String(to || "").trim();
    if (!from || !to || !window.db || !KINDS.includes(kind)) return;   // 나에게도 됩니다
    if (sentTo(to, kind)) { window.heartToast?.(`오늘 이미 ${KIND_LABEL[kind]} 붙였어요`); return; }   // ★ 하루 한 번
    if (_busy) return;
    _busy = true;
    fly(card, kind);
    const day = dayKey();
    try {
      await db.ref().update({
        [`${NODE}/${day}/${to}/${kind}/${from}`]: MAX_PER_DAY,
        [`${NODE_ON}/${day}/${to}/${kind}`]:      true,
        [`${NODE_BY}/${day}/${from}/${to}/${kind}`]: true
      });
    } catch (e) { console.warn("[cheer]", e); window.heartToast?.(`오늘 이미 ${KIND_LABEL[kind]} 붙였어요`); }
    _busy = false;
  }
  function fly(card, kind) {
    if (!card) return;
    const f = document.createElement("span");
    f.className = "card-heart-fly";
    f.textContent = KIND_EMOJI[kind] || "🔥";
    card.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  /* ---------------------------------------------------------------
     고르기 판 — 더블클릭한 자리에 넷
     --------------------------------------------------------------- */
  function openPicker(nick, card, x, y) {
    closePicker(); closePop();
    const p = document.createElement("div");
    p.className = "share-cheer-picker";
    p.setAttribute("role", "dialog");
    p.innerHTML = `<div class="share-cheer-picker-h">${nick === me() ? "내 화면에 붙이기" : esc(nick) + " 님 화면에 응원"}</div>
      <div class="share-cheer-picker-row">${KINDS.map(k =>
        `<button type="button" data-cheer-pick="${k}" title="${KIND_LABEL[k]}" aria-label="${KIND_LABEL[k]}">${SVG[k]}</button>`).join("")}</div>`;
    document.body.appendChild(p);
    _picker = p;
    p.__nick = nick; p.__card = card;
    const w = p.offsetWidth || 200, h = p.offsetHeight || 70;
    let left = x - w / 2, top = y - h - 10;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    if (top < 8) top = y + 12;
    p.style.left = left + "px"; p.style.top = top + "px";
  }
  function closePicker() { if (_picker) { _picker.remove(); _picker = null; } }

  /* ---------------------------------------------------------------
     누가 보냈나 — 내 스티커를 누르면 (주인만)
     --------------------------------------------------------------- */
  let _popKind = "";
  function openPop(kind, anchor) {
    closePop(); closePicker();
    _popKind = kind;
    const p = document.createElement("div");
    p.className = "card-heart-pop";
    p.setAttribute("role", "dialog");
    document.body.appendChild(p);
    _pop = p;
    refreshPop();
    if (!_pop) return;
    const r = anchor.getBoundingClientRect();
    const w = p.offsetWidth || 190;
    let left = r.left + r.width / 2 - w / 2, top = r.bottom + 6;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    p.style.left = left + "px"; p.style.top = top + "px";
  }
  function refreshPop() {
    if (!_pop) return;
    const rows = Object.entries(mineOf(_popKind))
      .map(([from, n]) => ({ from, n: Number(n) || 0 }))
      .filter(r => r.n > 0)
      .sort((a, b) => b.n - a.n || a.from.localeCompare(b.from, "ko"));
    const total = rows.reduce((s, r) => s + r.n, 0);
    if (!total) { closePop(); return; }
    _pop.innerHTML = `
      <div class="card-heart-pop-h" style="color:${COLOR[_popKind]}">${KIND_LABEL[_popKind]} 내 화면에 <b>${total}</b></div>
      <ul>${rows.map(r =>
        `<li><span>${esc(r.from)}</span>${r.n > 1 ? `<span class="x" style="color:${COLOR[_popKind]}">×${r.n}</span>` : ""}</li>`).join("")}
      </ul>
      <div class="card-heart-pop-f">나만 볼 수 있어요 🤫 · 자정에 사라져요 🌙</div>`;
  }
  function closePop() { if (_pop) { _pop.remove(); _pop = null; _popKind = ""; } }

  /* ---------------------------------------------------------------
     손가락
     --------------------------------------------------------------- */
  function bindCheerClicks() {
    const list = el("user-cards");
    if (list && !list.__cheerBound) {
      list.__cheerBound = true;

      list.addEventListener("click", (e) => {
        const b = e.target.closest("[data-cheer-open]");
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        const kind = b.getAttribute("data-cheer-open");
        if (_pop && _popKind === kind) { closePop(); return; }
        openPop(kind, b);
      });

      /* 남의 화공 카드 더블클릭 → 고르기 판. 내 것의 단추들은 비켜 줍니다. */
      list.addEventListener("dblclick", (e) => {
        const card = e.target.closest(".share-card[data-share-nick]");
        if (!card) return;
        if (e.target.closest("[data-share-stop], [data-share-switch], [data-blur-open], [data-cheer-open], .share-cheers")) return;
        const nick = card.getAttribute("data-share-nick");
        if (!nick) return;                    // 내 카드도 됩니다 (화공 홍보)
        e.preventDefault(); e.stopPropagation();
        try { window.getSelection()?.removeAllRanges(); } catch (x) {}
        openPicker(nick, card, e.clientX, e.clientY);
      });
    }

    document.addEventListener("click", (e) => {
      const pick = e.target.closest("[data-cheer-pick]");
      if (pick && _picker) {
        e.preventDefault(); e.stopPropagation();
        const nick = _picker.__nick, card = _picker.__card;
        closePicker();
        sendCheer(nick, pick.getAttribute("data-cheer-pick"), card);
        return;
      }
      if (_picker && !e.target.closest(".share-cheer-picker")) closePicker();
      if (_pop && !e.target.closest(".card-heart-pop, [data-cheer-open]")) closePop();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closePop(); closePicker(); } });
  }

  /* ---------------------------------------------------------------
     창구
     --------------------------------------------------------------- */
  window.listenCheers = listenCheers;
  window.detachCheers = detachCheers;
  window.sendCheer    = sendCheer;
  window.CHEER_KINDS  = KINDS;

  (function installCheerHooks() {
    /* 화공 카드는 renderShareCards 가 통째로 다시 그립니다 — 그 뒤에 다시 붙입니다.
       ★★ [고침 2026-09-30 저녁 — 콩 제보 "화공을 껐다 켜면, 또 갑자기 스티커가
          사라진다"] 아래처럼 window.renderShareCards 를 감싸는 것만으로는
          모자랐습니다. script_share.js 는 **자기 안에서** renderShareCards() 를
          직접 부르거든요 (화면 사진이 새로 올 때마다, 켜고 끌 때마다). 그 길은
          window 를 거치지 않아서 감싼 옷이 안 걸리고, 카드가 새로 태어난 뒤
          스티커를 다시 붙이는 사람이 없었어요. 저장은 멀쩡했습니다 — 다음
          데이터가 올 때까지 안 보였을 뿐.
          그래서 카드 마당(#user-cards)을 **지켜보다가** 카드가 갈아 끼워지면
          다시 붙입니다 (MutationObserver). 누가 어떤 길로 다시 그리든 걸려요.
          감싼 옷은 그대로 둡니다 — 둘 다 걸려도 두 번 붙이지 않아요
          (이미 있는 스티커는 그대로 두니까). */
    const _renderShare = window.renderShareCards;
    if (typeof _renderShare === "function" && !_renderShare.__cheerPatched) {
      const wrapped = function () {
        const r = _renderShare.apply(this, arguments);
        try { renderCheers(); } catch (e) {}
        return r;
      };
      wrapped.__cheerPatched = true;
      window.renderShareCards = wrapped;
    }
    const _leave = window.leaveRoom;
    if (typeof _leave === "function" && !_leave.__cheerPatched) {
      const wrapped = async function () {
        try { detachCheers(); } catch (e) {}
        return _leave.apply(this, arguments);
      };
      wrapped.__cheerPatched = true;
      window.leaveRoom = wrapped;
    }
    bindCheerClicks();
    watchCards();
  })();

  /* 카드 마당을 지켜봅니다 — 카드가 새로 태어나면 스티커를 다시 붙입니다.
     한 번에 여러 장이 바뀌어도 한 번만 (다음 프레임에 몰아서). */
  let _watchTimer = null;
  function watchCards() {
    const list = el("user-cards");
    if (!list || list.__cheerWatched || typeof MutationObserver !== "function") return;
    list.__cheerWatched = true;
    new MutationObserver(muts => {
      /* 내가 붙인 스티커 줄 때문에 또 도는 건 걸러냅니다 */
      if (!muts.some(m => Array.from(m.addedNodes).some(n => n.nodeType === 1 && n.classList?.contains("share-card")))) return;
      /* ★ 미루지 않습니다 — MutationObserver 는 화면을 그리기 **전**에 불리므로
         여기서 바로 붙이면 스티커가 한 프레임도 안 비어요. setTimeout 으로
         미뤘더니 그 사이 한 번 그려져서 스티커가 깜빡였습니다 (2026-09-30). */
      clearTimeout(_watchTimer); _watchTimer = null;
      try { renderCheers(); } catch (e) {}
    }).observe(list, { childList: true });
  }
})();
