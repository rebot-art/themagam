// TheMagam © 그링링 · 무단 복제·재배포 금지
/* =====================================================================
   🎃 할로윈 가랜드 (2026-10-31 — 콩)
   ---------------------------------------------------------------------
   "화면 위로 할로윈 느낌 가랜드를. 하루이틀만 걸어두고 저절로 사라지게."
   · 길게 펼쳐지는 줄 하나 + 공지 시작점에서 오른쪽 아래로 내려가는 짧은 줄 하나.
   · 배경판(#room-board) 자리를 보고 높이를 잡습니다 — 카드·프사는 안 가립니다.
   · 마우스는 그대로 뚫고 지나갑니다 (pointer-events:none).

   ★★ 끝나는 시각: 2026-11-02 00:00 (한국시간) = 일요일 밤 12시.
      그 시각이 지나면 아무것도 그리지 않고, 켜져 있던 창에서는 그 순간
      저절로 걷힙니다. **따로 올릴 파일 없음.**
      (나중에 코드까지 치우고 싶으면: 이 파일 · index.html 의 script 줄 ·
       build-single.py ORDER 의 이름 · checks.js 의 할로윈 칸 — 네 군데.)
   ★ 서버를 쓰지 않습니다 — 통신량 0, 보안규칙 그대로.
   ★ 창이 좁거나 "꾸밈 없이 보기" 면 숨깁니다 (카드가 좁을 때 가리지 않게).
   ===================================================================== */
(() => {
  "use strict";
  const END = Date.parse("2026-11-02T00:00:00+09:00");
  if (!(Date.now() < END)) return;

  const NS = "http://www.w3.org/2000/svg";
  const ID = "halloween-garland";
  const MIN_W = 1100;
  const COLORS = ["#FF8A1F", "#7A4FD0", "#FF8A1F", "#2E2540"];
  let svg = null, 직전 = "";

  function 줄그리기(x0, y0, x1, y1, sag, 장식) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + sag * 2;
    const pt = t => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1,
                     (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1];
    let o = `<path d="M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}" stroke="#3a2a22" stroke-width="3" fill="none"/>`;
    장식.forEach(([t, k], i) => {
      const [x, y] = pt(t);
      o += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">`;
      if (k === "flag") {
        o += `<path d="M-20 0L20 0L0 44Z" fill="${COLORS[i % 4]}" stroke="#2a1a10" stroke-width="2" stroke-linejoin="round"/>`;
      } else {
        o += `<line y2="22" stroke="#3a2a22" stroke-width="2"/><text y="62" font-size="46" text-anchor="middle">${k}</text>`;
      }
      o += `</g>`;
    });
    return o;
  }

  function 걷기() { svg?.remove(); svg = null; 직전 = ""; }

  function 그리기() {
    if (!(Date.now() < END)) { 걷기(); clearInterval(타이머); return; }
    const W = window.innerWidth || 0, H = window.innerHeight || 0;
    const 숨김 = W < MIN_W || (typeof window.isLiteCards === "function" && window.isLiteCards());
    const 마당 = document.querySelector(".cards-area");
    if (숨김 || !마당 || !document.getElementById("room-board") && !document.querySelector(".card")) { 걷기(); return; }

    /* 기준 자리 — 공지 줄이 있으면 그 줄, 없으면 판 위쪽 */
    const 판 = document.getElementById("room-board");
    const 공지 = document.getElementById("rb-notice");
    const 기준 = (공지 || 판)?.getBoundingClientRect();
    const 윗선 = 기준 ? 기준.top : H * 0.73;
    const 왼쪽 = 기준 ? 기준.left : W * 0.346;
    const yL = Math.max(120, Math.min(H - 160, 윗선 - 16));       // 긴 줄
    const yS = Math.max(130, Math.min(H - 150, 윗선 + 2));        // 짧은 줄 시작
    const sig = [W, H, Math.round(yL), Math.round(yS), Math.round(왼쪽)].join(",");
    if (svg && sig === 직전) return;
    직전 = sig;

    if (!svg) {
      svg = document.createElementNS(NS, "svg");
      svg.id = ID;
      svg.setAttribute("aria-hidden", "true");
      svg.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:500;filter:drop-shadow(0 4px 4px rgba(0,0,0,.28))";
      document.body.appendChild(svg);
    }
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const 긴 = [];
    for (let i = 1; i < 24; i++) 긴.push([i / 24, "flag"]);
    [[.12, "🎃"], [.27, "👻"], [.42, "🦇"], [.58, "🎃"], [.73, "👻"], [.88, "🦇"]].forEach(([t, e]) => 긴.push([t + .02, e]));
    긴.sort((a, b) => a[0] - b[0]);
    const 짧 = [[.1, "🎃"], [.25, "flag"], [.35, "flag"], [.45, "👻"], [.55, "flag"], [.65, "flag"], [.78, "🎃"], [.9, "🦇"]];

    svg.innerHTML =
      줄그리기(W * 0.03, yL, W * 0.98, yL, 70, 긴) +
      줄그리기(왼쪽, yS, W * 0.98, Math.min(H - 110, yS + 168), 55, 짧);
  }

  let 타이머 = 0;
  function 시작() {
    그리기();
    타이머 = setInterval(그리기, 1500);                  // 카드 배치가 바뀌어도 따라가게 (값이 같으면 다시 안 그립니다)
    window.addEventListener("resize", 그리기);
    /* 켜 둔 창에서도 끝나는 시각에 딱 걷히게 */
    const 남은 = END - Date.now();
    if (남은 > 0 && 남은 < 2147483000) setTimeout(그리기, 남은 + 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", 시작);
  else 시작();
})();
