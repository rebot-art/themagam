/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_links.js — 🔗 LINK (2026-10-10 — 콩)
   ---------------------------------------------------------------------
   더마감과 관련한 링크(열흘 리포트 · 가이드 · 오픈카톡 · 설문…)를 한 줄씩
   걸어 두는 자리. **오른쪽 옆 탭 맨 아래**, 다른 탭들과 떨어져서 앉습니다
   (script_sidetabs.js 의 bottom 표시 → CSS margin-top:auto).

   [누가]  보는 건 방 식구 모두 · 올리고 지우는 건 **방장만** (운영진도 아님 — 콩)
   [서버]  links/{id} = { title, url, memo?, icon?, at }   — 몇 백 자
   [통신량] 탭을 열 때 한 번 듣고(on), 닫으면 끊습니다(off). 공지·Q&A 와 같은 원칙.
   [새 링크 점] 방장이 올리면 newmark/links 에 시각을 찍고(dockMarkNew), 탭의 점이 켜집니다.
   [주소]  http/https 만 받습니다. 새 창(↗)으로 열려요.
   ===================================================================== */
(function () {
  "use strict";
  const ADMIN_UID = "ABM1ZJndrqaV3gpYUs03SV9qglr1";
  const MAX_TITLE = 40, MAX_URL = 500, MAX_MEMO = 60, MAX_ICON = 4;
  const el = (id) => document.getElementById(id);
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? "")) : String(s ?? ""));
  const 방장 = () => { try { return firebase.auth().currentUser?.uid === ADMIN_UID; } catch (e) { return false; } };

  let _rows = [];
  let _ref = null;
  let _box = null;

  function 집(url) { try { return new URL(url).host.replace(/^www\./, ""); } catch (e) { return ""; } }
  function 주소괜찮나(u) { try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; } catch (e) { return false; } }

  function render() {
    if (!_box) return;
    const 줄 = _rows.map(r => `
      <a class="lk-row" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" data-lk="${esc(r.id)}">
        <span class="lk-ic">${esc(r.icon || "🔗")}</span>
        <span class="lk-m">
          <span class="lk-t">${esc(r.title)}</span>
          <span class="lk-u">${esc(집(r.url) || r.url)}</span>
          ${r.memo ? `<span class="lk-memo">${esc(r.memo)}</span>` : ""}
        </span>
        <span class="lk-go" aria-hidden="true">↗</span>
        ${방장() ? `<button type="button" class="lk-x" data-lk-del="${esc(r.id)}" aria-label="링크 지우기" title="지우기">✕</button>` : ""}
      </a>`).join("");
    const 빈 = _rows.length ? "" : `<p class="lk-empty">아직 걸어 둔 링크가 없어요.</p>`;
    const 올리기 = 방장() ? `
      <div class="lk-add">
        <div class="lk-add-h">🔗 링크 올리기 (방장)</div>
        <input type="text" id="lk-title" maxlength="${MAX_TITLE}" placeholder="제목 — 예) 열흘 리포트" autocomplete="off">
        <input type="url"  id="lk-url"   maxlength="${MAX_URL}"   placeholder="주소 — https://…" autocomplete="off">
        <input type="text" id="lk-memo"  maxlength="${MAX_MEMO}"  placeholder="한 줄 설명 (선택)" autocomplete="off">
        <div class="lk-add-r">
          <input type="text" id="lk-icon" maxlength="${MAX_ICON}" placeholder="아이콘 (선택, 없으면 🔗)" autocomplete="off">
          <button type="button" class="ghost-btn compact primary" id="lk-send">올리기</button>
        </div>
        <p class="lk-msg" id="lk-msg"></p>
      </div>` : "";
    _box.innerHTML = `<div class="lk-list">${줄}${빈}</div>${올리기}`;
  }

  function say(t, bad) { const m = el("lk-msg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); } }

  async function 올리기() {
    if (!방장() || !window.db) return;
    const title = String(el("lk-title")?.value || "").trim().slice(0, MAX_TITLE);
    const url   = String(el("lk-url")?.value || "").trim().slice(0, MAX_URL);
    const memo  = String(el("lk-memo")?.value || "").trim().slice(0, MAX_MEMO);
    const icon  = String(el("lk-icon")?.value || "").trim().slice(0, MAX_ICON);
    if (!title) return say("제목을 적어 주세요.", true);
    if (!주소괜찮나(url)) return say("주소는 http:// 또는 https:// 로 시작해야 해요.", true);
    const 짐 = { title, url, at: Date.now() };
    if (memo) 짐.memo = memo;
    if (icon) 짐.icon = icon;
    try {
      await window.db.ref("links").push(짐);
      window.dockMarkNew?.("links");             // 탭에 점 (내 기기는 빼고)
      ["lk-title", "lk-url", "lk-memo", "lk-icon"].forEach(id => { const i = el(id); if (i) i.value = ""; });
      say("올렸어요.");
    } catch (e) { say("올리지 못했어요 — 방장만 올릴 수 있어요.", true); }
  }

  async function 지우기(id) {
    if (!방장() || !window.db || !id) return;
    const r = _rows.find(x => x.id === id);
    if (!confirm(`「${r ? r.title : ""}」 링크를 지울까요?`)) return;
    try { await window.db.ref("links/" + id).remove(); } catch (e) {}
  }

  function bind(box) {
    if (box.dataset.lkBound === "true") return;
    box.dataset.lkBound = "true";
    box.addEventListener("click", (e) => {
      const x = e.target.closest("[data-lk-del]");
      if (x) { e.preventDefault(); 지우기(x.dataset.lkDel); return; }
      if (e.target.closest("#lk-send")) { 올리기(); }
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing && e.target.closest("#lk-url, #lk-title, #lk-memo, #lk-icon")) { e.preventDefault(); 올리기(); }
    });
  }

  /** 옆 탭이 부릅니다 — 칸(#side-pane-body) 안에 그립니다 */
  function openLinks() {
    const pane = el("side-pane-body");
    if (!pane) return;
    let box = el("links-board");
    if (!box) { box = document.createElement("div"); box.id = "links-board"; box.className = "dock-body links-board"; }
    pane.appendChild(box);
    _box = box;
    bind(box);
    render();
    if (!_ref && window.db) {
      _ref = window.db.ref("links");
      _ref.on("value", snap => {
        const raw = snap.val() || {};
        _rows = Object.keys(raw).map(id => ({ id, ...raw[id] }))
          .filter(r => r && r.title && r.url)
          .sort((a, b) => Number(b.at || 0) - Number(a.at || 0));   // 최신이 위
        render();
      }, () => {});
    }
  }
  function closeLinks() {
    try { _ref && _ref.off(); } catch (e) {}
    _ref = null;
    const box = el("links-board");
    if (box) box.remove();                       // 다음 탭의 알맹이와 섞이지 않게
    _box = null;
  }
  window.openLinks = openLinks;
  window.closeLinks = closeLinks;
})();
