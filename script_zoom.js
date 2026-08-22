/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 🔍 화면 확대·축소 (script_zoom.js, 2026-08-15)

   ※ 2026-08-22 에 **방식을 통째로 뒤집었습니다.** 아래는 지금 동작이고,
     옛 방식은 뒤집힌방() 아래 else 가지에 그대로 살아 있습니다.

   [지금 무엇이 어떻게 커지나 — 셋이 따로 놉니다]
     ① 접속자 카드 마당  머리말의 [− 100% +]  70~130% · 5% · 사람이 고름
     ② 하단 메뉴 창(판)  설정 › 💬 채팅 슬라이더 70~130% · 사람이 고름
     ③ 머리말 메뉴 창    **늘 105% 고정** (CSS --modal-zoom)
   머리말·알약 줄은 어느 쪽도 안 따라갑니다 — 늘 100% 입니다.

   [글자 크기 조절과 무엇이 다른가]
   설정의 [− 18px +] 는 **채팅 글자만** 굵어집니다. 카드도 알약도 그대로.
   사람이 늘어 카드가 화면에 안 들어올 때는 도움이 안 돼요. ①은 카드를
   통째로 줄여 한 줄에 더 많이 담습니다. 하는 일이 달라 둘 다 둡니다.

   [왜 CSS zoom 인가]
   transform: scale 은 그림만 늘리고 자리는 그대로라, 스크롤 끝과 클릭
   좌표가 어긋납니다. zoom 은 배치를 다시 계산해서 그런 일이 없어요.
   크롬·사파리·파이어폭스 모두 씁니다.

   ★★★ [자가 셋입니다 — 좌표를 재는 다른 파일들에게]
   마우스 좌표·getBoundingClientRect 는 **그려진 뒤**의 화면 값이고,
   style.left·offsetWidth 는 **그리기 전**의 요소 값입니다. 섞어 쓰면
   100% 에서만 멀쩡하고 배율에서만 어긋나 찾기가 아주 어렵습니다.
   화면 값을 요소 값으로 옮길 때 **무엇으로 나눌지**는 이렇게 갈립니다 —

     값을 써넣을 곳이        쓸 자
     ─────────────────────  ────────────────────
     몸통(document.body)     window.uiZoom()    ← 뒤집힌 방에서는 늘 1
     카드 마당 안            window.cardZoom()
     떠오르는 판 안          window.panelZoom()

   ★ 가르는 기준은 "무엇 옆에 뜨느냐" 가 아니라 **"어디에 붙느냐"** 입니다.
     상태표·작업 스티커 팝업은 카드 옆에 뜨지만 몸통에 붙으므로 uiZoom.

   ★★ 화면 단위(100dvh·100vw)는 zoom 을 **모릅니다.** zoom 걸린 요소 안에서
     쓰면 그 배율만큼 커져 화면 밖으로 나갑니다. 천장으로 쓸 때는 반드시
     배율로 나누세요 (styles.css 의 --panel-zoom / --modal-zoom 덩어리).
   ===================================================================== */
