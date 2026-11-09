/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_deadline.js — ⏰ 데드라인 (2026-10-12 — 콩)
   ---------------------------------------------------------------------
   콩트의 Deadline(일정 계산기)을 홈피 크기로 줄여 옮긴 옆 탭.
   "마감일 + 써야 할 양 → 오늘 몇 자 쓰면 되는지". 작품은 **한 페이지에 카드로** 여럿.

   [어디에 남나]
     users/{닉}/deadlines = { n: 지금까지 준 알파벳 수, works: { A: {…}, B: {…} } }
       → 본인과 방장만 읽고 씁니다 (users/$nick 규칙 그대로 — 규칙 추가 없음).
     status/{닉}/dlP · dlK = 오늘 목표 달성도(0~200, 정수) · 그 날짜 — 카드의 🎯 목표 줄 바용 (공개 숫자 하나)
   작품 칸 = {
     t 제목(나만 봄, 20자) · s 시작일 · d 마감일 · b 마감 며칠 전에 끝낼까
     u 'ch'(글자수 방식) | 'ep'(화수 방식) · c 총 글자수 · e 총 화수(반화=0.5 단위)
       ★ [2026-11-09 — 콩] 화수 방식은 **글자수를 세지 않습니다**. done·d0·sn·오늘 몫이 전부 "화" 단위(0.5 단위)이고,
         카드의 [1화 박스 · 반화 박스]를 눌러 체크해요. 워크로그와 연결하지 않습니다(글자수 방식만 연결).
     w 요일별 { 0~6: 'h'(적게=절반) | 'o'(쉼) }  — 없으면 보통
     done 지금까지 쓴 글자(전체) · d0 오늘 아침(그날 첫 접속) 때의 done · sn 마지막 계산 때의 done
     k0 d0 를 잡은 날짜 · bs 워크로그 기준(출발선, 알파벳별) · cl 작업 마감한 날짜 }

   [알파벳] 작품을 만들면 A, B, C… Z, AA, AB… ZZ, AAA… ZZZ 순서로 이름표가 자동으로 붙습니다 (2026-11-09 — 콩).
     지운 이름표는 다시 안 씁니다(예전 워크로그 기록과 섞이지 않게). **한 번에 둘 수 있는 작품은 26개까지**(탭이 길어지지 않게).
     워크로그 연동은 **이름표로만** — 제목은 나만 보는 꼬리표. 작품 추가는 [추가/취소] 확인을 한 번 거칩니다.

   [계산 = 도장 하나] "지금까지 쓴 글(done)을 기준으로 **내일부터의 몫**을 다시 나눈다" 가 전부입니다.
     오늘 몫은 d0(오늘 아침)으로 정해져 하루 종일 그대로고, 계산은 sn=done 을 찍을 뿐이라
     같은 상태에서 몇 번 돌려도 결과가 같아요(접종 후 재접속해도 그대로).
     언제 도나:  ① 접속할 때 한 번 자동  ② 탭의 [🔄 지금 계산하기]  ③ 접속한 채 자정이 지나면 새 날 첫 계산
                ④ 그 작품의 오늘 쓴 글이 **오늘 몫을 넘긴 순간**(눈으로 바로 확인) — 모자란 입력은 중간일 수 있어 안 돕니다.
     ⑤ [🌙 작업 마감] — 오늘 못 채운 몫도 "안 쓴 것"으로 확정하고 내일부터 나눕니다(cl = 마감한 날짜).
        마감한 날은 글이 더해질 때마다 바로 다시 계산해요. [☀️ 재개]를 누르면 "못 채운 몫은 오늘 안에 쓸 것"으로 되돌립니다.
        날짜·오늘 몫(d0)·쓴 글자(done)는 마감/재개에 관계없이 그대로 이어져요 — 같은 날 다시 출근해도 이전 수치에 더해집니다.
     ★ 창을 닫을 때(접종) 자동 계산은 없습니다 — 닫는 순간 저장이 끝까지 간다는 보장이 없어서요.

   [통신량] 입장할 때 한 번 읽고(once), 탭을 열 때 한 번 더 읽습니다. 쓰기는 고칠 때만.
     듣기(on)는 없습니다. 글자 더하기는 transaction 이라 창이 둘 열려 있어도 서로 덮지 않아요.

   ★ DEADLINE_SOLO_ONLY — 지금은 **혼자 방(?solo=1)에서만** 켭니다 (새 기능은 혼자 방 먼저 — 콩).
     본방에 켤 때는 이 값을 false 로, 그리고 script_sidetabs.js 의 deadline 탭 solo 표시를 지웁니다.
   ===================================================================== */
