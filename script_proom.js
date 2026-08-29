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

  let _proomRef = null, _proomHereRef = null, _proom나여기 = null;
  let _proomRows = [], _proomHere = 0;
  let _proomBound = false, _proomBusy = false;
  let _proom열림 = false;
  let _proom틀 = "";
  let _proom시계기 = null;
  let _proom옛단계 = null;         // 뽀모↔휴식이 바뀌는 순간을 알아채려고
  let _proom시차 = 0;              // 서버 시각과 내 시계의 차이(ms)

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

  /** 단계가 바뀔 때 짧고 부드럽게 — 놀라지 않게 아주 작습니다 */
  function proom소리(휴식) {
    if (!proom종()) return;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      const ac = new A();
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
      setTimeout(() => { try { ac.close(); } catch (e) {} }, 700);
    } catch (e) {}
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
      <div class="pr-board">
        <div class="pr-clock">
          <div class="pr-big" id="proom-big">25:00</div>
          <div class="pr-right">
            <div class="pr-lab">
              <span class="pr-ph" id="proom-ph">🍅 뽀모</span>
              <span id="proom-next">· :00 에 휴식</span>
              <span class="pr-sp"></span>
              <span id="proom-cnt">1명</span>
              <button type="button" class="pr-bell" id="proom-bell"
                      data-proom-bell="1" aria-label="알림">🔔</button>
            </div>
            <div class="pr-bar"><i id="proom-bar" style="width:0%"></i></div>
          </div>
        </div>
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
    if (cnt) cnt.textContent = (_proomHere || 1) + "명";

    /* 단계가 바뀌는 순간 — 소리 한 번, 줄 한 번 */
    const 단계 = st.휴식 ? "휴식" : "뽀모";
    if (_proom옛단계 !== null && _proom옛단계 !== 단계) {
      proom소리(st.휴식);
      proom줄그리기();                       // 새 구분 줄이 끼어들게
      const b = el("proom-big")?.closest(".pr-board");
      if (b) { b.classList.add("pr-flash"); setTimeout(() => b.classList.remove("pr-flash"), 900); }
    }
    _proom옛단계 = 단계;
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
    const 내것 = r.user === proomMe();
    const d = new Date(r.time);
    const h = d.getHours(), m = 두자리(d.getMinutes());
    return `
      <div class="pr-line${내것 ? " mine" : ""}">
        <span class="pr-who">${esc(r.user)}</span>
        <span class="pr-msg">${esc(r.msg)}</span>
        <span class="pr-t">${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${m}</span>
      </div>`;
  }

  /** 대화 사이사이에 단계 구분 줄을 시간순으로 끼웁니다.
      ★ **말이 오간 구간의 구분 줄만** 넣습니다. 안 그러면 밤새 조용했을 때
        빈 구분 줄이 수백 개 쌓여요 (밤 열 시간이면 스무 바퀴, 마흔 줄). */
  function proom엮기() {
    const 줄 = _proomRows.slice();
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
    if (!_proomRef) {
      _proomRef = window.db.ref("proom").orderByChild("time").limitToLast(PROOM_MAX);
      _proomRef.on("value", (snap) => {
        const raw = snap.val() || {};
        _proomRows = Object.keys(raw).map((id) => {
          const v = raw[id] || {};
          const msg = String(v.msg || "");
          if (!msg.trim()) return null;
          return { id, user: String(v.user || ""), msg: msg.slice(0, PROOM_LEN), time: Number(v.time) || 0 };
        }).filter(Boolean).sort((a, b) => a.time - b.time);
        proom줄그리기();
      });
    }
    /* 인원 — 들어와 있는 동안만. 끊기면 서버가 지웁니다 */
    const 나 = proomMe();
    if (나 && !_proom나여기) {
      try {
        _proom나여기 = window.db.ref("proomHere/" + 나);
        _proom나여기.onDisconnect().remove();
        _proom나여기.set(Date.now());
      } catch (e) {}
    }
    if (!_proomHereRef) {
      _proomHereRef = window.db.ref("proomHere");
      _proomHereRef.on("value", (s) => {
        _proomHere = s.numChildren() || 0;
        const c = el("proom-cnt");
        if (c) c.textContent = (_proomHere || 1) + "명";
      });
    }
  }

  function proom그만듣기() {
    try { _proomRef?.off(); } catch (e) {}
    try { _proomHereRef?.off(); } catch (e) {}
    try { _proom나여기?.remove(); } catch (e) {}
    _proomRef = null; _proomHereRef = null; _proom나여기 = null;
    clearInterval(_proom시계기); _proom시계기 = null;
  }

  async function proom보내기() {
    const 칸 = el("proom-in");
    const t = String(칸?.value || "").trim().slice(0, PROOM_LEN);
    if (!t || _proomBusy || !window.db || !proomMe()) return;
    _proomBusy = true;
    if (칸) { 칸.value = ""; 칸.focus(); }
    try {
      await window.db.ref("proom").push().set({ user: proomMe(), msg: t, time: Date.now() });
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
      if (e.target.closest("[data-proom-bell]")) { proom종바꾸기(); el("proom-in")?.focus(); return; }
      if (e.target.closest("[data-proom-send]")) { proom보내기(); return; }
    });
    /* 엔터로 보내기 — ★ 한글 조합 중은 무시합니다 */
    host.addEventListener("keydown", (e) => {
      if (e.target?.id !== "proom-in") return;
      if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      proom보내기();
    });
  }

  /** 알약 판이 열릴 때 */
  function openProom() {
    proom묶기();
    proom시차맞추기();
    _proom열림 = true;
    _proom옛단계 = null;             // 열자마자 소리가 나지 않게
    proom그리기();
    proom듣기();
    /* ★ 시계는 여기서만 돕니다. 판을 닫으면 멈춰요 —
       안 보는 판 때문에 250ms 마다 일할 이유가 없습니다. */
    clearInterval(_proom시계기);
    _proom시계기 = setInterval(proom시계, 250);
    setTimeout(() => el("proom-in")?.focus(), 60);
  }
  function closeProom() {
    _proom열림 = false;
    proom그만듣기();
  }
  window.openProom = openProom;
  window.closeProom = closeProom;
})();
