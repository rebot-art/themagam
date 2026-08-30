/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_admin.js — admin.html 전용 스크립트

   메인 앱 스크립트는 하나도 불러오지 않습니다. 필요한 것만 여기에
   작게 다시 담았어요:
     · Firebase 설정 (script_core.js 와 동일 — ★ 코어와 동기 유지)
     · 닉네임→가짜 이메일 변환 (script_auth.js 와 동일한 방식)
     · 관리자 닉네임·PIN (script_realtime.js 의 것과 동일하게 유지)

   접속 흐름: ① 닉네임+비밀번호 로그인 → ② PIN → 대시보드.
   방장이거나 🛡️ 운영진 명단에 있어야 ①을 지날 수 있습니다.
   PIN 은 진짜 잠금장치가 아닙니다 — 파괴적 동작의 실수 방지용이고,
   진짜 방어는 파이어베이스 보안 규칙이 합니다.

   =====================================================================
   🛡️ 두 층 — 방장 · 운영진 (2026-08-17)
   ---------------------------------------------------------------------
   운영진 4명이 늘면서 권한을 둘로 갈랐습니다.

     · 운영진 — 출석·휴가 보기, 공지 쓰기, 대숲 글 **하나씩** 지우기와
                30일 정리, 품평 명패 고치기, 입장 승인/차단,
                채팅 히스토리 설정, 출입 기록, 성실 멤버 돌리기
     · 방장만 — 멤버 명단에서 지우기, 오늘 글자수 초기화,
                채팅·수다방 통째 삭제, **대숲 전체 비우기**,
                공지/품평/설정 트리 통째 삭제, 운영진 명단 관리

   ★ 가르는 기준은 "되돌릴 수 있는가" 하나입니다. 글 하나 지우기는
     운영진, **판을 비우는 것**은 방장. 보안규칙도 같은 결로 짰습니다 —
     그릇(부모) 층은 방장만, 잎(자식) 층만 운영진에게 열어서, `remove()`
     한 줄로 트리가 통째로 날아가는 길을 막았습니다.

   ★ 이 파일에서 버튼을 감추는 것은 **예의**입니다. 진짜 자물쇠는
     보안규칙이에요 — 파괴적인 노드는 서버가 방장 uid 만 받습니다.
     화면에서 감추기만 하고 규칙을 안 고치면 아무 소용이 없고,
     규칙만 고치고 화면을 안 고치면 눌러도 조용히 실패해서 더 나빠요.
     둘 다 해야 합니다.
   ★ 명단은 서버의 `staff/{uid} = 닉` 한 곳에 있습니다. 닉이 아니라
     **uid** 로 두는 이유 — 닉은 바뀌지만(0813 방장 닉 변경) uid 는
     안 바뀌기 때문입니다. 보안규칙도 uid 로만 사람을 알아봅니다.
   ===================================================================== */
