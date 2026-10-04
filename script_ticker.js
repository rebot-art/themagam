/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   📢 입퇴장 흐름줄 (script_ticker.js) — 2026-10-04 콩

   머리말 바로 아래 한 줄, 배경 없이 글자만 오른쪽 → 왼쪽으로 흐릅니다.
   평소엔 비어 있어요. 흐르는 폭은 화면 가운데 75% (콩).
     "모모 작가님 입장!" / "모모 작가님 퇴장!"

   ★ 통신량 0 — 이미 챗으로 오는 입장·퇴장 줄(joinOf · leaveOf)을 받아
     보여 줄 뿐입니다 (script_realtime.js 의 child_added 에서 부름).
   ★ 🛠️REPAIR 중인 사람은 애초에 그 줄을 안 써서 여기에도 안 뜹니다.
   ★ 몰려 오면 한 줄로 이어 붙입니다 — 흐르는 중이면 뒤에 붙어 따라와요.
   ★ 꾸민 카드·가볍게 보기 둘 다 보입니다.
   ★ 거슬리면 B안(몇 초 떠 있기)으로 바꾸기로 함 — 입퇴장_알림줄_미리보기.html

   [시험] 혼자 방 먼저 (MAIN_ON = false). 주소에 &tickertest=1 을 붙이면
   10초마다 가짜 입퇴장이 흘러갑니다.
   ===================================================================== */
(function () {
  const MAIN_ON = true;                   // [2026-10-04 콩] 본방 ON
  const SPEED = 70;                       // 초당 px
  const 켜짐 = () => !!(window.SOLO || MAIN_ON);
  const 시작 = Date.now();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const 나 = () => { try { return (typeof myNick === "string" && myNick) ? myNick : (window.myNick || ""); } catch (e) { return ""; } };

  let 줄 = null;          // 지금 흐르는 줄 (없으면 null)
  let 대기 = [];          // 흐르는 줄 뒤에 붙을 것들

  function 창() { return document.getElementById("head-ticker"); }

  /* [2026-10-04 콩] 폭은 단추 위치로 재지 않고 **화면 가운데 75%** 로 고정합니다
       (styles.css .head-ticker). 확대·축소와 상관없고 창마다 어긋나지 않아요. */
  function 폭맞추기() {}

  function 한마디(e) {
    return `<span class="ht-i ${e.in ? "in" : "out"}">${e.in ? "📢" : "👋"} ${esc(e.nick)} 작가님 ${e.in ? "입장" : "퇴장"}!</span>`;
  }

  function 흘리기(items) {
    const t = 창(); if (!t || !items.length) return;
    폭맞추기();
    const s = document.createElement("span");
    s.className = "ht-run";
    s.innerHTML = items.map(한마디).join('<span class="ht-dot">·</span>');
    t.appendChild(s);
    const 창폭 = t.clientWidth, 글폭 = s.offsetWidth;
    const 거리 = 창폭 + 글폭;
    s.style.transform = `translateX(${창폭}px)`;
    const 애니 = s.animate(
      [{ transform: `translateX(${창폭}px)` }, { transform: `translateX(${-글폭}px)` }],
      { duration: (거리 / SPEED) * 1000, easing: "linear", fill: "forwards" });
    줄 = { s, 글폭, 창폭, 애니 };
    /* 꼬리가 창 안으로 다 들어오면 다음 것을 바로 뒤에 붙여 보냅니다 */
    const 꼬리들어옴 = ((글폭 + 24) / SPEED) * 1000;
    setTimeout(() => { if (줄 && 줄.s === s) 줄 = null; 다음(); }, 꼬리들어옴);
    애니.onfinish = () => s.remove();
  }
  function 다음() {
    if (줄 || !대기.length) return;
    const 묶음 = 대기; 대기 = [];
    흘리기(묶음);
  }

  /* script_realtime.js 의 챗 child_added 가 부릅니다 */
  function push(data) {
    if (!켜짐() || !data || data.type !== "system") return;
    const nick = data.joinOf || data.leaveOf;
    if (!nick || nick === 나()) return;                // 내 드나듦은 안 띄움
    const t = Number(data.time || 0);
    /* 들어올 때 받은 옛 줄은 흘리지 않습니다 */
    if (Date.now() - 시작 < 4000) return;
    const now = (typeof window.serverNow === "function") ? window.serverNow() : Date.now();
    if (t && now - t > 60 * 1000) return;
    대기.push({ nick, in: !!data.joinOf });
    /* 같은 순간에 몰려 오는 것은 0.6초 모아 한 줄로 */
    setTimeout(다음, 600);
  }
  window.headTickerPush = push;


  if (/[?&]tickertest=1/.test(location.search)) {
    const N = ["모모", "나디", "감자", "고구마", "비타", "호두"];
    let i = 0;
    setInterval(() => {
      if (!켜짐()) return;
      const n = 1 + (i % 3);
      for (let k = 0; k < n; k++) {
        대기.push({ nick: N[(i + k) % N.length], in: (i + k) % 3 !== 2 });
      }
      i++; 다음();
    }, 10000);
  }
})();