(function () {
  "use strict";

  const MIN = 70, MAX = 130, STEP = 5;

  /* 🧘 혼자 방과 진짜 방은 값을 따로 기억합니다 — 같은 브라우저에서
     둘을 오갈 때 한쪽에서 줄인 게 다른 쪽까지 따라가면 당황스러워요 */
  const KEY = () => (window.SOLO ? "soloZoom" : "uiZoom");
  const 곳간 = () => window.AppStore;

  function 배율() {
    const v = Number(곳간()?.getItem(KEY()));
    return (v >= MIN && v <= MAX) ? v : 100;
  }

  /* =====================================================================
     🧭 머리말과 알약 줄은 줄이지 않습니다 (2026-08-15)
     ---------------------------------------------------------------------
     [무엇이 불편했나] 확대·축소는 화면을 통째로 바꿉니다. 카드를 더 많이
     보려고 줄였더니 **시계와 알약 글씨까지 작아져서** 안 보였어요.
     정작 줄이고 싶었던 건 카드와 판이고, 손잡이는 그대로여야 합니다.

     [어떻게] zoom 은 겹치면 곱해집니다. 뿌리에 0.95 를 걸고 머리말에
     1/0.95 를 걸면 그 안쪽만 정확히 제 크기로 돌아와요. 좌표 계산은
     전부 그대로 둡니다 — uiZoom() 이 여전히 화면 전체의 배율이고,
     카드·판·팝업이 다 그 안에 있으니까요.
     ★ 되돌릴 곳은 **머리말(.app-head)과 알약 줄(.dock-bar)** 둘뿐입니다.
       떠오르는 판(#dock-panels)은 줄어드는 쪽이 맞아요 — 화면을 넓게
       쓰려고 줄이는 건데 판이 그대로면 뜻이 없습니다.
     ===================================================================== */
  /* [2026-08-15] 🧘 혼자 방에서 며칠 써 보고 진짜 더마감에도 켰습니다.
     이제 두 방 모두 머리말·알약 줄은 제 크기를 지킵니다.
     ★ 되돌려야 할 일이 생기면 이 함수만 false 로 바꾸면 돼요 —
       그러면 예전처럼 화면이 통째로 줄었다 커집니다. */
  const 손잡이는그대로 = () => true;

  /* =====================================================================
     🔄 뒤집기 — "다 줄이고 되돌리기" 에서 "줄일 것만 줄이기" 로
                 (2026-08-22, 콩 · 두 방 모두)
     ---------------------------------------------------------------------
     [옛 방식이 왜 무거웠나] 위의 2026-08-15 방식은 뿌리(html)를 통째로
     줄이고, 안 줄이고 싶은 것들을 하나씩 도로 키웠습니다. 되돌리는 규칙이
     다섯 군데로 늘었고, 그때마다 **재는 자가 하나씩 더 생겼어요.**
     실제로 판을 끌 때 커서를 안 따라가는 사고가 났습니다(2026-08-22).
     몸통 높이를 손으로 다시 재는 꼼수(100dvh 보정)도 그 방식 때문입니다.

     [뒤집으면] 줄이고 싶은 것은 **접속자 카드 마당** 하나뿐입니다.
     거기만 줄이면 —
       · 머리말·알약 줄·판·팝업·배경판은 **아무것도 안 해도** 제 크기
       · 몸통 높이 보정이 필요 없음 (뿌리가 안 줄어드니까)
       · 판을 재는 자는 그냥 1
     되돌리기 규칙도, 자도 함께 사라집니다.

     [자가 둘로 갈립니다 — 헷갈리지 마세요]
       window.uiZoom()   = **뿌리** 배율. 화면 좌표(clientX·getBoundingClientRect)
                           와 요소 좌표(style.left·offsetWidth) 사이의 자.
                           뒤집힌 방에서는 뿌리를 안 건드리므로 **늘 1**.
       window.cardZoom() = **카드 마당** 배율. 카드에 붙는 떠다니는 판
                           (상태표·작업 스티커·화면공유)이 쓰는 자.
     ★ 옛 방식에서는 이 둘이 늘 같았습니다. 그래서 여태 uiZoom() 하나로
       버틴 거예요. 이제는 다릅니다.

     [내력] 2026-08-22 혼자 방에서 먼저 켜고 그날 안에 본 방까지 켰습니다.
       콩 확인: "완벽하게 접속자 창만 줄었다 늘고, 스티커·상태표도 제 위치,
       그 표 자체는 100% 라 가독성도 좋아."

     ★★★ 되돌리려면 **아래 한 줄만** `() => !!window.SOLO` 로, 아주 되돌리려면
       `() => false` 로 바꾸세요. 옛 방식 코드는 아래 else 가지에 그대로
       살아 있습니다 — 지우지 마세요. 이 방에서 배율은 여러 번 뒤집혔고,
       한 줄로 되돌아갈 수 있다는 게 그때마다 안전망이었습니다.
     ===================================================================== */
  const 뒤집힌방 = () => true;

  /* =====================================================================
     🪟 2단계 — 판 크기를 따로 (2026-08-22, 콩 · 두 방 모두)
     ---------------------------------------------------------------------
     머리말의 [− 100% +] 는 이제 **접속자 카드**만 줄입니다. 그런데 판은
     읽고 적는 자리라 사람마다 원하는 크기가 다릅니다 — 그래서 판 크기는
     설정 › 💬 채팅 에 따로 뒀습니다 (콩).

     [무엇까지 따라가나] **판(.dock-panel)과 팝업(.modal-content) 둘 다**
     입니다. 둘 다 "떠 있는 창" 이라, 하나만 커지면 "왜 이건 되고 저건
     안 되지" 가 생깁니다. 기준을 한 줄로 말할 수 있어야 해요 —
       · 머리말의 배율 = **접속자 카드 크기**
       · 설정의 배율   = **떠 있는 창 크기** (판·팝업)
     팝업은 빼고 싶어지면 아래 CSS 에서 .modal-content 줄만 지우면 됩니다.

     ★ 기본은 100% 입니다. 아무도 안 만지면 지금과 똑같아요.
     ★ 뒤집힌 방에서만 걸립니다. 뒤집기 전 방식에서는 판이 화면 배율을
       따라 줄어들어야 하는데, 거기에 또 걸면 배율이 곱해지거든요.
     ===================================================================== */
  const 판KEY = () => (window.SOLO ? "soloPanelZoom" : "panelZoom");
  function 판배율() {
    if (!뒤집힌방()) return 100;            // 본 방은 아직 안 씁니다
    const v = Number(곳간()?.getItem(판KEY()));
    return (v >= MIN && v <= MAX) ? v : 100;
  }

  function 판배율적용(v) {
    const z = Math.max(MIN, Math.min(MAX, Math.round(v / STEP) * STEP));
    try { 곳간()?.setItem(판KEY(), String(z)); } catch (e) {}
    const h = document.documentElement;
    /* 뒤집히지 않은 방에서는 아무 일도 하지 않습니다 — 거기선 판이
       화면 배율을 따라가야 하는데, 여기에 또 걸면 배율이 곱해집니다. */
    const 켤까 = 뒤집힌방() && z !== 100;
    h.style.setProperty("--panel-zoom", 켤까 ? String(z / 100) : "");
    h.toggleAttribute("data-panelzoom", 켤까);
    그림맞추기();
    return z;
  }

  /* 슬라이더 옆 숫자와 판 자리를 함께 손봅니다.
     ★ 판이 커지면 화면 밖으로 삐져나갈 수 있어서 다시 가둬야 합니다. */
  function 그림맞추기() {
    const pill = document.getElementById("panel-zoom-val");
    if (pill) pill.textContent = 판배율() + "%";
    const sl = document.getElementById("set-panel-zoom");
    if (sl && Number(sl.value) !== 판배율()) sl.value = String(판배율());
    try { window.dockReclampAll?.(); } catch (e) {}
  }

  function 배율적용(v) {
    const z = Math.max(MIN, Math.min(MAX, Math.round(v / STEP) * STEP));
    try { 곳간()?.setItem(KEY(), String(z)); } catch (e) {}
    const f = z / 100;
    const h = document.documentElement;

    if (뒤집힌방()) {
      /* ── 새 방식 — 카드 마당만 줄입니다 ───────────────────────────
         ★ 뿌리와 몸통은 **손도 대지 않습니다.** 옛 방식에서 남았을지 모를
           값까지 지웁니다 — 한 번 켜졌던 브라우저가 그대로 오면
           두 방식이 겹쳐 배율이 곱해집니다. */
      h.style.zoom = "";
      document.body.style.zoom = "";
      document.body.style.height = "";
      h.style.removeProperty("--unzoom");
      h.removeAttribute("data-unzoom");

      /* 🏷️ 뒤집힌 방이라는 표식 — CSS 가 이걸 보고 머리말 메뉴 창(팝업)을
         105% 로 붙들어 둡니다. `data-solo` 가 아니라 이 이름을 쓰는 이유는,
         나중에 본 방도 뒤집으면 **CSS 를 안 고쳐도 그대로 따라오게** 하려고요. */
      h.setAttribute("data-flipped", "1");

      h.style.setProperty("--card-zoom", (z === 100) ? "" : String(f));
      h.toggleAttribute("data-cardzoom", z !== 100);
    } else {
      h.removeAttribute("data-flipped");
      /* ── 옛 방식 — 뿌리를 줄이고 손잡이를 되돌립니다 (본 방) ────── */
      h.style.removeProperty("--card-zoom");
      h.removeAttribute("data-cardzoom");

      /* 100% 일 때는 아예 손대지 않습니다 — zoom:1 만 걸려 있어도
         어떤 브라우저는 글꼴을 다시 그려서 미세하게 흐려 보여요 */
      h.style.zoom = (z === 100) ? "" : f;
      document.body.style.zoom = "";
      document.body.style.height = (z === 100) ? "" : (window.innerHeight / f) + "px";

      /* 되돌려 키울 값 — CSS 가 이 값을 읽어 머리말·알약 줄에만 겁니다 */
      const 되돌림 = (z === 100 || !손잡이는그대로()) ? "" : String(1 / f);
      h.style.setProperty("--unzoom", 되돌림);
      h.toggleAttribute("data-unzoom", !!되돌림);
    }

    /* ★★★ [고침 2026-08-22 — 뒤집기 후속] 격자에 넘길 값은 **body 에
       실제로 걸린 배율**입니다. 카드 배율이 아니에요.
         옛 방식: 뿌리를 줄이니 body 도 f 배로 그려짐 → f
         새 방식: 뿌리에 손을 안 대니 body 는 늘 1 배      → 1
       카드 배율(f)을 그냥 넘기면, 칸 너비를 안 줄어든 배경에 맞춰
       엉뚱하게 고쳐 놓습니다. 그러면 이 함수가 막으려던 바로 그 것 —
       **일정 간격으로 넓은 칸이 반복되는 물결무늬**가 되돌아옵니다.
       (dpr 2 · 카드 70% 면 한 칸이 화면 점 48.57 개가 됩니다) */
    격자맞춤(뒤집힌방() ? 1 : f);

    const pill = document.getElementById("zoom-pill");
    if (pill) pill.textContent = z + "%";
    return z;
  }

  /* =====================================================================
     📐 원고지 격자를 화면 점에 딱 맞춥니다 (2026-08-15)
     ---------------------------------------------------------------------
     [무엇이 이상했나] 격자는 24px 마다 1px 선을 긋습니다. 그런데 화면
     한 점(device pixel)과 CSS 1px 이 늘 같지는 않아요 —
       · 맥의 "조정된 해상도" 는 배율이 1.6·1.8 처럼 어중간하고
       · 확대·축소를 하면 거기에 또 곱해집니다
     그러면 24px 이 화면 점으로는 43.2 점 같은 소수가 됩니다. 브라우저는
     점 단위로만 그릴 수 있으니 43·43·44·43·44… 로 반올림하며 그리고,
     그 오차가 쌓여 **일정한 간격으로 넓은 칸**이 생깁니다
     ("일정하게 간격이 넓어지는 칸이 있길래" — 콩). 물결무늬(모아레)와
     같은 원리라, 눈에 아주 잘 띕니다.

     [고침] 24 에 가장 가까우면서 **화면 점 개수가 정수**가 되는 칸 너비를
     골라 씁니다. 배율 1.8 이면 24 → 43.2 대신 43/1.8 = 23.889px.
     화면에서는 43 점이 정확히 반복되니 모든 칸이 똑같아집니다.
     선 굵기도 같은 방식으로 정수 점에 맞춥니다.
     ★ 눈에 보이는 차이는 없습니다 — 한 칸이 최대 반 점 달라질 뿐이에요.
       달라지는 건 "고르다" 하나입니다.
     ===================================================================== */
  function 격자맞춤(f) {
    const 화면배 = (window.devicePixelRatio || 1) * (f || 1);
    const r = document.documentElement.style;
    if (!isFinite(화면배) || 화면배 <= 0) {
      r.removeProperty("--grid-p"); r.removeProperty("--grid-gap");
      return;
    }
    /* 칸 24px · 선 1px 에 가장 가까우면서 화면 점 개수가 정수인 값 */
    const 칸점 = Math.max(1, Math.round(24 * 화면배));
    const 선점 = Math.max(1, Math.round(1 * 화면배));
    const 칸 = 칸점 / 화면배;
    const 선 = 선점 / 화면배;
    r.setProperty("--grid-p", 칸.toFixed(4) + "px");
    r.setProperty("--grid-gap", (칸 - 선).toFixed(4) + "px");
  }

  /* 창을 다른 화면(외장 모니터)으로 옮기면 화면 배율이 달라집니다 —
     그때도 다시 맞춰야 해요. resize 는 그 순간에도 옵니다. */
  window.addEventListener("load", () => {
    /* ★ 위 배율적용() 과 **같은 값**을 넘겨야 합니다 — body 에 걸린 배율.
       여기만 카드 배율을 넘기면, 첫 화면에서만 격자가 어긋납니다
       (그리고 배율을 한 번 만지면 저절로 나아서 더 찾기 어렵습니다). */
    try { 격자맞춤(뒤집힌방() ? 1 : 배율() / 100); } catch (e) {}
  });

  /* =====================================================================
     📏 자 둘 — 무엇을 재느냐에 따라 골라 쓰세요 (2026-08-22)
     ---------------------------------------------------------------------
     uiZoom()   **뿌리** 배율입니다.
                화면에서 잰 값(clientX · getBoundingClientRect)을 요소 값
                (style.left · offsetWidth)으로 옮길 때 나눕니다.
                판 옮기기·크기 조절이 이걸 씁니다.
                → 뒤집힌 방에서는 뿌리를 안 건드리므로 **늘 1** 입니다.

     cardZoom() **카드 마당** 배율입니다.
                카드에서 잰 값을 **다른 카드에 입힐 때** 씁니다.
                지금 쓰는 곳은 딱 하나 — script_share.js 의 공유 카드
                높이 맞추기입니다 (카드 높이를 재서 카드에 입힘).

     [헷갈리기 쉬운 자리 — 미리 적어 둡니다]
     상태표·작업 스티커·화면공유 팝업은 **카드 옆에 뜨지만 cardZoom 이
     아닙니다.** 그것들은 document.body 에 붙거든요. 카드에서 잰 화면
     좌표를 **몸통 자리**로 옮기는 셈이라 뿌리 자(uiZoom)가 맞습니다.
     → 가르는 기준은 "어디에 붙느냐" 이지 "무엇 옆에 뜨느냐" 가 아닙니다.

     ★ 옛 방식에서는 둘이 늘 같았습니다. 그래서 여태 uiZoom() 하나로
       버텼어요. 새로 코드를 쓸 때는 **값을 써넣을 곳이 어디인지**를
       먼저 보세요 — 몸통이면 uiZoom, 카드 안이면 cardZoom 입니다.
     ===================================================================== */
  window.uiZoom   = () => (뒤집힌방() ? 1 : 배율() / 100);
  window.cardZoom = () => 배율() / 100;
  /* 🪟 판 자(2026-08-22) — **판에 실제로 걸린 배율**입니다.
     뿌리 배율 × 판 배율. 판을 끌고 크기를 재는 곳이 이걸 씁니다.
     ★ 뒤집힌 방: 뿌리가 1 이라 곧 판 배율.
       본 방    : 판 배율이 100 이라 곧 뿌리 배율 (예전과 같음). */
  window.panelZoom = () => (뒤집힌방() ? 1 : 배율() / 100) * (판배율() / 100);
  window.setUiZoom = 배율적용;
  window.getUiZoom = 배율;
  window.setPanelZoom = 판배율적용;
  window.getPanelZoom = 판배율;

  /* 창 크기가 바뀌면 몸통 높이를 다시 잽니다 (위 계산이 화면 높이를 씁니다) */
  let _t = null;
  window.addEventListener("resize", () => {
    clearTimeout(_t);
    _t = setTimeout(() => { try { 배율적용(배율()); } catch (e) {} }, 120);
  });

  /* ---------------------------------------------------------------
     머리말 제 자리(#zoom-ctl)에 단추 달기
     --------------------------------------------------------------- */
  function 단추HTML() {
    return `
      <button class="font-btn" type="button" id="zoom-out"
              aria-label="화면 축소" title="화면을 5% 줄여요">−</button>
      <span id="zoom-pill" class="font-pill" role="button" tabindex="0"
            aria-live="polite" aria-label="현재 화면 배율"
            title="눌러서 100% 로">100%</span>
      <button class="font-btn" type="button" id="zoom-in"
              aria-label="화면 확대" title="화면을 5% 키워요">+</button>`;
  }

  function 손가락() {
    const out = document.getElementById("zoom-out");
    const inn = document.getElementById("zoom-in");
    const pill = document.getElementById("zoom-pill");
    if (!out || !inn || !pill) return false;
    out.onclick = () => 배율적용(배율() - STEP);
    inn.onclick = () => 배율적용(배율() + STEP);
    /* 눌러서 제자리로 — 한참 만졌다가 되돌리기가 은근히 번거로워요 */
    pill.onclick = () => 배율적용(100);
    pill.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); 배율적용(100); }
    };
    배율적용(배율());
    판배율적용(판배율());     // 🪟 판 크기도 기억해 둔 값으로 (2026-08-22)
    return true;
  }

  /* ---------------------------------------------------------------
     🪟 설정 › 💬 채팅 의 [판 크기] 슬라이더에 손가락 달기
     ★ 판이 없는 방(본 방)에서는 칸 자체를 감춥니다 — 만져도 아무 일이
       안 일어나는 손잡이가 있으면 "고장 났다" 로 읽힙니다.
     --------------------------------------------------------------- */
  function 판슬라이더달기() {
    const wrap = document.getElementById("set-panel-zoom-block");
    const sl = document.getElementById("set-panel-zoom");
    if (!wrap || !sl) return false;
    wrap.hidden = !뒤집힌방();
    if (!뒤집힌방()) return true;
    sl.min = String(MIN); sl.max = String(MAX); sl.step = String(STEP);
    sl.value = String(판배율());
    /* 끄는 내내가 아니라 **놓았을 때** 다시 가둡니다 — 끄는 동안 판이
       계속 자리를 다시 잡으면 손 아래에서 덜컹거려요.
       크기 자체는 input 으로 바로 따라옵니다(그래야 고르는 맛이 납니다). */
    sl.oninput  = () => {
      const z = Math.max(MIN, Math.min(MAX, Math.round(Number(sl.value) / STEP) * STEP));
      try { 곳간()?.setItem(판KEY(), String(z)); } catch (e) {}
      const h = document.documentElement;
      h.style.setProperty("--panel-zoom", z === 100 ? "" : String(z / 100));
      h.toggleAttribute("data-panelzoom", z !== 100);
      const pill = document.getElementById("panel-zoom-val");
      if (pill) pill.textContent = z + "%";
    };
    sl.onchange = () => 판배율적용(Number(sl.value));
    const 되돌리기 = document.getElementById("set-panel-zoom-reset");
    if (되돌리기) 되돌리기.onclick = () => 판배율적용(100);
    그림맞추기();
    return true;
  }
  window.mountPanelZoomCtl = 판슬라이더달기;

  /* ★★ [고침 2026-08-16] 예전에는 머리말의 글자 크기 조절(.font-ctl)을
     찾아 그 **옆에** 끼워 넣었습니다. 그런데 글자 크기 조절이 설정 창
     안으로 옮겨 가면서, 그걸 따라가면 확대·축소도 설정 창에 들어가
     버립니다. 이제 머리말에 제 자리(#zoom-ctl)를 두고 거기만 채웁니다.
     ★ 자리를 못 찾으면 아무것도 하지 않습니다 — 엉뚱한 데 붙는 것보다
       안 보이는 편이 낫고, 그러면 index.html 을 보러 가게 되니까요. */
  function 달기() {
    const ctl = document.getElementById("zoom-ctl");
    if (!ctl) return false;
    if (document.getElementById("zoom-pill")) return true;   // 이미 달렸어요
    ctl.innerHTML = 단추HTML();
    return 손가락();
  }
  window.mountZoomCtl = 달기;

  /* 두 방 모두 머리말 제 자리에 답니다 */
  window.addEventListener("load", () => {
    setTimeout(달기, 300);
    setTimeout(판슬라이더달기, 300);
  });
})();
