/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   🔄 새로고침 두 가지 (script_reload.js) — 2026-10-16 콩

   [무엇인가]
   ① 20시간 자동 새로고침 — 입장(재입장 포함)한 시점부터 20시간마다 새로고칩니다. (콩 결정: 20시간 넘게 접속하는 일은 드물어서 자정 넘김 재로그인이 줄어듭니다)
      (오래 켜 둔 창이 낡은 코드로 버티지 않게)
   ② 방장 전원 새로고침 — 방장이 관리 페이지에서 누르면 접속 중인 모두가 새로고침.
      새 패치를 한꺼번에 입히려는 용도예요. 이때는 인사 시간 보너스 5분.

   [새로고침해도 이어서 들어오기]
   로그인은 이 탭에 남아 있으니(탭 단위 로그인), 비밀번호를 또 받지 않고
   "오늘 출석 도장이 이미 있는 사람"만 그대로 다시 입장시킵니다.
     · 오늘 도장 있음 → 조용히 재입장. 입장/퇴장 문구도, 출석 도장도, 인사 상태도
       새로 만들지 않습니다 (인사 여부는 서버 값으로 복구).
     · 오늘 도장 없음(어제 열어 둔 창) → 로그인 화면 + 안내 문구.
       ★ 새 날의 출석은 새로 입장해야 찍힙니다 — 창만 켜 둔 채 찍히는 일은 없어요.

   [안 깨지게]
   · ★ 팝업·카운트다운·안내 카드는 **없습니다** (콩 결정 — 집중이 깨지고, 예전에 팝업으로 크게 항의를 받았어요).
     화면만 조용히 바뀝니다. 방장 새로고침은 방장이 단톡에 미리 공지합니다.
   · 채팅창에 쓰다 만 글이 있거나 방금 타자를 쳤으면 보이지 않게 기다립니다
     (자동 = 끝까지, 방장 = 최대 3분).
   · 새로고침 직전에 __reloading 을 켜서 "나갔어요" 문구가 안 뜹니다.
   · 도장이 없어 로그인 화면으로 갈 때만, 로그인 상자 안에 한 줄 안내가 붙습니다(팝업 아님).

   [통신량] 방장 전원 새로고침 = config/forceReload 한 칸(숫자 하나)을 듣습니다.
   [시험] 혼자 방에서  &reloadspeed=1 → 20시간이 20초로 줄어듭니다.
          &forcetest=1 → 시작 20초 뒤 "방장이 눌렀다" 상황을 흉내 냅니다.
   ===================================================================== */
