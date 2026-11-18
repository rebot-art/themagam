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
   · 인사 확인은 그날 **처음 입장할 때**. 같은 날 재입장(새로고침 포함)은 규칙 적용 안 함.
     ★ 단, 직접 나갔다 **2시간 넘어** 다시 들어오면 "재접속 모드" (2026-10-17 콩): 인사하면
       「17일, 재접속입니다. 파이팅!」 카드(gk:"re")가 뜨고, 안 해도 **아무 일도 없습니다** —
       빼먹음(greetMiss)도, 기다림·경고 카드도, 읽기·쓰기도 없어요. 15분 안에 한 인사만 받습니다.
       나간 시각은 attendance/{날}/{닉}/leftAt (나가기 버튼·창 닫을 때 모두 적습니다). 시각을 모르면 확인 안 함.
       (새로고침 재입장·자정 넘긴 이어진 작업은 그대로 조용합니다.)
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

   [★ 2026-11-18 새 방식 — "출석 = 그날 접속한 시간이 기준(30분)을 넘는 순간" (콩 결정)]
   입장할 때 도장을 찍지 않습니다. 대신
     · 접속 기록(visit)  users/{닉}/attend/visit = { day, firstAt, at, gAt, leftAt } — 그날 첫 입장·인사·퇴장 (가장 최근 하루만)
     · 그날 연결돼 있던 시간(모든 상태 합, TimeLog.liveStayMs)이 기준(기본 30분, config/attendMin)을 넘는 순간
       attendance/{날}/{닉} 줄이 처음 생기고(= 출석 도장) 「n번째 출석입니다!」 카드가 뜹니다.
     · 인사 = 「○○님, 오늘도 건필!」(hi 카드). 기준 시간이 됐는데 인사가 아직 없으면 노란 카드
       「○○님, n번째 출석입니다. 인사를 아직 안 하셨어요」 → 이 창이 깨어 있던 5분 안에 인사 없으면 분홍 「빼먹었어요 (n회)」.
     · 창을 열어 둔 채 자정을 넘겨도 새 날 몫이 따로 쌓여서 30분이 되면 그 날 도장이 찍힙니다(인사는 그날 첫 입장에만).
   켜짐: 혼자 방은 늘, 본방은 ATT_MAIN=true 일 때 (본방은 아직 옛 방식 — 입장하면 바로 도장).

   [시험] 혼자 방 먼저 시험했고 2026-10-16 본방을 켰습니다(MAIN_ON=true). 주소 끝에 &greetspeed=1 을 붙이면
   1분이 1초로 줄어듭니다 (10분→10초, 15분→15초).
   ===================================================================== */
