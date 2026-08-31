/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_proom.js — ⏱️ 뽀모방 (2026-08-29, 콩)

   [무엇인가]
   뽀모가 **늘 돌고 있는 방.** 누구나 들어옵니다. 모두가 같은 시계를
   보고, 그 박자에 맞춰 쓰고 쉴 때 떠듭니다.
   콩: "그게 싫으면 뽀모방에 안 들어가면 되는 거지."

   =====================================================================
   ★★★ 시계를 **서버에 안 적습니다** — 이 파일에서 제일 중요한 결정
   ---------------------------------------------------------------------
   아무도 시작 버튼을 안 누릅니다. epoch(1970-01-01 00:00 UTC)부터 30분씩
   끊어 세면 끝이에요:

       한 바퀴 30분 = 뽀모 25분 + 휴식 5분
       30분은 한 시간을 정확히 나누고, 한국은 UTC+9(정시 시차)라
       경계가 매시 :00 · :25 · :30 · :55 에 딱 떨어집니다.

   그래서 **각자 제 시계로 셈해도 답이 같습니다.** 파이어베이스에 쓰는
   것은 대화 글뿐이고, 시계 쪽 쓰기는 **0** 입니다.
   ★ 기기 시계가 어긋난 사람을 위해 .info/serverTimeOffset 만 봅니다 —
     파이어베이스가 로컬에서 내주는 숫자 하나라 통신이 사실상 없어요.

   =====================================================================
   ★★★ 커서를 지키는 세 층 — 여기가 이 파일에서 제일 위험한 자리
   ---------------------------------------------------------------------
   [왜 위험한가] 이 판은 **1초마다 시계가 바뀝니다.** 판을 통째로 다시
   그리면 <textarea> 가 **초마다 새로 태어나요.** 커서는 물론이고 쓰던
   글과 한글 조합까지 매초 날아갑니다. 비밀방(script_sroom.js)에서 콩이
   신고한 그것보다 훨씬 나쁩니다 — 거긴 남이 글을 보낼 때뿐이었거든요.

   그래서 그리는 일을 **세 층으로** 갈랐습니다:

       proom틀짓기()   판의 뼈대. **모양이 달라질 때만** (여닫기 정도)
       proom시계()     숫자·딱지·줄 길이만. innerHTML 을 **안 씁니다** —
                       textContent 와 style.width 만 건드려요
       proom줄그리기() .pr-log 속만. 새 글이 왔을 때만

   ★ 시계는 250ms 마다 도는데, 그 길에 innerHTML 이 한 글자도 없어야
     합니다. 검사(checks)가 이걸 못 박아 뒀어요.
   ★ 글칸도 제 것을 따로 팝니다(#proom-in) — 챗의 글칸을 옮겨 오지
     않습니다. 그 이사가 2026-08-13 한글 자소 분리 사고의 자리였어요.
   ===================================================================== */
(function () {
  "use strict";

  /* 한 바퀴 — 콩 확정 2026-08-29 */
  const PROOM_뽀모 = 25 * 60 * 1000;
  const PROOM_휴식 =  5 * 60 * 1000;
  const PROOM_바퀴 = PROOM_뽀모 + PROOM_휴식;   // 30분 · 정각에 떨어짐

  const PROOM_MAX  = 300;          // 화면에 들고 있는 대화 줄
  const PROOM_LEN  = 2000;
  const PROOM_종키  = "proomBell"; // 🔔 알림 — 기기별

  let _proomRef = null;
  let _proomRows = [], _proom인원 = 0;
  let _proomBound = false, _proomBusy = false;
  let _proom열림 = false;
  let _proom틀 = "";
  let _proom시계기 = null;
  let _proom옛단계 = null;         // 뽀모↔휴식이 바뀌는 순간을 알아채려고
  let _proom시차 = 0;              // 서버 시각과 내 시계의 차이(ms)
  let _proom들어온때 = 0;          // 이 판을 언제 열었나 — 🍅 판정에 씁니다
  let _proom명단 = null;           // 👋 지금 방에 있는 닉들 (null = 아직 기준 없음)
  let _proom입장줄 = [];           // 👋 이 기기에서 본 입장 순간들 — 서버엔 안 적습니다
  let _proom입장때 = {};           // 닉 → 마지막 입장 줄 시각 (연결 출렁임 무시용)

  const el = (id) => document.getElementById(id);
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? "")) : String(s ?? ""));

  /* ★ script_core.js 의 myNick 은 최상위 let 이라 window 에 안 붙습니다 */
  function proomMe() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }

  /* =====================================================================
     시계 — 계산해냅니다
     ===================================================================== */
  const proom지금 = () => Date.now() + _proom시차;

  function proom상태(t) {
    const 안 = ((t % PROOM_바퀴) + PROOM_바퀴) % PROOM_바퀴;
    return 안 < PROOM_뽀모
      ? { 휴식: false, 남은: PROOM_뽀모 - 안, 총: PROOM_뽀모, 지난: 안 }
      : { 휴식: true,  남은: PROOM_바퀴 - 안, 총: PROOM_휴식, 지난: 안 - PROOM_뽀모 };
  }
  /** 그 시각이 든 바퀴에서, 지금 단계가 시작된 시각 */
  function proom단계시작(t) {
    const 안 = ((t % PROOM_바퀴) + PROOM_바퀴) % PROOM_바퀴;
    return 안 < PROOM_뽀모 ? t - 안 : t - 안 + PROOM_뽀모;
  }
  const 두자리 = (n) => String(n).padStart(2, "0");
  function 시분초(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return 두자리(Math.floor(s / 60)) + ":" + 두자리(s % 60);
  }

  function proom시차맞추기() {
    if (!window.db) return;
    try {
      /* .info/serverTimeOffset 은 파이어베이스가 **로컬에서** 내주는 값이라
         따로 오가는 통신이 없습니다. 기기 시계가 어긋난 사람만 구해 줘요. */
      window.db.ref(".info/serverTimeOffset").on("value", (s) => {
        const v = Number(s.val());
        if (Number.isFinite(v)) _proom시차 = v;
      });
    } catch (e) {}
  }

  /* =====================================================================
     🔔 알림 — 기기별. 서버에 안 보냅니다
     ===================================================================== */
  function proom종() {
    try { return window.AppStore?.getItem(PROOM_종키) !== "0"; } catch (e) { return true; }
  }
  function proom종바꾸기() {
    const 다음 = !proom종();
    try { window.AppStore?.setItem(PROOM_종키, 다음 ? "1" : "0"); } catch (e) {}
    proom종그리기();
  }
  function proom종그리기() {
    const b = el("proom-bell");
    if (!b) return;
    const on = proom종();
    b.textContent = on ? "🔔" : "🔕";
    b.classList.toggle("off", !on);
    b.title = on ? "알림 끄기" : "알림 켜기";
  }

  /* =====================================================================
     ★★★ [고침 2026-08-30 — 콩 신고 "알림음이 안 들려"]
     ---------------------------------------------------------------------
     [무슨 일이 있었나]
     소리 낼 때마다 AudioContext 를 **새로** 만들었습니다. 그런데
     브라우저의 자동재생 정책은, **사용자 손짓(클릭·키) 밖에서** 만든
     컨텍스트를 suspended(잠긴 채)로 태어나게 해요. 단계가 바뀌는 순간은
     시계가 부르는 것이지 손짓이 아니라서 — 늘 잠긴 채 태어났고,
     resume() 을 안 부르니 **소리 없이 조용히** 버려졌습니다.
     에러도 안 나요. 그래서 아무도 몰랐던 겁니다.

     [그래서 — 알약 뽀모와 같은 길로]
     script_ui.js 의 소리 엔진이 **이미 이 문제를 푼 적이 있습니다**:
       · 컨텍스트를 **하나만** 만들어 계속 씁니다 (닫지 않아요)
       · 손짓이 있을 때 미리 열어(resume) 둡니다 — 판을 여는 클릭,
         판 안의 클릭·타이핑이 전부 열쇠가 됩니다
       · 그래도 잠겨 있으면 소리 직전에 한 번 더 resume() 해 봅니다
     ===================================================================== */
  let _proomAC = null;

  function proomAC얻기() {
    if (_proomAC) return _proomAC;
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    try { _proomAC = new A(); } catch (e) {}
    return _proomAC;
  }

  /** 손짓이 있는 틈에 자물쇠를 풀어 둡니다 — 여러 번 불러도 해가 없어요 */
  function proom소리풀기() {
    const ac = proomAC얻기();
    if (!ac) return;
    if (ac.state === "suspended") { try { ac.resume(); } catch (e) {} }
  }

  /** 단계가 바뀔 때 짧고 부드럽게 — 놀라지 않게 아주 작습니다 */
  function proom소리(휴식) {
    if (!proom종()) return;
    try {
      const ac = proomAC얻기();
      if (!ac) return;
      /* 마지막 시도 — 손짓 밖이라 대개 안 풀리지만, 밑져야 본전입니다 */
      if (ac.state === "suspended") { try { ac.resume(); } catch (e) {} }
      if (ac.state !== "running") return;
      const 음 = 휴식 ? [523.25, 392.00] : [392.00, 523.25];   // 쉼은 내려가고, 뽀모는 올라가고
      음.forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = "sine"; o.frequency.value = f;
        const t0 = ac.currentTime + i * 0.16;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.02);   // ★ 아주 작게
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
        o.connect(g); g.connect(ac.destination);
        o.start(t0); o.stop(t0 + 0.17);
      });
      /* ★ ac.close() 를 안 합니다 — 닫으면 다음번에 또 잠긴 채 태어나요 */
    } catch (e) {}
  }

  /* =====================================================================
     🔤 글씨 크기 — 비밀방(script_sroom.js)과 같은 결. 기기별, 서버 쓰기 0
     ===================================================================== */
  const PROOM_FS_KEY = "proomFont";
  const PROOM_FS_MIN = 11, PROOM_FS_MAX = 20, PROOM_FS_DEF = 13;

  function proom글씨() {
    const v = Number(window.AppStore?.getItem(PROOM_FS_KEY));
    return Number.isFinite(v) && v >= PROOM_FS_MIN && v <= PROOM_FS_MAX ? v : PROOM_FS_DEF;
  }
  function proom글씨바꾸기(d) {
    const v = Math.max(PROOM_FS_MIN, Math.min(PROOM_FS_MAX, proom글씨() + d));
    try { window.AppStore?.setItem(PROOM_FS_KEY, String(v)); } catch (e) {}
    /* ★★ 다시 그리지 않습니다 — CSS 값 하나만. (비밀방에서 배운 그것:
       다시 그리면 글칸이 새로 태어나 쓰던 글과 커서가 날아갑니다) */
    const 판 = el("dock-body-proom")?.querySelector(".pr-board");
    if (판) 판.style.setProperty("--pr-fs", v + "px");
    const 숫 = el("proom-fs");
    if (숫) 숫.textContent = v;
  }

  /* =====================================================================
     그리기 ① 틀 — 모양이 달라질 때만
     ===================================================================== */
  function proom틀모양() { return _proom열림 ? "방" : "닫힘"; }

  function proom틀짓기() {
    const box = el("dock-body-proom");
    if (!box) return;
    _proom틀 = proom틀모양();
    box.innerHTML = `
      <div class="pr-board" style="--pr-fs:${proom글씨()}px">
        <div class="pr-clock">
          <div class="pr-big" id="proom-big">25:00</div>
          <div class="pr-right">
            <div class="pr-lab">
              <span class="pr-ph" id="proom-ph">🍅 뽀모</span>
              <span id="proom-next">· :00 에 휴식</span>
              <span class="pr-sp"></span>
              <span class="pr-fs" title="이 방의 글씨 크기 (이 기기에서만)">
                <button type="button" data-proom-font="-1" aria-label="글씨 작게">－</button>
                <b id="proom-fs">${proom글씨()}</b>
                <button type="button" data-proom-font="1" aria-label="글씨 크게">＋</button>
              </span>
              <button type="button" class="pr-cnt" id="proom-cnt" data-proom-cnt="1"
                      title="참여자 보기">1명</button>
              <button type="button" class="pr-bell" id="proom-bell"
                      data-proom-bell="1" aria-label="알림">🔔</button>
            </div>
            <div class="pr-bar"><i id="proom-bar" style="width:0%"></i></div>
          </div>
        </div>
        <div class="pr-pop" id="proom-pop" hidden></div>
        <div class="pr-log" id="proom-log"></div>
        <div class="pr-write">
          <textarea id="proom-in" class="pr-in" rows="1" maxlength="${PROOM_LEN}"
                    placeholder="쉴 때 떠들어요"></textarea>
          <button type="button" class="pr-send" data-proom-send="1"
                  aria-label="보내기" title="보내기">↑</button>
        </div>
      </div>`;
    proom종그리기();
    proom시계();
    proom줄그리기();
  }

  /* =====================================================================
     👥 참여자 명단 (2026-08-30 — 콩 "n명을 클릭하면 명단이 자그맣게")
     ---------------------------------------------------------------------
     "n명" 을 누르면 열리고, 다시 누르면 닫힙니다. 재료는 입장 줄이 쓰는
     그 명단(_proom명단 — status 에서 온 것) — **새로 읽는 자료 0.**
     닉네임 색도 챗과 같은 색(nickColorStyle)을 입습니다.
     ★ 여기 innerHTML 은 클릭했을 때와 명단이 바뀔 때만 돕니다 —
       250ms 시계 길이 아니에요.
     ===================================================================== */
  function proom명단그리기() {
    const 팝 = el("proom-pop");
    if (!팝 || 팝.hidden) return;      // 닫혀 있으면 그릴 일도 없습니다
    const 나 = proomMe();
    const 들 = new Set(_proom명단 || []);
    if (나) 들.add(나);                // 첫 하트비트 전엔 명단에 나도 없어서
    const 줄 = [...들].sort((a, b) => a.localeCompare(b, "ko"));
    팝.innerHTML = 줄.map((닉) => `
      <div class="pr-pop-r${닉 === 나 ? " mine" : ""}">
        <span class="pr-pop-n" data-name-of="${esc(닉)}"${window.nickColorStyle?.(닉) || ""}>${esc(닉)}</span>${닉 === 나 ? `<small>나</small>` : ""}
      </div>`).join("");
  }
  function proom명단토글() {
    const 팝 = el("proom-pop");
    if (!팝) return;
    팝.hidden = !팝.hidden;
    proom명단그리기();
  }

  /* =====================================================================
     그리기 ② 시계 — ★★★ innerHTML 을 한 글자도 안 씁니다
     ---------------------------------------------------------------------
     250ms 마다 돕니다. 여기서 판을 다시 지으면 글칸이 **초마다** 새로
     태어나요. textContent 와 style 만 건드립니다.
     ===================================================================== */
  function proom시계() {
    const big = el("proom-big");
    if (!big) return;
    const t = proom지금();
    const st = proom상태(t);

    big.textContent = 시분초(st.남은);
    big.classList.toggle("rest", st.휴식);

    const ph = el("proom-ph");
    if (ph) {
      ph.textContent = st.휴식 ? "☕ 휴식" : "🍅 뽀모";
      ph.classList.toggle("rest", st.휴식);
    }
    const nx = el("proom-next");
    if (nx) {
      const 다음 = new Date(t + st.남은);
      nx.textContent = "· :" + 두자리(다음.getMinutes()) + " 에 " + (st.휴식 ? "뽀모" : "휴식");
    }
    const bar = el("proom-bar");
    if (bar) {
      bar.style.width = Math.min(100, st.지난 / st.총 * 100) + "%";
      bar.classList.toggle("rest", st.휴식);
    }
    const cnt = el("proom-cnt");
    if (cnt) cnt.textContent = (_proom인원 || 1) + "명";

    /* ⏱️→📊 알약이 곧 진행 바 (2026-08-30 — 콩)
       내려둔 참여자에게만: 알약 글자가 「🍅 뽀모방 참여 중 · 16:03」이
       되고, 알약 배경이 지난 만큼 차오릅니다 (--pr-pct 를 CSS 가 읽음).
       .joined 는 dock 이 "참여 중 + 내려둠" 일 때만 붙여 줍니다.
       ★ 여기도 시계 길입니다 — textContent · classList · style 만.
       ★ 원래 글자는 dataset.orig 에 한 번 담아 두고 거기서 되살립니다 —
         글자를 두 군데 적으면 언젠가 한쪽만 고쳐져요. */
    const 알약 = document.getElementById("dock-pill-proom");
    if (알약) {
      const 라벨 = 알약.querySelector(".dock-pill-label");
      if (알약.classList.contains("joined")) {
        if (라벨 && !라벨.dataset.orig) 라벨.dataset.orig = 라벨.textContent;
        알약.classList.toggle("rest", st.휴식);
        알약.style.setProperty("--pr-pct",
          Math.min(100, st.지난 / st.총 * 100).toFixed(1) + "%");
        if (라벨) 라벨.textContent =
          (st.휴식 ? "☕" : "🍅") + " 뽀모방 참여 중 · " + 시분초(st.남은);
      } else if (알약.style.getPropertyValue("--pr-pct")) {
        /* 판을 도로 폈다 — 알약을 원래 모습으로 */
        알약.classList.remove("rest");
        알약.style.removeProperty("--pr-pct");
        if (라벨 && 라벨.dataset.orig) 라벨.textContent = 라벨.dataset.orig;
      }
    }

    /* 단계가 바뀌는 순간 — 소리 한 번, 줄 한 번 */
    const 단계 = st.휴식 ? "휴식" : "뽀모";
    if (_proom옛단계 !== null && _proom옛단계 !== 단계) {
      proom소리(st.휴식);
      /* 🧹 00:00 도 단계 경계입니다 — 자정을 방 안에서 맞으면 그 자리에서
         청소됩니다 (도장 덕에 다른 경계에서는 곧장 돌아와요) */
      window.자정방청소?.("proom", "proomSweepDay");
      proom줄그리기();                       // 새 구분 줄이 끼어들게
      const b = el("proom-big")?.closest(".pr-board");
      if (b) { b.classList.add("pr-flash"); setTimeout(() => b.classList.remove("pr-flash"), 900); }
      /* 뽀모 → 휴식 으로 넘어갔다 = 한 바퀴를 채웠다 */
      if (st.휴식) proom토마토(proom단계시작(t) - PROOM_뽀모);
    }
    _proom옛단계 = 단계;
  }

  /* =====================================================================
     🍅 뽀모방에서 토마토 쌓기 (2026-08-30 — 콩)
     ---------------------------------------------------------------------
     콩: "뽀모는 뽀모잖아?" — 맞습니다. 다만 그냥 붙이면 **판을 25분
     경계에 잠깐 열었다 닫는 것만으로** 토마토가 붙어요. 그래서 조건을 넷
     겁니다. 하나라도 어긋나면 안 셉니다.

     ★★★ 판정을 **전부 이 기기 안에서** 합니다 — 서버에 아무것도 안 적어요.
        이 파일의 제1원칙("시계 쪽 쓰기 0")이 그대로 지켜집니다.
        쌓는 순간의 쓰기 한 번(pomoSessions)은 알약 뽀모가 원래 하던 그것이고요.

     ★★ 바퀴 시작 시각이 **계산으로 나오는 숫자**라는 점을 씁니다.
        "이 바퀴는 이미 셌다" 를 그 숫자로 적어 두면 **탭을 열 개 열어도
        한 번만** 쌓여요. 알약 뽀모에는 이 장치가 없어서 탭 두 개면 두 배로
        쌓입니다 — 여기가 오히려 튼튼합니다.
     ===================================================================== */
  const PROOM_센바퀴키 = "proomCounted";

  function proom센바퀴() {
    try { return Number(window.AppStore?.getItem(PROOM_센바퀴키)) || 0; } catch (e) { return 0; }
  }
  function proom센바퀴적기(뽀모시작) {
    try { window.AppStore?.setItem(PROOM_센바퀴키, String(뽀모시작)); } catch (e) {}
  }

  function proom토마토(뽀모시작) {
    /* ① 바퀴가 **시작되기 전부터** 방에 있었어야 합니다.
       중간에 들어온 사람은 그 바퀴를 온전히 채운 게 아니니까요.
       ※ 새로고침하면 들어온 때가 초기화돼 그 한 바퀴를 놓칩니다 —
         안전한 쪽으로 기울여 둔 것입니다 (콩 확인). */
    if (!_proom들어온때 || _proom들어온때 > 뽀모시작) return;

    /* ② 이미 센 바퀴면 그만. **탭 여러 개를 막는 자리**입니다 */
    if (proom센바퀴() === 뽀모시작) return;

    /* ③ 알약 🍅 뽀모가 돌고 있으면 그쪽에 맡깁니다.
       둘 다 세면 같은 25분에 토마토가 **두 개** 붙어요. */
    try { if (window.isPomodoroRunning?.()) return; } catch (e) {}

    /* ④ 자리비움이면 안 셉니다.
       ★ 이 검사는 incrementTodayFocusSessions() 가 **이미 안에서** 합니다
         (script_ui.js). 여기서 또 하지 않는 이유는, 조건이 둘로 갈리면
         언젠가 한쪽만 고쳐져 어긋나기 때문이에요. 알약 뽀모와 **같은 문**을
         지나가게 둡니다. */
    proom센바퀴적기(뽀모시작);
    try { window.incrementTodayFocusSessions?.(); } catch (e) {}
  }

  /* =====================================================================
     그리기 ③ 대화 줄 — .pr-log 속만
     ---------------------------------------------------------------------
     ★ 「🍅 뽀모 시작」 「☕ 휴식」 구분 줄은 **서버에 안 적습니다.**
       시계에서 계산해 그 자리에 끼워 넣어요 — 모두가 같은 값을 보니
       굳이 주고받을 이유가 없습니다.
     ===================================================================== */
  function proom줄HTML(r) {
    if (r.구분) {
      return `<div class="pr-sys">${r.휴식 ? "☕ <b>휴식</b> — 5분" : "🍅 <b>뽀모</b> 시작 — 25분"}</div>`;
    }
    /* 👋 입장 줄 (2026-08-30 — 콩) — 구분 줄과 같은 결: 서버에 안 적고
       이 기기에서 알아챈 순간을 그 자리에 끼워 넣습니다 */
    if (r.입장) {
      return `<div class="pr-sys">👋 <b>${esc(r.user)}</b> 입장</div>`;
    }
    const 내것 = r.user === proomMe();
    const d = new Date(r.time);
    const h = d.getHours(), m = 두자리(d.getMinutes());
    /* 🎨 닉네임 색 — 챗과 **같은 색**입니다 (2026-08-30 콩: "챗 그 색 그대로!")
       프로필에서 고른 nickColor 를 nickColorStyle() 로 받아 씁니다.
       · 안 고른 사람은 빈 문자열 → 테마 기본색 (내 줄은 CSS 가 강조색)
       · 다크 테마 밝기 보정도 그 함수가 다 해 줍니다
       · data-name-of 를 달아 두면 테마를 바꿀 때
         refreshChatNickColors() 가 챗과 **함께** 갱신해 줘요 — 공짜입니다 */
    return `
      <div class="pr-line${내것 ? " mine" : ""}">
        <span class="pr-who" data-name-of="${esc(r.user)}"${window.nickColorStyle?.(r.user) || ""}>${esc(r.user)}</span>
        <span class="pr-msg">${esc(r.msg)}</span>
        <span class="pr-t">${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${m}</span>
      </div>`;
  }

  /** 대화 사이사이에 단계 구분 줄을 시간순으로 끼웁니다.
      ★ **말이 오간 구간의 구분 줄만** 넣습니다. 안 그러면 밤새 조용했을 때
        빈 구분 줄이 수백 개 쌓여요 (밤 열 시간이면 스무 바퀴, 마흔 줄). */
  function proom엮기() {
    /* 👋 입장 줄도 대화와 시간순으로 섞습니다 — 입장만 있고 말이 없어도
       구분 줄이 그 구간에 서니, "누가 언제 왔나" 가 박자 위에 얹혀 보여요 */
    const 줄 = _proomRows.concat(_proom입장줄).sort((a, b) => a.time - b.time);
    if (!줄.length) return 줄;
    const 지금 = proom지금();
    const 나옴 = [];
    let t = proom단계시작(줄[0].time);
    let 안전 = 0;
    while (t <= 지금 && 안전++ < 400) {
      const st = proom상태(t + 10);
      const 끝 = t + (st.휴식 ? PROOM_휴식 : PROOM_뽀모);
      /* 이 구간에 말이 있었거나, 지금 우리가 있는 구간이면 넣습니다 */
      const 말있나 = 줄.some(r => r.time >= t && r.time < 끝);
      if (말있나 || (지금 >= t && 지금 < 끝)) {
        나옴.push({ 구분: true, time: t, 휴식: st.휴식 });
      }
      t = 끝;
    }
    return 줄.concat(나옴).sort((a, b) => a.time - b.time);
  }

  function proom줄그리기() {
    const 목록 = el("proom-log");
    if (!목록) return;
    const 바닥 = 목록.scrollHeight - 목록.scrollTop - 목록.clientHeight < 60;
    const 전 = 목록.scrollTop;
    목록.innerHTML = proom엮기().map(proom줄HTML).join("")
      || `<p class="pr-empty">아직 아무 말도 없어요.<br>쉴 때 떠들어 보세요.</p>`;
    목록.scrollTop = 바닥 ? 목록.scrollHeight : 전;
  }

  /** 모양이 달라졌으면 틀부터, 아니면 줄만 */
  function proom그리기() {
    const box = el("dock-body-proom");
    if (!box) return;
    if (_proom틀 !== proom틀모양() || !box.querySelector(".pr-board")) proom틀짓기();
    else proom줄그리기();
  }

  /* =====================================================================
     서버 — 판을 열 때에만. 대화와 인원뿐, 시계는 안 오갑니다
     ===================================================================== */
  function proom듣기() {
    if (!window.db) return;
    /* 🧹 어제까지의 대화는 그날 처음 여는 사람이 쓸어냅니다 (콩 2026-08-30) */
    window.자정방청소?.("proom", "proomSweepDay");
    if (!_proomRef) {
      _proomRef = window.db.ref("proom").orderByChild("time").limitToLast(PROOM_MAX);
      _proomRef.on("value", (snap) => {
        const raw = snap.val() || {};
        _proomRows = Object.keys(raw).map((id) => {
          const v = raw[id] || {};
          const msg = String(v.msg || "");
          if (!msg.trim()) return null;
          return { id, user: String(v.user || ""), msg: msg.slice(0, PROOM_LEN), time: Number(v.time) || 0 };
        }).filter(Boolean)
          /* 동률이면 push 열쇠로 — 비밀방과 같은 결 */
          .sort((a, b) => a.time - b.time || String(a.id).localeCompare(String(b.id)));
        proom줄그리기();
      });
    }
  }

  function proom그만듣기() {
    try { _proomRef?.off(); } catch (e) {}
    _proomRef = null;
    clearInterval(_proom시계기); _proom시계기 = null;
  }

  /* =====================================================================
     ★★★ [고침 2026-08-30 — 콩 신고 "인원이 2명인데 배지는 1"]
     ---------------------------------------------------------------------
     [무슨 일이 있었나]
     인원을 **두 군데서** 세고 있었습니다.
       · 판 안의 "n명"  ← proomHere 노드 (판을 연 사람만 구독)
       · 알약 배지       ← status 의 proom 칸 (모두가 이미 듣는 자리)
     둘이 어긋난 까닭은 proomHere 에 **유령이 남기 때문**입니다.
     onDisconnect 예약은 **그 연결 하나에만** 걸려서, 끊겼다 다시 붙으면
     사라져 있어요. 그러면 나간 사람이 영영 명단에 남습니다.
     ★ 이 방이 화면 공유에서 똑같이 데인 자리예요 — 거기서는 재연결마다
       예약을 다시 걸어서 막았습니다(script_share.js 의 맥살피기).

     [그래서 — 세는 곳을 하나로]
     proomHere 를 **통째로 걷어냈습니다.** status 쪽은
       · 이미 모두가 듣고 있고 (새 구독 0)
       · isOnline 로 걸러서 **저절로 청소되며**
       · 알약 배지와 같은 숫자라 어긋날 수가 없습니다.
     ★ 노드 하나, 구독 하나, 쓰기 하나, onDisconnect 함정 하나가 함께
       사라졌습니다. **고치는 대신 없앨 수 있으면 없애는 쪽이 낫습니다.**
     ===================================================================== */
  window.proomSetCount = function (n) {
    _proom인원 = Math.max(0, Number(n) || 0);
    const c = el("proom-cnt");
    if (c) c.textContent = (_proom인원 || 1) + "명";
  };

  /* =====================================================================
     👋 입장 줄 (2026-08-30 — 콩 "누군가 창을 열면 입장했다고 표시")
     ---------------------------------------------------------------------
     ★ 서버 쓰기 0 — 이 파일의 제1원칙 그대로입니다.
     "누가 방에 있나" 는 status 에 이미 실려 옵니다 (proom 칸 — 알약
     배지와 판의 "n명" 이 쓰는 그 재료). script_realtime 이 명단을
     넘겨주면, **없던 닉이 나타난 순간**을 입장으로 칩니다.

     [일부러 이렇게 둔 것들]
       · 내가 열기 **전**의 입장은 못 봅니다 — 첫 명단은 "이미 있던
         사람들" 이라 줄을 안 만들어요. 구분 줄과 달리 입장은 지난
         것을 계산으로 되살릴 수 없습니다 (서버에 안 적으니까).
       · 명단은 하트비트를 타므로 몇 초쯤 늦을 수 있습니다. 다만
         openProom 이 updateStatus(true) 로 곧장 알리니 보통 금방 떠요.
       · 연결이 출렁이면 같은 사람이 명단에서 잠깐 사라졌다 돌아올 수
         있습니다 — 5분 안의 재등장은 입장으로 안 칩니다.
       · 퇴장 줄은 안 만듭니다 (콩이 청한 건 입장뿐 — 나가는 건 조용히).
     ===================================================================== */
  const PROOM_재입장무시 = 5 * 60 * 1000;

  window.proomSetHere = function (명단) {
    if (!_proom열림) { _proom명단 = null; return; }   // 닫혀 있으면 기준도 버립니다
    const 새 = new Set(Array.isArray(명단) ? 명단 : []);
    if (_proom명단 === null) { _proom명단 = 새; return; }  // 첫 명단 = 이미 있던 사람들
    let 생김 = false;
    const t = proom지금();
    새.forEach((닉) => {
      if (_proom명단.has(닉)) return;
      if (닉 === proomMe()) return;                   // 내 입장은 아래 openProom 에서
      if (t - (_proom입장때[닉] || 0) < PROOM_재입장무시) return;
      _proom입장때[닉] = t;
      _proom입장줄.push({ 입장: true, user: String(닉), time: t });
      생김 = true;
    });
    if (_proom입장줄.length > 40) _proom입장줄 = _proom입장줄.slice(-40);
    _proom명단 = 새;
    if (생김) proom줄그리기();
    proom명단그리기();               // 👥 명단 팝이 열려 있으면 새 얼굴을 반영
  };

  async function proom보내기() {
    const 칸 = el("proom-in");
    const t = String(칸?.value || "").trim().slice(0, PROOM_LEN);
    if (!t || _proomBusy || !window.db || !proomMe()) return;
    _proomBusy = true;
    if (칸) { 칸.value = ""; 칸.focus(); }
    try {
      /* ★ 서버 시각으로 찍습니다 — 비밀방의 "간발의 차 밀림" 과 같은 이치
         (2026-08-30 콩 신고 · 자세한 사연은 script_sroom.js 의 보내기) */
      await window.db.ref("proom").push().set({ user: proomMe(), msg: t, time: firebase.database.ServerValue.TIMESTAMP });
    } catch (e) {
      if (칸) 칸.value = t;
      alert("보내지 못했어요. 연결을 확인해 주세요.");
    } finally {
      _proomBusy = false;
      el("proom-in")?.focus();      // 연달아 칠 수 있게
    }
  }

  /* =====================================================================
     손가락 — 판 안쪽에
     ===================================================================== */
  function proom묶기() {
    const host = el("dock-body-proom");
    if (!host || _proomBound) return;
    _proomBound = true;

    host.addEventListener("click", (e) => {
      /* 🔊 클릭은 전부 소리 자물쇠의 열쇠입니다 — 어디를 눌러도 풀어 둬요 */
      proom소리풀기();
      const 글씨 = e.target.closest("[data-proom-font]");
      if (글씨) { proom글씨바꾸기(Number(글씨.dataset.proomFont)); el("proom-in")?.focus(); return; }
      if (e.target.closest("[data-proom-cnt]")) { proom명단토글(); return; }
      if (e.target.closest("[data-proom-bell]")) { proom종바꾸기(); el("proom-in")?.focus(); return; }
      if (e.target.closest("[data-proom-send]")) { proom보내기(); return; }
    });
    /* 엔터로 보내기 — ★ 한글 조합 중은 무시합니다 */
    host.addEventListener("keydown", (e) => {
      proom소리풀기();               // 🔊 타이핑도 열쇠
      if (e.target?.id !== "proom-in") return;
      if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      proom보내기();
    });
  }

  /* =====================================================================
     ★★ 내리기 ≠ 나가기 (2026-08-30 — 콩 "습관처럼 창을 내리는 멤버가 많아")
     ---------------------------------------------------------------------
     다른 판들은 내려도 방이 돌아가니, 다들 뽀모방도 그런 줄 알고
     내렸다가 영문도 모르고 퇴장당했습니다. 그래서 **그 믿음대로**
     동작하게 바꿨어요:
       · 알약으로 내리기  → hideProom()  — 방에 남습니다. 시계·듣기·
         토마토 판정·알림음 전부 계속 돌아요. 판의 DOM 은 hidden 일 뿐
         그대로 있어서, 250ms 시계도 멈출 것 없이 그냥 둡니다 (비용은
         감춰진 글자 몇 개를 고쳐 쓰는 정도 — 잽니다).
       · ✕ 로 닫기       → closeProom() — 진짜 나가기. 예전 그대로.
     "판이 열려 있나(_proom열림)" 는 이제 "방에 참여 중인가" 라는 뜻이
     됐습니다 — 내려도 true 예요. imInProom·입장 줄·🍅 판정이 다 이걸
     보므로, 내려둔 사람도 방에 있는 것으로 칩니다 (그게 요점입니다).
     ===================================================================== */

  /** 알약 판이 열릴 때 — 내려뒀다 다시 편 것이면 입장이 아닙니다 */
  function openProom() {
    proom묶기();
    proom소리풀기();                 // 🔊 판을 여는 그 클릭이 첫 열쇠입니다
    proom시차맞추기();
    const 다시펴기 = _proom열림;     // 내려뒀던 판을 도로 편 것
    _proom열림 = true;
    if (!다시펴기) {
      _proom들어온때 = proom지금();  // 🍅 — 바퀴 시작 전부터 있었나 견주는 기준
      /* 👋 내 입장은 내 손으로 한 줄 — 남들 화면에는 status 를 타고
         각자의 기기가 그립니다 (proomSetHere 는 내 닉을 건너뜁니다) */
      if (proomMe()) {
        _proom입장줄.push({ 입장: true, user: proomMe(), time: proom지금() });
        _proom입장때[proomMe()] = proom지금();
      }
      _proom옛단계 = null;           // 열자마자 소리가 나지 않게
    }
    proom그리기();
    proom듣기();
    /* ★ 시계는 여기서 돕니다. **나가야** 멈춰요 — 내려둔 동안에도
       단계 전환(소리·토마토)을 알아채야 하니까요. */
    clearInterval(_proom시계기);
    _proom시계기 = setInterval(proom시계, 250);
    setTimeout(() => el("proom-in")?.focus(), 60);
    /* ★ 곧바로 알립니다. 안 하면 다음 하트비트(최대 15초)까지 남들 화면에
       내가 안 보여요 — 들어왔는데 아무 표시가 없으면 고장으로 읽힙니다. */
    if (!다시펴기) { try { window.updateStatus?.(true); } catch (e) {} }
  }

  /** 알약으로 내리기 — 방에는 남습니다. 하던 일을 하나도 안 멈춰요. */
  function hideProom() {}

  function closeProom() {
    _proom열림 = false;
    /* 📊 알약을 원래 모습으로 — 내려둔 채 방을 나가면(closeAll) 시계가
       멈춰서, 시계 속 되살리기가 다시는 안 돕니다. 여기서 마무리해요. */
    {
      const 알약 = document.getElementById("dock-pill-proom");
      if (알약) {
        알약.classList.remove("rest", "joined");
        알약.style.removeProperty("--pr-pct");
        const 라벨 = 알약.querySelector(".dock-pill-label");
        if (라벨 && 라벨.dataset.orig) 라벨.textContent = 라벨.dataset.orig;
      }
    }
    _proom들어온때 = 0;              // 나갔으면 다시 들어와야 셉니다
    /* 👋 입장 줄은 이 방문의 것 — 닫으면 비우고, 다시 열면 새로 봅니다 */
    _proom명단 = null; _proom입장줄 = []; _proom입장때 = {};
    proom그만듣기();
    try { window.updateStatus?.(true); } catch (e) {}
  }
  /* ⏱️ 내가 방에 있나 — script_realtime.js 의 updateStatus 가 물어봅니다.
     ★ 이 한 줄 덕에 **새 구독이 하나도 안 생깁니다.** 카드 정보(status)에
       얹혀 나가고, 그건 이미 모두가 듣고 있으니까요. */
  window.imInProom = () => _proom열림;
  window.openProom = openProom;
  window.hideProom = hideProom;
  window.closeProom = closeProom;
})();
