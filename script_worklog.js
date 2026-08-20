/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_worklog.js — ✍️ Work Log 줄 (2026-08-21, 콩 요청)
   ---------------------------------------------------------------------
   [무엇이 달라지나]
   지금까지 세 가지가 서로를 모른 채 따로 놀았습니다.

       할 일   users/{닉}/todoItems   (나의 작업 창 📌 탭)
       글자수  wordlog/{날}/{닉}      (Work Log 판, 하루에 숫자 하나)
       달력    wordlog 를 훑어 그림

   숫자에 **이름표가 없어서** 5,200자를 쓴 건 알아도 무엇을 썼는지는
   아무 데도 안 남았어요. 그래서 일주일 막대 말고는 보여줄 게 없었습니다.

   이제 **한 줄이 곧 할 일이자 글자수**입니다.

       worklog/{닉}/{날}/{id} = { t, w, ep, cnt, stage, done, at }

       t     무엇을 했나 (내용)          ★ 이건 남에게 안 보입니다
       w     작품 id (선택)
       ep    회차 (선택, "45" 도 "프롤로그" 도 됩니다)
       cnt   그 회차의 **누적** 글자수
       stage 초고 · 수정 · 퇴고 · 비축 · 업로드
       done  마쳤나
       at    마지막 손 댄 시각

   [★★ 반드시 지켜야 할 것 — 이걸 어기면 조용히 망가집니다]

   ① 할 일 **내용(t)** 은 공개 노드에 절대 안 나갑니다.
      worklog 는 보안규칙에서 **본인·방장만** 읽습니다. 방 전체가 보는
      숫자는 예전처럼 todostat(개수만) 으로 갑니다.

   ② **wordlog/{날}/{닉}.total 을 계속 채워야 합니다.**
      업적(script_achv.js)이 이 값을 봅니다 — wc1k · wc1m · wc10m ·
      wcd5k · wc7d · wcw3m · burst7 전부요. 여기를 안 채우면 59명의
      업적이 그날부터 조용히 멈춥니다. 화면에 오류도 안 뜹니다.

   ③ total 은 **줄어들지 않습니다.** 퇴고로 글자가 깎여도 그날 한 일은
      한 일이니까요. 숫자를 낮추면 기준만 조용히 내려갑니다.

   ④ 흐름(wordfeed)에는 **늘어난 만큼만** 나갑니다.
      칸에 든 값은 그 회차의 누적이고, 방에는 차이만 흘려보내요.

   [흐름 규칙 — 콩 확정]
     글자수를 늘림           → +1,200자      (체크는 안 눌러도 됩니다)
     글자수를 줄이거나 지움  → 아무 일 없음
     회차 딱지를 새로 붙임   → 45화 시작
     완료 체크 + 회차 있음   → 45화 마침 · 6,000자 🎉
     완료 체크 + 회차 없음   → 아무 일 없음

   ★ 흐름은 일부러 **걸러내지 않습니다.** 빨리 흘러가야 올리는 부담이
     없어져요 — 남을 글이면 잘 써야 할 것 같아지니까요 (콩).
   ===================================================================== */
