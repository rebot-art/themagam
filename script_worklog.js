/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_worklog.js — ✍️ Work Log (2026-08-22 개편, 콩)
   ---------------------------------------------------------------------
   [무엇을 하는 곳인가]
   **회차와 글자수만** 다룹니다. 할 일은 여기 없어요.

       할 일   →  ✍️ 메모 탭의 슬래시 명령(/오늘 · /완료) · 나의 작업 창
       글자수  →  ① 기존 방식 (전체 글자수 → 기준 대비 차이)
                  ② 작품·회차 방식  ← 여기

   [왜 갈랐나]
   처음엔 한 줄이 "할 일이자 글자수" 였습니다. 그런데 둘이 섞이니까
   자리만 차지하고 헷갈렸어요 — 콩: "동시에 돌아간다는 걸 멤버들이
   이해를 못해."

   [자리]
       worklog/{닉}/ep/{id} = { w, ep, cnt, base, stage, done, doneDay, c, at }
       workname/{닉}/{id}   = { name, unit }        A · B … / 화 · 챕터

       w        작품 id (선택)
       ep       회차 — "1" 도 "프롤로그" 도 됩니다
       cnt      그 회차의 **누적** 글자수
       base     이어 쓰는 회차라면 물려받은 출발선
       stage    초고 · 수정 · 퇴고 · 비축 · 업로드
       doneDay  마친 날 — ★ **체크하는 순간** 정해집니다

   [★★ 반드시 지켜야 할 것 — 이걸 어기면 조용히 망가집니다]

   ① **회차는 날짜에 안 묶입니다.** 1~5화를 미리 만들어 두고 며칠에
      걸쳐 씁니다. 체크하는 날이 마친 날이 되고, 그때 주간 달력에
      나타나요. 만들 때는 아무 날에도 안 속합니다.

   ② **wordlog/{날}/{닉}.total 을 계속 채워야 합니다.**
      업적(script_achv.js)이 이 값을 봅니다 — wc1k · wc1m · wc10m ·
      wcd5k · wc7d · wcw3m · burst7 전부요. 여기를 안 채우면 59명의
      업적이 그날부터 조용히 멈춥니다. 화면에 오류도 안 뜹니다.

   ③ total 은 **줄어들지 않습니다.** 퇴고로 글자가 깎여도 그날 한 일은
      한 일이니까요. 숫자를 낮추면 기준만 조용히 내려갑니다.

   ④ 흐름(wordfeed)에는 **늘어난 만큼만** 나갑니다.
      칸에 든 값은 그 회차의 누적이고, 방에는 차이만 흘려보내요.

   ⑤ **todostat 은 여기서 안 올립니다.** script_data.js 가 예전부터
      하던 일이라, 겹쳐 올리면 방 전체 숫자가 두 배가 됩니다.

   [흐름 규칙 — 콩 확정]
     글자수를 늘림           → +1,200자
     글자수를 줄이거나 지움  → 아무 일 없음
     체크 (글자수 있음)      → 45화 마침 · 6,000자 🎉

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
  const UNITS  = ["화", "챕터"];
  const MAX_EP  = 16;
  const MAX_CNT = 500000;
  const 묶음ms  = 3000;     // 손 떼고 3초 뒤에 한 줄로 묶어 방에 알립니다

  /* 날짜 열쇠는 **글자수 쪽 것을 그대로 빌려 씁니다.**
     따로 만들면 자정 언저리에 둘이 다른 날을 가리켜서, 화면은 오늘인데
     저장은 어제로 들어가는 일이 생겨요 (월요일 아침 사고와 같은 종류). */
  const dayKey = (d) => (window.Wordcount?.dayKey
    ? window.Wordcount.dayKey(d)
    : (() => { const n = d || new Date();
               return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })());

  /* ── 손안의 값 ──────────────────────────────────────────────────
     _eps[id]   = { w, ep, cnt, base, stage, done, doneDay, c, at }
     _works[id] = { name, unit }
     _old[날짜] = { id: {…} }   예전 날짜별 줄 — **읽기만** 합니다        */
  let _eps = {};
  let _works = {};
  let _old = {};
  let _ref = null, _wref = null;

  const 회차들 = () => _eps;
  const 작품 = (id) => _works[id] || null;
  const 옛줄 = (day) => _old[day] || {};

  /* =====================================================================
     듣기 — 내 것만 봅니다 (남의 기록은 규칙이 막습니다)
     ===================================================================== */
  function listen() {
    const nick = me();
    if (!nick || !window.db) return;
    stop();
    _ref = window.db.ref("worklog/" + nick);
    _ref.on("value", (snap) => {
      const v = snap.val() || {};
      _eps = v.ep || {};
      /* 예전에 날짜별로 적어 둔 줄 — 주간 달력에서 함께 보여 줍니다.
         새로 쓰지는 않아요 (2026-08-22 개편). */
      _old = {};
      Object.keys(v).forEach(k => { if (/^\d{4}-\d{2}-\d{2}$/.test(k)) _old[k] = v[k] || {}; });
      기준맞추기();
      window.renderWorklogIfOpen?.();
      window.renderRoomBoard?.();
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
     쓰기 — 회차 한 칸
     ===================================================================== */
  const 회차길 = (id) => window.db.ref(`worklog/${me()}/ep` + (id ? "/" + id : ""));

  async function 고치기(id, patch, 조용히) {
    const nick = me();
    if (!nick || !window.db) return;
    const 전 = _eps[id];
    if (!전) return;
    const 뒤 = { ...전, ...patch, at: Date.now() };
    _eps = { ..._eps, [id]: 뒤 };
    /* ★ 조용히 = 지금 그 칸에 숫자를 치는 중이라는 뜻입니다. 다시 그리면
       입력칸이 갈려서 커서가 날아가요 (2026-08-21 콩 신고). */
    if (!조용히) window.renderWorklogIfOpen?.();
    try {
      await 회차길(id).update({ ...patch, at: 뒤.at });
    } catch (e) {
      _eps = { ..._eps, [id]: 전 };
      window.renderWorklogIfOpen?.();
      console.warn("[worklog] 고치기 실패", e);
    }
  }

  /** 회차 하나 만들기. 만들어진 id 를 돌려줍니다. */
  async function 회차더하기(w, ep) {
    const nick = me();
    const 번호 = String(ep || "").trim().slice(0, MAX_EP);
    if (!nick || !번호 || !window.db) return null;
    const id = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const 칸 = { ep: 번호, stage: "초고", done: false, c: Date.now(), at: Date.now() };
    if (w) 칸.w = String(w).slice(0, 24);
    /* ★ 같은 회차를 전에 쓴 적이 있으면 거기서 이어 갑니다 —
       기준을 0 으로 두면 이미 쓴 분량이 오늘 것으로 잡혀요. */
    const 물려받을것 = 지난분량(칸.w, 번호, null);
    if (물려받을것) { 칸.base = 물려받을것; 칸.cnt = 물려받을것; }

    _eps = { ..._eps, [id]: 칸 };
    _보낸[id] = Number(칸.cnt) || 0;
    window.renderWorklogIfOpen?.();
    try { await 회차길(id).set(칸); }
    catch (e) {
      delete _eps[id];
      window.renderWorklogIfOpen?.();
      console.warn("[worklog] 더하기 실패", e);
      return null;
    }
    return id;
  }

  /** 여러 회차를 한꺼번에 — "1-5" 처럼 적었을 때 */
  async function 회차여럿(w, 처음, 끝) {
    const a = Number(처음), b = Number(끝);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    const 낮 = Math.min(a, b), 높 = Math.max(a, b);
    if (높 - 낮 > 49) return 0;                 // 한 번에 쉰 개까지
    let 만든수 = 0;
    for (let n = 낮; n <= 높; n++) {
      if (await 회차더하기(w, String(n))) 만든수++;
    }
    return 만든수;
  }

  async function 지우기(id) {
    const 전 = _eps[id];
    if (!전) return;
    delete _eps[id];
    delete _보낸[id];
    window.renderWorklogIfOpen?.();
    try { await 회차길(id).remove(); }
    catch (e) {
      _eps = { ..._eps, [id]: 전 };
      window.renderWorklogIfOpen?.();
    }
  }

  /* =====================================================================
     ★ 글자수 — 여기가 이 파일의 심장입니다
     ---------------------------------------------------------------------
     칸에 든 값은 그 회차의 **누적**입니다. 5,200 을 6,000 으로 고치면
     늘어난 800 만 방으로 흘러가고, **그 날** 합계에도 800 만 더해집니다.
     콩의 표현으로는 "기준 0 으로 된 계산기" 예요.

     ★★ 회차 칸은 **날짜에 안 묶입니다** (2026-08-22 개편).
        1~5화를 미리 만들어 두고 며칠에 걸쳐 씁니다. 글자수를 올릴 때마다
        늘어난 만큼이 **그 날** wordlog 로 들어가요. 날짜는 여기서 셈하지
        않고 "지금이 며칠인가" 만 봅니다.
     ===================================================================== */
  const _보낸 = {};      // id → 마지막으로 셈에 넣은 값
  const _타이머 = {};
  const _저장타이머 = {};

  function 기준맞추기() {
    Object.entries(_eps).forEach(([id, r]) => {
      if (_보낸[id] === undefined) _보낸[id] = Number(r.cnt) || Number(r.base) || 0;
    });
  }

  function 글자수바뀜(id, 값, 조용히) {
    const v = Math.max(0, Math.min(MAX_CNT, Number(값) || 0));
    const 전 = _eps[id];
    if (!전) return;
    _eps = { ..._eps, [id]: { ...전, cnt: v } };
    if (!조용히) window.renderWorklogIfOpen?.();

    clearTimeout(_저장타이머[id]);
    _저장타이머[id] = setTimeout(() => 고치기(id, { cnt: v }, true), 800);

    clearTimeout(_타이머[id]);
    _타이머[id] = setTimeout(() => 흘려보내기(id), 묶음ms);
  }

  async function 흘려보내기(id) {
    const r = _eps[id];
    if (!r) return;
    const 지금 = Number(r.cnt) || 0;
    const 전   = Number(_보낸[id]) || 0;
    const 늘어난 = 지금 - 전;
    /* 줄었으면 **아무 일도 없습니다.** 오타를 고친 걸 -3,000자 로
       알릴 수는 없으니까요. 기준만 조용히 내려갑니다. */
    if (늘어난 <= 0) { _보낸[id] = 지금; return; }
    _보낸[id] = 지금;
    await 하루합계더하기(dayKey(), 늘어난);
    await 흐름에({ kind: "add", add: 늘어난, snap: 지금, ep: r.ep, u: 단위(r.w) });
  }

  /* =====================================================================
     ★★ 업적이 보는 자리 — wordlog/{날}/{닉}.total
     여기를 안 채우면 wc1k · wc1m · wc7d · burst7 … 이 전부 멈춥니다.
     화면에는 아무 오류도 안 떠요. 그래서 검사로 못 박았습니다.
     ★ transaction 을 씁니다 — 두 기기에서 동시에 적으면 update 로는
       한쪽이 덮여 사라져요.
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

  /* 흐름 — 방이 함께 보는 자리.
     ★ 회차 번호와 늘어난 글자수만 싣습니다. */
  async function 흐름에(o) {
    const nick = me();
    if (!nick || !window.db) return;
    const 짐 = { nick, at: Date.now() };
    if (o.kind && o.kind !== "add") 짐.kind = o.kind;
    if (o.add > 0) 짐.add = o.add;
    if (o.snap)    짐.snap = o.snap;
    if (o.ep)      짐.ep = String(o.ep).slice(0, MAX_EP);
    /* 흐름 줄에는 작품 id 가 없습니다 (남이 읽는 자리라 안 싣습니다).
       그래서 단위 글자를 함께 실어 보냅니다 — 없으면 "화" 로 읽어요. */
    if (o.u && o.u !== "화") 짐.u = o.u;
    try { await window.db.ref(`wordfeed/${dayKey()}`).push(짐); }
    catch (e) { console.warn("[worklog] 흐름 실패", e); }
  }

  /* =====================================================================
     ★★ 마침 — 날짜가 여기서 정해집니다 (2026-08-22 개편의 핵심)
     ---------------------------------------------------------------------
     회차는 만들 때 아무 날에도 안 속합니다. **체크하는 순간** 그 날
     것으로 확정돼서 주간 달력에 나타나요.
     콩: "오늘은 1,2화를 비축 쌓아서 체크하면, 주간 오늘 날짜에 1,2화를
          썼다고 마무리 짓는 거지."
     ===================================================================== */
  async function 체크(id) {
    const r = _eps[id];
    if (!r) return;
    const 켜짐 = !r.done;
    await 고치기(id, 켜짐 ? { done: true, doneDay: dayKey() }
                          : { done: false, doneDay: null });
    if (켜짐 && Number(r.cnt) > 0) {
      await 흐름에({ kind: "done", ep: r.ep, snap: Number(r.cnt), u: 단위(r.w) });
    }
  }

  async function 상태돌리기(id) {
    const r = _eps[id];
    if (!r) return;
    const at = STAGES.indexOf(r.stage);
    await 고치기(id, { stage: STAGES[(at + 1) % STAGES.length] });
  }

  /* =====================================================================
     작품 이름표 — 콩: "제목은 함부로 노출 안 해요. A, B 로 적을 거예요."
     ===================================================================== */
  function 단위(wid) {
    const u = _works[wid]?.unit;
    return UNITS.indexOf(u) >= 0 ? u : "화";
  }
  async function 작품만들기(name, unit) {
    const nick = me();
    const n = String(name || "").trim().slice(0, 24);
    if (!nick || !n || !window.db) return null;
    const id = "w" + Date.now().toString(36);
    const u = UNITS.indexOf(unit) >= 0 ? unit : "화";
    _works = { ..._works, [id]: { name: n, unit: u } };
    window.renderWorklogIfOpen?.();
    try { await window.db.ref(`workname/${nick}/${id}`).set({ name: n, unit: u }); }
    catch (e) { delete _works[id]; window.renderWorklogIfOpen?.(); return null; }
    return id;
  }
  async function 단위바꾸기(wid) {
    const nick = me();
    const w = _works[wid];
    if (!nick || !w || !window.db) return;
    const 다음 = 단위(wid) === "화" ? "챕터" : "화";
    _works = { ..._works, [wid]: { ...w, unit: 다음 } };
    window.renderWorklogIfOpen?.();
    try { await window.db.ref(`workname/${nick}/${wid}/unit`).set(다음); }
    catch (e) { _works = { ..._works, [wid]: w }; window.renderWorklogIfOpen?.(); }
  }
  async function 작품지우기(id) {
    const nick = me();
    if (!nick || !window.db) return;
    /* 회차에 붙은 딱지는 그대로 둡니다 — 이름표만 사라져요. */
    delete _works[id];
    window.renderWorklogIfOpen?.();
    try { await window.db.ref(`workname/${nick}/${id}`).remove(); } catch (e) {}
  }

  /* =====================================================================
     집계
     ===================================================================== */
  /** 그 회차를 전에 쓴 적이 있으면 마지막 분량 (없으면 0) */
  function 지난분량(wid, ep, 뺄id) {
    if (!ep) return 0;
    let 최신 = null;
    Object.entries(_eps).forEach(([id, r]) => {
      if (id === 뺄id) return;
      if ((r.w || null) !== (wid || null) || String(r.ep) !== String(ep)) return;
      const t = Number(r.at) || 0;
      if (!최신 || t >= 최신.at) 최신 = { cnt: Number(r.cnt) || 0, at: t };
    });
    /* 예전 날짜별 줄에도 같은 회차가 있을 수 있습니다 */
    Object.values(_old).forEach(rows => Object.values(rows || {}).forEach(r => {
      if ((r.w || null) !== (wid || null) || String(r.ep) !== String(ep)) return;
      const t = Number(r.at) || 0;
      if (!최신 || t >= 최신.at) 최신 = { cnt: Number(r.cnt) || 0, at: t };
    }));
    return 최신 ? 최신.cnt : 0;
  }

  /** 그 날 마친 회차들 — 주간 달력이 씁니다 */
  function 날마침(day) {
    return Object.entries(_eps)
      .filter(([, r]) => r.done && r.doneDay === day)
      .map(([id, r]) => ({ id, ...r }));
  }

  /** 작품 하나의 회차별 글자수 — { "45": {cnt, stage}, … } */
  function 작품회차(wid) {
    const m = {};
    const 담기 = (r) => {
      if ((r.w || null) !== (wid || null) || !r.ep) return;
      const 전 = m[r.ep];
      if (!전 || (Number(r.at) || 0) >= (전.at || 0)) {
        m[r.ep] = { cnt: Number(r.cnt) || 0, stage: r.stage || null, at: Number(r.at) || 0 };
      }
    };
    Object.values(_eps).forEach(담기);
    Object.values(_old).forEach(rows => Object.values(rows || {}).forEach(담기));
    return m;
  }

  /* =====================================================================
     [철거 2026-08-22 — 콩] 할 일 이어받기·todostat 올리기
     ---------------------------------------------------------------------
     Work Log 는 이제 **회차와 글자수만** 다룹니다. 할 일 관리는
     ✍️ 메모 탭의 슬래시 명령(/오늘 · /완료)과 나의 작업 창이 맡아요.
     콩: "할일과 글자수가 섞이니까 공간만 차지하고 정신이 없어."
     ★ todostat 은 script_data.js 가 예전부터 하던 대로 올립니다 —
       여기서 겹쳐 올리면 숫자가 두 배가 됩니다.
     ===================================================================== */

  window.Worklog = {
    STAGES, UNITS, dayKey,
    listen, stop, 기준맞추기,
    회차들, 옛줄, 작품, 작품들: () => _works, 단위,
    회차더하기, 회차여럿, 고치기, 지우기, 체크, 상태돌리기, 글자수바뀜,
    작품만들기, 작품지우기, 단위바꾸기,
    지난분량, 날마침, 작품회차,
    _state: () => ({ eps: _eps, works: _works, old: _old, sent: _보낸 })
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

  /* ★★ [고침 2026-08-21] 여기서 또 밟았습니다.
     script_core.js 의 myNick 은 **최상위 let** 이라 window 에 안 붙습니다.
     그래서 window.myNick 은 늘 빈 글자예요.

     이걸 두 군데서 쓰고 있었고, 둘 다 조용히 틀렸습니다 —
       · 아래 "오늘 +N자" 가 늘 **+0자** 로 떴습니다 (콩 캡쳐에서 발견)
       · 🔥 흐름에서 **내 줄이 한 번도 내 줄로 안 잡혔습니다**

     자료실에서 한 번, 여기서 두 번. 늘 이 me() 를 거칩니다. */
  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }
  const 콤마 = (n) => Number(n || 0).toLocaleString("ko-KR");
  const 요일 = ["일", "월", "화", "수", "목", "금", "토"];
  /* 숫자면 단위를 붙이고, "프롤로그" 처럼 글자면 그대로 둡니다.
     ★ 단위는 **작품마다** 다릅니다 — 연재는 화, 단행은 챕터 (콩 0821).
       wid 를 모르는 자리(흐름 줄)에서는 실려 온 글자를 씁니다. */
  const 화 = (ep, 단위글) => ep + (/^\d+$/.test(ep) ? (단위글 || "화") : "");
  const 회차글 = (wid, ep) => 화(ep, W().단위(wid));

  /* =====================================================================
     ★★ 줄 차례는 **만든 때**로 매깁니다 (2026-08-21 고침 — 콩 신고)
     ---------------------------------------------------------------------
     [무슨 일이 있었나]
     at(마지막 손댄 시각)으로 줄을 세웠더니, 딱지 하나만 눌러도 그 줄의
     at 이 "지금" 이 되면서 **맨 아래로 쑥 내려갔습니다.** 같은 자리를
     이어서 누르면 그새 다른 줄이 올라와 있으니, 딱지가 저 혼자
     순차적으로 바뀌는 것처럼 보였어요.

     [그래서]
     id 앞머리에 만든 시각이 박혀 있습니다 (`${Date.now()}_${랜덤}`).
     그걸 씁니다 — 무엇을 고치든 줄은 **제자리에 있습니다.**
     ※ at 은 그대로 둡니다. 작품회차() 가 "같은 회차를 여러 날 썼으면
       마지막 값" 을 고를 때 여전히 필요해요.
     ===================================================================== */
  const 만든때 = (id, r) =>
    Number(r?.c)                                   // ① 적어 둔 만든 때
    || Number(String(id).split("_")[0])            // ② id 앞머리에 박힌 시각
    || Number(r?.at) || 0;                         // ③ 옛 줄을 위한 마지막 수단
  const 차례대로 = (obj) => Object.entries(obj || {})
    .sort((a, b) => {
      const d = 만든때(a[0], a[1]) - 만든때(b[0], b[1]);
      /* 같은 밀리초에 만들어진 줄이 있을 수 있습니다 (이어받기가 여러
         개를 잇달아 만들 때). 그때는 id 로 갈라 늘 같은 차례가 되게. */
      return d !== 0 ? d : (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    });
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

  let _고른작품 = null;    // 회차 만들 때 고른 작품
  let _주시작 = null;
  let _펼친날 = null;
  let _열린작품 = null;
  let _회페이지 = {};


  const 오늘키 = () => W().dayKey();
  /* [철거 2026-08-22] _보는날 — 오늘 탭이 날짜를 안 봅니다.
     회차는 날짜에 안 묶이거든요. 주간 탭만 주를 옮겨 다닙니다. */
  function 주시작() {
    if (!_주시작) { const d = new Date(); d.setHours(0,0,0,0);
                    d.setDate(d.getDate() - d.getDay()); _주시작 = d; }
    return _주시작;
  }

  /* ═══════════════════ 탭 ①  오늘 ═══════════════════ */
  /* =====================================================================
     ✍️ 오늘 탭 — **회차만** 놓습니다 (2026-08-22 개편)
     ---------------------------------------------------------------------
     [무엇이 달라졌나]
     예전에는 한 줄이 "할 일이자 글자수" 였습니다. 그런데 둘이 섞이니까
     자리만 차지하고 헷갈렸어요 — 콩: "동시에 돌아간다는 걸 멤버들이
     이해를 못해."

     이제 갈라 둡니다.
         할 일   →  ✍️ 메모 탭의 슬래시 명령 · 나의 작업 창
         글자수  →  ① 기존 방식(아래 입력줄)  ② 작품·회차 (여기)

     [회차는 날짜에 안 묶입니다]
     1~5화를 미리 만들어 두고 며칠에 걸쳐 씁니다. **체크하는 날**이
     그 회차를 마친 날이 되고, 그때 주간 달력에 나타나요.
     ===================================================================== */
  function 오늘탭() {
    const W = window.Worklog;
    const eps = W.회차들();
    const 목록 = Object.entries(eps).sort((a, b) => {
      /* 작품 → 회차 번호 차례. 번호가 아니면 뒤로 */
      const [ai, A] = a, [bi, B] = b;
      const w = String(A.w || "").localeCompare(String(B.w || ""));
      if (w) return w;
      const na = Number(A.ep), nb = Number(B.ep);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      if (Number.isFinite(na)) return -1;
      if (Number.isFinite(nb)) return 1;
      return String(A.ep).localeCompare(String(B.ep));
    });

    const 줄HTML = 목록.length ? 목록.map(([id, r]) => {
      const w = r.w ? W.작품(r.w) : null;
      const col = r.w ? 작품색(r.w) : null;
      const 이름 = (w ? esc(w.name) + " · " : "") + esc(회차글(r.w, r.ep));
      return `<div class="wl-ep${r.done ? " done" : ""}">
        <button class="wl-chk${r.done ? " on" : ""}" data-wl="chk" data-id="${id}"
                aria-label="마침" aria-pressed="${r.done}">${r.done ? "✓" : ""}</button>
        <span class="wl-epname"${col ? ` style="color:${col.c}"` : ""}>${이름}</span>
        <span class="wl-stage wl-s-${r.stage || "초고"}" data-wl="stage" data-id="${id}"
              title="눌러서 바꾸기">${esc(r.stage || "초고")}</span>
        <span class="wl-cw"><input class="wl-cnt" data-wl="cnt" data-id="${id}"
              value="${r.cnt ? 콤마(r.cnt) : ""}" placeholder="0" inputmode="numeric"><i>자</i></span>
        <button class="wl-del" data-wl="del" data-id="${id}" title="이 회차 지우기">✕</button>
      </div>`;
    }).join("") : `<p class="wl-empty">아직 만든 회차가 없어요.<br>
        아래에서 <b>1-5</b> 처럼 적으면 다섯 개가 한 번에 생깁니다.</p>`;

    /* 아래 요약 — 왼쪽은 오늘 늘어난 양(업적·흐름과 같은 숫자) */
    let 오늘늘 = 0;
    try {
      const t = window.Wordcount?._state?.().today;
      오늘늘 = Number(t?.[me()]?.total || 0);
    } catch (e) {}
    const 마친것 = W.날마침(W.dayKey()).map(r => 회차글(r.w, r.ep));

    return `<div class="wl-epadd">
        ${작품고르개()}
        <input class="wl-epnum" id="wl-ep-new" maxlength="16"
               placeholder="회차 — 1 · 1-5 · 프롤로그">
        <button type="button" class="wl-add compact" data-wl="addep">＋ 만들기</button>
      </div>
      <div class="wl-eps">${줄HTML}</div>
      <div class="wl-sum">
        <span class="wl-t">오늘 <b>+${콤마(오늘늘)}</b>자</span>
        <span class="wl-g">${마친것.length ? esc(마친것.join(" · ")) + " 마침" : ""}</span>
      </div>
      ${흐름HTML()}`;
  }

  /** 작품 고르는 작은 드롭다운 (없으면 만들기 단추) */
  function 작품고르개() {
    const works = window.Worklog.작품들();
    const ids = Object.keys(works);
    if (!ids.length) {
      return `<button type="button" class="wl-tag" data-wl="newwork">＋ 작품 먼저</button>`;
    }
    return `<select class="wl-epwork" id="wl-ep-work" aria-label="작품 고르기">
      ${ids.map(id => `<option value="${id}"${id === _고른작품 ? " selected" : ""}>${esc(works[id].name)}</option>`).join("")}
    </select>`;
  }

  /* 🔥 오늘 몇 명이 썼나 — 이미 받아 둔 wordlog 를 세기만 합니다.
     ★ 흐름(wordfeed)으로 세면 안 됩니다 — limitToLast 라 바쁜 날엔
       아침에 올린 사람이 밀려나서 참여자가 **줄어듭니다.** */
  function 오늘참여자() {
    try {
      const t = window.Wordcount?._state?.().today || {};
      return Object.values(t).filter(v => Number(v?.total) > 0).length;
    } catch (e) { return 0; }
  }
  function 흐름이름표() {
    const n = 오늘참여자();
    return n > 0 ? `🔥 지금 ${n}명 참여 중` : "🔥 지금 방에서";
  }

  function 흐름HTML() {
    const st = window.Wordcount?._state?.();
    const feed = (st?.feed || []).filter(f => f && f.type !== "pomo");
    if (!feed.length) return `<div class="wl-feed"><div class="wl-fh">${흐름이름표()}</div>
      <div class="wl-fempty">아직 조용해요. 첫 줄을 올려 보세요.</div></div>`;
    const 줄 = feed.slice(-14).reverse().map(f => {
      const 내것 = !!me() && f.nick === me();
      let 말;
      if (f.kind === "done")       말 = `<b>${esc(화(f.ep || "", f.u))} 마침</b>${f.snap ? " · " + 콤마(f.snap) + "자" : ""} 🎉`;
      /* "시작" 은 더 이상 만들지 않습니다 (2026-08-21 콩). 오늘 이미
         쌓인 옛 줄이 있을 수 있어 읽기만 남겨 둡니다. */
      else if (f.kind === "start") 말 = `<b>${esc(화(f.ep || "", f.u))}</b> 시작`;
      else                         말 = `+${콤마(f.add)}자`;
      /* [2026-08-21 콩 — B안] 내 줄에는 왼쪽에 가는 색 띠 하나.
         일부러 얌전하게 둡니다 — 이 자리는 "남이 쓰는 게 보여서 나도
         쓰게 되는" 곳이라, 내 줄이 너무 튀면 남의 줄이 배경처럼
         보여서 그 효과가 되레 줄어요. */
      return `<div class="wl-fl${f.kind === "done" ? " big" : ""}${내것 ? " me" : ""}">
        <span class="wl-who${내것 ? " me" : ""}">${esc(f.nick)}</span>
        <span class="wl-what">${말}</span>
        <span class="wl-ago">${언제(f.at)}</span></div>`;
    }).join("");
    return `<div class="wl-feed"><div class="wl-fh">${흐름이름표()}</div>
      <div class="wl-fb">${줄}</div></div>`;
  }
  function 언제(at) {
    const m = Math.floor((Date.now() - (Number(at) || 0)) / 60000);
    if (m < 1) return "방금";
    if (m < 60) return m + "분";
    return Math.floor(m / 60) + "시간";
  }

  /* ═══════════════════ 탭 ②  주간 ═══════════════════ */
  /* =====================================================================
     📅 주간 탭 — 그 날 **마친 회차**와 그 날 쓴 글자수
     ---------------------------------------------------------------------
     회차는 날짜에 안 묶이지만, 체크한 날(doneDay)은 남습니다. 그 날을
     여기서 보여 줘요 — "오늘 1화, 2화 마침" 하고 마무리 짓는 자리.
     ★ 예전에 날짜별로 적어 둔 줄도 함께 보여 줍니다 (안 지웠습니다).
     ===================================================================== */
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
      const 마친 = W().날마침(day);
      const 옛 = Object.values(W().옛줄(day));
      const 총 = 그날글자수(day);
      const 이름들 = 마친.map(r => 회차글(r.w, r.ep));
      let 요약 = 이름들.length ? `<b>${esc(이름들.join(", "))}</b> 마침` : "";
      if (옛.length) 요약 += (요약 ? " · " : "") + `옛 기록 ${옛.length}줄`;
      if (!요약) 요약 = "—";
      const 펼칠것 = 마친.length + 옛.length;
      html += `<div class="wl-d${day === 오늘키() ? " today" : ""}${_펼친날 === day ? " open" : ""}">
        <div class="wl-dh" data-wl="fold" data-k="${day}">
          <span class="wl-dw${d.getDay() === 0 ? " sun" : ""}">${요일[d.getDay()]}</span>
          <span class="wl-dn">${d.getDate()}</span>
          <span class="wl-dl">${요약}</span>
          <span class="wl-dc${총 ? "" : " zero"}">${총 ? 콤마(총) + "자" : "·"}</span>
          <span class="wl-dx">${펼칠것 ? "▸" : ""}</span>
        </div>
        ${펼칠것 ? `<div class="wl-db">${
          마친.map(r => {
            const col = r.w ? 작품색(r.w) : null;
            return `<div class="wl-di">
              <span class="wl-p"${col ? ` style="background:${col.s};color:${col.c}"` : ' class="wl-p plain"'}>${esc(회차글(r.w, r.ep))}</span>
              <span class="wl-n">${esc(r.stage || "")}</span>
              <span class="wl-c">${r.cnt ? 콤마(r.cnt) + "자" : "·"}</span></div>`;
          }).join("") +
          옛.map(r => `<div class="wl-di">
              <span class="wl-p plain">옛 기록</span>
              <span class="wl-n">${esc(r.t) || "—"}</span>
              <span class="wl-c">${r.cnt ? 콤마(r.cnt) + "자" : "·"}</span></div>`).join("")
        }</div>` : ""}
      </div>`;
    }
    return html + `</div>
      <p class="wl-note">회차는 <b>체크한 날</b>에 들어갑니다. 며칠에 걸쳐 써도
      마무리 짓는 날 하루에 얹혀요.</p>`;
  }

  /** 그 날 쓴 글자수 — 이미 받아 둔 주간 자료에서 (새로 안 읽습니다) */
  function 그날글자수(day) {
    try {
      const st = window.Wordcount?._state?.();
      const 나 = me();
      if (st?.week?.[day]?.[나]) return Number(st.week[day][나].total || 0);
      if (day === 오늘키() && st?.today?.[나]) return Number(st.today[나].total || 0);
    } catch (e) {}
    return 0;
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
      const u = W().단위(id);
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
            ? `<div class="wl-epc"><i style="background:${상태색(rec.stage)}"></i><span class="e">${번}${u}</span><span class="c">${콤마(rec.cnt)}자</span></div>`
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
            <span>${u} 이동 · ${시작}–${시작 + 14}</span>
            <button data-wl="ep" data-id="${id}" data-v="1" ${쪽 >= 총쪽 - 1 ? "disabled" : ""}>›</button>
          </div>
          <div class="wl-eptbl">${세로.join("")}</div>
          <div class="wl-legend">${W().STAGES.map(s =>
            `<span><i style="background:${상태색(s)}"></i>${s}</span>`).join("")}
            <span class="wl-unit">
              <button class="${u === "화" ? "on" : ""}" data-wl="unit" data-id="${id}" data-v="화">화</button>
              <button class="${u === "챕터" ? "on" : ""}" data-wl="unit" data-id="${id}" data-v="챕터">챕터</button>
            </span>
            <button class="wl-wdel" data-wl="delwork" data-id="${id}">작품 지우기</button></div>
        </div>`;
      }

      html += `<div class="wl-pjr${열림 ? " open" : ""}">
        <div class="wl-pjh" data-wl="openwork" data-id="${id}">
          <div class="wl-pjt">
            <span class="nm" style="color:${col.c}">${esc(w.name)}</span>
            <span class="ep">${최대 ? 최대 + u + "까지" : (키.length ? 키.length + "편" : "아직 없음")}</span>
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
  /* =====================================================================
     ★★ 다시 그리기 문지기 (2026-08-21 고침 — 콩: "커서가 옮겨가는 느낌")
     ---------------------------------------------------------------------
     [무슨 일이 있었나]
     글자수 칸에 4 를 치면
        input → 고치기() → 다시 그리기 → **입력칸이 새 것으로 갈림**
     이 됩니다. 브라우저는 새 칸을 원래 칸으로 못 알아봐서 커서가
     날아가고, 이어서 4 를 더 치면 엉뚱한 데로 들어갔어요.
     서버 응답(_ref.on)이 돌아올 때도 같은 일이 한 번 더 납니다.

     [그래서]
     **칸에 손이 올라가 있는 동안에는 절대 다시 그리지 않습니다.**
     그리고 싶었던 것은 밀어 두었다가, 손을 뗄 때 한 번에 그립니다.

     ※ 한글 조합(자소 분리)도 같은 뿌리의 사고예요 — 조합 중에 요소를
       갈아치우면 "ㅎ ㅏ ㄴ" 으로 흩어집니다.
     ===================================================================== */
  let _밀린그리기 = false;

  function 손올라가있나() {
    const a = document.activeElement;
    if (!a || !a.closest) return false;
    const b = a.closest("[data-wl]");
    if (!b) return false;
    /* 글을 쓰는 칸일 때만 막습니다 — 단추는 눌러도 다시 그려야 하니까요 */
    return b.dataset.wl === "txt" || b.dataset.wl === "cnt";
  }

  window.renderWorklogIfOpen = function () {
    const host = el("wc-rows");
    if (!host || !/^wl/.test(String(window.Wordcount?._state?.().tab || ""))) return;
    if (손올라가있나()) { _밀린그리기 = true; return; }
    _밀린그리기 = false;
    render(window.Wordcount._state().tab, host);
  };

  /** 손을 뗐습니다 — 밀어 둔 그리기가 있으면 이제 그립니다 */
  function 밀린것그리기() {
    if (!_밀린그리기) return;
    _밀린그리기 = false;
    window.renderWorklogIfOpen();
  }

  /* ═══════════════════ 손가락 ═══════════════════ */
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-wl]");
    if (!b) return;
    const act = b.dataset.wl, id = b.dataset.id;
    const W = window.Worklog;

    /* ── 주 넘기기 · 펼치기 ── */
    if (act === "week") {
      const s2 = 주시작(); s2.setDate(s2.getDate() + Number(b.dataset.v) * 7);
      _주시작 = s2; window.renderWorklogIfOpen(); return;
    }
    if (act === "fold") {
      _펼친날 = _펼친날 === b.dataset.k ? null : b.dataset.k;
      window.renderWorklogIfOpen(); return;
    }

    /* ── 회차 만들기 ── */
    if (act === "addep") {
      const 칸 = el("wl-ep-new");
      const 값 = String(칸?.value || "").trim();
      if (!값) { 칸?.focus(); return; }
      const wsel = el("wl-ep-work");
      const w = wsel ? wsel.value : null;
      _고른작품 = w;
      /* "1-5" 처럼 적으면 한 번에 여럿 */
      const m = 값.match(/^(\d+)\s*[-~]\s*(\d+)$/);
      if (m) await W.회차여럿(w, m[1], m[2]);
      else   await W.회차더하기(w, 값);
      if (칸) 칸.value = "";
      window.renderWorklogIfOpen(); return;
    }
    if (act === "chk")   { await W.체크(id); return; }
    if (act === "del")   { await W.지우기(id); return; }
    if (act === "stage") { await W.상태돌리기(id); return; }

    /* ── 작품 ── */
    if (act === "newwork") {
      const n = prompt("작품 이름을 적어 주세요.\n제목 대신 A · B 처럼 적어도 됩니다.");
      if (n && n.trim()) _고른작품 = await W.작품만들기(n.trim());
      window.renderWorklogIfOpen(); return;
    }
    if (act === "openwork") { _열린작품 = _열린작품 === id ? null : id;
                              window.renderWorklogIfOpen(); return; }
    if (act === "ep") { _회페이지[id] = Math.max(0, (_회페이지[id] || 0) + Number(b.dataset.v));
                        window.renderWorklogIfOpen(); return; }
    if (act === "unit") {
      if (b.dataset.v !== W.단위(id)) await W.단위바꾸기(id);
      window.renderWorklogIfOpen(); return;
    }
    if (act === "delwork") {
      if (!confirm("이 작품을 목록에서 지웁니다.\n\n" +
                   "이미 적어 둔 회차와 글자수 기록은 그대로 남아요 —\n" +
                   "작품 이름만 사라집니다. 되살릴 수는 없습니다.")) return;
      await W.작품지우기(id); _열린작품 = null;
      window.renderWorklogIfOpen(); return;
    }
  });

  /* 글자수 치기 — ★ 다시 그리지 않습니다.
     치는 동안 요소를 갈아치우면 커서가 날아가요 (2026-08-21 콩 신고). */
  document.addEventListener("input", (e) => {
    const b = e.target.closest("[data-wl='cnt']");
    if (!b) return;
    const v = Number(String(b.value).replace(/[^\d]/g, "")) || 0;
    window.Worklog.글자수바뀜(b.dataset.id, v, true);
  });

  /* 회차 칸에서 엔터 = 만들기 */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    if (e.target?.id !== "wl-ep-new") return;
    e.preventDefault();
    document.querySelector('[data-wl="addep"]')?.click();
  });

  /* 손을 떼면 콤마를 다시 찍고, 밀어 둔 그리기를 합니다 */
  document.addEventListener("blur", (e) => {
    const b = e.target.closest?.("[data-wl='cnt']");
    if (!b) return;
    const v = Number(String(b.value).replace(/[^\d]/g, "")) || 0;
    b.value = v ? 콤마(v) : "";
    setTimeout(밀린것그리기, 60);
  }, true);

  window.worklogGoToday = () => {
    document.querySelector('[data-wc-tab="wl"]')?.click();
  };
})();
