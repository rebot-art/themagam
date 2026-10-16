/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   👋 인사 규칙 (script_greet.js) — 2026-10-16 콩

   [무엇인가]
   입장하면 "○○님 입장!", 처음 말하거나 스티커를 보내면
   "오늘도 건필! ○○님, n번째 출석입니다." 가 모두에게 보입니다.
   입장하고 10분이 지나도 말이 없으면 "○○님, n번째 출석입니다." 가 먼저 뜨고,
   5분을 더 기다려서도 없으면 "○○님, 인사를 빼먹었어요. (n회)" 가 뜹니다.
   빼먹은 날은 greetMiss/{닉}/{날짜} 에 남고, 관리자 출석부가 핑크 칸으로 보여 줍니다.

   [도장 두 개 — 콩의 구상]
     1차 = 입장 도장(attendance/{날}/{닉}, 지금처럼 입장하면 바로)
     2차 = 인사 도장(attendance/{날}/{닉}/gAt, 인사한 시각)
   인사 여부는 **서버에 적힌 값**으로 복구합니다 — 새로고침·재입장을 해도
   이미 한 인사를 잊지 않아요. (창 안의 시계는 새로 시작해도 되지만, 인사했는가는 서버 기준)

   [콩이 정한 규칙]
   · 인사 확인은 그날 **처음 입장할 때만**. 같은 날 재입장(새로고침 포함)은 규칙 적용 안 함.
   · 새로고침(20시간 자동·방장 전체) 때문에 다시 로그인한 경우도 적용 안 함 (자정 넘겨 작업 중이던 사람).
   · 인사 = 내가 이 방에 보낸 모든 말(글·스티커·명령어). 스티커 종류를 따지지 않아요.
   · 휴가·개인사정인 날은 대상이 아닙니다.
   · 15분도 안 머물고 나간 사람은 대상이 아닙니다 (A안 — 휴가 확인하러 잠깐 들른 경우).
     → 이 창이 **실제로 깨어 있던 시간**을 쌓아서 셉니다. 컴퓨터가 잠든 시간은 안 셉니다.
   · 횟수는 연속이 아니라 쌓입니다. 표시는 10회까지만.
   · 2026-10 은 유예 — 센다, 처분은 운영진이. 11/1 부터 횟수를 다시 셉니다(COUNT_FROM).
   · 방장이 일부러 새로고침을 시킨 사람에게는 보너스 5분(greetBonus).

   [통신량] 입장할 때 아주 작은 읽기 3번(휴가·개인사정·내 빼먹음 기록),
   인사할 때 쓰기 1번 + 메시지 1줄. 새로 귀를 여는 곳은 없습니다.

   [시험] 혼자 방 먼저 시험했고 2026-10-16 본방을 켰습니다(MAIN_ON=true). 주소 끝에 &greetspeed=1 을 붙이면
   1분이 1초로 줄어듭니다 (10분→10초, 15분→15초).
   ===================================================================== */