(function () {
  "use strict";

  const SOLO = () => !!window.SOLO;
  const SPEED = /[?&]reloadspeed=1/.test(location.search);
  const FORCE_TEST = /[?&]forcetest=1/.test(location.search);
  const T_AUTO = SPEED ? 20 * 1000 : 20 * 3600 * 1000;    // 입장 뒤 이만큼 지나면 자동 새로고침
  const BONUS_MS = 5 * 60 * 1000;
  const K_RE = "reentry", K_SEEN = "forceSeen";

  const 나 = () => { try { return (typeof myNick === "string" && myNick) ? myNick : (window.myNick || ""); } catch (e) { return ""; } };
  const 날 = (t) => (window.ymd ? window.ymd(t) : new Date(t).toISOString().slice(0, 10));
  const SS = () => window.AppSession;

  let _t0 = 0, _체크 = null, _귀 = null, _귀닉 = "";
  let _마커 = null, _보너스줌 = false;
  let _진행 = false, _마지막입력 = 0;

  /* ---------- 순수 계산 (checks.js 가 따로 시험합니다) ---------- */

  const 월일 = (d) => { const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(d || ""); return m ? `${+m[1]}/${+m[2]}일` : ""; };
  const 일 = (d) => { const m = /^\d{4}-\d{2}-(\d{2})$/.exec(d || ""); return m ? `${+m[1]}일` : ""; };

  /** 도장이 없어 로그인 화면으로 갈 때 보여 줄 안내 */
  function 안내문(kind, 옛날, 오늘, 사유) {
    if (사유 === "login") return "방금 새로고침되면서 로그인이 풀렸어요. 다시 로그인해 주세요.";
    const 다른날 = !!(옛날 && 옛날 !== 오늘);
    if (kind === "force") {
      return "새로운 패치가 적용되었습니다. 다만, " + (다른날
        ? `${월일(옛날)}에 접속하신 창이라 ${일(오늘)}자 출석 도장이 찍히지 않았어요. 재로그인 해주세요.`
        : "오늘자 출석 도장이 아직 없어요. 재로그인 해주세요.");
    }
    return 다른날
      ? `${월일(옛날)}에 접속하신 창입니다. ${일(오늘)}자 출석 도장이 찍히지 않았어요. 재로그인 해주세요.`
      : "오늘자 출석 도장이 아직 없어요. 재로그인 해주세요.";
  }

  /** 지금 새로고침해도 되는 조용한 순간인가 (쓰던 글이 없고 방금 타자를 안 쳤다) */
  function 조용한가(now) {
    try {
      const t = now == null ? Date.now() : now;
      if (t - _마지막입력 < 5000) return false;
      const m = document.getElementById("message");
      if (m && String(m.value || "").trim()) return false;
      const a = document.activeElement;
      if (a && a !== document.body) {
        const tag = (a.tagName || "").toUpperCase();
        if ((tag === "TEXTAREA" || (tag === "INPUT" && /^(text|search|url|number|)$/i.test(a.type || ""))) && String(a.value || "").trim()) return false;
        if (a.isContentEditable && String(a.textContent || "").trim()) return false;
      }
    } catch (e) {}
    return true;
  }

  /* ---------- 새로고침 실행 ---------- */

  function 실행(kind) {
    const nick = 나();
    try {
      SS()?.setItem(K_RE, JSON.stringify({ nick, day: 날(Date.now()), kind, at: Date.now() }));
    } catch (e) {}
    window.__reloading = true;                  // 퇴장 문구를 막습니다 (script_core.js 조용히드나드나)
    try { location.reload(); } catch (e) { window.__reloading = false; _진행 = false; }
  }

  /** 팝업도 카운트다운도 없이 조용히 새로고침합니다 (콩 결정 — 집중이 깨지는 게 가장 싫다).
      다만 쓰던 글이 날아가지 않게, 조용한 순간까지만 보이지 않게 기다립니다. */
  function 예약(kind) {
    if (_진행) return;
    _진행 = true;
    const 처음 = Date.now();
    const 최대기다림 = kind === "force" ? 3 * 60 * 1000 : Infinity;
    const 기다림 = () => {
      if (!조용한가() && Date.now() - 처음 < 최대기다림) { setTimeout(기다림, SPEED ? 1000 : 10000); return; }
      실행(kind);
    };
    기다림();
  }

  /* ---------- 20시간 시계 · 방장 신호 ---------- */

  function 자동검사() {
    if (_진행 || !_t0) return;
    if (Date.now() - _t0 >= T_AUTO) 예약("auto");
  }

  function 신호듣기(nick) {
    if (!window.db || _귀닉 === nick) return;
    _귀닉 = nick;
    let 첫값 = true;
    let 본것 = 0;
    try { 본것 = Number(SS()?.getItem(K_SEEN) || 0); } catch (e) {}
    try {
      _귀 = window.db.ref("config/forceReload");
      _귀.on("value", (s) => {
        const v = s.val();
        const at = Number(v && v.at) || 0;
        if (첫값) { 첫값 = false; if (at > 본것) 본것 = at; try { SS()?.setItem(K_SEEN, String(본것)); } catch (e) {} return; }   // 옛 기록은 기준선일 뿐
        if (at > 본것) {
          본것 = at;
          try { SS()?.setItem(K_SEEN, String(at)); } catch (e) {}
          예약("force");
        }
      });
    } catch (e) { console.warn("[reload listen]", e); }
  }

  /** 입장 직후에 불립니다 (본방: recordAttendance, 혼자 방: solo) */
  function 시작() {
    const nick = 나();
    if (!nick) return;
    _t0 = Date.now();
    _진행 = false;
    if (!_체크) {
      _체크 = setInterval(자동검사, SPEED ? 1000 : 30000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) 자동검사(); });
      const 입력 = () => { _마지막입력 = Date.now(); };
      document.addEventListener("keydown", 입력, true);
      document.addEventListener("input", 입력, true);
    }
    신호듣기(nick);
    if (SOLO() && FORCE_TEST) setTimeout(() => 예약("force"), 20000);
    /* 조용한 입장 표시는 조금 뒤 풀어 줍니다 (그 사이 만들어지는 입장 문구를 막으려는 것) */
    if (window.__silentJoin) setTimeout(() => { window.__silentJoin = false; }, 15000);
  }

  /** 인사 규칙이 부릅니다 — 방장이 시킨 새로고침이면 5분 보너스 (한 번만) */
  function 보너스가져가기() {
    if (_보너스줌) return 0;
    if (_마커 && _마커.kind === "force") { _보너스줌 = true; return BONUS_MS; }
    return 0;
  }

  /* ---------- 새로고침 뒤 다시 들어오기 ---------- */

  function 안내걸기(text) {
    const box = document.getElementById("join-msg");
    if (!box) return;
    box.textContent = text || "";
    box.classList.remove("bad");
    box.style.display = text ? "" : "none";
  }

  async function 다시들어오기() {
    let m = null;
    try { m = JSON.parse(SS()?.getItem(K_RE) || "null"); } catch (e) {}
    if (!m || !m.nick) return;
    try { SS()?.removeItem(K_RE); } catch (e) {}      // 딱 한 번만 — 실패해도 무한 반복은 없습니다
    _마커 = m;
    const 오늘 = 날(Date.now());

    if (SOLO()) { window.__silentJoin = true; return; }   // 혼자 방은 입장 절차가 없어요 (문구만 막음)

    try {
      /* 로그인이 이 탭에 남아 있는지 — 처음 상태가 정해질 때까지 한 번만 기다립니다 */
      const user = await new Promise((res) => {
        let done = false;
        const un = firebase.auth().onAuthStateChanged((u) => { if (done) return; done = true; try { un(); } catch (e) {} res(u); });
        setTimeout(() => { if (!done) { done = true; res(firebase.auth().currentUser); } }, 4000);
      });
      if (!user) { 안내걸기(안내문(m.kind, m.day, 오늘, "login")); return; }

      const db = firebase.database();
      const [owner, ban, stamp] = await Promise.all([
        db.ref("nickOwner/" + m.nick).once("value"),
        db.ref("config/ban/" + m.nick).once("value"),
        db.ref(`attendance/${오늘}/${m.nick}`).once("value")
      ]);
      if (owner.val() !== user.uid || ban.val()) { 안내걸기(안내문(m.kind, m.day, 오늘, "login")); return; }
      if (!stamp.exists()) { 안내걸기(안내문(m.kind, m.day, 오늘)); return; }

      const input = document.getElementById("nick-input");
      if (!input) return;
      input.value = m.nick;
      window.__skipAuth = true;       // 비밀번호 확인은 건너뜁니다 (이 탭의 로그인이 이미 증거)
      window.__silentJoin = true;     // 입장 문구도 건너뜁니다
      try { await window.join?.(); }
      finally { window.__skipAuth = false; }
    } catch (e) {
      console.warn("[reentry]", e);
      window.__skipAuth = false;
      window.__silentJoin = false;
    }
  }

  window.addEventListener("load", () => setTimeout(다시들어오기, 500));

  window.reloadStart = 시작;
  window.Reload = {
    /** 새로고침 때문에 돌아온 사람인가 — 자정을 넘겨 작업 중이다가 재로그인한 경우 등. 인사 규칙을 적용하지 않습니다. */
    cameFromReload: () => !!_마커,
    T_AUTO, BONUS_MS,
    takeBonus: 보너스가져가기,
    _t: { 안내문, 조용한가, 월일, 일, 예약, 실행, 시작, 다시들어오기, 자동검사,
          state: () => ({ _t0, _진행, 마커: _마커 }) }
  };
})();
