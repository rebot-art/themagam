/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   📢 입퇴장 흐름줄 (script_ticker.js) — 2026-10-04 콩

   머리말 바로 아래 한 줄, 배경 없이 글자만. 내 카드 위에서 5초 → 첫 줄 끝 카드까지 오른쪽으로 흐릅니다 (2차).
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

  let 대기 = [];          // 흐르는 줄 뒤에 붙을 것들

  function 창() { return document.getElementById("head-ticker"); }

  /* =====================================================================
     [2026-10-04 콩 · 2차] 카드 위에서 출발 → 첫 줄 맨 끝 카드까지
     ---------------------------------------------------------------------
     · 출발: 글 왼쪽 끝이 **내 카드 가운데** (내 카드 오른쪽 절반 위에 걸침).
       스르륵 나타나 5초 머뭅니다.
     · 흐름: 오른쪽으로 초당 70px.
     · 도착: 글 오른쪽 끝이 **첫 줄 맨 끝 카드 가운데** 에 닿으면 스르륵 사라짐.
     · 화면마다 카드 수가 달라도 각자 거리에 딱 맞습니다. 첫 줄이 1장이면
       흐르지 않고 5초 뒤 그 자리에서 사라져요.
     · 내 카드가 첫 줄에 없으면 첫 줄 맨 앞 카드에서 출발합니다.
     · 흐르는 중에 또 오면 앞 것이 끝난 뒤 이어서. 같은 순간 몰린 건 한 줄로.
     ★ 화면 확대(html zoom)가 걸려 있으면 재는 값(확대 후)과 적는 값(확대 전)이
       달라요 — 배율로 나눠 맞춥니다 (1차에서 겪은 어긋남).
     ===================================================================== */
  const 머묾 = 5000;
  let 바쁨 = false;

  function 자리() {
    const t = 창();
    const 카드들 = [...document.querySelectorAll("#user-cards .user-card")].filter(c => c.offsetParent);
    if (!t || !카드들.length) return null;
    const 윗 = Math.min(...카드들.map(c => Math.round(c.getBoundingClientRect().top)));
    const 첫줄 = 카드들.filter(c => Math.abs(c.getBoundingClientRect().top - 윗) < 4)
                     .sort((x, y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left);
    const 나카드 = 첫줄.find(c => c.classList.contains("is-me")) || 첫줄[0];
    const 끝 = 첫줄[첫줄.length - 1];
    const tr = t.getBoundingClientRect();
    const 배율 = (t.offsetWidth && tr.width) ? (tr.width / t.offsetWidth) : 1;
    const 가운데 = (c) => { const r = c.getBoundingClientRect(); return (r.left + r.width / 2 - tr.left) / 배율; };
    return { s: 가운데(나카드), e: 가운데(끝), 한장: 나카드 === 끝 };
  }

  function 한마디(e) {
    return `<span class="ht-i ${e.in ? "in" : "out"}">${e.in ? "📢" : "👋"} ${esc(e.nick)} 작가님 ${e.in ? "입장" : "퇴장"}!</span>`;
  }

  function 띄우기(items) {
    const t = 창(); const p = 자리();
    if (!t || !p || !items.length) { 바쁨 = false; 다음(); return; }
    바쁨 = true;
    const s = document.createElement("span");
    s.className = "ht-run";
    s.innerHTML = items.map(한마디).join('<span class="ht-dot">·</span>');
    s.style.left = Math.max(0, p.s) + "px";
    t.appendChild(s);
    requestAnimationFrame(() => s.classList.add("on"));
    const 끝내기 = () => {
      s.classList.remove("on");
      setTimeout(() => { s.remove(); 바쁨 = false; 다음(); }, 400);
    };
    setTimeout(() => {
      const p2 = 자리() || p;
      const 거리 = p2.e - s.offsetWidth - Math.max(0, p2.s);
      if (p2.한장 || !(거리 > 0)) { 끝내기(); return; }
      const 애니 = s.animate([{ transform: "translateX(0)" }, { transform: `translateX(${거리}px)` }],
        { duration: (거리 / SPEED) * 1000, easing: "linear", fill: "forwards" });
      애니.onfinish = 끝내기;
    }, 머묾);
  }
  function 다음() {
    if (바쁨 || !대기.length) return;
    const 묶음 = 대기; 대기 = [];
    띄우기(묶음);
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
