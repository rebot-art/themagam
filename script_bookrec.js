/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 📚 작품 추천 (script_bookrec.js, 2026-11-09 콩)
   ---------------------------------------------------------------------
   [무엇인가]
   "이 작품 재밌었어요" 를 한 줄로 남기는 옆 탭. 📁 자료실 **바로 위**에 앉습니다.
   한 줄 = 장르 · 제목 · 작가 · 감상평 · 👍.

   [콩이 정한 것]
     · 모양  : A 한 줄 목록형 (카드형 아님) — 옆 칸이 400px 라 목록이 맞아요.
     · 익명  : 서버에 닉네임을 **아예 적지 않습니다.** 방장도 누가 썼는지 몰라요.
               "내 글" 표시(지우기 단추)는 이 기기의 AppStore 가 기억할 뿐입니다.
               (Q&A·표현 공부와 같은 방식)
     · 장르  : 현로 / 로판 / BL / 현판 / 무협 / GL — 직접 입력이 아니라 **고르기.**
               이름이 제각각(로판/로맨스판타지)이면 장르 필터가 안 먹어서요.
     · 👍    : 따봉만 있습니다. 점수·순위·댓글 없음. 한 기기에서 한 번(다시 누르면 취소).

   [좁은 폭에서 — 이 탭에서 제일 신경 쓴 자리]
     · [2026-11-09 콩] 모양 — **장르 딱지만 왼쪽으로 튀어나오고**, 제목+작가(한 줄) · 감상평은
       **같은 세로줄(제목 시작점)** 에 나란히 섭니다. 작가는 제목 바로 옆.
     · 제목·작가는 한 줄로 잘리고(…), 감상평은 두 줄까지 보입니다. **줄을 누르면** 줄바꿈으로 전부 펼쳐져요.
     · 👍 는 펼치지 않고도 바로 누릅니다.
     · 추천 쓰는 칸은 [＋ 추천하기] 를 눌러야 열려요 — 평소엔 자리를 안 차지합니다.

   [2026-11-17 콩] 💬 댓글 + 맨 위 안내 문구
     · 줄을 펼치면 그 아래에 댓글(익명 · 200자)이 보이고, 쓰는 칸이 나옵니다. 줄 옆 💬 에 댓글 수.
     · 제목 줄 바로 아래 "우리 중에 그분이 계실지 몰라요. 모두 아름다운 말만 씁시다!" 한 줄.
     · [통신량] 댓글 **내용**은 줄을 펼쳤을 때만 듣고(on), 접으면 끊습니다(off) — 목록 쪽 읽기는 줄마다 숫자 n 하나(몇 바이트)만 늘어요.

   [서버]  bookrec/{id} = { g, t, a?, c, at, up, n? }   (n = 댓글 수, 없으면 0)
           bookrecCm/{글id}/{댓글id} = { c(200자), at }   ← 댓글 내용은 따로 — 목록을 내려받을 때 같이 안 딸려 옵니다
           g 장르(여섯 중 하나) · t 제목(40자) · a 작가(30자, 없어도 됨)
           c 감상평(300자 — 콩 2026-11-09, 60→300) · at 올린 시각 · up 👍 수
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
  const MAX_T = 40, MAX_A = 30, MAX_C = 300, MAX_CM = 200;
  const PAGE = 30;                       // 한 번에 그리는 줄 수
  const MINE_KEY = "bookrecMine";        // 이 기기가 올린 글
  const UP_KEY   = "bookrecUps";         // 이 기기가 👍 누른 글
  const CM_KEY   = "bookrecCmMine";      // 이 기기가 쓴 댓글 (댓글id)

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
  const _댓글 = {};                        // { 글id: [{id,c,at}] } — 펼친 줄만
  const _댓글귀 = {};                      // { 글id: ref } — 펼친 줄만 듣습니다
  const _초안 = {};                        // { 글id: 쓰던 댓글 } — 목록이 다시 그려져도 안 날아가게
  let _포커스글 = "", _쓰고있나 = false;                       // 댓글 칸에 커서가 있던 글
  let _조합중 = false, _다시그림 = false;   // 한글 조합 중에는 다시 그리지 않습니다

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
  const isMineCm = (id) => readSet(CM_KEY).indexOf(id) >= 0;
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
    const c = String(v.c || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_C);
    if (GENRES.indexOf(g) < 0 || !t) return null;
    return {
      id, g, t, c,
      a: String(v.a || "").trim().slice(0, MAX_A),
      at: Number(v.at) || 0,
      up: Math.max(0, Math.round(Number(v.up) || 0)),
      n: Math.max(0, Math.round(Number(v.n) || 0))
    };
  }

  /* ---- 그리기 ---- */
  function 뼈대() {
    if (!_box || _box.querySelector("#br-list")) return;
    /* 쓰는 칸·장르 칩은 한 번만 — 목록이 갱신돼도 쓰던 글이 지워지지 않게 */
    _box.innerHTML = `
      <p class="br-kind">우리 중에 그분이 계실지 몰라요. 모두 아름다운 말만 씁시다!</p>
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
        <textarea id="br-c" rows="3" maxlength="${MAX_C}" placeholder="감상평 (${MAX_C}자까지 · Shift+Enter 로 줄바꿈)"></textarea>
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

  function 댓글칸(r) {
    const 줄들 = (_댓글[r.id] || []).map(m => {
      const 내것 = 방장() || isMineCm(m.id);
      return `<div class="br-cmi"><span class="br-cmt">${esc(m.c)}</span>${내것 ? `<button type="button" class="br-cmx" data-br-cdel="${esc(r.id)}|${esc(m.id)}" aria-label="댓글 지우기" title="지우기">✕</button>` : ""}</div>`;
    }).join("");
    return `<div class="br-cm">
      ${줄들 || (_댓글[r.id] ? `<p class="br-cm-empty">아직 댓글이 없어요.</p>` : `<p class="br-cm-empty">불러오는 중…</p>`)}
      <div class="br-cmw">
        <input type="text" class="br-cmin" data-br-cin="${esc(r.id)}" maxlength="${MAX_CM}" placeholder="댓글 (익명이에요 · ${MAX_CM}자까지)" autocomplete="off">
        <button type="button" class="br-cmsend" data-br-csend="${esc(r.id)}">등록</button>
      </div>
    </div>`;
  }

  function 목록그리기() {
    const box = el("br-list");
    if (!box) return;
    if (_조합중) { _다시그림 = true; return; }      // 한글 조합 중에 다시 그리면 글자가 끊깁니다
    const 전부 = _rows.filter(r => !_필터 || r.g === _필터);
    const 보일 = 전부.slice(0, _보임);
    if (!전부.length) {
      box.innerHTML = `<p class="br-empty">${_rows.length
        ? "이 장르는 아직 없어요."
        : "아직 추천이 없어요. 재밌게 본 작품을 첫 번째로 소개해 주세요."}</p>`;
      return;
    }
    /* 쓰던 댓글·커서 자리를 기억해 뒀다가 다시 그린 뒤 돌려놓습니다 */
    const 쓰는칸 = box.querySelector(".br-cmin:focus");
    const 되살릴글 = 쓰는칸 ? 쓰는칸.dataset.brCin : "";
    if (쓰는칸) { _초안[되살릴글] = 쓰는칸.value; }
    box.innerHTML = 보일.map(r => {
      const 열림 = _펼침.has(r.id);
      const 지울수있나 = 방장() || isMine(r.id);
      const 눌렀나 = didUp(r.id);
      return `
      <div class="br-row${열림 ? " open" : ""}" data-br="${esc(r.id)}">
        <span class="br-g" data-br-t="${esc(r.id)}">${esc(r.g)}</span>
        <div class="br-main" data-br-t="${esc(r.id)}" role="button" tabindex="0" aria-expanded="${열림}"><span class="br-t">${esc(r.t)}</span>${r.a ? `<span class="br-a">${esc(r.a)}</span>` : ""}</div>
        <div class="br-acts">
          <button type="button" class="br-cmb${열림 ? " on" : ""}" data-br-t="${esc(r.id)}" aria-label="댓글" title="댓글">💬<b>${r.n || ""}</b></button>
          <button type="button" class="br-up${눌렀나 ? " on" : ""}" data-br-up="${esc(r.id)}"
                  aria-pressed="${눌렀나}" aria-label="따봉" title="${눌렀나 ? "따봉을 뗍니다" : "따봉"}">👍<b>${r.up || ""}</b></button>
        </div>
        <div class="br-c" data-br-t="${esc(r.id)}">${esc(r.c)}</div>
        ${열림 && 지울수있나 ? `<div class="br-del"><button type="button" data-br-del="${esc(r.id)}">지우기</button></div>` : ""}
        ${열림 ? 댓글칸(r) : ""}
      </div>`;
    }).join("") + (전부.length > 보일.length
      ? `<button type="button" class="br-more" id="br-more">더 보기 (${전부.length - 보일.length})</button>` : "");
    box.querySelectorAll(".br-cmin").forEach(i => {
      const id = i.dataset.brCin;
      if (_초안[id]) i.value = _초안[id];
      if (되살릴글 === id) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) {} }
    });
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
    const c = String(el("br-c")?.value || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_C);
    if (!_고른장르) return say("장르를 골라 주세요.", true);
    if (!t) return say("제목을 적어 주세요.", true);
    if (!c) return say("감상평을 적어 주세요.", true);
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
      try { await window.db.ref("bookrecCm/" + id).remove(); } catch (e) {}
      forget(MINE_KEY, id); forget(UP_KEY, id); _펼침.delete(id); 댓글끊기(id);
    } catch (e) { say("지우지 못했어요.", true); }
  }

  /* ---- 💬 댓글 — 펼친 줄만 듣습니다 ---- */
  function 댓글듣기(id) {
    if (_댓글귀[id] || !window.db) return;
    const ref = window.db.ref("bookrecCm/" + id);
    _댓글귀[id] = ref;
    ref.on("value", snap => {
      const raw = snap.val() || {};
      _댓글[id] = Object.keys(raw).map(k => {
        const v = raw[k] || {};
        const c = String(v.c || "").trim().slice(0, MAX_CM);
        return c ? { id: k, c, at: Number(v.at) || 0 } : null;
      }).filter(Boolean).sort((a, b) => (a.at - b.at) || a.id.localeCompare(b.id));   // 오래된 것이 위 — 대화 순서
      목록그리기();
    }, () => {});
  }
  function 댓글끊기(id) {
    try { _댓글귀[id] && _댓글귀[id].off(); } catch (e) {}
    delete _댓글귀[id]; delete _댓글[id];
  }
  function 댓글모두끊기() { Object.keys(_댓글귀).forEach(댓글끊기); }

  async function 댓글올리기(id) {
    if (!window.db || !id || _busy) return;
    const input = _box && _box.querySelector(`.br-cmin[data-br-cin="${CSS.escape(id)}"]`);
    const c = String((input && input.value) || "").replace(/\s+/g, " ").trim().slice(0, MAX_CM);
    if (!c) return;
    _busy = true;
    try {
      const r = window.db.ref("bookrecCm/" + id).push();
      await r.set({ c, at: Date.now() });
      remember(CM_KEY, r.key);
      try { await window.db.ref("bookrec/" + id + "/n").transaction(n => Math.max(0, (Number(n) || 0) + 1)); } catch (e) {}
      delete _초안[id]; _포커스글 = id;
      if (input) input.value = "";
      say("");
    } catch (e) {
      say("댓글을 올리지 못했어요. 연결을 확인해 주세요.", true);
    } finally { _busy = false; }
  }

  async function 댓글지우기(id, cid) {
    if (!window.db || !id || !cid) return;
    if (!confirm("이 댓글을 지울까요?")) return;
    try {
      await window.db.ref(`bookrecCm/${id}/${cid}`).remove();
      forget(CM_KEY, cid);
      try { await window.db.ref("bookrec/" + id + "/n").transaction(n => (Number(n) > 0 ? Number(n) - 1 : n)); } catch (e) {}
    } catch (e) { say("지우지 못했어요.", true); }
  }

  /* ---- 손가락 ---- */
  function 펼치기(id) {
    if (_펼침.has(id)) { _펼침.delete(id); 댓글끊기(id); }
    else { _펼침.add(id); 댓글듣기(id); }
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
      const cs = e.target.closest("[data-br-csend]");
      if (cs) { 댓글올리기(cs.dataset.brCsend); return; }
      const cx = e.target.closest("[data-br-cdel]");
      if (cx) { const [b, c] = String(cx.dataset.brCdel).split("|"); 댓글지우기(b, c); return; }
      const x = e.target.closest("[data-br-del]");
      if (x) { 지우기(x.dataset.brDel); return; }
      const t = e.target.closest("[data-br-t]");
      if (t) 펼치기(t.dataset.brT);
    });
    box.addEventListener("keydown", (e) => {
      /* 한글 조합 중 엔터는 무시 — 글자가 반쯤 올라가는 사고 방지 */
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && e.target.closest("#br-t, #br-a, #br-c")) {
        e.preventDefault(); 올리기(); return;
      }
      if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229 && e.target.matches(".br-cmin")) {
        e.preventDefault(); 댓글올리기(e.target.dataset.brCin); return;
      }
      if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-br-t]") && e.target.matches("[data-br-t]")) {
        e.preventDefault(); 펼치기(e.target.dataset.brT);
      }
    });
    box.addEventListener("input", (e) => {
      if (e.target.id === "br-c") 글자수세기();
      if (e.target.matches && e.target.matches(".br-cmin")) { _초안[e.target.dataset.brCin] = e.target.value; _포커스글 = e.target.dataset.brCin; }
    });
    /* 댓글 칸에 커서가 있는지 / 한글 조합 중인지 — 목록이 다시 그려질 때 칸을 지켜 주려고 */
    box.addEventListener("focusin",  (e) => { if (e.target.matches && e.target.matches(".br-cmin")) { _쓰고있나 = true; _포커스글 = e.target.dataset.brCin; } });
    box.addEventListener("focusout", (e) => { if (e.target.matches && e.target.matches(".br-cmin")) _쓰고있나 = false; });
    box.addEventListener("compositionstart", () => { _조합중 = true; });
    box.addEventListener("compositionend", () => { _조합중 = false; if (_다시그림) { _다시그림 = false; 목록그리기(); } });
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
    댓글모두끊기(); _펼침.clear();
    _rows = [];
    const box = el("bookrec-board");
    if (box) box.remove();                       // 다음 탭의 알맹이와 섞이지 않게
    _box = null;
    _bound = false;
    _보임 = PAGE;
  }
  window.openBookrec = openBookrec;
  window.closeBookrec = closeBookrec;
  window._bookrec = { GENRES, normalize, MAX_T, MAX_A, MAX_C, MAX_CM };   // 점검용
})();