(function () {
  "use strict";
  const DEADLINE_SOLO_ONLY = true;
  const MAX_WORKS = 26;            // 한 번에 둘 수 있는 작품
  const MAX_LABELS = 26 + 676 + 17576;   // A~Z · AA~ZZ · AAA~ZZZ
  const MAX_TITLE = 20;
  const W = { n: 1, h: 0.5, o: 0 };
  const NEXT = { n: "h", h: "o", o: "n" };
  const DN = ["일", "월", "화", "수", "목", "금", "토"];

  const el = (id) => document.getElementById(id);
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? "")) : String(s ?? ""));
  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }
  const enabled = () => !DEADLINE_SOLO_ONLY || window.SOLO === true;
  const num = (v) => Math.max(0, parseInt(String(v == null ? "" : v).replace(/,/g, ""), 10) || 0);
  const comma = (n) => Math.round(n).toLocaleString("ko-KR");
  /* 화수 방식 — 반화(0.5) 단위 · 이 작품 단위로 읽고 쓰기 */
  const half = (v) => Math.max(0, Math.round((parseFloat(String(v == null ? "" : v).replace(/,/g, "")) || 0) * 2) / 2);
  const isEp = (w) => !!w && w.u === "ep";
  const un = (w, v) => (isEp(w) ? half(v) : num(v));
  const trim1 = (n) => String(Math.round(n * 10) / 10);
  const fmtN = (w, n) => (isEp(w) ? `${trim1(n)}화` : `${comma(n)}자`);
  /** 0→A … 25→Z, 26→AA … 701→ZZ, 702→AAA … 18277→ZZZ */
  function labelOf(i) {
    let n = i + 1, s = "";
    while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
    return s;
  }

  /* ---- 날짜 (로컬 달력 날짜 — 워크로그의 dayKey 와 같은 기준) ---- */
  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => keyOf(new Date());
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(parse(s));
  function parse(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); }
  function shift(k, n) { const d = parse(k); d.setDate(d.getDate() + n); return keyOf(d); }
  const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const mode = (w, k) => { const m = (w.w || {})[parse(k).getDay()]; return m === "h" || m === "o" ? m : "n"; };

  /* ---- 메모리 ---- */
  let _d = { n: 0, works: {} };
  let _loaded = false;
  let _open = "";            // 펼친 카드의 알파벳
  let _box = null;
  let _day = "";             // 마지막으로 본 날짜(자정 감시)
  let _msg = "";
  let _askAdd = false;       // [＋ 작품 추가]를 눌러 확인을 기다리는 중

  const base = () => `users/${me()}/deadlines`;
  const letters = () => Object.keys(_d.works || {}).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  const W_ = (L) => (_d.works || {})[L];

  /* =====================================================================
     계산 — 화면과 카드 바가 같은 함수를 씁니다
     ===================================================================== */
  function calc(w) {
    const t = today();
    const total = isEp(w) ? half(w.e) : num(w.c);
    const done = un(w, w.done);
    const d0 = Math.min(un(w, w.d0), done);
    const sn = Math.min(Math.max(un(w, w.sn), d0), done);
    const okD = isDate(w.s) && isDate(w.d);
    const end = okD ? shift(w.d, -num(w.b)) : "";
    const from = okD ? (t > w.s ? t : w.s) : "";
    const left0 = Math.max(0, total - d0);
    const days = {};
    let sum = 0;
    if (okD && end >= from && diff(from, end) < 1100) {
      for (let k = from; k <= end; k = shift(k, 1)) { const m = mode(w, k); days[k] = { m, w: W[m] }; sum += W[m]; }
    }
    let T = 0, state = "ok";
    if (!okD) state = "none";
    else if (t > w.d) state = "late";
    else if (t > end) { state = "buf"; T = left0; }          // 여유일 안 — 남은 건 오늘 안에
    else if (t < w.s) state = "wait";
    else T = sum > 0 ? left0 * (days[t] ? days[t].w : 0) / sum : 0;
    const wT = days[t] ? days[t].w : 0;
    const leftS = Math.max(0, total - sn);
    const closed = w.cl === t;                                   // 오늘 작업 마감함
    const rem = closed ? 0 : Math.max(0, T - (sn - d0));        // 오늘 몫 중 못 채운 만큼 — 마감하면 "안 쓴 것"이라 내일부터 나눔
    const sumF = sum - wT;
    const pool = Math.max(0, leftS - rem);
    Object.keys(days).forEach((k) => { days[k].q = k === t ? T : (sumF > 0 ? pool * days[k].w / sumF : 0); });
    const wrote = done - d0;
    return { t, total, done, d0, sn, closed, noRoom: sumF <= 0, left: Math.max(0, total - done), T, state, days, wrote,
             over: state !== "none" && wrote > 0 && wrote > T, fresh: done - sn,
             tom: days[shift(t, 1)] ? days[shift(t, 1)].q : null };
  }

  /** 카드·탭 맨 위가 같이 쓰는 "오늘 목표 달성도" — { wrote, T, pct(0~200) } */
  function dayStat() {
    /* 글자수 방식과 화수 방식은 단위가 달라 더할 수 없습니다 — 단위별로 따로 비율을 내고 그 평균을 씁니다
       (한 가지 단위만 쓰면 예전과 똑같은 값이에요). */
    const g = { ch: { wrote: 0, T: 0 }, ep: { wrote: 0, T: 0 } };
    letters().forEach((L) => { const w = W_(L), c = calc(w), k = isEp(w) ? "ep" : "ch"; g[k].wrote += c.wrote; g[k].T += c.T; });
    const rs = ["ch", "ep"].filter((k) => g[k].T > 0 || g[k].wrote > 0)
      .map((k) => (g[k].T > 0 ? g[k].wrote / g[k].T * 100 : 100));
    const pct = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;
    return { ch: g.ch, ep: g.ep, pct: Math.max(0, Math.min(200, Math.round(pct))) };
  }
  /** "오늘 진척" 줄 — 쓰는 단위만 보여 줍니다 */
  function sumText(st) {
    const p = [];
    if (st.ch.T > 0 || st.ch.wrote > 0) p.push(`<b>${comma(st.ch.wrote)}</b> / ${comma(st.ch.T)}자`);
    if (st.ep.T > 0 || st.ep.wrote > 0) p.push(`<b>${trim1(st.ep.wrote)}</b> / ${trim1(st.ep.T)}화`);
    return p.length ? p.join(" · ") : `<b>0</b> / 0자`;
  }

  /* =====================================================================
     카드(status)에 싣는 요약 — script_realtime.js 가 부릅니다. 데드라인이 없으면 null
     ===================================================================== */
  window.myDeadline = function () {
    if (!enabled() || !_loaded || !letters().length) return null;
    const s = dayStat();
    return { p: s.pct, k: today() };
  };
  function 카드에알리기() { try { window.updateStatus?.(true); } catch (e) {} }

  /* =====================================================================
     저장
     ===================================================================== */
  async function 칸쓰기(L, patch) {
    if (!me() || !window.db || !W_(L)) return false;
    Object.assign(W_(L), patch);
    const upd = {};
    Object.keys(patch).forEach((k) => { upd[`works/${L}/${k}`] = patch[k] === undefined ? null : patch[k]; });
    try { await window.db.ref(base()).update(upd); } catch (e) { console.warn("[deadline save]", e); return false; }
    return true;
  }

  /** done(+d0) 를 더합니다 — transaction 이라 창이 둘이어도 덮지 않습니다 */
  async function 더하기(L, add, 오늘것아님) {
    const w = W_(L);
    if (!w || !me() || !window.db || isEp(w)) return false;       // 화수 방식은 글자수를 더하지 않아요
    const r = window.db.ref(`${base()}/works/${L}`);
    try {
      const res = await r.transaction((cur) => {
        if (!cur) return cur;
        cur.done = Math.max(0, num(cur.done) + add);
        if (오늘것아님) cur.d0 = Math.max(0, num(cur.d0) + add);
        return cur;
      });
      const v = res && res.snapshot && res.snapshot.val ? res.snapshot.val() : null;
      if (v) Object.assign(w, v);
      else { w.done = Math.max(0, num(w.done) + add); if (오늘것아님) w.d0 = Math.max(0, num(w.d0) + add); }
    } catch (e) { console.warn("[deadline add]", e); return false; }
    return true;
  }

  /* =====================================================================
     계산(도장) — sn = done
     ===================================================================== */
  async function 새날맞추기() {
    const t = today();
    const upd = {};
    letters().forEach((L) => {
      const w = W_(L);
      if (w.k0 !== t) { w.d0 = un(w, w.done); w.k0 = t; upd[`works/${L}/d0`] = w.d0; upd[`works/${L}/k0`] = t; }
    });
    return upd;
  }
  async function 계산하기(which) {
    if (!me() || !window.db || !letters().length) return;
    const upd = await 새날맞추기();
    (which ? [which] : letters()).forEach((L) => { const w = W_(L); if (!w) return; w.sn = un(w, w.done); upd[`works/${L}/sn`] = w.sn; });
    try { await window.db.ref(base()).update(upd); } catch (e) { console.warn("[deadline calc]", e); }
    _day = today();
    draw(); 카드에알리기();
  }

  /** 🌙 작업 마감 — 못 채운 몫까지 내일부터 다시 나눕니다. 날짜는 그대로. */
  async function 마감하기() {
    if (!me() || !window.db || !letters().length) return;
    const t = today();
    const upd = await 새날맞추기();
    letters().forEach((L) => { const w = W_(L); w.cl = t; w.sn = un(w, w.done); upd[`works/${L}/cl`] = t; upd[`works/${L}/sn`] = w.sn; });
    try { await window.db.ref(base()).update(upd); } catch (e) { console.warn("[deadline close]", e); }
    _day = t;
    const parts = [], stuck = [];
    letters().forEach((L) => {
      const c = calc(W_(L));
      if (c.state === "ok" && c.tom !== null) parts.push(`${L} ${fmtN(W_(L), c.tom)}`);
      else if (c.left > 0 && c.state !== "none") stuck.push(L);
    });
    _msg = `🌙 오늘 작업을 마감했어요.` + (parts.length ? ` 내일 몫 — ${parts.join(" · ")}` : "") +
      (stuck.length ? ` (${stuck.join("·")} 은 내일로 나눌 날이 없어요)` : "");
    draw(); 카드에알리기();
  }
  /** ☀️ 재개 — 마감만 풀어요. 쓴 글자·오늘 몫은 그대로, 이어서 더해집니다. */
  async function 재개하기() {
    if (!me() || !window.db) return;
    const t = today(), upd = await 새날맞추기();
    let n = 0;
    letters().forEach((L) => { const w = W_(L); if (w && w.cl === t) { n++; delete w.cl; w.sn = un(w, w.done); upd[`works/${L}/cl`] = null; upd[`works/${L}/sn`] = w.sn; } });
    if (n) { try { await window.db.ref(base()).update(upd); } catch (e) { console.warn("[deadline reopen]", e); } }
    _msg = n ? "☀️ 다시 시작! 쓴 분량은 그대로 이어서 더해져요." : "";
    draw(); 카드에알리기();
  }
  const 마감중 = (w) => !!w && w.cl === today();
  const 바로계산해야 = (L) => { const w = W_(L); return !!w && (마감중(w) || calc(w).over); };

  /* =====================================================================
     워크로그가 부르는 문 — 알파벳 연결
     ===================================================================== */
  const DASH = /^\s*[-–—](?=$|\s)/;
  const LETTER = /^\s*([A-Za-z]{1,3})(?=$|[\s:.\-])/;      // A~Z · AA~ZZ · AAA~ZZZ
  const LONE = /^\s*([A-Za-z]{1,3})\s*[:.\-]?\s*$/;

  /** 어떤 길로 갈지 — {kind:'none'|'single'|'letter'|'skip'|'need'|'unknown', L?} */
  function route(what) {
    if (!enabled() || !_loaded) return { kind: "none" };
    const ks = letters();
    if (!ks.length) return { kind: "none" };
    if (ks.length === 1) return isEp(W_(ks[0])) ? { kind: "none" } : { kind: "single", L: ks[0] };   // 화수 방식 하나뿐이면 글자수는 연결 안 해요
    if (DASH.test(what || "")) return { kind: "skip" };          // 데드라인과 상관없는 글
    const m = LETTER.exec(what || "");
    if (!m) return { kind: "need" };
    const L = m[1].toUpperCase();
    return W_(L) ? { kind: "letter", L } : { kind: "unknown", L };
  }
  const loneLetter = (what) => { const m = LONE.exec(what || ""); return m ? m[1].toUpperCase() : ""; };
  const msgEpMode = (L) => `${L} 작품은 화수 방식이라 데드라인 카드의 박스로 체크해 주세요. (글자수는 오늘 기록에만 올라가요)`;
  const listText = () => letters().join(" / ");
  function msgNeed() { return `어느 작품의 글자수인지 알려 주세요 — ${listText()} 중 하나를 같이 적어 주세요. 예) 글자수 / ${letters()[0] || "A"} (아직 아무것도 올리지 않았어요 · 데드라인과 상관없는 글이면 - 를 적어요)`; }
  function msgUnknown(L) { return `「${L}」 작품은 없어요 — ${listText()} 중에서 골라 주세요. (아직 아무것도 올리지 않았어요)`; }
  function msgNoNum(L) { return `${L} 작품에 몇 자 썼는지 글자수가 빠졌어요. 글자수를 적고 다시 눌러 주세요. (아직 아무것도 올리지 않았어요)`; }

  const letterBase = (L) => { const b = W_(L)?.bs; return (b === undefined || b === null) ? null : num(b); };
  async function setLetterBase(L, v) { return 칸쓰기(L, { bs: num(v) }); }

  /** 워크로그에서 늘어난 만큼(diff) 그 작품에 더하고, 오늘 몫을 넘겼으면 바로 계산합니다 */
  async function addWritten(L, add, bs, opt) {
    const w = W_(L);
    if (!w || isEp(w) || !(add > 0)) return false;
    const ok = await 더하기(L, add, !!(opt && opt.yday));
    if (!ok) return false;
    if (bs !== undefined && bs !== null) await 칸쓰기(L, { bs: num(bs) });
    if (!(opt && opt.yday) && 바로계산해야(L)) { 계산하기(L); }      // 초과(또는 마감한 날) → 바로 (그 작품만)
    else { draw(); 카드에알리기(); }
    return true;
  }

  /* =====================================================================
     불러오기 · 접속할 때 한 번 계산
     ===================================================================== */
  async function load() {
    if (!me() || !window.db) return false;
    try {
      const snap = await window.db.ref(base()).once("value");
      const v = snap.val() || {};
      _d = { n: num(v.n), works: v.works || {} };
      Object.keys(_d.works).forEach((L) => { if (!_d.works[L] || typeof _d.works[L] !== "object") delete _d.works[L]; });
      _loaded = true;
      return true;
    } catch (e) { console.warn("[deadline load]", e); return false; }
  }
  async function listenDeadline() {
    if (!enabled() || !me()) return;
    if (!(await load())) return;
    if (letters().length) await 계산하기();                      // 접속할 때 한 번
    else 카드에알리기();
    _day = today();
  }
  function detachDeadline() { _d = { n: 0, works: {} }; _loaded = false; _box = null; _open = ""; _askAdd = false; }

  /* 접속한 채 자정을 넘기면 새 날 첫 계산 */
  function 자정보기() { if (_loaded && _day && _day !== today()) 계산하기(); }
  setInterval(자정보기, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") 자정보기(); });

  /* =====================================================================
     그리기
     ===================================================================== */
  function barHtml(pct, h) {
    const a = Math.min(100, pct), b = Math.max(0, Math.min(100, pct - 100));
    return `<div class="dl-bar" style="height:${h || 8}px"><i class="a" style="width:${a}%"></i><i class="b" style="width:${b}%"></i></div>`;
  }
  function pillHtml(w) {
    const dd = isDate(w.d) ? diff(today(), w.d) : null;
    if (dd === null) return "";
    if (dd < 0) return `<span class="dl-pill is-past">마감 지남</span>`;
    if (dd === 0) return `<span class="dl-pill is-hot">D-DAY</span>`;
    return `<span class="dl-pill${dd <= 7 ? " is-hot" : ""}">D-${dd}</span>`;
  }

  /** 화수 방식 — 오늘 몫만큼 [1화 박스]와 [반화 박스]. 몫이 딱 안 떨어지면 반화 단위로 올려서 그립니다(계산은 정확한 값).
      앞에서부터 채워지고, 다 채운 뒤엔 점선 [+½]가 하나씩 더 생겨 넘겨 쓴 것도 기록할 수 있어요. */
  function boxesHtml(L, c) {
    const hv = (c.state === "ok" || c.state === "buf") ? Math.ceil(c.T * 2 - 1e-9) : 0;     // 반화 개수
    const items = [];
    let acc = 0;
    for (let i = 0; i < Math.floor(hv / 2); i++) { acc += 1; items.push({ v: 1, acc, k: "w" }); }
    if (hv % 2 === 1) { acc += 0.5; items.push({ v: 0.5, acc, k: "h" }); }
    const baseAcc = acc;
    const extra = Math.max(0, Math.round((c.wrote - baseAcc) * 2));
    for (let e = 1; e <= extra; e++) items.push({ v: 0.5, acc: baseAcc + e * 0.5, k: "x" });
    if (c.wrote >= baseAcc - 1e-9) items.push({ v: 0.5, acc: baseAcc + (extra + 1) * 0.5, k: "x", next: true });
    return `<div class="dl-bx">${items.map((it) => {
      const on = !it.next && it.acc <= c.wrote + 1e-9;
      return `<button type="button" class="dl-b ${it.k}${on ? " on" : ""}" data-dl-bx="${L}" data-dl-acc="${it.acc}" data-dl-v="${it.v}" aria-pressed="${on}" title="${it.v === 1 ? "1화" : "반화"}">${it.v === 1 ? "1화" : (it.k === "x" ? "+½" : "½")}</button>`;
    }).join("")}</div>`;
  }

  function cardHtml(L) {
    const w = W_(L), c = calc(w), open = _open === L;
    const T = c.T, pct = T > 0 ? c.wrote / T * 100 : (c.wrote > 0 ? 100 : 0);
    const tm = c.tom;
    let big;
    if (c.state === "none") big = `<div class="dl-warn">날짜를 넣어 주세요 (펼쳐서 시작일·마감일)</div>`;
    else if (c.total <= 0 && c.state !== "late") big = `<div class="dl-warn">분량을 넣어 주세요 (펼쳐서 총 글자수 또는 화수)</div>`;
    else if (c.state === "late") big = `<div class="dl-warn">마감이 지났어요 · 남은 ${fmtN(w, c.left)}</div>`;
    else if (c.state === "wait") big = `<div class="dl-big"><b>시작 전</b><span>${w.s} 부터</span></div>`;
    else if (T <= 0 && c.state === "ok") big = `<div class="dl-big"><b>오늘은 쉼</b></div>`;
    else big = `<div class="dl-big"><b>${fmtN(w, T)}</b><span>오늘 몫${c.state === "buf" ? " · 여유 없이 오늘 안에!" : ""}</span></div>`;
    const wrote = isEp(w)
      ? `<div class="dl-wrote dl-wrote-ep"><span class="dl-wl">오늘 쓴 화수 <b class="dl-wn">${trim1(c.wrote)}</b>화 ${c.over ? "<b>🎉 초과!</b>" : ""}</span>${boxesHtml(L, c)}</div>`
      : `<div class="dl-wrote">오늘 쓴 글자 <input type="number" min="0" inputmode="numeric" data-dl-f="wrote" data-dl-l="${L}" value="${c.wrote || ""}" placeholder="0"> 자 ${c.over ? "<b>🎉 초과!</b>" : ""}</div>`;
    const edit = open ? `
      <div class="dl-ed">
        <label>제목 (나만 보여요)</label>
        <div class="dl-nm"><span class="dl-badge">${L}</span><input type="text" maxlength="${MAX_TITLE}" data-dl-f="t" data-dl-l="${L}" value="${esc(w.t || "")}" placeholder="비워도 돼요"></div>
        <p class="dl-hint">${isEp(w)
          ? "화수 방식은 워크로그와 연결되지 않아요. 카드의 <b>박스</b>를 눌러 체크해요."
          : `워크로그에는 <b>${L}</b>로 적어요. 예) 글자수 / ${L}`}</p>
        <div class="dl-two"><div><label>시작일</label><input type="date" data-dl-f="s" data-dl-l="${L}" value="${esc(w.s || "")}"></div>
          <div><label>마감일</label><input type="date" data-dl-f="d" data-dl-l="${L}" value="${esc(w.d || "")}"></div></div>
        <label>분량</label>
        <div class="dl-seg"><button type="button" data-dl-u="ep" data-dl-l="${L}" class="${isEp(w) ? "on" : ""}">화수</button><button type="button" data-dl-u="ch" data-dl-l="${L}" class="${isEp(w) ? "" : "on"}">글자수</button></div>
        ${isEp(w)
          ? `<label>총 화수 (반화 단위)</label><input type="number" min="0" step="0.5" inputmode="decimal" data-dl-f="e" data-dl-l="${L}" value="${half(w.e) || ""}">`
          : `<label>총 글자수</label><input type="number" min="0" data-dl-f="c" data-dl-l="${L}" value="${num(w.c) || ""}">`}
        <div class="dl-two"><div><label>${isEp(w) ? "지금까지 쓴 화수" : "지금까지 쓴 글자(전체)"}</label><input type="number" min="0"${isEp(w) ? ' step="0.5" inputmode="decimal"' : ""} data-dl-f="done" data-dl-l="${L}" value="${un(w, w.done)}"></div>
          <div><label>마감 며칠 전에 끝낼까</label><input type="number" min="0" data-dl-f="b" data-dl-l="${L}" value="${num(w.b) || ""}" placeholder="0"></div></div>
        <label>요일별 (눌러서 보통 → 적게 → 쉼)</label>
        <div class="dl-dows">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="${(w.w || {})[d] === "h" ? "h" : (w.w || {})[d] === "o" ? "o" : "n"}" data-dl-dow="${d}" data-dl-l="${L}">${DN[d]}</button>`).join("")}</div>
        <p class="dl-hint">적게 = 보통의 절반 · 쉼 = 0. 못 쓴 몫은 남은 날에 자동으로 나뉘어 얹혀요.</p>
        <div class="dl-edf"><button type="button" class="dl-del" data-dl-del="${L}">🗑 이 작품 지우기</button><button type="button" class="ghost-btn compact" data-dl-open="${L}">접기</button></div>
      </div>` : "";
    const ks = []; for (let i = 0; i < 7; i++) ks.push(shift(c.t, i));
    const mx = Math.max(1, ...ks.map((k) => (c.days[k] || {}).q || 0));
    const wk = c.state === "ok" || c.state === "wait" ? `<div class="dl-wk">${ks.map((k, i) => {
      const d = c.days[k], h = d && d.m !== "o" ? Math.max(4, d.q / mx * 26) : 4;
      return `<div class="${i === 0 ? "t " : ""}${d && d.m === "o" ? "o" : ""}"><i style="height:${h}px"></i>${DN[parse(k).getDay()]}</div>`; }).join("")}</div>` : "";
    return `
      <div class="dl-card${open ? " is-open" : ""}" data-dl-card="${L}">
        <div class="dl-hd" data-dl-open="${L}" role="button" tabindex="0">
          <span class="dl-badge">${L}</span><span class="dl-t">${esc(w.t || "(제목 없음)")}</span>${pillHtml(w)}${c.closed ? `<span class="dl-pill is-closed">🌙 마감</span>` : ""}<span class="dl-chev">${open ? "▲" : "▼"}</span>
        </div>
        <div class="dl-bd">
          ${big}
          ${T > 0 || c.wrote > 0 ? barHtml(pct, 8) : ""}
          <div class="dl-meta"><span>${isEp(w) ? `쓴 화 ${trim1(c.done)} / ${trim1(c.total)}화` : `쓴 글 ${comma(c.done)} / ${comma(c.total)}자`}</span><span>${tm !== null && c.state === "ok" ? `내일 몫 ${fmtN(w, tm)}` : `남은 ${fmtN(w, c.left)}`}</span></div>
          ${wk}
          ${wrote}
        </div>${edit}
      </div>`;
  }

  let _help = false;
  function helpHtml() {
    return `<div class="dl-help">
      <ol>
        <li><b>＋ 작품 추가</b>를 누르고 <b>추가</b>를 확인하면 <b>A, B…</b> 이름표가 붙어요. (Z 다음은 AA)</li>
        <li>카드를 눌러 펼치고 <b>시작일 · 마감일 · 분량</b>을 넣어요. 분량은 <b>글자수</b>나 <b>화수</b> 중에 골라요.</li>
        <li>그러면 <b>오늘 몇 자(또는 몇 화)</b> 쓰면 되는지(오늘 몫)가 나와요.</li>
        <li>글자수 방식은 <b>워크로그</b>에 적어요. 예) <b>글자수 / A</b><br>작품이 하나면 글자수만 써도 돼요.</li>
        <li>워크로그를 안 쓰면 카드의 <b>오늘 쓴 글자</b> 칸에 직접 적어요.</li>
        <li>화수 방식은 카드의 <b>1화 · 반화 박스</b>를 눌러 체크해요. (워크로그와는 연결되지 않아요)</li>
        <li>오늘 몫보다 많이 쓰면 <b>바로</b> 내일 몫이 줄어요 🎉</li>
        <li>적게 썼을 땐 <b>🔄 지금 계산하기</b>. 못 쓴 건 오늘 안에 쓸 거라고 보고 계산해요.</li>
        <li>오늘 일을 끝낼 땐 <b>🌙 작업 마감</b>. 못 쓴 글자가 내일부터 나뉘어요.</li>
        <li>다시 일하려면 <b>☀️ 재개</b>. 쓴 글자는 그대로 이어져요.</li>
      </ol>
      <p>· 오늘 몫은 하루 종일 안 바뀌어요.<br>· 워크로그 작업 칸을 <b>-</b>로 시작하면 데드라인과 상관없는 글이에요.<br>· 제목·글자수는 나만 봐요. 다른 사람 카드에는 연한 바만 보여요.</p>
    </div>`;
  }

  function draw() {
    if (!_box) return;
    const ks = letters();
    const st = dayStat();
    let fCh = 0, fEp = 0;
    ks.forEach((L) => { const w = W_(L), f = Math.max(0, calc(w).fresh); if (isEp(w)) fEp += f; else fCh += f; });
    const fresh = fCh + fEp;
    const freshTxt = [fCh > 0 ? `+${comma(fCh)}자` : "", fEp > 0 ? `+${trim1(fEp)}화` : ""].filter(Boolean).join(" · ");
    let h = "";
    if (ks.length) {
      const nClosed = ks.filter((L) => 마감중(W_(L))).length;
      h += `<div class="dl-sync"><span>오늘 진척 ${sumText(st)}</span><button type="button" class="dl-q${_help ? " on" : ""}" id="dl-help" title="쓰는 법">❓ 쓰는 법</button></div>`;
      h += barHtml(st.pct, 9);
      h += `<div class="dl-btns"><button type="button" class="ghost-btn compact" id="dl-recalc" title="초과한 만큼만 반영해요">🔄 지금 계산하기</button>` +
           `<button type="button" class="ghost-btn compact" id="dl-close"${nClosed === ks.length ? " disabled" : ""} title="못 채운 몫까지 내일부터 다시 나눠요">🌙 작업 마감</button>` +
           `<button type="button" class="ghost-btn compact" id="dl-reopen"${nClosed ? "" : " disabled"} title="마감을 풀고 이어서 써요">☀️ 재개</button></div>`;
      if (_help) h += helpHtml();
      h += `<p class="dl-hint">${nClosed ? "🌙 오늘은 마감했어요 — 못 채운 몫은 내일부터 나뉘어 있어요. 더 쓰면 바로 반영돼요. " : (fresh > 0 ? `● 마지막 계산 뒤에 쓴 분량 ${freshTxt} — 내일 몫엔 아직 안 반영됐어요. ` : "")}오늘 몫은 하루 종일 그대로예요. 몫을 넘기면 바로 계산되고, 아니면 [지금 계산하기]나 [작업 마감]을 눌러야 내일 몫이 바뀌어요.</p>`;
    } else {
      h += `<p class="dl-empty">아직 데드라인이 없어요.<br>작품을 추가하면 A부터 알파벳이 붙어요.</p>`;
    }
    h += ks.map(cardHtml).join("");
    const 꽉참 = ks.length >= MAX_WORKS || _d.n >= MAX_LABELS;
    if (_askAdd && !꽉참) {
      h += `<div class="dl-ask">작품 <b>${labelOf(_d.n)}</b> 를 추가할까요?<div class="dl-asks"><button type="button" class="ghost-btn compact dl-yes" id="dl-add-yes">추가</button><button type="button" class="ghost-btn compact" id="dl-add-no">취소</button></div></div>`;
    } else {
      h += `<button type="button" class="dl-addw" id="dl-add"${꽉참 ? " disabled" : ""}>＋ 작품 추가${꽉참 ? "" : ` <span>(다음 이름표 ${labelOf(_d.n)})</span>`}</button>`;
    }
    if (_msg) h += `<p class="dl-msg">${esc(_msg)}</p>`;
    const keep = _box.scrollTop;
    _box.innerHTML = h;
    _box.scrollTop = keep;
  }

  /* =====================================================================
     손 — 이벤트
     ===================================================================== */
  async function 작품추가() {
    _askAdd = false;
    if (letters().length >= MAX_WORKS) { _msg = "작품은 한 번에 26개까지예요. 안 쓰는 작품을 지워 주세요."; draw(); return; }
    if (_d.n >= MAX_LABELS) { _msg = "이름표를 다 썼어요 (ZZZ까지)."; draw(); return; }
    const L = labelOf(_d.n);
    const t = today();
    /* 1개 → 2개가 되는 순간, 첫 작품의 워크로그 기준(bs)이 비어 있으면 지금 기준을 옮겨 줍니다 —
       안 그러면 A 의 첫 글자수가 "출발선 잡기"로만 쓰여요. */
    const one = letters().length === 1 ? letters()[0] : "";
    const w = { t: "", s: t, d: shift(t, 30), b: 0, u: "ch", e: 0, c: 0, done: 0, d0: 0, sn: 0, k0: t };
    _d.n += 1; _d.works[L] = w;
    const upd = { n: _d.n, [`works/${L}`]: w };
    if (one && letterBase(one) === null) {
      let b = null;
      try { b = window.Wordcount?._state?.().today?.[me()]?.base; } catch (e) {}
      if (b !== null && b !== undefined) { W_(one).bs = num(b); upd[`works/${one}/bs`] = num(b); }
    }
    _open = L; _msg = "";
    try { await window.db.ref(base()).update(upd); } catch (e) { console.warn("[deadline add work]", e); }
    draw(); 카드에알리기();
  }
  async function 작품지우기(L) {
    if (!W_(L)) return;
    if (!confirm(`「${L}${W_(L).t ? " · " + W_(L).t : ""}」 작품을 지울까요?\n(알파벳 ${L} 는 다시 쓰이지 않아요)`)) return;
    delete _d.works[L];
    try { await window.db.ref(`${base()}/works/${L}`).remove(); } catch (e) {}
    if (_open === L) _open = "";
    draw(); 카드에알리기();
  }

  /** 분량 단위(글자수 ↔ 화수)를 바꿉니다 — 단위가 달라 쓴 분량은 0부터 다시 셉니다 */
  async function 단위바꾸기(L, to) {
    const w = W_(L);
    if (!w || (to !== "ep" && to !== "ch") || isEp(w) === (to === "ep")) return;
    if (Number(w.done) > 0 && !confirm("분량 단위를 바꾸면 지금까지 쓴 분량이 0으로 돌아가요. 바꿀까요?")) return;
    await 칸쓰기(L, { u: to, done: 0, d0: 0, sn: 0 });
    draw(); 카드에알리기();
  }
  /** 화수 박스 — 누르면 거기까지 칠하고, 마지막으로 칠한 박스를 또 누르면 한 칸 줄입니다 */
  async function 박스누름(L, acc, v) {
    const w = W_(L);
    if (!w || !isEp(w) || !isFinite(acc)) return;
    const wrote = calc(w).wrote;
    const next = Math.abs(wrote - acc) < 1e-9 ? Math.max(0, acc - (v || 0.5)) : acc;
    await 칸쓰기(L, { done: half(un(w, w.d0) + next) });
    if (바로계산해야(L)) 계산하기(L);
    else { draw(); 카드에알리기(); }
  }

  async function 입력바뀜(inp) {
    const L = inp.dataset.dlL, f = inp.dataset.dlF, w = W_(L);
    if (!w) return;
    const v = inp.value;
    if (f === "wrote") {
      /* 오늘 쓴 글자 = d0 + 입력 — 워크로그가 더한 것까지 포함한 오늘 총량을 직접 고치는 칸 */
      await 칸쓰기(L, { done: un(w, w.d0) + un(w, v) });
      if (바로계산해야(L)) 계산하기(L);            // 초과일 때만 바로 (마감한 날은 늘 바로)
      else { draw(); 카드에알리기(); }
      return;
    }
    if (f === "done") {
      /* 전체 글자를 손으로 고치면 그만큼 d0·sn 도 같이 옮겨서 오늘 진척이 튀지 않게 */
      const nv = un(w, v), delta = nv - un(w, w.done);
      await 칸쓰기(L, { done: nv, d0: Math.max(0, un(w, w.d0) + delta), sn: Math.max(0, un(w, w.sn) + delta) });
    } else if (f === "t") {
      await 칸쓰기(L, { t: String(v).trim().slice(0, MAX_TITLE) });
    } else if (f === "s" || f === "d") {
      await 칸쓰기(L, { [f]: isDate(v) ? v : (f === "s" ? today() : shift(today(), 30)) });
    } else if (f === "e") {
      await 칸쓰기(L, { e: half(v) });
    } else if (f === "b" || f === "c") {
      await 칸쓰기(L, { [f]: num(v) });
    }
    draw(); 카드에알리기();
  }

  function bind(box) {
    if (box.dataset.dlBound === "true") return;
    box.dataset.dlBound = "true";
    box.addEventListener("click", (e) => {
      const o = e.target.closest("[data-dl-open]");
      if (o && !e.target.closest("input,button:not([data-dl-open])")) { _open = _open === o.dataset.dlOpen ? "" : o.dataset.dlOpen; draw(); return; }
      if (e.target.closest("#dl-recalc")) { _msg = ""; 계산하기(); return; }
      if (e.target.closest("#dl-close")) { 마감하기(); return; }
      if (e.target.closest("#dl-reopen")) { 재개하기(); return; }
      if (e.target.closest("#dl-help")) { _help = !_help; draw(); return; }
      if (e.target.closest("#dl-add-yes")) { 작품추가(); return; }
      if (e.target.closest("#dl-add-no")) { _askAdd = false; draw(); return; }
      if (e.target.closest("#dl-add")) { _askAdd = true; _msg = ""; draw(); return; }
      const bx = e.target.closest("[data-dl-bx]");
      if (bx) { 박스누름(bx.dataset.dlBx, Number(bx.dataset.dlAcc), Number(bx.dataset.dlV)); return; }
      const u = e.target.closest("[data-dl-u]");
      if (u) { 단위바꾸기(u.dataset.dlL, u.dataset.dlU); return; }
      const dw = e.target.closest("[data-dl-dow]");
      if (dw) {
        const L = dw.dataset.dlL, d = dw.dataset.dlDow, w = W_(L); if (!w) return;
        const cur = (w.w || {})[d] === "h" ? "h" : (w.w || {})[d] === "o" ? "o" : "n";
        const nx = NEXT[cur], map = { ...(w.w || {}) };
        if (nx === "n") delete map[d]; else map[d] = nx;
        w.w = map;
        window.db.ref(`${base()}/works/${L}/w`).set(Object.keys(map).length ? map : null).catch(() => {});
        draw(); 카드에알리기(); return;
      }
      const del = e.target.closest("[data-dl-del]");
      if (del) { 작품지우기(del.dataset.dlDel); }
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        const i = e.target.closest("input[data-dl-f]");
        if (i) { e.preventDefault(); i.blur(); return; }
        const o = e.target.closest("[data-dl-open]");
        if (o && o.getAttribute("role") === "button") { e.preventDefault(); o.click(); }
      }
    });
    box.addEventListener("change", (e) => { const i = e.target.closest("input[data-dl-f]"); if (i) 입력바뀜(i); });
  }

  /* =====================================================================
     옆 탭이 부르는 문 — 칸(#side-pane-body) 안에 직접 그립니다 (script_links.js 와 같은 수)
     ===================================================================== */
  async function openDeadline() {
    const pane = el("side-pane-body");
    if (!pane) return;
    let box = el("deadline-board");
    if (!box) { box = document.createElement("div"); box.id = "deadline-board"; box.className = "dock-body deadline-board"; }
    pane.appendChild(box);
    _box = box; _msg = ""; _askAdd = false;
    bind(box);
    draw();
    if (await load()) { _day = today(); draw(); }        // 탭 열 때 한 번 다시 읽기 (다른 창에서 고친 것)
  }
  function closeDeadline() {
    const box = el("deadline-board");
    if (box) box.remove();
    _box = null;
  }

  window.openDeadline = openDeadline;
  window.closeDeadline = closeDeadline;
  window.listenDeadline = listenDeadline;
  window.detachDeadline = detachDeadline;
  window.Deadline = { route, loneLetter, msgNeed, msgUnknown, msgNoNum, msgEpMode, isEp: (L) => isEp(W_(L)),
    _label: labelOf, _boxes: (L) => boxesHtml(L, calc(W_(L))), _add: 작품추가, _unit: 단위바꾸기, _box: 박스누름, letterBase, setLetterBase, addWritten,
    count: () => (enabled() && _loaded ? letters().length : 0), _calc: calc, _state: () => _d, close: 마감하기, reopen: 재개하기, calcNow: 계산하기 };

  (function install() {
    const _leave = window.leaveRoom;
    if (typeof _leave === "function" && !_leave.__dlPatched) {
      const wrapped = async function () { try { detachDeadline(); } catch (e) {} return _leave.apply(this, arguments); };
      wrapped.__dlPatched = true;
      window.leaveRoom = wrapped;
    }
  })();
})();