(function () {
  "use strict";

  const el = (id) => document.getElementById(id);

  /* ★ script_core.js 의 myNick 은 최상위 let 이라 window 에 안 붙습니다.
     자료실에서 한 번 데인 자리예요 — 늘 이 me() 를 거칩니다. */
  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }

  const STAGES = ["초고", "수정", "퇴고", "비축", "업로드"];
  const MAX_TEXT = 120;      // 보안규칙의 t 길이 제한과 같아야 합니다
  const MAX_EP   = 16;
  const MAX_CNT  = 500000;
  const 묶음ms   = 3000;     // 손 떼고 3초 뒤에 한 줄로 묶어 보냅니다

  /* 날짜 열쇠는 **글자수 쪽 것을 그대로 빌려 씁니다.**
     따로 만들면 자정 언저리에 둘이 다른 날을 가리켜서, 화면은 오늘인데
     저장은 어제로 들어가는 일이 생겨요 (월요일 아침 사고와 같은 종류). */
  const dayKey = (d) => (window.Wordcount?.dayKey
    ? window.Wordcount.dayKey(d)
    : (() => { const n = d || new Date();
               return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })());

  /* ── 손안의 값 ──────────────────────────────────────────────────
     _lines[날짜] = { id: {…줄}, … }   내 줄만 들고 있습니다
     _works[id]   = { name }           내 작품 이름표 (A · B …)      */
  let _lines = {};
  let _works = {};
  let _ref = null, _wref = null;
  let _bound = false;

  const 줄들 = (day) => _lines[day] || {};
  const 작품 = (id) => _works[id] || null;

  /* =====================================================================
     듣기 — 내 것만 봅니다 (남의 할 일 내용은 규칙이 막습니다)
     ---------------------------------------------------------------------
     ★ 통째로 듣지 않고 **최근 것만** 듣습니다. 1년쯤 쌓이면 줄이 수천
       개가 되는데, 그걸 매번 받아 오면 입장이 느려져요.
     ===================================================================== */
  const KEEP_DAYS = 70;      // 주간 달력이 열 주쯤 뒤로 갈 수 있게

  function listen() {
    const nick = me();
    if (!nick || !window.db) return;
    stop();
    const from = dayKey(new Date(Date.now() - KEEP_DAYS * 86400000));
    _ref = window.db.ref("worklog/" + nick).orderByKey().startAt(from);
    _ref.on("value", (snap) => {
      _lines = snap.val() || {};
      window.renderWorklogIfOpen?.();
    });
    _wref = window.db.ref("workname/" + nick);
    _wref.on("value", (snap) => {
      _works = snap.val() || {};
      window.renderWorklogIfOpen?.();
    });
  }
  function stop() {
    try { _ref?.off(); } catch (e) {}
    try { _wref?.off(); } catch (e) {}
    _ref = null; _wref = null;
  }

  /* =====================================================================
     쓰기
     ===================================================================== */
  function 내길(day, id) {
    return window.db.ref(`worklog/${me()}/${day}` + (id ? "/" + id : ""));
  }

  /** 줄 하나를 고칩니다. patch 에 담긴 칸만 나갑니다. */
  async function 고치기(day, id, patch) {
    const nick = me();
    if (!nick || !window.db) return;
    const 전 = 줄들(day)[id];
    if (!전) return;

    /* 손안의 값을 먼저 고칩니다 — 왕복을 기다리는 동안 다음 글자를
       치면 옛 값으로 계산되던 사고가 글자수 쪽에 있었어요. */
    const 뒤 = { ...전, ...patch, at: Date.now() };
    _lines[day] = { ...(_lines[day] || {}), [id]: 뒤 };
    window.renderWorklogIfOpen?.();

    try {
      await 내길(day, id).update({ ...patch, at: 뒤.at });
    } catch (e) {
      _lines[day] = { ...(_lines[day] || {}), [id]: 전 };   // 되돌립니다
      window.renderWorklogIfOpen?.();
      console.warn("[worklog] 고치기 실패", e);
    }
    _todoStat();
  }

  /** 새 줄. 만들어진 id 를 돌려줍니다. */
  async function 더하기(day, seed) {
    const nick = me();
    if (!nick || !window.db) return null;
    const id = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const 줄 = {
      t: String(seed?.t ?? "").slice(0, MAX_TEXT),
      done: false,
      at: Date.now()
    };
    if (seed?.w)     줄.w = String(seed.w).slice(0, 24);
    if (seed?.ep)    줄.ep = String(seed.ep).slice(0, MAX_EP);
    if (seed?.cnt)   줄.cnt = Math.max(0, Math.min(MAX_CNT, Number(seed.cnt) || 0));
    if (seed?.stage) 줄.stage = seed.stage;
    if (seed?.from)  줄.from = String(seed.from).slice(0, 40);   // 옮겨온 할 일 표시

    _lines[day] = { ...(_lines[day] || {}), [id]: 줄 };
    window.renderWorklogIfOpen?.();
    try { await 내길(day, id).set(줄); }
    catch (e) {
      delete _lines[day][id];
      window.renderWorklogIfOpen?.();
      console.warn("[worklog] 더하기 실패", e);
      return null;
    }
    _todoStat();
    return id;
  }

  /** 줄 지우기 — 되돌릴 수 없습니다 */
  async function 지우기(day, id) {
    const 전 = 줄들(day)[id];
    if (!전) return;
    delete _lines[day][id];
    window.renderWorklogIfOpen?.();
    delete _보낸[day + "|" + id];
    try { await 내길(day, id).remove(); }
    catch (e) {
      _lines[day] = { ...(_lines[day] || {}), [id]: 전 };
      window.renderWorklogIfOpen?.();
    }
    _todoStat();
  }

  /* =====================================================================
     ★ 글자수 — 여기가 이 파일의 심장입니다
     ---------------------------------------------------------------------
     칸에 든 값은 그 회차의 **누적**입니다. 5,200 을 6,000 으로 고치면
     늘어난 800 만 방으로 흘러가고, 하루 합계에도 800 만 더해집니다.
     콩의 표현으로는 "기준 0 으로 된 계산기" 예요.

     _보낸[날|id] = 마지막으로 셈에 넣은 값
       · 판을 열 때 지금 값으로 채워 둡니다 — 안 그러면 열자마자
         +5,200 +1,100 이 우르르 흘러갑니다.
       · 서버가 거절하면 비웁니다 (다음에 다시 셈하도록).
     ===================================================================== */
  const _보낸 = {};
  const _타이머 = {};

  /** 판을 열거나 서버 값이 새로 올 때 — 기준선을 조용히 맞춥니다 */
  function 기준맞추기() {
    Object.keys(_lines).forEach(day => {
      Object.entries(_lines[day] || {}).forEach(([id, r]) => {
        const k = day + "|" + id;
        if (_보낸[k] === undefined) _보낸[k] = Number(r.cnt) || 0;
      });
    });
  }

  /** 글자수 칸이 바뀌었습니다. 저장은 바로, 흘리기는 3초 뒤에. */
  function 글자수바뀜(day, id, 값) {
    const v = Math.max(0, Math.min(MAX_CNT, Number(값) || 0));
    고치기(day, id, { cnt: v });

    const k = day + "|" + id;
    clearTimeout(_타이머[k]);
    _타이머[k] = setTimeout(() => 흘려보내기(day, id), 묶음ms);
  }

  async function 흘려보내기(day, id) {
    const k = day + "|" + id;
    const r = 줄들(day)[id];
    if (!r) return;
    const 지금 = Number(r.cnt) || 0;
    const 전   = Number(_보낸[k]) || 0;
    const 늘어난 = 지금 - 전;

    /* 줄었으면 **아무 일도 없습니다.** 오타를 고친 걸 -3,000자 로
       알릴 수는 없으니까요. 기준만 조용히 내려갑니다. */
    if (늘어난 <= 0) { _보낸[k] = 지금; return; }

    _보낸[k] = 지금;
    await 하루합계더하기(day, 늘어난);
    await 흐름에(day, { kind: "add", add: 늘어난, snap: 지금, ep: r.ep || "" });
  }

  /* =====================================================================
     ★★ 업적이 보는 자리 — wordlog/{날}/{닉}.total
     ---------------------------------------------------------------------
     여기를 안 채우면 wc1k · wc1m · wc7d · burst7 … 이 전부 멈춥니다.
     화면에는 아무 오류도 안 떠요. 그래서 검사(checks.js)로 못 박았습니다.

     ★ transaction 을 씁니다. 두 기기에서 동시에 적으면 update 로는
       한쪽이 덮여 사라져요 — 합계는 반드시 "읽고 더하기" 여야 합니다.
     ===================================================================== */
  async function 하루합계더하기(day, 늘어난) {
    const nick = me();
    if (!nick || !window.db || !(늘어난 > 0)) return;
    try {
      await window.db.ref(`wordlog/${day}/${nick}/total`)
        .transaction(now => (Number(now) || 0) + 늘어난);
      await window.db.ref(`wordlog/${day}/${nick}/at`).set(Date.now());
    } catch (e) {
      console.warn("[worklog] 하루 합계 실패", e);
    }
  }

  /* =====================================================================
     흐름 — 방이 함께 보는 자리
     ---------------------------------------------------------------------
     ★ 내용(t)은 절대 안 싣습니다. 회차 번호와 늘어난 글자수만요.
       "45화 시작" 은 괜찮지만 "회식 자리 폭로 씬" 은 안 됩니다.
     ===================================================================== */
  async function 흐름에(day, o) {
    const nick = me();
    if (!nick || !window.db) return;
    const 짐 = { nick, at: Date.now() };
    if (o.kind && o.kind !== "add") 짐.kind = o.kind;   // add 는 예전 모양 그대로
    if (o.add > 0) 짐.add = o.add;
    if (o.snap)    짐.snap = o.snap;
    if (o.ep)      짐.ep = String(o.ep).slice(0, MAX_EP);
    if (day !== dayKey()) 짐.late = true;               // 지난 날을 채운 것
    try { await window.db.ref(`wordfeed/${day}`).push(짐); }
    catch (e) { console.warn("[worklog] 흐름 실패", e); }
  }

  /* =====================================================================
     완료 체크 · 회차 딱지
     ===================================================================== */
  async function 체크(day, id) {
    const r = 줄들(day)[id];
    if (!r) return;
    const 켜짐 = !r.done;
    await 고치기(day, id, { done: 켜짐 });

    /* 회차가 없는 줄은 조용합니다 — "시놉시스 정리" 를 마친 건
       남의 관심사가 아니니까요 (콩). */
    if (켜짐 && r.ep && Number(r.cnt) > 0) {
      await 흐름에(day, { kind: "done", ep: r.ep, snap: Number(r.cnt) });
    }
    /* 업적의 할 일 카운터는 예전 자리를 그대로 씁니다 */
    if (켜짐) { try { window.achvBump?.("cTodo"); } catch (e) {} }
  }

  async function 딱지붙이기(day, id, w, ep) {
    const r = 줄들(day)[id];
    if (!r) return;
    const 전회차 = r.ep || "";
    const patch = {};
    patch.w  = w || null;
    patch.ep = (ep || "").slice(0, MAX_EP);
    if (patch.w && !r.stage) patch.stage = "초고";
    if (!patch.w && !patch.ep) patch.stage = null;
    await 고치기(day, id, patch);

    /* 없던 회차가 생겼을 때만 — 고쳐 쓴 것으로는 안 흘립니다 */
    if (patch.ep && patch.ep !== 전회차) {
      await 흐름에(day, { kind: "start", ep: patch.ep });
    }
  }

  async function 상태돌리기(day, id) {
    const r = 줄들(day)[id];
    if (!r) return;
    const at = STAGES.indexOf(r.stage);
    await 고치기(day, id, { stage: STAGES[(at + 1) % STAGES.length] });
  }

  /* =====================================================================
     작품 이름표
     ---------------------------------------------------------------------
     ★ 콩: "작품 제목은 함부로 노출 안 해요. 아마 A, B 로 적을 거예요."
       그래서 이름은 짧게 두고, 서버에서도 본인만 읽습니다.
     ===================================================================== */
  async function 작품만들기(name) {
    const nick = me();
    const n = String(name || "").trim().slice(0, 24);
    if (!nick || !n || !window.db) return null;
    const id = "w" + Date.now().toString(36);
    _works = { ..._works, [id]: { name: n } };
    window.renderWorklogIfOpen?.();
    try { await window.db.ref(`workname/${nick}/${id}`).set({ name: n }); }
    catch (e) { delete _works[id]; window.renderWorklogIfOpen?.(); return null; }
    return id;
  }
  async function 작품지우기(id) {
    const nick = me();
    if (!nick || !window.db) return;
    /* 줄에 붙은 딱지는 그대로 둡니다 — 이름표만 사라져요.
       지난 기록에서 회차까지 날리면 되돌릴 길이 없습니다. */
    delete _works[id];
    window.renderWorklogIfOpen?.();
    try { await window.db.ref(`workname/${nick}/${id}`).remove(); } catch (e) {}
  }

  /* =====================================================================
     방 전체가 보는 숫자 — todostat (개수만)
     ---------------------------------------------------------------------
     ★ status 가 아니라 todostat 인 이유: status 는 나가면 통째로
       지워져서 방 합계가 **줄어듭니다.** todostat 은 하루치로 남아요.
       (script_data.js 가 같은 이유로 그렇게 하고 있습니다.)
     ===================================================================== */
  let _statTimer = null;
  function _todoStat() {
    clearTimeout(_statTimer);
    _statTimer = setTimeout(async () => {
      const nick = me();
      if (!nick || !window.db) return;
      const day = dayKey();
      const rows = Object.values(줄들(day));
      /* 예전 할 일(todoItems)도 함께 셉니다 — 아직 옮기지 않은
         사람의 숫자가 갑자기 0 이 되면 안 되니까요. */
      let total = rows.length, done = rows.filter(r => r.done).length;
      try {
        const old = window.todosForProfileList?.() || [];
        total += old.length;
        done  += old.filter(t => t.done).length;
      } catch (e) {}
      if (total <= 0) return;
      try {
        await window.db.ref(`todostat/${day}/${nick}`)
          .set({ total, done: Math.min(done, total), at: Date.now() });
      } catch (e) {}
    }, 600);
  }

  /* =====================================================================
     집계 — 화면이 물어보는 것들
     ===================================================================== */
  /** 그 날 쓴 글자수 합 (줄들의 cnt 합이 아니라 **그 날 늘어난 만큼**이
      아니라, 줄에 적힌 누적의 합입니다 — 달력에 보여 줄 값) */
  function 날합계(day) {
    return Object.values(줄들(day)).reduce((a, r) => a + (Number(r.cnt) || 0), 0);
  }
  function 날회차(day) {
    return Object.values(줄들(day)).filter(r => r.ep).map(r => r.ep);
  }

  /** 작품 하나의 회차별 글자수 — { "45": {cnt, stage}, "프롤로그": {…} } */
  function 작품회차(wid) {
    const m = {};
    Object.values(_lines).forEach(rows => Object.values(rows || {}).forEach(r => {
      if (r.w !== wid || !r.ep) return;
      /* 같은 회차를 여러 날에 걸쳐 썼으면 **가장 마지막 값**이 그 회차의
         분량입니다 (cnt 는 누적이니까 더하면 안 됩니다). */
      const 전 = m[r.ep];
      if (!전 || (Number(r.at) || 0) >= (전.at || 0)) {
        m[r.ep] = { cnt: Number(r.cnt) || 0, stage: r.stage || null, at: Number(r.at) || 0 };
      }
    }));
    return m;
  }

  /* =====================================================================
     예전 할 일 이어받기 — **지우지 않습니다**
     ---------------------------------------------------------------------
     users/{닉}/todoItems 는 그대로 둡니다. 오늘 할 것(오늘 due · 루틴 ·
     날짜 없음)만 오늘 줄로 **한 번** 옮겨 옵니다.

     ★ from 칸에 원래 id 를 적어 두고, 같은 id 가 이미 있으면 건너뜁니다.
       안 그러면 새로고침할 때마다 같은 할 일이 쌓입니다.
     ===================================================================== */
  async function 이어받기() {
    const nick = me();
    if (!nick || !window.db) return;
    let old = [];
    try { old = window.todosForProfileList?.() || []; } catch (e) { return; }
    if (!old.length) return;

    const day = dayKey();
    const 이미 = new Set(Object.values(줄들(day)).map(r => r.from).filter(Boolean));
    for (const t of old) {
      if (!t?.id || 이미.has(t.id)) continue;
      await 더하기(day, { t: t.text || "", from: t.id });
      if (t.done) {
        /* 이미 체크해 둔 것은 체크된 채로 (흐름은 안 흘립니다) */
        const 새것 = Object.entries(줄들(day)).find(([, r]) => r.from === t.id);
        if (새것) await 고치기(day, 새것[0], { done: true });
      }
    }
  }

  /* =====================================================================
     바깥에 내주는 것
     ===================================================================== */
  window.Worklog = {
    STAGES, dayKey,
    listen, stop, 기준맞추기, 이어받기,
    줄들, 작품, 작품들: () => _works,
    더하기, 고치기, 지우기, 체크, 딱지붙이기, 상태돌리기, 글자수바뀜,
    작품만들기, 작품지우기,
    날합계, 날회차, 작품회차,
    _state: () => ({ lines: _lines, works: _works, sent: _보낸 })
  };
})();

