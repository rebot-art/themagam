/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 🤔 Q&A (script_qna.js, 2026-08-28)

   [무엇인가]
   업계에 관한 것이라면 무엇이든 묻고 답하는 자리. 계약·인세·플랫폼·
   투고·세금 — 검색해도 안 나오고, 아는 사람한테만 물어볼 수 있던 것들이요.

   [📓 표현 공부(script_help.js) 와 형제입니다]
   콩이 "표현공부와 동일한 형태면 돼" 라고 해서 그 판을 본으로 삼았습니다.
   익명 방식·줄 세우는 차례·판 열 때만 듣기 — 전부 같습니다.
   다만 **셋이 다릅니다**:

     ① 스티커가 💡 아하 → ❤️ **이 답 도움 됐어요**
     ② 14일 뒤 사라짐 → **안 사라집니다** (업계 정보는 몸값이 오래가요)
     ③ 답을 ❤️ 많은 차례로 세웁니다 (표현공부는 시간순)

   ★ ③은 조심스럽게 고른 것입니다. 표현공부가 "채택" 을 일부러 뺀 이유는
     **뽑히지 않은 답을 단 사람이 머쓱해져서** 다음부터 아무도 답을 안
     달게 되기 때문이에요. 여기 ❤️ 는 고르는 게 아니라 **쌓이는 것**이라
     결이 다릅니다 — 아무도 떨어뜨리지 않아요. 그래도 "위로 올라간다" 는
     결이 부담이 되면 정렬 한 줄만 되돌리면 됩니다 (답들() 참고).

   [완전 익명 — 대숲·표현공부와 같은 방식]
   서버에 닉네임을 **아예 적지 않습니다.** 방장도 누가 썼는지 볼 방법이
   없어요. "내 글" 표시(✕ 단추, 맨 위 올리기)는 이 기기의 AppStore 가
   기억할 뿐이라, 다른 기기에서는 남의 글과 똑같이 보입니다.

   [줄 세우는 차례]
     ① 이 기기에서 내가 쓴 글      — 답이 달렸나 궁금하니까
     ② 아직 답이 없는 글           — 위에 있어야 지나가다 눈이 갑니다
     ③ 나머지 (최신순)
   ★ ②가 이 판의 핵심입니다. 그냥 시간순으로 쌓으면 답 없는 질문이
     아래로 가라앉아 영영 답을 못 받아요.

   [★ 안 사라지는 대신 — 화면에 끊어 그립니다]
   판을 열 때 qna 를 통째로 내려받습니다(표현공부와 같은 구조).
   글이 안 사라지므로 해가 지나면 이게 무거워져요. 그래서 목록은
   한 번에 PAGE 개만 그리고 "더 보기" 로 늘립니다 — **내려받는 양이
   주는 건 아니고, 화면이 굼떠지는 것만 막습니다.**
   ★ 정말 무거워지면 그때는 규칙에 .indexOn 을 넣고 orderByChild("at")
     .limitToLast() 로 끊어 받아야 합니다. 지금 미리 하지 않는 이유는,
     답(parent)이 질문과 같은 층에 있어서 끊어 받으면 답이 부모 없이
     떨어지기 때문이에요 — 구조를 두 겹으로 바꿔야 하는 큰 일입니다.

   [보안규칙 — 콘솔 적용 필요]
     "qna": {
       ".read": "auth != null",
       ".write": "<방장만>",
       "$id": { ".write": "<관리자/운영진 ∥ 새 글 ∥ 지우기 ∥ text 그대로인 수정>" }
     }
   ★ 대숲·품평과 같은 가드입니다 — 익명이라 "글쓴이만" 을 규칙으로 쓸
     수 없지만, **남의 글 내용을 바꿔치기하는 것**은 규칙이 막습니다.
     ❤️ 는 hearts 만 올리므로 text 가 그대로라 통과해요.
     (표현공부는 이 가드가 없었는데 2026-08-28 에 같이 넣었습니다.)
   ===================================================================== */