(function () {
  "use strict";

  const MAIN_ON = true;                          // 2026-10-16 콩: 혼자 방 시험 통과 → 본방 켬 (끄려면 false)
  const SOLO = () => !!window.SOLO;
  const ON = () => SOLO() || MAIN_ON;
  const ATT_MAIN = false;                        // 2026-11-18: 새 출석 방식(접속 시간 합산) — 혼자 방 시험 후 본방에서 true
  const OLD_FORCE = /[?&]att30=0/.test((typeof location !== "undefined" && location.search) || "");   // 혼자 방에서 옛 방식과 비교·되돌리기용 (&att30=0)
  const NEW = () => !OLD_FORCE && (SOLO() || ATT_MAIN);
  const ATT_MIN_DEFAULT = 30;                    // 출석 인정 시간(분) 기본값 — 관리자가 config/attendMin 으로 바꿉니다
  const ATT_TEST = (/[?&]attmin=(\d+)/.exec(location.search) || [])[1];   // 혼자 방 시험용 — &attmin=1 이면 1분
  const TEST = /[?&]greetspeed=1/.test(location.search);
  const RESET = /[?&]greetreset=1/.test(location.search);      // 혼자 방 시험용 — 오늘의 인사·빼먹음 기록을 지우고 다시 시작
  const MIN = TEST ? 1000 : 60000;               // "1분" 의 길이(ms)
  const T_WAIT = 10 * MIN;                       // 이때까지 말이 없으면 "n번째 출석입니다"
  const T_WARN = 15 * MIN;                       // 이때까지 없으면 "빼먹었어요" (재접속 모드는 이때까지 받고 조용히 끝)
  const GRACE = 5 * MIN;                         // 새 방식: 기준 시간이 된 뒤 인사를 기다려 주는 시간
  const T_AWAY = 120 * MIN;                      // 이만큼 나가 있다 돌아오면 "재접속" 인사 확인 (콩 결정 2026-10-17: 2시간)
  const REGREET = /[?&]regreet=1/.test(location.search);       // 혼자 방 시험용 — 재접속 모드를 바로 켭니다
  const DT_CAP = 5 * MIN;                        // 틱 사이가 이보다 길면 잠들었던 것 — 5분까지만 쳐 줍니다
  const START_DAY = "2026-10-16";                // 이 날 이전은 규칙 밖(기록이 없어서 판단 불가)
  const COUNT_FROM = "2026-11-01";               // 이 날부터 횟수를 다시 셉니다
  const CAP = 10;                                // 횟수 표시 상한
  const KINDS = ["in", "ok", "wait", "warn", "out", "re", "hi", "att"];   // out = 퇴장 카드 (script_core.js 가 씁니다)

  const 나 = () => { try { return (typeof myNick === "string" && myNick) ? myNick : (window.myNick || ""); } catch (e) { return ""; } };
  const 날 = (t) => (window.ymd ? window.ymd(t) : new Date(t).toISOString().slice(0, 10));
  const DB = () => window.db;

  let S = null;       // 이 창의 오늘 상태
  let _visit = null;  // 새 방식: 이 창이 아는 오늘의 접속 기록 { day, firstAt, gAt, ... }
  const A = { stamped: {}, busy: false, priming: {} };   // 새 방식: 날짜별 "도장 찍힘" · 읽는 중
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
    if (kind === "hi")   return `${nick}님, 오늘도 건필!`;
    if (kind === "att")  return `${nick}님, ${n}번째 출석입니다!`;
    if (kind === "ok")   return extra === "short" ? `오늘도 건필! ${nick}님` : `오늘도 건필! ${nick}님, ${n}번째 출석입니다.`;
    if (kind === "wait") return extra === "new" ? `${nick}님, ${n}번째 출석입니다. 인사를 아직 안 하셨어요` : `${nick}님, ${n}번째 출석입니다.`;
    if (kind === "warn") return `${nick}님, 인사를 빼먹었어요. (${n}회)`;
    if (kind === "re")   return `${Number(String(extra || "").slice(8)) || ""}일, 재접속입니다. 파이팅!`;
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

  async function 올리기(kind, text, ctx) {
    const c = ctx || S;
    if (!c) return;
    const key = `gr_${kind}_${c.nick}_${c.day}` + ((kind === "in" || kind === "re") ? `_${c.joinAt}` : "");
    const payload = { type: "system", msg: text, time: Date.now(), gk: kind, greetOf: c.nick };
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
    if (S.re) { if (S.alive >= T_WARN + S.extra) 멈추기(); return; }   // 재접속 모드 — 기다림·경고 없이 조용히 끝
    if (NEW()) {                                  // 새 방식 — 기다림 카드는 출석 확정이 띄웁니다. 여기서는 그 뒤 5분만 잽니다
      if (S.waited && !S.warned && S.alive - (S.waitAt || 0) >= GRACE + S.extra) { S.warned = true; 경고(); }
      return;
    }
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
    if (S.re) { await 올리기("re", 문구("re", nick, 0, day)); 멈추기(); return; }   // 재접속 인사 — 카드만, 기록은 없음
    const 이미경고 = S.warned;
    if (NEW()) {
      /* 새 방식 — 인사 시각은 접속 기록(visit)에 적고, 도장 줄이 이미 있으면 거기에도 얹습니다.
         (도장 줄이 없는 때 update 하면 줄이 어긋나게 생기니 절대 먼저 쓰지 않아요) */
      const t = Date.now();
      if (_visit && _visit.day === day) _visit.gAt = t;
      try { await DB().ref(`users/${nick}/attend/visit`).update({ gAt: t }); } catch (e) { console.warn("[greet visit gAt]", e); }
      if (A.stamped[day]) { try { await DB().ref(`attendance/${day}/${nick}`).update({ gAt: t }); } catch (e) {} }
      if (이미경고) { 멈추기(); return; }
      await 올리기("hi", 문구("hi", nick, 0));
      멈추기(); return;
    }
    try { await DB().ref(`attendance/${day}/${nick}`).update({ gAt: Date.now() }); } catch (e) { console.warn("[greet gAt]", e); }
    if (이미경고) { 멈추기(); return; }                              // 이미 빼먹음이 남았어요 — 말 없이 둡니다
    const n = S.n || await 몇번째(nick, day);
    await 올리기("ok", 문구("ok", nick, n, S.waited ? "short" : ""));
    멈추기();
  }

  /* ---------- ★ 새 방식: 접속 시간이 기준을 넘으면 출석 도장 (2026-11-18) ---------- */
  let _attMinV = null, _확정타이머 = null;

  async function 기준읽기() {
    if (ATT_TEST) { _attMinV = Math.max(1, Number(ATT_TEST)); return; }       // 혼자 방 시험용 (&attmin=1)
    if (_attMinV != null) return;
    try {
      const s = await DB().ref("config/attendMin").once("value");
      const v = Number(s.val());
      _attMinV = (v >= 1 && v <= 600) ? v : ATT_MIN_DEFAULT;
    } catch (e) { _attMinV = ATT_MIN_DEFAULT; }
  }

  async function 출석확정(day) {
    const nick = 나();
    let prev = null;
    try { prev = (await DB().ref(`attendance/${day}/${nick}`).once("value")).val(); } catch (e) { return; }   // 못 읽으면 다음 틱에 다시
    if (prev && (prev.firstAt || prev.at)) { A.stamped[day] = true; return; }                                // 이미 찍혀 있음 (다른 창·재입장)
    const v = (_visit && _visit.day === day) ? _visit : {};
    const first = v.firstAt || Date.now();
    A.stamped[day] = true;
    try { await window.attendStamp(day, { firstAt: first, gAt: v.gAt || null }); }
    catch (e) { A.stamped[day] = false; console.warn("[attend stamp]", e); return; }
    const n = await 몇번째(nick, day);
    const ctx = { nick, day, joinAt: first };
    const 인사함 = !!(v.gAt || (S && S.day === day && S.greeted));
    const 인사확인대상 = S && S.day === day && S.ready && !S.done && !S.re && !S.greeted && !S.warned;
    if (!인사함 && 인사확인대상) {
      /* 기준 시간이 됐는데 인사가 아직 — 노란 카드, 이 창이 깨어 있던 5분(GRACE) 안에 없으면 분홍 카드 */
      S.waited = true; S.waitAt = S.alive; S.n = n;
      await 올리기("wait", 문구("wait", nick, n, "new"), ctx);
    } else {
      await 올리기("att", 문구("att", nick, n), ctx);
    }
  }

  async function 확정틱() {
    if (!NEW() || A.busy) return;
    const nick = 나();
    if (!nick || !DB() || !window.TimeLog || _attMinV == null) return;
    const day = 날(Date.now());
    if (A.stamped[day]) return;
    /* 창을 열어 둔 채 자정을 넘겼으면 새 날의 접속 기록부터 새로 적습니다 (인사 확인은 그날 첫 입장에만 — 이 경우는 면제) */
    if (_visit && _visit.day !== day) {
      const t = Date.now();
      _visit = { day, firstAt: t, at: t };
      try { await DB().ref(`users/${nick}/attend/visit`).set(_visit); } catch (e) {}
    }
    A.busy = true;
    try {
      if (!window.TimeLog.stayPrimed(day)) await window.TimeLog.primeStay(day);
      if (!window.TimeLog.stayPrimed(day)) return;
      if (window.TimeLog.liveStayMs(day) < _attMinV * MIN) return;
      await 출석확정(day);
    } catch (e) { console.warn("[attend tick]", e); }
    finally { A.busy = false; }
  }

  function 확정시작() {
    if (!NEW()) return;
    기준읽기().then(확정틱);
    if (!_확정타이머) {
      _확정타이머 = setInterval(확정틱, ATT_TEST ? 5000 : 30000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) 확정틱(); });
    }
  }

  /* ---------- 시작 — recordAttendance 가 부릅니다(혼자 방은 solo 가 부릅니다) ---------- */

  async function 시작(opt) {
    if (!ON()) return;
    const nick = 나();
    if (!nick || !DB()) return;
    const day = (opt && opt.day) || 날(Date.now());
    if (!TEST && day < START_DAY) return;
    멈추기();
    let prev = (opt && opt.prev) || null;
    S = {
      nick, day, joinAt: Date.now(), last: Date.now(), alive: 0, extra: 0,
      greeted: !!(prev && prev.gAt), waited: false, warned: false, done: false,
      ready: false, miss: {}, n: 0
    };
    /* ★ 새 방식(2026-11-18) — 입장 도장이 없으니 "오늘 이미 들어왔었나"는 접속 기록(visit)으로 압니다.
         같은 날이면 재입장(prev 로 취급), 아니면 첫 입장이라 새로 적습니다. 도장은 접속 시간이 기준을 넘을 때 찍혀요. */
    if (NEW()) {
      let 방문 = null;
      if (SOLO() && RESET) {   // 시험 되돌리기(&greetreset=1): 오늘의 접속 기록·도장·인사 기록을 모두 지우고 "오늘 첫 입장"으로 다시 시작
        for (const q of [`users/${nick}/attend/visit`, `attendance/${day}/${nick}`, `users/${nick}/attend/days/${day}`, `users/${nick}/attend/mins/${day}`, `greetMiss/${nick}/${day}`]) {
          try { await DB().ref(q).remove(); } catch (e) {}
        }
        A.stamped[day] = false;
      }
      try { const vs = await DB().ref(`users/${nick}/attend/visit`).once("value"); const v = vs.val(); if (v && v.day === day) 방문 = v; } catch (e) {}
      if (!S || S.nick !== nick) return;
      const 지금 = Date.now();
      try {
        if (방문) await DB().ref(`users/${nick}/attend/visit`).update({ leftAt: null, at: 지금 });
        else await DB().ref(`users/${nick}/attend/visit`).set({ day, firstAt: 지금, at: 지금 });
      } catch (e) { console.warn("[greet visit]", e); }
      _visit = 방문 || { day, firstAt: 지금, at: 지금 };
      if (방문) { if (!prev) prev = 방문; if (방문.gAt) S.greeted = true; }
    }
    확정시작();
    /* ★ 새로고침(20시간 자동·방장 전체) 때문에 **다시 로그인한** 사람도 적용하지 않습니다 (콩 결정 2026-10-16).
         자정을 넘겨 한창 작업 중이다가 로그인 화면이 떠서 새로 들어온 경우, 인사를 새로 하라는 건 억울해요. */
    try { if (window.Reload?.cameFromReload?.()) { 멈추기(); return; } } catch (e) {}
    /* ★ 인사 **빼먹음 확인**은 그날 처음 입장할 때만 (콩 결정 2026-10-16). 오늘 입장 도장이 이미 있었으면(prev)
         같은 날 재입장이에요. 다만 **직접 나갔다 2시간 넘어** 돌아왔다면 "재접속 모드"(콩 결정 2026-10-17):
         인사하면 재접속 카드만 띄우고, 안 해도 아무것도 세지 않습니다. */
    if (prev && (prev.firstAt || prev.at)) {
      const 떠난때 = Number(prev.leftAt || 0);
      if (떠난때 > 0 && Date.now() - 떠난때 >= T_AWAY) { 재접속시작(); return; }
      멈추기(); return;
    }
    if (SOLO()) {
      /* 혼자 방은 입장 절차가 없어서 입장 카드를 여기서 올립니다 (새로고침으로 돌아온 경우는 조용히) */
      if (!window.__silentJoin) 올리기("in", 문구("in", nick));
      if (!NEW()) { try { DB().ref(`users/${nick}/attend/days/${day}`).set(true); } catch (e) {} }   // 새 방식은 도장이 찍힐 때 적습니다
    }
    if (SOLO() && REGREET) { 재접속시작(); return; }       // 시험용: 혼자 방에서 재접속 모드를 바로 켭니다
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

  /** 재접속 모드 — 서버를 읽지 않고(휴가·빼먹음 확인 없음) 인사만 기다립니다 */
  function 타이머켜기() {
    _타이머 = setInterval(틱, TEST ? 500 : 5000);
    if (!_깨움붙임) {
      _깨움붙임 = true;
      document.addEventListener("visibilitychange", () => { if (!document.hidden) 틱(); });
    }
  }
  function 재접속시작() {
    if (!S) return;
    S.re = true; S.greeted = false; S.ready = true; S.last = Date.now();
    타이머켜기();
  }

  /** 방장이 일부러 새로고침을 시킨 사람 — 인사 시간 5분 보너스 */
  function 보너스(ms) { if (S) S.extra += Number(ms) || 5 * MIN; }

  window.attend30On = () => NEW();
  window.attendStamped = (d) => !!A.stamped[d];
  window.attendMinNow = () => (_attMinV != null ? _attMinV : ATT_MIN_DEFAULT);
  window.greetOn = () => ON();
  window.greetStart = 시작;
  window.greetNote = 인사함;
  window.greetBonus = 보너스;
  window.Greet = {
    KINDS, CAP, START_DAY, COUNT_FROM,
    T_AWAY,
    _t: { 세기시작, 셈, 표시횟수, 문구, 틱, 시작, 인사함, 확정틱, state: () => S }
  };
})();