/* =====================================================================
   script_worklog.js — 화면 (2026-08-21)
   ---------------------------------------------------------------------
   ★ 판을 새로 만들지 않습니다. 기존 ✍️ Work Log 판(#wordcount-block)의
     탭을 늘리고, 내용은 #wc-rows 에 그립니다. 판을 따로 만들면
     끌기·키조절·자리기억을 전부 다시 짜야 하고, 무엇보다 사람들이
     이미 그 자리를 손에 익혔어요.

   탭 다섯: 오늘 · 주간 · 작품 (여기) / 메모 · 기록 (script_wordcount.js)
   ===================================================================== */
(function () {
  "use strict";

  const el = (id) => document.getElementById(id);
  const W  = () => window.Worklog;
  const 콤마 = (n) => Number(n || 0).toLocaleString("ko-KR");
  const 요일 = ["일", "월", "화", "수", "목", "금", "토"];
  const 화 = (ep) => ep + (/^\d+$/.test(ep) ? "화" : "");
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* 작품 딱지 색 — 이름이 A·B 처럼 짧아서 색으로 갈라 봅니다 */
  const 색판 = [
    ["#C0654A", "#F6E5DE"], ["#5A7FA6", "#E2ECF5"], ["#5E8C61", "#E4EFE4"],
    ["#B08640", "#F7EDD9"], ["#8C5A93", "#F0E6F2"], ["#7A6E5D", "#EFEAE1"]
  ];
  function 작품색(id) {
    const ids = Object.keys(W().작품들());
    const i = Math.max(0, ids.indexOf(id)) % 색판.length;
    return { c: 색판[i][0], s: 색판[i][1] };
  }

  let _보는날 = null;      // null 이면 오늘
  let _주시작 = null;
  let _펼친날 = null;
  let _열린작품 = null;
  let _회페이지 = {};
  let _picking = null;     // { day, id }

  const 오늘키 = () => W().dayKey();
  function 보는날() {
    if (!_보는날) { const d = new Date(); d.setHours(0,0,0,0); _보는날 = d; }
    return _보는날;
  }
  function 주시작() {
    if (!_주시작) { const d = new Date(보는날()); d.setDate(d.getDate() - d.getDay()); _주시작 = d; }
    return _주시작;
  }

  /* ═══════════════════ 탭 ①  오늘 ═══════════════════ */
  function 오늘탭() {
    const d = 보는날(), day = W().dayKey(d), 오늘인가 = day === 오늘키();
    const rows = Object.entries(W().줄들(day))
      .sort((a, b) => (a[1].at || 0) - (b[1].at || 0));

    const 줄HTML = rows.length ? rows.map(([id, r]) => {
      const w = r.w ? W().작품(r.w) : null;
      const col = r.w ? 작품색(r.w) : null;
      const 딱지 = w
        ? `<button class="wl-tag on" data-wl="pick" data-id="${id}"
             style="background:${col.s};color:${col.c}" title="작품·회차 고치기"
             >${esc(w.name)}${r.ep ? " " + esc(화(r.ep)) : ""}</button>`
        : `<button class="wl-tag" data-wl="pick" data-id="${id}" title="작품·회차 붙이기">＋작품</button>`;
      const 상태 = r.stage
        ? `<span class="wl-stage wl-s-${r.stage}" data-wl="stage" data-id="${id}" title="눌러서 바꾸기">${r.stage}</span>`
        : "";
      return `<div class="wl-row${r.done ? " done" : ""}">
        <button class="wl-chk${r.done ? " on" : ""}" data-wl="chk" data-id="${id}"
                aria-label="마침" aria-pressed="${r.done}">${r.done ? "✓" : ""}</button>
        <input class="wl-txt" data-wl="txt" data-id="${id}" value="${esc(r.t)}"
               maxlength="120" placeholder="무엇을 했나요">
        ${딱지}${상태}
        <span class="wl-cw"><input class="wl-cnt" data-wl="cnt" data-id="${id}"
              value="${r.cnt ? 콤마(r.cnt) : ""}" placeholder="0" inputmode="numeric"><i>자</i></span>
        <button class="wl-del" data-wl="del" data-id="${id}" title="이 줄 지우기">✕</button>
      </div>`;
    }).join("") : `<p class="wl-empty">이 날은 아직 비어 있어요.<br>아래에서 한 줄 적어 보세요.</p>`;

    const 합 = W().날합계(day);
    const 회 = rows.filter(([, r]) => r.ep && r.cnt > 0).map(([, r]) => 화(r.ep)).join(" · ");
    const 한일 = rows.filter(([, r]) => r.done).length;

    return `<div class="wl-nav">
        <button data-wl="day" data-v="-1" title="어제">‹</button>
        <span class="wl-lbl">${d.getMonth()+1}월 ${d.getDate()}일 (${요일[d.getDay()]})${오늘인가 ? " · 오늘" : ""}</span>
        <button data-wl="day" data-v="1" title="내일" ${오늘인가 ? "disabled" : ""}>›</button>
        ${오늘인가 ? "" : `<button class="wl-back" data-wl="day" data-v="0">오늘로</button>`}
      </div>
      <div class="wl-rows">${줄HTML}</div>
      <button class="wl-add" data-wl="add">＋ 한 줄 더</button>
      <div class="wl-sum"><b>${콤마(합)}</b><span>자</span>
        <span class="wl-g">${회 ? esc(회) + " · " : ""}${한일}/${rows.length} 마침</span></div>
      ${흐름HTML()}`;
  }

  /* 🔥 방 흐름 — 함께 쓰는 기운이 이 판의 핵심입니다 (콩) */
  function 흐름HTML() {
    const st = window.Wordcount?._state?.();
    const feed = (st?.feed || []).filter(f => f && f.type !== "pomo");
    if (!feed.length) return `<div class="wl-feed"><div class="wl-fh">🔥 지금 방에서</div>
      <div class="wl-fempty">아직 조용해요. 첫 줄을 올려 보세요.</div></div>`;
    const 줄 = feed.slice(-14).reverse().map(f => {
      const 내것 = f.nick === (window.myNick || "");
      let 말;
      if (f.kind === "done")       말 = `<b>${esc(화(f.ep || ""))} 마침</b>${f.snap ? " · " + 콤마(f.snap) + "자" : ""} 🎉`;
      else if (f.kind === "start") 말 = `<b>${esc(화(f.ep || ""))}</b> 시작`;
      else                         말 = `+${콤마(f.add)}자`;
      return `<div class="wl-fl${f.kind === "done" ? " big" : ""}">
        <span class="wl-who${내것 ? " me" : ""}">${esc(f.nick)}</span>
        <span class="wl-what">${말}</span>
        <span class="wl-ago">${언제(f.at)}</span></div>`;
    }).join("");
    return `<div class="wl-feed"><div class="wl-fh">🔥 지금 방에서</div>
      <div class="wl-fb">${줄}</div></div>`;
  }
  function 언제(at) {
    const m = Math.floor((Date.now() - (Number(at) || 0)) / 60000);
    if (m < 1) return "방금";
    if (m < 60) return m + "분";
    return Math.floor(m / 60) + "시간";
  }

  /* ═══════════════════ 탭 ②  주간 ═══════════════════ */
  function 주간탭() {
    const s = 주시작(), e = new Date(s); e.setDate(e.getDate() + 6);
    let html = `<div class="wl-nav">
        <button data-wl="week" data-v="-1" title="지난 주">‹</button>
        <span class="wl-lbl">${s.getMonth()+1}/${s.getDate()} – ${e.getMonth()+1}/${e.getDate()}</span>
        <button data-wl="week" data-v="1" title="다음 주">›</button>
      </div><div class="wl-wk">`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(s); d.setDate(d.getDate() + i);
      const day = W().dayKey(d);
      const rows = Object.values(W().줄들(day)).sort((a,b)=>(a.at||0)-(b.at||0));
      const 총 = W().날합계(day);
      const 회 = rows.filter(r => r.ep).map(r => 화(r.ep));
      const 그냥 = rows.filter(r => !r.ep).length;
      let 요약 = 회.length ? `<b>${esc(회.join(", "))}</b>` : "";
      if (그냥) 요약 += (요약 ? " · " : "") + `기록 ${그냥}줄`;
      if (!요약) 요약 = "—";
      html += `<div class="wl-d${day === 오늘키() ? " today" : ""}${_펼친날 === day ? " open" : ""}">
        <div class="wl-dh" data-wl="fold" data-k="${day}">
          <span class="wl-dw${d.getDay() === 0 ? " sun" : ""}">${요일[d.getDay()]}</span>
          <span class="wl-dn">${d.getDate()}</span>
          <span class="wl-dl">${요약}</span>
          <span class="wl-dc${총 ? "" : " zero"}">${총 ? 콤마(총) + "자" : "·"}</span>
          <span class="wl-dx">${rows.length ? "▸" : ""}</span>
        </div>
        ${rows.length ? `<div class="wl-db">${rows.map(r => {
          const col = r.w ? 작품색(r.w) : null;
          return `<div class="wl-di">
            ${r.ep && col
              ? `<span class="wl-p" style="background:${col.s};color:${col.c}">${esc(화(r.ep))}</span>`
              : `<span class="wl-p plain">기록</span>`}
            <span class="wl-n">${esc(r.t) || "—"}</span>
            <span class="wl-c">${r.cnt ? 콤마(r.cnt) + "자" : "·"}</span></div>`;
        }).join("")}<button class="wl-goto" data-wl="goto" data-k="${day}">이 날 고치기 ›</button></div>` : ""}
      </div>`;
    }
    return html + `</div>`;
  }

  /* ═══════════════════ 탭 ③  작품 ═══════════════════ */
  function 작품탭() {
    const works = W().작품들();
    const ids = Object.keys(works);
    if (!ids.length) {
      return `<p class="wl-empty">아직 만든 작품이 없어요.<br>
        작품을 만들면 회차별 글자수와 진도가 쌓입니다.<br>
        <span class="wl-dim">제목 대신 A · B 처럼 적어도 됩니다.</span></p>
        <button class="wl-add" data-wl="newwork">＋ 작품 만들기</button>`;
    }
    let html = `<div class="wl-pj">`;
    ids.forEach(id => {
      const w = works[id], col = 작품색(id);
      const m = W().작품회차(id);
      const 키 = Object.keys(m);
      const 숫자 = 키.filter(k => /^\d+$/.test(k)).map(Number).sort((a,b)=>a-b);
      const 글자 = 키.filter(k => !/^\d+$/.test(k));
      const 최대 = 숫자.length ? Math.max(...숫자) : 0;
      const 총자 = 키.reduce((a,k) => a + m[k].cnt, 0);
      const 평균 = 키.length ? Math.round(총자 / 키.length) : 0;
      const 셈 = {}; W().STAGES.forEach(s => 셈[s] = 0);
      키.forEach(k => { if (셈[m[k].stage] !== undefined) 셈[m[k].stage]++; });
      const 편 = 키.length || 1;
      const 열림 = _열린작품 === id;

      let 표 = "";
      if (열림) {
        const 쪽 = _회페이지[id] || 0;
        const 총쪽 = Math.max(1, Math.ceil(Math.max(최대, 15) / 15));
        const 시작 = 쪽 * 15 + 1;
        const 칸 = [];
        for (let n = 0; n < 15; n++) {
          const 번 = 시작 + n, rec = m[String(번)];
          칸.push(rec
            ? `<div class="wl-epc"><i style="background:${상태색(rec.stage)}"></i><span class="e">${번}화</span><span class="c">${콤마(rec.cnt)}자</span></div>`
            : `<div class="wl-epc none"><span class="e">${번}</span></div>`);
        }
        /* 세로로 읽히게 열 우선으로 다시 깝니다 (1~5 / 6~10 / 11~15) */
        const 세로 = [];
        for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) 세로.push(칸[c * 5 + r]);
        표 = `<div class="wl-pjb">
          ${글자.length && 쪽 === 0 ? `<div class="wl-eptbl">${
            글자.map(k => `<div class="wl-epc"><i style="background:${상태색(m[k].stage)}"></i><span class="e">${esc(k)}</span><span class="c">${콤마(m[k].cnt)}자</span></div>`).join("")
            + Array((3 - 글자.length % 3) % 3).fill(`<div class="wl-epc none"></div>`).join("")
          }</div>` : ""}
          <div class="wl-epnav">
            <button data-wl="ep" data-id="${id}" data-v="-1" ${쪽 === 0 ? "disabled" : ""}>‹</button>
            <span>회차 이동 · ${시작}–${시작 + 14}</span>
            <button data-wl="ep" data-id="${id}" data-v="1" ${쪽 >= 총쪽 - 1 ? "disabled" : ""}>›</button>
          </div>
          <div class="wl-eptbl">${세로.join("")}</div>
          <div class="wl-legend">${W().STAGES.map(s =>
            `<span><i style="background:${상태색(s)}"></i>${s}</span>`).join("")}
            <button class="wl-wdel" data-wl="delwork" data-id="${id}">이름표 지우기</button></div>
        </div>`;
      }

      html += `<div class="wl-pjr${열림 ? " open" : ""}">
        <div class="wl-pjh" data-wl="openwork" data-id="${id}">
          <div class="wl-pjt">
            <span class="nm" style="color:${col.c}">${esc(w.name)}</span>
            <span class="ep">${최대 ? 최대 + "화까지" : (키.length ? 키.length + "편" : "아직 없음")}</span>
            <span class="ax">▸</span>
          </div>
          <div class="wl-pbar">${W().STAGES.map(s =>
            `<i style="width:${셈[s] / 편 * 100}%;background:${상태색(s)}"></i>`).join("")}</div>
          <div class="wl-pjm">
            <span>쓴 편수 <b>${키.length}편</b></span>
            <span>비축 <b>${셈["비축"]}편</b></span>
            <span>편당 <b>${콤마(평균)}자</b></span>
            <span>모두 <b>${콤마(총자)}자</b></span>
          </div>
        </div>${표}</div>`;
    });
    return html + `<button class="wl-add" data-wl="newwork">＋ 작품 만들기</button></div>`;
  }
  function 상태색(s) {
    return ({ 초고: "#B08640", 수정: "#8C5A93", 퇴고: "#C0654A",
              비축: "#5A7FA6", 업로드: "#5E8C61" })[s] || "#A2957F";
  }

  /* ═══════════════════ 그리기 ═══════════════════ */
  let _탭 = "wl";
  function render(tab, host) {
    if (!host || !W()) return;
    _탭 = tab;
    host.innerHTML = tab === "wlweek" ? 주간탭()
                   : tab === "wlproj" ? 작품탭()
                   : 오늘탭();
    host.classList.add("wl-host");
  }
  window.Worklog_render = render;
  window.renderWorklogIfOpen = function () {
    const host = el("wc-rows");
    if (!host || !/^wl/.test(String(window.Wordcount?._state?.().tab || ""))) return;
    render(window.Wordcount._state().tab, host);
  };

  /* ═══════════════════ 손가락 ═══════════════════ */
  function 지금날() { return W().dayKey(보는날()); }

  document.addEventListener("click", async (e) => {
    /* 작품 고르는 작은 창 */
    const pw = e.target.closest("[data-wlpw]");
    if (pw) {
      const box = el("wl-pick");
      box.querySelectorAll("[data-wlpw]").forEach(b =>
        b.classList.toggle("on", b === pw && !pw.classList.contains("on")));
      return;
    }
    const pk = e.target.closest("[data-wlpick]");
    if (pk) {
      const { day, id } = _picking || {};
      if (day && id) {
        if (pk.dataset.wlpick === "clear") await W().딱지붙이기(day, id, null, "");
        else {
          const on = el("wl-pick").querySelector("[data-wlpw].on");
          await W().딱지붙이기(day, id, on?.dataset.wlpw || null, el("wl-pick-ep").value.trim());
        }
      }
      닫기picker(); return;
    }
    if (_picking && !e.target.closest("#wl-pick")) 닫기picker();

    const b = e.target.closest("[data-wl]");
    if (!b) return;
    const act = b.dataset.wl, id = b.dataset.id, day = 지금날();

    if (act === "day") {
      const v = Number(b.dataset.v);
      if (v === 0) { _보는날 = null; }
      else { const d = new Date(보는날()); d.setDate(d.getDate() + v);
             if (W().dayKey(d) > 오늘키()) return; _보는날 = d; }
      _주시작 = new Date(보는날()); _주시작.setDate(_주시작.getDate() - _주시작.getDay());
      _펼친날 = W().dayKey(보는날());
      window.renderWorklogIfOpen(); return;
    }
    if (act === "week") {
      const s = 주시작(); s.setDate(s.getDate() + Number(b.dataset.v) * 7);
      _주시작 = s; window.renderWorklogIfOpen(); return;
    }
    if (act === "fold") { _펼친날 = _펼친날 === b.dataset.k ? null : b.dataset.k;
                          window.renderWorklogIfOpen(); return; }
    if (act === "goto") {
      const [y, m, dd] = b.dataset.k.split("-").map(Number);
      _보는날 = new Date(y, m - 1, dd);
      탭으로("wl"); return;
    }
    if (act === "openwork") { _열린작품 = _열린작품 === id ? null : id;
                              window.renderWorklogIfOpen(); return; }
    if (act === "ep") { _회페이지[id] = Math.max(0, (_회페이지[id] || 0) + Number(b.dataset.v));
                        window.renderWorklogIfOpen(); return; }
    if (act === "newwork") {
      const n = prompt("작품 이름을 적어 주세요.\n제목 대신 A · B 처럼 적어도 됩니다.");
      if (n && n.trim()) await W().작품만들기(n.trim());
      window.renderWorklogIfOpen(); return;
    }
    if (act === "delwork") {
      if (!confirm("이름표만 지웁니다.\n이미 적어 둔 회차와 글자수는 그대로 남아요.")) return;
      await W().작품지우기(id); _열린작품 = null;
      window.renderWorklogIfOpen(); return;
    }
    if (act === "add") {
      await W().더하기(day, { t: "" });
      window.renderWorklogIfOpen();
      const t = document.querySelectorAll(".wl-txt");
      t[t.length - 1]?.focus();
      return;
    }
    if (act === "chk")   { await W().체크(day, id); return; }
    if (act === "del")   { await W().지우기(day, id); return; }
    if (act === "stage") { await W().상태돌리기(day, id); return; }
    if (act === "pick")  { 열기picker(day, id, b); return; }
  });

  /* 글자쓰기 — ★ 다시 그리지 않습니다.
     한글은 조합 중에 요소를 갈아치우면 자소가 분리돼요 (여기서 여러 번
     데였습니다). 손안의 값만 조용히 고치고, 화면은 그대로 둡니다. */
  document.addEventListener("input", (e) => {
    const b = e.target.closest("[data-wl]");
    if (!b) return;
    const id = b.dataset.id, day = 지금날();
    if (b.dataset.wl === "txt") {
      clearTimeout(b._t);
      b._t = setTimeout(() => W().고치기(day, id, { t: b.value.slice(0, 120) }), 500);
    }
    if (b.dataset.wl === "cnt") {
      const v = Number(String(b.value).replace(/[^\d]/g, "")) || 0;
      W().글자수바뀜(day, id, v);
      const s = document.querySelector(".wl-sum b");
      if (s) s.textContent = 콤마(W().날합계(day));
    }
  });

  /* 글자수 칸에서 손을 떼면 콤마를 다시 찍습니다 (쓰는 중에 찍으면
     커서가 튀어요) */
  document.addEventListener("blur", (e) => {
    const b = e.target.closest?.("[data-wl='cnt']");
    if (!b) return;
    const v = Number(String(b.value).replace(/[^\d]/g, "")) || 0;
    b.value = v ? 콤마(v) : "";
  }, true);

  /* ── 작품·회차 고르는 작은 창 ── */
  function 열기picker(day, id, btn) {
    let box = el("wl-pick");
    if (!box) {
      box = document.createElement("div");
      box.id = "wl-pick"; box.className = "wl-pick";
      document.body.appendChild(box);
    }
    const r = W().줄들(day)[id] || {};
    const works = W().작품들();
    box.innerHTML = `<p class="t">작품</p>
      <div class="ws">${Object.keys(works).length
        ? Object.entries(works).map(([wid, w]) =>
            `<button class="w${r.w === wid ? " on" : ""}" data-wlpw="${wid}">${esc(w.name)}</button>`).join("")
        : `<p class="dim">아직 작품이 없어요 — 작품 탭에서 만들 수 있습니다.</p>`}</div>
      <p class="t">회차 <span class="dim">(비워도 됩니다)</span></p>
      <input id="wl-pick-ep" maxlength="16" value="${esc(r.ep || "")}" placeholder="45 · 프롤로그 · 외전2 …">
      <div class="r2"><button data-wlpick="clear">떼기</button>
        <button class="go" data-wlpick="ok">붙이기</button></div>`;
    _picking = { day, id };
    box.classList.add("on");
    const q = btn.getBoundingClientRect();
    box.style.top  = Math.max(8, q.top - box.offsetHeight - 6) + "px";
    box.style.left = Math.max(8, Math.min(q.left - 60, window.innerWidth - 222)) + "px";
    setTimeout(() => el("wl-pick-ep")?.focus(), 30);
  }
  function 닫기picker() { el("wl-pick")?.classList.remove("on"); _picking = null; }

  function 탭으로(t) {
    const btn = document.querySelector(`[data-wc-tab="${t}"]`);
    if (btn) btn.click();
  }
  window.worklogGoToday = () => { _보는날 = null; 탭으로("wl"); };
})();
