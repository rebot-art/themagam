/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — ⚙️↗ 비밀방을 따로 창으로 (script_srpop.js) — 2026-10-02 콩
   ---------------------------------------------------------------------
   [무엇인가]
   비밀방 판 머리말의 ↗ 를 누르면, 비밀방이 **작은 별도 창**으로 빠져나가
   집필 프로그램 옆에 둘 수 있습니다. 창을 닫으면 제자리로 돌아와요.

   [어떻게 — 새로 그리지 않고 **옮깁니다**]
   비밀방 판의 속(#dock-body-sroom)을 통째로 새 창의 문서로 옮겨 심습니다.
   붙어 있던 손가락(클릭·엔터·붙여넣기)과 듣고 있던 서버 구독이 그대로
   따라와요 — 구독은 **본 탭 하나**뿐이라 통신량은 변하지 않습니다.
   (새로 그리면 script_sroom.js 가 지키는 "글칸을 다시 만들지 말 것" 원칙이
    깨지고, 2026-08-13 한글 자소 분리 사고 자리로 되돌아갑니다.)

   [두 가지 창]
     ① 문서 PiP (documentPictureInPicture) — 크롬·엣지·웨일 116+.
        **항상 다른 창 위에** 떠요 (콩이 바란 그것). 폭은 본방 비밀방과
        같은 352px 로 고정하고, 세로만 자유롭게.
     ② 보통 팝업 (window.open) — 사파리·파이어폭스. 항상 위는 안 되지만
        따로 창으로 두는 것까지는 같습니다.

   [다른 파일이 알아야 하는 것 — window.srpopDoc()]
   옮겨 간 뒤에는 document.getElementById("sroom-in") 이 **못 찾습니다**
   (다른 문서에 있으니까요). 그래서 비밀방·스티커·그림 올리기는 아이디를
   찾을 때 이 창의 문서도 함께 봅니다 — 각 파일의 el()/byId() 참고.

   [폰] 폰 브라우저는 둘 다 없거나 어색해서 ↗ 를 아예 안 답니다.
   ===================================================================== */
(function () {
  "use strict";

  const W = 352;             // 본방 비밀방 폭 (styles.css #dock-panel-sroom)
  const H = 560;

  let _win = null;           // 열려 있는 창 (PiP 또는 팝업)
  let _doc = null;           // 그 창의 문서
  let _mo = null;            // 테마가 바뀌면 따라가는 눈
  let _restoring = false;

  const canPip = () => typeof window.documentPictureInPicture?.requestWindow === "function";
  const onPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !canPip();

  window.srpopDoc  = () => (_doc && _win && !_win.closed) ? _doc : null;
  window.srpopOpen = () => !!window.srpopDoc();

  /* ---------------------------------------------------------------
     머리말에 ↗ 단추 달기 — 판은 script_dock.js 가 만드니, 생긴 뒤에
     --------------------------------------------------------------- */
  function mountButton() {
    if (onPhone()) return;
    const head = document.querySelector("#dock-panel-sroom .dock-head");
    if (!head || head.querySelector(".dock-pop")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dock-pop";
    b.dataset.sroomPop = "1";
    b.setAttribute("aria-label", "따로 창으로");
    b.title = canPip() ? "따로 창으로 — 항상 다른 창 위에 떠요" : "따로 창으로";
    b.textContent = "↗";
    head.insertBefore(b, head.querySelector(".dock-x"));
    b.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
    /* 머리말이 끌기 손잡이입니다 — script_dock.js 가 document 의 pointerdown
       에서 머리말을 잡아 setPointerCapture 를 걸어서, 그대로 두면 click 이
       단추가 아니라 머리말로 가 버려요. 여기서 끊습니다. */
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  /* ---------------------------------------------------------------
     새 창 꾸미기 — 본 문서의 스타일·테마를 그대로
     --------------------------------------------------------------- */
  function dressUp(doc) {
    /* 스타일 — <link>·<style> 을 그대로 복사 (styles.css · 구글 폰트) */
    document.querySelectorAll('head link[rel="stylesheet"], head style').forEach(n => {
      doc.head.appendChild(n.cloneNode(true));
    });
    const st = doc.createElement("style");
    st.id = "srpop-style";
    st.textContent = `
      html, body { height: 100%; margin: 0; overflow: hidden; }
      body { background: var(--bg, #fff); color: var(--text, #222); }
      #srpop-host { box-sizing: border-box; width: ${W}px; max-width: 100vw; height: 100vh;
                    margin: 0 auto; padding: 6px 8px 8px; display: flex; flex-direction: column; }
      #srpop-host > #dock-body-sroom { flex: 1 1 auto; min-height: 0; overflow: auto;
                    display: flex; flex-direction: column; }
    `;
    doc.head.appendChild(st);
    syncTheme(doc);
    /* 스티커의 흔들림 필터 — 다른 문서에서는 url(#crayon-rough) 를 못 찾아
       스티커가 아예 안 그려집니다. 같이 심어 둡니다. */
    /* 필터는 스티커를 처음 그릴 때 느긋하게 생깁니다 — 아직 없으면 한 번
       그려 보게 해서 만들어 두고 베낍니다 */
    if (!document.getElementById("sticker-filter-host")) {
      try { const id = window.STICKERS?.[0]?.id; if (id) window.stickerHtml?.(`[[스티커:${id}]]`); } catch (e) {}
    }
    const f = document.getElementById("sticker-filter-host");
    if (f) doc.body.appendChild(f.cloneNode(true));
  }

  /* 테마는 <html> 의 속성(data-*)과 인라인 변수(style)에 다 있습니다 */
  function syncTheme(doc) {
    const src = document.documentElement, dst = doc.documentElement;
    [...src.attributes].forEach(a => { try { dst.setAttribute(a.name, a.value); } catch (e) {} });
    doc.body.className = document.body.className;
  }

  /* ---------------------------------------------------------------
     스크롤 자리 지키기 (2026-10-03 콩 "켤 때·되돌릴 때 채팅이 맨 위로 올라가")
     ---------------------------------------------------------------
     요소를 다른 문서로 옮기면 브라우저가 scrollTop 을 0 으로 되돌립니다.
     옮기기 전에 "바닥을 보고 있었나 / 어디까지 내렸나" 를 적어 두고,
     옮긴 뒤(레이아웃이 한 박자 뒤에 잡혀서 두 번) 되돌립니다. */
  function 스크롤기억(body) {
    const log = body?.querySelector?.(".sr-log");
    if (!log) return null;
    const 바닥 = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    return { 바닥, top: log.scrollTop };
  }
  function 스크롤되살리기(body, 기억) {
    const log = body?.querySelector?.(".sr-log");
    if (!log || !기억) return;
    const 놓기 = () => { log.scrollTop = 기억.바닥 ? log.scrollHeight : 기억.top; };
    놓기();
    requestAnimationFrame(놓기);
    setTimeout(놓기, 120);
  }

  /* ---------------------------------------------------------------
     열기 / 되돌리기
     --------------------------------------------------------------- */
  async function open() {
    if (window.srpopOpen()) return;
    const body = document.getElementById("dock-body-sroom");
    if (!body) return;

    let win = null;
    /* ① 문서 PiP — 안 되면(지원 안 함 · 거절) ② 보통 팝업으로 내려갑니다 */
    if (canPip()) {
      try {
        win = await window.documentPictureInPicture.requestWindow({ width: W + 16, height: H });
      } catch (e) { win = null; }
    }
    if (!win) {
      try {
        win = window.open("", "themagam-sroom",
          `popup=yes,width=${W + 16},height=${H},resizable=yes,scrollbars=no`);
        if (win) {
          win.document.open();
          win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>⚙️ 비밀방</title></head><body></body></html>`);
          win.document.close();
        }
      } catch (e) { win = null; }
    }
    if (!win) {
      alert("따로 창을 열지 못했어요 — 브라우저가 팝업을 막았을 수 있어요.");
      return;
    }

    _win = win; _doc = win.document;
    dressUp(_doc);

    const host = _doc.createElement("div");
    host.id = "srpop-host";
    _doc.body.appendChild(host);
    const 스크롤 = 스크롤기억(body);
    host.appendChild(body);               // ★ 옮깁니다 — 손가락·구독이 따라와요
    스크롤되살리기(body, 스크롤);

    /* 본 탭의 판은 "따로 보는 중" 한 줄만 남깁니다 */
    const panel = document.getElementById("dock-panel-sroom");
    if (panel) {
      panel.classList.add("is-popped");
      const ph = document.createElement("div");
      ph.className = "dock-popped-note";
      ph.innerHTML = `↗ 따로 창에서 보는 중 <button type="button" data-sroom-unpop="1">되돌리기</button>`;
      ph.querySelector("button").addEventListener("click", close);
      panel.appendChild(ph);
    }

    /* 테마를 바꾸면 창도 따라갑니다 */
    _mo = new MutationObserver(() => { if (window.srpopDoc()) syncTheme(_doc); });
    _mo.observe(document.documentElement, { attributes: true });

    /* Ctrl+V 그림 — 그 창의 paste 를 본 문서로 넘겨 줍니다
       (script_imgup.js 는 본 문서의 paste 만 듣고 있어서) */
    _doc.addEventListener("paste", (e) => {
      try {
        const has = [...(e.clipboardData?.items || [])].some(i => /^image\//.test(i.type));
        if (!has) return;
        const ev = new ClipboardEvent("paste", { clipboardData: e.clipboardData, bubbles: true, cancelable: true });
        document.dispatchEvent(ev);
        if (ev.defaultPrevented) e.preventDefault();
      } catch (err) {}
    });

    /* 창이 닫히면(✕ · 브라우저가 닫음) 제자리로 */
    win.addEventListener("pagehide", restore);
    win.addEventListener("unload",   restore);
    /* 본 탭을 닫으면 창도 같이 */
    window.addEventListener("pagehide", close);

    setTimeout(() => { try { _doc.getElementById("sroom-in")?.focus(); } catch (e) {} }, 80);
  }

  function restore() {
    if (_restoring) return;
    _restoring = true;
    try {
      const body = (_doc && _doc.getElementById("dock-body-sroom")) || null;
      const panel = document.getElementById("dock-panel-sroom");
      const 스크롤 = 스크롤기억(body);
      if (body && panel) panel.insertBefore(body, panel.querySelector(".dock-popped-note"));
      스크롤되살리기(body, 스크롤);
      panel?.querySelector(".dock-popped-note")?.remove();
      panel?.classList.remove("is-popped");
      try { _mo?.disconnect(); } catch (e) {}
    } catch (e) {}
    _mo = null; _win = null; _doc = null;
    _restoring = false;
    window.removeEventListener("pagehide", close);
  }

  function close() {
    const w = _win;
    restore();                 // 먼저 되가져오고
    try { if (w && !w.closed) w.close(); } catch (e) {}
  }

  function toggle() { window.srpopOpen() ? close() : open(); }
  window.srpopToggle = toggle;
  window.srpopClose  = close;

  /* 비밀방 판을 닫으면(알약·✕·퇴장) 따로 창도 같이 닫습니다 —
     closeSroom 을 감쌉니다 (이 파일은 script_sroom.js 뒤에 실립니다) */
  const origClose = window.closeSroom;
  window.closeSroom = function () {
    try { close(); } catch (e) {}
    return typeof origClose === "function" ? origClose.apply(this, arguments) : undefined;
  };

  /* 판은 load 뒤 dock 이 짓습니다 — 조금 기다렸다 달고, 못 찾았으면 한 번 더 */
  window.addEventListener("load", () => {
    setTimeout(mountButton, 700);
    setTimeout(mountButton, 2500);
  });
})();
