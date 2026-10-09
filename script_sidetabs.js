/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 📑 옆 탭 (script_sidetabs.js) — 2026-10-09 콩
   ---------------------------------------------------------------------
   아래 알약 줄이 너무 길어져서, **자주 쓰진 않지만 열어 두고 찬찬히 읽는**
   메뉴를 화면 오른쪽 끝 세로 탭으로 뺍니다 (🙋‍♂️ Member 탭과 같은 결).

     · 대상: 📢 공지 · 📓 표현 공부 · 🤔 Q&A   (🏢 품평은 본방에 켤 때 같이 — 혼자 방엔 품평이 없어요)
     · 폭 400px. 열리면 카드 마당이 그만큼 좁아져 카드가 다시 줄을 맞춥니다.
     · **한 번에 하나만** 열립니다 — Member 명단(250px)까지 포함해서요.
     · 탭은 Member 탭 **아래로** 차례로 쌓입니다.
     · 옮긴 메뉴의 아래 알약은 감춥니다 (html.sidetabs-on).

   [어떻게 옮기나 — 새로 그리지 않습니다]
     · 표현 공부 · Q&A : 알약 판의 알맹이(#dock-body-help / -qna)를 **통째로 이 칸에 옮겨** 옵니다.
       그리는 쪽(openHelp/openQna)은 그 id 만 보고 그려서, 어디 있든 똑같이 돕니다.
       닫으면 듣기를 끊습니다(closeHelp/closeQna) — 알약 판과 같은 통신량 원칙.
     · 공지 : 가운데 창(#notice-modal)을 옮기지 않고 **CSS 로 오른쪽 칸 자리에 앉힙니다**
       (html.side-notice). 공지 CSS 가 #notice-modal 밑으로 묶여 있어 떼어 내면 모양이 깨져요.

   ★ SIDE_MAIN_ON — 지금은 **혼자 방에서만** 켭니다 (새 기능은 혼자 방 먼저 — 콩).
     본방에 켤 때는 이 값을 true 로, 그리고 TABS 에 pub 을 넣습니다.
   ===================================================================== */
(function () {
  const SIDE_MAIN_ON = true;   // [2026-10-09 콩] 혼자 방 시험을 마치고 본방에도 켰습니다
  if (!window.SOLO && !SIDE_MAIN_ON) return;

  const W = 400;
  const TABS = [
    { id: "notice", label: "📢 공지" },
    /* [2026-10-09 콩] 차례 — 본방: 공지·품평·표현 공부·Q&A / 혼자 방: 공지·Member·표현 공부·Q&A
       (혼자 방엔 품평이 없고, 그 자리에 Member 탭이 끼어듭니다 — 자리맞추기 가 틈을 벌려요) */
    { id: "pub",    label: "🏢 출판사 품평", open: "openPubReview", close: "closePubReview", main: true },
    { id: "help",   label: "📓 표현 공부", open: "openHelp", close: "closeHelp" },
    { id: "qna",    label: "🤔 Q&A",      open: "openQna",  close: "closeQna" }
  ].filter(t => !(t.main && window.SOLO));
  const el = (id) => document.getElementById(id);
  const root = document.documentElement;
  const OPEN_KEY = "sideTabOpen";
  let _cur = "";

  /* 공지 여닫기 원본을 쥐어 둡니다 — 채팅 머리말의 [📢 공지] 단추도 옆 탭으로 오게 */
  let _nOpen = null, _nClose = null;
  function 공지가로채기() {
    if (_nOpen || typeof window.openNoticeBoard !== "function") return;
    _nOpen = window.openNoticeBoard; _nClose = window.closeNoticeBoard;
    window.openNoticeBoard  = () => 열기("notice");
    window.closeNoticeBoard = () => { if (_cur === "notice") 닫기(); else _nClose?.(); };
  }

  function 만들기() {
    if (el("side-tabs")) return true;
    if (!document.body || !el("dock-bar")) return false;
    const box = document.createElement("aside");
    box.id = "side-tabs"; box.className = "side-tabs";
    box.innerHTML =
      `<div class="side-tabs-col" id="side-tabs-col">` +
      TABS.map(t => `<button type="button" class="member-tab side-tab" id="side-tab-${t.id}" data-side="${t.id}"
          aria-expanded="false"><span>${t.label}</span><i class="side-tab-dot hidden" id="side-dot-${t.id}"></i></button>`).join("") +
      `</div>
       <div class="side-pane" id="side-pane">
         <div class="side-pane-head"><b id="side-pane-title"></b>
           <button type="button" class="dock-x" id="side-pane-x" aria-label="닫기" title="닫기">✕</button></div>
         <div class="side-pane-body dock-body" id="side-pane-body"></div>
       </div>`;
    document.body.appendChild(box);
    box.addEventListener("click", (e) => {
      const t = e.target.closest("[data-side]");
      if (t) { const id = t.dataset.side; if (_cur === id) 닫기(); else 열기(id); return; }
      if (e.target.closest("#side-pane-x")) 닫기();
    });
    root.classList.add("sidetabs-on");
    /* Member 명단이 열리면 이쪽을 닫습니다 (한 번에 하나) */
    document.addEventListener("click", (e) => {
      if (e.target.closest("#member-tab")) setTimeout(() => {
        if (root.classList.contains("member-open") && _cur) 닫기();
      }, 0);
    }, true);
    /* 알약의 붉은 점을 탭에 그대로 비춥니다 */
    TABS.forEach(t => {
      const src = el("dock-dot-" + t.id), dst = el("side-dot-" + t.id);
      if (!src || !dst) return;
      const 비추기 = () => dst.classList.toggle("hidden", src.classList.contains("hidden") || _cur === t.id);
      new MutationObserver(비추기).observe(src, { attributes: true, attributeFilter: ["class"] });
      비추기();
    });
    let 기억 = "";
    try { 기억 = window.AppStore?.getItem(OPEN_KEY) || ""; } catch (e) {}
    if (기억 && TABS.some(t => t.id === 기억) && !root.classList.contains("member-open")) setTimeout(() => 열기(기억, true), 300);
    return true;
  }

  function 자리맞추기() {
    const box = el("side-tabs"), 마당 = document.querySelector(".cards-area");
    if (!box || !마당) return;
    const r = 마당.getBoundingClientRect();
    if (r.height < 40) return;
    const top = Math.round(r.top), h = Math.round(r.height);
    box.style.top = top + "px"; box.style.height = h + "px";
    root.style.setProperty("--side-top", top + "px");
    root.style.setProperty("--side-h", h + "px");
    /* 혼자 방 — 공지 탭 **아래에 Member 탭**이 끼어듭니다. Member 탭을 공지 키만큼 내리고,
       그다음 탭(표현 공부)을 Member 키만큼 더 내려서 틈을 벌려요. */
    const m = el("member-tab"), n = el("side-tab-notice"), 다음 = el("side-tab-" + (TABS[1] || {}).id);
    if (m && n && 다음) {
      m.style.marginTop = (Math.round(n.getBoundingClientRect().height) + 6) + "px";
      다음.style.marginTop = (Math.round(m.getBoundingClientRect().height) + 6) + "px";
    }
  }
  window.addEventListener("resize", 자리맞추기);

  function 카드다시() {
    try { window.relayoutCards?.(); } catch (e) {}
    setTimeout(() => { try { window.relayoutCards?.(); } catch (e) {} }, 280);
  }

  function 열기(id, 처음) {
    const t = TABS.find(x => x.id === id);
    if (!t || !el("side-tabs")) return;
    if (_cur && _cur !== id) 닫기(true);
    /* Member 명단이 열려 있으면 먼저 닫습니다 */
    if (root.classList.contains("member-open")) el("member-tab")?.click();
    _cur = id;
    root.classList.add("side-open");
    el("side-pane-title").textContent = t.label;
    if (id === "notice") {
      root.classList.add("side-notice");
      _nOpen?.();
    } else {
      try { window.dockCloseOne?.(id); } catch (e) {}
      const body = el("dock-body-" + id);
      if (body) el("side-pane-body").appendChild(body);
      window[t.open]?.();
      window.dockSeen?.(id);
    }
    TABS.forEach(x => el("side-tab-" + x.id)?.setAttribute("aria-expanded", String(x.id === id)));
    el("side-dot-" + id)?.classList.add("hidden");
    if (!처음) { try { window.AppStore?.setItem(OPEN_KEY, id); } catch (e) {} }
    자리맞추기(); 카드다시();
  }

  function 닫기(바꾸는중) {
    const id = _cur, t = TABS.find(x => x.id === id);
    if (!t) return;
    _cur = "";
    if (id === "notice") {
      _nClose?.();
      root.classList.remove("side-notice");
    } else {
      window[t.close]?.();
      window.dockSeen?.(id);
      const body = el("dock-body-" + id), 집 = el("dock-panel-" + id);
      if (body && 집) 집.appendChild(body);
    }
    el("side-tab-" + id)?.setAttribute("aria-expanded", "false");
    if (바꾸는중) return;
    root.classList.remove("side-open");
    try { window.AppStore?.setItem(OPEN_KEY, ""); } catch (e) {}
    카드다시();
  }

  /* Esc — 공지 쪽 손가락은 창만 감추고 가서, 이쪽 칸도 같이 닫아 줍니다 */
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && _cur === "notice") setTimeout(() => { if (_cur === "notice") 닫기(); }, 0); });

  const 기다림 = setInterval(() => {
    공지가로채기();
    if (만들기()) 자리맞추기();
  }, 1000);
  void 기다림;

  window.sideTabOpen = 열기;
  window.sideTabClose = () => 닫기();
})();
