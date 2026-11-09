/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 📚 작품 추천 (script_bookrec.js, 2026-11-09 콩)
   ---------------------------------------------------------------------
   [무엇인가]
   "이 작품 재밌었어요" 를 한 줄로 남기는 옆 탭. 📁 자료실 **바로 위**에 앉습니다.
   한 줄 = 장르 · 제목 · 작가 · 한 줄 감상평 · 👍.

   [콩이 정한 것]
     · 모양  : A 한 줄 목록형 (카드형 아님) — 옆 칸이 400px 라 목록이 맞아요.
     · 익명  : 서버에 닉네임을 **아예 적지 않습니다.** 방장도 누가 썼는지 몰라요.
               "내 글" 표시(지우기 단추)는 이 기기의 AppStore 가 기억할 뿐입니다.
               (Q&A·표현 공부와 같은 방식)
     · 장르  : 현로 / 로판 / BL / 현판 / 무협 / GL — 직접 입력이 아니라 **고르기.**
               이름이 제각각(로판/로맨스판타지)이면 장르 필터가 안 먹어서요.
     · 👍    : 따봉만 있습니다. 점수·순위·댓글 없음. 한 기기에서 한 번(다시 누르면 취소).

   [좁은 폭에서 — 이 탭에서 제일 신경 쓴 자리]
     · 한 줄 = [장르 딱지][제목 / 작가] ……… [👍 n]. 제목은 한 줄로 잘리고(…),
       감상평도 한 줄로 잘립니다. **줄을 누르면** 제목·감상평이 줄바꿈으로 펼쳐져요.
     · 👍 는 펼치지 않고도 바로 누릅니다.
     · 추천 쓰는 칸은 [＋ 추천하기] 를 눌러야 열려요 — 평소엔 자리를 안 차지합니다.

   [서버]  bookrec/{id} = { g, t, a?, c, at, up }
           g 장르(여섯 중 하나) · t 제목(40자) · a 작가(30자, 없어도 됨)
           c 감상평(60자) · at 올린 시각 · up 👍 수
   [통신량] 탭을 열 때 한 번 듣고(on), 닫으면 끊습니다(off) — 공지·Q&A·LINK 와 같은 원칙.
            글 하나가 100~200바이트라 수백 개가 쌓여도 수십 KB. 한 번에 PAGE 개만 그립니다.
   [새 글 점] 올리면 newmark/bookrec 에 시각을 찍고(dockMarkNew) 탭의 점이 켜집니다.

   [보안규칙 — 콘솔 적용 필요]  보안규칙.json 의 "bookrec" 칸을 붙여 넣으세요.
     누구나 읽고, 새 글·지우기는 누구나(익명이라 글쓴이를 규칙으로 못 가려요 — Q&A 와 같음),
     **남의 글 내용 바꿔치기는 막습니다** (👍 수만 ±1 로 바뀜).
   ===================================================================== */
