/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 📰 새소식 (script_news.js, 2026-11-17 콩)
   ---------------------------------------------------------------------
   [무엇인가]
   공모전·프로모션·플랫폼 소식처럼 "알아 두면 좋은 소식"을 서로 올리는 옆 탭.
   📓 표현 공부·🤔 Q&A 와 같은 결 — **누구나 올리고**, **익명**이에요.
   한 줄 = 제목 + 내용(선택) + 올린 때. 내용 속 주소(https://…)는 눌러서 열립니다.

   [콩이 정한 것]
     · 누구나 올림 (Q&A 와 같음) · 익명 — 서버에 닉네임을 아예 적지 않습니다.
       "내 글" 표시(지우기 단추)는 이 기기의 AppStore 가 기억할 뿐이에요. 방장은 아무 글이나 지웁니다.
     · 글은 **1년** 뒤 저절로 사라집니다.
         - 그리는 쪽: 1년 넘은 글은 목록에서 빼고 안 보여 줍니다.
         - 지우는 쪽: 목록을 받은 사람이 1년 넘은 글을 서버에서 지웁니다(한 번에 20개까지).
           보안규칙상 지우기는 누구나 되고(Q&A 와 같음), 누가 하든 결과가 같은 일이라 괜찮아요.
     · 링크를 누르면 **더마감 창은 그대로** 두고 새 창(탭)으로 열립니다 — 자료실 찾아보기와 같은 방식
       (window.open + noopener). 주소는 http(s):// 로 시작하는 것만 링크가 됩니다.
     · 🎄 크리스마스 에디션 날(12/18 0시 KST)에 작품 추천과 함께 본방에 열립니다.
       그 전엔 본방에서 이름을 가린 맛보기 탭 — script_sidetabs.js 가 정합니다. 혼자 방은 바로 열려요.

   [서버]  news/{id} = { t, c?, at }
           t 제목(60자) · c 내용(500자, 없어도 됨) · at 올린 시각
   [통신량] 탭을 열 때 한 번 듣고(on), 닫으면 끊습니다(off) — 작품 추천·Q&A 와 같은 원칙.
            글 하나가 200~700바이트, 1년치가 쌓여도 수백 개 안팎. 한 번에 PAGE 개만 그립니다.
   [새 글 점] 올리면 newmark/news 에 시각을 찍고(dockMarkNew) 탭의 점이 켜집니다 (숫자 하나만 오갑니다).

   [보안규칙 — 콘솔 적용 필요]  보안규칙.json 의 "news" 칸을 붙여 넣으세요.
     누구나 읽고, 새 글·지우기는 누구나(익명이라 글쓴이를 규칙으로 못 가려요 — Q&A 와 같음),
     **남의 글 내용 바꿔치기는 막습니다.**
   ===================================================================== */
(function () {
  "use strict";

  const ADMIN_UID = "ABM1ZJndrqaV3gpYUs03SV9qglr1";
  const MAX_T = 60, MAX_C = 500;
  const PAGE = 20;                              // 한 번에 그리는 글 수
  const KEEP_MS = 365 * 24 * 3600 * 1000;       // 1년
  const SWEEP_MAX = 20;                         // 한 번에 지우는 묵은 글 수
  const MINE_KEY = "newsMine";                  // 이 기기가 올린 글

  let _rows = [];
  let _ref = null;
  let _box = null;
  let _bound = false;
  let _busy = false;
  let _보임 = PAGE;
  const _펼침 = new Set();

  const el = (id) => document.getElementById(id);
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? "")) : String(s ?? ""));
  const 방장 = () => { try { return firebase.auth().currentUser?.uid === ADMIN_UID; } catch (e) { return false; } };

  /* ---- 이 기기의 기억 (내 글) ---- */
  function readSet(key) {
    try {
      const arr = JSON.parse(window.AppStore?.getItem(key) || "[]");
      return Array.isArray(arr) ? arr.filter(x => typeof x === "string") : [];
    } catch (e) { return []; }
  }
  function writeSet(key, arr) {
    try { window.AppStore?.setItem(key, JSON.stringify(arr.slice(-500))); } catch (e) {}
  }
  const isMine = (id) => readSet(MINE_KEY).indexOf(id) >= 0;
  function remember(id) {
    const arr = readSet(MINE_KEY);
    if (arr.indexOf(id) < 0) { arr.push(id); writeSet(MINE_KEY, arr); }
  }
  function forget(id) { writeSet(MINE_KEY, readSet(MINE_KEY).filter(x => x !== id)); }

  /* ---- 서버에서 읽어 온 줄 다듬기 ---- */
  function normalize(id, v) {
    if (!v || typeof v !== "object") return null;
    const t = String(v.t || "").trim().slice(0, MAX_T);
    const c = String(v.c || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_C);
    if (!t) return null;
    return { id, t, c, at: Number(v.at) || 0 };
  }

  /** 1년이 지났나 — 순수 계산 (점검용으로도 내보냅니다) */
  function 만료됐나(at, now) {
    const a = Number(at) || 0;
    return a > 0 && (Number(now) || Date.now()) - a > KEEP_MS;
  }

  /* ---- 글 속 주소를 링크로 — 먼저 글을 안전하게 바꾼 뒤(esc), 주소만 <a> 로 ----
     http(s):// 로 시작하는 것만 링크가 됩니다. 끝의 . , ) 같은 문장부호는 주소에서 뗍니다. */
  const URL_RE = /https?:\/\/[^\s<>"']+/g;
  function 링크넣기(text) {
    const s = String(text || "");
    let out = "", last = 0, m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(s))) {
      let url = m[0], tail = "";
      const cut = /[.,;:!?)\]}'"」』、。]+$/.exec(url);
      if (cut) { tail = cut[0]; url = url.slice(0, url.length - tail.length); }
      if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(url)) continue;
      out += esc(s.slice(last, m.index)) +
        `<a href="${esc(url)}" class="nw-link" data-nw-url="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` + esc(tail);
      last = m.index + m[0].length;
    }
    return out + esc(s.slice(last));
  }

  function 언제(at, now) {
    if (!at) return "";
    const 분 = Math.floor(((now || Date.now()) - at) / 60000);
    if (분 < 1) return "방금";
    if (분 < 60) return `${분}분 전`;
    const 시 = Math.floor(분 / 60);
    if (시 < 24) return `${시}시간 전`;
    const 날 = Math.floor(시 / 24);
    return `${날}일 전`;
  }

  /* ---- 그리기 ---- */
  function 뼈대() {
    if (!_box || _box.querySelector("#nw-list")) return;
    _box.innerHTML = `
      <p class="nw-kind">공모전·프로모션·플랫폼 소식, 알고 있는 걸 나눠 주세요 📰 <span>글은 1년 뒤 사라져요</span></p>
      <div class="br-bar">
        <button type="button" class="ghost-btn compact primary" id="nw-new" aria-expanded="false">＋ 소식 올리기</button>
        <span class="br-anon">익명으로 올라가요</span>
      </div>
      <div class="br-form" id="nw-form" hidden>
        <input type="text" id="nw-t" maxlength="${MAX_T}" placeholder="제목 (예: ○○ 공모전 접수 시작)" autocomplete="off">
        <textarea id="nw-c" rows="4" maxlength="${MAX_C}" placeholder="내용 · 링크 (https://… 는 눌러서 열 수 있어요 · Shift+Enter 로 줄바꿈)"></textarea>
        <div class="br-form-r">
          <span class="br-cnt" id="nw-cnt">0/${MAX_C}</span>
          <button type="button" class="ghost-btn compact" id="nw-cancel">닫기</button>
          <button type="button" class="ghost-btn compact primary" id="nw-send">올리기</button>
        </div>
      </div>
      <p class="br-msg" id="nw-msg"></p>
      <div class="nw-list" id="nw-list"></div>`;
  }

  function say(t, bad) {
    const m = el("nw-msg");
    if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); }
  }

  function 목록그리기() {
    const box = el("nw-list");
    if (!box) return;
    const now = Date.now();
    const 전부 = _rows.filter(r => !만료됐나(r.at, now));
    const 보일 = 전부.slice(0, _보임);
    if (!전부.length) {
      box.innerHTML = `<p class="br-empty">아직 소식이 없어요.<br>알게 된 공모전이나 프로모션이 있다면 가장 먼저 알려 주세요.</p>`;
      return;
    }
    box.innerHTML = 보일.map(r => {
      const 열림 = _펼침.has(r.id);
      const 지울수있나 = 방장() || isMine(r.id);
      const 길다 = r.c.length > 90 || r.c.indexOf("\n") >= 0;
      return `
      <div class="nw-row${열림 ? " open" : ""}" data-nw="${esc(r.id)}">
        <div class="nw-h">
          <b class="nw-t">${링크넣기(r.t)}</b>
          <span class="nw-when">${esc(언제(r.at, now))}</span>
        </div>
        ${r.c ? `<div class="nw-c${길다 && !열림 ? " clamp" : ""}">${링크넣기(r.c)}</div>` : ""}
        ${(길다 || 지울수있나) ? `<div class="nw-f">
          ${길다 ? `<button type="button" class="nw-tog" data-nw-tog="${esc(r.id)}" aria-expanded="${열림}">${열림 ? "접기" : "더 보기"}</button>` : "<span></span>"}
          ${지울수있나 ? `<button type="button" class="nw-del" data-nw-del="${esc(r.id)}">지우기</button>` : ""}
        </div>` : ""}
      </div>`;
    }).join("") + (전부.length > 보일.length
      ? `<button type="button" class="br-more" id="nw-more">더 보기 (${전부.length - 보일.length})</button>` : "");
  }

  /* ---- 올리기 ---- */
  function 칸열기(열) {
    const f = el("nw-form"), b = el("nw-new");
    if (!f || !b) return;
    f.hidden = !열;
    b.setAttribute("aria-expanded", String(열));
    if (열) { say(""); el("nw-t")?.focus(); }
  }

  function 글자수세기() {
    const n = String(el("nw-c")?.value || "").length;
    const c = el("nw-cnt");
    if (c) c.textContent = n + "/" + MAX_C;
  }

  async function 올리기() {
    if (_busy || !window.db) return;
    const t = String(el("nw-t")?.value || "").trim().slice(0, MAX_T);
    const c = String(el("nw-c")?.value || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_C);
    if (!t) return say("제목을 적어 주세요.", true);
    _busy = true;
    const 짐 = { t, at: Date.now() };
    if (c) 짐.c = c;
    try {
      const r = window.db.ref("news").push();
      await r.set(짐);
      remember(r.key);
      window.dockMarkNew?.("news");              // 탭에 점 (내 기기는 빼고)
      ["nw-t", "nw-c"].forEach(id => { const i = el(id); if (i) i.value = ""; });
      글자수세기();
      칸열기(false);
      say("올렸어요.");
    } catch (e) {
      say("올리지 못했어요. 연결을 확인해 주세요.", true);
    } finally { _busy = false; }
  }

  async function 지우기(id) {
    if (!window.db || !id) return;
    const r = _rows.find(x => x.id === id);
    if (!confirm(`「${r ? r.t : ""}」 소식을 지울까요?`)) return;
    try {
      await window.db.ref("news/" + id).remove();
      forget(id); _펼침.delete(id);
    } catch (e) { say("지우지 못했어요.", true); }
  }

  /** 1년 넘은 글을 서버에서 지웁니다 — 목록을 받은 사람이, 한 번에 SWEEP_MAX 개까지 */
  function 묵은글치우기(raw) {
    if (!window.db) return;
    const now = Date.now();
    const 묵은 = Object.keys(raw || {}).filter(id => 만료됐나((raw[id] || {}).at, now)).slice(0, SWEEP_MAX);
    if (!묵은.length) return;
    const 묶음 = {};
    묵은.forEach(id => { 묶음["news/" + id] = null; });
    try { window.db.ref().update(묶음).catch(() => {}); } catch (e) {}
  }

  function bind(box) {
    if (_bound && box.dataset.nwBound === "true") return;
    box.dataset.nwBound = "true";
    _bound = true;
    box.addEventListener("click", (e) => {
      const a = e.target.closest("[data-nw-url]");
      if (a) {
        /* 더마감 창은 그대로 — 새 창(탭)으로만 엽니다. 클릭 안에서 불러야 팝업 차단에 안 걸려요. */
        e.preventDefault();
        const url = a.dataset.nwUrl;
        if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      if (e.target.closest("#nw-new")) { 칸열기(el("nw-form")?.hidden !== false); return; }
      if (e.target.closest("#nw-cancel")) { 칸열기(false); return; }
      if (e.target.closest("#nw-send")) { 올리기(); return; }
      if (e.target.closest("#nw-more")) { _보임 += PAGE; 목록그리기(); return; }
      const tog = e.target.closest("[data-nw-tog]");
      if (tog) { const id = tog.dataset.nwTog; if (_펼침.has(id)) _펼침.delete(id); else _펼침.add(id); 목록그리기(); return; }
      const x = e.target.closest("[data-nw-del]");
      if (x) { 지우기(x.dataset.nwDel); }
    });
    box.addEventListener("keydown", (e) => {
      /* 한글 조합 중 엔터는 무시 — 글자가 반쯤 올라가는 사고 방지 */
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && e.target.closest("#nw-t, #nw-c")) {
        e.preventDefault(); 올리기();
      }
    });
    box.addEventListener("input", (e) => { if (e.target.id === "nw-c") 글자수세기(); });
  }

  /** 옆 탭이 부릅니다 — 칸(#side-pane-body) 안에 그립니다 */
  function openNews() {
    const pane = el("side-pane-body");
    if (!pane) return;
    let box = el("news-board");
    if (!box) { box = document.createElement("div"); box.id = "news-board"; box.className = "dock-body news-board bookrec-board"; }
    pane.appendChild(box);
    _box = box;
    bind(box);
    뼈대();
    목록그리기();
    if (!_ref && window.db) {
      _ref = window.db.ref("news");
      _ref.on("value", snap => {
        const raw = snap.val() || {};
        _rows = Object.keys(raw).map(id => normalize(id, raw[id])).filter(Boolean)
          .sort((a, b) => (b.at - a.at) || String(b.id).localeCompare(String(a.id)));   // 최신이 위
        목록그리기();
        묵은글치우기(raw);
      }, () => {});
    }
  }
  function closeNews() {
    try { _ref && _ref.off(); } catch (e) {}
    _ref = null;
    _rows = [];
    const box = el("news-board");
    if (box) box.remove();                       // 다음 탭의 알맹이와 섞이지 않게
    _box = null;
    _bound = false;
    _보임 = PAGE;
    _펼침.clear();
  }
  window.openNews = openNews;
  window.closeNews = closeNews;
  window._news = { normalize, 만료됐나, 링크넣기, KEEP_MS, MAX_T, MAX_C };   // 점검용
})();
