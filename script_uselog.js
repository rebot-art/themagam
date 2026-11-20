/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   📒 방 활동 기록 (script_uselog.js) — 2026-11-20 콩
   ---------------------------------------------------------------------
   [왜] 🏅 명예 멤버 뽑기에 "작업방을 얼마나 알차게 썼나"(활동 15%)를 더하려고요.
        하트·채팅·화공·메뉴는 지금까지 서버에 **기록이 남지 않았어요**
        (하트는 방장이 매일 어제 것을 지우고, 채팅은 최근 250줄만 남고, 화공은 끄면 사라지고,
         메뉴는 세는 곳이 없었습니다). 그래서 **오늘부터** 각자 자기 것을 하루 단위로 적습니다.

   [어디에] users/{닉}/useLog/{YYYY-MM-DD} = { h: 하트·응원 보낸 수, c: 채팅 보낸 줄 수,
                                              s: 화면 공유한 분, m: { 쓴메뉴: true } }
        ★ 본인과 방장만 읽고 쓰는 자리(users/$nick)라서 **보안규칙은 그대로**입니다.
        ★ 날짜는 출석·하트와 같은 셈 — 이 컴퓨터의 하루.

   [통신량] 모아 뒀다가 5분에 한 번(활동이 있었을 때만)·창을 닫거나 숨길 때 한 번에 적습니다.
        글자 수는 ServerValue.increment 라 먼저 읽을 것도 없어요. 읽는 곳은 관리자 뽑기뿐.

   [점수에 어떻게] **하루 상한**은 여기서가 아니라 뽑을 때(script_admin.js HONOR_ACT)
        자릅니다 — 여기엔 있는 그대로 적어 둬서, 상한을 바꿔도 기록이 아깝지 않게요.

   [세는 것]
     · 하트: 카드 하트 + 화공 응원 스티커를 **보낸** 수 (script_heart.js · script_cheer.js 가 부름)
     · 채팅: 보내기가 끝난 줄 (script_chat.js 가 부름 — 스티커도 이 길로 가니 함께 셈)
     · 화공: 화면 공유를 켜 둔 분 (1분마다 확인)
     · 메뉴: 아래 알약·옆 탭을 **눌러 본 종류** (같은 메뉴를 열 번 눌러도 하나)

   [안 하는 것] 🧘 혼자 방(SOLO)·🧪 시험 모드(DEMO)에서는 아무것도 적지 않습니다 (가짜 DB).
   ===================================================================== */
(function () {
  const FLUSH_MS = 5 * 60 * 1000;
  const TICK_MS = 60 * 1000;
  const 끔 = () => !!(window.SOLO || window.DEMO);
  const 나 = () => { try { return (typeof myNick === "string" && myNick) ? myNick : (window.myNick || ""); } catch (e) { return ""; } };
  const dayKey = (d) => {
    d = d || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  let _acc = {};                 // { 날짜: { h, c, s, m:{메뉴:true} } } — 아직 못 적은 것
  let _lastFlush = Date.now();
  let _flushing = false;

  const 칸 = (day) => _acc[day] || (_acc[day] = { h: 0, c: 0, s: 0, m: {} });

  function bump(kind, arg) {
    if (끔()) return;
    const a = 칸(dayKey());
    if (kind === "h") a.h++;
    else if (kind === "c") a.c++;
    else if (kind === "s") a.s += Math.max(1, Number(arg) || 1);
    else if (kind === "m" && arg) {
      const k = String(arg).replace(/[.#$\[\]\/]/g, "_").slice(0, 24);     // 파이어베이스 열쇠로 못 쓰는 글자
      if (k && Object.keys(a.m).length < 40) a.m[k] = true;
    }
  }

  const 있나 = (a) => !!(a && (a.h || a.c || a.s || Object.keys(a.m).length));

  async function flush() {
    if (_flushing || 끔()) return;
    const nick = 나(), db = window.db;
    const fb = (typeof firebase !== "undefined" ? firebase : window.firebase);
    if (!nick || !db || !fb || !fb.database || !fb.database.ServerValue) return;
    const days = Object.keys(_acc).filter(d => 있나(_acc[d]));
    if (!days.length) return;
    const snap = _acc;
    _acc = {};
    _flushing = true;
    const inc = (n) => fb.database.ServerValue.increment(n);
    const upd = {};
    days.forEach(d => {
      const a = snap[d], base = `users/${nick}/useLog/${d}`;
      if (a.h) upd[`${base}/h`] = inc(a.h);
      if (a.c) upd[`${base}/c`] = inc(a.c);
      if (a.s) upd[`${base}/s`] = inc(a.s);
      Object.keys(a.m).forEach(k => { upd[`${base}/m/${k}`] = true; });
    });
    try {
      await db.ref().update(upd);
      _lastFlush = Date.now();
    } catch (e) {
      /* 못 적었으면 되돌려 놓습니다 — 다음에 다시 시도 */
      days.forEach(d => { const a = snap[d], b = 칸(d); b.h += a.h; b.c += a.c; b.s += a.s; Object.assign(b.m, a.m); });
    } finally {
      _flushing = false;
    }
  }

  /* 메뉴 — 아래 알약·옆 탭(오른쪽·왼쪽)·Member 탭을 눌러 본 종류 */
  document.addEventListener("click", (e) => {
    try {
      const b = e.target && e.target.closest && e.target.closest('[id^="dock-pill-"], [id^="side-tab-"], [id^="left-tab-"], #member-tab');
      if (!b || !b.id) return;
      bump("m", b.id.replace(/^(dock-pill|side-tab|left-tab)-/, ""));
    } catch (err) {}
  }, true);

  /* 1분마다 — 화면 공유 중이면 1분 더하고, 5분이 지났으면 적습니다 */
  setInterval(() => {
    if (끔()) return;
    try { if (window.isScreenSharing?.()) bump("s", 1); } catch (e) {}
    if (Date.now() - _lastFlush >= FLUSH_MS) flush();
  }, TICK_MS);

  /* 창을 닫거나 숨길 때 — 마지막 것도 보냅니다 (되는 만큼) */
  window.addEventListener("pagehide", () => { flush(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

  window.useLogBump = bump;
  window.useLogFlush = flush;
})();
