/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   🌅 날짜 바뀜 알림 (script_newday.js) — 2026-10-04 콩

   [왜]
   창을 안 닫고 노트북을 덮거나 절전모드로 자고, 다음 날 그 창을 그대로
   여는 멤버가 많습니다. 출석 도장은 **입장할 때만** 찍히니 오늘 도장이
   안 찍히고, 화면도 어제 받은 옛 코드 그대로예요 (고구마 사건).

   [언제 뜨나 — 콩의 결정]
     ① 깨어날 때 — 컴퓨터가 잠에서 깨거나(타이머가 3분 넘게 멈췄다 돌아옴),
        30분 넘게 내려 둔 탭을 다시 열었을 때, 입장한 날 ≠ 오늘이면.
     ② 새벽 2:30 — 깨어 있는 채 날을 넘긴 사람에게. 자정에 바로 띄우면
        밤새 쓰는 작가님 흐름을 끊어서, 그 시각까지 있는 사람만.
     ★ 오늘 날짜 도장이 이미 있으면(자정 넘어 들어온 사람) 안 뜹니다.
     ★ [나중에] 를 누르면 그날은 다시 안 뜹니다.

   [버튼은 '새로고침']
   새로 들어오면 도장이 원래 방식대로 찍히고, 최신 패치도 받아 옵니다.
   도장을 따로 찍는 장치를 두지 않아요 — "출석은 본인이 입장해서" 그대로.
   자동 새로고침은 안 합니다 (쓰다 만 채팅이 날아갈 수 있어서).

   [시험] 혼자 방 먼저 (MAIN_ON = false). 주소 끝에 &newdaytest=1 을
   붙이면 "어제 들어온 창" 으로 치고 5초 뒤에 바로 띄웁니다.
   ===================================================================== */
(function () {
  const MAIN_ON = false;                     // ★ 혼자 방에서 확인되면 true 로
  const TEST = /[?&]newdaytest=1/.test(location.search);
  const DAWN_MIN = 2 * 60 + 30;              // 새벽 2:30
  const SLEEP_GAP_MS = 3 * 60 * 1000;        // 타이머가 이만큼 멈췄으면 잠들었던 것
  const HIDDEN_MS = 30 * 60 * 1000;          // 탭을 이만큼 내려 뒀다 열면 '깨어남'

  const 켜짐 = () => !!(window.SOLO || MAIN_ON);
  const 나 = () => { try { return (typeof myNick === "string" && myNick) ? myNick : (window.myNick || ""); } catch (e) { return ""; } };
  const 날 = (t) => (window.ymd ? window.ymd(t) : new Date(t).toISOString().slice(0, 10));
  const 보기 = (d) => { const [, m, dd] = d.split("-"); return `${+m}/${+dd}`; };

  let 입장날 = null;      // 이 창으로 들어온 날
  let 닫은날 = null;      // [나중에] 누른 날
  let 떠있음 = false;
  let 마지막틱 = Date.now();
  let 숨은때 = 0;

  async function 확인(까닭) {
    if (!켜짐() || 떠있음) return;
    const n = 나();
    if (!n || !입장날) return;
    const 오늘 = 날(Date.now());
    if (오늘 === 입장날 || 닫은날 === 오늘) return;
    if (까닭 === "dawn" && !TEST) {
      const d = new Date();
      if (d.getHours() * 60 + d.getMinutes() < DAWN_MIN) return;
    }
    /* 오늘 도장이 이미 있으면 — 이 창은 오늘 것으로 칩니다 */
    try {
      if (window.db && !TEST) {
        const s = await window.db.ref(`attendance/${오늘}/${n}`).once("value");
        if (s.exists()) { 입장날 = 오늘; return; }
      }
    } catch (e) {}
    /* 👋 입장 인사·📢 공지 팝업이 떠 있으면 닫힐 때까지 */
    for (let i = 0; i < 600 && document.querySelector(".hello-veil"); i++) await new Promise(r => setTimeout(r, 200));
    if (떠있음) return;
    띄우기(까닭, 오늘);
  }

  function 띄우기(까닭, 오늘) {
    떠있음 = true;
    const 머리 = 까닭 === "dawn" ? "새벽 2시 반이 넘었어요" : "날짜가 바뀌었어요";
    const veil = document.createElement("div");
    veil.className = "hello-veil npop-veil nday-veil";
    veil.innerHTML = `
      <div class="hello-card npop-card" role="dialog" aria-modal="true" aria-label="날짜 바뀜">
        <div class="hello-ic">${까닭 === "dawn" ? "🕑" : "🌅"}</div>
        <p class="npop-h">${머리}</p>
        <p class="nday-p">이 창은 <b>${보기(입장날)}</b>에 들어온 창이에요.<br>
          새로 입장하면 <b>오늘(${보기(오늘)}) 출석 도장</b>이 찍히고,<br>화면도 최신으로 바뀌어요.</p>
        <div class="npop-btns">
          <button type="button" class="npop-later">나중에</button>
          <button type="button" class="hello-ok nday-go">새로 입장하기</button>
        </div>
        <p class="npop-hint">쓰다 만 채팅이 있으면 먼저 보내 주세요 · [나중에]는 오늘 다시 안 떠요</p>
      </div>`;
    document.body.appendChild(veil);
    requestAnimationFrame(() => veil.classList.add("on"));
    const 닫기 = () => { veil.classList.remove("on"); setTimeout(() => veil.remove(), 300); 떠있음 = false; };
    veil.querySelector(".npop-later").addEventListener("click", () => { 닫은날 = 오늘; 닫기(); });
    veil.querySelector(".nday-go").addEventListener("click", () => { location.reload(); });
    setTimeout(() => veil.querySelector(".nday-go")?.focus(), 340);
  }

  function 틱() {
    const 지금 = Date.now();
    const 틈 = 지금 - 마지막틱;
    마지막틱 = 지금;
    if (!켜짐()) return;
    const n = 나();
    if (!n) { 입장날 = null; return; }                 // 나가면 처음부터
    if (!입장날) {
      입장날 = TEST ? 날(지금 - 86400000) : 날(지금);
      if (TEST) setTimeout(() => 확인("wake"), 5000);
      return;
    }
    if (document.hidden) return;                       // 안 보이는 창엔 안 띄움
    확인(틈 > SLEEP_GAP_MS ? "wake" : "dawn");
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { 숨은때 = Date.now(); return; }
    const 오래 = 숨은때 && (Date.now() - 숨은때 >= HIDDEN_MS);
    숨은때 = 0;
    if (오래) 확인("wake");
    else 확인("dawn");                                 // 2:30 넘었으면 이때 띄웁니다
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) 확인("wake"); });

  setInterval(틱, 30 * 1000);
  setTimeout(틱, 2000);

  window.newDayCheck = 확인;                           // 빠짐 검사·손 시험용
})();