(function () {
  "use strict";

  /* =====================================================================
     🛡️ 관리자 상수 — ★ 여기만 고치면 관리자가 바뀝니다.

     ※ 메인 앱(script_realtime.js) 맨 위에 같은 값이 있습니다.
       두 파일은 반드시 함께 고쳐야 해요 — 동기 필요!
     ===================================================================== */
  const ADMIN_NICK = "링가링🍄";     // ← 방장 닉네임 (2026-08-13 그링링🍄 → 링가링🍄 · script_realtime.js 와 동기)
  const ADMIN_PIN  = "09129823";     // ← 공용 PIN (방장·운영진이 같이 씁니다)
  /* ★ 보안규칙에 하드코딩된 방장 uid 와 같아야 합니다.
     닉이 바뀌어도 uid 는 안 바뀌므로, "누가 방장인가" 의 진짜 기준은 이쪽입니다. */
  const ADMIN_UID  = "ABM1ZJndrqaV3gpYUs03SV9qglr1";

  /* ★ script_core.js 의 firebaseConfig 와 동기 유지 — 코어가 바뀌면 여기도 */
  const firebaseConfig = {
    apiKey: "AIzaSyBrFRdC034hq3kYrY7CncNAMgPBH6-Br-4",
    authDomain: "themagam-ec0e4.firebaseapp.com",
    databaseURL: "https://themagam-ec0e4-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "themagam-ec0e4",
    storageBucket: "themagam-ec0e4.firebasestorage.app",
    messagingSenderId: "166061592687",
    appId: "1:166061592687:web:c8ae9f9a36ded674a3bd9a"
  };
  try {
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
  } catch (e) { console.warn("[admin firebase init]", e); }

  const db = firebase.database();
  const auth = firebase.auth();

  let myNick = "";
  /* 🛡️ 내가 방장인가 — 로그인 뒤에 정해집니다.
     운영진이면 false 이고, 방장 전용 단추가 화면에서 사라집니다. */
  let isOwner = false;
  /* ★ 문지기를 지났는가 (2026-08-17).
     PIN 칸은 `display:none` 일 뿐 처음부터 DOM 에 있습니다. 숨은 것도
     `.click()` 은 멀쩡히 발화해서, 로그인 화면에서 콘솔로 PIN 단추만
     눌러도 대시보드가 열렸습니다 (PIN 은 공개 배포된 js 안에 평문).
     서버 규칙이 막아 주니 자료가 새지는 않았지만, "관리 페이지를
     감춘다" 는 설계가 통째로 무의미해집니다. 그래서 깃발을 하나 둡니다. */
  let passedLogin = false;

  // ------------------------------------------------- 작은 도우미들
  function el(id) { return document.getElementById(id); }
  function msg(id, text, bad) {
    const box = el(id);
    if (!box) return;
    box.textContent = text || "";
    box.classList.toggle("bad", !!bad);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function dayKey(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  /* 닉네임 → 가짜 이메일 — script_auth.js 의 nickToEmail 과 동일한 방식 */
  function nickToEmail(nick) {
    let hex = "";
    const bytes = new TextEncoder().encode(nick);
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    return "n" + hex + "@themagam.local";
  }

  // ------------------------------------------------- ① 로그인
  async function doLogin() {
    const nick = (el("adm-nick")?.value || "").trim();
    const pw = el("adm-pw")?.value || "";
    if (!nick) { msg("adm-login-msg", "닉네임을 입력해주세요.", true); return; }
    if (pw.length < 6) { msg("adm-login-msg", "비밀번호는 6자 이상이에요.", true); return; }

    /* =====================================================================
       [2026-08-17] 닉네임만 보고 미리 막지 않습니다.
       ---------------------------------------------------------------------
       예전에는 여기서 `nick !== ADMIN_NICK` 이면 곧장 돌려보냈습니다.
       운영진이 넷 늘면서 그럴 수 없게 됐어요 — **누가 운영진인지는
       서버의 staff 명단에 있고, 그건 로그인해야 읽을 수 있습니다.**

       그래서 순서를 바꿉니다: 먼저 제 계정으로 로그인 → 그 다음
       "이 uid 가 방장이거나 운영진인가" 를 서버에 묻습니다.
       ★ 남의 계정으로 들어오는 길이 열리는 것이 아닙니다. 로그인은
         제 닉·제 비밀번호로만 되고, 아니면 파이어베이스가 막아요.
       ★ 통과하지 못하면 **로그인을 도로 끊습니다**(signOut). 어중간하게
         로그인된 채로 두면 콘솔에서 이것저것 찔러볼 수 있으니까요.
       ===================================================================== */

    const btn = el("adm-login-btn");
    btn.disabled = true;
    msg("adm-login-msg", "확인 중…");
    try {
      /* 메인과 같은 탭 단위 로그인 */
      try { await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); } catch (e) {}

      /* 도장(nickOwner)이 없는 닉네임은 관리자 페이지에서 새로 만들지 않습니다 */
      const owner = (await db.ref("nickOwner/" + nick).once("value")).val();
      if (owner === null) {
        msg("adm-login-msg", "등록되지 않은 닉네임이에요. 메인 방에서 먼저 입장해 주세요.", true);
        return;
      }
      try {
        await auth.signInWithEmailAndPassword(nickToEmail(nick), pw);
      } catch (e) {
        msg("adm-login-msg", "비밀번호가 달라요.", true);
        return;
      }

      /* 🛡️ 문지기 — 방장이거나 운영진 명단에 있어야 지납니다.
         staff/{내 uid} 는 "제 것만" 읽도록 규칙이 열려 있어서, 남의
         명단은 못 보고 자기 자격만 확인할 수 있습니다. */
      const uid = auth.currentUser?.uid || "";
      isOwner = (uid === ADMIN_UID);
      let allowed = isOwner;
      if (!allowed) {
        try {
          allowed = (await db.ref("staff/" + uid).once("value")).exists();
        } catch (e) { allowed = false; }
      }
      if (!allowed) {
        /* 문구를 뭉뚱그립니다 — "운영진이 아니에요" 라고 말해버리면
           이 페이지가 무엇인지 알려주는 셈이라서요. */
        try { await auth.signOut(); } catch (e) {}
        msg("adm-login-msg", "로그인 정보가 올바르지 않아요.", true);
        return;
      }

      myNick = nick;
      passedLogin = true;
      msg("adm-login-msg", "");
      el("adm-login").style.display = "none";
      el("adm-pin-card").style.display = "";
      /* 이 탭에서 이미 PIN 을 통과했다면 바로 대시보드 */
      if (sessionStorage.getItem("adminPinOk") === "true") openDash();
      else el("adm-pin")?.focus();
    } finally {
      btn.disabled = false;
    }
  }

  // ------------------------------------------------- ② PIN
  function doPin() {
    /* ★ 로그인을 지나지 않았으면 아무 반응이 없습니다 (2026-08-17).
       "먼저 로그인하세요" 라고 말해 주면, 숨은 단추를 찾아 누른 사람에게
       여기가 진짜 문이라고 알려주는 셈이라서요. */
    if (!passedLogin || !auth.currentUser) return;
    const p = el("adm-pin")?.value || "";
    if (p === ADMIN_PIN) {
      try { sessionStorage.setItem("adminPinOk", "true"); } catch (e) {}
      openDash();
    } else {
      msg("adm-pin-msg", "PIN이 달라요.", true);
    }
  }

  function openDash() {
    if (!passedLogin || !auth.currentUser) return;   // ★ 같은 문지기
    el("adm-pin-card").style.display = "none";
    el("adm-dash").style.display = "block";
    paintRole();
    showMyUid();
    loadAttendance(0);
    loadPinnedMessage();
    loadHistoryConfig();
    loadForest();
    loadAllowList();
    loadBanList();
    loadHello();
    if (isOwner) loadStaffList();
  }

  /* =====================================================================
     🛡️ 방장 전용 자리 감추기 (2026-08-17)
     ---------------------------------------------------------------------
     `data-owner-only` 가 붙은 것은 방장에게만 보입니다.

     ★ 감추기(display:none)이지 잠그기(disabled)가 아닙니다 — 흐릿하게
       남겨 두면 "왜 안 눌리지?" 하고 계속 눌러 보게 돼요. 아예 없는
       편이 조용합니다.
     ★ 다시 말하지만 이건 예의일 뿐입니다. 진짜 자물쇠는 보안규칙.
     ===================================================================== */
  /* 방장 전용 동작 앞에 세우는 문지기.
     화면에서 이미 감췄지만, 단축키·오래된 탭·개발자도구로 함수를 직접
     부르는 길이 남습니다. 서버가 어차피 막지만 — 그때 뜨는 것은
     "permission denied" 라는 영문 에러예요. 여기서 먼저 사람 말로
     알려주는 편이 낫습니다. */
  function ownerOnly(what) {
    if (isOwner) return true;
    alert(`${what}은(는) 방장만 할 수 있어요.`);
    return false;
  }

  function paintRole() {
    document.querySelectorAll("[data-owner-only]").forEach(n => {
      n.style.display = isOwner ? "" : "none";
    });
    const tag = el("adm-role");
    if (tag) {
      tag.textContent = isOwner ? "방장" : "운영진";
      tag.classList.toggle("staff", !isOwner);
    }
    const who = el("adm-who");
    if (who) who.textContent = myNick;
  }

  // ------------------------------------------------- ③-0 내 계정 uid
  /* 보안규칙에 관리자 uid 를 직접 박아 넣을 때 씁니다.
     (닉네임은 바뀔 수 있지만 uid 는 계정이 살아 있는 한 그대로예요) */
  function showMyUid() {
    const box = el("adm-uid");
    if (!box) return;
    box.textContent = auth.currentUser?.uid || "(로그인 정보를 읽지 못했어요)";
  }

  async function copyMyUid() {
    const uid = auth.currentUser?.uid || "";
    if (!uid) { msg("adm-uid-msg", "uid 를 읽지 못했어요.", true); return; }
    try {
      await navigator.clipboard.writeText(uid);
      msg("adm-uid-msg", "✅ 복사했어요. 보안규칙에 붙여 넣으세요.");
    } catch (e) {
      /* https 가 아니거나 권한이 막히면 클립보드가 안 됩니다 — 직접 긁어가도록 */
      msg("adm-uid-msg", "복사하지 못했어요. 위 uid 를 직접 긁어서 복사해 주세요.", true);
    }
  }

  // ------------------------------------------------- ③-1 출석·휴가 현황 (출근부 표)
  /* 데이터 구조 — script_realtime.js / script_timelog.js 와 동일:
       attendance/{YYYY-MM-DD}/{닉} = { firstAt, at, leftAt? }  ← 첫 입장 = firstAt(없으면 at)
       users/{닉}/vacations/{YYYY-MM-DD} = true
       users/{닉}/timeSegs/{YYYY-MM-DD}/{pushId} = { s, a, b }  ← 접속 구간(ms) */
  let _attOffset = 0;

  /* =====================================================================
     "이 사람이 언제부터 있었나" — 처음 나타난 날 (2026-08-11)
     ---------------------------------------------------------------------
     새로 들어온 분의 줄은 앞쪽이 통째로 비어 있습니다. 그런데 빈 칸은
     "안 왔다" 와 "아직 없었다" 를 구분해 주지 못해요. 곰미님이 오늘
     들어왔는데 열흘을 결석한 것처럼 보이는 셈입니다.

     그래서 attendance 를 **한 번** 통째로 훑어 사람마다 처음 나타난
     날을 구해 둡니다. 그 앞은 칸을 하나로 합쳐 "입장 전" 이라고 적어요.

     ★ 왜 한 번만 읽나 — 이 값은 달을 넘겨도 안 바뀝니다. 달을 옮길
       때마다 다시 읽으면 화살표를 누를 때마다 방 전체 출석을 내려받게
       돼요. 관리 화면을 여는 동안 한 번만 읽고 기억해 둡니다.
     ★ 휴가만 찍힌 날도 "있었던" 날로 셉니다. 출석은 안 했어도 그날
       이미 멤버였다는 뜻이니까요.
     ===================================================================== */
  let _firstSeen = null;      // { 닉: "YYYY-MM-DD" }

  /* =====================================================================
     📏 한 달 18일 출석 규칙 — 늦게 들어온 사람은 비율로 (2026-08-11)
     ---------------------------------------------------------------------
     [무엇이 문제였나]
     18일은 **한 달을 통째로 있은 사람**의 기준입니다. 11일에 들어온
     분에게 같은 18일을 요구하면, 남은 21일 중 18일 — 거의 매일 나와야
     해요. 규칙이 아니라 벌이 됩니다.

     [셈법]
       ① 이 달에 멤버였던 날    = 그 달 날수 − 들어오기 전 날수
       ② 휴가 낸 날은 통째로 뺍니다 ("쉬어도 되는 날" 이라는 뜻이니까요)
       ③ 기준 = 반올림( (①−②) ÷ 그 달 날수 × 18 )

     11일 입장 · 휴가 없음 · 31일 달이면 → 21 ÷ 31 × 18 ≈ 12.2 → **12일**
     30일 달에 같은 조건이면 → 20 ÷ 30 × 18 = 12 → **12일**
     달 길이가 달라도 같은 값이 나옵니다.

     [세 가지 상태]
     이번 달은 아직 안 끝났으니 "못 지켰다" 고 할 수 없습니다. 그래서
     **남은 날로 채울 수 있는가**까지 봅니다.
       ✅ 달성  — 이미 기준을 넘음
       🟡 가능  — 아직이지만 남은 날로 채울 수 있음
       🔴 불가  — 남은 날을 다 나와도 못 채움 (지난 달이면 '미달')
     ===================================================================== */
  const RULE_DAYS = 18;       // 한 달 기준 출석일 (달을 통째로 있은 사람)

  /** 한 사람의 이 달 규칙 셈 */
  function ruleOf({ daysInMonth, beforeN, vacInMonth, attended, daysLeft }) {
    const member = daysInMonth - beforeN;              // 멤버였던 날
    const eff = Math.max(0, member - vacInMonth);      // 휴가를 뺀 날
    const need = Math.round((eff / daysInMonth) * RULE_DAYS);
    if (attended >= need) return { need, state: "ok" };
    if (attended + daysLeft >= need) return { need, state: "maybe" };
    return { need, state: "bad" };
  }

  /* =====================================================================
     🏖️ 휴가 상한도 입장일 비례로 (2026-08-17)
     ---------------------------------------------------------------------
     의무 출석만 비율로 줄고 휴가는 늘 7일이었습니다. 그래서 25일에
     들어온 분은 남은 7일을 전부 휴가로 찍어 의무를 0으로 만들 수
     있었어요 — 늦게 들어올수록 규칙이 헐거워졌습니다.

       상한 = 반올림( 멤버였던 날 ÷ 그 달 날수 × 7 )   (최소 1일)

     ★ 여기서는 휴가를 빼지 않습니다 (자기를 물고 돌아요).
     ★ 최소 1일 — 31일에 들어와도 하루는 쉴 수 있게.
     ★ script_mywork.js 의 vacCapOf 와 **같은 셈법**이어야 합니다.
       고치면 둘 다 고쳐야 해요 (checks 가 어긋남을 잡습니다).
     ===================================================================== */
  const VAC_DAYS = 7;         // ★ script_mywork.js 와 같은 값이어야 합니다

  function vacCapOf({ daysInMonth, beforeN }) {
    const member = daysInMonth - beforeN;
    if (member <= 0) return 0;                         // 아직 멤버가 아니던 달
    return Math.max(1, Math.round((member / daysInMonth) * VAC_DAYS));
  }

  async function loadFirstSeen() {
    if (_firstSeen) return _firstSeen;
    const out = {};
    try {
      const snap = await db.ref("attendance").once("value");
      const all = snap.val() || {};
      Object.keys(all).forEach(day => {
        Object.keys(all[day] || {}).forEach(n => {
          const r = all[day][n];
          if (!r || !(r.firstAt || r.at)) return;
          if (!out[n] || day < out[n]) out[n] = day;
        });
      });
    } catch (e) {
      console.warn("[adm firstSeen]", e);
      return null;            // 못 읽으면 표시를 아예 안 합니다 (틀리게 칠하느니)
    }
    _firstSeen = out;
    return out;
  }

  function hhmm(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  /* 닉 → { days, cap } — 방장이 휴가를 찍을 때 상한을 견주는 데 씁니다.
     표를 그릴 때마다 새로 채웁니다 (달을 넘기면 상한도 달라지니까요). */
  let _vac셈 = {};
  /* 🌿 [2026-08-30] 개인사정을 찍은 뒤 **뭐라고 말해 줄지**의 재료.
     표를 그릴 때 사람마다 한 줄씩 챙겨 둡니다 — _vac셈 이 휴가 상한을
     빌려 쓰는 것과 같은 수법이에요(서버를 한 번도 더 안 읽습니다). */
  let _순위셈 = {};

  /* 🌿 [2026-08-30] 출석부를 **앞으로도** 넘길 수 있게 했습니다.
     ---------------------------------------------------------------
     개인사정은 대개 **미리** 알려집니다 — "다음 달 초에 수술이라
     보름쯤 못 나와요". 그런데 출석부는 지난 달로만 넘어가서, 방장이
     9월이 올 때까지 기다렸다가 찍어야 했어요.
     monthOffset 은 원래 "몇 달 전" 이었습니다. 이제 **음수면 앞달**.
     ★ 앞달은 `앞달한도` 까지만 — 무한정 열면 아무도 안 볼 빈 표를
       계속 그리고, 실수로 2027년에 병가를 찍어 놓고 못 찾습니다. */
  const 앞달한도 = 2;          // 다음 달, 다다음 달까지

  async function loadAttendance(monthOffset) {
    _attOffset = monthOffset;
    _vac셈 = {};
    _순위셈 = {};
    const body = el("adm-att-body");
    body.innerHTML = "불러오는 중…";

    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() - monthOffset);
    const ymKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const todayKey = dayKey(new Date());
    el("adm-att-month").textContent = ymKey.replace("-", "년 ") + "월";
    el("adm-att-next").disabled = monthOffset <= -앞달한도;
    /* 앞달은 "아직 오지 않은 달" 이라고 이름 옆에 적어 둡니다 —
       출석이 텅 비어 있는 이유가 고장이 아니라는 뜻이에요 */
    el("adm-att-month").textContent += monthOffset < 0 ? " (앞으로)" : "";

    try {
      /* 노드 단위 묶음 읽기 — 달 전체 attendance 1번, 멤버별 vacations·timeSegs(그 달) 각 1번 */
      const [asnap, nickSnap, firstSeen, wsnap] = await Promise.all([
        db.ref("attendance").orderByKey()
          .startAt(`${ymKey}-01`).endAt(`${ymKey}-31`).once("value"),
        db.ref("nickOwner").once("value"),
        loadFirstSeen(),
        /* ✍️ 한 달치 글자수 — 아래 그래프가 씁니다. 날짜 범위로 한 번에
           받아 오므로 요청은 하나예요(하루씩 31번 부르면 안 됩니다).
           한 달 50KB 안팎 — 관리자 페이지는 방장만 가끔 열어서 괜찮습니다. */
        db.ref("wordlog").orderByKey()
          .startAt(`${ymKey}-01`).endAt(`${ymKey}-31`).once("value")
      ]);
      const attMonth = asnap.val() || {};
      const wordMonth = wsnap.val() || {};
      const nicks = Object.keys(nickSnap.val() || {}).sort((a, b) => a.localeCompare(b, "ko"));
      if (!nicks.length) { body.innerHTML = "아직 기록이 없어요."; return; }

      const vacByNick = {};
      /* 🌿 개인사정(병가) — 방장만 찍습니다. 휴가와 달리 상한이 없고,
         길게 이어질 수 있어요. users/{닉}/leaves/{날짜} = true */
      const leaveByNick = {};
      const minsByNick = {};  // { 닉: {날짜: 합계분} }
      /* 🕐 시간대 그래프용 — 흉터를 걸러낸 **원본 구간**({a,b} 목록)도
         함께 남깁니다. 분 합계(minsByNick)로는 "몇 시에 있었는지" 를
         알 수 없어서요. 같은 자료를 한 번 더 읽지 않으려는 것뿐,
         서버 요청은 그대로입니다. */
      const segsByNick = {};  // { 닉: {날짜: [{a,b}, …]} }
      await Promise.all(nicks.map(async n => {
        try {
          vacByNick[n] = (await db.ref(`users/${n}/vacations`).once("value")).val() || {};
        } catch (e) { vacByNick[n] = {}; }
        try {
          leaveByNick[n] = (await db.ref(`users/${n}/leaves`).once("value")).val() || {};
        } catch (e) { leaveByNick[n] = {}; }
        try {
          const segs = (await db.ref(`users/${n}/timeSegs`).orderByKey()
            .startAt(`${ymKey}-01`).endAt(`${ymKey}-31`).once("value")).val() || {};
          const per = {};
          const rawPer = {};
          Object.keys(segs).forEach(d => {
            /* 같은 구간이 두 번 적힌 흉터는 한 번만 셉니다 (2026-08-13).
               ★ 끝(b)은 몇 초 어긋난 채 중복됩니다 — 한 번은 나가는 순간의
                 시계로, 한 번은 서버의 끊김 시각으로 닫혀서요. 그래서
                 **같은 상태 + 같은 시작(a)** 을 중복으로 보고 긴 쪽만
                 남깁니다. 정상 기록은 시작이 겹칠 수 없습니다 — 새 구간은
                 늘 앞 구간이 끝난 지점에서 시작하니까요. */
            const best = {};
            Object.values(segs[d] || {}).forEach(sg => {
              if (!sg || !(sg.b > sg.a)) return;
              const k = `${sg.s}|${sg.a}`;
              if (!best[k] || sg.b > best[k].b) best[k] = sg;
            });
            let ms = 0;
            Object.values(best).forEach(sg => { ms += sg.b - sg.a; });
            per[d] = ms / 60000;
            rawPer[d] = Object.values(best).map(sg => ({ a: sg.a, b: sg.b }));
          });
          minsByNick[n] = per;
          segsByNick[n] = rawPer;
        } catch (e) { minsByNick[n] = {}; segsByNick[n] = {}; }
      }));

      /* 날짜별 출석 인원 수 — 그날 attendance 기록(firstAt/at)이 있는 사람만 셉니다.
         휴가만 표시된 사람은 출근한 게 아니니 세지 않아요.
         명단(nickOwner)에 없는 옛 기록은 표에도 줄이 없으므로 함께 뺍니다. */
      const nickSet = new Set(nicks);
      const cntByDay = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
        const rec = attMonth[dk] || {};
        let c = 0;
        Object.keys(rec).forEach(n => {
          if (!nickSet.has(n)) return;
          const r = rec[n];
          if (r && (r.firstAt || r.at)) c++;
        });
        cntByDay[dk] = c;
      }

      /* 표 만들기 — ① 인원 수 줄 ② 날짜 머리글 줄 ③ 멤버 줄들 */
      /* 이번 달이면 오늘 **다음** 날부터가 아직 남은 날입니다.
         지난 달을 보고 있으면 남은 날은 없어요(0). */
      /* ★★ 앞달을 **"오늘이 0일인 이번 달"** 로 셈합니다 (2026-08-30).
         새 가지를 치지 않고 이 두 값만 바꾸면 아래가 전부 맞습니다:
           · 남은 날 = 1일부터 말일까지 (휴가·개인사정 뺀 전부)
           · 총원 줄의 '앞날' 이 그 달 통째로 비워짐
           · 네 그래프도 같은 값을 받아 앞날을 안 그림
         새 if 를 여기저기 심으면 언젠가 한 군데를 빠뜨립니다. */
      const 앞달 = monthOffset < 0;
      const todayD = 앞달 ? 0 : new Date().getDate();
      const isThisMonth = 앞달 || (monthOffset === 0);

      /* =====================================================================
         [2026-08-15] 머리글을 **두 줄로** 갈랐습니다.
         ---------------------------------------------------------------------
           ① 출석 — 그날 실제로 나온 사람 수
           ② 총원 — 그날 기준 명단에 있던 사람 수 (그날까지 들어온 사람)
         한 줄일 때는 "8명 나왔다" 만 보이고 **모수를 알 수 없었습니다.**
         27명 중 8명과 12명 중 8명은 전혀 다른 이야기인데요.
         요즘 신입이 늘어서, 두 줄을 겹쳐 보면 명단이 자라는 것도 보입니다.
         ===================================================================== */

      /* 그날 기준 총원 — 각자 처음 나타난 날(born)을 세어 누적합니다.
         born 은 아래 멤버 줄에서도 쓰는 값이라 여기서 한 번에 구해 둡니다
         (같은 계산을 두 번 하면 언젠가 어긋나요). */
      const bornOf = {};
      nicks.forEach(n => {
        let b = firstSeen ? firstSeen[n] : null;
        const vs = vacByNick[n] || {};
        Object.keys(vs).forEach(d => {
          if (vs[d] === true && (!b || d < b)) b = d;
        });
        /* 🌿 개인사정도 마찬가지 — 쉬는 중인 사람을 "입장 전"으로
           그리면 표가 통째로 잿빛이 됩니다 */
        const ls = leaveByNick[n] || {};
        Object.keys(ls).forEach(d => {
          if (ls[d] === true && (!b || d < b)) b = d;
        });
        bornOf[n] = b || null;
      });
      const totalByDay = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
        /* firstSeen 을 못 읽었으면 언제 들어왔는지 알 수 없습니다 —
           그때는 지금 명단 수를 그대로 씁니다(줄이 비면 더 헷갈려요) */
        totalByDay[dk] = firstSeen
          ? nicks.filter(n => bornOf[n] && bornOf[n] <= dk).length
          : nicks.length;
      }

      let cntRow = `<tr><th class="rule-h cnt-h"></th>` +
                   `<th class="name-h cnt-h" title="그날 실제로 나온 사람 수">출석</th>` +
                   `<th class="sum-h cnt-h"></th><th class="sum-h cnt-h"></th>`;
      let totRow = `<tr><th class="rule-h cnt-h tot-h"></th>` +
                   `<th class="name-h cnt-h tot-h" title="그날 기준 명단에 있던 사람 수">총원 <b class="cnt-total">지금 ${nicks.length}명</b></th>` +
                   `<th class="sum-h cnt-h tot-h"></th><th class="sum-h cnt-h tot-h"></th>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
        const dow = new Date(base.getFullYear(), base.getMonth(), d).getDay();
        const we = (dow === 0 || dow === 6) ? " we" : "";
        const c = cntByDay[dk] || 0;
        const t = totalByDay[dk] || 0;
        cntRow += `<th class="cnt${we}${c === 0 ? " zero" : ""}">${c === 0 ? "" : c}</th>`;
        /* 앞날(아직 안 온 날)은 비워 둡니다 — 오늘 총원이 미리 찍혀 있으면
           "그날 이미 27명이었다" 로 읽혀요 */
        const 앞날 = isThisMonth && d > todayD;
        totRow += `<th class="cnt tot${we}${(t === 0 || 앞날) ? " zero" : ""}">${(t === 0 || 앞날) ? "" : t}</th>`;
      }
      cntRow += "</tr>";
      totRow += "</tr>";

      let head = `<tr><th class="rule-h" title="한 달 ${RULE_DAYS}일 규칙 — 늦게 들어온 분은 있었던 날수에 비례해 기준을 낮춥니다">규칙</th>` +
                 `<th class="name-h">이름</th><th class="sum-h">출석</th>` +
                 `<th class="sum-h" title="쓴 휴가 / 이 달 상한 — 상한은 입장일에 따라 ${VAC_DAYS}일에서 비율로 줄어요">휴가</th>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
        const dow = new Date(base.getFullYear(), base.getMonth(), d).getDay();
        const cls = "d" + (dow === 0 || dow === 6 ? " we" : "") + (dk === todayKey ? " today" : "");
        head += `<th class="${cls}">${d}</th>`;
      }
      head += "</tr>";

      const rateRows = [];   // 🏅 출석률 순위 재료 — 아래 멤버 줄에서 채워집니다
      const rows = nicks.map((n, 순번) => {
        const vacs = vacByNick[n] || {};
        const leaves = leaveByNick[n] || {};
        const mins = minsByNick[n] || {};

        /* 이 사람이 처음 나타난 날 — 출석과 휴가 중 이른 쪽.
           (vacations 는 위에서 달을 안 가리고 통째로 읽어 옵니다) */
        /* 위 머리글에서 이미 구해 둔 값을 씁니다 (두 번 세면 언젠가 어긋나요) */
        const born = bornOf[n];

        /* 이 달에서 "아직 없었던" 날이 며칠까지인가.
           ★ 한 번도 나타난 적이 없으면(born 이 없으면) 이 달 전체가
             입장 전입니다 — 명단에는 있는데 아직 한 번도 안 온 분이에요.
           ★ firstSeen 을 못 읽었으면 아예 표시하지 않습니다. */
        let beforeN = 0;
        if (firstSeen) {
          for (let d = 1; d <= daysInMonth; d++) {
            const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
            if (born && dk >= born) break;
            beforeN++;
          }
        }

        let attDays = 0, vacDays = 0, leaveDays = 0, cells = "";
        if (beforeN > 0) {
          /* 칸을 하나로 합칩니다 — 흩어진 빈 칸보다 "여기까지는 없었다" 가
             한눈에 읽힙니다. 좁으면 글자는 생략해요. */
          cells += `<td class="cell before" colspan="${beforeN}">` +
                   (beforeN >= 3 ? "입장 전" : "") + "</td>";
        }
        for (let d = beforeN + 1; d <= daysInMonth; d++) {
          const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
          const rec = attMonth[dk]?.[n];
          const inAt = rec ? (rec.firstAt || rec.at) : null;
          const isVac = vacs[dk] === true;
          /* 🌿 개인사정이 🏖️ 휴가보다 앞섭니다 — 둘 다 찍힌 날은
             더 무거운 쪽으로 읽는 게 맞아요 (휴가는 상한이 있고
             개인사정은 없으니, 겹치면 상한을 안 깎습니다) */
          const isLeave = leaves[dk] === true;
          if (inAt) attDays++;
          if (isLeave) leaveDays++;
          else if (isVac) vacDays++;
          let cls = "cell", txt = "";
          if (isLeave) { cls += " leave"; txt = "🌿"; }
          else if (isVac) { cls += " vac"; txt = "🏖️"; }
          else if (inAt) {
            txt = hhmm(inAt);
            /* [뺌 2026-08-14] 1시간 미만 붉은 표시(short) — 잔소리 같다는
               콩 결정으로 걷었습니다. 궁금하면 칸을 눌러 돋보기로 봅니다 */
          }
          if (dk === todayKey) cls += " today";
          /* 출석한 칸은 눌러서 그날 구간 내역을 볼 수 있습니다 (돋보기) */
          const dig = inAt ? ` data-dig-nick="${n}" data-dig-day="${dk}"` : "";
          /* ★ [2026-08-28 — 콩] 방장은 **더블 클릭**으로 남의 휴가를 켜고 끕니다.
             ---------------------------------------------------------------
             ★ 출석 여부와 상관없이 **모든 날 칸**에 답니다 — 안 나온 날에
               휴가를 찍어 주는 게 이 기능의 본뜻이라서요. 돋보기(dig)는
               예전대로 출석한 칸에만 답니다.
             ★ 운영진에게는 아예 안 답니다. 보안규칙상 users 쓰기는 방장뿐이라
               눌러 봐야 permission denied 만 봅니다. */
          const lv = isOwner ? ` data-leave-nick="${escapeHtml(n)}" data-leave-day="${dk}"` : "";
          if (isOwner) cls += " leave-able";
          cells += `<td class="${cls}"${dig}${lv}>${txt}</td>`;
        }
        /* ── 규칙 칸 ──
           ★ 남은 날에서 **앞으로 낼 휴가**는 뺍니다. 휴가는 기준에서도
             빠졌으니, 나올 수 있는 날로 세면 두 번 봐주는 셈이 돼요. */
        let daysLeft = 0;
        if (isThisMonth) {
          for (let d = todayD + 1; d <= daysInMonth; d++) {
            const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
            if (vacs[dk] !== true && leaves[dk] !== true) daysLeft++;
          }
        }
        /* ★ ruleOf 의 식은 손대지 않습니다 — script_mywork.js 와 **글자까지
           같아야** 하는 약속이 있어서요(다르면 멤버 화면과 관리자 화면이
           다른 기준을 말합니다). 대신 넣는 값에 개인사정을 얹습니다:
           쉰 날은 기준에서 빠진다는 점에서 휴가와 셈이 같아요. */
        const r = ruleOf({ daysInMonth, beforeN, vacInMonth: vacDays + leaveDays, attended: attDays, daysLeft });

        /* ★★★ [2026-08-30 — 콩] **할인 전 기준**도 함께 냅니다.
           ---------------------------------------------------------------
           처음엔 "개인사정이 하루라도 있으면 순위에서 뺀다" 였습니다.
           그런데 콩이 짚었어요 — "이미 100%인 사람은 억울하지 않을까?"
           맞습니다. 빼야 할 것은 **쉰 사람**이 아니라 **할인 덕을 본
           사람**이었어요. 이 둘은 다릅니다:

             · 15일 쉬어 기준이 9일로 내려갔고, 9일 나옴  → 할인 덕
             · 15일 쉬었는데 **원래 기준 18일을 다 채움** → 순수하게 잘함

           두 번째 사람을 뺄 이유가 없습니다. 아픈 와중에 원래 몫을
           해낸 사람이니까요. 그래서 개인사정을 **안 뺀** 기준을 한 번
           더 내서, 그걸 넘었으면 순위에 그대로 둡니다.
           ★ ruleOf 를 한 번 더 부를 뿐 — 순수 산수, 서버 요청 0.
           ★ 등수도 **할인 전 기준**으로 매깁니다(rateRows.need 가
             원래 기준). 할인 후로 매기면 15일 쉬고 18일 나온 사람이
             200%로 1등을 독차지해, 안 쉬고 18일 나온 사람이 이길
             방법이 없어져요. */
        const 원래 = leaveDays
          ? ruleOf({ daysInMonth, beforeN, vacInMonth: vacDays, attended: attDays, daysLeft })
          : r;
        /* ★★ 문턱은 "지금 못 채웠다" 가 아니라 **"남은 날을 다 나와도
           못 채운다"**(state === "bad") 입니다. 달 중간에 att < need 는
           **모두가** 그렇습니다 — 10일에 18일을 채운 사람은 없어요.
           거기서 자르면 쉰 사람만 달 내내 순위 밖에 있게 되어, 콩이
           짚은 억울함이 달 중간으로 옮겨갈 뿐입니다.
           bad 로 자르면 달 중간엔 남들과 똑같이 % 로 서고, 정말 원래
           몫에 못 닿는 것이 확정된 뒤에야 조용한 줄로 갑니다. */
        const 할인덕 = leaveDays > 0 && 원래.state === "bad";

        /* 🏅 출석률 순위가 씁니다 — 표가 이미 센 값 그대로 (다시 안 셈) */
        rateRows.push({
          n, att: attDays,
          need: 원래.need,                 // ★ 등수는 할인 전 기준으로
          state: 원래.state,
          leave: leaveDays > 0,            // 🌿 이름 옆 표식
          out: 할인덕                      // 순위에서 빠지는가
        });
        const 표 = { ok: "✅", maybe: "🟡", bad: "🔴" };
        const 말 = { ok: "달성", maybe: "남은 날로 채울 수 있어요",
                     bad: isThisMonth ? "남은 날을 다 나와도 모자라요" : "미달" };
        const ruleCell =
          `<td class="rule-c ${r.state}" title="기준 ${r.need}일 · ${말[r.state]}">` +
          `${표[r.state]} ${attDays}/${r.need}</td>`;

        /* ── 🏖️ 휴가 칸 (2026-08-17) ──
           "쓴 날 / 이 달 상한". 상한은 입장일에 따라 줄어듭니다.
           ★ 넘친 사람(상한이 줄기 전에 찍어 둔 날)은 붉게만 보입니다 —
             이미 쓴 휴가를 뒤늦게 뺏지는 않아요. */
        const vacCap = vacCapOf({ daysInMonth, beforeN });
        const vacOver = vacDays > vacCap;
        /* ★ 방장이 휴가를 찍을 때 상한을 넘기는지 물어보려면 이 둘이
           필요합니다. 다시 세지 않고 표가 낸 값을 그대로 빌려 씁니다
           (출석률 순위가 rateRows 를 빌려 쓰는 것과 같은 방식). */
        _vac셈[n] = { days: vacDays, cap: vacCap };
        /* 🌿 찍은 뒤 한 줄 알림이 씁니다 (다시 안 셈) */
        _순위셈[n] = { 쉰날: leaveDays, 기준: r.need, 원래: 원래.need, out: 할인덕 };
        const vacCell =
          `<td class="sum-c vac-c${vacOver ? " over" : ""}" title="${
            vacOver ? `상한 ${vacCap}일을 넘겨 찍힌 휴가예요 (상한이 줄기 전에 찍은 날 — 그대로 둡니다)`
                    : `이 달 상한 ${vacCap}일 · 한 달을 꽉 채우면 ${VAC_DAYS}일`
          }${leaveDays ? ` · 🌿 개인사정 ${leaveDays}일` : ""}">${vacDays}/${vacCap}${
            leaveDays ? `<span class="lv-n">🌿${leaveDays}</span>` : ""
          }</td>`;

        /* 이름 옆 [✕] — 탈퇴 인원 삭제. 늘 있지만 아주 옅게, 마우스를 올리면 진해집니다. */
        /* [2026-08-15] 이름 칸을 **열 명씩 묶어** 바탕색을 번갈아 줍니다.
           표가 가로로 길어서, 오른쪽 끝 날짜를 보다가 왼쪽 이름으로
           눈을 되돌리면 한 줄씩 밀려 읽기 쉬웠어요. 열 줄짜리 띠가
           있으면 "위에서 몇 번째 띠" 로 자리를 잡을 수 있습니다. */
        const 띠 = (Math.floor(순번 / 10) % 2) ? " band-b" : " band-a";

        return `<tr>${ruleCell}<td class="name-c${띠}"><span class="nmw">` +
                 `<span class="nm">${escapeHtml(n)}</span>` +
                 /* ✕ 지우기는 방장에게만 — 운영진 화면에는 아예 없습니다 */
                 (isOwner
                   ? `<button type="button" class="del-x" data-del-nick="${escapeHtml(n)}" title="명단에서 지우기">✕</button>`
                   : "") +
               `</span></td>` +
               `<td class="sum-c">${attDays}</td>${vacCell}${cells}</tr>`;
      }).join("");

      /* 📈 한 달 흐름 — 위 머리글이 쓰는 값 그대로 (2026-08-16) */
      그래프그리기({ ymKey, daysInMonth, base, cntByDay, totalByDay, isThisMonth, todayD });

      /* ✍️ 한 달 글자수 흐름 (2026-08-16) */
      글자수그래프({ ymKey, daysInMonth, base, wordMonth, nickSet, isThisMonth, todayD });

      /* ⏱️ 한 달 작업 시간 (2026-08-16) — 표가 이미 읽어 둔 minsByNick 그대로 */
      시간그래프({ ymKey, daysInMonth, base, minsByNick, isThisMonth, todayD });

      /* 🕐 시간대별 접속 (2026-08-18) — 같은 timeSegs 의 원본 구간 재활용 */
      시간대그래프({ ymKey, daysInMonth, base, segsByNick, isThisMonth, todayD });

      /* 🏅 출석률 순위 (2026-08-18) — 표가 보는 그 달 기준. ‹ › 를 따라갑니다 */
      출석률순위(rateRows, 앞달);

      /* 🏅 개근 명단 굳히기 (2026-08-22) — 방 배경판이 읽어 갑니다 */
      명단굳히기(ymKey, rateRows);

      body.classList.remove("adm-msg");
      body.innerHTML = `<div class="adm-att-scroll"><table class="adm-att-table">${cntRow}${totRow}${head}${rows}</table></div>`;
      bindDig(body);
    } catch (e) {
      console.warn("[adm attendance]", e);
      body.innerHTML = "불러오지 못했어요.";
    }
  }

  /* =====================================================================
     📈 한 달 흐름 — 총원 · 출석 꺾은선 (2026-08-16)
     ---------------------------------------------------------------------
     [왜 두 줄인가] 출석 8명이 24명 중 8명인지 12명 중 8명인지는 전혀
     다른 이야기입니다. 모수 없이 출석만 보면 판단이 어긋나요. 두 줄이
     벌어지면 "사람은 느는데 안 나온다" 가 눈에 바로 들어옵니다.

     [값] 새로 계산하지 않습니다 — 머리글 두 줄이 쓰는 cntByDay ·
     totalByDay 를 그대로 받습니다. 서버에 더 묻는 것도 없어요.

     [라이브러리 없이] Chart.js 같은 걸 부르면 관리자 페이지가 그만큼
     무거워집니다. 선 두 개 긋는 그림이라 SVG 로 충분해요.

     ★ 앞날은 그리지 않습니다. 아직 안 온 날에 0 으로 뚝 떨어지는 선이
       그려지면 "망했나?" 로 읽혀요.
     ===================================================================== */
  let _차트값 = null;
  let _글자값 = null;
  let _시간값 = null;
  let _시간대값 = null;
  let _차트타이머 = null;
  window.addEventListener("resize", () => {
    clearTimeout(_차트타이머);
    _차트타이머 = setTimeout(() => {
      /* 칸 너비를 재서 그리므로, 창이 바뀌면 다시 그려야 1:1 이 유지됩니다 */
      if (_차트값) { try { 그래프그리기(_차트값); } catch (e) {} }
      if (_글자값) { try { 글자수그래프(_글자값); } catch (e) {} }
      if (_시간값) { try { 시간그래프(_시간값); } catch (e) {} }
      if (_시간대값) { try { 시간대그래프(_시간대값); } catch (e) {} }
    }, 150);
  });

  function 그래프그리기(d) {
    const box = el("adm-att-chart");
    if (!box) return;

    _차트값 = d;                       // 창 크기가 바뀌면 다시 그리려고

    const { ymKey, daysInMonth, base, cntByDay, totalByDay, isThisMonth, todayD } = d;
    const 끝날 = isThisMonth ? Math.min(todayD, daysInMonth) : daysInMonth;
    if (끝날 < 1) { box.innerHTML = ""; return; }

    /* 자 — 총원이 가장 큰 값이라 그걸 기준으로. 10 단위로 올려 잡습니다 */
    let 최대 = 0;
    for (let i = 1; i <= 끝날; i++) {
      const k = `${ymKey}-${String(i).padStart(2, "0")}`;
      최대 = Math.max(최대, totalByDay[k] || 0, cntByDay[k] || 0);
    }
    최대 = Math.max(10, Math.ceil(최대 / 10) * 10);

    /* ★★ [고침 2026-08-16] "진격의 거인 그래프" 를 고칩니다.
       viewBox 를 660 으로 못 박고 width:100% 로 늘였더니, 1400px 짜리
       카드에서 2.12배로 부풀었습니다 — 높이 424px, 글자 10px 이 21px.
       표보다 그래프가 커졌어요.
       이제 **칸 너비를 재서 그 값을 그대로 viewBox 로** 씁니다.
       1 칸 = 1 픽셀이 되니 높이도 글자도 적은 값 그대로예요. */
    const 칸폭 = Math.max(520, Math.round(box.clientWidth || 900));
    const W = 칸폭, H = 200, L = 30, R = 12, T = 16, B = 28;
    const 폭 = W - L - R, 높 = H - T - B;
    const X = (day) => L + (daysInMonth <= 1 ? 0 : (day - 1) / (daysInMonth - 1) * 폭);
    const Y = (v) => T + 높 - (v / 최대) * 높;

    const 점 = (map) => {
      const out = [];
      for (let i = 1; i <= 끝날; i++) {
        const k = `${ymKey}-${String(i).padStart(2, "0")}`;
        out.push(`${X(i).toFixed(1)},${Y(Number(map[k] || 0)).toFixed(1)}`);
      }
      return out.join(" ");
    };

    /* 주말 띠 — 출석이 뚝 떨어져도 놀라지 않게 */
    let 주말 = "";
    for (let i = 1; i <= daysInMonth; i++) {
      const dow = new Date(base.getFullYear(), base.getMonth(), i).getDay();
      if (dow !== 0 && dow !== 6) continue;
      const x0 = X(i) - 폭 / (daysInMonth - 1) / 2;
      주말 += `<rect x="${Math.max(L, x0).toFixed(1)}" y="${T}" width="${(폭 / (daysInMonth - 1)).toFixed(1)}" height="${높}" fill="#F5F1E7"/>`;
    }

    /* 가로 눈금 — 0 · 절반 · 최대 */
    let 눈금 = "";
    [0, 최대 / 2, 최대].forEach(v => {
      눈금 += `<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W - R}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 ? "#DCCFBC" : "#EFE6D8"}" stroke-width="1"/>`
            + `<text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="#A0917E">${v}</text>`;
    });

    /* 날짜 눈금 — 1 · 6 · 11 … 다 적으면 표가 됩니다 */
    let 날짜 = "";
    for (let i = 1; i <= daysInMonth; i += 5) {
      const 오늘인가 = isThisMonth && i === todayD;
      날짜 += `<text x="${X(i).toFixed(1)}" y="${H - 14}" text-anchor="middle" font-size="10.5"
                     fill="${i <= 끝날 ? (오늘인가 ? "#B3372B" : "#A0917E") : "#C9BCA9"}">${i}</text>`;
    }

    const 끝키 = `${ymKey}-${String(끝날).padStart(2, "0")}`;
    const 끝총 = Number(totalByDay[끝키] || 0), 끝출 = Number(cntByDay[끝키] || 0);

    box.innerHTML = `
      <div class="adm-chart-h">
        <span class="adm-chart-t">한 달 흐름</span>
        <span style="flex:1"></span>
        <span class="adm-chart-lg"><i style="background:#B9A88F"></i>총원</span>
        <span class="adm-chart-lg"><i style="background:#B3372B"></i>출석</span>
      </div>
      <p class="adm-chart-sub">${ymKey.replace("-", "년 ")}월${isThisMonth ? ` · 오늘 ${todayD}일` : ""}</p>
      <svg viewBox="0 0 ${W} ${H}" role="img"
           aria-label="${ymKey} 총원과 출석 꺾은선 그래프">
        ${주말}${눈금}
        <polyline fill="none" stroke="#B9A88F" stroke-width="2" stroke-linejoin="round" points="${점(totalByDay)}"/>
        <polyline fill="none" stroke="#B3372B" stroke-width="2" stroke-linejoin="round" points="${점(cntByDay)}"/>
        ${isThisMonth ? `<line x1="${X(끝날).toFixed(1)}" y1="${T}" x2="${X(끝날).toFixed(1)}" y2="${T + 높}"
                               stroke="#B3372B" stroke-width="1" stroke-dasharray="3 3" opacity=".5"/>` : ""}
        <circle cx="${X(끝날).toFixed(1)}" cy="${Y(끝총).toFixed(1)}" r="3" fill="#B9A88F"/>
        <circle cx="${X(끝날).toFixed(1)}" cy="${Y(끝출).toFixed(1)}" r="3.5" fill="#B3372B"/>
        <text x="${(X(끝날) + 12).toFixed(1)}" y="${(Y(끝총) - 3).toFixed(1)}" font-size="11.5" fill="#8A7B68">${끝총}</text>
        <text x="${(X(끝날) + 12).toFixed(1)}" y="${(Y(끝출) + 4).toFixed(1)}" font-size="11.5" fill="#B3372B" font-weight="700">${끝출}</text>
        ${날짜}
      </svg>
      <p class="adm-chart-note">옅은 세로 띠는 주말${isThisMonth ? " · 점선은 오늘 · 오늘 뒤는 아직 안 그립니다" : ""}</p>`;
  }

  /* =====================================================================
     ✍️ 한 달 글자수 흐름 (2026-08-16)
     ---------------------------------------------------------------------
     [왜 개인별 선을 안 긋는가]
     이 방은 처음부터 "순위표처럼 보이지 않게" 만들어 왔습니다 — 글자수
     피드도 일부러 두 줄로 흩어 놨어요. 관리자 화면에 개인별 선을 그으면
     그걸 공유하는 순간 그 원칙이 무너집니다. 적게 쓴 사람이 위축되면
     참여가 늘기는커녕 줄어요. 그래서 **방 전체**와 **몇 명이 적었나**
     두 가지만 봅니다.

     [왜 한 그래프에 두 선을 안 겹치는가]
     글자수는 만 단위, 사람은 열몇 명입니다. 자가 다른 둘을 같은 그림에
     겹치면 **거짓 비교**가 돼요. 글자수는 꺾은선, 사람 수는 아래 얇은
     막대 띠 — 형태를 갈라 둡니다.

     [값] wordlog/{날짜}/{닉}.total 을 그날치 합으로 봅니다.
     명단(nickOwner)에 없는 옛 기록은 뺍니다 — 표와 같은 규칙이에요.
     ===================================================================== */
  /** 1234567 → "1,234,567" — 큰 숫자는 세 자리마다 끊어야 읽힙니다 */
  const comma = (n) => Number(n || 0).toLocaleString("ko-KR");

  function 글자수그래프(d) {
    const box = el("adm-word-chart");
    if (!box) return;
    _글자값 = d;

    const { ymKey, daysInMonth, base, wordMonth, nickSet, isThisMonth, todayD } = d;
    const 끝날 = isThisMonth ? Math.min(todayD, daysInMonth) : daysInMonth;
    if (끝날 < 1) { box.innerHTML = ""; return; }

    /* 날짜별 합계와 참여 인원 */
    const 합 = {}, 사람 = {};
    const 참여자 = new Set();
    for (let i = 1; i <= 끝날; i++) {
      const k = `${ymKey}-${String(i).padStart(2, "0")}`;
      const 그날 = wordMonth[k] || {};
      let sum = 0, n = 0;
      Object.keys(그날).forEach(닉 => {
        if (!nickSet.has(닉)) return;                  // 명단에 없는 옛 기록
        const t = Number(그날[닉]?.total || 0);
        if (t <= 0) return;                            // 0 자는 참여로 안 셉니다
        sum += t; n++; 참여자.add(닉);
      });
      합[k] = sum; 사람[k] = n;
    }

    const 총합 = Object.values(합).reduce((a, b) => a + b, 0);
    const 적은날 = Object.values(합).filter(v => v > 0).length;
    const 평균 = 적은날 ? Math.round(총합 / 적은날) : 0;

    if (!총합) {
      box.innerHTML = `<div class="adm-chart-h"><span class="adm-chart-t">한 달 글자수</span></div>
        <p class="adm-chart-sub">아직 이 달에 올라온 글자수가 없어요.</p>`;
      return;
    }

    const 칸폭 = Math.max(520, Math.round(box.clientWidth || 900));
    const W = 칸폭, H = 168, L = 46, R = 12, T = 18;
    const 선바닥 = 108, 막대바닥 = 146;                 // 위: 꺾은선 / 아래: 막대 띠
    const X = (day) => L + (daysInMonth <= 1 ? 0 : (day - 1) / (daysInMonth - 1) * (W - L - R));

    let 최대 = 0; for (let i = 1; i <= 끝날; i++) 최대 = Math.max(최대, 합[`${ymKey}-${String(i).padStart(2, "0")}`] || 0);
    /* 자는 만 단위로 올려 잡습니다 — 3만 7천이면 4만까지 */
    const 단위 = 최대 > 40000 ? 20000 : 10000;
    최대 = Math.max(단위, Math.ceil(최대 / 단위) * 단위);
    const Y = (v) => T + (선바닥 - T) - (v / 최대) * (선바닥 - T);

    let 최대인 = 1; for (let i = 1; i <= 끝날; i++) 최대인 = Math.max(최대인, 사람[`${ymKey}-${String(i).padStart(2, "0")}`] || 0);

    const 만 = (v) => v >= 10000 ? `${Math.round(v / 10000)}만` : String(v);

    /* 주말 띠 */
    let 주말 = "";
    const 한칸 = (W - L - R) / (daysInMonth - 1);
    for (let i = 1; i <= daysInMonth; i++) {
      const dow = new Date(base.getFullYear(), base.getMonth(), i).getDay();
      if (dow !== 0 && dow !== 6) continue;
      주말 += `<rect x="${Math.max(L, X(i) - 한칸 / 2).toFixed(1)}" y="${T}" width="${한칸.toFixed(1)}" height="${선바닥 - T}" fill="#F5F1E7"/>`;
    }

    let 눈금 = "";
    [0, 최대 / 2, 최대].forEach(v => {
      눈금 += `<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W - R}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 ? "#DCCFBC" : "#EFE6D8"}" stroke-width="1"/>`
            + `<text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="#A0917E">${만(v)}</text>`;
    });

    let 선 = [];
    for (let i = 1; i <= 끝날; i++) {
      const k = `${ymKey}-${String(i).padStart(2, "0")}`;
      선.push(`${X(i).toFixed(1)},${Y(합[k] || 0).toFixed(1)}`);
    }

    /* 아래 막대 띠 — 그날 글자수를 기록한 멤버 수 */
    let 막대 = "";
    const 막대높 = 막대바닥 - (선바닥 + 12);
    const 막대폭 = Math.max(3, Math.min(9, 한칸 * 0.55));
    for (let i = 1; i <= 끝날; i++) {
      const k = `${ymKey}-${String(i).padStart(2, "0")}`;
      const n = 사람[k] || 0;
      if (!n) continue;
      const h = Math.max(2, (n / 최대인) * 막대높);
      막대 += `<rect x="${(X(i) - 막대폭 / 2).toFixed(1)}" y="${(막대바닥 - h).toFixed(1)}" width="${막대폭.toFixed(1)}" height="${h.toFixed(1)}" fill="#9FE1CB"/>`;
    }

    const 끝키 = `${ymKey}-${String(끝날).padStart(2, "0")}`;

    box.innerHTML = `
      <div class="adm-chart-h">
        <span class="adm-chart-t">한 달 글자수</span>
        <span style="flex:1"></span>
        <span class="adm-chart-lg"><i style="background:#1D9E75"></i>방 전체</span>
        <span class="adm-chart-lg"><i style="background:#9FE1CB"></i>기록한 멤버</span>
      </div>
      <p class="adm-word-sum">
        이 달 <b>${comma(총합)}자</b> · 하루 평균 <b>${comma(평균)}자</b> ·
        <b class="hot">${참여자.size}명</b>이 참여했어요
      </p>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ymKey} 방 전체 글자수와 기록한 멤버 수">
        ${주말}${눈금}
        <polyline fill="none" stroke="#1D9E75" stroke-width="2" stroke-linejoin="round" points="${선.join(" ")}"/>
        <circle cx="${X(끝날).toFixed(1)}" cy="${Y(합[끝키] || 0).toFixed(1)}" r="3.5" fill="#1D9E75"/>
        <text x="${(X(끝날) - 8).toFixed(1)}" y="${(Y(합[끝키] || 0) - 8).toFixed(1)}" text-anchor="end"
              font-size="11.5" fill="#0F6E56" font-weight="700">${comma(합[끝키] || 0)}자</text>
        ${isThisMonth ? `<line x1="${X(끝날).toFixed(1)}" y1="${T}" x2="${X(끝날).toFixed(1)}" y2="${막대바닥}"
                               stroke="#B3372B" stroke-width="1" stroke-dasharray="3 3" opacity=".45"/>` : ""}
        <line x1="${L}" y1="${막대바닥}" x2="${W - R}" y2="${막대바닥}" stroke="#DCCFBC" stroke-width="1"/>
        ${막대}
        <text x="${L}" y="${H - 4}" font-size="10.5" fill="#A0917E">글자수 기록한 멤버</text>
      </svg>`;
  }

  /* =====================================================================
     ⏱️ 한 달 작업 시간 (2026-08-16)
     ---------------------------------------------------------------------
     [값] 새로 읽지 않습니다 — 출석부 표가 셀에 시간을 찍으려고 이미
     사람마다 하루치를 구해 뒀어요(minsByNick). 그걸 더하기만 합니다.
     서버 요청 0.

     [왜 "한 사람당" 을 함께 보나]
     총 시간만 보면 **사람이 늘어서** 늘어난 건지 **다들 더 오래 앉아
     있어서** 늘어난 건지 알 수 없습니다. 총 시간이 오르는데 한 사람당은
     그대로면 사람이 는 것, 둘 다 오르면 방이 달아오른 것이에요.
     인원 자체는 위 출석 그래프가 이미 보여주므로 여기서는 안 그립니다.

     ★ 작업 시간은 "자리에 있었던 시간" 입니다. 오래 앉아 있는 게 곧
       잘한 것은 아니에요. 멤버에게 보여줄 때는 "이만큼 같이 있었어요"
       쪽으로 읽히게 두는 게 이 방의 결에 맞습니다.
     ===================================================================== */
  function 시간그래프(d) {
    const box = el("adm-time-chart");
    if (!box) return;
    _시간값 = d;

    const { ymKey, daysInMonth, base, minsByNick, isThisMonth, todayD } = d;
    const 끝날 = isThisMonth ? Math.min(todayD, daysInMonth) : daysInMonth;
    if (끝날 < 1) { box.innerHTML = ""; return; }

    /* 날짜별 합계(분)와 그날 앉아 있던 사람 수 */
    const 합 = {}, 사람 = {};
    Object.keys(minsByNick).forEach(닉 => {
      const per = minsByNick[닉] || {};
      Object.keys(per).forEach(k => {
        const m = Number(per[k] || 0);
        if (m <= 0) return;
        합[k] = (합[k] || 0) + m;
        사람[k] = (사람[k] || 0) + 1;
      });
    });

    let 총분 = 0;
    for (let i = 1; i <= 끝날; i++) 총분 += 합[`${ymKey}-${String(i).padStart(2, "0")}`] || 0;
    if (!총분) {
      box.innerHTML = `<div class="adm-chart-h"><span class="adm-chart-t">한 달 작업 시간</span></div>
        <p class="adm-chart-sub">아직 이 달에 쌓인 작업 시간이 없어요.</p>`;
      return;
    }

    const 있는날 = [];
    for (let i = 1; i <= 끝날; i++) {
      const k = `${ymKey}-${String(i).padStart(2, "0")}`;
      if ((합[k] || 0) > 0) 있는날.push(k);
    }
    const 하루평균 = Math.round(총분 / 있는날.length);
    /* 한 사람당 = 그날 앉아 있던 사람으로 나눈 뒤 평균 — 사람 수가 날마다
       달라서, 총분을 총인원으로 한 번에 나누면 붐빈 날에 끌려갑니다 */
    const 인당들 = 있는날.map(k => (합[k] || 0) / Math.max(1, 사람[k] || 1));
    const 인당 = Math.round(인당들.reduce((a, b) => a + b, 0) / 인당들.length);

    const 시간글 = (분) => {
      const h = Math.floor(분 / 60), m = Math.round(분 % 60);
      if (h && m) return `${comma(h)}시간 ${m}분`;
      if (h) return `${comma(h)}시간`;
      return `${m}분`;
    };

    const 칸폭 = Math.max(520, Math.round(box.clientWidth || 900));
    const W = 칸폭, H = 168, L = 46, R = 12, T = 18;
    const 선바닥 = 108, 막대바닥 = 146;
    const X = (day) => L + (daysInMonth <= 1 ? 0 : (day - 1) / (daysInMonth - 1) * (W - L - R));

    let 최대 = 0;
    for (let i = 1; i <= 끝날; i++) 최대 = Math.max(최대, 합[`${ymKey}-${String(i).padStart(2, "0")}`] || 0);
    최대 = Math.max(60, Math.ceil(최대 / 60 / 20) * 20 * 60);      // 20시간 단위로 올림
    const Y = (v) => T + (선바닥 - T) - (v / 최대) * (선바닥 - T);

    let 최대인당 = 1;
    있는날.forEach((k, i) => { 최대인당 = Math.max(최대인당, 인당들[i]); });

    /* 주말 띠 */
    let 주말 = "";
    const 한칸 = (W - L - R) / (daysInMonth - 1);
    for (let i = 1; i <= daysInMonth; i++) {
      const dow = new Date(base.getFullYear(), base.getMonth(), i).getDay();
      if (dow !== 0 && dow !== 6) continue;
      주말 += `<rect x="${Math.max(L, X(i) - 한칸 / 2).toFixed(1)}" y="${T}" width="${한칸.toFixed(1)}" height="${선바닥 - T}" fill="#F5F1E7"/>`;
    }

    let 눈금 = "";
    [0, 최대 / 2, 최대].forEach(v => {
      눈금 += `<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W - R}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 ? "#DCCFBC" : "#EFE6D8"}" stroke-width="1"/>`
            + `<text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="#A0917E">${v ? Math.round(v / 60) + "h" : 0}</text>`;
    });

    const 선 = [];
    for (let i = 1; i <= 끝날; i++) {
      const k = `${ymKey}-${String(i).padStart(2, "0")}`;
      선.push(`${X(i).toFixed(1)},${Y(합[k] || 0).toFixed(1)}`);
    }

    /* 아래 막대 띠 — 그날 앉아 있던 사람 한 명당 평균 */
    let 막대 = "";
    const 막대높 = 막대바닥 - (선바닥 + 12);
    const 막대폭 = Math.max(3, Math.min(9, 한칸 * 0.55));
    for (let i = 1; i <= 끝날; i++) {
      const k = `${ymKey}-${String(i).padStart(2, "0")}`;
      if (!(합[k] > 0)) continue;
      const v = (합[k] || 0) / Math.max(1, 사람[k] || 1);
      const h = Math.max(2, (v / 최대인당) * 막대높);
      막대 += `<rect x="${(X(i) - 막대폭 / 2).toFixed(1)}" y="${(막대바닥 - h).toFixed(1)}" width="${막대폭.toFixed(1)}" height="${h.toFixed(1)}" fill="#FAC775"/>`;
    }

    const 끝키 = `${ymKey}-${String(끝날).padStart(2, "0")}`;

    box.innerHTML = `
      <div class="adm-chart-h">
        <span class="adm-chart-t">한 달 작업 시간</span>
        <span style="flex:1"></span>
        <span class="adm-chart-lg"><i style="background:#BA7517"></i>방 전체</span>
        <span class="adm-chart-lg"><i style="background:#FAC775"></i>한 사람당</span>
      </div>
      <p class="adm-word-sum">
        이 달 <b>${시간글(총분)}</b> · 하루 평균 <b>${시간글(하루평균)}</b> ·
        한 사람당 하루 <b class="warm">${시간글(인당)}</b>
      </p>
      <p class="adm-word-sum" style="opacity:.72; font-size:11.5px;">
        ※ 여기는 <b>자리에 있었던 시간</b> 전부예요 — 상태를 안 가립니다(☕BREAK·💤AWAY도 들어감).
        카드의 ⏱ 이나 ✨성실 멤버가 세는 <b>작업 시간</b>(WRITE 전액 + JOB·multiT 70%)과는 다른 값이에요.
      </p>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ymKey} 방 전체 작업 시간과 한 사람당 평균">
        ${주말}${눈금}
        <polyline fill="none" stroke="#BA7517" stroke-width="2" stroke-linejoin="round" points="${선.join(" ")}"/>
        <circle cx="${X(끝날).toFixed(1)}" cy="${Y(합[끝키] || 0).toFixed(1)}" r="3.5" fill="#BA7517"/>
        <text x="${(X(끝날) - 8).toFixed(1)}" y="${(Y(합[끝키] || 0) - 8).toFixed(1)}" text-anchor="end"
              font-size="11.5" fill="#854F0B" font-weight="700">${Math.round((합[끝키] || 0) / 60)}h</text>
        ${isThisMonth ? `<line x1="${X(끝날).toFixed(1)}" y1="${T}" x2="${X(끝날).toFixed(1)}" y2="${막대바닥}"
                               stroke="#B3372B" stroke-width="1" stroke-dasharray="3 3" opacity=".45"/>` : ""}
        <line x1="${L}" y1="${막대바닥}" x2="${W - R}" y2="${막대바닥}" stroke="#DCCFBC" stroke-width="1"/>
        ${막대}
        <text x="${L}" y="${H - 4}" font-size="10.5" fill="#A0917E">한 사람당 평균</text>
      </svg>`;
  }

  /* =====================================================================
     🕐 시간대별 접속 (2026-08-18) — "보통 몇 시에 몇 명이 있나"
     ---------------------------------------------------------------------
     [무엇을 세나] 이 달의 시간 기록(timeSegs)을 시간대별로 접습니다.
     시간대마다 "그 시간에 구간이 걸쳐 있던 사람 수" 를 날마다 세고,
     날수로 나눈 평균이에요. 아무도 없던 날도 0 으로 셈에 넣습니다 —
     "있던 날만" 평균하면 숫자가 부풀어요.

     [오늘은 뺍니다] 오늘은 아직 안 끝나서, 지금 이후 시간이 전부 0 으로
     들어가 평균을 끌어내립니다. 온전한 날만 셉니다.

     [평일/주말 칩] 작가들 패턴이 주말에 다릅니다. 칩을 누르면 그 요일만
     골라 다시 접어요 — 자료는 손에 든 것 그대로, 서버는 안 갑니다.

     [자정 걸친 체류] timeSegs 는 자정에 날짜별로 갈라져 저장되므로
     (0813 커밋), 여기서 따로 자를 것이 없습니다.
     ===================================================================== */
  let _시간대필터 = "all";   // all | wk | we

  function 시간대그래프(d) {
    const box = el("adm-hour-chart");
    if (!box) return;
    _시간대값 = d;

    const { ymKey, daysInMonth, base, segsByNick, isThisMonth, todayD } = d;
    /* 온전히 지나간 날까지만 — 이번 달이면 어제까지 */
    const 끝날 = isThisMonth ? Math.min(todayD - 1, daysInMonth) : daysInMonth;
    if (끝날 < 1) {
      box.innerHTML = `<div class="adm-chart-h"><span class="adm-chart-t">시간대별 접속</span></div>
        <p class="adm-chart-sub">하루가 온전히 지나야 그릴 수 있어요.</p>`;
      return;
    }

    /* 날짜 거르기 — 평일/주말 */
    const 날들 = [];
    for (let i = 1; i <= 끝날; i++) {
      const dow = new Date(base.getFullYear(), base.getMonth(), i).getDay();
      const 주말인가 = (dow === 0 || dow === 6);
      if (_시간대필터 === "wk" && 주말인가) continue;
      if (_시간대필터 === "we" && !주말인가) continue;
      날들.push(`${ymKey}-${String(i).padStart(2, "0")}`);
    }
    if (!날들.length) {
      box.innerHTML = `<div class="adm-chart-h"><span class="adm-chart-t">시간대별 접속</span></div>
        <p class="adm-chart-sub">아직 이 달에 그런 요일이 없어요.</p>`;
      bind칩(box);
      return;
    }

    /* 시간대마다 사람 수 세기.
       ★ 한 사람이 같은 시간대에 구간을 여러 개 남겨도(쉬었다 다시 시작)
         **한 명**입니다 — 닉마다 그날 덮은 시간대를 Set 으로 모은 뒤 셉니다. */
    const 합 = new Array(24).fill(0);
    날들.forEach(k => {
      const 날시작 = new Date(k + "T00:00:00").getTime();
      Object.keys(segsByNick).forEach(닉 => {
        const segs = (segsByNick[닉] || {})[k];
        if (!segs || !segs.length) return;
        const 덮음 = new Set();
        segs.forEach(sg => {
          let h0 = Math.floor((sg.a - 날시작) / 3600000);
          let h1 = Math.ceil((sg.b - 날시작) / 3600000) - 1;
          h0 = Math.max(0, h0); h1 = Math.min(23, h1);
          for (let h = h0; h <= h1; h++) 덮음.add(h);
        });
        덮음.forEach(h => { 합[h]++; });
      });
    });
    const 평균 = 합.map(v => v / 날들.length);
    const 최댓값 = Math.max(...평균);

    if (!최댓값) {
      box.innerHTML = `<div class="adm-chart-h"><span class="adm-chart-t">시간대별 접속</span></div>
        <p class="adm-chart-sub">아직 이 달에 쌓인 시간 기록이 없어요.</p>`;
      bind칩(box);
      return;
    }

    const 피크 = 평균.indexOf(최댓값);
    /* 한산은 낮 시간(6~23시)에서만 — 새벽은 당연히 0이라 정보가 없어요 */
    let 한산 = 6;
    for (let h = 6; h <= 23; h++) if (평균[h] < 평균[한산]) 한산 = h;

    const 칸폭 = Math.max(520, Math.round(box.clientWidth || 900));
    const W = 칸폭, H = 190, L = 30, R = 8, T = 24, B = 26;
    const 위 = Math.max(1, Math.ceil(최댓값));
    const bw = (W - L - R) / 24;
    const Y = (v) => T + (H - T - B) - (v / 위) * (H - T - B);

    let 눈금 = "";
    const 단위 = 위 <= 4 ? 1 : Math.ceil(위 / 4);
    for (let g = 단위; g <= 위; g += 단위) {
      눈금 += `<line x1="${L}" y1="${Y(g).toFixed(1)}" x2="${W - R}" y2="${Y(g).toFixed(1)}" stroke="#EFE6D8" stroke-width="1"/>`
            + `<text x="${L - 5}" y="${(Y(g) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#A0917E">${g}</text>`;
    }

    const 지금h = new Date().getHours();
    let 막대 = "", 라벨 = "";
    평균.forEach((v, h) => {
      const x = L + h * bw;
      const 높이 = Math.max(v > 0 ? 2 : 0, (v / 위) * (H - T - B));
      const 색 = h === 피크 ? "#B3372B" : "#D9A296";
      const 오늘점선 = (isThisMonth && h === 지금h)
        ? ` stroke="#2B2620" stroke-width="1" stroke-dasharray="3 2"` : "";
      막대 += `<rect x="${(x + 1.5).toFixed(1)}" y="${(H - B - 높이).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${높이.toFixed(1)}" rx="2.5" fill="${색}"${오늘점선}>`
            + `<title>${h}시 ~ ${h + 1}시 · 평균 ${v.toFixed(1)}명</title></rect>`;
      if (h === 피크) 라벨 += `<text x="${(x + bw / 2).toFixed(1)}" y="${(H - B - 높이 - 7).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#B3372B" font-weight="700">${v.toFixed(1)}명</text>`;
      if (h % 3 === 0) 라벨 += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#A0917E">${h}시</text>`;
    });

    const 칩 = (id, 글) =>
      `<button type="button" class="adm-hour-chip${_시간대필터 === id ? " on" : ""}" data-hour-f="${id}">${글}</button>`;

    box.innerHTML = `
      <div class="adm-chart-h">
        <span class="adm-chart-t">시간대별 접속</span>
        <span style="flex:1"></span>
        ${칩("all", "전체")}${칩("wk", "평일만")}${칩("we", "주말만")}
      </div>
      <p class="adm-word-sum">
        피크 <b class="warm">${피크}시 (${평균[피크].toFixed(1)}명)</b> ·
        낮 시간 한산 <b>${한산}시 (${평균[한산].toFixed(1)}명)</b> ·
        ${날들.length}일 평균
      </p>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ymKey} 시간대별 평균 접속 인원">
        ${눈금}
        <line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#DCCFBC" stroke-width="1"/>
        ${막대}${라벨}
      </svg>
      <p class="adm-chart-note">막대에 마우스를 올리면 정확한 수가 떠요.
        아무도 없던 날도 0으로 셈에 넣은 평균입니다${isThisMonth ? " (오늘은 아직 안 끝나서 뺐어요)" : ""}.</p>`;
    bind칩(box);
  }

  function bind칩(box) {
    box.querySelectorAll("[data-hour-f]").forEach(b => {
      b.addEventListener("click", () => {
        _시간대필터 = b.getAttribute("data-hour-f");
        if (_시간대값) 시간대그래프(_시간대값);
      });
    });
  }

  /* =====================================================================
     🏅 출석률 순위 (2026-08-18 — 연속 출석에서 바꿈)
     ---------------------------------------------------------------------
     [왜 연속이 아니라 비율인가 — 콩]
     이 방의 규칙은 "한 달 18일 출석"이지 "매일 출석"이 아닙니다.
     연속 출석 순위는 규칙에 없는 것(매일)을 부추겨서 취지와 어긋났어요.
     그리고 기준이 사람마다 다릅니다 — 늦게 들어온 사람은 12일, 휴가 낸
     사람은 그만큼 낮아진 기준. 그래서 **날수가 아니라 비율**로 세웁니다.

       출석률 = 출석한 날 ÷ 자기 기준(need)   — 100% 넘을 수 있어요

     [재료는 공짜] need·출석일은 출석부 표가 이미 다 계산합니다
     (ruleOf — 규칙 칸과 같은 셈). 여기는 받아서 줄만 세워요.
     그래서 달 넘기기 ‹ › 를 따라 **지난 달 순위**도 그대로 나옵니다.

     [기준이 0인 사람] 이 달에 아직 멤버가 아니었거나(입장 전) 휴가로
     기준이 다 깎인 사람 — 등수를 매길 수 없으니 맨 아래 흐리게.
     ===================================================================== */
  /* =====================================================================
     🏅 개근 명단 굳히기 (2026-08-22 — 콩)
     ---------------------------------------------------------------------
     [무엇을 하나]
     방 배경판(오늘 접속 현황 · 지금 방에서) 아래에 "이번 달 의무 출석일을
     채운 분들" 을 느리게 흘려 보여 주기로 했습니다. 그 명단을 여기서
     한 번 적어 둡니다.

     [왜 여기인가 — 안 고른 길들]
     ① 방에 있는 사람마다 각자 계산하기
        전원의 출석·휴가·입장일을 사람 수만큼 읽어야 합니다. 통신량이
        접속자 수에 비례해 늘어요. 무엇보다 ruleOf(의무 출석일 셈)를
        방 쪽에 **한 벌 더 베껴야** 하는데, 두 벌이 되는 순간 언젠가
        어긋납니다. 규칙은 한 곳에만 있어야 해요.
     ② 서버가 매일 계산하기
        서버가 없습니다 (정적 페이지 + RTDB).
     ③ ★ 이 길 — 출석부가 **이미** 낸 답을 그대로 적어 둔다
        위 표가 사람마다 state("ok"/"maybe"/"bad") 를 냈습니다. 그 중
        "ok" 만 모으면 그게 개근 명단이에요. 새로 세는 게 없습니다.
        방 쪽은 이 작은 명단 하나만 읽으면 됩니다.

     [언제 적히나]
     방장이 출석부를 열 때마다. 콩은 하루에도 몇 번씩 새로고침하니
     사실상 실시간입니다.

     [쓸데없는 쓰기를 안 하려고]
     명단이 **달라졌을 때만** 적습니다. 새로고침 백 번 해도 사람이
     안 바뀌었으면 쓰기는 0번이에요.

     [옛 달은 안 건드립니다]
     배경판이 보여 주는 건 이번 달과 지난 달뿐입니다. ‹ 로 옛날을
     들춰 봤다고 그때 명단이 새로 적히지는 않아요.
     ===================================================================== */
  function 달이름(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function 최근두달() {
    const now = new Date();
    const 지난 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return [달이름(now), 달이름(지난)];
  }

  async function 명단굳히기(ymKey, rateRows) {
    try {
      /* 옛 달도, 앞달도 지나갑니다 — 최근두달() 은 지난달·이번달 둘뿐이라
         앞달(다음 달)은 여기서 자동으로 걸립니다. 아직 오지 않은 달의
         "개근 명단" 은 말이 안 되니까요. */
      if (!최근두달().includes(ymKey)) return;
      /* 🌿 **할인 덕에** ✅ 가 뜬 사람만 뺍니다 (2026-08-30).
         쉬었더라도 할인 전 기준을 채웠으면 개근이 맞아요 — state 가
         이미 할인 전 기준으로 매겨져 있어서, out 만 걸러내면 됩니다. */
      const 명단 = rateRows.filter(r => r.state === "ok" && r.need > 0 && !r.out)
                          .map(r => r.n)
                          .sort((a, b) => a.localeCompare(b, "ko"));
      const 옛 = await db.ref(`honors/${ymKey}/list`).once("value");
      const 옛명단 = 옛.val() || [];
      if (JSON.stringify(옛명단) === JSON.stringify(명단)) return;   // 그대로면 안 씀
      /* 아무도 없으면 노드를 통째로 지웁니다 — 빈 목록을 남겨 두면
         배경판이 "달성자 0명" 칸을 괜히 그립니다. */
      if (!명단.length) { await db.ref(`honors/${ymKey}`).remove(); return; }
      await db.ref(`honors/${ymKey}`).set({
        list: 명단,
        at: firebase.database.ServerValue.TIMESTAMP,
        by: (window.myNick || window.ADMIN_NICK || "")
      });
    } catch (e) { console.warn("[adm honors]", e); }
  }

  function 출석률순위(rateRows, 앞달) {
    const box = el("adm-streak");
    if (!box) return;

    /* 앞달은 아직 아무도 안 나온 달입니다 — 전원 0% 🔴 로 줄을 세우면
       읽는 사람이 놀랍니다. 기준만 알려 주고 순위는 접습니다.
       ★ 기준(need)은 이미 개인사정만큼 깎여 있어서, 미리 찍어 둔
         병가가 다음 달 기준을 어떻게 바꾸는지 여기서 확인됩니다. */
    if (앞달) {
      const 쉬는이 = rateRows.filter(r => r.leave)   // 앞달은 아직 아무도 안 나와서 out 이 무의미
                            .map(r => r.n).sort((a, b) => a.localeCompare(b, "ko"));
      box.innerHTML = `<div class="adm-chart-h"><span class="adm-chart-t">🏅 출석률</span></div>
        <p class="adm-chart-sub">아직 오지 않은 달이에요 — 순위는 그 달이 시작되면 나타납니다.</p>` +
        (쉬는이.length
          ? `<p class="adm-chart-note rest">🌿 미리 적어 둔 개인사정 — ${
              쉬는이.map(escapeHtml).join(" · ")}</p>`
          : "");
      return;
    }

    /* 🌿 개인사정으로 하루라도 쉰 사람은 순위에서 뺍니다 (2026-08-30 — 콩).
       기준(need)이 이미 그만큼 내려가 있어서, 사흘 나오고 100% 로 1등을
       하게 됩니다. 아픈 사람을 1등 자리에 올리는 건 격려가 아니에요.
       대신 아래에 한 줄로 조용히 적습니다 — 없는 사람 취급도 아니게. */
    const 쉬는이 = rateRows.filter(r => r.out)
                          .map(r => r.n).sort((a, b) => a.localeCompare(b, "ko"));
    const 쉬는줄 = 쉬는이.length
      ? `<p class="adm-chart-note rest">🌿 사정으로 쉬는 중 — ${
          쉬는이.map(escapeHtml).join(" · ")} <span class="q">(기준이 내려가 있어 순위에서 빼 두었어요)</span></p>`
      : "";

    const rows = rateRows.filter(r => !r.out).map(r => ({
      ...r,
      rate: r.need > 0 ? r.att / r.need : null
    }));
    /* 비율 내림차순 → 같으면 출석일 많은 쪽 → 가나다. 기준 0은 맨 아래 */
    rows.sort((a, b) =>
      ((b.rate !== null) - (a.rate !== null)) ||
      (b.rate - a.rate) || (b.att - a.att) || a.n.localeCompare(b.n, "ko"));

    if (!rows.length || rows[0].rate === null) {
      box.innerHTML = `<div class="adm-chart-h"><span class="adm-chart-t">🏅 출석률</span></div>
        <p class="adm-chart-sub">아직 이 달에 셀 것이 없어요.</p>${쉬는줄}`;
      return;
    }

    const 메달 = ["🥇", "🥈", "🥉"];
    const 상태표 = { ok: `<span class="td ok">✅ 달성</span>`,
                     maybe: `<span class="td wait">🟡 가능</span>`,
                     bad: `<span class="td bad">🔴 위험</span>` };
    const 줄 = (r, i) => {
      const 있음 = r.rate !== null;
      const pct = 있음 ? Math.round(r.rate * 100) : 0;
      const rk = (i < 3 && 있음 && r.rate > 0)
        ? `<span class="rk m">${메달[i]}</span>` : `<span class="rk">${i + 1}</span>`;
      /* 막대는 100% 에서 꽉 참 — 넘긴 만큼은 숫자로 읽습니다.
         (막대까지 늘리면 1등 막대에 맞춰 다른 모두가 쪼그라들어요) */
      const w = 있음 ? Math.min(100, Math.max(pct > 0 ? 6 : 0, pct)) : 3;
      return `<div class="adm-streak-row${있음 ? "" : " dead"}">
        ${rk}<span class="nm">${escapeHtml(r.n)}${
          r.leave ? `<span class="lv-n" title="🌿 개인사정이 있는데도 할인 전 기준을 채웠어요">🌿</span>` : ""}</span>
        <span class="bw"><i style="width:${w}%"></i></span>
        <span class="ct">${있음 ? `${pct}<small>%</small>` : "—"}</span>
        <span class="ct sub">${있음 ? `${r.att}/${r.need}<small>일</small>` : ""}</span>
        ${있음 ? 상태표[r.state] || "" : `<span class="td">기준 없음</span>`}
      </div>`;
    };

    /* 세 칸 (2026-08-18, 두 칸 → 세 칸 — 두 칸일 땐 막대가 길어서
       붉은 줄이 화면을 꽉 채웠습니다 ㅋㅋ. 칸이 좁아지면 막대도 짧아져요).
       n등분은 늘 같은 수법 — 올림으로 나눠 앞칸부터 채웁니다. */
    const 칸수 = 3;
    const 몫 = Math.ceil(rows.length / 칸수);
    const 칸들 = [];
    for (let c = 0; c < 칸수; c++) 칸들.push(rows.slice(c * 몫, (c + 1) * 몫));
    box.innerHTML = `
      <div class="adm-chart-h">
        <span class="adm-chart-t">🏅 출석률</span>
        <span style="flex:1"></span>
        <span class="adm-chart-lg">출석 ÷ 자기 기준 — 기준은 입장일·휴가에 따라 달라요</span>
      </div>
      <div class="adm-streak-cols">
        ${칸들.map((칸, c) =>
          `<div>${칸.map((r, i) => 줄(r, i + c * 몫)).join("")}</div>`).join("")}
      </div>
      <p class="adm-chart-note">막대는 100%에서 꽉 차요 — 기준을 넘긴 분은 숫자로 보세요.
        ✅ 달성 · 🟡 남은 날로 채울 수 있음 · 🔴 남은 날을 다 나와도 모자람.</p>${쉬는줄}`;
  }

  /* ---------------------------------------------- ③-1b 탈퇴 인원 삭제
     출근부 이름 칸의 [✕] 로 부릅니다. 두 번 확인(확인창 + 닉네임 직접 입력)을
     거쳐야 지워집니다. 되돌릴 수 없어요.

     지우는 곳
       users/{닉}                 프로필·투두·목표·timeSegs·timeCur·vacations·
                                  chattyParticipation·idleDetect … 전부
       status/{닉}                접속 상태
       nickOwner/{닉}             닉 도장 — 이걸 지워야 그 닉을 다시 쓸 수 있어요
       attendance/{모든 날짜}/{닉} 출근 기록
       wordlog/{모든 날짜}/{닉}    글자수 기록

     남기는 곳
       messages / messages2 — 지난 발언은 지우지 않습니다.
         한 사람의 말만 빼면 대화 맥락이 끊겨 읽을 수 없게 되니까요.
       wordfeed — push 키라 닉 필드로 하나하나 걸러야 하는데, 그날치만 남고
         금방 사라지는 구조라 굳이 손대지 않습니다.
     ------------------------------------------------------------------- */
  async function removeMember(nick) {
    if (!nick) return;
    if (!ownerOnly("멤버를 명단에서 지우는 것")) return;
    if (!confirm(
      `${nick}님을 명단에서 지울까요? 출석·휴가·작업시간·글자수 기록이 모두 삭제되고 되돌릴 수 없어요.\n` +
      `채팅에 남은 지난 말은 그대로 남아요.`
    )) return;

    /* 두 번째 확인 — 오타·실수로 엉뚱한 사람을 지우지 않도록 닉을 직접 적게 합니다 */
    const typed = prompt(`정말 지우려면 아래 닉네임을 똑같이 입력해 주세요.\n\n${nick}`);
    if (typed === null) return;                       // 취소
    if (typed.trim() !== nick) {
      msg("adm-att-msg", "입력한 닉네임이 달라서 지우지 않았어요.", true);
      return;
    }

    msg("adm-att-msg", "지우는 중…");
    try {
      /* nickOwner 를 지우기 전에 uid 를 먼저 읽어 둡니다 —
         지운 뒤에는 이 닉이 누구였는지 알 방법이 없어져요. */
      const uid = (await db.ref("nickOwner/" + nick).once("value")).val();
      void uid;

      /* attendance·wordlog 은 날짜별로 흩어져 있어 통째로 읽어 해당 닉만 골라
         multi-path update 로 한 번에 지웁니다. (날짜마다 remove 하면 요청이 너무 많아요) */
      const [attSnap, wlSnap] = await Promise.all([
        db.ref("attendance").once("value"),
        db.ref("wordlog").once("value")
      ]);

      const attUpd = {};
      Object.entries(attSnap.val() || {}).forEach(([day, byNick]) => {
        if (byNick && Object.prototype.hasOwnProperty.call(byNick, nick)) attUpd[`${day}/${nick}`] = null;
      });
      if (Object.keys(attUpd).length) await db.ref("attendance").update(attUpd);

      const wlUpd = {};
      Object.entries(wlSnap.val() || {}).forEach(([day, byNick]) => {
        if (byNick && Object.prototype.hasOwnProperty.call(byNick, nick)) wlUpd[`${day}/${nick}`] = null;
      });
      if (Object.keys(wlUpd).length) await db.ref("wordlog").update(wlUpd);

      /* ★★★ [넓힘 2026-08-22 — 콩] 이 함수가 만들어진 뒤에 **새 자리들이
         생겼습니다.** 업적·회차 기록·작품 이름·할 일 집계예요. 여기에
         안 더해 두면 사람은 지워졌는데 자취만 서버에 떠돕니다 —
         nickOwner 가 사라져서 **누구 것인지도 알 수 없는 채로.**
         ※ 📮 쪽지(notes·notesOut)는 보안규칙이 주인에게만 열려 있어
           방장도 못 지웁니다. 규칙을 손대야 하는 일이라 남겨 둡니다.
         ★ 자리를 새로 만들 때는 여기도 함께 보세요. */
      const 새자리 = ["achv", "worklog", "workname"];
      for (const p of 새자리) {
        try { await db.ref(`${p}/${nick}`).remove(); } catch (e) { console.warn("[adm remove]", p, e); }
      }
      /* todostat 은 날짜별이라 attendance·wordlog 과 같은 방식으로 */
      try {
        const tsSnap = await db.ref("todostat").once("value");
        const tsUpd = {};
        Object.entries(tsSnap.val() || {}).forEach(([day, byNick]) => {
          if (byNick && Object.prototype.hasOwnProperty.call(byNick, nick)) tsUpd[`${day}/${nick}`] = null;
        });
        if (Object.keys(tsUpd).length) await db.ref("todostat").update(tsUpd);
      } catch (e) { console.warn("[adm remove todostat]", e); }

      await db.ref("users/" + nick).remove();
      await db.ref("status/" + nick).remove();
      await db.ref("nickOwner/" + nick).remove();     // 맨 마지막 — 도장 반납

      await loadAttendance(_attOffset);
      msg("adm-att-msg", `🗑️ ${nick}님을 지웠어요.`);
    } catch (e) {
      console.warn("[adm removeMember]", e);
      msg("adm-att-msg", "지우지 못했어요 — 보안규칙에 관리자 예외가 들어갔는지 확인해 주세요.", true);
    }
  }

  /* =====================================================================
     🔐 입장 승인 · 🚫 내보내기 (2026-08-11)
     ---------------------------------------------------------------------
     [왜 만들었나]
     모르는 닉네임이 작업방에 들어와 수다방까지 들어왔는데 아무 대꾸가
     없었습니다. 멤버들이 무서워했어요.

     예전에는 **주소만 알면 아무 닉네임이나 새로 만들어** 들어올 수
     있었습니다. 멤버를 늘리기 쉬우라고 그렇게 뒀던 건데, 방이 알려질수록
     그게 구멍이 됩니다.

     [두 칸으로 나눴습니다]
       config/allow/{닉네임} = true   승인 명단 — 여기 있어야 **새로** 만들 수 있음
       config/ban/{닉네임}   = true   내보낸 사람 — 있으면 아무것도 못 함

     [2026-08-17] config 통째는 방장만이고, **allow · ban 두 칸만** 운영진에게
     열려 있습니다. config 를 통으로 열면 운영진이 `config` 를 remove() 해서
     승인 명단과 차단 명단을 한 번에 날릴 수 있었어요 (allow 는 [전부] 로
     되살릴 수 있지만 ban 은 그대로 사라집니다).

     ★ 막는 일은 화면이 아니라 **보안규칙(서버)** 이 합니다. 개발자도구로
       무엇을 하든 안 뚫려요. 여기 화면은 그 명단을 손보는 곳일 뿐입니다.

     [내보내기가 지우기와 다른 점]
     지우기(✕)는 기록까지 없애고 되돌릴 수 없습니다. 내보내기는 **문만
     잠급니다** — 기록은 그대로 두고, 마음이 바뀌면 풀 수 있어요.
     낯선 사람에게 쓸 때는 이쪽이 맞습니다.
     ===================================================================== */
  /* =====================================================================
     🛡️ 운영진 명단 (2026-08-17) — staff/{uid} = 닉네임
     ---------------------------------------------------------------------
     [왜 uid 로 두나]
     닉은 바뀝니다 (0813 에 방장 닉이 그링링🍄 → 링가링🍄 로 바뀌었죠).
     uid 는 계정이 살아 있는 한 그대로고, **보안규칙이 사람을 알아보는
     유일한 이름**이 uid 입니다. 그래서 열쇠는 uid, 값은 사람이 알아보기
     위한 닉네임입니다.

     [그런데 방장은 uid 를 모릅니다]
     콘솔을 열어 찾아오라고 하면 아무도 안 씁니다. 그래서 **닉네임을
     적으면 nickOwner/{닉} 에서 uid 를 대신 찾아** 넣습니다. 명단에
     이름과 uid 앞자리를 같이 보여줘서 나중에 알아볼 수 있게 해요.

     [닉을 바꾼 사람이 있으면]
     명단의 닉 표기는 그때 적힌 이름 그대로 남습니다 (uid 는 그대로라
     권한은 멀쩡해요). 헷갈리면 지웠다 다시 넣으면 됩니다.

     ★ staff 쓰기는 보안규칙에서 **방장 uid 만** 받습니다. 운영진이
       콘솔로 자기 동료를 늘리는 길은 없어요.
     ===================================================================== */
  /* =====================================================================
     👋 입장 인사 (2026-08-20) — config/hello = { text, at }
     ---------------------------------------------------------------------
     걸어 두면 들어오는 사람에게 가운데 큰 카드로 뜹니다. 비우면 안 떠요.
     ★ at 을 함께 적는 이유 — 멤버 쪽이 "하루 한 번" 을 셀 때 이 값으로
       **문구가 바뀌었는지**를 압니다. 바뀌면 그날 다시 한 번 보여줘요.
       그래서 내용이 같아도 [인사 걸기] 를 누르면 다시 돕니다.
     ===================================================================== */
  async function loadHello() {
    const ta = el("adm-hello");
    if (!ta) return;
    try {
      const v = (await db.ref("config/hello").once("value")).val();
      ta.value = String(v?.text || "");
    } catch (e) {}
  }

  async function saveHello() {
    const t = String(el("adm-hello")?.value || "").trim().slice(0, 200);
    if (!t) { msg("adm-hello-msg", "문구를 적어 주세요. (내리려면 [내리기])", true); return; }
    try {
      await db.ref("config/hello").set({ text: t, at: Date.now() });
      msg("adm-hello-msg", "👋 걸었어요. 들어오는 분들에게 오늘 한 번씩 보입니다.");
    } catch (e) {
      msg("adm-hello-msg", "걸지 못했어요. " + (e.code || e.message || ""), true);
    }
  }

  async function clearHello() {
    if (!confirm("입장 인사를 내릴까요? 아무에게도 안 뜨게 됩니다.")) return;
    try {
      await db.ref("config/hello").remove();
      const ta = el("adm-hello"); if (ta) ta.value = "";
      msg("adm-hello-msg", "내렸어요.");
    } catch (e) {
      msg("adm-hello-msg", "내리지 못했어요.", true);
    }
  }

  async function loadStaffList() {
    const box = el("adm-staff-list");
    if (!box) return;
    try {
      const v = (await db.ref("staff").once("value")).val() || {};
      const uids = Object.keys(v);
      const 수 = el("adm-staff-count");
      if (수) 수.textContent = uids.length ? `총 ${uids.length}명` : "";

      box.innerHTML = uids.length
        ? uids.map(u => `
            <div class="adm-row">
              <span class="n">${escapeHtml(v[u] || "(이름 없음)")}</span>
              <span class="s" title="${escapeHtml(u)}">${escapeHtml(u.slice(0, 8))}…</span>
              <button class="adm-btn ghost" data-staff-del="${escapeHtml(u)}">내리기</button>
            </div>`).join("")
        : "아직 운영진이 없어요. 아래에 닉네임을 적어 올려 주세요. (방장은 명단에 없어도 늘 들어옵니다)";

      /* 🏷️ 스티커 명단(config/vice)이 어긋나 있으면 여기서 맞춥니다.
         두 곳에 적히는 이상 언젠가는 어긋납니다 — 콘솔로 한쪽만 손댔거나,
         스티커를 적는 중에 연결이 끊겼거나. 대시보드를 열 때마다 조용히
         맞춰 두면 "권한은 있는데 스티커가 없다" 는 일이 안 생겨요.
         ★ 다른 곳이 있을 때만 씁니다 (같으면 아무 요청도 안 보냅니다). */
      const 있어야할 = new Set(uids.map(u => v[u]).filter(Boolean));
      const 지금 = (await db.ref("config/vice").once("value")).val() || {};
      const 고칠것 = {};
      있어야할.forEach(n => { if (지금[n] !== true) 고칠것[n] = true; });
      Object.keys(지금).forEach(n => { if (!있어야할.has(n)) 고칠것[n] = null; });
      if (Object.keys(고칠것).length) await db.ref("config/vice").update(고칠것);
    } catch (e) {
      box.textContent = "불러오지 못했어요.";
    }
  }

  async function addStaff(nickRaw) {
    if (!ownerOnly("운영진 명단 관리")) return;
    const nick = String(nickRaw || "").trim();
    if (!nick) { msg("adm-staff-msg", "닉네임을 적어 주세요.", true); return; }
    if (nick === ADMIN_NICK) {
      msg("adm-staff-msg", "방장은 명단에 없어도 늘 들어와요.", true); return;
    }
    try {
      /* 닉 → uid. 도장이 없으면 아직 방에 들어온 적 없는 사람입니다. */
      const uid = (await db.ref("nickOwner/" + nick).once("value")).val();
      if (!uid) {
        msg("adm-staff-msg", `${nick} — 아직 방에 들어온 적이 없는 닉네임이에요. 메인 방에서 한 번 입장한 뒤에 올려 주세요.`, true);
        return;
      }
      await db.ref("staff/" + uid).set(nick);
      /* 🏷️ 카드에 붙는 부방장 스티커 명단도 함께 (config/vice/{닉}).
         staff 는 uid 열쇠라 일반 멤버가 못 읽습니다 — 카드는 모두가
         보는 것이라 누구나 읽을 수 있는 config 에 이름을 하나 더 적어요. */
      await db.ref("config/vice/" + nick).set(true);
      const inp = el("adm-staff-nick"); if (inp) inp.value = "";
      await loadStaffList();
      msg("adm-staff-msg", `🛡️ ${nick} — 이제 관리 페이지에 들어올 수 있고, 카드에 🏷️ 부방장 스티커가 붙어요. (본인은 다시 로그인해야 반영돼요)`);
    } catch (e) {
      msg("adm-staff-msg", "저장하지 못했어요. " + (e.code || e.message || ""), true);
    }
  }

  async function delStaff(uid) {
    if (!ownerOnly("운영진 명단 관리")) return;
    const name = el("adm-staff-list")?.querySelector(`[data-staff-del="${CSS.escape(uid)}"]`)
                   ?.closest(".adm-row")?.querySelector(".n")?.textContent || uid;
    if (!confirm(`${name} 님을 운영진에서 내릴까요?\n관리 페이지에 못 들어오게 됩니다. (방 이용은 그대로예요)`)) return;
    try {
      await db.ref("staff/" + uid).remove();
      /* 스티커도 같이 뗍니다 — 권한만 내리고 이름표를 남겨 두면
         멤버들은 아직 부방장인 줄 압니다. */
      if (name) await db.ref("config/vice/" + name).remove();
      await loadStaffList();
      msg("adm-staff-msg", `${name} — 운영진에서 내렸어요. (🏷️ 스티커도 뗐어요)`);
    } catch (e) {
      msg("adm-staff-msg", "지우지 못했어요. " + (e.code || e.message || ""), true);
    }
  }

  async function loadAllowList() {
    const box = el("adm-allow-list");
    if (!box) return;
    try {
      const v = (await db.ref("config/allow").once("value")).val() || {};
      const nicks = Object.keys(v).filter(n => v[n] === true).sort();

      /* [2026-08-15] 단추 오른쪽에 승인된 사람 수.
         명단이 길어지면 스크롤 안에 갇혀서 몇 명인지 알 수가 없었어요. */
      const 수 = el("adm-allow-count");
      if (수) 수.textContent = nicks.length ? `총 ${nicks.length}명` : "";

      box.innerHTML = nicks.length
        ? nicks.map(n => `
            <div class="adm-row">
              <span class="n">${escapeHtml(n)}</span>
              <button class="adm-btn ghost" data-allow-del="${escapeHtml(n)}">승인 취소</button>
            </div>`).join("")
        : "아직 승인한 닉네임이 없어요. 아래 [지금 쓰는 닉네임 전부 승인] 을 먼저 눌러 주세요.";
    } catch (e) {
      box.textContent = "불러오지 못했어요.";
    }
  }

  async function addAllow(nickRaw) {
    const nick = String(nickRaw || "").trim();
    if (!nick) { msg("adm-allow-msg", "닉네임을 적어 주세요.", true); return; }
    if (/[.#$/\[\]]/.test(nick)) {
      msg("adm-allow-msg", "닉네임에 . $ # [ ] / 는 쓸 수 없어요.", true); return;
    }
    try {
      await db.ref("config/allow/" + nick).set(true);
      const inp = el("adm-allow-nick"); if (inp) inp.value = "";
      await loadAllowList();
      msg("adm-allow-msg", `✅ ${nick} — 이제 들어올 수 있어요.`);
    } catch (e) {
      msg("adm-allow-msg", "저장하지 못했어요. " + (e.code || e.message || ""), true);
    }
  }

  async function delAllow(nick) {
    if (!nick) return;
    if (!confirm(`${nick} 님의 승인을 취소할까요?\n\n이미 쓰고 있는 분이면 **지금 쓰는 데는 지장이 없습니다** — ` +
                 `닉네임을 처음 만들 때만 보는 명단이라서요.\n완전히 막으려면 [내보내기] 를 쓰세요.`)) return;
    try {
      await db.ref("config/allow/" + nick).remove();
      await loadAllowList();
      msg("adm-allow-msg", `${nick} — 승인을 취소했어요.`);
    } catch (e) {
      msg("adm-allow-msg", "지우지 못했어요.", true);
    }
  }

  /* 지금 쓰이고 있는 닉네임을 통째로 승인 명단에 넣습니다.
     ★ 보안규칙을 올리기 **전에** 눌러야 합니다. 순서가 바뀌면 명단에
       없는 분이 새 기기에서 들어올 때 막힐 수 있어요. */
  async function seedAllow() {
    if (!confirm("지금 쓰이고 있는 닉네임을 전부 승인 명단에 넣을까요?\n(이미 있는 것은 그대로 둡니다)")) return;
    msg("adm-allow-msg", "넣는 중…");
    try {
      const owners = (await db.ref("nickOwner").once("value")).val() || {};
      const upd = {};
      Object.keys(owners).forEach(n => { upd[n] = true; });
      if (!Object.keys(upd).length) { msg("adm-allow-msg", "쓰이고 있는 닉네임이 없어요.", true); return; }
      await db.ref("config/allow").update(upd);
      await loadAllowList();
      msg("adm-allow-msg", `✅ ${Object.keys(upd).length}개 닉네임을 승인했어요.`);
    } catch (e) {
      msg("adm-allow-msg", "넣지 못했어요. " + (e.code || e.message || ""), true);
    }
  }

  async function loadBanList() {
    const box = el("adm-ban-list");
    if (!box) return;
    try {
      const v = (await db.ref("config/ban").once("value")).val() || {};
      const nicks = Object.keys(v).sort();
      box.innerHTML = nicks.length
        ? nicks.map(n => `
            <div class="adm-row">
              <span class="n">${escapeHtml(n)}</span>
              <button class="adm-btn ghost" data-ban-del="${escapeHtml(n)}">다시 들이기</button>
            </div>`).join("")
        : "내보낸 사람이 없어요.";
    } catch (e) {
      box.textContent = "불러오지 못했어요.";
    }
  }

  async function addBan(nickRaw) {
    const nick = String(nickRaw || "").trim();
    if (!nick) { msg("adm-ban-msg", "닉네임을 적어 주세요.", true); return; }
    if (!confirm(`${nick} 님을 내보낼까요?\n\n· 접속자 명단에서 곧바로 사라집니다\n` +
                 `· 채팅·수다방에 글을 쓸 수 없습니다\n· 다시 들어와도 아무것도 못 합니다\n\n` +
                 `기록은 지우지 않아요. 되돌릴 수 있습니다.`)) return;
    msg("adm-ban-msg", "내보내는 중…");
    try {
      /* ① 문을 먼저 잠급니다 — 잠그기 전에 지우면 그 사이에 다시 씁니다 */
      await db.ref("config/ban/" + nick).set(true);
      /* ② 승인 명단에서도 빼서, 닉네임을 새로 만드는 길도 막습니다 */
      await db.ref("config/allow/" + nick).remove();
      /* ③ 지금 떠 있는 접속 표시를 지웁니다 (방장은 남의 status 도 지울 수 있어요) */
      await db.ref("status/" + nick).remove();
      /* ④ 공유 중이던 화면도 함께 내립니다 */
      await db.ref("screens/" + nick).remove();

      const inp = el("adm-ban-nick"); if (inp) inp.value = "";
      await Promise.all([loadBanList(), loadAllowList()]);
      msg("adm-ban-msg", `🚫 ${nick} 님을 내보냈어요. 접속자 명단에서 사라집니다.`);
    } catch (e) {
      msg("adm-ban-msg", "내보내지 못했어요. " + (e.code || e.message || ""), true);
    }
  }

  async function delBan(nick) {
    if (!nick) return;
    if (!confirm(`${nick} 님을 다시 들일까요?`)) return;
    try {
      await db.ref("config/ban/" + nick).remove();
      await db.ref("config/allow/" + nick).set(true);
      await Promise.all([loadBanList(), loadAllowList()]);
      msg("adm-ban-msg", `${nick} 님을 다시 들였어요.`);
    } catch (e) {
      msg("adm-ban-msg", "풀지 못했어요.", true);
    }
  }

  // ------------------------------------------------- ③-2 공지
  // [철거 2026-08-14] 머리말 한줄 공지(config/notice) — 자리에 시계가
  // 앉으면서 함께 뺐습니다. 공지는 📢 공지판으로.

  // ------------------------------------------------- ③-2.5 채팅 핀 메시지
  /* script_chat.js 의 setPinnedMessage / removePinnedMessage 와 같은 노드 */
  async function loadPinnedMessage() {
    try {
      const v = (await db.ref("chatMeta/pinned").once("value")).val();
      const input = el("adm-pin-msg-input");
      if (input) input.value = v?.text || "";
    } catch (e) {}
  }
  async function savePinnedMessage() {
    const text = (el("adm-pin-msg-input")?.value || "").trim();
    try {
      if (text) await db.ref("chatMeta/pinned").set({ text, by: myNick, at: Date.now() });
      else await db.ref("chatMeta/pinned").remove();
      msg("adm-pin-msg-msg", text ? "📌 핀을 고정했어요." : "✅ 핀을 내렸어요.");
    } catch (e) {
      msg("adm-pin-msg-msg", "저장하지 못했어요. 연결을 확인해 주세요.", true);
    }
  }
  async function clearPinnedMessage() {
    if (!confirm("핀 메시지를 내릴까요?")) return;
    const input = el("adm-pin-msg-input");
    if (input) input.value = "";
    await savePinnedMessage();
  }

  // ------------------------------------------------- ③-3 채팅
  async function loadHistoryConfig() {
    try {
      const conf = (await db.ref("chatMeta/showHistory").once("value")).val() || {};
      const mode = conf.mode || (conf.enabled === false ? "off" : "on");
      const r = document.querySelector(`input[name="adm-hist"][value="${mode}"]`);
      if (r) r.checked = true;
      el("adm-hist-count").value = Math.max(10, Math.min(300, parseInt(conf.count ?? 100, 10) || 100));
    } catch (e) {}
  }
  /* script_realtime.js 의 applyHistoryConfig 와 같은 데이터 형태 */
  async function applyHistory() {
    const sel = document.querySelector('input[name="adm-hist"]:checked');
    const mode = sel ? sel.value : "on";
    const n = parseInt(el("adm-hist-count")?.value, 10);
    if (!Number.isFinite(n) || n < 10 || n > 300) {
      msg("adm-chat-msg", "표시 개수는 10~300 사이 숫자로 입력해 주세요.", true);
      return;
    }
    if (!confirm(`히스토리 설정을 적용할까요?\n모드: ${mode} · 표시 개수: ${n}개`)) return;
    try {
      await db.ref("chatMeta/showHistory").set({ mode, count: n, updatedBy: myNick || "admin", at: Date.now() });
      msg("adm-chat-msg", "✅ 히스토리 설정을 적용했어요.");
    } catch (e) {
      msg("adm-chat-msg", "적용하지 못했어요.", true);
    }
  }
  /* script_realtime.js 의 clearAllChat 과 같은 순서 */
  async function clearChat() {
    if (!ownerOnly("채팅 통째 삭제")) return;
    if (!confirm("정말 채팅을 모두 삭제할까요? (되돌릴 수 없어요!)")) return;
    try {
      const now = Date.now();
      await db.ref("chatMeta/clearedAt").set(now);
      await db.ref("messages").remove();
      await db.ref("messages").push({ type: "system", msg: "🧹 관리자가 채팅을 전체 삭제했습니다.", time: now });
      msg("adm-chat-msg", "🧹 채팅을 모두 삭제했어요.");
    } catch (e) {
      msg("adm-chat-msg", "삭제하지 못했어요.", true);
    }
  }
  async function clearChatty() {
    if (!ownerOnly("수다방 통째 삭제")) return;
    if (!confirm("정말 Chatty(수다방)를 모두 삭제할까요? (되돌릴 수 없어요!)")) return;
    try {
      await db.ref("messages2").remove();
      msg("adm-chat-msg", "☕ Chatty를 모두 삭제했어요.");
    } catch (e) {
      msg("adm-chat-msg", "삭제하지 못했어요.", true);
    }
  }

  // ------------------------------------------------- ③-3.6 🕘 출입 기록
  /* 하루치 입·퇴장을 일어난 순서대로 펼쳐 봅니다.

     [두 곳에서 끌어옵니다 — 정확도가 다릅니다]
       ① attendlog/{날짜}/{pushId} = { n:닉, t:시각, k:"in"|"out" }
          2026-08-07 부터 쌓이는 정밀 기록. 하루에 여러 번 들락거려도
          전부 남고, 창을 그냥 닫아도 서버가 대신 퇴장을 적어 줍니다.
       ② attendance/{날짜}/{닉} = { firstAt, at, leftAt? }
          예전부터 있던 하루 한 줄짜리 기록. 첫 입장과, [나가기] 를
          눌렀을 때의 퇴장만 있습니다.

     ①이 있는 날은 ①만 씁니다. 없는 날(=기능을 넣기 전 날짜)에만 ②로
     대신 그리고, 그 줄은 옅게(is-rough) 칠해 "이건 대략치"라고 알립니다.
     둘을 섞으면 같은 입장이 두 번 나와서 오히려 헷갈립니다. */
  let _logOffset = 0;   // 0 = 오늘, 1 = 어제 …

  function logDayKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return dayKey(d);
  }

  /* =====================================================================
     🔍 출석 칸 돋보기 (2026-08-12)
     ---------------------------------------------------------------------
     "밤 10시에 와서 12시 넘어 나갔는데 1시간 미만이래요" — 이 물음에
     추측 말고 **증거**로 답하려는 창구입니다. 칸을 누르면 그날의 실제
     구간(timeSegs)을 시간표로 보여줍니다.

     ★ 구간 사이 5분 넘게 빈 자리는 **끊김 줄**로 함께 보여줍니다.
       출석 도장·접속자 창은 느슨해서(30분 유예) 접속해 있는 듯 보여도,
       시간은 연결이 살아 있던 구간만 쌓입니다. 크롬이 탭을 재우면
       (메모리 절약 모드) 그 순간부터 비어요 — 접속유지 가이드가 막는
       것이 바로 이것입니다.
     ===================================================================== */
  const SEG_LABEL = { writing: "🔥 Write", focus: "💻 Job", multi: "📓 multiT",
                      rest: "☕ Break", away: "💤 Away" };

  /* ★★ [2026-08-28] 한 칸에 손가락 둘 — 단일 클릭은 돋보기, 더블은 휴가.
     ---------------------------------------------------------------------
     ★ 그냥 두 리스너를 나란히 달면 **더블 클릭 때 돋보기가 먼저 뜹니다**
       (더블은 click 을 두 번 흘리니까요). 그래서 돋보기를 DBL_MS 만큼
       미뤄 두고, 그 사이 dblclick 이 오면 취소합니다.
     ★ 방(나의 작업)의 출석 달력이 쓰는 것과 **같은 손가락**입니다
       (script_mywork.js 의 onClick/onDblClick) — 방장이 두 곳에서 다른
       손놀림을 외울 이유가 없어서요. */
  const DBL_MS = 280;
  let _digTimer = null;

  function bindDig(host) {
    if (host.dataset.digBound === "true") return;
    host.dataset.digBound = "true";
    host.addEventListener("click", (e) => {
      const td = e.target.closest("[data-dig-nick]");
      if (!td) return;
      const nick = td.dataset.digNick, day = td.dataset.digDay;
      clearTimeout(_digTimer);
      _digTimer = setTimeout(() => { openDig(nick, day); }, DBL_MS);
    });
    host.addEventListener("dblclick", async (e) => {
      const td = e.target.closest("[data-leave-nick]");
      if (!td) return;
      clearTimeout(_digTimer);              // 돋보기가 뜨려던 것을 거둡니다
      await toggleLeaveAdmin(td.dataset.leaveNick, td.dataset.leaveDay);
    });
  }

  /* =====================================================================
     🌿 방장이 남의 **개인사정(병가)** 을 켜고 끄기
        (2026-08-28 🏖️ 휴가로 시작 → 2026-08-30 개인사정으로 바꿈 — 콩)
     ---------------------------------------------------------------------
     [왜 바꿨나] 휴가(🏖️)는 **본인이** 🗂️ 나의 작업 달력에서 찍는 것이고,
     한 달 상한이 있습니다. 방장이 대신 찍어 줄 일은 사실 드물었어요.
     정작 필요한 건 다른 것이었습니다 — 아파서, 상을 당해서, 사정이 생겨서
     **길게 쉬는** 경우. 이건 휴가 상한 7일 안에 절대 안 들어갑니다.

     그래서 방장의 더블 클릭은 이제 🌿 개인사정을 찍습니다.
       🏖️ 휴가     본인이 찍음 · 상한 있음 · users/{닉}/vacations
       🌿 개인사정  방장이 찍음 · 상한 없음 · users/{닉}/leaves

     [출석률은 어떻게 되나 — 콩 결정, 2026-08-30]
       ① 기준(need)을 깎습니다. 쉰 날은 나올 수 없었던 날이니까요.
          휴가와 같은 자리에 얹어 넣습니다(ruleOf 식은 안 건드립니다 —
          script_mywork.js 와 글자까지 같아야 하는 약속).
       ② 🏅 출석률 **순위에서 뺍니다**. 하루라도 개인사정이 있으면요.
          기준이 3일까지 내려간 사람이 3일 나와 100%로 1등을 하면,
          그건 격려가 아니라 조롱에 가깝습니다. 대신 순위 아래에
          "🌿 사정으로 쉬는 중" 한 줄로 조용히 적습니다.
       ③ 개근 명단(honors)에서도 뺍니다 — 같은 이유예요.

     ★★ 상한 확인창은 없습니다. 개인사정에는 상한이 없어서요.
     ★ 운영진은 못 합니다 — users 쓰기는 방장 전용(보안규칙).
       그래서 ownerOnly 로 막고, 칸에 data-leave-* 자체를 안 답니다.
     ★ 하루가 바뀌면 기준·남은 날·입장일·순위·명단이 줄줄이 달라집니다.
       그래서 화면을 손으로 고치지 않고 표를 통째로 다시 그립니다.
     ===================================================================== */
  async function toggleLeaveAdmin(nick, dk) {
    if (!ownerOnly("남의 개인사정을 고치는 것")) return;
    try {
      const ref = db.ref(`users/${nick}/leaves/${dk}`);
      /* 화면 값이 아니라 **서버 값**을 보고 켤지 끌지 정합니다 —
         표를 그린 뒤에 다른 창에서 바뀌었을 수 있어요. */
      const 지금 = (await ref.once("value")).val() === true;

      /* 고치기 **전** 값을 손에 쥐고 갑니다 — 다시 그리고 나면 사라져요.
         이게 있어야 `기준 18→9일` 처럼 **달라진 것**을 말할 수 있습니다. */
      const 전 = _순위셈[nick] || null;

      if (!지금) await ref.set(true);
      else await ref.remove();

      await loadAttendance(_attOffset);
      msg("adm-att-msg", 개인사정한줄({ nick, dk, 뺀건가: 지금, 전, 후: _순위셈[nick] || null }));
    } catch (e) {
      console.warn("[adm toggleLeaveAdmin]", e);
      msg("adm-att-msg", "개인사정을 못 고쳤어요 — 방장 계정인지, 보안규칙에 users/{닉}/leaves 가 있는지 확인해 주세요.", true);
    }
  }

  /* =====================================================================
     🌿 찍은 뒤 한 줄 (2026-08-30 — 콩이 형식을 잡아 줌)
     ---------------------------------------------------------------------
     [왜 고쳤나] 원래는 **아무 때나 똑같이** "이 달 출석률 순위에서는
     빠집니다" 라고 했습니다. 그런데 그건:
       · 할인 전 기준을 채운 사람에게는 **거짓말**이고 (안 빠집니다)
       · 앞달에 찍었을 때도 **거짓말**입니다 (순위 자체가 아직 없어요)
     콩이 잡아 준 형식 — 슬래시로 칸을 나눠서 눈이 안 헤매게:

       🌿 시엘 · 09-12 / 6일 간 개인사정 / 기준 18→17일 / 순위 유지

     네 칸의 뜻: ① 누구를 언제  ② 이 달 통틀어 며칠  ③ 몫이 얼마나
     가벼워졌나  ④ 그래서 순위는. ★ 방장이 정말 궁금한 것은 방금 찍은
     하루가 아니라 "이 사람 이번 달 얼마나 쉬는 거지" 와 "몫이 얼마나
     내려갔지" 라서, 둘을 가운데에 뒀습니다.
     ★ 재료는 전부 표가 이미 센 값(_순위셈) — 서버를 한 번도 더 안 읽어요.
     ===================================================================== */
  function 개인사정한줄({ nick, dk, 뺀건가, 전, 후 }) {
    const 날 = String(dk).slice(5);                 // 2026-09-12 → 09-12
    const 칸 = [`${뺀건가 ? "↩️" : "🌿"} ${nick} · ${날}${뺀건가 ? " 뺌" : ""}`];

    /* ② 이 달 통틀어 며칠 — 0일이면 "없음" 으로 끝냅니다 */
    const 쉰날 = 후 ? 후.쉰날 : 0;
    칸.push(쉰날 > 0 ? `${쉰날}일 간 개인사정` : "개인사정 없음");

    /* ③ 기준 — 안 달라졌으면 화살표 없이 하나만 */
    if (후) {
      칸.push(전 && 전.기준 !== 후.기준
        ? `기준 ${전.기준}→${후.기준}일`
        : `기준 ${후.기준}일`);
    }

    /* ④ 순위 — 개인사정이 하나도 없으면 할 말이 없습니다 */
    if (쉰날 > 0) {
      if (_attOffset < 0) {
        /* 앞달: 순위가 안 보이는 게 고장이 아니라 아직 안 온 달이라서 */
        const b = new Date(); b.setDate(1); b.setMonth(b.getMonth() - _attOffset);
        칸.push(`순위는 ${b.getMonth() + 1}월에`);
      } else if (후) {
        칸.push(후.out ? "순위 제외" : "순위 유지");
      }
    }
    return 칸.join(" / ");
  }

  async function openDig(nick, dk) {
    document.getElementById("adm-dig")?.remove();
    const wrap = document.createElement("div");
    wrap.id = "adm-dig";
    wrap.innerHTML = `<div class="adm-dig-card"><div class="adm-msg">불러오는 중…</div></div>`;
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
    document.body.appendChild(wrap);

    let segs = [];
    try {
      const v = (await db.ref(`users/${nick}/timeSegs/${dk}`).once("value")).val() || {};
      segs = Object.values(v).filter(s => s && s.b > s.a);
      /* 같은 구간이 두 번 적힌 흉터 — 같은 상태·같은 시작이면 중복.
         끝은 몇 초 어긋나 있으니 긴 쪽만 남깁니다 (합계와 같은 규칙) */
      const best = {};
      segs.forEach(s => {
        const k = `${s.s}|${s.a}`;
        if (!best[k] || s.b > best[k].b) best[k] = s;
      });
      segs = Object.values(best).sort((x, y) => x.a - y.a);
    } catch (e) {}

    const GAP_MS = 5 * 60 * 1000;
    let total = 0, rows = "", prevEnd = 0;
    segs.forEach(s => {
      /* 앞 구간과의 빈 자리 — 여기가 "시간이 사라진" 자리입니다 */
      if (prevEnd && s.a - prevEnd >= GAP_MS) {
        rows += `<div class="adm-dig-gap">⚠ ${hhmm(prevEnd)} ~ ${hhmm(s.a)}
                 <b>${stayText(s.a - prevEnd)} 끊김</b> — 탭이 잠들었거나 컴퓨터가 꺼져 있던 시간</div>`;
      }
      total += s.b - s.a;
      rows += `<div class="adm-dig-row"><span>${SEG_LABEL[s.s] || s.s}</span>
               <span>${hhmm(s.a)} ~ ${hhmm(s.b)}</span><b>${stayText(s.b - s.a) || "1분 미만"}</b></div>`;
      prevEnd = s.b;
    });

    wrap.querySelector(".adm-dig-card").innerHTML = `
      <div class="adm-dig-head"><b>${nick}</b> · ${dk}
        <button type="button" class="adm-dig-x" onclick="this.closest('#adm-dig').remove()">✕</button></div>
      ${rows || `<div class="adm-msg">이 날 기록된 구간이 없어요 — 출석 도장만 찍히고
                 연결이 바로 끊긴 경우예요.</div>`}
      <div class="adm-dig-sum">쌓인 시간 <b>${stayText(total) || "0분"}</b>
        <span style="font-weight:400; opacity:.7;">— 상태를 안 가린 자리 지킨 시간이에요</span></div>
      <div class="adm-dig-hint">출석 도장·접속자 창은 느슨하지만(30분 유예), 시간은
        <b>연결이 살아 있던 구간</b>만 쌓여요. 끊김이 자주 보이면 그분께
        <b>접속 유지 가이드</b>(크롬 탭 안 재우기)를 안내해 주세요.</div>`;
  }

  function stayText(ms) {
    const m = Math.round(ms / 60000);
    if (m < 1) return "";
    if (m < 60) return `${m}분`;
    const h = Math.floor(m / 60);
    return `${h}시간${m % 60 ? " " + (m % 60) + "분" : ""}`;
  }

  /* 사건 목록 → 화면. 머문 시간은 같은 사람의 in 과 그 뒤 첫 out 을 짝지어 냅니다. */
  function logRowsHtml(events, rough) {
    if (!events.length) {
      return `<div class="adm-msg">이 날은 기록이 없어요.</div>`;
    }
    events.sort((a, b) => a.t - b.t);

    /* 짝짓기 — 같은 닉의 in 을 담아 뒀다가 out 이 오면 꺼내 씁니다 */
    const open = {};
    events.forEach(e => {
      if (e.k === "in") { (open[e.n] = open[e.n] || []).push(e); return; }
      const q = open[e.n];
      if (q && q.length) {
        const start = q.shift();
        e.stay = e.t - start.t;
      }
    });

    const rows = events.map(e => {
      const isIn = e.k === "in";
      return `<div class="adm-log-row${rough ? " is-rough" : ""}">
        <span class="adm-log-t">${hhmm(e.t)}</span>
        <span class="adm-log-k ${isIn ? "in" : "out"}">${isIn ? "→" : "←"}</span>
        <span class="adm-log-n">${escapeHtml(e.n)}</span>
        <span class="adm-log-stay">${isIn ? "" : (e.stay ? stayText(e.stay) + " 머묾" : "")}</span>
      </div>`;
    }).join("");

    const people = new Set(events.map(e => e.n));
    const ins = events.filter(e => e.k === "in").length;
    const outs = events.length - ins;
    return `<div class="adm-log-sum">${people.size}명 · 입장 ${ins}회 · 퇴장 ${outs}회</div>` + rows;
  }

  async function loadAttendLog(offset) {
    _logOffset = Math.max(0, offset);
    const day = logDayKey(_logOffset);
    const body = el("adm-log-body");
    const note = el("adm-log-note");
    const label = el("adm-log-day");
    if (label) label.textContent = day + (_logOffset === 0 ? " (오늘)" : "");
    const nextBtn = el("adm-log-next");
    if (nextBtn) nextBtn.disabled = (_logOffset === 0);
    if (body) body.innerHTML = `<div class="adm-msg">불러오는 중…</div>`;

    try {
      const snap = await db.ref(`attendlog/${day}`).once("value");
      const raw = snap.val() || {};
      const events = Object.values(raw)
        .filter(v => v && v.n && v.t && (v.k === "in" || v.k === "out"))
        .map(v => ({ n: String(v.n), t: Number(v.t), k: v.k }));

      if (events.length) {
        if (body) body.innerHTML = logRowsHtml(events, false);
        if (note) note.textContent =
          "입장 기록이에요 — 3시간 안에 다시 들어온 것은 안 적힙니다 (2026-08-14부터). "
          + "언제까지 있었는지는 출석부의 칸을 눌러(돋보기) 봅니다.";
        return;
      }

      /* 정밀 기록이 없는 날 — 옛 출석 기록으로 대략만 그립니다 */
      const aSnap = await db.ref(`attendance/${day}`).once("value");
      const att = aSnap.val() || {};
      const rough = [];
      Object.entries(att).forEach(([nick, v]) => {
        const inAt = Number(v?.firstAt || v?.at || 0);
        if (inAt) rough.push({ n: nick, t: inAt, k: "in" });
        const outAt = Number(v?.leftAt || 0);
        if (outAt) rough.push({ n: nick, t: outAt, k: "out" });
      });

      if (body) body.innerHTML = logRowsHtml(rough, true);
      if (note) note.textContent = rough.length
        ? "옛 기록이라 대략치예요 — 하루의 첫 입장과, [나가기] 를 누른 퇴장만 있습니다."
        : "";
    } catch (e) {
      console.warn("[adm attendlog]", e);
      if (body) body.innerHTML =
        `<div class="adm-msg">불러오지 못했어요. Firebase 콘솔에 새 보안규칙(attendlog)을 게시했는지 확인해 주세요.</div>`;
      if (note) note.textContent = "";
    }
  }

  function openAttendLog() {
    el("adm-log-modal")?.removeAttribute("hidden");
    loadAttendLog(0);
  }
  function closeAttendLog() {
    el("adm-log-modal")?.setAttribute("hidden", "");
  }

  // ------------------------------------------------- ③-3.8 👥 접속자 명단 미리보기
  /* 지금 접속자 카드를 **새 배치**로 그려 봅니다.

     [무엇이 달라지나]
       지금  : 프사가 위, 상태표가 그 옆, 이름·목표·시간이 아래 한 덩어리
       새 것 : 왼쪽에 프사 + 상태표, 오른쪽에 닉네임 박스(이름·목표·시간)

     [작업방에는 영향이 없습니다]
     styles.css 와 새 배치용 CSS 를 모두 **그림자 뿌리 안**에 넣습니다.
     스타일이 그 안에만 머물러서, 관리자 화면도 작업방도 그대로예요.
     마음에 안 들면 이 함수와 카드를 지우면 끝입니다. */
  const CARD_PREVIEW_CSS = `
    :host { all: initial; }
    .wrap{
      display: grid;
      /* [넓힘 2026-08-09] 오른쪽 닉네임 박스가 **지금 작업방의 닉네임
         박스와 같은 폭**(약 216px)이 되도록 카드를 늘렸습니다.
         96(프사) + 10(사이) + 216(닉네임 박스) + 16(카드 안쪽 여백) ≈ 338 */
      grid-template-columns: repeat(auto-fill, minmax(338px, 1fr));
      gap: 14px;
      padding: 4px 2px 2px;
      font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    }
    /* ── 새 배치 ── 왼쪽 프사+상태, 오른쪽 닉네임 박스 */
    .user-card.side-lay{ display: flex; flex-direction: column; }
    .user-card.side-lay .card-body{
      display: grid;
      grid-template-columns: 96px minmax(216px, 1fr);
      gap: 10px;
      align-items: start;
    }
    .user-card.side-lay .card-avatar-wrap{ width: 100%; max-width: none; }
    .user-card.side-lay .card-state-row{ justify-content: center; margin-top: 6px; }
    .user-card.side-lay .card-state-ghost{ display: none; }
    /* 오른쪽 — 닉네임 박스가 아래로 내려가지 않고 프사 옆에 섭니다 */
    .user-card.side-lay .card-foot{
      margin: 0;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-height: 100%;
    }
    .user-card.side-lay .card-name{ justify-content: flex-start; }
    .user-card.side-lay .card-goal .goal-line{ text-align: left; }
    .user-card.side-lay .card-meta{ margin-top: auto; }
    .empty{ padding: 20px 4px; color: #6B5F52; font-size: 13.5px; }
  `;

  const ST_LABEL = { idle:"☕BREAK☕", writing:"🔥WRITE🔥", focus:"💻JOB💻",
                     multi:"💻multiT📓", rest:"☕BREAK☕", away:"💤AWAY💤" };
  const ST_CLASS = { writing:"writing", focus:"focus", multi:"multi", rest:"rest", away:"away" };

  /* 닉네임으로 눈사람 배경색을 만듭니다 (작업방 script_profile.js 와 같은 방식) */
  function snowBg(nick) {
    let h = 0;
    for (const ch of String(nick)) h = (h * 31 + ch.codePointAt(0)) % 360;
    return `hsl(${h} 52% 72%)`;
  }

  function fmtWork(ms) {
    const m = Math.round(Math.max(0, Number(ms) || 0) / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  }

  /* [철거 2026-08-14] 접속자 명단 미리보기(previewCardHtml·openMemberPreview·
     closeMemberPreview) — 그 카드 자리를 ✨ 성실 멤버가 물려받으며 걷었습니다. */

  // ------------------------------------------------- ③-3.9 ✨ 성실 멤버
  /* 최근 7일 출석부(attendance)와 작업시간(timeSegs)으로 자동 선정.
     기준(콩): 출석 5일 이상 + 하루 5시간 넘게 작업한 날 3일 이상.
       · "작업"은 카드의 작업시간과 같은 셈 — WRITE 전액 + JOB·multiT 70%
       · 휴가일은 출석에 안 들어갑니다 (출석부에 입장 기록이 없으니 저절로)
       · 중복 구간 흉터는 돋보기와 같은 규칙으로 걸러 셉니다
     읽기량: 출석부 7번 + 후보×출석일 만큼의 timeSegs — 방장 페이지에서
     단추를 눌렀을 때만 도니 부담 없습니다. */
  /* =====================================================================
     ⏱ 작업 시간 무게 — ★★★ script_timelog.js 의 WORK_WEIGHT 와 **같아야** 합니다
     ---------------------------------------------------------------------
     관리자 페이지(admin.html)는 script_timelog.js 를 싣지 않습니다. 그래서
     어쩔 수 없이 표를 한 벌 더 둡니다 — ADMIN_NICK·ADMIN_PIN 이 두 파일에
     들어 있는 것과 같은 사정이에요.

     ★ 대신 checks.js 가 **두 표를 직접 견줘서** 다르면 실패합니다.
       한쪽만 고치면 방에서 본 숫자와 성실 멤버 기준이 조용히 어긋나요.
     ===================================================================== */
  const WORK_WEIGHT = { writing: 1, focus: 0.7, multi: 0.7 };
  function 작업ms(status, ms) {
    const w = WORK_WEIGHT[status] || 0;
    return w ? Math.round((Number(ms) || 0) * w) : 0;
  }

  const DIL_DAYS = 7;
  const DIL_NEED_ATT = 5;        // 출석 5일 이상
  const DIL_NEED_5H = 3;         // 5시간 넘게 일한 날 3일 이상
  const DIL_5H_MS = 5 * 60 * 60 * 1000;

  function dilDayKeys() {
    const out = [];
    for (let i = 0; i < DIL_DAYS; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      out.push(dayKey(d));
    }
    return out;
  }

  async function workMsOf(nick, dk) {
    try {
      const v = (await db.ref(`users/${nick}/timeSegs/${dk}`).once("value")).val() || {};
      const best = {};
      Object.values(v).filter(s => s && s.b > s.a).forEach(s => {
        const k = `${s.s}|${s.a}`;
        if (!best[k] || s.b > best[k].b) best[k] = s;
      });
      let ms = 0;
      Object.values(best).forEach(s => { ms += 작업ms(s.s, s.b - s.a); });
      return ms;
    } catch (e) { return 0; }
  }

  /* =====================================================================
     📊 사용 현황 (2026-08-23 — 콩)
     ---------------------------------------------------------------------
     [무엇을 묻는 것인가]
     "어떤 걸 많이 쓰고 어떤 걸 아무도 안 쓰는지. 누가 뭘 쓰는지가 아니라
      전체 통계. 아무도 안 쓰는 기능을 유지할 이유는 없으니까."
     그래서 **적게 쓰는 것이 위로** 옵니다 — 찾으려는 게 그것이니까요.

     ★★★ [방 코드는 한 줄도 안 건드립니다]
     새로 기록을 남기기 시작하면 그날부터 세는 셈이라 지금은 아무 답도
     안 나옵니다. 대신 **이미 서버에 쌓여 있는 흔적**만 읽어요. 덕분에
     멤버 쪽에서 달라지는 것이 하나도 없고, 이 단추를 안 누르면 통신량도 0.

     ★★★ [읽으면 안 되는 것 — 돈이 됩니다]
     2026-08-22 에 Blaze 로 바뀌어 무료치를 넘으면 **잠기는 게 아니라
     청구**됩니다. 그래서 큰 노드는 일부러 피합니다.
       · messages / messages2  ← 채팅 전체. 대신 achv 의 cChat 을 씁니다
       · wordlog / wordfeed    ← 이미 위 그래프가 보여 줍니다
       · users/{닉} 통째로     ← 안에 timeSegs 가 들어 있어 무겁습니다.
                                 **작은 자식만 골라** 읽어요 (아래 잔가지).
     작은 것을 여러 번 읽는 건 괜찮습니다 — RTDB 요금은 **주고받은 바이트**
     이지 요청 횟수가 아니라서요.

     ★ [못 세는 것은 못 센다고 적습니다]
       · 판 여닫기·방 배경·접속 유지·카드 정렬·확대축소 → 각자 브라우저에만
       · 대숲·표현 공부·품평 → 익명이라 글 수만 (그게 이 기능들이 굴러가는 조건)
       · 📮 쪽지 → 보안규칙이 주인에게만 열려 있어 방장도 못 읽음
     ===================================================================== */

  /** 큰 노드를 건드리지 않고 통째로 읽어도 되는 것들 */
  async function 통째로(경로) {
    try { return (await db.ref(경로).once("value")).val() || {}; }
    catch (e) { return null; }              // null = 못 읽음 (권한·오류)
  }

  /** users/{닉} 아래 **작은 잔가지 하나**만 (timeSegs 를 안 끌고 오려고) */
  async function 잔가지(닉, 가지) {
    try { return (await db.ref(`users/${닉}/${가지}`).once("value")).val(); }
    catch (e) { return null; }
  }

  async function runUsage() {
    const box = el("adm-usage");
    if (!box) return;
    box.innerHTML = `<div class="adm-msg">훑는 중…</div>`;
    msg("adm-usage-msg", "");

    try {
      /* ── ① 통째로 읽어도 되는 것 (요청 여덟 번) ── */
      const [ownerMap, achv, music, files, forest, help, pubs, pubrev] =
        await Promise.all([
          통째로("nickOwner"), 통째로("achv"), 통째로("music"), 통째로("files"),
          통째로("forest"), 통째로("help"), 통째로("pubs"), 통째로("pubreview")
        ]);
      const 명단 = Object.keys(ownerMap || {});
      const 총원 = 명단.length;
      if (!총원) { box.innerHTML = `<div class="adm-msg">명단을 못 읽었어요.</div>`; return; }

      /* ── ② 잔가지 — 닉마다 작은 것만 골라서 ── */
      const 잔 = {};
      await Promise.all(명단.map(async n => {
        const [prof, prefs, idle, start, pomoP, mine] = await Promise.all([
          잔가지(n, "profile"), 잔가지(n, "prefs"), 잔가지(n, "idleDetect"),
          잔가지(n, "startStatus"), 잔가지(n, "pomoParticipation"), 잔가지(n, "musicMine")
        ]);
        잔[n] = { prof: prof || {}, prefs: prefs || {}, idle, start, pomoP, mine: mine || {} };
      }));

      /* ── ③ 세기 ── */
      const 셈 = (거르개) => 명단.filter(거르개).length;
      const c = (n, k) => Number((achv?.[n]?.c || {})[k] || 0);
      /* achv 의 c 에는 `cha_2026-08-20` 처럼 **날짜별 열쇠**로 쌓이는 것이
         있습니다 — 접두어로 세면 "며칠 썼나" 가 나옵니다 */
      const 접두 = (n, pre) => Object.keys(achv?.[n]?.c || {})
        .filter(k => k.indexOf(pre) === 0).length;

      const 꾸밈칸 = ["photo", "cardBg", "cardPattern", "nickColor", "snowBg", "shareImg"];

      const 줄 = [
        /* [이름, 쓴 사람 수, 곁말] */
        /* ✍️ 글자수는 계량기가 따로 없습니다. 대신 **글자수 업적을 하나라도
           땄나**로 봅니다 — 첫 배지가 "하루 1,000자" 라 한 번이라도 제대로
           적은 사람은 잡히고, 이건 지난 기록까지 소급돼요. */
        ["✍️ Work Log 글자수", 셈(n => Object.keys(achv?.[n]?.got || {}).some(g => g.indexOf("wc") === 0)), "글자수 배지를 하나라도"],
        ["💬 Chat", 셈(n => c(n, "cChat") > 0), "8/11부터 센 것"],
        ["📌 할 일 완료", 셈(n => c(n, "cTodo") > 0), "8/11부터"],
        ["☕ 수다방", 셈(n => 접두(n, "cha_") > 0), "참여한 날이 하루라도"],
        ["🎋 대숲 글쓰기", 셈(n => c(n, "cForest") > 0), "익명이지만 업적이 셉니다"],
        ["🖥 화면 공유", 셈(n => 접두(n, "shr_") > 0), "하루 2시간 넘긴 날만 잡힘"],
        ["😊 감정 스티커", 셈(n => c(n, "cGreet") + c(n, "cPat") + c(n, "cCheer") > 0), ""],
        ["🏷 카드 스티커", 셈(n => 접두(n, "stk_") > 0), ""],
        ["🔖 작업 스티커", 셈(n => 접두(n, "tag_") > 0), ""],
        ["📝 퇴고·수정 딱지", 셈(n => 접두(n, "rew_") + 접두(n, "rev_") > 0), ""],
        ["👤 프로필 꾸미기", 셈(n => 꾸밈칸.some(k => 잔[n].prof[k])), "하나라도 만졌으면"],
        ["🖼 프사 올리기", 셈(n => !!잔[n].prof.photo), ""],
        ["🎨 카드 색·무늬", 셈(n => !!(잔[n].prof.cardBg || 잔[n].prof.cardPattern)), ""],
        ["🎨 테마 바꾸기", 셈(n => !!잔[n].prefs.themeName), "기본 테마면 안 잡힘"],
        ["🎯 목표 시간 정하기", 셈(n => Number(잔[n].prefs.goalHours) > 0), ""],
        ["🖱 자리비움 자동감지", 셈(n => 잔[n].idle?.enabled === true), "크롬·엣지만 됨"],
        ["🚪 들어올 때 상태 고르기", 셈(n => !!잔[n].start), "8/23에 생긴 것"],
        ["🍅 뽀모 참가", 셈(n => 잔[n].pomoP?.participating === true), ""],
        ["♪ 나의 BGM 리스트", 셈(n => Object.keys(잔[n].mine).length > 0), ""],
        ["♪ BGM 추천 올리기", 새사람수(music, "nick"), "곡 " + 개수(music) + "개"],
        ["📁 자료실 올리기", 새사람수(files, "by"), "파일 " + 개수(files) + "개"],
      ];

      /* 익명이라 사람 수를 못 세는 것 — 개수만 */
      const 익명줄 = [
        ["🎋 대숲", 개수(forest), "쪽지"],
        ["📓 표현 공부", 개수(help), "글"],
        ["🏢 출판사 품평", 개수(pubs), "명패"],
        ["🏢 품평 글", 품평수(pubrev), "품평"],
      ];

      /* ── ④ 그리기 — 적은 것이 위로 ── */
      줄.sort((a, b) => a[1] - b[1]);
      const 칸 = (이름, 명, 곁) => {
        const p = 총원 ? Math.round(명 / 총원 * 100) : 0;
        const 빛 = 명 === 0 ? "bad" : (p < 25 ? "maybe" : "ok");
        return `<div class="adm-use-row">
          <span class="adm-use-n">${escapeHtml(이름)}</span>
          <span class="adm-use-bar"><i class="${빛}" style="width:${Math.max(p, 명 ? 3 : 0)}%"></i></span>
          <span class="adm-use-v ${빛}">${명}명 <small>${p}%</small></span>
          <span class="adm-use-c">${escapeHtml(곁 || "")}</span>
        </div>`;
      };
      const 안쓰는것 = 줄.filter(r => r[1] === 0);

      box.innerHTML = `
        <p class="adm-use-head">멤버 <b>${총원}명</b> 가운데 몇 명이 쓰고 있나</p>
        ${안쓰는것.length ? `<p class="adm-use-warn">🕳 <b>아무도 안 쓰는 것 ${안쓰는것.length}가지</b> — ${
          안쓰는것.map(r => escapeHtml(r[0])).join(" · ")}</p>` : ""}
        ${줄.map(r => 칸(r[0], r[1], r[2])).join("")}
        <p class="adm-use-head" style="margin-top:14px;">익명이라 <b>사람 수는 못 세는 것</b> — 글 수만</p>
        ${익명줄.map(([이름, n, 단위]) =>
          `<div class="adm-use-row"><span class="adm-use-n">${escapeHtml(이름)}</span>
             <span class="adm-use-v ${n ? "ok" : "bad"}">${n}${escapeHtml(단위)}</span>
             <span class="adm-use-c"></span></div>`).join("")}
        <p class="adm-use-foot">
          ★ <b>여기 안 나오는 것</b>은 서버에 흔적이 없어서예요 —
          판 여닫기·🖼방 배경·🔌접속 유지·🎲카드 정렬·🔍확대축소·채팅 글자 크기는
          각자 브라우저에만 남습니다. 📮쪽지는 보안규칙이 주인에게만 열려 있어 방장도 못 읽어요.<br>
          ★ 업적으로 세는 줄(💬Chat·📌할 일·🎋대숲·😊스티커·🖥공유)은
          <b>2026-08-11부터</b>라 그 전에 쓴 것은 안 잡힙니다.
        </p>`;
      msg("adm-usage-msg", `${총원}명을 훑었어요.`);
    } catch (e) {
      console.warn("[adm usage]", e);
      box.innerHTML = `<div class="adm-msg">불러오지 못했어요.</div>`;
    }
  }

  /** 목록에서 서로 다른 사람이 몇 명인가 (닉이 든 칸 이름을 알려주세요) */
  function 새사람수(뭉치, 칸) {
    if (!뭉치) return 0;
    const s = new Set();
    Object.values(뭉치).forEach(v => { const n = v && v[칸]; if (n) s.add(String(n)); });
    return s.size;
  }
  function 개수(뭉치) { return 뭉치 ? Object.keys(뭉치).length : 0; }
  /** pubreview 는 {명패: {품평id: …}} 라 두 겹입니다 */
  function 품평수(뭉치) {
    if (!뭉치) return 0;
    let n = 0;
    Object.values(뭉치).forEach(v => { n += Object.keys(v || {}).length; });
    return n;
  }

  async function runDiligent() {
    const box = el("adm-diligent");
    if (!box) return;
    box.innerHTML = `<div class="adm-msg">최근 ${DIL_DAYS}일을 세는 중…</div>`;
    msg("adm-diligent-msg", "");
    try {
      const days = dilDayKeys();
      /* 날짜별 출석부 — 누가 어느 날 나왔나 */
      const attByNick = {};
      await Promise.all(days.map(async dk => {
        const v = (await db.ref(`attendance/${dk}`).once("value")).val() || {};
        Object.keys(v).forEach(n => { (attByNick[n] = attByNick[n] || []).push(dk); });
      }));

      const rows = [];
      await Promise.all(Object.entries(attByNick).map(async ([n, dks]) => {
        const msArr = await Promise.all(dks.map(dk => workMsOf(n, dk)));
        const total = msArr.reduce((a, b) => a + b, 0);
        const d5 = msArr.filter(x => x >= DIL_5H_MS).length;
        rows.push({ n, att: dks.length, d5, total });
      }));

      const pass = rows.filter(r => r.att >= DIL_NEED_ATT && r.d5 >= DIL_NEED_5H)
        .sort((a, b) => b.d5 - a.d5 || b.att - a.att || b.total - a.total);
      const near = rows.filter(r => !pass.includes(r) && (r.att >= DIL_NEED_ATT - 1 || r.d5 >= DIL_NEED_5H - 1))
        .sort((a, b) => b.d5 - a.d5 || b.att - a.att).slice(0, 3);

      const medal = (i) => ["🥇", "🥈", "🥉"][i] || "✨";
      const hh = (ms) => {
        const m = Math.round(ms / 60000), h = Math.floor(m / 60);
        return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
      };
      box.innerHTML = (pass.length
        ? pass.map((r, i) => `
          <div class="adm-row">
            <span>${medal(i)}</span><span class="n">${escapeHtml(r.n)}</span>
            <span class="s">출석 ${r.att}일 · 5h+ <b>${r.d5}일</b> · 총 ${hh(r.total)}</span>
          </div>`).join("")
        : `<div class="adm-msg">이번 주는 기준을 넘긴 멤버가 없어요.</div>`)
        + (near.length
          ? `<div class="adm-vac-dates" style="margin-top:8px;">아깝게 놓침 — ${
              near.map(r => `${escapeHtml(r.n)} (출석 ${r.att}·5h+ ${r.d5})`).join(" · ")}</div>`
          : "");
      msg("adm-diligent-msg", `${rows.length}명을 살펴 ${pass.length}명을 뽑았어요.`);
    } catch (e) {
      console.warn("[adm diligent]", e);
      box.innerHTML = `<div class="adm-msg">세지 못했어요. 연결을 확인해 주세요.</div>`;
    }
  }

  // ------------------------------------------------- ③-4 글자수
  /* script_realtime.js 의 clearAllWordcount 와 같은 노드를 지웁니다 */
  async function clearWordcount() {
    if (!ownerOnly("오늘 글자수 초기화")) return;
    if (!confirm("오늘의 글자수 기록을 초기화할까요?\n모두의 오늘 기록·말풍선이 지워집니다. (되돌릴 수 없어요!)")) return;
    const day = dayKey(new Date());
    try {
      await db.ref(`wordfeed/${day}`).remove();
      await db.ref(`wordlog/${day}`).remove();
      msg("adm-wc-msg", "🧹 오늘 글자수 기록을 초기화했어요.");
    } catch (e) {
      msg("adm-wc-msg", "초기화하지 못했어요 — 보안규칙을 확인해 주세요.", true);
    }
  }

  // ------------------------------------------------- ③-5 🎋 대숲 (익명 게시판)
  /* 데이터 구조 — script_forest.js 와 동일:
       forest/{자동키} = { text, color, x, y, rot, at, hearts }

     ★ 글쓴이 정보가 **아예 없습니다.** 관리자도 누가 썼는지 알 수
       없어요. 그것이 이 기능의 목적이라 여기서도 굳이 캐지 않습니다.
       내용 앞부분과 붙인 시각만 보고 지웁니다. */
  const FOREST_KEEP_MS = 30 * 24 * 60 * 60 * 1000;   // 30일

  function forestWhen(at) {
    const t = Number(at) || 0;
    if (!t) return "?";
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  async function loadForest() {
    const box = el("adm-forest-list");
    const cnt = el("adm-forest-count");
    if (box) box.textContent = "불러오는 중…";
    try {
      const raw = (await db.ref("forest").once("value")).val() || {};
      const rows = Object.keys(raw)
        .map(id => ({ id, ...(raw[id] || {}) }))
        .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));

      if (cnt) cnt.textContent = `쪽지 ${rows.length}장`;
      if (!box) return;
      if (!rows.length) { box.textContent = "아직 붙은 쪽지가 없어요."; return; }

      box.innerHTML = rows.map(r => {
        const head = String(r.text == null ? "" : r.text).replace(/\s+/g, " ").slice(0, 40);
        return `<div class="adm-forest-row">
                  <span class="t" title="${escapeHtml(String(r.text || ""))}">${escapeHtml(head)}</span>
                  <span class="w">${escapeHtml(forestWhen(r.at))} · ♥${Number(r.hearts) || 0}</span>
                  <button class="adm-btn ghost" data-forest-del="${escapeHtml(r.id)}">삭제</button>
                </div>`;
      }).join("");
    } catch (e) {
      console.warn("[adm forest]", e);
      if (cnt) cnt.textContent = "—";
      if (box) box.textContent = "불러오지 못했어요 — 보안규칙(forest)을 확인해 주세요.";
    }
  }

  async function removeForestNote(id) {
    if (!confirm("이 쪽지를 지울까요? (되돌릴 수 없어요!)")) return;
    try {
      await db.ref("forest/" + id).remove();
      msg("adm-forest-msg", "🗑 쪽지 하나를 지웠어요.");
      await loadForest();
    } catch (e) {
      msg("adm-forest-msg", "지우지 못했어요 — 보안규칙을 확인해 주세요.", true);
    }
  }

  /* 30일이 지난 쪽지 정리 — 메인 앱도 팝업을 열 때마다 같은 일을 하지만,
     아무도 대숲을 열지 않으면 청소가 안 됩니다. 그래서 여기에도 둡니다. */
  async function sweepForest() {
    try {
      const raw = (await db.ref("forest").once("value")).val() || {};
      const cut = Date.now() - FOREST_KEEP_MS;
      const dead = Object.keys(raw).filter(id => {
        const at = Number((raw[id] || {}).at) || 0;
        return at && at < cut;
      });
      if (!dead.length) { msg("adm-forest-msg", "시든 쪽지가 없어요. (30일 지난 것 0장)"); return; }
      for (const id of dead) await db.ref("forest/" + id).remove();
      msg("adm-forest-msg", `🍂 30일 지난 쪽지 ${dead.length}장을 정리했어요.`);
      await loadForest();
    } catch (e) {
      msg("adm-forest-msg", "정리하지 못했어요 — 보안규칙을 확인해 주세요.", true);
    }
  }

  /* 전체 비우기 — 되돌릴 수 없어서 confirm 을 두 번 받습니다 */
  async function clearForest() {
    /* [2026-08-17] 이것도 되돌릴 수 없는 일입니다 — 개별 삭제·30일 정리는
       운영진도 하지만, 판을 통째로 비우는 것은 방장만. */
    if (!ownerOnly("대숲 전체 비우기")) return;
    if (!confirm("정말 대숲의 쪽지를 모두 지울까요? (되돌릴 수 없어요!)")) return;
    if (!confirm("한 번 더 확인할게요.\n대숲이 완전히 비워집니다. 계속할까요?")) return;
    try {
      await db.ref("forest").remove();
      msg("adm-forest-msg", "🧹 대숲을 모두 비웠어요.");
      await loadForest();
    } catch (e) {
      msg("adm-forest-msg", "비우지 못했어요 — 보안규칙의 관리자 조건을 확인해 주세요.", true);
    }
  }

  // ------------------------------------------------- 배선
  document.addEventListener("DOMContentLoaded", () => {
    el("adm-login-btn")?.addEventListener("click", doLogin);
    el("adm-pw")?.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) doLogin(); });
    el("adm-pin-btn")?.addEventListener("click", doPin);
    el("adm-pin")?.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) doPin(); });
    el("adm-att-prev")?.addEventListener("click", () => loadAttendance(_attOffset + 1));
    el("adm-att-next")?.addEventListener("click", () => loadAttendance(Math.max(-앞달한도, _attOffset - 1)));
    /* 출근부는 매번 다시 그려지므로 개별 [✕] 대신 표가 담긴 상자에 위임합니다 */
    el("adm-att-body")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-del-nick]");
      if (btn) removeMember(btn.getAttribute("data-del-nick"));
    });
    el("adm-pin-msg-save")?.addEventListener("click", savePinnedMessage);
    el("adm-pin-msg-clear")?.addEventListener("click", clearPinnedMessage);
    el("adm-uid-copy")?.addEventListener("click", copyMyUid);
    el("adm-hist-apply")?.addEventListener("click", applyHistory);
    el("adm-chat-clear")?.addEventListener("click", clearChat);
    el("adm-chatty-clear")?.addEventListener("click", clearChatty);
    el("adm-wc-clear")?.addEventListener("click", clearWordcount);
    el("adm-log-open")?.addEventListener("click", openAttendLog);
    el("adm-diligent-run")?.addEventListener("click", runDiligent);
    el("adm-usage-run")?.addEventListener("click", runUsage);
    el("adm-log-close")?.addEventListener("click", closeAttendLog);
    el("adm-log-prev")?.addEventListener("click", () => loadAttendLog(_logOffset + 1));
    el("adm-log-next")?.addEventListener("click", () => loadAttendLog(_logOffset - 1));
    /* 바깥을 누르거나 ESC 로도 닫힙니다 */
    el("adm-log-modal")?.addEventListener("click", e => {
      if (e.target === el("adm-log-modal")) closeAttendLog();
    });
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if (!el("adm-log-modal")?.hasAttribute("hidden")) closeAttendLog();
    });
    /* 🔐 입장 승인 · 🚫 내보내기 */
    /* 👋 입장 인사 */
    el("adm-hello-save")?.addEventListener("click", saveHello);
    el("adm-hello-clear")?.addEventListener("click", clearHello);

    /* 🛡️ 운영진 명단 (방장에게만 보이는 칸) */
    el("adm-staff-add")?.addEventListener("click", () => addStaff(el("adm-staff-nick")?.value));
    el("adm-staff-nick")?.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.isComposing) addStaff(el("adm-staff-nick")?.value);
    });
    el("adm-staff-list")?.addEventListener("click", e => {
      const b = e.target.closest("[data-staff-del]");
      if (b) delStaff(b.getAttribute("data-staff-del"));
    });

    el("adm-allow-add")?.addEventListener("click", () => addAllow(el("adm-allow-nick")?.value));
    el("adm-allow-nick")?.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.isComposing) addAllow(el("adm-allow-nick")?.value);
    });
    el("adm-allow-seed")?.addEventListener("click", seedAllow);
    el("adm-allow-list")?.addEventListener("click", e => {
      const b = e.target.closest("[data-allow-del]");
      if (b) delAllow(b.getAttribute("data-allow-del"));
    });
    el("adm-ban-add")?.addEventListener("click", () => addBan(el("adm-ban-nick")?.value));
    el("adm-ban-nick")?.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.isComposing) addBan(el("adm-ban-nick")?.value);
    });
    el("adm-ban-list")?.addEventListener("click", e => {
      const b = e.target.closest("[data-ban-del]");
      if (b) delBan(b.getAttribute("data-ban-del"));
    });


  /* =====================================================================
     🩹 출석 복구 (2026-08-22 — 콩)
     ---------------------------------------------------------------------
     2026-08-22 새벽 사고(_pulse 선언이 사라져 접속자 화면을 다시 그리는
     길이 죽었던 건) 때 들어온 분들의 출석이 안 남았습니다.

     ★★★ **복원이 아니라 재구성입니다.** 원본 백업이 있는 게 아니라,
       그날 살아남은 다른 자취로 되짚는 것이에요. 그래서 **무엇을 근거로
       찾았는지 다 보여주고**, 방장이 확인한 것만 넣습니다.
       자동으로 우르르 넣으면 **없는 출석이 생깁니다** — 출석은 이 방에서
       규칙(한 달 18일)의 근거라, 없는 걸 만들면 규칙이 무너져요.

     [무엇으로 되짚나 — 센 것부터]
       ⏱️ 작업 시간  users/{닉}/timeSegs/{날}/{키} = {s,a,b}
                     그날 가장 이른 a 가 곧 첫 입장 시각입니다. 가장 좋아요.
       🚪 출입 기록  attendlog/{날} 의 {n,t,k:"in"} — **서버 시각**이라 정확.
       ✍️ 글자수     wordlog/{날}/{닉} — 시각은 없지만 "그날 있었다" 는 증거.

     ★ 셋 다 없는 분은 못 찾습니다. 들어와서 상태도 안 잡고 글도 안 쓰고
       말도 안 했으면 남는 게 없어요. 그분은 손으로 넣어야 합니다.
     ===================================================================== */

  const 하루MS = 86400000;
  const 날짜글 = (d) => {
    const t = new Date(d);
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  };
  const 시각글 = (ms) => {
    const t = new Date(Number(ms) || 0);
    return `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`;
  };

  let _복구감 = [];   // { 날, 닉, 시각, 근거[] }

  /** 하루치를 훑어 "자취는 있는데 출석부엔 없는" 사람을 찾습니다 */
  async function 하루훑기(날, 명단) {
    const [attSnap, logSnap, wordSnap] = await Promise.all([
      db.ref(`attendance/${날}`).once("value"),
      db.ref(`attendlog/${날}`).once("value").catch(() => null),
      db.ref(`wordlog/${날}`).once("value").catch(() => null),
    ]);
    const 있는사람 = attSnap.val() || {};
    const 찾음 = new Map();   // 닉 → { 시각, 근거[] }

    const 담기 = (닉, 시각, 근거) => {
      if (!닉 || 있는사람[닉]) return;            // 이미 출석부에 있음
      const 옛 = 찾음.get(닉);
      /* 여러 근거가 나오면 **가장 이른 시각**을 씁니다 — 첫 입장이니까요.
         시각이 없는 근거(글자수)는 시각을 안 덮어씁니다. */
      if (!옛) 찾음.set(닉, { 시각: 시각 || 0, 근거: [근거] });
      else {
        if (시각 && (!옛.시각 || 시각 < 옛.시각)) 옛.시각 = 시각;
        if (!옛.근거.includes(근거)) 옛.근거.push(근거);
      }
    };

    /* 🚪 출입 기록 — 서버 시각이라 가장 믿을 만합니다 */
    const 로그 = logSnap && logSnap.val ? (logSnap.val() || {}) : {};
    Object.values(로그).forEach(r => {
      if (r && r.n && r.k === "in") 담기(r.n, Number(r.t) || 0, "🚪 출입");
    });
    /* ✍️ 글자수 — 시각은 없지만 "그날 있었다" 는 증거 */
    const 글 = wordSnap && wordSnap.val ? (wordSnap.val() || {}) : {};
    Object.keys(글).forEach(닉 => 담기(닉, 0, "✍️ 글자수"));

    /* ⏱️ 작업 시간 — 사람마다 따로 읽습니다 (users 루트는 읽기 권한이 없어요).
       ★ 이미 찾은 사람도 읽습니다 — 시각이 **더 이르고 더 정확**하거든요. */
    for (const 닉 of 명단) {
      if (있는사람[닉]) continue;
      try {
        const seg = await db.ref(`users/${닉}/timeSegs/${날}`).once("value");
        const v = seg.val();
        if (!v) continue;
        let 첫 = 0;
        Object.values(v).forEach(x => {
          const a = Number(x && x.a) || 0;
          if (a && (!첫 || a < 첫)) 첫 = a;
        });
        if (첫) 담기(닉, 첫, "⏱️ 작업 시간");
      } catch (e) { /* 못 읽으면 건너뜁니다 */ }
    }

    return [...찾음.entries()].map(([닉, x]) => ({ 날, 닉, 시각: x.시각, 근거: x.근거 }));
  }

  async function findMissingAttendance(며칠) {
    const box = el("adm-fix-list");
    if (!box) return;
    const 고른날 = el("adm-fix-date") && el("adm-fix-date").value;
    if (!고른날) { msg("adm-fix-msg", "날짜를 먼저 골라 주세요.", true); return; }
    box.textContent = "훑는 중…";
    msg("adm-fix-msg", "");
    try {
      const owner = (await db.ref("nickOwner").once("value")).val() || {};
      const 명단 = Object.keys(owner);
      const 끝 = new Date(고른날 + "T12:00:00").getTime();
      const 날들 = [];
      for (let i = 며칠 - 1; i >= 0; i--) 날들.push(날짜글(끝 - i * 하루MS));

      _복구감 = [];
      for (const 날 of 날들) {
        box.textContent = `훑는 중… ${날}`;
        const r = await 하루훑기(날, 명단);
        _복구감 = _복구감.concat(r);
      }
      _복구감.sort((a, b) => (a.날 < b.날 ? -1 : a.날 > b.날 ? 1 : (a.닉 < b.닉 ? -1 : 1)));

      const 기간 = 며칠 > 1
        ? `<b>${escapeHtml(날들[0])}</b> ~ <b>${escapeHtml(날들[날들.length-1])}</b>`
        : `<b>${escapeHtml(날들[0])}</b>`;
      if (!_복구감.length) {
        box.innerHTML = `${기간} — 빠진 출석이 없어요. 👏`;
        return;
      }
      box.innerHTML = `
        <div style="margin-bottom:8px">${기간} — 자취는 있는데 출석부에 없는 분 <b>${_복구감.length}</b>건</div>
        <div class="adm-scroll" style="max-height:240px">
          ${_복구감.map((x, i) => `
            <div class="adm-row">
              <label style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;cursor:pointer">
                <input type="checkbox" class="adm-fix-pick" data-i="${i}" checked>
                <span class="n">${escapeHtml(x.닉)}</span>
              </label>
              <span class="s">${escapeHtml(x.날)} ${x.시각 ? 시각글(x.시각) : "시각 모름"}</span>
              <span class="s">${x.근거.map(escapeHtml).join(" ")}</span>
            </div>`).join("")}
        </div>
        <div class="adm-inline" style="margin-top:10px">
          <button class="adm-btn" id="adm-fix-go">고른 것만 출석부에 넣기</button>
        </div>
        <p class="adm-sub" style="margin-top:6px">
          ★ <b>시각 모름</b>은 글자수만 남은 분이에요 — 그날 <b>정오</b>로 넣습니다.
          정확한 시각을 아시면 넣은 뒤 손으로 고쳐 주세요.
        </p>`;
      const go = el("adm-fix-go");
      if (go) go.addEventListener("click", applyAttendanceFix);
    } catch (e) {
      box.textContent = "훑지 못했어요. " + (e.code || e.message || "");
    }
  }

  /* =====================================================================
     ✍️ 손으로 넣기 (2026-08-22)
     ---------------------------------------------------------------------
     되짚기로 못 찾는 분이 있습니다 — 들어와서 상태도 안 잡고 글도 안 쓰고
     말도 안 했으면 서버에 남는 게 없어요. 본인이 말해 주면 넣어야 하는데,
     **넣을 곳을 안 만들어 놓고 "손으로 넣어 주세요" 라고만 적어 뒀습니다.**
     안내는 있는데 길이 없으면 그 안내는 없느니만 못하죠.

     ★ 되짚기와 같은 규칙을 지킵니다 —
       · 이미 있는 기록은 **안 덮습니다** (진짜가 우선)
       · 넣은 줄에는 fixed 표를 남깁니다 (나중에 가릴 수 있게)
       · 방장만 할 수 있습니다
     ===================================================================== */
  async function addAttendanceByHand() {
    if (!ownerOnly("출석을 손으로 넣는 것")) return;
    const nick = (el("adm-hand-nick")?.value || "").trim();
    const 날   = el("adm-hand-date")?.value || "";
    const 시각 = el("adm-hand-time")?.value || "12:00";
    if (!nick || !날) { msg("adm-fix-msg", "닉네임과 날짜를 적어 주세요.", true); return; }
    if (/[.#$/\[\]]/.test(nick)) {
      msg("adm-fix-msg", "닉네임에 . $ # [ ] / 는 쓸 수 없어요.", true); return;
    }
    try {
      /* ★ 명단에 있는 닉인지 봅니다 — 오타로 없는 사람을 만들면
         출석부에 유령 줄이 생기고, 그 줄은 아무도 못 지웁니다. */
      const owner = (await db.ref("nickOwner/" + nick).once("value")).val();
      if (!owner) {
        msg("adm-fix-msg", `"${nick}" 은 명단에 없는 닉네임이에요. 오타가 아닌지 봐주세요.`, true);
        return;
      }
      const 있나 = await db.ref(`attendance/${날}/${nick}`).once("value");
      if (있나.exists()) {
        msg("adm-fix-msg", `${nick} 님은 ${날} 에 이미 기록이 있어요 — 덮지 않았습니다.`, true);
        return;
      }
      const t = new Date(`${날}T${시각}:00`).getTime();
      if (!Number.isFinite(t)) { msg("adm-fix-msg", "시각을 읽지 못했어요.", true); return; }
      await db.ref(`attendance/${날}/${nick}`).set({ firstAt: t, at: t, fixed: true });
      await loadAttendance(_attOffset);
      const inp = el("adm-hand-nick"); if (inp) inp.value = "";
      msg("adm-fix-msg", `✅ ${nick} — ${날} ${시각} 로 넣었어요.`);
    } catch (e) {
      msg("adm-fix-msg", "넣지 못했어요. " + (e.code || e.message || ""), true);
    }
  }

  async function applyAttendanceFix() {
    const 고른것 = [...document.querySelectorAll(".adm-fix-pick:checked")]
      .map(c => _복구감[Number(c.getAttribute("data-i"))]).filter(Boolean);
    if (!고른것.length) { msg("adm-fix-msg", "고른 것이 없어요.", true); return; }
    if (!confirm(`${고른것.length}건을 출석부에 넣을까요?\n\n` +
                 `남은 자취로 되짚은 것이라 정확한 복원이 아닙니다.\n` +
                 `근거를 한 번 더 확인해 주세요.`)) return;

    const 단추 = el("adm-fix-go");
    if (단추) { 단추.disabled = true; 단추.textContent = "넣는 중…"; }
    try {
      /* ★ 이미 있는 줄은 덮지 않습니다 — 훑을 때 걸렀지만, 그 사이에
         본인이 들어와 적혔을 수도 있어요. 되짚은 값이 진짜를 밀어내면 안 됩니다. */
      const 뭉치 = {};
      for (const x of 고른것) {
        const 있나 = await db.ref(`attendance/${x.날}/${x.닉}`).once("value");
        if (있나.exists()) continue;
        /* 시각을 모르면 그날 정오 — 새벽·자정으로 넣으면 하루가 어긋나 보입니다 */
        const t = x.시각 || new Date(x.날 + "T12:00:00").getTime();
        뭉치[`${x.날}/${x.닉}`] = { firstAt: t, at: t, fixed: true };
      }
      const 수 = Object.keys(뭉치).length;
      if (수) await db.ref("attendance").update(뭉치);
      await loadAttendance(_attOffset);
      msg("adm-fix-msg", `✅ ${수}건을 넣었어요.` + (수 < 고른것.length
        ? ` (${고른것.length - 수}건은 그새 본인 기록이 생겨 건드리지 않았어요)` : ""));
      const box = el("adm-fix-list");
      if (box) box.textContent = "다시 훑으려면 날짜를 고르고 눌러 주세요.";
    } catch (e) {
      if (단추) { 단추.disabled = false; 단추.textContent = "고른 것만 출석부에 넣기"; }
      msg("adm-fix-msg", "넣지 못했어요. " + (e.code || e.message || ""), true);
    }
  }

  /* =====================================================================
     👤 탈퇴자 자료 정리 (2026-08-22 — 콩)
     ---------------------------------------------------------------------
     방을 떠난 분의 자취를 지웁니다. 승인을 풀고 출석부에서 빼도
     프로필·기록·쪽지는 서버에 그대로 남아 있어서요.

     ★★★ **되돌릴 수 없습니다.** 문지기가 셋입니다 —
       ① 승인이 **풀린** 닉만 목록에 뜹니다 (현역은 아예 안 보임)
       ② 지우기 전에 **무엇이 얼마나 있는지 세어서** 보여줍니다
       ③ 닉네임을 **손으로 한 번 더** 적어야 단추가 열립니다

     ★★★ **세는 목록과 지우는 목록이 같아야 합니다.** 둘을 따로 적으면
       "보여준 것보다 더 지우는" 일이 생겨요 — 되돌릴 수 없는 기능에서
       그건 가장 나쁜 고장입니다. 그래서 아래 자리들 한 벌로 둘 다 합니다.
     ===================================================================== */

  /* 지울 자리 — **닉 하나로 곧장 찾아가는 것만.**
     kind:"직접" → 그 경로를 통째로
     kind:"날짜" → {날}/{닉} 이라 날짜를 훑어야 함 */
  const 지울자리 = [
    { p: "users",     kind: "직접", 이름: "프로필·할 일·목표·꾸밈·작업 시간" },
    { p: "achv",      kind: "직접", 이름: "업적" },
    { p: "worklog",   kind: "직접", 이름: "회차 기록" },
    { p: "workname",  kind: "직접", 이름: "작품 이름" },
    { p: "notes",     kind: "직접", 이름: "받은 쪽지" },
    { p: "notesOut",  kind: "직접", 이름: "보낸 쪽지" },
    { p: "status",    kind: "직접", 이름: "접속 상태" },
    { p: "attendance", kind: "날짜", 이름: "출석" },
    { p: "wordlog",    kind: "날짜", 이름: "글자수" },
    { p: "todostat",   kind: "날짜", 이름: "할 일 집계" },
  ];

  /* ⚠️ 일부러 **안 지우는** 것들 — 지우려다 마음이 흔들릴 때 여기를 보세요.
       messages·messages2·wordfeed  그 사람 말만 빼면 대화에 구멍이 납니다
       forest·help·pubreview        누가 썼는지 서버에 **없습니다** (익명)
       nickOwner                    지우면 그 닉을 아무나 새로 가져갑니다
       music                        방 전체가 함께 쓰는 추천 목록입니다 */

  let _지울후보 = [];

  async function loadPurgeList() {
    const box = el("adm-purge-list");
    if (!box) return;
    box.textContent = "훑는 중…";
    try {
      /* ★★★ [다시 만듦 2026-08-22 — 콩 신고 "명단이 안 뜬다"]
         처음엔 "승인이 풀린 사람" 을 목록으로 삼았습니다. 그런데 이 방에는
         **이미 지우는 기능이 있었어요** — 출근부 이름 옆 [✕](removeMember).
         그게 `nickOwner` 까지 지웁니다. 콩은 그걸로 탈퇴자를 정리해 왔고요.
         그래서 명단에 뜰 사람이 애초에 없었습니다. 제가 기존 기능을
         살펴보지 않고 새로 만든 탓입니다.

         진짜로 남아 있는 것은 **떠도는 자취**입니다. [✕] 는 2026-08 이전에
         만들어져서 그때 있던 자리만 지웁니다. 그 뒤에 생긴 업적·회차 기록·
         작품 이름·할 일 집계는 그대로 남았어요. nickOwner 가 지워졌으니
         **누구 것인지도 알 수 없는 채로** 떠돕니다.

         그래서 이 카드는 이제 그걸 줍습니다 — 자료에는 있는데 명단
         (nickOwner)에는 없는 닉을 찾아냅니다.
         ★ [✕] 쪽도 새 자리를 함께 지우도록 넓혔으니, 앞으로는 여기에
           새로 쌓이지 않습니다. 이 카드는 **지난 것을 치우는 빗자루**예요. */
      const [ownerSnap, ...조각들] = await Promise.all([
        db.ref("nickOwner").once("value"),
        ...지울자리.map(z => db.ref(z.p).once("value").catch(() => null)),
      ]);
      const 명단 = new Set(Object.keys(ownerSnap.val() || {}));

      /* 자료에 이름이 보이는 닉을 모읍니다 */
      const 자취 = new Map();          // 닉 → [자리 이름…]
      지울자리.forEach((자리, i) => {
        const snap = 조각들[i];
        const v = snap && snap.val ? (snap.val() || {}) : {};
        const 닉들 = 자리.kind === "직접"
          ? Object.keys(v)
          : [...new Set(Object.values(v).flatMap(byNick => Object.keys(byNick || {})))];
        닉들.forEach(n => {
          if (명단.has(n) || n === ADMIN_NICK) return;   // 아직 있는 사람·방장은 뺌
          if (!자취.has(n)) 자취.set(n, []);
          자취.get(n).push(자리.이름);
        });
      });

      _지울후보 = [...자취.keys()].sort();
      box.innerHTML = _지울후보.length
        ? _지울후보.map(n => `
            <div class="adm-row">
              <span class="n">${escapeHtml(n)}</span>
              <span class="s">${escapeHtml(자취.get(n).length)}곳</span>
              <button class="adm-btn ghost" data-purge-pick="${escapeHtml(n)}">자취 보기</button>
            </div>`).join("")
        : "떠도는 자취가 없어요. 깨끗합니다. 👏";
    } catch (e) {
      box.textContent = "훑지 못했어요. " + (e.code || e.message || "");
    }
  }

  /** 그 닉의 자취를 **세어서** 지울 경로 목록과 함께 돌려줍니다.
      ★ 세기와 지우기가 같은 목록을 쓰도록, 여기서 경로까지 만들어 둡니다. */
  async function 자취세기(nick) {
    const 경로 = [];      // 실제로 지울 곳
    const 요약 = [];      // 사람에게 보여줄 줄

    /* ★ 읽기가 막힌 자리가 있습니다 — 📮 쪽지(notes·notesOut)는 보안규칙이
       **주인에게만** 열려 있어서 방장도 못 읽고 못 지웁니다. 한 자리가
       막혔다고 나머지까지 통째로 실패하면 안 되니 건너뜁니다.
       ★ 다만 **조용히 넘어가지는 않습니다.** "지웠다" 고 했는데 실은 남아
         있는 것이 이 기능에서 가장 나쁜 거짓말이라, 화면에 적어 보여줍니다. */
    const 못본것 = [];

    for (const 자리 of 지울자리) {
      try {
        if (자리.kind === "직접") {
          const snap = await db.ref(`${자리.p}/${nick}`).once("value");
          if (!snap.exists()) continue;
          경로.push(`${자리.p}/${nick}`);
          const n = snap.numChildren();
          요약.push(`${자리.이름} ${n ? `(${n}칸)` : "있음"}`);
        } else {
          const snap = await db.ref(자리.p).once("value");
          const v = snap.val() || {};
          const 날들 = Object.keys(v).filter(d => v[d] && v[d][nick] !== undefined);
          if (!날들.length) continue;
          날들.forEach(d => 경로.push(`${자리.p}/${d}/${nick}`));
          요약.push(`${자리.이름} ${날들.length}일치`);
        }
      } catch (e) {
        못본것.push(자리.이름);
      }
    }
    return { 경로, 요약, 못본것 };
  }

  async function showPurgeDetail(nick) {
    const box = el("adm-purge-detail");
    if (!box) return;
    box.style.display = "";
    box.innerHTML = `<b>${escapeHtml(nick)}</b> — 세는 중…`;
    let 것;
    try { 것 = await 자취세기(nick); }
    catch (e) { box.innerHTML = "세지 못했어요. " + escapeHtml(e.code || e.message || ""); return; }

    if (!것.경로.length) {
      box.innerHTML = `<b>${escapeHtml(nick)}</b> — 지울 자료가 없어요.`
        + (것.못본것.length
            ? ` <span style="color:#B3372B">(다만 ${것.못본것.map(escapeHtml).join("·")} 은 읽을 수 없어 확인 못 했어요)</span>`
            : " 이미 깨끗합니다.");
      return;
    }
    /* ③ 닉을 손으로 한 번 더 — 목록에서 잘못 누르는 것을 막습니다.
       되돌릴 수 없는 일이라 "확인" 한 번으로는 부족해요. */
    box.innerHTML = `
      <div style="line-height:1.9">
        <b>${escapeHtml(nick)}</b> 님의 자취 — 모두 <b>${것.경로.length}곳</b>
        <div style="margin:6px 0 10px">${것.요약.map(escapeHtml).join(" · ")}</div>
        <div class="adm-inline">
          <input type="text" id="adm-purge-confirm" autocomplete="off"
                 placeholder="지우려면 ${escapeHtml(nick)} 을(를) 그대로 적어주세요">
          <button class="adm-btn danger" id="adm-purge-go" disabled>완전히 지우기</button>
        </div>
        <div style="margin-top:6px;font-size:12px;color:#6B5F52">
          ⚠️ 되돌릴 수 없어요. 채팅·대숲·표현 공부·품평 글과 로그인 계정은 남습니다.
          ${것.못본것.length ? `<br><b style="color:#B3372B">· 못 지우는 것: ${것.못본것.map(escapeHtml).join(" · ")}</b>
             — 보안규칙이 주인에게만 열어 둔 자리라 방장도 못 읽어요.` : ""}
        </div>
      </div>`;
    const 칸 = el("adm-purge-confirm"), 단추 = el("adm-purge-go");
    칸?.addEventListener("input", () => { 단추.disabled = (칸.value.trim() !== nick); });
    단추?.addEventListener("click", () => purgeMember(nick, 것.경로));
    칸?.focus();
  }

  async function purgeMember(nick, 경로) {
    if (!nick || !경로?.length) return;
    const 단추 = el("adm-purge-go");
    if (단추) { 단추.disabled = true; 단추.textContent = "지우는 중…"; }
    try {
      /* 한 번에 지웁니다 — 중간에 끊겨 절반만 지워지는 일이 없게.
         ★ 파이어베이스는 update 의 값이 null 이면 그 자리를 지웁니다. */
      const 뭉치 = {};
      경로.forEach(p => { 뭉치[p] = null; });
      await db.ref().update(뭉치);
      el("adm-purge-detail").style.display = "none";
      await loadPurgeList();
      msg("adm-purge-msg", `✅ ${nick} — ${경로.length}곳을 지웠어요.`);
    } catch (e) {
      if (단추) { 단추.disabled = false; 단추.textContent = "완전히 지우기"; }
      msg("adm-purge-msg", "지우지 못했어요. " + (e.code || e.message || ""), true);
    }
  }


    /* 🩹 출석 복구 */
    {
      const 날 = el("adm-fix-date");
      if (날 && !날.value) 날.value = 날짜글(Date.now());
    }
    {
      const 날2 = el("adm-hand-date");
      if (날2 && !날2.value) 날2.value = 날짜글(Date.now());
    }
    el("adm-hand-add")?.addEventListener("click", addAttendanceByHand);
    el("adm-fix-day")?.addEventListener("click", () => findMissingAttendance(1));
    el("adm-fix-week")?.addEventListener("click", () => findMissingAttendance(7));

    /* 👤 탈퇴자 정리 — 목록은 다시 그려지므로 위임으로 답니다 */
    el("adm-purge-list")?.addEventListener("click", e => {
      const b = e.target.closest("[data-purge-pick]");
      if (b) showPurgeDetail(b.getAttribute("data-purge-pick"));
    });
    loadPurgeList();

    el("adm-forest-reload")?.addEventListener("click", loadForest);
    el("adm-forest-sweep")?.addEventListener("click", sweepForest);
    el("adm-forest-clear")?.addEventListener("click", clearForest);
    /* 목록은 다시 그려지므로 개별 [삭제] 대신 목록에 위임합니다 */
    el("adm-forest-list")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-forest-del]");
      if (btn) removeForestNote(btn.getAttribute("data-forest-del"));
    });
  });
})();
