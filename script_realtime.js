/* TheMagam © 그링링 · 무단 복제·재배포 금지 */

  /* =====================================================================
     🛡️ 관리자 상수 — ★ 관리자를 바꾸려면 이 두 줄만 고치면 됩니다.

       ADMIN_NICK : 이 닉네임으로 입장한 사람에게만 숨은 문이 반응합니다.
                    여기만 고치면 관리자가 바뀝니다.
       ADMIN_PIN  : 숨은 문을 열 때 물어보는 번호. 자릿수 제한은 없습니다.

     ※ 관리자 페이지(script_admin.js) 에도 같은 값이 들어 있습니다.
       두 파일은 반드시 함께 고쳐야 해요 — 동기 필요!

     ※ 이것이 진짜 잠금장치가 아니라는 점을 분명히 해둡니다.
       - 코드가 공개돼 있어서 누구나 이 값을 읽을 수 있습니다.
       - 브라우저 개발자도구에서 아래 한 줄이면 검사를 건너뜁니다.
             AppSession.setItem("adminPinOk", "true")

       즉 이 PIN 은 "실수로 관리자 기능을 누르는 것"을 막아줄 뿐,
       마음먹은 사람을 막지는 못합니다.

       정말로 막으려면 파이어베이스 보안 규칙으로 서버에서 걸러야 합니다.
       함께 넣어둔 "설치안내.md" 의 규칙 예시를 보세요.
     ===================================================================== */
  const ADMIN_NICK = "링가링🍄";     // ← 관리자 닉네임 (2026-08-13 그링링🍄 → 링가링🍄)
  const ADMIN_PIN  = "09129823";     // ← 관리자 PIN

  let _statusCache = null;
  /* ※ _statusRef 는 여기서 선언하지 않습니다 — script_core.js 가 이미
     `let _statusRef` 로 세워 둔 이름을 **같이 쓰는** 것이라, 여기서 또
     선언하면 이름이 겹쳐 두 파일 중 뒤엣것이 통째로 죽습니다.
     (이 방의 script_*.js 들은 IIFE 로 감싸여 있지 않아 한 그릇을 씁니다) */
  Object.defineProperty(window, '_statusCache', {
    get() { return _statusCache; },
    set(v) { _statusCache = v; },
    configurable: true
  });
  let _headerIntervalId = null;
  let _clearRef = null;
  let _lastClearedAt = 0;

  /* 지난 1차 수정(서버 시각 기록 + 판정 창 확대)은 아래 2차 수정에 흡수됐습니다.
     lastSeen을 서버 시각으로 쓰는 부분은 그대로 유지합니다. */

  /* ===================================================================
     [FIX 3차] 창을 내려두거나 오래 방치하면 목록에서 사라지던 문제

     지난번에 "서버가 보기에 연결돼 있는가"(disconnectedAt)를 기준으로
     바꿨는데, 보조 장치로 남겨둔 lastSeen 검사가 발목을 잡았습니다.

       lastSeen 은 15초마다 도는 JS 타이머가 갱신합니다.
       그런데 브라우저는 가려진 탭·최소화한 창의 타이머를 늦추다가
       아예 멈춥니다. 크롬은 5분쯤 지나면 1분에 한 번, 더 지나면 정지.
       그러니 소켓은 멀쩡히 붙어 있는데도 lastSeen 이 낡아가고,
       15분이 지나면 다른 사람 화면에서 사라졌습니다.

     그래서 판단 기준을 정리했습니다.

       disconnectedAt 없음        → 접속 중 (서버가 붙어 있다고 봄)
       disconnectedAt 있고 유예 안 → 접속 중 유지
       disconnectedAt 있고 유예 지남 → 목록에서 제외

     lastSeen 은 "onDisconnect 가 못 돌아 고아로 남은 기록"을 걷어내는
     용도만 남기고 창을 아주 넉넉하게(12시간) 잡습니다. 어차피 나가기
     버튼과 탭 닫기는 즉시 삭제되므로, 짧은 창이 필요하지 않습니다.

     유예도 2분 → 15분으로 늘렸습니다. 절전·창 내림으로 소켓이 잠깐
     끊기는 경우가 흔한데, 2분은 너무 짧았습니다.
     =================================================================== */
  /* [고침 2026-08-05] 15분 → 30분. 크롬 메모리 절약이 탭을 재우면
     탭에 돌아올 때까지 재연결을 못 하는데, 15분으로는 모자랐습니다. */
  /* =====================================================================
     끊긴 뒤 목록에 남겨두는 유예 (2026-08-15 — 30분 → 5분)
     ---------------------------------------------------------------------
     [30분이던 이유] 창을 닫아도 즉시 사라지는 길이 **막혀 있었습니다.**
     마지막 인사(sendBeacon)에 인증 토큰이 안 실려서 서버가 거부했거든요.
     그래서 창을 닫은 사람도 이 유예를 다 채워야 사라졌고, 그만큼 넉넉히
     잡아 둘 수밖에 없었습니다. 그 길을 뚫었으니(script_core.js 의
     withAuth) 이제 유예는 **비정상 상황만** 덮으면 됩니다 —
     노트북 덮기, 와이파이 끊김, 브라우저 강제 종료.

     [왜 5분인가] 짧을수록 좋은 게 아닙니다. 유예가 끝나 카드가 사라진
     사람이 돌아오면 detectJoins 가 **새로 온 사람으로 보고 입장 알림을
     다시 띄웁니다.** 지하철·엘리베이터에서 잠깐 끊긴 사람이 나갔다
     들어온 것처럼 보여요. 1~2분은 그래서 안 됩니다.
     5분이면 노트북을 잠깐 덮는 정도는 덮으면서, 진짜 나간 사람은
     오래 안 남습니다.
     ===================================================================== */
  const DISCONNECT_GRACE_MS = 5 * 60 * 1000;
  const ONLINE_STALE_MS     = 12 * 60 * 60 * 1000; // 고아 기록 정리용 (아주 넉넉히)
  const HEADER_TICK_MS      = 30 * 1000;

  /** 이 사람을 접속 중으로 볼 것인가 */
  function isOnline(row, now) {
    if (!row) return false;

    const disc = Number(row.disconnectedAt || 0);
    if (disc > 0 && now - disc >= DISCONNECT_GRACE_MS) return false;

    // 고아 기록만 걷어냅니다 (하루 지난 기록 등)
    const seen = Number(row.lastSeen || 0);
    if (seen > 0 && now - seen >= ONLINE_STALE_MS) return false;

    return true;
  }
  window.isOnline = isOnline;

  // 서버-클라이언트 시각 차이 (ms). .info/serverTimeOffset이 채워줍니다.
  let _serverOffset = 0;
  function serverNow() { return Date.now() + _serverOffset; }
  window.serverNow = serverNow;

  try {
    db.ref(".info/serverTimeOffset").on("value", s => {
      const v = Number(s.val());
      if (Number.isFinite(v)) _serverOffset = v;
    });
  } catch (e) {
    console.warn("[serverTimeOffset 구독 실패 — 로컬 시계로 대체]", e);
  }

  let _seenMsgKeys = new Set();

  let _msgLiveQuery = null;
  let _messagesListening = false;

  /* [뺌 2026-08-06] 뽀모가 개인 타이머가 되면서 seq·중복 방지 장치가
     필요 없어졌습니다. 서버에서 오는 이벤트가 아예 없으니까요. */

  // =====================================================
  // UI helpers
  // =====================================================
  function clearChatUI() {
    const box = document.getElementById("chat-box");
    if (box) box.innerHTML = "";

    if (typeof lastRendered !== "undefined") {
      lastRendered = { user: null, ts: 0, ymd: null, msg: "" };
    }
    if (typeof unreadCount !== "undefined") unreadCount = 0;

    const floatBtn = document.getElementById("new-msg-float");
    if (floatBtn) floatBtn.classList.add("hidden");

    _seenMsgKeys = new Set();
  }
  window.clearChatUI = clearChatUI;

  function detachMessageListeners() {
    try { if (_msgLiveQuery) _msgLiveQuery.off(); } catch(e) {}
    try { if (_clearRef) _clearRef.off(); } catch(e) {}

    _msgLiveQuery = null;
    _clearRef = null;
    _messagesListening = false;
  }
  window.detachMessageListeners = detachMessageListeners;

  window._renderMessageLocal = function(key, data){
    try {
      if (!key || !data) return;
      if (_seenMsgKeys.has(key)) return;
      _seenMsgKeys.add(key);
      window.renderChatMessage?.(document.getElementById("chat-box"), data, key);
      window.scrollChatToBottom?.(true);
    } catch(e){}
  };

  /* [2026-08-09] isPresenceSystemMsg 는 지웠습니다.
     지난 대화에서 입장·퇴장을 빼면서 부르는 곳이 없어졌어요.
     (지금 접속 중의 입장·퇴장 표시는 script_ui.js 쪽이 맡습니다) */


  // =====================================================
  // Header online list
  // =====================================================
  function updateChatHeader() {
    /* [2026-08-03] 접속 현황은 채팅 머리말이 아니라 맨 위 브랜드 줄의
       레드 박스(#head-count)에 보여줍니다. 닉 목록은 툴팁으로. */
    if (!myNick) return;
    if (_statusCache) {
      const online = [];
      const now = serverNow();
      for (let nick in _statusCache) {
        if (isOnline(_statusCache[nick], now)) online.push(nick);
      }
      const hc = document.getElementById("head-count");
      if (hc) {
        hc.textContent = `${online.length}명 집필 중`;
        hc.title = online.join(", ");
      }
      /* 📊 오늘 접속 띠 — 지금 인원을 이 시간대 기록에 남깁니다 */
      기록해두기(online.length);
    }
  }

  /* =====================================================================
     📊 오늘 접속 띠 (2026-08-18) — 알약 줄 위 24칸 막대
     ---------------------------------------------------------------------
     [무엇을 보여주나] "이 시간대에 몇 명까지 있었나". 평균이 아니라
     **그 시간의 최다 인원**입니다 (콩 확정) — "지금 방이 붐비나?" 를
     보는 용도라 이게 맞고, 셈이 단순해서 통신도 최소예요.

     [왜 관리자 페이지 방식을 못 쓰나]
     저기는 모두의 timeSegs 를 읽어 접습니다. 그런데 0817에 개인정보를
     좁히면서 **일반 멤버는 남의 timeSegs 를 못 읽습니다.** 그래서 길을
     달리 냈어요.

     [roomStat/{날짜}/{시} = 그 시간대 최다 인원]
     각자 하트비트(30초)를 돌 때 "지금 인원이 이 시간 기록보다 많나?" 만
     보고, 많을 때만 숫자 하나를 덮어씁니다.
       ★ 보안규칙이 **더 큰 값만** 받습니다. 줄이는 쓰기가 막히면
         여럿이 동시에 써도 결과가 같아요 — 경쟁 조건이 아예 없습니다.
       ★ 하루에 몇 번 안 일어나는 쓰기라 통신량은 사실상 0.
         읽는 쪽도 숫자 24개뿐이라 카드 한 장보다 가볍습니다.
       ★ 안 켠 사람은 **읽지도 않습니다** (구독을 아예 안 걸어요).
         기록은 남는 일이라 나중에 켜도 오늘 것이 그대로 보입니다.
     ===================================================================== */
  /* =====================================================================
     [2026-08-18 늘림] 띠에 **네 가지**를 갈아 끼웁니다 (설정에서 고름)
     ---------------------------------------------------------------------
       live  📊 오늘 접속 인원        막대 — roomStat (위 설명)
       wall  ✍️ 이번 달 방 전체 글자수  꺾은선 — wordlog (공개 읽기)
       wmine ✍️ 이번 달 나의 글자수     꺾은선 — wordlog 에서 내 것만
       tmine ⏱️ 이번 달 나의 작업 시간  꺾은선 — 내 timeSegs (loadSummary)

     ★ 방 전체 **작업 시간**은 없습니다 — 0817에 남의 timeSegs 읽기를
       막았기 때문입니다. 하려면 공개 합계 노드를 새로 둬야 하는데,
       관리자 초기화 같은 일이 있으면 합계가 어긋나요.

     [읽기 비용] 한 달치 wordlog 이 54KB 안팎. **열 때 한 번(once)** 만
     읽고, 오늘 것은 글자수 기능이 이미 걸어 둔 구독에 얹습니다 —
     지난 날짜를 다시 받지 않아요. 내 작업 시간은 내 노드 하나뿐입니다.
     ===================================================================== */
  /* [2026-08-18 또 늘림] **여러 개를 한꺼번에** 볼 수 있습니다 (콩).
     띠 하나가 450px 남짓이라 **두 개씩 한 줄**, 넘치면 아랫줄로 접힙니다:

         내 작업   //  내 글자수
         오늘 접속  //  전체 글자수

     (항목 고르기는 2026-08-22 에 없앴습니다)
  /* [철거 2026-08-22] PULSE_KEY · PULSE_WHAT_KEY — 띠를 켜고 끄던 값.
     기기에 남아 있어도 이제 아무도 안 읽습니다. */
  /* 🖼️ 방 배경 현황판 (2026-08-21 — 콩)
     ★ 기본이 **켜짐**입니다. 목적이 "이 방이 이렇게 굴러간다"를 보여 주고
       옆 사람을 끌어들이는 것이라, 아무도 안 켜면 뜻이 없어요.
       보기 싫은 사람은 설정에서 끄면 됩니다. */
  const BOARD_KEY = "roomBoard";

  /* ★★★ [되살림 2026-08-22] 아래 셋은 **선언이 사라져 있었습니다.**
     띠를 걷어내면서 `const PULSE_ALL …` 부터 잘라냈는데, 바로 아래에
     붙어 있던 이 선언들까지 같이 딸려 갔어요. 쓰는 코드는 그대로 남아서
     ReferenceError 가 나고, 그 순간 **뒤 코드가 통째로 멈췄습니다.**

       기록해두기()  → 하트비트가 죽음 → 내 상태가 안 올라감
       막대띠()      → drawBoard 가 죽음 → 배경 현황판이 안 뜸
       배경판살피기() → renderUserCards 끝에서 죽음 → 그 뒤가 다 멈춤
                       (남의 카드·시간 집계·인사 팝업·상태표…)

     ★ 앞으로 무언가를 잘라낼 때는 **바로 아래 줄에 남의 선언이 붙어
       있지 않은지** 꼭 보세요. 주석 덩어리는 티가 나는데 선언은 조용합니다. */
  let _pulseRef = null;
  let _pulse    = {};                     // { 시: 그 시각 최다 인원 }
  let _pulseDay = "";                     // 지금 듣고 있는 날짜
  /* =====================================================================
     [철거 2026-08-22 — 콩] 📊 각종 현황 띠
     ---------------------------------------------------------------------
     알약 줄 위에 뜨던 띠(오늘 접속 막대 · 이번 달 꺾은선 셋)를 없앴습니다.
     🖼️ 방 배경 현황판이 같은 자리를 더 잘 하고 있어서요 — 판을 열어도
     안 사라지고, 늘 보이고, 카드를 안 가립니다.

     ★ 남긴 것: 막대띠() 와 roomStat 구독. 배경판이 그대로 씁니다.
     ★ 없앤 것: PULSE_ALL · pulseWhat · setPulse · togglePulseWhat ·
                꺾은선읽기 · 꺾은선띠 · drawPulse · .room-pulse
     ★ 되살리지 마세요. 되살리려면 배경판과 겹치는지부터 보고요.
     ===================================================================== */
  /* =====================================================================
     [2026-08-22 — 콩] 배경 현황판은 **늘 켜집니다.** 끄는 길을 없앴어요.
     ---------------------------------------------------------------------
     [왜]
     ① 켜고 끄는 체크를 두었더니 **아무도 모르고 안 봤습니다.** 기본이
        켜짐인데도 화면에 안 뜨는 일이 있었고(아래 참고), 그러면 다들
        "원래 없는 것" 으로 여기게 돼요.
     ② 이건 배경입니다. 카드를 안 가리고, 클릭도 안 막고, 새로 읽는
        자료도 없어요. 끌 이유가 마땅치 않습니다.
     ③ 작업방 정보를 어디까지 내걸지는 **방장이 정할 몫**입니다 (콩).

     ★ 함수는 남깁니다 — listenPulse 가 이 값을 보고 roomStat 을 붙여요.
       나중에 다시 끄고 싶어지면 여기 한 줄만 되돌리면 됩니다.
     ===================================================================== */
  function boardOn() { return true; }

  /* 이 시간대 기록 남기기 — 더 클 때만 (규칙도 같은 조건이라 헛걸음이 없음) */
  function 기록해두기(n) {
    if (!myNick || !window.db || !(n > 0)) return;
    const d = ymd(Date.now());
    const h = String(new Date().getHours()).padStart(2, "0");
    /* 내가 아는 값보다 크지 않으면 서버에 묻지도 않습니다 */
    if (d === _pulseDay && Number(_pulse[h] || 0) >= n) return;
    try {
      db.ref(`roomStat/${d}/${h}`).transaction(v =>
        (Number(v) || 0) >= n ? undefined : n);   // undefined = 그만두기 (쓰기 없음)
    } catch (e) {}
  }

  /* roomStat 구독 — 이제 🖼️ 배경 현황판 하나만 씁니다 (2026-08-22).
     ★ 꺼 둔 사람은 **읽지도 않습니다.** 띠 시절부터 지켜 온 약속이에요. */
  function listenPulse() {
    if (!window.db) { stopPulse(); return; }
    if (!boardOn()) { stopPulse(); return; }
    const d = ymd(Date.now());
    if (_pulseRef && _pulseDay === d) { drawPulse(); return; }
    stopPulse();
    _pulseDay = d;
    _pulseRef = db.ref("roomStat/" + d);
    _pulseRef.on("value", s => { _pulse = s.val() || {}; drawPulse(); });
  }
  function stopPulse() {
    try { _pulseRef?.off(); } catch (e) {}
    _pulseRef = null; _pulseDay = "";
  }

  /* [철거 2026-08-22] drawPulse() — 알약 줄 위 띠를 그리던 곳.
     이제 배경 현황판(drawBoard)만 남습니다. */
  function drawPulse() { drawBoard(); }

  /* 📊 오늘 접속 인원 — 24칸 막대 */
  function 막대띠() {
    const 지금 = new Date().getHours();
    let 최다 = 0;
    for (let h = 0; h < 24; h++) 최다 = Math.max(최다, Number(_pulse[String(h).padStart(2, "0")] || 0));
    const 칸 = [];
    for (let h = 0; h < 24; h++) {
      const v = Number(_pulse[String(h).padStart(2, "0")] || 0);
      const 앞날 = h > 지금;
      const 키 = 앞날 ? 5 : Math.max(5, (최다 ? v / 최다 : 0) * 39 + 3);
      칸.push(`<span class="rp-b${h === 지금 ? " now" : ""}${앞날 ? " future" : ""}"
                     style="height:${키.toFixed(1)}px"
                     title="${h}시 — ${앞날 ? "아직" : v + "명"}"></span>`);
    }
    return `<span class="rp-lb">오늘</span>
            <span class="rp-bars">${칸.join("")}</span>
            <span class="rp-peak">최다 ${최다}명</span>`;
  }

  /* =====================================================================
     🖼️ 방 배경 현황판 (2026-08-21 — 콩)
     ---------------------------------------------------------------------
     [무엇을 하려는 것인가]
     콩의 말: "작업방이 이렇게 굴러가고 있다는 걸 보여 주면서, 어서 너도
     참여하라고 독려하는 것." 그래서 **판을 열지 않아도 늘 보이는 자리**
     인 카드 마당 배경에 얹습니다.

         위 : 📊 오늘 접속 현황  (24칸 막대 — 띠와 같은 그림)
         아래: 🔥 지금 n명 참여 중 (최근 일곱 줄)

     [지켜야 할 것]
     ① **클릭을 하나도 안 가립니다.** pointer-events: none 이고 카드보다
        뒤(z-index 0)에 섭니다. 카드가 위로 지나가며 가려도 그게 정상이에요
        (최다 동접 19명이면 A자리는 거의 안 가립니다 — 콩 확인).
     ② **새로 읽는 자료가 없습니다.** 막대는 띠가 쓰던 roomStat 구독을
        같이 쓰고, 줄은 글자수 쪽이 이미 받아 둔 wordfeed 를 봅니다.
     ③ 배경 그림 위에 얹히므로 **흐린 판을 깔고 글씨를 짙게** 씁니다.
        (이 방에서 여러 번 데인 자리 — 흔한 회색은 밝은 배경에서 사라져요.)
     ===================================================================== */
  function 언제글(at) {
    const m = Math.floor((Date.now() - (Number(at) || 0)) / 60000);
    if (m < 1) return "방금";
    if (m < 60) return m + "분";
    return Math.floor(m / 60) + "시간";
  }
  const 화글 = (ep, u) => ep + (/^\d+$/.test(String(ep)) ? (u || "화") : "");

  /** 오늘 글자수를 올린 사람 수 — 이미 받아 둔 wordlog 를 셉니다 */
  function 오늘참여자수() {
    try {
      const t = window.Wordcount?._state?.().today || {};
      return Object.values(t).filter(v => Number(v?.total) > 0).length;
    } catch (e) { return 0; }
  }

  /* [추가 2026-08-26 — 콩] 🔥 지금 n명 참여 중 오른쪽 끝에 당일 방 전체
     글자수. 위 "📊 오늘 접속 현황"의 출석글() 과 같은 자리(rb-t-row·
     rb-att)를 그대로 씁니다 — 새 CSS도, 새로 읽는 자료도 없습니다.
     오늘참여자수() 와 같은 _today 를 보므로 요청이 하나도 안 늘어요. */
  function 오늘글자수합() {
    try {
      const t = window.Wordcount?._state?.().today || {};
      return Object.values(t).reduce((a, v) => a + Number(v?.total || 0), 0);
    } catch (e) { return 0; }
  }

  function 흐름줄들() {
    let feed = [];
    try { feed = (window.Wordcount?._state?.().feed || []).filter(f => f && f.type !== "pomo"); }
    catch (e) { return ""; }
    if (!feed.length) {
      return `<p class="rb-empty">아직 조용해요 — 첫 줄을 올려 보세요</p>`;
    }
    return feed.slice(-7).reverse().map(f => {
      const 내것 = !!myNick && f.nick === myNick;
      let 말;
      if (f.kind === "done")       말 = `<b>${escapeHtml(화글(f.ep || "", f.u))} 마침</b>${f.snap ? " · " + comma(f.snap) + "자" : ""} 🎉`;
      else if (f.kind === "start") 말 = `<b>${escapeHtml(화글(f.ep || "", f.u))}</b> 시작`;
      else                         말 = `+${comma(f.add)}자`;
      return `<span class="rb-fl${내것 ? " me" : ""}">
        <span class="rb-who">${escapeHtml(f.nick)}</span>
        <span class="rb-what">${말}</span>
        <span class="rb-ago">${언제글(f.at)}</span></span>`;
    }).join("");
  }

  /* =====================================================================
     🏅 개근 명단 흘리기 (2026-08-22 — 콩)
     ---------------------------------------------------------------------
     "의무 출석일을 채운 멤버들을 느리게 흘러가게."

     [셈은 여기서 하지 않습니다]
     의무 출석일(ruleOf)은 관리자 출석부에만 있습니다. 그걸 여기 한 벌
     더 베끼면 두 곳이 언젠가 어긋나요. 그래서 출석부가 낸 답을
     honors/{YYYY-MM}/list 에 적어 두고(script_admin.js 의 명단굳히기),
     방은 그 **작은 명단 하나만** 읽습니다.
       · 사람이 몇 명 접속하든 읽는 양은 이름 목록 두 줄뿐
       · 방장이 출석부를 새로고침하면 여기도 곧바로 바뀝니다

     [두 달만 봅니다]
     지난 달 · 이번 달. 8월에는 지난 달(7월) 노드가 아예 없으니
     이번 달만 뜹니다 — 따로 막을 것이 없어요.
     이번 달 명단은 의무 출석일을 채워야 생기니 대개 18일 넘어서 뜹니다.

     [자정을 넘겨 켜 둬도]
     달이 바뀌면 듣는 자리도 다시 겁니다 (_honorKeys 로 판별).
     ===================================================================== */
  let _honors = {};        // { "2026-08": ["닉", ...] }
  let _honorRefs = [];     // 지금 듣고 있는 곳 [[ref, handler], ...]
  let _honorKeys = "";     // 다시 걸어야 하나

  function 달키(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  /** [지난 달, 이번 달] */
  function 두달키() {
    const n = new Date();
    return [달키(new Date(n.getFullYear(), n.getMonth() - 1, 1)), 달키(n)];
  }

  function 개근듣기() {
    const keys = 두달키();
    const 표 = keys.join("|");
    if (표 === _honorKeys) return;
    _honorRefs.forEach(([r, h]) => { try { r.off("value", h); } catch (e) {} });
    _honorRefs = [];
    _honors = {};
    _honorKeys = 표;
    keys.forEach(k => {
      try {
        const r = db.ref(`honors/${k}/list`);
        const h = r.on("value", snap => {
          const v = snap.val();
          _honors[k] = Array.isArray(v) ? v : (v ? Object.values(v) : []);
          drawBoard();
        }, () => {});
        _honorRefs.push([r, h]);
      } catch (e) {}
    });
  }

  /** 흘릴 것이 없으면 빈 글을 돌려줍니다 — 칸 자체를 안 그려요 */
  function 개근HTML() {
    const [지난, 이번] = 두달키();
    const 묶음 = [];
    [지난, 이번].forEach(k => {
      const arr = (_honors[k] || []).filter(Boolean);
      if (arr.length) 묶음.push({ 달: Number(k.slice(5)) + "월", 이름: arr });
    });
    if (!묶음.length) return "";

    const 한벌 = 묶음.map(g =>
      `<b class="rb-hm">${g.달}</b>` +
      g.이름.map(n => `<span class="rb-hn">${escapeHtml(n)}</span>`).join("")
    ).join("");

    /* 글이 짧으면 굳이 안 흘립니다 — 한 사람뿐인데 지나갔다 돌아오면
       놀리는 것처럼 보여요. 길 때만 흐르고, 속도는 길이에 맞춰
       **늘 같은 빠르기**가 되게 합니다 (사람이 늘어도 안 빨라져요). */
    const 글자수 = 묶음.reduce((a, g) => a + g.달.length + g.이름.join("").length + g.이름.length * 2, 0);
    if (글자수 <= 26) {
      return `<div class="rb-hrow rb-still">${한벌}</div>`;
    }
    const 초 = Math.max(30, Math.round(글자수 * 1.5));
    return `<div class="rb-hwrap"><div class="rb-hrow" style="animation-duration:${초}s">${한벌}${한벌}</div></div>`;
  }

  /* [추가 2026-08-26 — 콩] 🏅 개근 제목 오른쪽 — `8월 21명, 9월 3명`.
     ★ 같은 _honors 를 개근HTML() 과 함께 보므로 새로 읽는 자료가 없습니다.
     ★ 명단이 없는 달(예: 18일 전의 9월)은 그 달만 조용히 빠집니다 —
       개근HTML() 이 "흘릴 것이 없으면 그 달을 안 넣는" 규칙과 같습니다. */
  function 개근수글() {
    const [지난, 이번] = 두달키();
    return [지난, 이번]
      .map(k => ({ 달: Number(k.slice(5)), n: (_honors[k] || []).filter(Boolean).length }))
      .filter(g => g.n > 0)
      .map(g => `${g.달}월 ${g.n}명`)
      .join(", ");
  }

  /* =====================================================================
     🙋 총원 중 몇 명 출석 (2026-08-23 — 콩)
     ---------------------------------------------------------------------
     "오늘 접속 현황" 제목 옆에 `41명 중 17명 출석`.

     [무엇을 세는가 — 아래 칸과 다릅니다]
     아래 `지금 n명 참여 중` 은 **오늘 글자수를 올린 사람**입니다.
     여기 `출석` 은 **입장 도장**(attendance/{오늘}) — 관리자 출석부가
     세는 것과 똑같은 값이에요. 두 숫자가 다른 게 정상입니다
     (들어와 있지만 아직 글자수를 안 올린 분이 있으니까요).

     [총원]
     `nickOwner` 의 개수. 관리자 출석부도 이걸 명단으로 씁니다 —
     같은 자를 써야 방에서 본 숫자와 출석부 숫자가 안 어긋나요.
     한 판에 한 번만 읽습니다(1.5KB 남짓). 새 멤버가 중간에 들어오면
     다음에 들어올 때 반영돼요 — 총원은 하루에 몇 번 바뀌는 값이 아닙니다.

     [출석 — child_added 로 듣습니다]
     `.on("value")` 로 들으면 누가 도장 찍을 때마다 **오늘 것 전부**가
     다시 옵니다. `child_added` 는 처음에 한 번 훑고, 그 뒤로는
     **새로 찍힌 한 사람분(60바이트 남짓)**만 와요.

     [자정을 넘겨 켜 둬도]
     날이 바뀌면 듣는 자리를 옮기고 0부터 다시 셉니다.
     ===================================================================== */
  let _총원 = 0;
  let _오늘출석 = 0;
  let _출석듣는곳 = null;     // { ref, h }
  let _출석날 = "";
  let _총원읽음 = false;
  let _출석다시그리기 = null;

  /* 처음 들어올 때 도장이 수십 개 우르르 옵니다. 하나마다 그리면
     판을 마흔 번 그려요 — 한 박자 묶어서 한 번만 그립니다. */
  function 출석바뀜() {
    if (_출석다시그리기) return;
    _출석다시그리기 = setTimeout(() => { _출석다시그리기 = null; drawBoard(); }, 250);
  }

  function 출석듣기() {
    const 날 = ymd(Date.now());
    if (날 !== _출석날) {
      if (_출석듣는곳) {
        try { _출석듣는곳.ref.off("child_added", _출석듣는곳.h); } catch (e) {}
      }
      _출석날 = 날;
      _오늘출석 = 0;
      try {
        const r = db.ref(`attendance/${날}`);
        const h = r.on("child_added", () => { _오늘출석++; 출석바뀜(); }, () => {});
        _출석듣는곳 = { ref: r, h };
      } catch (e) { _출석듣는곳 = null; }
    }
    if (!_총원읽음) {
      _총원읽음 = true;
      try {
        db.ref("nickOwner").once("value").then(snap => {
          _총원 = Object.keys(snap.val() || {}).length;
          출석바뀜();
        }).catch(() => {});
      } catch (e) {}
    }
  }

  /** 제목 옆 글. 아직 아무것도 못 읽었으면 빈 글 (숫자 0 을 안 보여줍니다) */
  function 출석글() {
    if (!_총원 && !_오늘출석) return "";
    if (!_총원) return `${_오늘출석}명 출석`;
    return `${_총원}명 중 ${_오늘출석}명 출석`;
  }

  let _board재시도 = 0;
  function drawBoard() {
    const host = document.querySelector(".cards-area");
    let box = document.getElementById("room-board");
    if (!boardOn()) { box?.remove(); return; }
    /* 카드 마당이 아직 안 만들어졌을 수 있습니다 (배치를 다시 짜는 중).
       조금 있다 한 번만 더 두드려 봅니다 — 안 그러면 흐름이 올 때까지
       배경판이 안 뜹니다. */
    if (!host) {
      if (_board재시도 < 3) { _board재시도++; setTimeout(drawBoard, 900); }
      return;
    }
    _board재시도 = 0;
    if (!box) {
      box = document.createElement("div");
      box.id = "room-board";
      box.className = "room-board";
      box.setAttribute("aria-hidden", "true");   // 읽어 주는 기계는 건너뛰게
      /* ★ 카드 격자 **앞**에 넣습니다 — 뒤에 넣으면 카드가 스크롤될 때
         같이 밀려 올라갑니다. 자리는 CSS 가 absolute 로 잡아요. */
      host.insertBefore(box, host.firstChild);
    }
    개근듣기();
    출석듣기();

    /* ★ [바꿈 2026-08-22] 예전에는 이 자리에서 판 전체를 innerHTML 로
       다시 그렸습니다. 개근 명단이 **흘러가는 글**이 되면서 그러면
       안 되게 됐어요 — 줄 하나가 올라올 때마다 흐름이 처음으로 되감겨
       영영 제자리걸음을 합니다.
       그래서 뼈대는 한 번만 세우고, 매번은 **속만** 갈아 끼웁니다.
       개근 줄은 내용이 정말 달라졌을 때만 손대요. */
    if (!box.firstChild) {
      box.innerHTML = `<div class="rb-inner">
        <div class="rb-box">
          <div class="rb-t rb-t-row"><span>📊 오늘 접속 현황</span><span class="rb-att" id="rb-att"></span></div>
          <div class="rb-bars" id="rb-bars"></div>
        </div>
        <div class="rb-box">
          <div class="rb-t rb-t-row"><span id="rb-feed-t"></span><span class="rb-att" id="rb-wc"></span></div>
          <div class="rb-fb" id="rb-feed"></div>
        </div>
      </div>`;
    }
    const n = 오늘참여자수();
    const 막대 = box.querySelector("#rb-bars");
    const 제목 = box.querySelector("#rb-feed-t");
    const 흐름 = box.querySelector("#rb-feed");
    if (막대) 막대.innerHTML = 막대띠();
    const 출석칸 = box.querySelector("#rb-att");
    if (출석칸) 출석칸.textContent = 출석글();
    if (제목) 제목.textContent = `🔥 ${n > 0 ? `지금 ${n}명 참여 중` : "지금 방에서"}`;
    const 글자수칸 = box.querySelector("#rb-wc");
    if (글자수칸) {
      const 합 = 오늘글자수합();
      글자수칸.textContent = 합 > 0 ? `오늘 ${comma(합)}자` : "";
    }
    if (흐름) 흐름.innerHTML = 흐름줄들();

    const 개근 = 개근HTML();
    const 속 = box.querySelector(".rb-inner");
    let 칸 = box.querySelector("#rb-honor");
    if (!개근) { 칸?.remove(); return; }
    if (!칸) {
      칸 = document.createElement("div");
      칸.id = "rb-honor";
      칸.className = "rb-box rb-honor";
      속?.appendChild(칸);
    }
    /* 같은 명단이면 손대지 않습니다 — 손대는 순간 흐름이 되감깁니다 */
    if (칸.dataset.sig === 개근) return;
    칸.dataset.sig = 개근;
    칸.innerHTML = `<div class="rb-t rb-t-row"><span>🏅 개근</span><span class="rb-att">${escapeHtml(개근수글())}</span></div>${개근}`;
  }
  /* 글자수 쪽에서 새 줄이 흘러올 때 불러 줍니다 (자료를 다시 안 읽습니다) */
  window.renderRoomBoard = drawBoard;

  /* =====================================================================
     ★★ 스스로 되살아나기 (2026-08-22 — 콩 신고)
     ---------------------------------------------------------------------
     "접속했을 때 안 떠 있었다. 설정에서 껐다 켜니 보였다."

     배경판은 카드 마당(.cards-area) 안에 넣는데, 화면 배치를 다시 짤 때
     그 마당이 통째로 옮겨 다닙니다(script_layout.js 의 다락 옮기기).
     그 틈에 밀려나면 다시 그릴 계기가 없었어요 — roomStat 이 바뀌거나
     흐름에 새 줄이 올 때까지 빈 화면이었습니다.

     그래서 **카드를 그릴 때마다 자리에 있는지 봅니다.** 있으면 아무 일도
     안 하고(값 비교 없이 요소 하나 찾는 것뿐), 없으면 다시 넣습니다.
     ===================================================================== */
  /* ★★★ [안전벨트 2026-08-22] 여기는 renderUserCards 의 **맨 끝**에서
     불립니다 — 토요일에 방을 얼린 바로 그 길목이에요. 배경판은 있으면
     좋은 것이지 방이 돌아가는 데 꼭 필요한 것이 아닙니다. 그런데 여기서
     예외가 나면 renderUserCards 밖으로 튀어 나가 **그걸 부른 쪽까지**
     멈춰 세웁니다 (남의 카드·시간 집계·인사 팝업·상태표…).

     그래서 배경판이 무슨 일을 겪든 방은 계속 돌게 가둬 둡니다.
     ★ 조용히 삼키지는 않습니다 — console 에 남겨서, 안 뜨면 왜 안 뜨는지
       볼 수 있게 해요. "오류 없이 조용히 틀린" 것이 제일 무섭습니다. */
  function 배경판살피기() {
    try {
      if (!boardOn()) return;
      if (document.getElementById("room-board")) return; // 멀쩡하면 그냥 둡니다
      drawBoard();
    } catch (e) {
      console.warn("[배경판] 그리다 넘어졌습니다 — 방은 그대로 돕니다", e);
    }
  }

  function comma(n) { return Number(n || 0).toLocaleString("ko-KR"); }
  window.drawPulse = drawPulse;

  /* [철거 2026-08-22 — 콩] setPulse · togglePulseWhat.
     띠를 켜고 끄고 항목을 고르던 창구였습니다. 띠가 없어졌으니 함께
     걷어냅니다. 배경 현황판은 setRoomBoard 를 씁니다. */
  window.startPulse = listenPulse;

  /* [철거 2026-08-14] 머리말 한줄 공지(📌 config/notice)를 뺐습니다 —
     그 자리에 시계가 앉았어요 (index.html #head-clock, script_ui.js).
     공지는 📢 공지판과 챗 핀으로 충분합니다 (콩 결정). */

  /* =====================================================================
     📌 방 전체 할 일 진척 — 접속자 명단 맨 아래 한 줄 (2026-08-10)
     ---------------------------------------------------------------------
     todostat/{오늘}/{닉네임} = { total, done } 를 모두 더해 보여줍니다.
     개수뿐이라 누가 무엇을 적었는지는 알 수 없고, 화면에도 합계만
     내걸립니다.

     [왜 status 가 아니라 따로 쌓인 값을 보나]
     status 는 나가면 지워집니다. 4개를 끝낸 사람이 퇴근하면 합계가
     3개로 **줄어들어요.** 다 같이 쌓는다는 감각이 깨집니다.
     todostat 은 하루치로 남아서, 사람이 드나들어도 안 내려갑니다.

     [아무도 안 적은 날]
     줄 자체를 감춥니다. "0개 중 0개" 는 알려주는 게 없으면서
     쓸쓸하기만 해요.
     ===================================================================== */
  let _todoStatRef = null;

  function listenRoomTodo() {
    const day = window.Wordcount?.dayKey?.();
    if (!day || !window.db) return;
    try { _todoStatRef?.off(); } catch (e) {}
    _todoStatRef = db.ref(`todostat/${day}`);
    _todoStatRef.on("value", snap => renderRoomTodo(snap.val() || {}));
  }

  function renderRoomTodo(rows) {
    const wrap = document.getElementById("room-todo");
    const pill = document.getElementById("room-todo-pill");
    if (!wrap || !pill) return;

    let total = 0, done = 0;
    Object.values(rows || {}).forEach(r => {
      total += Math.max(0, Number(r?.total || 0));
      done  += Math.max(0, Number(r?.done  || 0));
    });

    if (total <= 0) { wrap.setAttribute("hidden", ""); return; }
    done = Math.min(done, total);                 // 어긋난 값이 와도 넘치지 않게
    pill.innerHTML = `📌 오늘 할 일 <b>${total}개 중 ${done}개</b> 완료`;
    wrap.removeAttribute("hidden");
  }

  window.listenRoomTodo = listenRoomTodo;
  document.addEventListener("DOMContentLoaded", () => {
    try { bindHeadCountDoor(); } catch (e) {}
    /* 대기 상태(idle)에서는 집중 시간 입력이 곧 표시 시간입니다 */
    const wmIn = document.getElementById("pomo-work-min");
    if (wmIn) wmIn.addEventListener("input", () => {
      const pill = document.getElementById("timer-pill");
      const text = document.getElementById("timer-text");
      if (!pill || !text || pill.dataset.phase !== "idle") return;
      const wm = parseInt(wmIn.value, 10) || 25;
      text.textContent = `${String(wm).padStart(2, "0")}:00`;
    });
  });

  function startHeaderTicker() {
    if (_headerIntervalId) clearInterval(_headerIntervalId);
    _headerIntervalId = setInterval(() => updateChatHeader(), HEADER_TICK_MS);
    window._headerIntervalId = _headerIntervalId;
    updateChatHeader();
  }

  // =====================================================
  // ✅ 업적 오버라이드(테스트 모드): 실제 업적과 병합
  // =====================================================
  /* =====================================================================
     업적(🏆 연속 출석 · 👑 풀출석)은 없앴습니다.

     대신 그 자리에 펫이 들어갑니다. 출석은 "왔다"만 재는 지표라 글을
     썼는지와 무관했습니다. 펫은 실제로 쓴 시간으로만 자라니, 이 방이
     재는 것과 보여주는 것이 같아집니다.
     ===================================================================== */

  // =====================================================
  // status realtime
  // =====================================================
  /* 🚫 내보낸 사람 — 방장이 내보내면 모두의 화면에서 곧바로 사라져야 합니다.

     서버 규칙이 그 사람의 status 쓰기를 막지만, **이미 적혀 있던 값**은
     남아 있습니다(방장이 지우기 전까지, 또는 연결이 끊길 때까지).
     그동안 명단에 계속 떠 있으면 내보낸 뜻이 없어요. 그래서 보는 쪽에서도
     걸러 냅니다. 명단은 누구나 읽을 수 있어 곧바로 반영됩니다. */
  let _banned = {};
  function listenBans() {
    try {
      db.ref("config/ban").on("value", s => {
        _banned = s.val() || {};
        if (_statusCache) renderUserCards(_statusCache);
      });
    } catch (e) {}
  }

  /* =====================================================================
     🏷️ 부방장 명단 (2026-08-17) — config/vice/{닉} = true
     ---------------------------------------------------------------------
     방장 스티커는 상수 하나(ADMIN_NICK)를 견주면 그만이었는데, 부방장은
     넷이고 바뀔 수 있습니다. 그렇다고 상수 배열로 박아 두면 **운영진
     명단(staff)과 두 곳을 고쳐야** 해서 언젠가 어긋나요.

     그래서 관리 페이지에서 운영진을 올리고 내릴 때 이 칸도 함께
     적습니다 — 명단은 하나, 적히는 곳만 둘입니다.

     [왜 staff 를 그대로 안 읽나]
     staff 는 **uid 를 열쇠로** 두고, 보안규칙에서 운영진 본인과 방장만
     읽을 수 있습니다. 카드는 모두가 보는 것이라 일반 멤버도 읽을 수
     있어야 해요. config 는 이미 `.read: true` 라 딱 맞습니다
     (쓰기는 방장만이라 아무나 자기 이름을 넣을 수는 없습니다).

     ★ 닉을 바꾸면 이 칸은 옛 이름으로 남습니다 — 권한(staff, uid 기준)은
       멀쩡하고 스티커만 안 붙어요. 관리 페이지에서 내렸다 올리면 맞습니다.
       (대시보드를 열 때 staff 를 보고 저절로 맞추기도 합니다)
     ===================================================================== */
  let _vice = {};
  function listenVice() {
    try {
      db.ref("config/vice").on("value", s => {
        _vice = s.val() || {};
        if (_statusCache) renderUserCards(_statusCache);
      });
    } catch (e) {}
  }

  /* 📚 낱장 가장자리 선 — 고른 색을 82%로 어둡게 (color-mix 대신 JS 로,
     인라인 style 에 계산식을 넣는 것보다 값이 들어가는 편이 안전해서) */
  function darkenHex(hex, f = 0.82) {
    const n = parseInt(hex.slice(1), 16);
    const d = (v) => Math.round(v * f);
    return "#" + [d(n >> 16 & 255), d(n >> 8 & 255), d(n & 255)]
      .map(v => v.toString(16).padStart(2, "0")).join("");
  }

  /* 카드 프사에 붙는 이름표 — 방장이 먼저입니다 (방장이 부방장 명단에도
     들어 있으면 '방장' 하나만 붙어요. 둘 다 붙으면 겹칩니다). */
  function stampHtml(u) {
    if (u === ADMIN_NICK) return `<span class="card-admin-stamp" aria-label="방장">방장</span>`;
    if (_vice[u] === true) return `<span class="card-admin-stamp is-vice" aria-label="부방장">부방장</span>`;
    return "";
  }

  /* =====================================================================
     👋 입장 인사 (2026-08-20) — 들어오면 화면 가운데 큰 카드
     ---------------------------------------------------------------------
     [왜 가운데 큰 카드인가] 오른쪽 아래 토스트도 만들어 봤지만, 이 방의
     쓸모는 "안 읽고 지나치는 걸 막는 것" 입니다(콩). 뒤를 살짝 어둡게
     덮고 가운데 세우면 안 볼 수가 없어요. 대신 **저절로 안 닫힙니다** —
     [확인]을 눌러야 사라집니다.

     [확인을 누르면 챗창이 열립니다] "발자국 찍기" 를 부탁하는 인사라,
     닫고 나서 챗을 또 찾아 눌러야 하면 절반은 그냥 지나가요. 문을 열어
     주는 데까지가 이 인사의 일입니다.

     [언제 뜨나]  config/hello/{text, at} 에 문구가 **걸려 있을 때만.**
     지우면 아무에게도 안 뜹니다 — 공지 핀과 같은 결이에요.
     같은 문구를 하루에 여러 번 보여주면 잔소리가 되므로 **하루 한 번**,
     다만 방장이 문구를 바꾸면(at 이 바뀌면) 그날 다시 한 번 보여줍니다.
     기억은 이 기기에만 남습니다(AppStore).
     ===================================================================== */
  const HELLO_KEY = "helloSeen";        // "YYYY-MM-DD|at"

  async function showHelloOnce() {
    if (!myNick || !window.db) return;
    let v = null;
    try { v = (await db.ref("config/hello").once("value")).val(); } catch (e) { return; }
    const text = String(v?.text || "").trim();
    if (!text) return;                                   // 안 걸려 있으면 조용히
    const at = Number(v?.at || 0);
    const 오늘 = ymd(Date.now());
    const 도장 = `${오늘}|${at}`;
    try { if (AppStore.getItem(HELLO_KEY) === 도장) return; } catch (e) {}

    const veil = document.createElement("div");
    veil.className = "hello-veil";
    veil.innerHTML = `
      <div class="hello-card" role="dialog" aria-modal="true" aria-label="입장 인사">
        <div class="hello-ic">👋</div>
        <p class="hello-t">${escapeHtml(text).replace(/\n/g, "<br>")}</p>
        <button type="button" class="hello-ok">좋아요!</button>
      </div>`;
    document.body.appendChild(veil);
    requestAnimationFrame(() => veil.classList.add("on"));

    const 닫기 = () => {
      try { AppStore.setItem(HELLO_KEY, 도장); } catch (e) {}
      veil.classList.remove("on");
      setTimeout(() => veil.remove(), 300);
      /* 챗창을 열어 줍니다 — 발자국을 찍으라고 부른 인사니까요 */
      try { window.dockOpen?.("chat"); } catch (e) {}
    };
    veil.querySelector(".hello-ok").addEventListener("click", 닫기);
    /* ★ 바깥을 눌러도 안 닫습니다 — 실수로 흘려보내지 않게(콩).
       [확인] 하나만이 문입니다. */
    setTimeout(() => veil.querySelector(".hello-ok")?.focus(), 340);
  }
  window.showHelloOnce = showHelloOnce;

  function dropBanned(data) {
    if (!data || !_banned) return data;
    let hit = false;
    const out = {};
    Object.keys(data).forEach(n => {
      if (_banned[n]) { hit = true; return; }
      out[n] = data[n];
    });
    return hit ? out : data;
  }

  function listenStatus() {
    _seenOnline = null;   // 다시 붙을 때는 씨앗부터 (옛 목록으로 오알림 방지)
    listenBans();
    listenVice();          // 🏷️ 부방장 스티커 명단 (config/vice)
    /* 📢 공지 목록 — [2026-08-21] 여기로 옮겨 왔습니다.
       예전엔 아래 알약 판이 열릴 때 켜졌는데, 공지가 머리말로 올라가면서
       그 자리가 없어졌어요. 안 읽은 글 빨간 점은 **판을 열기 전에**
       켜져 있어야 뜻이 있으니, 입장할 때 바로 붙입니다. */
    window.listenNoticeBoard?.();
    /* ★ 혹시 두 번 불려도 귀가 겹치지 않게, 붙기 전에 옛 귀를 뗍니다.
       (귀가 둘이면 같은 스냅숏에 renderUserCards 가 두 번 돌아요) */
    try { _statusRef?.off(); } catch (e) {}
    _statusRef = db.ref("status");
    _statusRef.on("value", snap => {
      const data = dropBanned(snap.val() || null);
      _statusCache = data;
      window._statusCache = data;   // ✅ 전역 노출

      detectJoins(data);
      updateChatHeader();
      renderUserCards(data);
      /* 🍅 바깥 고리(오늘 작업 시간)도 같은 값을 보므로 함께 다시 그립니다 */
      window.renderDayRing?.();
      /* 남이 공유를 켜고 끄면 머리말 버튼 색이 따라 바뀝니다 */
      window.renderShareButton?.();
    });
  }

  /* ===================================================================
     입장 감지 — 새로 들어온 사람만 골라냅니다.

     status 리스너는 누가 lastSeen 을 갱신할 때마다 통째로 다시 옵니다.
     그래서 "지금 접속 중인 사람 집합"을 들고 있다가, 직전에 없던
     이름만 새 입장으로 봅니다.

     첫 스냅숏은 씨앗만 심고 알리지 않습니다. 안 그러면 내가 들어올 때
     이미 있던 사람 전원이 "방금 들어왔다"고 뜹니다.

     끊겼다 15분 유예 안에 돌아온 사람은 그 동안에도 접속 중으로
     잡히므로, 집합에서 빠지지 않고 다시 알리지도 않습니다. */
  let _seenOnline = null;   // null = 아직 첫 스냅숏 전

  function detectJoins(data) {
    const now = serverNow();
    const cur = new Set();

    for (const nick in (data || {})) {
      if (isOnline(data[nick], now)) cur.add(nick);
    }

    if (_seenOnline === null) { _seenOnline = cur; return; }

    const fresh = [];
    for (const nick of cur) {
      if (nick === myNick) continue;          // 내 입장은 알리지 않습니다
      if (!_seenOnline.has(nick)) fresh.push(nick);
    }
    _seenOnline = cur;

    if (fresh.length) { try { window.notifyJoin?.(fresh); } catch (e) {} }
  }

  // ✅ [프로필] 카드 그리기를 별도 함수로 분리.
  // 프로필(users/{닉}/profile)이 바뀌었을 때 status 리스너를 다시 태우지 않고
  // 캐시된 데이터로 카드만 다시 그릴 수 있게 하기 위함.
  /* ✅ [FIX] 프로필 사진 깜빡임

     이 함수는 매번 innerHTML을 비우고 카드를 새로 만들었습니다.
     <img src="data:image/jpeg;base64,…">가 새 요소로 교체되니 브라우저가
     그때마다 이미지를 다시 디코딩했고, 그게 깜빡임으로 보였습니다.

     호출 빈도가 상당했습니다.
       · status 리스너 — 각자 15초마다 lastSeen 갱신 (6명이면 분당 24회)
       · 프로필 리스너 — users/{닉} 아래 무엇이든 바뀌면.
                        투두·오늘 목표도 같은 경로라 타이핑할 때마다 발동

     그런데 lastSeen은 화면에 안 나오므로 결과 HTML은 대부분 이전과 똑같습니다.
     → 만들어진 HTML이 직전과 동일하면 DOM을 건드리지 않고 끝냅니다. */
  let _lastCardsHtml = null;
  let _lastCardParts = null;   // { nicks:[…], parts:[…] } — 바뀐 카드만 갈아 끼우기용

  function renderUserCards(data) {
      const list = document.getElementById("user-cards");
      if (!list) return;

      const now = serverNow();

      /* ★ [고침 2026-08-15] 인자 없이 부르면 지금 명단으로 그립니다.
         setMyTag 처럼 "그냥 다시 그려 줘" 하는 자리가 여럿인데, 예전에는
         그 호출이 카드를 **전부 지웠습니다**. 진짜 방에서는 곧이어
         listenStatus 가 다시 그려서 티가 안 났지만, 🧘 혼자 방에서는
         작업 스티커를 붙이는 순간 카드가 통째로 사라졌어요.
         ─ 인자 없음(undefined) = 지금 것 그대로, null = 아무도 없음. */
      if (data === undefined) data = _statusCache;

      if (!data) {
        if (_lastCardsHtml !== "") {
          list.innerHTML = "";
          _lastCardsHtml = "";
        }
        return;
      }

      const parts = [];

      /* [2026-08-04] 내 카드는 항상 맨 앞으로.
         sort 는 안정 정렬이라 내 닉만 앞으로 빼고, 나머지의 기존 순서
         (데이터 순서·접속중 필터)는 그대로 유지됩니다.
         [2026-08-13] 나머지의 순서를 고를 수 있습니다 (설정 → ⚙️ 기본 설정):
           가나다순(기본) — 서버가 주는 순서 그대로 (키가 이름순이라 가나다)
           접속 순서     — 먼저 들어온 사람이 앞 (joinedAt 오름차순) */
      const orderedNicks = Object.keys(data);
      const sortPref = (window.AppStore?.getItem("cardSort")) || "abc";
      if (sortPref === "join") {
        orderedNicks.sort((a, b) =>
          (Number(data[a]?.joinedAt) || Infinity) -
          (Number(data[b]?.joinedAt) || Infinity));
      } else if (sortPref === "random") {
        /* 🎲 랜덤 (2026-08-14) — 입장할 때 한 번 섞고 세션 동안 고정.
           매 렌더마다 굴리면 하트비트(15초)마다 카드가 자리를 바꿔서
           멀미가 납니다. 내 입장 시각을 주사위 씨앗으로 써서 닉마다
           고정 순서값을 만들어요 — 세션 내내 같고, 다음 입장 때 새 배치.
           중간에 들어온 멤버도 같은 씨앗으로 셈해져 남들은 안 움직입니다. */
        const seed = Number(window._myJoinTimestamp?.() || 0);
        /* FNV 방식 — 씨앗과 글자를 XOR 한 뒤 곱해서 섞습니다.
           (처음엔 h*31+글자 로 했다가, 씨앗이 전원에게 같은 값만 더해서
            순서가 안 바뀌는 산수 버그가 있었어요 — 곱셈으로 얽어야 섞입니다) */
        const dice = (nick) => {
          let h = (seed ^ 2166136261) | 0;
          for (const ch of nick) {
            h = Math.imul(h ^ ch.codePointAt(0), 16777619);
          }
          return h >>> 0;
        };
        orderedNicks.sort((a, b) => dice(a) - dice(b));
      }
      orderedNicks.sort((a, b) =>
        (a === myNick ? -1 : 0) - (b === myNick ? -1 : 0));

      for (const u of orderedNicks) {
        const row = data[u] || {};
        if (isOnline(row, now)) {
          const st = row.status || "idle";
          const cls = statusClass(st);
          const badge = st === "writing" ? `<span class="rec-dot"></span>` : "";

          const goalText = row.todayGoalText ? escapeHtml(row.todayGoalText) : "오늘의 한줄 목표 없음";

          // ✅ 업적 표시 (테스트 오버라이드 병합)
          const streakBanner = "";
          const weeklyBanner = "";
          const banners = "";
          const goldCls = "";
          const nameBadges = "";

          // ✅ [프로필] users/{닉}/profile 값을 병합 (없으면 전부 기본값)
          const prof = (window._profileCache && window._profileCache[u]) || {};

          // 카드 강조색 — 좌측 보더. 미설정이면 CSS 기본 토큰 사용

          // 프사 — 사진이 있으면 사진, 없으면 닉네임으로 만든 눈사람
          const photo = window.sanitizePhoto?.(prof.photo) || "";
          const avatar = photo
            /* [고침 2026-08-13] loading="lazy" → decoding="sync".
               사진은 프로필에 저장된 데이터 주소(data:)라 lazy 가 무의미하고,
               사파리는 새 img 를 "빈 칸 먼저, 사진 나중"으로 그려서 카드를
               다시 그릴 때마다 프사가 깜빡였습니다. sync 는 사진을 다 풀고
               나서 화면에 내보내므로 빈 칸이 없어요. */
            ? `<div class="card-avatar has-photo"><img src="${escapeHtml(photo)}" alt="" decoding="sync"></div>`
            : `<div class="card-avatar has-snow">${window.snowmanSvg?.(u) || ""}</div>`;

          // 내 카드에만 편집(연필) 버튼. 프사 위에 떠 있다가 마우스를 올리면 나타납니다.
          /* 카드 배경과 무늬 — 각자 프로필에서 고른 값 */
          const cardBg  = window.sanitizeHexColor?.(prof.cardBg) || "";
          const _legacyInk = window.sanitizeHexColor?.(prof.cardTextColor) || "";
          const inkNick = window.sanitizeHexColor?.(prof.cardNickColor) || _legacyInk;
          const inkGoal = window.sanitizeHexColor?.(prof.cardGoalColor) || _legacyInk;
          const inkWh   = window.sanitizeHexColor?.(prof.cardWhColor)   || _legacyInk;
          const inkStyle = (inkNick || inkGoal || inkWh)
            ? ` style="${inkNick ? `--ink-nick:${inkNick};` : ""}${inkGoal ? `--ink-goal:${inkGoal};` : ""}${inkWh ? `--ink-wh:${inkWh};` : ""}"`
            : "";
          const patId   = window.sanitizePattern?.(prof.cardPattern) || "none";
          const patCol  = window.sanitizeHexColor?.(prof.patColor) || "#D8DEE8";
          /* 📚 낱장 색 (2026-08-18) — 카드 가장자리 겹친 종이 두 장.
             고른 색이 그대로 진하게 들어가고, 가장자리 선만 같은 색을
             살짝 어둡게 — 두 장을 같은 색으로 고르면 한 덩어리로 붙어
             보여서요. 인라인 변수라 테마 낱장색(스튜디오·다크)보다 셉니다. */
          const pg1 = window.sanitizeHexColor?.(prof.pageC1) || "";
          const pg2 = window.sanitizeHexColor?.(prof.pageC2) || "";
          const pgStyle =
            (pg1 ? `--pg1:${pg1};--pg1-line:${darkenHex(pg1)};` : "") +
            (pg2 ? `--pg2:${pg2};--pg2-line:${darkenHex(pg2)};` : "");
          const cardStyle = (cardBg || patId !== "none" || pgStyle)
            ? ` style="${cardBg ? `--cbg:${cardBg};` : ""}--cpat:${patCol};${pgStyle}"`
            : "";
          const patCls = patId !== "none" ? ` pat-${patId}` : "";
          const bgCls  = cardBg ? " has-cardbg" : "";

          /* 🧲 꾸미기 스티커 — 자리 넷. B(프사 옆)만 프사 칸 안에 넣어
             프사를 따라다니게 하고, 나머지는 카드에 직접 붙입니다. */
          const stk  = window.sanitizeStickers?.(prof.stickers) || {};
          const stkC = window.sanitizeStickerColors?.(prof.stickerColors) || {};
          const stkS = prof.stickerShape;   // 모양은 사람당 하나 (알약/테이프)
          const stkP = window.sanitizeStickerPos?.(prof.stickerPos) || {};
          const decoA = window.decoStickerHtml?.("a", stk.a, stkC.a, stkS, stkP.a) || "";
          const decoB = window.decoStickerHtml?.("b", stk.b, stkC.b, stkS, stkP.b) || "";
          const decoC = window.decoStickerHtml?.("c", stk.c, stkC.c, stkS, stkP.c) || "";
          const decoD = window.decoStickerHtml?.("d", stk.d, stkC.d, stkS, stkP.d) || "";
          const decoE = window.decoStickerHtml?.("e", stk.e, stkC.e, stkS, stkP.e) || "";
          /* 자유 배치된 B·E 는 카드 기준 좌표라 카드에 직접 붙입니다.
             기본 자리일 때만 프사 칸 안(프사를 따라다님)에 둡니다 */
          const decoRootExtra = (stkP.b ? decoB : "") + (stkP.e ? decoE : "");
          const decoAvatar = (stkP.b ? "" : decoB) + (stkP.e ? "" : decoE);

          /* 연결 상태 안테나 — 이 사람이 지금 붙어 있는가.
             disconnectedAt 이 남아 있으면 "끊겨서 유예 중"이라는 뜻입니다. */
          const connOk = !Number(row.disconnectedAt || 0);

          const isMine = (u === myNick);

          /* TheMagam — 카드가 곧 조작판입니다. 세 곳이 각자 다른 문을 엽니다.
               프사    → 프로필 설정 (사진·색·무늬)
               상태표  → 상태 고르기 (WORK / 휴식 / 초집중 / 자리비움)
               아래칸  → 오늘 목표와 나의 투두

             그래서 예전의 ✏️ 버튼은 없앴습니다. 프사 자체가 그 버튼이에요. */
          const editBtn = "";

          /* 카드 아래 지표 — 진척 바 + [n / m 완료] ····· [🍅 k]
             둘 다 없는 사람(투두도 없고 뽀모도 안 돈 사람)은 줄 자체를 만들지 않습니다. */
          const tDone  = Math.max(0, Number(row.todoDone  || 0));
          const tTotal = Math.max(0, Number(row.todoTotal || 0));
          const pCount = Math.max(0, Number(row.pomoCount || 0));
          const pct = tTotal > 0 ? Math.round((tDone / tTotal) * 100) : 0;

          /* 진척 바 한 줄 + 그 아래 [3 / 5 완료] ······ [🍅 4].
             숫자 줄은 바와 같은 폭을 쓰므로 양 끝에 정확히 맞습니다. */
          /* [2026-08-03 · B안] 진척 바 대신 오늘 작업 시간(Write+Job)을
             큰 숫자로. WRITE·JOB 중에는 1분마다 값이 갱신돼 타이머처럼
             보입니다. 투두 진척은 카드 팝업에서 봅니다. */
          const _whMs = Math.max(0, Number(row.workMs || 0));
          const _whM = Math.round(_whMs / 60000);
          const whTxt = _whM < 60 ? `${_whM}m`
            : `${Math.floor(_whM / 60)}h${_whM % 60 ? " " + (_whM % 60) + "m" : ""}`;
          void tDone; void tTotal; void pct;
          /* [2026-08-06] 지금 뽀모를 돌리는 중이면 🍅 이 살짝 뜁니다.
             타이머는 각자 것이라 남은 시간은 모릅니다 — "달리는 중"만 보여요.
             집중이면 붉게, 휴식이면 차분하게. */
          const pRun = !!row.pomoRunning;
          const pRest = pRun && row.pomoPhase === "rest";
          const pomoChip = pRun
            ? `<span class="card-pomo-count is-live${pRest ? " is-rest" : ""}"
                     title="${pRest ? "휴식 중" : "집중 중"}${pCount > 0 ? ` · 오늘 ${pCount}회 마침` : ""}"
                     >${pRest ? "☕" : "🍅"}${pCount > 0 ? ` ${pCount}` : ""}</span>`
            : (pCount > 0
                ? `<span class="card-pomo-count" title="오늘 끝낸 집중 세션">🍅 ${pCount}</span>`
                : "");
          /* ⏱️ [2026-08-29 — 콩] 뽀모방에 있으면 카드에 딱지.
             "누가 있는지" 가 보여야 따라 들어가게 됩니다 — 숫자만으로는
             "누가 있나 보다" 에서 그쳐요.
             ★ [자리 바꿈 08-30 — 콩] 🍅 **왼쪽**으로 옮겼습니다.
               🍅 뒤에 오늘 횟수(🍅 4)가 붙으니, ⏱️ 를 오른쪽에 두면
               "4 ⏱️" 처럼 숫자와 딱지가 붙어 읽혀요. 딱지 → 숫자 순이라야
               눈이 안 헷갈립니다. */
          const proomChip = row.proom
            ? `<span class="card-proom" title="⏱️ 뽀모방에 있어요">⏱️</span>` : "";
          const metaBlock = `<div class="card-meta card-wh">
                 <span class="card-wh-t"><small>⏱</small><b>${whTxt}</b></span>
                 ${proomChip}${pomoChip}
               </div>`;

          // 배지 줄 — 왼쪽 업적(트로피·왕관), 오른쪽 상태
          /* 배지 줄은 비웠습니다. 상태표가 위로 올라오고, 그 아래 자리에
             펫이 들어갑니다. */
          const achChips = "";

          /* 펫 — status 에 실려 온 요약으로 그립니다.
             남의 누적 시간을 매번 계산하면 무거워지므로, 각자 자기 값을
             status 에 적어 보냅니다. */

          parts.push(`
            <div class="user-card ${cls}${goldCls}${patCls}${bgCls}${isMine ? " is-me" : ""}"
                 data-card-nick="${escapeHtml(u)}"${cardStyle}>
              <!-- [2026-08-09] 오늘의 작업 스티커 — 프사가 아니라 **카드**
                   왼쪽 위 구석입니다. 그래서 .card-body 바깥, 카드 바로
                   아래에 둡니다 (프사 칸 안에 있으면 프사를 따라다녀요). -->
              ${window.workTagChipHtml?.(row, isMine) || ""}
              ${decoA}${decoC}${decoD}${decoRootExtra}
              <div class="card-body">
                <div class="card-avatar-wrap${isMine ? " is-clickable" : ""}"${
                  isMine ? ' data-edit-profile="1" role="button" tabindex="0"'
                         + ' title="프로필 설정 (사진·색·무늬)"' : ""}>
                  ${avatar}
                  ${editBtn}
                  ${decoAvatar}
                  ${stampHtml(u)}
                </div>

                <div class="card-side">
                  <div class="card-state-row">
                    <span class="card-state ${cls}${isMine ? " is-clickable" : ""}"${
                      isMine ? ' data-pick-status="1" role="button" tabindex="0" title="상태 바꾸기"' : ""
                    }>${escapeHtml(row.statusLabel || statusLabel(st))}</span>
                    <!-- 폭 기준자 — 눈에는 안 보이지만 자리는 차지합니다.
                         가장 긴 상태(🔥초집중🔥)를 모든 카드에 똑같이 심어 두면,
                         상태가 짧은 사람의 카드도 오른쪽 칸 폭이 같아집니다.
                         덕분에 카드마다 프사 크기가 들쭉날쭉해지지 않아요. -->
                    <span class="card-state-ghost" aria-hidden="true">🔥초집중🔥</span>
                  </div>
                </div>
              </div>

              <!-- [2026-08-03] 아래칸은 내 카드만 눌립니다 (목표·투두 팝업).
                   남의 작업시간은 보여주지 않습니다 — 본인만 설정 → 📊 나의 작업. -->
              <div class="card-foot"${inkStyle}${isMine
                ? ` data-record-of="${escapeHtml(u)}" role="button" tabindex="0" title="오늘 목표와 나의 투두"`
                : ""}>
                <span class="card-conn${connOk ? "" : " off"}" aria-hidden="true"
                      title="${connOk ? "연결됨" : "연결이 끊겼어요 (곧 돌아올 수 있어요)"}">
                  <i></i><i></i><i></i><i></i>
                </span>
                ${/* [2026-08-17] 📱 폰 접속 표시 — 접속 점 바로 옆 (A안, 콩 선택).
                     폰인 사람에게만 붙습니다. PC 가 다수라 PC 에 다 붙이면
                     시끄럽기만 해요. 값은 status 의 onPhone (updateStatus 참고). */
                   row.onPhone === true
                     ? `<span class="card-device" title="폰으로 접속 중">📱</span>` : ""}
                <div class="card-name">${escapeHtml(u)}</div>
                <div class="card-goal" title="${escapeHtml(row.todayGoalText || "")}"><div class="goal-line">🎯 ${goalText}</div></div>
                ${metaBlock}
              </div>
            </div>
          `);
        }
      }

      // 결과가 직전과 같으면 DOM을 그대로 둡니다 (이미지 재디코딩 방지)
      const html = parts.join("");
      if (html !== _lastCardsHtml) {
        /* [수술 2026-08-13] 통째로 갈지 않고 **바뀐 카드만** 갈아 끼웁니다.

           15초마다 오는 하트비트로 이 함수가 계속 도는데, 매번 목록
           전체를 innerHTML 로 갈면 모든 프사 <img> 가 새로 태어납니다.
           사파리는 새 img 를 "빈 칸 먼저" 그려서 **전원 프사가 동시에
           점멸**했어요 (실사용 제보). 대개 실제로 바뀐 건 한두 카드라,
           멤버 구성·순서가 같으면 그 카드만 바꿉니다. 안 바뀐 카드의
           img 는 그대로 살아 있으니 깜빡일 일이 없어요. */
        const prev = _lastCardParts;
        const same = prev && prev.nicks.length === orderedNicks.length &&
                     prev.nicks.every((n, i) => n === orderedNicks[i]);
        const domCards = same
          ? list.querySelectorAll(":scope > .user-card:not(.share-card)") : null;
        if (same && domCards.length === parts.length) {
          parts.forEach((p, i) => {
            if (p !== prev.parts[i]) domCards[i].outerHTML = p;
          });
        } else {
          /* 들어오거나 나가서 구성이 달라졌을 때만 통째로.
             [2026-08-10] 이때는 공유 카드도 함께 지워지므로 다시 끼웁니다 */
          list.innerHTML = html;
          window.renderShareCards?.();
        }
        _lastCardsHtml = html;
        _lastCardParts = { nicks: orderedNicks.slice(), parts };
      }
      fixLonelyCard();

      /* ⏱️ [2026-08-29 — 콩] 뽀모방 인원을 알약 배지에 얹습니다.
         ★ **접속 중인 사람만** 셉니다. status 는 나가도 서버에 남아 있어서
           (onDisconnect 로 안 지웁니다), 그냥 세면 어제 들어왔던 사람까지
           잡혀요. 카드를 그릴 때와 **같은 잣대**(isOnline)를 씁니다 —
           화면공유 청소에서 데인 것과 같은 종류의 함정입니다.
         ★ 새로 읽는 자료가 0 입니다. 방금 그린 그 data 를 그대로 셉니다. */
      try {
        /* [2026-08-30 — 콩] 숫자만 세던 것을 **명단**으로 — 판 안의 "n명"
           과 👋 입장 줄이 같은 재료를 씁니다. 새로 읽는 자료는 여전히 0. */
        const 뽀모방명단 = [];
        Object.keys(data || {}).forEach(n => {
          if (data[n] && data[n].proom && isOnline(data[n], now)) 뽀모방명단.push(n);
        });
        const 뽀모방인원 = 뽀모방명단.length;
        window.dockBadge?.("proom", 뽀모방인원);
        /* ★ 판 안의 "n명" 도 **같은 숫자**를 씁니다 (2026-08-30 고침).
           예전엔 판이 proomHere 를 따로 봐서, 유령이 남으면 배지와
           어긋났어요 — 콩이 "2명인데 배지는 1" 로 잡아냈습니다. */
        window.proomSetCount?.(뽀모방인원);
        window.proomSetHere?.(뽀모방명단);   // 👋 입장 줄의 재료
      } catch (e) {}

      startHeaderTicker();
      배경판살피기();   // ★ 배치가 바뀌며 밀려났으면 다시 넣습니다
  }

  /* =====================================================================
     혼자 내려간 카드 구제 (2026-08-13, 콩 요청)
     ---------------------------------------------------------------------
     줄이 꽉 차고 카드 하나가 다음 줄로 넘어가면 그 카드가 외롭습니다.
     그럴 때는 **둘이 같이 내려가게** 합니다 — 윗줄에서 한 장을 더
     데리고 내려와요. 다음 줄이 2장을 넘으면(3장째부터) 다시 위가
     채워질 차례이므로 그대로 둡니다. 몇째 줄이든 같은 규칙입니다.

     방법: 한 줄에 몇 장 들어가는지(C) 재서, 전체가 C로 나눠 나머지가
     1일 때만 끝에서 두 번째 카드 앞에 "줄바꿈 띠"(flex-basis:100%)를
     끼웁니다. 그러면 마지막 두 장이 함께 다음 줄로 내려갑니다.
     한 줄에 2장 이하로 들어가는 좁은 화면에서는 안 합니다 —
     한 장을 데려오면 이번엔 윗줄이 외로워져요.
     ===================================================================== */
  let _lonelySig = "";
  /* 카드 마당 폭 — 창 크기가 바뀔 때만 다시 잽니다 (위 고침 참고) */
  let _마당폭 = 0;
  function 마당폭(list) {
    if (!_마당폭) _마당폭 = list.clientWidth;
    return _마당폭;
  }
  window.addEventListener("resize", () => { _마당폭 = 0; });

  function fixLonelyCard(force) {
    const list = document.getElementById("user-cards");
    if (!list) return;

    /* [2026-08-14] 사람 수·창 폭이 그대로면 다시 재지 않습니다.
       재는 일(getBoundingClientRect)은 브라우저에게 "지금 당장 배치를
       계산하라"고 시키는 것이라, 15초마다 하트비트가 올 때마다 하면
       괜히 화면이 들썩입니다. */
    /* ★★★ [고침 2026-08-29 — 콩 신고 "아이맥에서 타자가 지연된다"]
       위 주석이 "다시 재지 않습니다" 라고 했는데, **재지 않으려고 재고
       있었습니다** — 열쇠(sig)를 만드느라 list.clientWidth 를 읽는데,
       그것부터가 브라우저에게 "지금 배치를 계산하라" 는 명령이거든요.
       하트비트는 사람 수 × 분당 4회로 오니, 20명이면 0.75초에 한 번씩
       배치계산이 끼어듭니다. 그게 콩의 타자와 겹쳤어요.
       ★ 폭은 **창 크기가 바뀔 때만** 새로 잽니다. 그 사이에는 마지막에
         잰 값을 씁니다 — 창이 안 변하면 폭도 안 변하니까요. */
    const cards0 = list.querySelectorAll(":scope > .user-card");
    const sig = cards0.length + "@" + Math.round(마당폭(list) / 20);
    if (!force && sig === _lonelySig) return;
    _lonelySig = sig;

    list.querySelector(".card-row-break")?.remove();

    const cards = list.querySelectorAll(":scope > .user-card");
    const n = cards.length;
    if (n < 4) return;
    const first = cards[0];
    if (!first) return;

    const cs = getComputedStyle(list);
    const gap = parseFloat(cs.columnGap) || 12;
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    /* 여기까지 왔다는 건 사람 수나 창 폭이 진짜로 달라졌다는 뜻입니다.
       이때는 제대로 재요 — 자주 오지 않으니 값을 치를 만합니다. */
    const cw = first.getBoundingClientRect().width;
    if (!cw) return;
    _마당폭 = list.clientWidth;
    const C = Math.floor((_마당폭 - padX + gap) / (cw + gap));
    if (C < 3 || n <= C || n % C !== 1) return;

    const br = document.createElement("div");
    br.className = "card-row-break";
    br.setAttribute("aria-hidden", "true");
    list.insertBefore(br, cards[n - 2]);
  }
  window.fixLonelyCard = fixLonelyCard;

  /* 창 폭이 바뀌면 줄당 장수도 바뀝니다 — 잠깐 기다렸다 다시 잽니다 */
  let _lonelyTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(_lonelyTimer);
    _lonelyTimer = setTimeout(() => fixLonelyCard(true), 150);
  });

  /* 상태 이름. 저장되는 값(writing/focus/rest/away)은 그대로 두고
     화면에 보이는 이름만 바꿨습니다. 기존 데이터가 그대로 살아납니다.
       writing → WORK      focus → 🔥초집중🔥
       rest    → 휴식      away  → 자리비움 */
  function statusLabel(code) {
    /* [2026-08-03] 상태는 Work · Break 둘뿐입니다. 저장값은 그대로
       (writing/rest), 옛 데이터의 focus/away 도 두 이름으로 접힙니다. */
    return ({
      idle:    "☕BREAK☕",
      writing: "🔥WRITE🔥",
      focus:   "💻JOB💻",
      /* 📓 [2026-08-23 — 콩] 병행 작업. 작업 시간에 70% 들어갑니다 */
      multi:   "💻multiT📓",
      rest:    "☕BREAK☕",
      away:    "💤AWAY💤",
      /* 🛠️ [2026-08-22 — 콩] 방장이 방을 손볼 때 거는 표시.
         고르는 건 방장뿐이지만 **읽는 건 모두**라 여기에 있어야 합니다. */
      repair:  "🛠️REPAIR🛠️"
    })[code] || "휴식";
  }

  function statusClass(code) {
    return ({
      idle: "status-rest",
      writing: "status-writing",
      focus: "status-focus",
      multi: "status-multi",
      rest: "status-rest",
      away: "status-away",
      repair: "status-repair"
    })[code] || "status-rest";
  }

  /* 마지막으로 **실제로 보낸** 줄의 지문과 시각 — 같은 화면이면 안 보내려고 */
  let _lastSentSig = "";
  let _lastSentAt  = 0;
  /* 🥗 마지막으로 보낸 **칸별 값** — 달라진 칸만 보내려고 (2026-08-21).
     null 이면 "서버에 뭐가 있는지 모른다" 는 뜻이라 통째로 다시 씁니다. */
  let _lastSentObj = null;
  const STATUS_KEEPALIVE_MS = 5 * 60 * 1000;   // 아무것도 안 변해도 5분에 한 번은

  /** 기억해 둔 지문을 지웁니다 — 다시 이어졌을 때처럼 "서버에 뭐가 남아
      있는지 알 수 없는" 순간에 부릅니다 (script_core.js 재연결 자리).
      ★ 칸별 기억(_lastSentObj)도 함께 버려야 합니다 — 끊긴 사이에 서버
        쪽이 어떻게 됐는지 모르니, 다음 한 번은 통째로 덮어야 해요. */
  window.forgetStatusSig = function () {
    _lastSentSig = ""; _lastSentAt = 0; _lastSentObj = null;
  };

  function updateStatus(force = false) {
    if (!myNick) return;

    const goalText = document.getElementById("db-today-goal-text")?.value || "";
    const done = document.getElementById("db-today-done")?.value || "";
    const statusChoice = document.getElementById("db-status")?.value || "rest";

    /* 카드에 띄울 지표 두 가지.
       둘 다 이미 가지고 있는 값이라 새로 입력받을 건 없습니다.
         - 오늘 할일 진척 : 내 투두 목록의 완료 수 / 전체 수
         - 오늘 뽀모 횟수 : 집중 세션을 끝낸 횟수 (script_ui.js가 세고 있음) */
    /* [고침 2026-08-06] 할 일에 날짜가 생긴 뒤로, 다음 달 것까지 세면
       카드 진척이 부풀어 보였습니다. 프로필 팝업이 보여주는 것과 똑같이
       "오늘 것 + 날짜 없는 것"만 셉니다 (script_data.js 의 같은 규칙). */
    const _todos = (typeof window.todosForProfileList === "function")
      ? window.todosForProfileList()
      : (Array.isArray(window._todoItems) ? window._todoItems : []);
    const todoTotal = _todos.length;
    const todoDone = _todos.filter(t => t && t.done).length;
    const pomoCount = Number(window.getTodayFocusSessions?.() || 0);
    /* [2026-08-06] 지금 집중 중인지 — 남들 카드에 작은 🍅 을 띄우는 용도.
       개인 타이머라 남은 시간은 보내지 않습니다. "달리는 중"만 알립니다. */
    const pomoRunning = (typeof isPomodoroRunning === "function") ? isPomodoroRunning() : false;
    const pomoPhaseNow = pomoRunning ? pomodoroPhase() : "";
    /* [2026-08-07] 지금 화면을 공유 중인지 — 참/거짓 한 칸뿐입니다.

       머리말의 [🖥️ 화면 공유] 버튼을, 남이 공유 중일 때도 옅은 붉은색으로
       물들이려고 둡니다. 그림은 여기 싣지 않아요. screens 를 늘 구독하면
       공유하지도 않는 사람이 5초마다 남의 그림을 내려받게 되고, 그건
       "공유 중인 사람끼리만 본다"는 약속과도 어긋납니다.
       접속자 정보는 어차피 모두가 이미 구독 중이라 통신량도 늘지 않습니다. */
    const shareOn = (typeof window.isScreenSharing === "function")
      ? window.isScreenSharing() === true : false;

    /* [2026-08-17] 📱 폰 접속인지 — 참/거짓 한 칸.
       window.isMobile 은 script_ui.js 가 입장 전에 이미 정해 둔 값이라
       새로 재는 것도 없습니다. 접속 신호에 10바이트쯤 얹힐 뿐이에요.
       ★ 0813에 보류한 users/{닉}/lastDevice(기록으로 남기기)와는 다른
         물건입니다 — 이건 접속 중인 동안만 실려 다니고 서버에 안 쌓여요. */
    const onPhone = window.isMobile === true;

    if (force) {
      window.saveDailyLog?.();
      window.backupLocal?.();
    }

    const 보낼것 = {
      emoji: myEmoji,
      /* [2026-08-13] 언제 들어왔는지 — 카드 정렬(접속 순서)이 씁니다 */
      joinedAt: Number(window._myJoinTimestamp?.() || 0),
      status: statusChoice,
      statusLabel: statusLabel(statusChoice),
      todayGoalText: goalText,
      workMs: Number(window.myTodayWorkMs?.() || 0),
      todayDone: done,
      todoDone,
      todoTotal,
      pomoCount,
      pomoRunning,
      pomoPhase: pomoPhaseNow,
      /* ⏱️ [2026-08-29] 뽀모방에 들어와 있나 — 카드의 딱지와 알약 배지가 씁니다.
         ★ **새 구독을 안 만들려고** 여기에 얹었습니다. status 는 이미 모두가
           듣고 있어서, 칸 하나 더 실어 보내는 값이 사실상 공짜예요.
           (proomHere 를 따로 구독하게 하면 안 여는 사람에게도 통신이 생깁니다)
         ★ status 는 "달라진 칸만" 보내므로, 들고 날 때 한 번씩만 오갑니다. */
      proom: (typeof window.imInProom === "function") ? !!window.imInProom() : false,
      shareOn,
      onPhone,
      /* [2026-08-09] 작업 스티커. 자정 초기화를 그만두면서 날짜 칸
         (tagDay)은 뺐습니다 — 보는 쪽에서 안 쓰는 값이라서요. */
      /* ★ 여기에 || "draft" 를 쓰면 안 됩니다.
         [떼기]를 누르면 값이 빈 문자열이 되는데, 빈 문자열은 거짓이라
         그 자리에서 다시 '원고'로 바뀌어 나갑니다. 실제로 그랬어요 —
         떼도 안 떼지고 원고가 붙었습니다. 없으면 없는 채로 보냅니다. */
      tag: (typeof window.myWorkTag === "function") ? window.myWorkTag() : "",
      /* 펫 요약 — 남들 카드에도 보이게 */
      // ✅ 서버 시각으로 기록 — 각자 PC 시계가 달라도 판정이 흔들리지 않음
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
      // 살아 있다는 뜻 — 끊김 표시를 지웁니다
      disconnectedAt: null
    };

    /* =====================================================================
       💸 같은 화면이면 안 보냅니다 (2026-08-15)
       ---------------------------------------------------------------------
       [무엇이 낭비였나] 한 사람이 한 번 쓰면 그 줄이 **접속한 모두**에게
       내려갑니다. 그래서 통신량이 사람 수의 제곱으로 늘어요. 그런데
         · 카드에 찍히는 시간은 **분 단위** 입니다 ("4h 58m")
         · 30초마다 보내니 **두 번 중 한 번은 똑같은 글자** 를 만들었습니다
         · 쉬는 중(BREAK)·자리비움(AWAY)에는 시간이 아예 안 늘어나는데도
           꼬박꼬박 보냈습니다
       사용량을 재 보니 보름에 4.87GB, 이대로면 무료치 10GB에 닿았어요.

       [어떻게] 보내기 직전에 "남들 화면에 보일 것이 달라졌나" 만 봅니다.
       workMs 는 **분으로 반올림해서** 견줍니다 — 초가 흐르는 건 아무
       화면에도 안 나타나니까요. 달라진 게 없으면 그냥 돌아갑니다.

       [그래도 5분에 한 번은 보냅니다]
       lastSeen 이 영영 안 갱신되면 곤란합니다. 나갔는지는 onDisconnect 와
       30분 유예가 판정하지만, 그게 실패했을 때 고아 기록을 걷어내는
       안전망(ONLINE_STALE_MS 12시간)이 lastSeen 을 봐요. 5분이면 12시간
       기준에 견줘 아주 넉넉합니다.

       ★ force(=true) 로 부르는 자리(입장·상태 바꾸기·저장)는 이 검사를
         건너뜁니다. 사람이 뭘 한 순간에는 바로 보여야 하니까요.
       ===================================================================== */
    const 지문 = JSON.stringify({
      ...보낼것,
      /* 견줄 때만 바꿔 끼웁니다 — 초는 화면에 안 나타나므로 분으로 */
      workMs: Math.round(Number(보낼것.workMs || 0) / 60000),
      lastSeen: 0
    });
    const 지금 = Date.now();
    if (!force
        && 지문 === _lastSentSig
        && (지금 - _lastSentAt) < STATUS_KEEPALIVE_MS) {
      return;                                  // 남들 화면이 그대로예요
    }
    _lastSentSig = 지문;
    _lastSentAt = 지금;

    /* =====================================================================
       🥗 status 다이어트 (2026-08-21) — 바뀐 칸만 보냅니다
       ---------------------------------------------------------------------
       [무엇이 낭비였나] 위의 "같은 화면이면 안 보냄"(0815) 덕에 헛걸음은
       사라졌지만, **보낼 때는 늘 17칸을 통째로** 보냈습니다(set).
       그런데 대개 달라지는 건 workMs 하나예요 — 집필 중이면 1분마다
       그 칸만 늘어납니다. 나머지 열여섯 칸(emoji · joinedAt · 닉 색 ·
       목표 글 · 작업 스티커…)은 하루 종일 그대로인데 같이 실려 나갔어요.

       한 사람이 쓰면 **접속한 모두**가 받으므로 통신량은 사람 수의
       제곱으로 커집니다. 38명이 되면서 이 낭비가 눈에 띄게 커졌어요.

       [어떻게] 마지막으로 보낸 값을 손에 들고 있다가 **달라진 칸만**
       update() 로 보냅니다. 흔한 경우 17칸 → 1~2칸이 됩니다.

       ★ set() 이 아니라 update() 라 나머지 칸은 서버에 그대로 남습니다.
       ★ 처음 보낼 때(또는 force)는 통째로 set() 합니다 — 지난 판이
         남긴 묵은 칸을 한 번은 싹 덮어야 하니까요.
       ★ 쓰기가 실패하면 손에 든 값을 버립니다. 안 그러면 "보냈다고
         착각한 칸" 이 영영 안 나가요.
       ===================================================================== */
    const ref = db.ref("status/" + myNick);

    /* 견줄 수 없는 두 칸은 빼고 봅니다 — lastSeen 은 서버가 찍는 값이고,
       disconnectedAt 은 늘 null(=끊김 표시 지우기)이라 견줄 것이 없어요. */
    const 견줄것 = { ...보낼것 };
    delete 견줄것.lastSeen;
    delete 견줄것.disconnectedAt;

    let 쓸것, 통째로 = false;
    if (!_lastSentObj) {
      쓸것 = 보낼것; 통째로 = true;          // 첫 판 — 묵은 칸까지 덮습니다
    } else {
      쓸것 = { lastSeen: 보낼것.lastSeen, disconnectedAt: null };
      Object.keys(견줄것).forEach(k => {
        if (견줄것[k] !== _lastSentObj[k]) 쓸것[k] = 보낼것[k];
      });
    }

    const 진행 = 통째로 ? ref.set(쓸것) : ref.update(쓸것);
    _lastSentObj = 견줄것;                   // 손에 들어 둡니다
    진행 && 진행.catch && 진행.catch(() => {
      _lastSentObj = null;                   // 실패하면 다음에 통째로
    });
  }

  // =====================================================
  // pomodoro realtime
  // =====================================================

  /* =====================================================================
     🍅 뽀모도로 — 개인 타이머

     [바뀐 이유 2026-08-06]
     예전에는 방 전체가 서버의 `pomodoro` 한 칸을 같이 봤습니다. 누가
     시작하면 모두의 타이머가 같이 돌고, 누가 멈추면 모두 멈췄어요.
     그런데 이 방은 "다 같이 하나 둘 셋" 하고 출발하는 곳이 아니라
     각자 자기 리듬으로 쓰는 곳입니다. 그러다 보니 가이드를 안 읽고
     이것저것 눌러 본 사람이 남의 집중을 통째로 끊어 버리는 사고만
     남았습니다. 그래서 타이머를 각자 것으로 돌렸습니다.

     [지금 구조]
       · 서버에 아무것도 쓰지 않습니다. 타이머는 내 브라우저 안에서만 돕니다
       · 집중/휴식 시간도 각자 마음대로 — 남에게 영향이 없습니다
       · 새로고침하거나 창을 닫았다 열어도 이어집니다 (끝나는 시각을
         이 기기에 적어 두고, 돌아왔을 때 남은 시간을 다시 계산합니다)
       · 알림 줄은 내 화면에만 뜹니다 (서버에 올리지 않습니다)
       · 도는 동안에는 내 카드에 작은 🍅 이 붙어서, 남들도 "쟤 지금
         달리는 중이구나" 정도는 볼 수 있습니다

     서버에 남는 것: 없음. 카드에 실려 나가는 pomoRunning(참/거짓)뿐.
     ===================================================================== */

  const POMO_SAVE_KEY = "pomoLocal";   // 이 기기에 저장하는 열쇠

  /* 지금 도는 세션.
       { phase:"work"|"rest", endAt, workMin, restMin, pausedLeft? }

     [일시정지를 어떻게 담는가]
     끝나는 시각(endAt)만으로는 멈춤을 표현할 수 없습니다. 시계는 계속
     흐르니까요. 그래서 멈출 때 **남은 밀리초(pausedLeft)** 를 적어 두고
     endAt 은 버립니다. 다시 이어갈 때 endAt = 지금 + 남은 시간 으로
     되살리고 pausedLeft 를 지웁니다. 이러면 몇 시간을 멈춰 두었다가
     이어가도, 창을 닫았다 열어도 남은 시간이 그대로예요. */
  let _pomo = null;

  function _isPaused() { return !!(_pomo && _pomo.pausedLeft > 0); }

  /* 내 화면에만 뜨는 알림 줄 — 서버로 나가지 않습니다 */
  function _showMyPomoLine(kind) {
    let msg = "";
    if (kind === "stop")       msg = "⏹️ 뽀모도로를 멈췄어요.";
    else if (kind === "pause") msg = "⏸️ 잠깐 멈췄어요.";
    else if (kind === "resume")msg = "▶️ 다시 이어갑니다.";
    else if (kind === "work")  msg = "🍅 집중 세션을 시작했어요!";
    else                       msg = "☁️ 휴식을 시작했어요!";
    window.addMyPomoLine?.(msg);
  }

  function _pomoSave() {
    try {
      if (_pomo) AppStore.setItem(POMO_SAVE_KEY, JSON.stringify(_pomo));
      else AppStore.removeItem(POMO_SAVE_KEY);
    } catch (e) {}
  }

  /* 새로고침 뒤 이어 달리기 — 저장해 둔 끝나는 시각을 되살립니다.
     이미 지나 버린 세션이면 살리지 않습니다. 몇 시간 뒤에 돌아왔는데
     "3시간 전에 끝난 타이머"가 되살아나면 더 이상하니까요. */
  function _pomoLoad() {
    try {
      const raw = AppStore.getItem(POMO_SAVE_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (!v) return null;
      const base = {
        phase:   v.phase === "rest" ? "rest" : "work",
        workMin: Math.max(1, Math.min(180, Number(v.workMin) || 25)),
        restMin: Math.max(1, Math.min(60,  Number(v.restMin) || 5))
      };
      /* 멈춰 둔 채 나갔으면 남은 시간 그대로 되살립니다 —
         시계가 흐른 것과 무관하니 시간이 지나도 사라지지 않습니다. */
      const left = Number(v.pausedLeft || 0);
      if (left > 0) return { ...base, endAt: 0, pausedLeft: left };
      if (!v.endAt || Number(v.endAt) <= Date.now()) return null;
      return { ...base, endAt: Number(v.endAt) };
    } catch (e) { return null; }
  }

  /* 화면에 "멈춰 있음" 을 그립니다 */
  function _paintIdle() {
    const pill = document.getElementById("timer-pill");
    const text = document.getElementById("timer-text");
    if (!pill || !text) return;
    pill.classList.remove("timer-warn");
    pill.dataset.phase = "idle";
    const wm = parseInt(document.getElementById("pomo-work-min")?.value, 10) || 25;
    text.textContent = `${String(wm).padStart(2, "0")}:00`;
    window.updatePomoHeaderStatus?.({ running: false });
    window.updatePomoSetupUI?.({ running: false });
    window.updatePomoProgressBar?.(1, 1);
  }

  /* 1초마다 도는 몸통 — 남은 시간을 다시 그리고, 다 되면 단계를 넘깁니다 */
  function _pomoTick() {
    if (!_pomo) return;
    const pill = document.getElementById("timer-pill");
    const text = document.getElementById("timer-text");
    if (!pill || !text) return;

    /* 멈춰 있으면 시계가 흘러도 숫자는 그대로입니다 */
    const remainMs = _isPaused() ? _pomo.pausedLeft : (_pomo.endAt - Date.now());
    const totalSec = (_pomo.phase === "work" ? _pomo.workMin : _pomo.restMin) * 60;
    const remainingSec = Math.max(0, Math.ceil(remainMs / 1000));

    window.updatePomoProgressBar?.(totalSec, remainingSec);
    window.updatePomoHeaderStatus?.({ running: true, mode: _pomo.phase, remainingSec });

    if (!_isPaused() && remainMs <= 0) { _pomoNextPhase(); return; }

    const mm = Math.floor(remainMs / 60000);
    const ss = Math.floor((remainMs % 60000) / 1000);
    pill.dataset.phase = _isPaused() ? "paused" : _pomo.phase;
    text.textContent = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

    /* [뺌 2026-08-12] "임박" 표시(남은 10분부터 붉게)를 없앴습니다.
       이 방의 뽀모는 **그 안에 무언가를 끝내야 하는 시계가 아닙니다.**
       집중을 끊어 주는 것이 일이라, 남은 시간이 줄었다고 재촉할 이유가
       없어요. 붉은 숫자는 오히려 마음을 급하게 만듭니다.
       ★ 값(warnMinutes)을 읽던 것도 함께 뺐습니다 — 안 쓰는 값을
         계속 읽으면 다음 사람이 "쓰는 줄" 알고 살려 둡니다. */
    pill.classList.remove("timer-warn");
  }

  /* 집중 ↔ 휴식 전환. 소리·알림·오늘 집중 횟수도 여기서 처리합니다. */
  function _pomoNextPhase() {
    if (!_pomo) return;
    const next = _pomo.phase === "work" ? "rest" : "work";
    const dur  = next === "work" ? _pomo.workMin : _pomo.restMin;

    // 집중을 끝내고 휴식으로 넘어갈 때만 "오늘 1회"를 더합니다
    if (next === "rest") window.incrementTodayFocusSessions?.();

    _pomo = { ..._pomo, phase: next, endAt: Date.now() + dur * 60 * 1000 };
    _pomoSave();

    if (next === "work") {
      window.playPomodoroSound?.("work_start");
      window.notifyPomodoro?.("work");
    } else {
      window.playPomodoroSound?.("rest_start");
      window.notifyPomodoro?.("rest");
    }
    _showMyPomoLine(next);

    window.updatePomoSetupUI?.({ running: true, workMin: _pomo.workMin, restMin: _pomo.restMin });
    updateStatus();                 // 카드의 🍅 갱신
    _pomoTick();
  }

  /* [2026-08-09] ⏸ 일시정지 / ▶ 이어가기

     멈출 때 남은 시간을 적어 두고 끝나는 시각을 버립니다. 이어갈 때
     그 반대로 합니다. 상태(WORK/BREAK)는 건드리지 않습니다 —
     잠깐 자리를 뜨는 것까지 상태로 옮기면 작업 기록이 지저분해져요. */
  function pausePomodoro() {
    if (!_pomo || _isPaused()) return;
    const left = Math.max(0, _pomo.endAt - Date.now());
    if (left <= 0) return;
    _pomo = { ..._pomo, endAt: 0, pausedLeft: left };
    _pomoSave();
    _showMyPomoLine("pause");
    renderPomoButtons();
    _pomoTick();
  }

  function resumePomodoro() {
    if (!_isPaused()) return;
    _pomo = { phase: _pomo.phase, workMin: _pomo.workMin, restMin: _pomo.restMin,
              endAt: Date.now() + _pomo.pausedLeft };
    _pomoSave();
    _showMyPomoLine("resume");
    renderPomoButtons();
    _pomoStartLoop();
  }

  /* 시작 ↔ 일시정지 를 한 버튼이 맡습니다 */
  function togglePomoRun() {
    if (!_pomo) { startPomodoro(); return; }
    if (_isPaused()) resumePomodoro();
    else pausePomodoro();
  }

  /* 버튼 줄 다시 그리기 — 도는 중에만 [정지] 가 나옵니다 */
  function renderPomoButtons() {
    const running = !!_pomo;
    const paused  = _isPaused();
    const state   = !running ? "idle" : (paused ? "paused" : "running");
    /* 조작 줄과 설정 줄 둘 다에 상태를 적습니다 — 서로 다른 줄이라 */
    ["pomo-controls", "pomo-setrow"].forEach(id => {
      const r = document.getElementById(id);
      if (r) r.dataset.state = state;
    });
    /* [2026-08-12] 머리말의 "집중 중 · 오늘 n회" 도 여기서 함께 갱신합니다.
       상태가 바뀌는 곳이 여기 하나라, 다른 데서 따로 부르면 어긋납니다. */
    window.renderPomoHeadState?.();
    const row = document.getElementById("pomo-controls");
    if (!row) return;

    const run = document.getElementById("pomo-run-btn");
    if (run) {
      run.classList.toggle("is-pause", running && !paused);
      run.title = !running ? "내 타이머를 시작해요 (남에게는 영향 없어요)"
                : paused   ? "이어서 다시 셉니다"
                           : "잠깐 멈춰요 (남은 시간은 그대로)";
      run.setAttribute("aria-label", !running ? "뽀모도로 시작"
                                   : paused   ? "뽀모도로 이어가기" : "뽀모도로 일시정지");
    }
    /* 도는 동안에는 시간 설정을 잠급니다 — 지금 세션에는 반영되지 않으니까요 */
    ["pomo-work-min", "pomo-rest-min"].forEach(id => {
      const i = document.getElementById(id);
      if (i) i.disabled = running;
    });
  }
  window.renderPomoButtons = renderPomoButtons;

  function _pomoStartLoop() {
    if (window.pomodoroTick) { clearInterval(window.pomodoroTick); }
    window.pomodoroTick = setInterval(_pomoTick, 1000);
    _pomoTick();
  }

  /* 켤 때 한 번 부릅니다. 이름은 그대로 두었습니다 — 다른 파일들이
     이 이름으로 부르고 있어서, 바꾸면 조용히 안 도는 사고가 납니다. */
  function listenPomodoro() {
    _pomo = _pomoLoad();
    if (_pomo) {
      window.updatePomoSetupUI?.({ running: true, workMin: _pomo.workMin, restMin: _pomo.restMin });
      const wi = document.getElementById("pomo-work-min");
      const ri = document.getElementById("pomo-rest-min");
      if (wi) wi.value = _pomo.workMin;
      if (ri) ri.value = _pomo.restMin;
      _pomoStartLoop();
    } else {
      _paintIdle();
    }
    renderPomoButtons();
  }

  function startPomodoro() {
    /* 알림 권한은 "시작을 누른 그 순간"에만 물어봅니다.
       사용자 동작 없이 물으면 브라우저가 막거나 대체로 거부됩니다. */
    window.askNotifyPermissionOnce?.();

    const workInput = document.getElementById("pomo-work-min");
    const restInput = document.getElementById("pomo-rest-min");

    const workMinRaw = parseInt(workInput?.value, 10);
    const restMinRaw = parseInt(restInput?.value, 10);

    const workMin = Math.max(1, Math.min(180, Number.isFinite(workMinRaw) ? workMinRaw : 25));
    const restMin = Math.max(1, Math.min(60,  Number.isFinite(restMinRaw) ? restMinRaw : 5));

    // 클램프된 값으로 입력창도 정리
    if (workInput) workInput.value = workMin;
    if (restInput) restInput.value = restMin;

    _pomo = { phase: "work", endAt: Date.now() + workMin * 60 * 1000, workMin, restMin };
    _pomoSave();

    window.updatePomoSetupUI?.({ running: true, workMin, restMin });
    renderPomoButtons();
    window.playPomodoroSound?.("work_start");
    _showMyPomoLine("work");
    updateStatus();                 // 카드에 🍅 붙이기
    _pomoStartLoop();
  }

  function stopPomodoro() {
    const wasRunning = !!_pomo;
    _pomo = null;
    _pomoSave();
    if (window.pomodoroTick) { clearInterval(window.pomodoroTick); window.pomodoroTick = null; }
    _paintIdle();
    renderPomoButtons();
    if (wasRunning) {
      _showMyPomoLine("stop");
      updateStatus();               // 카드에서 🍅 떼기
    }
  }

  /* 카드에 실어 보낼 값 — 지금 집중 중인가 */
  function isPomodoroRunning() { return !!_pomo && !_isPaused(); }
  function pomodoroPhase() { return _pomo ? _pomo.phase : ""; }

  // =====================================================
  // messages realtime
  // =====================================================
  async function listenMessages() {
    detachMessageListeners();

    _messagesListening = true;
    clearChatUI();

    _msgRef = db.ref("messages");
    _clearRef = db.ref("chatMeta/clearedAt");

    _clearRef.on("value", snap => {
      const ts = snap.val() || 0;
      if (ts && ts !== _lastClearedAt) {
        _lastClearedAt = ts;
        clearChatUI();
      }
    });

    let joinTs = 0;
    if (typeof window._myJoinTimestamp === "function") {
      joinTs = window._myJoinTimestamp() || 0;
    }
    if (!joinTs) joinTs = Date.now() - 1200;

    // ✅ [벨사탕] 입장 히스토리: mode(on/admin/off) + count(개수), 관리자가 설정
    let showHist = true;
    let histCount = 100;
    try {
      const hs = await db.ref("chatMeta/showHistory").once("value");
      const conf = hs.val() || {};
      const mode = conf.mode || (conf.enabled === false ? "off" : "on");
      const isAdminNow = AppSession.getItem("adminPinOk") === "true";
      showHist = (mode === "on") || (mode === "admin" && isAdminNow);
      // ✅ 관리자가 '이전 채팅 불러오기'를 누른 경우: 모드와 무관하게 1회 표시
      if (window._forceHistOnce) {
        showHist = true;
        window._forceHistOnce = false;
      }
      histCount = Math.max(10, Math.min(300, parseInt(conf.count ?? 100, 10) || 100));
    } catch(e) {}

    // ✅ [벨사탕] 최근 100개는 새 입장자에게도 렌더 (OFF면 키만 등록해 중복 방지)
    // [FIX] limitToLast는 키 순서라 sys_pomo_* 같은 이름 키가 몰려 나옴 → time 기준 정렬로 변경
    // [FIX] 히스토리에는 실제 대화만 표시 (뽀모/입장/퇴장/이펙트 시스템 메시지는 제외)
    const initSnap = await _msgRef.orderByChild("time").limitToLast(Math.max(histCount, 100)).once("value");
    const box = document.getElementById("chat-box");
    const histItems = [];
    initSnap.forEach(child => {
      const key = child.key;
      const data = child.val();
      if (!key) return;
      _seenMsgKeys.add(key);
      if (!data) return;
      const t = data.type;
      const isRealChat = !t || t === "declaration" || t === "fortune";
      /* [변경 2026-08-09] 지난 대화에서 입장·퇴장 알림을 뺍니다.

         2026-08-04 에는 넣는 쪽이 맞다고 봤습니다 — 누가 다녀갔는지
         알 수 있으니까요. 그런데 그 뒤로 관리자 창에 [🚪 출입 기록]이
         생겨서, 누가 언제 들고 났는지는 그쪽에서 날짜별로 훨씬 정확히
         볼 수 있습니다. 남은 건 손해뿐이었어요 — 30개를 불러오면 그중
         절반 넘게가 "○○님이 입장했습니다" 로 채워져서, 정작 지난 대화가
         밀려났습니다.

         지금 접속 중에 들어오고 나가는 알림은 그대로 뜹니다. 여기서
         빠지는 건 "예전 것을 되짚어 보여줄 때" 뿐입니다. */
      if (isRealChat) histItems.push([key, data]);
    });
    if (showHist) {
      const toRender = histItems.slice(-histCount);
      window._lastHistRenderedCount = toRender.length;
      toRender.forEach(([key, data]) => {
        window.renderChatMessage?.(box, data, key);
      });
    } else {
      window._lastHistRenderedCount = 0;
    }

    // ✅ 관리자 토글 버튼 라벨 실시간 동기화
    try {
      if (!window._histLabelRef) {
        window._histLabelRef = db.ref("chatMeta/showHistory");
        window._histLabelRef.on("value", snap => {
          const conf = snap.val() || {};
          const mode = conf.mode || (conf.enabled === false ? "off" : "on");
          const count = Math.max(10, Math.min(300, parseInt(conf.count ?? 100, 10) || 100));
          window._historyConfCache = { mode, count };

          // 설정 패널 동기화 (열려 있으면)
          const radio = document.querySelector(`input[name="hist-mode"][value="${mode}"]`);
          if (radio) radio.checked = true;
          const cntInput = document.getElementById("hist-count-input");
          if (cntInput && document.activeElement !== cntInput) cntInput.value = String(count);
          const label = document.getElementById("hist-current-label");
          if (label) {
            const modeTxt =
              mode === "on"    ? "🕘 전체 공개" :
              mode === "admin" ? "🛡️ 관리자만" : "🙈 숨김";
            label.textContent = `현재 적용 중: ${modeTxt} · ${count}개`;
          }
        });
      }
    } catch(e) {}

    window.scrollChatToBottom?.(true);

    _msgLiveQuery = _msgRef.orderByChild("time").startAt(joinTs);

    /* ★★★ [고침 2026-08-29 — 콩 신고 "아이맥에서 타자가 지연된다"]
       ---------------------------------------------------------------------
       말풍선을 화면에서 **걷어내는 코드가 없었습니다.** 서버 기록은
       checkAndTrimChat() 이 250개로 자르는데, 그건 파이어베이스 쪽 얘기고
       화면 DOM 은 append 만 했어요. 접속을 하루 켜 두면 수천 개가 쌓입니다.

       왜 타자가 느려지나 — 글자를 칠 때마다 글칸 높이를 맞추느라 배치를
       한 번 다시 재는데(script_chat.js 글칸손질), 그 **대상이 쌓인 말풍선
       전부**입니다. 개수가 늘수록 한 글자의 값이 비싸져요. 게다가 큰
       화면에서는 한 번에 칠해지는 말풍선도 서너 배 많습니다.

       ★ 처음 불러오는 양(histCount, 최대 300)보다 넉넉히 잡습니다 —
         읽던 자리가 갑자기 사라지면 그게 더 놀라워요.
       ★ 위에서부터 걷어냅니다. 아래(최신)가 사람이 보는 쪽이니까요.
       ※ 지운 것은 화면에서만 없어집니다. 서버 기록은 그대로예요. */
    const 화면말풍선한도 = 400;
    function 말풍선걷어내기() {
      const box = document.getElementById("chat-box");
      if (!box) return;
      let 넘침 = box.childElementCount - 화면말풍선한도;
      while (넘침-- > 0 && box.firstElementChild) box.firstElementChild.remove();
    }

    _msgLiveQuery.on("child_added", (snap) => {
      const key = snap.key;
      const data = snap.val();
      if (!data || !key) return;


      if (_seenMsgKeys.has(key)) return;
      _seenMsgKeys.add(key);

      window.renderChatMessage?.(document.getElementById("chat-box"), data, key);
      말풍선걷어내기();

      const isSystemLike = (data.type === "system" || data.type === "fx");
      const isMine = (data.user && data.user === myNick);

      if (!isSystemLike && !isMine) {
        if (!autoScrollEnabled) {
          unreadCount += 1;
          const floatBtn = document.getElementById("new-msg-float");
          const countEl = document.getElementById("new-msg-count");
          if (countEl) countEl.textContent = String(unreadCount);
          if (floatBtn) floatBtn.classList.remove("hidden");
        } else {
          unreadCount = 0;
          const floatBtn = document.getElementById("new-msg-float");
          if (floatBtn) floatBtn.classList.add("hidden");
        }
      }

      window.scrollChatToBottom?.(false);
    });
  }

  // =====================================================
  // admin
  // =====================================================
  /* =====================================================================
     관리자 PIN 확인

     ★ 값(ADMIN_PIN·ADMIN_NICK)은 이 파일 맨 위 한 곳에만 있습니다.
       바꿀 일이 생기면 위로 올라가세요. (script_admin.js 와 동기 필요)
     ===================================================================== */
  function requireAdminPin() {
    if (AppSession.getItem("adminPinOk") === "true") return true;
    const p = prompt("관리자 PIN을 입력해 주세요");
    if (p === ADMIN_PIN) {
      AppSession.setItem("adminPinOk", "true");
      window.refreshAdminUiVisibility?.();
      return true;
    }
    alert("PIN이 올바르지 않습니다.");
    return false;
  }

  /* [2026-08-06] 아래 관리자 기능들(applyHistoryConfig · loadHistoryNow ·
     clearAllChat · clearAllWordcount · showAttendanceLog)은 설정 창에서
     버튼을 모두 걷어내 메인 화면에서는 더 이상 불리지 않습니다.
     같은 일을 관리자 페이지(admin.html)가 하고 있어요.
     지우지 않고 남겨둔 이유는 데이터 형태를 맞춰볼 참고용이기 때문입니다.
     (없어진 DOM 을 읽는 자리는 모두 ?. 나 null 검사로 감싸 뒀습니다) */

  // ✅ 히스토리 노출 설정: 라디오 + 개수 입력 → '설정 적용' 버튼으로만 반영
  async function applyHistoryConfig() {
    if (!requireAdminPin()) return;

    const sel = document.querySelector('input[name="hist-mode"]:checked');
    const mode = sel ? sel.value : "on";
    const n = parseInt(document.getElementById("hist-count-input")?.value, 10);

    if (!Number.isFinite(n) || n < 10 || n > 300) {
      alert("표시 개수는 10에서 300 사이의 숫자로 입력해 주세요!");
      return;
    }
    if (!["on", "admin", "off"].includes(mode)) return;

    const modeTxt =
      mode === "on"    ? "🕘 전체 공개 — 모든 입장자에게 이전 대화가 보여요" :
      mode === "admin" ? "🛡️ 관리자만 — 관리자로 로그인한 사람만 볼 수 있어요" :
                         "🙈 숨김 — 아무에게도 이전 대화가 보이지 않아요";
    if (!confirm(`이 설정을 적용할까요?\n\n${modeTxt}\n표시 개수: ${n}개`)) return;

    await db.ref("chatMeta/showHistory").set({
      mode,
      count: n,
      updatedBy: myNick || "admin",
      at: Date.now()
    });
    alert("✅ 히스토리 설정이 적용됐어요.");
  }

  // ✅ 이전 채팅 불러오기: 누른 관리자 본인 화면에만 과거 대화를 표시
  async function loadHistoryNow() {
    if (!requireAdminPin()) return;
    if (!myNick) { alert("먼저 작업실에 입장해 주세요!"); return; }
    window._forceHistOnce = true;
    try {
      await window.listenMessages?.();
      window.closeSettings?.();
      const n = window._lastHistRenderedCount || 0;
      if (n === 0) {
        alert("불러올 이전 대화가 아직 없어요.\n(이펙트 같은 일부 시스템 메시지는 히스토리에 포함되지 않아요)");
      }
    } catch(e) {
      window._forceHistOnce = false;
      alert("이전 채팅을 불러오지 못했어요 😢");
    }
  }

  /* ===================================================================
     ✅ [벨사탕] 접속 기록 · 출석 업적

     [FIX] 보관 기간이 짧아 업적이 제대로 안 쌓이던 문제

       · 공용 로그 attendance/{날짜}       기존 7일  → 1000일
       · 개인 출석맵 users/{닉}/attend/days 기존 14일 → 1000일

     특히 개인 출석맵이 14일이었던 게 문제였습니다.
     "지난주 월~일 풀출석"은 최대 13일 전까지 들여다봐야 하는데,
     정리 시점이 어긋나면 지난주 앞부분이 이미 지워진 뒤라 판정이 실패했습니다.
     연속 출석도 날짜맵 기준 재계산이 14일에서 막혀 그 이상 올라가지 못했고요.

     관리자 화면에 보이는 목록은 요청대로 최근 30일만 보여줍니다.
     (저장은 1000일, 표시는 30일)
     =================================================================== */
  const ATTEND_KEEP_DAYS = 1000;   // 보관
  const ATTEND_SHOW_DAYS = 30;     // 관리자 화면 표시
  const ATTEND_BACKFILL_DAYS = 60; // 예전 공용 로그에서 끌어올 범위
  const DAY_MS = 86400000;

  /* ===================================================================
     [2026-08-07] 정밀 출입 기록 — attendlog/{날짜}/{pushId}

     기존 attendance 는 하루당 한 줄입니다.
       attendance/{날짜}/{닉} = { firstAt, at, leftAt? }
     그래서 하루에 여러 번 들락거려도 **첫 입장 하나만** 남고, 퇴장은
     [나가기] 를 눌렀을 때만 찍혔습니다. "9시에 왔다가 11시에 나가고
     2시에 다시 왔다" 같은 걸 알 방법이 없었어요.

     그래서 사건을 일어난 순서대로 한 줄씩 쌓는 자리를 따로 뒀습니다.
       attendlog/{날짜}/{pushId} = { n: 닉, t: 시각, k: "in" | "out" }

     [왜 이렇게 가볍게 적는가]
     열쇠 이름을 한 글자로 줄인 건 멋이 아니라 양 때문입니다. 사람이
     늘고 날짜가 쌓이면 이 목록이 가장 빨리 자라요. 그래도 한 줄이
     50바이트 남짓이라, 열 명이 하루 세 번씩 드나들어도 하루 3KB 정도입니다.

     [기존 attendance 를 대체하지 않습니다]
     출석부·업적·휴가는 계속 attendance 를 봅니다. 이건 "그날 무슨 일이
     있었나"를 시간순으로 되짚어 보기 위한 별도의 기록이에요.
     =================================================================== */
  const ATTENDLOG_KEEP_DAYS = 180;   // 보관 — 출석부(1000일)보다 짧게 둡니다

  /* [간소화 2026-08-14 — 콩 결정] 입장만, 3시간에 한 번만 적습니다.
     들락날락(재접속·새로고침)이 전부 기록돼 목록이 시끄러웠어요.
     퇴장 기록도 접었습니다 — 최초 입장만 남기니 짝이 안 맞는 퇴장은
     의미가 없고, "언제까지 있었나"는 출석부 돋보기(timeSegs)가 더
     정확하게 답합니다. 마지막 기록 시각은 이 기기에 적어둡니다. */
  const ATTENDLOG_GAP_MS = 3 * 60 * 60 * 1000;   // 3시간

  async function writeAttendLog(kind) {
    if (!myNick) return;
    if (kind !== "in") return;                   // 퇴장은 더 이상 안 적습니다
    const last = Number(AppStore.getItem("attendLogInAt") || 0);
    if (Date.now() - last < ATTENDLOG_GAP_MS) return;   // 3시간 안 재입장 — 조용히
    try {
      const day = ymd(Date.now());
      await db.ref(`attendlog/${day}`).push({
        n: myNick,
        t: firebase.database.ServerValue.TIMESTAMP,   // 각자 시계가 아니라 서버 시각으로
        k: "in"
      });
      try { AppStore.setItem("attendLogInAt", String(Date.now())); } catch (e) {}
    } catch (e) {
      /* 기록이 하나 빠져도 방은 그대로 돌아가야 합니다 — 조용히 넘깁니다 */
      console.warn("[attendlog]", e);
    }
  }

  /* [핵심] 퇴장을 놓치지 않기 위한 예약.

     사람들은 [나가기] 를 잘 안 누릅니다. 그냥 탭을 닫거나, 노트북을
     덮거나, 인터넷이 끊기죠. 그때마다 퇴장 기록이 비면 이 목록은
     "들어온 줄"만 잔뜩 쌓인 반쪽짜리가 됩니다.

     그래서 입장할 때 미리 자리를 하나 잡아 두고, "연결이 끊기면 여기에
     이 내용을 적어라" 하고 **서버에** 부탁해 둡니다(onDisconnect).
     브라우저가 죽어도 서버가 대신 적어 주므로 놓치지 않아요.

     ※ 자정을 넘겨 접속해 있다가 끊기면 그 줄은 '들어온 날'쪽에 적힙니다.
        날짜를 미리 정해 두고 부탁하는 방식이라 어쩔 수 없어요.
        읽는 쪽에서 크게 문제되지 않아 그대로 둡니다. */
  /* [철거 2026-08-14] reserveOutOnDisconnect — 퇴장을 대신 적어주던
     서버 예약. 퇴장 기록 자체를 접으면서 함께 걷었습니다. */

  /* =====================================================================
     🧹 오래된 날짜 정리 — **방장 브라우저에서만** (2026-08-17)
     ---------------------------------------------------------------------
     예전에는 누가 입장하든 이 둘이 돌았습니다. 그러려면 보안규칙이
     `attendance` · `attendlog` 를 **로그인한 아무에게나** 열어 둬야 했고,
     실제로 `.write: "auth != null"` 이었습니다. 그 말은 멤버 누구나
     콘솔에서 `db.ref('attendance').remove()` 한 줄로 **전 기간 출석을
     날릴 수 있었다**는 뜻이에요. 출석은 이 방 운영의 근간 자료입니다.

     정리는 하루에 한 번 누가 하든 결과가 같은 일이라, 방장 한 사람이
     맡아도 아무 문제가 없습니다. 방장은 매일 들어오니까요.
     ★ 오래 안 들어오면 정리가 밀릴 뿐, 기록이 어긋나지는 않습니다
       (보관 기간이 attendance 1000일 · attendlog 180일로 넉넉해요).
     ===================================================================== */
  function 정리할차례인가() { return myNick === ADMIN_NICK; }

  /* 오래된 날짜를 지웁니다. 방장이 입장할 때 한 번만 훑어요. */
  async function sweepAttendLog() {
    if (!정리할차례인가()) return;
    try {
      const cutoff = ymd(Date.now() - (ATTENDLOG_KEEP_DAYS - 1) * DAY_MS);
      const old = await db.ref("attendlog").orderByKey().endAt(cutoff).once("value");
      const updates = {};
      old.forEach(child => { if (child.key < cutoff) updates[child.key] = null; });
      if (Object.keys(updates).length) await db.ref("attendlog").update(updates);
    } catch (e) {}
  }

  /* =====================================================================
     🌙 자정 넘김 출석 — 만들었다가 같은 날 걷어냈습니다 (2026-08-18)
     ---------------------------------------------------------------------
     접속 유지로 자정을 넘긴 사람이 결석으로 남는 것을 보고(녹차차 사건),
     "날 바뀐 뒤 작업 1시간이면 자동 도장" 을 넣었었어요. 그런데 순위를
     연속 출석에서 **출석률**로 바꾸면서 콩이 되돌렸습니다 —
     연속을 안 따지는 이상, 자정 넘김은 **본인이 직접 챙길 문제**
     (새벽에도 일했으면 한 번 나갔다 들어오면 됩니다).

     ★ 되살릴 일이 생기면: updateStatus 초입에서 30초마다
       "ymd(now) ≠ 마지막 도장 날 && myTodayWorkMs() ≥ 1시간" 이면
       recordAttendance() 한 줄이었습니다. 문턱 없이 자정 즉시 찍으면
       23:30 입장 → 00:10 퇴근이 이틀로 찍히니 그건 하지 마세요.
     ===================================================================== */

  async function recordAttendance() {
    if (!myNick) return;
    const day = ymd(Date.now());

    try {
      // ---- 공용 로그 ----
      const aref = db.ref(`attendance/${day}/${myNick}`);
      const prevSnap = await aref.once("value");
      const prev = prevSnap.val();
      await aref.set({
        firstAt: prev?.firstAt || prev?.at || Date.now(),
        at: Date.now()
      });

      /* 입장 기록 — 3시간에 한 번만 (들락날락은 안 적힙니다) */
      writeAttendLog("in");
      sweepAttendLog();

      /* 보관 기간이 지난 것만 골라 지웁니다.
         예전에는 attendance 전체를 내려받아 훑었는데, 1000일치가 쌓이면
         접속할 때마다 그 전부를 받게 됩니다. 오래된 구간만 조회하도록 바꿨습니다.
         ★ [2026-08-17] 이 정리도 방장 몫입니다 — 위 정리할차례인가() 주석 참고.
           덕분에 남는 사람들은 이 조회조차 안 하게 되어 통신량도 줍니다. */
      if (정리할차례인가()) {
        const cutoff = ymd(Date.now() - (ATTEND_KEEP_DAYS - 1) * DAY_MS);
        const oldSnap = await db.ref("attendance").orderByKey().endAt(cutoff).once("value");
        const updates = {};
        oldSnap.forEach(c => { if (c.key && c.key < cutoff) updates[c.key] = null; });
        if (Object.keys(updates).length) await db.ref("attendance").update(updates);
      }

      // ---- 개인 출석맵 ----
      const uref = db.ref(`users/${myNick}/attend`);
      await uref.child(`days/${day}`).set(true);

      /* 업적 기능이 생기기 전의 공용 로그를 개인 맵으로 옮겨옵니다.
         최근 구간만 보면 충분해서 범위를 제한했습니다. */
      try {
        const recent = await db.ref("attendance")
          .orderByKey().limitToLast(ATTEND_BACKFILL_DAYS).once("value");
        const backfill = {};
        recent.forEach(c => {
          const rows = c.val();
          if (rows && rows[myNick]) backfill[c.key] = true;
        });
        if (Object.keys(backfill).length) await uref.child("days").update(backfill);
      } catch (e) {}

      // 개인 맵도 같은 기간만 보관
      const dcut = ymd(Date.now() - (ATTEND_KEEP_DAYS - 1) * DAY_MS);
      const dOld = await uref.child("days").orderByKey().endAt(dcut).once("value");
      const dupd = {};
      dOld.forEach(c => { if (c.key && c.key < dcut) dupd[c.key] = null; });
      if (Object.keys(dupd).length) await uref.child("days").update(dupd);

      // ---- 연속 출석 ----
      const yesterday = ymd(Date.now() - DAY_MS);
      const ssnap = await uref.child("streak").once("value");
      const st = ssnap.val() || {};
      let streak;
      if (st.lastDay === day) streak = Number(st.count || 1);
      else if (st.lastDay === yesterday) streak = Number(st.count || 0) + 1;
      else streak = 1;

      /* 날짜맵을 거슬러 올라가며 실제 연속일수도 계산해 더 큰 값을 씁니다.
         카운터가 어떤 이유로 끊겨도 기록만 남아 있으면 복구됩니다.
         (예전에는 60일에서 멈춰 그 이상 못 올라갔습니다) */
      try {
        const dm = (await uref.child("days").once("value")).val() || {};
        let mapStreak = 0;
        for (let i = 0; i < ATTEND_KEEP_DAYS; i++) {
          if (dm[ymd(Date.now() - i * DAY_MS)]) mapStreak++;
          else break;
        }
        if (mapStreak > streak) streak = mapStreak;
      } catch (e) {}

      await uref.child("streak").set({ count: streak, lastDay: day });

      /* 풀출석 계산은 없앴습니다 (업적 제거).
         연속일수는 남겨둡니다 — 나중에 다시 쓸 수도 있고, 저장 비용이
         거의 없습니다. 화면에는 아무것도 안 나옵니다. */
      window._myAch = { streak };

      try { updateStatus(true); } catch (e) {}
    } catch (e) { console.warn("[recordAttendance failed]", e); }
  }

  /* [2026-08-03] 퇴장 시각 — 나가기 버튼을 누를 때 찍습니다.
     (창을 그냥 닫으면 못 찍지만, 입장 기록만으로 출석은 셉니다) */
  async function recordLeaveAttendance() {
    if (!myNick) return;
    try {
      const day = ymd(Date.now());
      await db.ref(`attendance/${day}/${myNick}`).update({ leftAt: Date.now(), at: Date.now() });
      /* [2026-08-14] 입장 기록으로 간소화되며 퇴장 로그는 안 적습니다 —
         출석부의 leftAt(위 한 줄)이면 충분해요 */
    } catch (e) { console.warn("[recordLeaveAttendance]", e); }
  }
  window.recordLeaveAttendance = recordLeaveAttendance;

  /* [2026-08-03] 📅 내 출석 달력 — 누구나 자기 출석만 봅니다.
     recordAttendance 가 users/{닉}/attend/days/{날짜}=true 로 찍어둔 것을
     달력 모양으로 그립니다. ‹ › 로 지난 달도 넘겨볼 수 있어요.

     [2026-08-06] 이 달력을 여는 버튼은 머리말에서 없앴습니다.
     같은 달력이 🗂️ 나의 작업 창(script_mywork.js) 왼쪽에 통째로
     들어갔고, 거기서는 그날 할 일까지 함께 보여주니까요.

     함수는 남겨둡니다 — 지우면 콘솔에서 showMyAttendance() 로 확인하던
     길이 막히고, 나중에 관리자 페이지에서 쓸 일이 생길 수도 있습니다.
     쓰이지 않는 동안에는 아무 일도 하지 않으므로 무해합니다.
     (toggleMyVacation 도 같은 이유로 남겨둡니다. 나의 작업 창은 이
      함수를 부르지 않고 자기 것을 씁니다 — 이 함수가 끝에
      showMyAttendance 를 불러 창을 겹쳐 띄우기 때문입니다.) */
  async function showMyAttendance(monthOffset = 0) {
    if (!myNick) { alert("입장 후에 볼 수 있어요."); return; }
    let daysMap = {};
    let vacMap = {};
    try {
      const snap = await db.ref(`users/${myNick}/attend/days`).once("value");
      daysMap = snap.val() || {};
    } catch (e) {}
    /* [2026-08-05] 🏖️ 휴가 — 날짜 칸을 눌러 표시해 둔 날들 */
    try {
      const vsnap = await db.ref(`users/${myNick}/vacations`).once("value");
      vacMap = vsnap.val() || {};
    } catch (e) {}

    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() - monthOffset);
    const y = base.getFullYear(), m = base.getMonth();
    const ymKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const firstDow = new Date(y, m, 1).getDay();
    const todayKey = ymd(Date.now());
    let attended = 0;
    let vacCount = 0;

    let cells = `<span class="att-dow">일</span><span class="att-dow">월</span><span class="att-dow">화</span><span class="att-dow">수</span><span class="att-dow">목</span><span class="att-dow">금</span><span class="att-dow">토</span>`;
    for (let i = 0; i < firstDow; i++) cells += `<span></span>`;
    for (let d = 1; d <= lastDay; d++) {
      const key = `${ymKey}-${String(d).padStart(2, "0")}`;
      const on = !!daysMap[key];
      const vac = !!vacMap[key];
      if (on) attended++;
      if (vac) vacCount++;
      /* [2026-08-05] 날짜 칸을 누르면 휴가 토글 — 과거·미래 아무 날이나 됩니다 */
      cells += `<span class="att-day${on ? " on" : ""}${vac ? " vac" : ""}${key === todayKey ? " today" : ""}" style="cursor:pointer;" title="누르면 휴가 표시를 켜고 꺼요" onclick="toggleMyVacation('${key}', ${monthOffset})">${vac ? "🏖️" : (on ? "✓" : d)}</span>`;
    }

    document.getElementById("my-attend-modal")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "my-attend-modal";
    overlay.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:7000;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);";
    overlay.innerHTML = `
      <div class="modal-content" style="width:min(360px, calc(100vw - 32px));">
        <div class="modal-title rec-weeknav" style="justify-content:center;">
          <button type="button" class="rec-nav" onclick="showMyAttendance(${monthOffset + 1})" title="지난 달">‹</button>
          <span>📅 ${y}년 ${m + 1}월 출석</span>
          <button type="button" class="rec-nav" ${monthOffset === 0 ? "disabled" : ""}
                  onclick="showMyAttendance(${monthOffset - 1})" title="다음 달">›</button>
        </div>
        <div class="modal-sub" style="text-align:center;">${escapeHtml(myNick)} · 이 달 <b>${attended}일</b> 출석했어요</div>
        <div class="att-grid">${cells}</div>
        <div class="modal-sub" style="text-align:center;margin-top:10px;">🏖️ 이번 달 휴가 <b>${vacCount}일</b></div>
        <div class="hint" style="text-align:center;margin-top:2px;">날짜를 누르면 휴가로 표시돼요</div>
        <button class="ghost-btn w-full" style="margin-top:12px;" onclick="document.getElementById('my-attend-modal').remove()">닫기</button>
      </div>`;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
  window.showMyAttendance = showMyAttendance;

  /* [2026-08-05] 🏖️ 휴가 토글 — 출석 달력의 날짜 칸을 누르면 켜고 끕니다.
     users/{닉}/vacations/{YYYY-MM-DD} = true 로 저장하고, 끄면 지웁니다.
     users 하위라 기존 보안규칙(닉 주인만 쓰기)이 그대로 적용돼요. */
  async function toggleMyVacation(dateKey, monthOffset = 0) {
    if (!myNick) return;
    const ref = db.ref(`users/${myNick}/vacations/${dateKey}`);
    try {
      const cur = (await ref.once("value")).val();
      if (cur) await ref.remove();
      else await ref.set(true);
    } catch (e) {
      console.warn("[toggleMyVacation]", e);
      alert("휴가 표시를 저장하지 못했어요. 연결을 확인해 주세요.");
      return;
    }
    showMyAttendance(monthOffset);   // 달력을 다시 그려 바로 보여줍니다
  }
  window.toggleMyVacation = toggleMyVacation;

  /* [2026-08-06] 🕳️ 숨은 문 — 관리자 페이지로 가는 유일한 통로.

     예전에는 머리말에 [🛡️ 관리자] 버튼이 대놓고 있었는데, 관리자
     페이지가 있다는 사실 자체를 굳이 알릴 필요가 없어 없앴습니다.
     대신 브랜드 줄의 빨간 박스(#head-count · "n명 집필 중")가 문이 됩니다.

     · 관리자 닉네임이 아니면 아무 일도 일어나지 않습니다.
       커서·색·툴팁(접속자 목록)을 하나도 건드리지 않아서, 남들 눈에는
       그냥 접속 인원 표시입니다. 흔적이 남지 않아요.
     · 관리자여도 한 번 누른 것만으로는 열리지 않습니다.
       그 자리는 지나가다 스칠 수 있는 곳이라, 단일 클릭으로 열면
       PIN 창이 불쑥 뜨는 오작동이 잦습니다. 그래서 더블클릭입니다. */
  /* =====================================================================
     🛡️ 숨은 문은 방장 + 운영진에게 열립니다 (2026-08-17)
     ---------------------------------------------------------------------
     예전에는 `myNick === ADMIN_NICK` 하나로 갈렸습니다. 운영진 넷이
     늘면서 서버의 staff 명단을 봐야 하는데, 문을 누를 때마다 서버에
     물으면 더블클릭이 굼떠 보입니다. 그래서 **입장 직후 한 번** 읽어
     두고 그 값을 씁니다.

     ★ 명단에 없으면 문은 **아무 반응이 없습니다** — "권한이 없습니다"
       같은 말을 띄우면 거기 문이 있다는 걸 알려주는 셈이라서요.
     ★ 못 읽었으면(끊김 등) false 로 둡니다. 안전한 쪽으로 틀리게.
     ★ 이건 문고리일 뿐입니다. 진짜 자물쇠는 보안규칙이에요.
     ===================================================================== */
  let _isStaff = false;

  async function refreshStaffFlag() {
    _isStaff = false;
    try {
      const uid = firebase.auth().currentUser?.uid;
      if (!uid) return;
      _isStaff = (await db.ref("staff/" + uid).once("value")).exists();
    } catch (e) { _isStaff = false; }
  }
  window.refreshStaffFlag = refreshStaffFlag;

  /* 방장이거나 운영진인가 */
  function canAdmin() {
    return myNick === ADMIN_NICK || _isStaff;
  }
  window.canAdmin = canAdmin;

  /* 🏠 **방장 하나만** 가리는 창구 (2026-08-22).
     ★ canAdmin() 과 다릅니다 — 그쪽은 운영진(staff)까지 포함해요.
       "나만" 이라는 뜻일 때는 반드시 이쪽을 쓰세요.
     ★ ADMIN_NICK 을 딴 파일에 베끼지 말 것 — 이미 두 파일(여기와
       script_admin.js)을 손으로 맞추고 있어서, 셋이 되면 언젠가 어긋납니다. */
  function isRoomOwner() { return myNick === ADMIN_NICK; }
  window.isRoomOwner = isRoomOwner;

  function openAdminPage() {
    /* 숨은 문 밖에서(콘솔 등) 불러도 같은 검사를 지납니다 */
    if (!canAdmin()) return;
    if (!requireAdminPin()) return;
    window.open("admin.html", "_blank");
  }
  window.openAdminPage = openAdminPage;

  function bindHeadCountDoor() {
    const hc = document.getElementById("head-count");
    if (!hc || hc._doorBound) return;
    hc._doorBound = true;
    /* 겉모습은 그대로 둡니다 — cursor·title 을 손대면 티가 나니까요 */
    hc.addEventListener("dblclick", () => {
      if (!canAdmin()) return;   // 방장·운영진이 아니면 무반응
      openAdminPage();
    });
  }
  window.bindHeadCountDoor = bindHeadCountDoor;

  function _closeAttendanceModal() {
    document.getElementById("attendance-modal")?.remove();
  }

  async function showAttendanceLog(monthOffset = 0) {
    if (!requireAdminPin()) return;
    try {
      /* [2026-08-03] 월별 기준 — ‹ › 로 지난 달을 넘겨봅니다.
         인원 정리는 달 단위니까, 조회도 그 달 날짜만 가져옵니다. */
      const base = new Date();
      base.setDate(1);
      base.setMonth(base.getMonth() - monthOffset);
      const ymKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
      const snap = await db.ref("attendance")
        .orderByKey().startAt(`${ymKey}-01`).endAt(`${ymKey}-31`).once("value");
      const v = snap.val() || {};
      const days = Object.keys(v).sort().reverse();

      /* [2026-08-03] 인원 정리용 요약 — 최근 30일 작가별 출석일수 · 마지막 출석일 */
      const per = {};
      days.forEach(d => Object.keys(v[d] || {}).forEach(n => {
        per[n] = per[n] || { days: 0, last: "" };
        per[n].days += 1;
        if (d > per[n].last) per[n].last = d;
      }));
      const summary = Object.keys(per).length ? `
        <div class="set-block" style="margin-bottom:10px;">
          <div class="set-title">👥 작가별 출석 (${ymKey.replace("-", "년 ")}월)</div>
          ${Object.entries(per).sort((a, b) => b[1].days - a[1].days).map(([n, s]) => `
            <div style="display:flex;align-items:center;gap:10px;padding:6px 4px;border-bottom:1px dashed var(--border);">
              <span style="flex:1;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(n)}</span>
              <span style="flex:0 0 auto;font-size:12px;font-weight:800;">${s.days}일</span>
              <span style="flex:0 0 auto;font-size:11.5px;color:var(--sub-muted);">마지막 ${escapeHtml(s.last.slice(5))}</span>
            </div>`).join("")}
        </div>` : "";

      let body;
      if (!days.length) {
        body = `<div class="hint" style="text-align:center;padding:20px 0;">아직 접속 기록이 없어요!</div>`;
      } else {
        body = days.map(d => {
          const rows = v[d] || {};
          const nicks = Object.keys(rows).sort((a, b) =>
            (rows[a]?.firstAt || 0) - (rows[b]?.firstAt || 0));
          const items = nicks.map(n => {
            const r = rows[n] || {};
            const first = r.firstAt || r.at;
            return `
              <div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px dashed var(--border);">
                <span style="font-size:17px;flex:0 0 auto;">${r.emoji || "✍️"}</span>
                <span style="flex:1;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(n)}</span>
                <span style="flex:0 0 auto;font-size:12px;font-weight:800;color:var(--sub-muted);">in ${first ? formatHHMM(first) : "-"}${r.leftAt ? " · out " + formatHHMM(r.leftAt) : ""}</span>
              </div>`;
          }).join("");
          return `
            <div class="set-block" style="margin-bottom:10px;">
              <div class="set-title" style="display:flex;justify-content:space-between;align-items:center;">
                <span>📅 ${escapeHtml(d)}</span>
                <span style="font-size:12px;color:var(--sub-muted);font-weight:900;">${nicks.length}명</span>
              </div>
              ${items}
            </div>`;
        }).join("");
      }

      _closeAttendanceModal();
      const overlay = document.createElement("div");
      overlay.id = "attendance-modal";
      overlay.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:7000;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);";
      overlay.innerHTML = `
        <div class="modal-content" style="max-height:calc(100vh - 60px);display:flex;flex-direction:column;width:min(440px, calc(100vw - 32px));">
          <div class="modal-title rec-weeknav" style="justify-content:center;">
            <button type="button" class="rec-nav" onclick="showAttendanceLog(${monthOffset + 1})" title="지난 달">‹</button>
            <span>📋 출석부 · ${ymKey.replace("-", "년 ")}월</span>
            <button type="button" class="rec-nav" ${monthOffset === 0 ? "disabled" : ""}
                    onclick="showAttendanceLog(${monthOffset - 1})" title="다음 달">›</button>
          </div>
          <div class="modal-sub">작가별 출석일수와 날짜별 입·퇴장 시각이에요. (퇴장은 🚪 나가기를 눌렀을 때만 찍혀요)</div>
          <div style="flex:1;overflow:auto;min-height:0;">${summary}${body}</div>
          <div style="height:10px;"></div>
          <button class="ghost-btn" style="width:100%;" onclick="document.getElementById('attendance-modal').remove()">닫기</button>
        </div>`;
      overlay.addEventListener("click", (e) => { if (e.target === overlay) _closeAttendanceModal(); });
      document.body.appendChild(overlay);
    } catch(e) {
      console.warn("[showAttendanceLog failed]", e);
      alert("접속 기록을 불러오지 못했어요 😢");
    }
  }

  /* 업적 테스트 모드는 없앴습니다 (업적 자체가 없어졌으므로). */

  async function clearAllChat() {
    if (!requireAdminPin()) return;
    if (!confirm("정말 채팅을 모두 삭제할까요? (되돌릴 수 없어요!)")) return;

    const now = Date.now();
    await db.ref("chatMeta/clearedAt").set(now);
    await db.ref("messages").remove();
    await db.ref("messages").push({ type: "system", msg: "🧹 관리자가 채팅을 전체 삭제했습니다.", time: now });

    clearChatUI();
  }

  window.listenStatus = listenStatus;
  window.listenPomodoro = listenPomodoro;
  window.listenMessages = listenMessages;
  window.updateStatus = updateStatus;
  window.renderUserCards = renderUserCards;   // ✅ [프로필] 프로필 변경 시 재렌더용
  window.startPomodoro = startPomodoro;
  window.stopPomodoro = stopPomodoro;
  window.togglePomoRun = togglePomoRun;
  window.pausePomodoro = pausePomodoro;
  window.resumePomodoro = resumePomodoro;
  window.isPomodoroPaused = _isPaused;
  window.isPomodoroRunning = isPomodoroRunning;
  window.pomodoroPhase = pomodoroPhase;
  window.requireAdminPin = requireAdminPin;
  window.clearAllChat = clearAllChat;

  /* [2026-08-03] 관리자 — 오늘 글자수 창 초기화 (채팅 전체 삭제와 같은 결)
     오늘 날짜의 wordfeed(말풍선)와 wordlog(누적)를 지웁니다.
     보안규칙: $day 에 "삭제만" 허용하는 규칙이 필요합니다 (보안규칙.json 참고). */
  async function clearAllWordcount() {
    if (!requireAdminPin()) return;
    if (!confirm("오늘의 글자수 기록을 초기화할까요?\n모두의 오늘 기록·말풍선이 지워집니다. (되돌릴 수 없어요!)")) return;
    const day = window.Wordcount?.dayKey?.(new Date()) || new Date().toISOString().slice(0, 10);
    try {
      await db.ref(`wordfeed/${day}`).remove();
      await db.ref(`wordlog/${day}`).remove();
      alert("🧹 오늘 글자수 기록을 초기화했어요.");
    } catch (e) {
      console.warn("[clearAllWordcount]", e);
      alert("초기화하지 못했어요 — 파이어베이스 콘솔에 새 보안규칙을 적용했는지 확인해 주세요.");
    }
  }
  window.clearAllWordcount = clearAllWordcount;
  window.applyHistoryConfig = applyHistoryConfig;
  window.loadHistoryNow = loadHistoryNow;
  window.recordAttendance = recordAttendance;
  window.showAttendanceLog = showAttendanceLog;
  window.updateChatHeader = updateChatHeader;