(function () {
  "use strict";

  const MAX_TEXT  = 600;                 // 표현공부(300)보다 넉넉 — 사정 설명이 길어져요
  const PAGE      = 20;                  // 한 번에 그리는 질문 수
  const MINE_KEY  = "qnaMine";           // 이 기기가 쓴 글
  const HEART_KEY = "qnaHearts";         // 이 기기가 ❤️ 붙인 답

  let _rows = [];
  let _ref = null;
  let _bound = false;
  let _busy = false;
  let _reply = null;                     // { parent, text }
  let _보임 = PAGE;                       // 지금 그리는 질문 수
  let _pickRef = null;                   // 쓰는 중 골라 둔 참고 글 { id, text }
  const _refOpen = new Set();

  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  /* ---- 이 기기만 아는 것 ---- */
  function readSet(key) {
    try {
      const arr = JSON.parse(window.AppStore?.getItem(key) || "[]");
      return Array.isArray(arr) ? arr.filter(x => typeof x === "string") : [];
    } catch (e) { return []; }
  }
  function writeSet(key, arr) {
    try { window.AppStore?.setItem(key, JSON.stringify(arr.slice(-500))); } catch (e) {}
  }
  function isMine(id)  { return readSet(MINE_KEY).indexOf(id) >= 0; }
  function didHeart(id){ return readSet(HEART_KEY).indexOf(id) >= 0; }
  function remember(key, id) {
    const arr = readSet(key);
    if (arr.indexOf(id) < 0) { arr.push(id); writeSet(key, arr); }
  }
  function forget(key, id) { writeSet(key, readSet(key).filter(x => x !== id)); }

  /* ---- 서버에서 읽어 온 줄 다듬기 ---- */
  function normalize(id, v) {
    if (!v || typeof v !== "object") return null;
    const text = String(v.text || "").slice(0, MAX_TEXT);
    if (!text.trim()) return null;
    return {
      id,
      text,
      at: Number(v.at) || 0,
      parent: typeof v.parent === "string" ? v.parent : "",
      hearts: Math.max(0, Math.round(Number(v.hearts) || 0)),
      ref: typeof v.ref === "string" ? v.ref : ""
    };
  }

  /* =====================================================================
     🔗 비슷한 질문 찾기 — 표현공부에서 그대로 가져왔습니다
     ---------------------------------------------------------------------
     ★ 여기서는 더 요긴합니다. 글이 안 사라지니까 같은 질문이 해마다
       올라올 수 있고, 옛 답이 그대로 살아 있거든요.
     이미 들고 있는 _rows 에서 찾습니다 — 서버에 안 물어 통신량 0.
     ===================================================================== */
  function 낱말(s) {
    return (String(s || "").match(/[가-힣a-zA-Z]{2,}/g) || []).map(w => w.slice(0, 2));
  }
  function 비슷한질문(text) {
    const tk = 낱말(text);
    if (!tk.length) return [];
    return 정렬된질문()
      .filter(q => {
        const qt = 낱말(q.text);
        return tk.some(w => qt.indexOf(w) >= 0);
      })
      .sort((a, b) => b.답 - a.답 || b.at - a.at)   // 답 많은 글이 먼저
      .slice(0, 3);
  }

  function 언제(at) {
    if (!at) return "";
    const 분 = Math.floor((Date.now() - at) / 60000);
    if (분 < 1) return "방금";
    if (분 < 60) return `${분}분 전`;
    const 시 = Math.floor(분 / 60);
    if (시 < 24) return `${시}시간 전`;
    const 날 = Math.floor(시 / 24);
    if (날 < 365) return `${날}일 전`;
    return `${Math.floor(날 / 365)}년 전`;   // 안 사라지는 판이라 해까지 셉니다
  }

  /* =====================================================================
     줄 세우기 — 내 글 · 답 없는 글 · 나머지
     ===================================================================== */
  function 정렬된질문() {
    const 뿌리 = _rows.filter(r => !r.parent);
    const 답수 = {};
    _rows.forEach(r => { if (r.parent) 답수[r.parent] = (답수[r.parent] || 0) + 1; });

    return 뿌리
      .map(r => ({ ...r, 답: 답수[r.id] || 0, 내것: isMine(r.id) }))
      .sort((a, b) => {
        /* ① 내 글이 맨 위 — 이 기기에서만 그렇습니다 */
        if (a.내것 !== b.내것) return a.내것 ? -1 : 1;
        /* ② 답 없는 글이 그다음 — 안 그러면 영영 답을 못 받아요 */
        const a없 = a.답 === 0, b없 = b.답 === 0;
        if (a없 !== b없) return a없 ? -1 : 1;
        /* ③ 최신순 */
        return b.at - a.at;
      });
  }

  /* ★ 답은 ❤️ 많은 차례. 되돌리려면 이 줄을 a.at - b.at 하나로 (머리말 참고) */
  function 답들(parentId) {
    return _rows.filter(r => r.parent === parentId)
      .sort((a, b) => (b.hearts - a.hearts) || (a.at - b.at));
  }

  /* =====================================================================
     그리기
     ===================================================================== */
  function 답HTML(r) {
    const on = didHeart(r.id);
    return `
      <div class="qna-a${r.hearts ? " has-heart" : ""}">
        <div class="qna-a-h">
          <span class="qna-t">${esc(언제(r.at))}</span>
          <span class="qna-sp"></span>
          ${isMine(r.id) ? `<button type="button" class="qna-x" data-qna-del="${esc(r.id)}"
                                    title="내 답 지우기" aria-label="내 답 지우기">✕</button>` : ""}
          <button type="button" class="qna-heart${on ? " is-on" : ""}"
                  data-qna-heart="${esc(r.id)}"
                  aria-pressed="${on ? "true" : "false"}"
                  title="${on ? "표시를 뗍니다" : "이 답 도움 됐어요"}">${on ? "❤️" : "🤍"} ${r.hearts || 0}</button>
        </div>
        <p class="qna-a-t">${esc(r.text)}</p>
      </div>`;
  }

  /* 🔗 참고 칩 + 펼침 */
  function 참고HTML(q) {
    if (!q.ref) return "";
    const 원본 = _rows.find(r => r.id === q.ref && !r.parent);
    if (!원본) return "";                 // 지워진 글 — 여기는 저절로 사라지진 않습니다
    const 열림 = _refOpen.has(q.id);
    const rs = 답들(원본.id);
    return `
      <div class="qna-ref${열림 ? " open" : ""}" data-qna-ref="${esc(q.id)}" role="button" tabindex="0">
        🔗 <span class="qna-ref-t">비슷한 질문: ${esc(원본.text)}</span>
        <span class="qna-t">${esc(언제(원본.at))} · 답 ${rs.length}</span>
      </div>
      ${열림 ? `
        <div class="qna-refbody">
          <p class="qna-ref-q">${esc(원본.text)}</p>
          ${rs.length
            ? rs.map(r => `<div class="qna-ref-a"><span>${esc(r.text)}</span>
                           ${r.hearts ? `<span class="qna-ref-c">❤️ ${r.hearts}</span>` : ""}</div>`).join("")
            : `<p class="qna-ref-a">아직 답이 없던 글이에요.</p>`}
        </div>` : ""}`;
  }

  function 질문HTML(q) {
    const as = 답들(q.id);
    const 쓰는중 = _reply && _reply.parent === q.id;
    return `
      <div class="qna-q${q.답 ? "" : " waiting"}${q.내것 ? " mine" : ""}" data-qna-q="${esc(q.id)}">
        <div class="qna-q-h">
          ${q.내것 ? `<span class="qna-tag mine">내 글</span>` : ""}
          ${q.답 ? `<span class="qna-t">답 ${q.답}</span>`
                 : `<span class="qna-tag wait">답 기다리는 중</span>`}
          <span class="qna-t">${esc(언제(q.at))}</span>
          <span class="qna-sp"></span>
          ${isMine(q.id) ? `<button type="button" class="qna-x" data-qna-del="${esc(q.id)}"
                                    title="내 글 지우기" aria-label="내 글 지우기">✕</button>` : ""}
        </div>
        <p class="qna-q-t">${esc(q.text)}</p>
        ${참고HTML(q)}
        ${as.map(답HTML).join("")}
        ${쓰는중 ? `
          <div class="qna-write">
            <textarea id="qna-reply" class="qna-in" maxlength="${MAX_TEXT}"
                      placeholder="아는 만큼만 적어 주셔도 큰 도움이 돼요">${esc(_reply.text)}</textarea>
            <div class="qna-write-b">
              <button type="button" class="fr-btn ghost" data-qna-act="cancel">취소</button>
              <button type="button" class="fr-btn" data-qna-act="reply">답 달기</button>
            </div>
          </div>`
        : `<button type="button" class="qna-more" data-qna-reply="${esc(q.id)}">+ 답 달기</button>`}
      </div>`;
  }

  function render() {
    const box = el("qna-board");
    if (!box) return;
    const 전체 = 정렬된질문();
    const qs = 전체.slice(0, _보임);
    const 기다림 = 전체.filter(q => q.답 === 0).length;

    const 머리 = `
      <div class="qna-head">
        <span class="qna-sub">🆘 업계 관련한 무엇이든 묻고 답해요‼️ 궁금해요. 도와주세요.🙏</span>
        <span class="qna-sp"></span>
        ${기다림 ? `<span class="qna-tag wait">답 기다리는 중 ${기다림}</span>` : ""}
      </div>`;

    const 목록 = qs.length
      ? qs.map(질문HTML).join("") +
        (전체.length > qs.length
          ? `<button type="button" class="qna-page" data-qna-act="more">
               ↓ 지난 질문 더 보기 (${전체.length - qs.length}개 남음)</button>`
          : "")
      : `<p class="qna-empty">아직 물어본 게 없어요.<br>
         계약이든 플랫폼이든 세금이든, 아래에 편하게 적어 보세요.</p>`;

    /* ★ 스크롤 붙들기 — 표현공부에서 겪은 그것입니다. render() 가 판 속을
       통째로 새로 지어서, ❤️ 를 누르면 목록이 맨 위로 튀었어요. */
    const 굴린자리 = box.querySelector(".qna-list")?.scrollTop || 0;

    box.innerHTML = 머리 + `<div class="qna-list">${목록}</div>` + `
      ${_pickRef ? `
        <div class="qna-pin">🔗 "${esc(_pickRef.text.slice(0, 20))}${_pickRef.text.length > 20 ? "…" : ""}"
          참고를 달아서 올려요
          <button type="button" class="qna-x" data-qna-unpin="1" aria-label="참고 떼기">✕</button>
        </div>` : ""}
      <div class="qna-ask">
        <input type="text" id="qna-new" maxlength="${MAX_TEXT}" autocomplete="off"
               placeholder="계약·인세·투고·플랫폼·세금 무엇이든">
        <button type="button" class="qna-send" data-qna-act="ask"
                aria-label="올리기" title="올리기">↑</button>
      </div>
      <div class="qna-sug" id="qna-sug" hidden></div>
      <p class="qna-note">🔒 이름은 서버에도 남지 않아요 · 여기 글은 사라지지 않습니다</p>`;

    if (굴린자리) {
      const 목록칸 = box.querySelector(".qna-list");
      if (목록칸) 목록칸.scrollTop = 굴린자리;
    }
  }

  /* 쓰는 중 제안 — 전체 render() 없이 제 상자 속만 (초점·한글 조합 보호) */
  function 제안그리기() {
    const box = el("qna-sug");
    const inp = el("qna-new");
    if (!box || !inp) return;
    if (_pickRef) { box.hidden = true; return; }
    const hit = 비슷한질문(inp.value);
    if (!hit.length) { box.hidden = true; return; }
    box.innerHTML = `
      <div class="qna-sug-h">💡 비슷한 질문이 있었어요 — 먼저 볼래요?</div>
      ${hit.map(h => `
        <button type="button" class="qna-sug-i" data-qna-sug="${esc(h.id)}">
          🔗 <span class="qna-sug-t">${esc(h.text)}</span>
          <span class="qna-t">답 ${h.답} · ${esc(언제(h.at))}</span>
        </button>`).join("")}
      <div class="qna-sug-f">누르면 새 글에 🔗 참고 고리가 달려요 · 그냥 올려도 돼요</div>`;
    box.hidden = false;
  }

  /* =====================================================================
     서버 — ★ 판을 열 때에만 듣습니다 (안 여는 사람에게는 한 글자도 안 감)
     ===================================================================== */
  function listen() {
    if (_ref || !window.db) return;
    _ref = window.db.ref("qna");
    _ref.on("value", snap => {
      const raw = snap.val() || {};
      const list = [];
      Object.keys(raw).forEach(id => {
        const r = normalize(id, raw[id]);
        if (r) list.push(r);
      });
      /* 부모가 사라진 답은 걷어냅니다 */
      const ids = new Set(list.map(r => r.id));
      _rows = list.filter(r => !(r.parent && !ids.has(r.parent)));
      render();
    });
  }

  /* ★ sweep() 이 없습니다 — 여기 글은 안 사라집니다 (콩 확정 2026-08-28).
     업계 정보는 몸값이 오래가고, 같은 질문을 나중 사람도 찾아볼 수 있어야
     해서요. 표현공부(14일)와 갈리는 지점입니다. */

  async function 올리기(text, parent, refId) {
    const t = String(text || "").trim().slice(0, MAX_TEXT);
    if (!t || _busy || !window.db) return;
    _busy = true;
    try {
      const ref = window.db.ref("qna").push();
      const 줄 = { text: t, at: Date.now(), hearts: 0 };
      if (parent) 줄.parent = parent;
      if (refId) 줄.ref = refId;
      await ref.set(줄);
      remember(MINE_KEY, ref.key);      // ← 이 기기에만
      window.dockMarkNew?.("qna");      // 알약에 붉은 점 (내 기기는 빼고)
      /* ★ [2026-08-28] 여기서 한 번 더 그립니다.
         set() 이 끝나면 듣고 있던 쪽이 먼저 깨어나 화면을 그리는데,
         그때는 아직 remember() 전이라 **방금 올린 내 글에 "내 글" 표시가
         안 붙고 ✕ 도 안 뜹니다.** 다음에 누가 글을 올려야 비로소 붙어요.
         표현공부도 같은 결인데, 거긴 14일이면 사라지는 자리라 눈에 덜
         띄었습니다. 여기는 글이 안 사라지니 제대로 붙여 둡니다. */
      render();
    } catch (e) {
      alert("올리지 못했어요. 연결을 확인해 주세요.");
    } finally { _busy = false; }
  }

  async function 지우기(id) {
    if (!isMine(id)) return;
    if (!confirm("지울까요? 되돌릴 수 없어요.")) return;
    try {
      await window.db.ref("qna/" + id).remove();
      /* 질문을 지우면 그 아래 답도 함께 (부모 없는 답은 나뒹굽니다) */
      for (const r of _rows.filter(x => x.parent === id)) {
        try { await window.db.ref("qna/" + r.id).remove(); } catch (e) {}
        forget(MINE_KEY, r.id); forget(HEART_KEY, r.id);
      }
      forget(MINE_KEY, id); forget(HEART_KEY, id);
    } catch (e) {
      alert("지우지 못했어요.");
    }
  }

  /** ❤️ 이 답 도움 됐어요 — 여러 사람이 겹쳐 붙습니다. 내 것은 다시 눌러 뗍니다. */
  async function 하트(id) {
    const r = _rows.find(x => x.id === id);
    if (!r || !window.db) return;
    const 붙임 = didHeart(id);
    try {
      await window.db.ref("qna/" + id + "/hearts")
        .transaction(v => Math.max(0, (Number(v) || 0) + (붙임 ? -1 : 1)));
      if (붙임) forget(HEART_KEY, id); else remember(HEART_KEY, id);
      render();
    } catch (e) {}
  }

  /* =====================================================================
     손가락 — ★ 판 안쪽 상자에 답니다 (겉껍데기에 달면 클릭이 통째로 죽어요)
     ===================================================================== */
  function bind() {
    const host = el("dock-body-qna");
    if (!host || _bound) return;
    _bound = true;

    host.addEventListener("click", (e) => {
      const del = e.target.closest("[data-qna-del]");
      if (del) { 지우기(del.dataset.qnaDel); return; }

      const ht = e.target.closest("[data-qna-heart]");
      if (ht) { 하트(ht.dataset.qnaHeart); return; }

      const rf = e.target.closest("[data-qna-ref]");
      if (rf) {
        const id = rf.dataset.qnaRef;
        if (_refOpen.has(id)) _refOpen.delete(id); else _refOpen.add(id);
        render();
        return;
      }

      const sug = e.target.closest("[data-qna-sug]");
      if (sug) {
        const q = _rows.find(r => r.id === sug.dataset.qnaSug);
        if (q) {
          _pickRef = { id: q.id, text: q.text };
          const keep = el("qna-new")?.value || "";   // 쓰던 글 지키기
          render();
          const inp = el("qna-new");
          if (inp) { inp.value = keep; inp.focus(); }
        }
        return;
      }
      const unpin = e.target.closest("[data-qna-unpin]");
      if (unpin) {
        _pickRef = null;
        const keep = el("qna-new")?.value || "";
        render();
        const inp = el("qna-new");
        if (inp) { inp.value = keep; inp.focus(); }
        return;
      }

      const rep = e.target.closest("[data-qna-reply]");
      if (rep) {
        _reply = { parent: rep.dataset.qnaReply, text: "" };
        const q = _rows.find(r => r.id === rep.dataset.qnaReply);
        if (q?.ref) _refOpen.add(q.id);
        render();
        el("qna-reply")?.focus();
        return;
      }

      const act = e.target.closest("[data-qna-act]");
      if (!act) return;
      const a = act.dataset.qnaAct;
      if (a === "cancel") { _reply = null; render(); return; }
      if (a === "more")   { _보임 += PAGE; render(); return; }
      if (a === "reply" && _reply) {
        const t = String(el("qna-reply")?.value || "").trim();
        const p = _reply.parent;
        _reply = null;
        올리기(t, p).then(render);
        return;
      }
      if (a === "ask") {
        const inp = el("qna-new");
        const t = String(inp?.value || "").trim();
        if (!t) return;
        if (inp) inp.value = "";
        const rid = _pickRef?.id || "";
        _pickRef = null;
        올리기(t, "", rid);
      }
    });

    /* 엔터로 바로 — 한글 조합 중은 무시합니다 (이 방에서 여러 번 데인 자리) */
    host.addEventListener("keydown", (e) => {
      const t = e.target;
      if (!t || (t.id !== "qna-new" && t.id !== "qna-reply")) return;
      if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (t.id === "qna-new") {
        const v = String(t.value || "").trim();
        if (!v) return;
        t.value = "";
        const rid = _pickRef?.id || "";
        _pickRef = null;
        올리기(v, "", rid);
      } else if (_reply) {
        const v = String(t.value || "").trim();
        const p = _reply.parent;
        _reply = null;
        올리기(v, p).then(render);
      }
    });

    /* 답 쓰던 내용은 다시 그려도 살아남게 */
    host.addEventListener("input", (e) => {
      if (e.target?.id === "qna-reply" && _reply) _reply.text = e.target.value;
      if (e.target?.id === "qna-new") 제안그리기();
    });
  }

  /** 알약 판이 열릴 때 부릅니다 */
  function openQna() {
    const host = el("dock-body-qna");
    if (host && !el("qna-board")) {
      host.innerHTML = `<div class="qna-board" id="qna-board"></div>`;
    }
    bind();
    listen();
    render();
  }
  window.openQna = openQna;
})();