(function () {
  "use strict";

  const ADMIN_UID = "ABM1ZJndrqaV3gpYUs03SV9qglr1";
  const GENRES = ["현로", "로판", "BL", "현판", "무협", "GL"];
  const MAX_T = 40, MAX_A = 30, MAX_C = 60;
  const PAGE = 30;                       // 한 번에 그리는 줄 수
  const MINE_KEY = "bookrecMine";        // 이 기기가 올린 글
  const UP_KEY   = "bookrecUps";         // 이 기기가 👍 누른 글

  let _rows = [];
  let _ref = null;
  let _box = null;
  let _bound = false;
  let _busy = false;
  let _필터 = "";                         // "" = 전체
  let _고른장르 = "";                      // 쓰는 칸에서 고른 장르
  let _보임 = PAGE;
  const _펼침 = new Set();
  const _누르는중 = new Set();

  const el = (id) => document.getElementById(id);
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? "")) : String(s ?? ""));
  const 방장 = () => { try { return firebase.auth().currentUser?.uid === ADMIN_UID; } catch (e) { return false; } };

  /* ---- 이 기기의 기억 (내 글 · 내가 누른 👍) ---- */
  function readSet(key) {
    try {
      const arr = JSON.parse(window.AppStore?.getItem(key) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeSet(key, arr) {
    try { window.AppStore?.setItem(key, JSON.stringify(arr.slice(-500))); } catch (e) {}
  }
  const isMine = (id) => readSet(MINE_KEY).indexOf(id) >= 0;
  const didUp  = (id) => readSet(UP_KEY).indexOf(id) >= 0;
  function remember(key, id) {
    const arr = readSet(key);
    if (arr.indexOf(id) < 0) { arr.push(id); writeSet(key, arr); }
  }
  function forget(key, id) { writeSet(key, readSet(key).filter(x => x !== id)); }

  /* ---- 서버에서 읽어 온 줄 다듬기 ---- */
  function normalize(id, v) {
    if (!v || typeof v !== "object") return null;
    const g = String(v.g || "");
    const t = String(v.t || "").trim().slice(0, MAX_T);
    const c = String(v.c || "").trim().slice(0, MAX_C);
    if (GENRES.indexOf(g) < 0 || !t) return null;
    return {
      id, g, t, c,
      a: String(v.a || "").trim().slice(0, MAX_A),
      at: Number(v.at) || 0,
      up: Math.max(0, Math.round(Number(v.up) || 0))
    };
  }

  /* ---- 그리기 ---- */
  function 뼈대() {
    if (!_box || _box.querySelector("#br-list")) return;
    /* 쓰는 칸·장르 칩은 한 번만 — 목록이 갱신돼도 쓰던 글이 지워지지 않게 */
    _box.innerHTML = `
      <div class="br-chips" id="br-chips"></div>
      <div class="br-bar">
        <button type="button" class="ghost-btn compact primary" id="br-new" aria-expanded="false">＋ 추천하기</button>
        <span class="br-anon">익명으로 올라가요</span>
      </div>
      <div class="br-form" id="br-form" hidden>
        <div class="br-form-h">장르</div>
        <div class="br-gpick" id="br-gpick">${GENRES.map(g => `<button type="button" data-br-g="${esc(g)}">${esc(g)}</button>`).join("")}</div>
        <input type="text" id="br-t" maxlength="${MAX_T}" placeholder="제목" autocomplete="off">
        <input type="text" id="br-a" maxlength="${MAX_A}" placeholder="작가 (모르면 비워 둬도 돼요)" autocomplete="off">
        <input type="text" id="br-c" maxlength="${MAX_C}" placeholder="한 줄 감상평" autocomplete="off">
        <div class="br-form-r">
          <span class="br-cnt" id="br-cnt">0/${MAX_C}</span>
          <button type="button" class="ghost-btn compact" id="br-cancel">닫기</button>
          <button type="button" class="ghost-btn compact primary" id="br-send">올리기</button>
        </div>
      </div>
      <p class="br-msg" id="br-msg"></p>
      <div class="br-list" id="br-list"></div>`;
    칩그리기();
  }

  function 칩그리기() {
    const c = el("br-chips");
    if (!c) return;
    c.innerHTML = ["", ...GENRES].map(g =>
      `<button type="button" data-br-f="${esc(g)}" class="${_필터 === g ? "on" : ""}" aria-pressed="${_필터 === g}">${g || "전체"}</button>`).join("");
  }

  function 장르고르기그리기() {
    el("br-gpick")?.querySelectorAll("[data-br-g]").forEach(b => {
      const on = b.dataset.brG === _고른장르;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function 목록그리기() {
    const box = el("br-list");
    if (!box) return;
    const 전부 = _rows.filter(r => !_필터 || r.g === _필터);
    const 보일 = 전부.slice(0, _보임);
    if (!전부.length) {
      box.innerHTML = `<p class="br-empty">${_rows.length
        ? "이 장르는 아직 없어요."
        : "아직 추천이 없어요. 재밌게 본 작품을 첫 번째로 소개해 주세요."}</p>`;
      return;
    }
    box.innerHTML = 보일.map(r => {
      const 열림 = _펼침.has(r.id);
      const 지울수있나 = 방장() || isMine(r.id);
      const 눌렀나 = didUp(r.id);
      return `
      <div class="br-row${열림 ? " open" : ""}" data-br="${esc(r.id)}">
        <div class="br-main" data-br-t="${esc(r.id)}" role="button" tabindex="0" aria-expanded="${열림}">
          <span class="br-g">${esc(r.g)}</span>
          <span class="br-m"><span class="br-t">${esc(r.t)}</span>${r.a ? `<span class="br-a">${esc(r.a)}</span>` : ""}</span>
        </div>
        <button type="button" class="br-up${눌렀나 ? " on" : ""}" data-br-up="${esc(r.id)}"
                aria-pressed="${눌렀나}" aria-label="따봉" title="${눌렀나 ? "따봉을 뗍니다" : "따봉"}">👍<b>${r.up || ""}</b></button>
        <div class="br-c">${esc(r.c)}</div>
        ${열림 && 지울수있나 ? `<div class="br-del"><button type="button" data-br-del="${esc(r.id)}">지우기</button></div>` : ""}
      </div>`;
    }).join("") + (전부.length > 보일.length
      ? `<button type="button" class="br-more" id="br-more">더 보기 (${전부.length - 보일.length})</button>` : "");
  }

  function say(t, bad) {
    const m = el("br-msg");
    if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); }
  }

  /* ---- 올리기 ---- */
  function 칸열기(열) {
    const f = el("br-form"), b = el("br-new");
    if (!f || !b) return;
    f.hidden = !열;
    b.setAttribute("aria-expanded", String(열));
    if (열) { say(""); el("br-t")?.focus(); }
  }

  async function 올리기() {
    if (_busy || !window.db) return;
    const t = String(el("br-t")?.value || "").trim().slice(0, MAX_T);
    const a = String(el("br-a")?.value || "").trim().slice(0, MAX_A);
    const c = String(el("br-c")?.value || "").trim().slice(0, MAX_C);
    if (!_고른장르) return say("장르를 골라 주세요.", true);
    if (!t) return say("제목을 적어 주세요.", true);
    if (!c) return say("한 줄 감상평을 적어 주세요.", true);
    _busy = true;
    const 짐 = { g: _고른장르, t, c, at: Date.now(), up: 0 };
    if (a) 짐.a = a;
    try {
      const r = window.db.ref("bookrec").push();
      await r.set(짐);
      remember(MINE_KEY, r.key);
      window.dockMarkNew?.("bookrec");          // 탭에 점 (내 기기는 빼고)
      ["br-t", "br-a", "br-c"].forEach(id => { const i = el(id); if (i) i.value = ""; });
      _고른장르 = ""; 장르고르기그리기();
      글자수세기();
      칸열기(false);
      say("올렸어요.");
    } catch (e) {
      say("올리지 못했어요. 연결을 확인해 주세요.", true);
    } finally { _busy = false; }
  }

  function 글자수세기() {
    const n = String(el("br-c")?.value || "").length;
    const c = el("br-cnt");
    if (c) c.textContent = n + "/" + MAX_C;
  }

  /* ---- 👍 / 지우기 ---- */
  async function 따봉(id) {
    if (!window.db || !id || _누르는중.has(id)) return;
    _누르는중.add(id);
    const 뗌 = didUp(id);
    try {
      await window.db.ref("bookrec/" + id + "/up")
        .transaction(n => Math.max(0, (Number(n) || 0) + (뗌 ? -1 : 1)));
      if (뗌) forget(UP_KEY, id); else remember(UP_KEY, id);
      목록그리기();
    } catch (e) {
      say("따봉을 누르지 못했어요. 잠시 뒤 다시 해 주세요.", true);
    } finally { _누르는중.delete(id); }
  }

  async function 지우기(id) {
    if (!window.db || !id) return;
    const r = _rows.find(x => x.id === id);
    if (!confirm(`「${r ? r.t : ""}」 추천을 지울까요?`)) return;
    try {
      await window.db.ref("bookrec/" + id).remove();
      forget(MINE_KEY, id); forget(UP_KEY, id); _펼침.delete(id);
    } catch (e) { say("지우지 못했어요.", true); }
  }

  /* ---- 손가락 ---- */
  function 펼치기(id) {
    if (_펼침.has(id)) _펼침.delete(id); else _펼침.add(id);
    목록그리기();
  }

  function bind(box) {
    if (_bound && box.dataset.brBound === "true") return;
    box.dataset.brBound = "true";
    _bound = true;
    box.addEventListener("click", (e) => {
      const f = e.target.closest("[data-br-f]");
      if (f) { _필터 = f.dataset.brF; _보임 = PAGE; 칩그리기(); 목록그리기(); return; }
      const g = e.target.closest("[data-br-g]");
      if (g) { _고른장르 = (_고른장르 === g.dataset.brG) ? "" : g.dataset.brG; 장르고르기그리기(); return; }
      if (e.target.closest("#br-new")) { 칸열기(el("br-form")?.hidden !== false); return; }
      if (e.target.closest("#br-cancel")) { 칸열기(false); return; }
      if (e.target.closest("#br-send")) { 올리기(); return; }
      if (e.target.closest("#br-more")) { _보임 += PAGE; 목록그리기(); return; }
      const up = e.target.closest("[data-br-up]");
      if (up) { 따봉(up.dataset.brUp); return; }
      const x = e.target.closest("[data-br-del]");
      if (x) { 지우기(x.dataset.brDel); return; }
      const t = e.target.closest("[data-br-t]");
      if (t) 펼치기(t.dataset.brT);
    });
    box.addEventListener("keydown", (e) => {
      /* 한글 조합 중 엔터는 무시 — 글자가 반쯤 올라가는 사고 방지 */
      if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229 && e.target.closest("#br-t, #br-a, #br-c")) {
        e.preventDefault(); 올리기(); return;
      }
      if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-br-t]") && e.target.matches("[data-br-t]")) {
        e.preventDefault(); 펼치기(e.target.dataset.brT);
      }
    });
    box.addEventListener("input", (e) => { if (e.target.id === "br-c") 글자수세기(); });
  }

  /** 옆 탭이 부릅니다 — 칸(#side-pane-body) 안에 그립니다 */
  function openBookrec() {
    const pane = el("side-pane-body");
    if (!pane) return;
    let box = el("bookrec-board");
    if (!box) { box = document.createElement("div"); box.id = "bookrec-board"; box.className = "dock-body bookrec-board"; }
    pane.appendChild(box);
    _box = box;
    bind(box);
    뼈대();
    목록그리기();
    if (!_ref && window.db) {
      _ref = window.db.ref("bookrec");
      _ref.on("value", snap => {
        const raw = snap.val() || {};
        _rows = Object.keys(raw).map(id => normalize(id, raw[id])).filter(Boolean)
          .sort((a, b) => (b.at - a.at) || String(b.id).localeCompare(String(a.id)));   // 최신이 위
        목록그리기();
      }, () => {});
    }
  }
  function closeBookrec() {
    try { _ref && _ref.off(); } catch (e) {}
    _ref = null;
    _rows = [];
    const box = el("bookrec-board");
    if (box) box.remove();                       // 다음 탭의 알맹이와 섞이지 않게
    _box = null;
    _bound = false;
    _보임 = PAGE;
  }
  window.openBookrec = openBookrec;
  window.closeBookrec = closeBookrec;
  window._bookrec = { GENRES, normalize, MAX_T, MAX_A, MAX_C };   // 점검용
})();