(function () {
  "use strict";

  const MAIN_ON = true;                          // 2026-10-16 콩: 혼자 방 시험 통과 → 본방 켬 (끄려면 false)
  const SOLO = () => !!window.SOLO;
  const ON = () => SOLO() || MAIN_ON;
  const TEST = /[?&]greetspeed=1/.test(location.search);
  const RESET = /[?&]greetreset=1/.test(location.search);      // 혼자 방 시험용 — 오늘의 인사·빼먹음 기록을 지우고 다시 시작
  const MIN = TEST ? 1000 : 60000;               // "1분" 의 길이(ms)
  const T_WAIT = 10 * MIN;                       // 이때까지 말이 없으면 "n번째 출석입니다"
  const T_WARN = 15 * MIN;                       // 이때까지 없으면 "빼먹었어요"
  const DT_CAP = 5 * MIN;                        // 틱 사이가 이보다 길면 잠들었던 것 — 5분까지만 쳐 줍니다
  const START_DAY = "2026-10-16";                // 이 날 이전은 규칙 밖(기록이 없어서 판단 불가)
  const COUNT_FROM = "2026-11-01";               // 이 날부터 횟수를 다시 셉니다
  const CAP = 10;                                // 횟수 표시 상한
  const KINDS = ["in", "ok", "wait", "warn", "out"];   // out = 퇴장 카드 (script_core.js 가 씁니다)

  const 나 = () => { try { return (typeof myNick === "string" && myNick) ? myNick : (window.myNick || ""); } catch (e) { return ""; } };
  const 날 = (t) => (window.ymd ? window.ymd(t) : new Date(t).toISOString().slice(0, 10));
  const DB = () => window.db;

  let S = null;       // 이 창의 오늘 상태
  let _타이머 = null;
  let _깨움붙임 = false;

  /* ---------- 순수 계산 (checks.js 가 따로 시험합니다) ---------- */

  /** 횟수를 어디서부터 셀지 — 11/1 이후면 11/1, 그 전이면 시행일 */
  function 세기시작(day) { return day >= COUNT_FROM ? COUNT_FROM : START_DAY; }

  /** 빼먹은 날 지도 {YYYY-MM-DD: ts} 에서 이 기간의 횟수 */
  function 셈(map, day) {
    const from = 세기시작(day);
    return Object.keys(map || {}).filter(d => d >= from).length;
  }

  const 표시횟수 = (n) => Math.min(CAP, Math.max(0, n));

  function 문구(kind, nick, n, extra) {
    if (kind === "in")   return `${nick}님 입장!`;
    if (kind === "ok")   return extra === "short" ? `오늘도 건필! ${nick}님` : `오늘도 건필! ${nick}님, ${n}번째 출석입니다.`;
    if (kind === "wait") return `${nick}님, ${n}번째 출석입니다.`;
    if (kind === "warn") return `${nick}님, 인사를 빼먹었어요. (${n}회)`;
    return "";
  }

  /* ---------- 서버 읽고 쓰기 ---------- */

  async function 몇번째(nick, day) {
    try {
      const ym = day.slice(0, 7);
      const s = await DB().ref(`users/${nick}/attend/days`).orderByKey().startAt(`${ym}-01`).endAt(`${ym}-31`).once("value");
      let n = 0, 오늘있음 = false;
      s.forEach(c => { if (c.val()) { n++; if (c.key === day) 오늘있음 = true; } });
      return Math.max(1, 오늘있음 ? n : n + 1);
    } catch (e) { return 1; }
  }

  async function 올리기(kind, text) {
    if (!S) return;
    const key = `gr_${kind}_${S.nick}_${S.day}` + (kind === "in" ? `_${S.joinAt}` : "");
    const payload = { type: "system", msg: text, time: Date.now(), gk: kind, greetOf: S.nick };
    try {
      await DB().ref(`messages/${key}`).set(payload);
      window._renderMessageLocal?.(key, payload);
    } catch (e) { console.warn("[greet post]", e); }
  }

  function 멈추기() {
    if (S) S.done = true;
    if (_타이머) { clearInterval(_타이머); _타이머 = null; }
  }

  /* ---------- 시계 ---------- */

  function 틱() {
    if (!S || S.done || S.greeted) return;
    const now = Date.now();
    S.alive += Math.min(Math.max(0, now - S.last), DT_CAP);
    S.last = now;
    if (!S.ready) return;                         // 서버 값(휴가·빼먹음)이 아직 안 왔어요
    if (S.alive >= T_WAIT && !S.waited) { S.waited = true; 기다림알림(); }
    if (S.alive >= T_WARN + S.extra && !S.warned) { S.warned = true; 경고(); }
  }

  async function 기다림알림() {
    const n = await 몇번째(S.nick, S.day);
    if (!S || S.greeted || S.done) return;
    S.n = n;
    올리기("wait", 문구("wait", S.nick, n));
  }

  async function 경고() {
    if (!S || S.greeted || S.done) return;
    const nick = S.nick, day = S.day;
    try {
      /* 만들기만 됩니다(규칙) — 이미 있으면 건드리지 않아요 */
      if (!S.miss[day]) {
        await DB().ref(`greetMiss/${nick}/${day}`).set(Date.now());
        S.miss[day] = Date.now();
      }
    } catch (e) { console.warn("[greet miss]", e); }
    const n = 표시횟수(셈(S.miss, day));
    await 올리기("warn", 문구("warn", nick, n));
    멈추기();
  }

  /* ---------- 인사 감지 — script_realtime.js 의 메시지 받는 곳이 부릅니다 ---------- */

  async function 인사함(data) {
    /* 경고가 뜬 뒤(done 이지만 warned)의 늦은 인사는 말 없이 도장만 찍습니다 */
    if (!ON() || !S || S.greeted || (S.done && !S.warned)) return;
    if (Number(data && data.time) < S.joinAt - 2000) return;     // 옛 기록은 인사가 아닙니다
    S.greeted = true;
    const nick = S.nick, day = S.day;
    const 이미경고 = S.warned;
    try { await DB().ref(`attendance/${day}/${nick}`).update({ gAt: Date.now() }); } catch (e) { console.warn("[greet gAt]", e); }
    if (이미경고) { 멈추기(); return; }                              // 이미 빼먹음이 남았어요 — 말 없이 둡니다
    const n = S.n || await 몇번째(nick, day);
    await 올리기("ok", 문구("ok", nick, n, S.waited ? "short" : ""));
    멈추기();
  }

  /* ---------- 시작 — recordAttendance 가 부릅니다(혼자 방은 solo 가 부릅니다) ---------- */

  async function 시작(opt) {
    if (!ON()) return;
    const nick = 나();
    if (!nick || !DB()) return;
    const day = (opt && opt.day) || 날(Date.now());
    if (!TEST && day < START_DAY) return;
    멈추기();
    const prev = (opt && opt.prev) || null;
    S = {
      nick, day, joinAt: Date.now(), last: Date.now(), alive: 0, extra: 0,
      greeted: !!(prev && prev.gAt), waited: false, warned: false, done: false,
      ready: false, miss: {}, n: 0
    };
    /* ★ 인사 확인은 **그날 처음 입장할 때만** (콩 결정 2026-10-16). 오늘 입장 도장이 이미 있었으면(prev)
         같은 날 재입장·새로고침·20시간 자동 새로고침이므로 규칙을 적용하지 않습니다. */
    if (prev && (prev.firstAt || prev.at)) { 멈추기(); return; }
    /* ★ 새로고침(20시간 자동·방장 전체) 때문에 **다시 로그인한** 사람도 적용하지 않습니다 (콩 결정 2026-10-16).
         자정을 넘겨 한창 작업 중이다가 로그인 화면이 떠서 새로 들어온 경우, 인사를 새로 하라는 건 억울해요. */
    try { if (window.Reload?.cameFromReload?.()) { 멈추기(); return; } } catch (e) {}
    if (SOLO()) {
      /* 혼자 방은 입장 절차가 없어서 입장 카드를 여기서 올립니다 (새로고침으로 돌아온 경우는 조용히) */
      if (!window.__silentJoin) 올리기("in", 문구("in", nick));
      try { DB().ref(`users/${nick}/attend/days/${day}`).set(true); } catch (e) {}
    }
    if (SOLO() && RESET) {
      /* 시험 되돌리기: 오늘 빼먹음/인사 기록을 지웁니다 (혼자 방 전용) */
      try { await DB().ref(`greetMiss/${nick}/${day}`).remove(); } catch (e) {}
      try { await DB().ref(`attendance/${day}/${nick}/gAt`).remove(); } catch (e) {}
      S.greeted = false;
    } else if (SOLO() && !S.greeted) {
      /* 혼자 방은 이전 기록을 안 넘겨 주니 직접 읽습니다 */
      try { const g = await DB().ref(`attendance/${day}/${nick}/gAt`).once("value"); if (g.val()) S.greeted = true; } catch (e) {}
    }
    if (S.greeted) { 멈추기(); return; }
    try {
      const [vac, leave, miss] = await Promise.all([
        DB().ref(`users/${nick}/vacations/${day}`).once("value"),
        DB().ref(`users/${nick}/leaves/${day}`).once("value"),
        DB().ref(`greetMiss/${nick}`).once("value")
      ]);
      if (!S || S.nick !== nick) return;
      if (vac.val() === true || leave.val() === true) { 멈추기(); return; }     // 휴가·개인사정은 대상이 아닙니다
      S.miss = miss.val() || {};
      if (S.miss[day]) { 멈추기(); return; }                                      // 오늘 이미 빼먹음이 적혔어요
    } catch (e) { console.warn("[greet start read]", e); }
    if (!S) return;
    S.ready = true;
    S.last = Date.now();
    try { const b = window.Reload?.takeBonus?.(); if (b) 보너스(b); } catch (e) {}   // 방장이 시킨 새로고침이면 +5분
    _타이머 = setInterval(틱, TEST ? 500 : 5000);
    if (!_깨움붙임) {
      _깨움붙임 = true;
      /* 잠들었다 깨어난 순간 바로 계산해 봅니다 (타이머가 느려졌을 수 있어서) */
      document.addEventListener("visibilitychange", () => { if (!document.hidden) 틱(); });
    }
  }

  /** 방장이 일부러 새로고침을 시킨 사람 — 인사 시간 5분 보너스 */
  function 보너스(ms) { if (S) S.extra += Number(ms) || 5 * MIN; }

  window.greetOn = () => ON();
  window.greetStart = 시작;
  window.greetNote = 인사함;
  window.greetBonus = 보너스;
  window.Greet = {
    KINDS, CAP, START_DAY, COUNT_FROM,
    _t: { 세기시작, 셈, 표시횟수, 문구, 틱, 시작, 인사함, state: () => S }
  };
})();
