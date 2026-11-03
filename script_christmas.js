// TheMagam © 그링링 · 무단 복제·재배포 금지
/* =====================================================================
   🎄 크리스마스 전구 가랜드 + 눈 (2026-11-04 — 콩)
   ---------------------------------------------------------------------
   "할로윈처럼 크리스마스 에디션도. 반짝이는 전구 줄(A)과 눈 내리기."
   · 길게 펼쳐지는 전구 줄 하나 + 공지 시작점에서 오른쪽 아래로 내려가는 짧은 줄 하나.
   · 전구는 하나하나 반짝입니다 (CSS 애니메이션 — 서버·타이머 안 씁니다).
   · 눈송이는 카드 마당 안에서만 내립니다. 마우스는 그대로 뚫고 지나갑니다 (pointer-events:none).
   · 배경판(#room-board) 자리를 보고 높이를 잡습니다 — 카드·프사는 안 가립니다 (할로윈과 같은 자리).

   ★★ 기간은 script_profile.js 의 christmasOn() 이 정합니다 (기본 프사와 한 규칙).
      해마다 12/18 0시 ~ 12/27 0시(한국시간) — 크리스마스 7일 전부터 27일 0시까지 10일.
      기간 밖에는 아무것도 그리지 않고, 켜져 있던 창에서는 끝나는 순간 저절로 걷힙니다.
      **따로 올릴 파일 없음.**
   ★ 서버를 쓰지 않습니다 — 통신량 0, 보안규칙 그대로.
   ★ 창이 좁거나 "꾸밈 없이 보기" 면 숨깁니다 (카드가 좁을 때 가리지 않게).
   ★ 움직임이 불편한 분(기기 설정의 '동작 줄이기')에게는 눈을 안 내리고 전구도 반짝이지 않습니다.
   ★ 걷어내려면: 이 파일 · index.html 의 script 줄 · build-single.py ORDER 의 이름 ·
     checks.js 의 크리스마스 칸 · script_profile.js 의 🎄 덩어리 (photoShown·snowmanSvg 도 한 줄씩).
   ===================================================================== */
(() => {
  "use strict";
  /* 기간인가 — 기본 프사와 같은 규칙 (script_profile.js 가 먼저 로드됩니다) */
  const 철인가 = () => typeof window.christmasOn === "function" && window.christmasOn();

  const NS = "http://www.w3.org/2000/svg";
  const ID = "christmas-garland";
  const SNOW_ID = "christmas-snow";
  const STYLE_ID = "christmas-style";
  const MIN_W = 1100;
  const BULB = ["#FF3B3B", "#FFD23F", "#3DDC84", "#4DA3FF"];
  const FLAKES = 26;
  let svg = null, 눈 = null, 직전 = "";

  /* 반짝임·눈 — 한 번만 심습니다 */
  function 스타일심기() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
@keyframes xm-tw{0%,100%{opacity:1}50%{opacity:.35}}
#${ID} .xm-bulb{animation:xm-tw 1.6s ease-in-out infinite}
#${SNOW_ID}{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden}
#${SNOW_ID} i{position:absolute;top:-14px;color:#fff;text-shadow:0 0 3px rgba(120,150,190,.7);font-style:normal;animation:xm-fall linear infinite}
@keyframes xm-fall{to{transform:translate3d(24px,var(--xm-h,600px),0)}}
@media (prefers-reduced-motion:reduce){#${ID} .xm-bulb{animation:none}#${SNOW_ID}{display:none}}`;
    document.head.appendChild(st);
  }

  /* 전구 줄 — 곡선 위에 전구를 같은 간격으로 매답니다 */
  function 줄그리기(x0, y0, x1, y1, sag, 개수, 어긋남) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + sag * 2;
    const pt = t => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1,
                     (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1];
    let o = `<path d="M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}" stroke="#363C3A" stroke-width="2.55" fill="none"/>`;     // 아주 짙은 회녹색 · 굵기는 예전(3)보다 15% 가늘게
    for (let i = 1; i < 개수; i++) {
      const [x, y] = pt(i / 개수);
      const col = BULB[(i + 어긋남) % 4];
      /* 꼭지(이음새)는 전선과 같은 색, 크기는 작게(6.12 — 처음 8 에서 줄여 왔습니다) — 전구가 허공에 뜨지 않게 그만큼 위로 붙입니다 */
      o += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">` +
           `<rect x="-3.06" y="0" width="6.12" height="6.12" rx="1.2" fill="#363C3A"/>` +
           `<ellipse class="xm-bulb" style="animation-delay:${((i * 0.37) % 1.6).toFixed(2)}s" cx="0" cy="15.1" rx="7" ry="10" fill="${col}" stroke="#fff" stroke-width="1.6" filter="drop-shadow(0 0 5px ${col})"/>` +
           `<ellipse cx="-2.4" cy="11.1" rx="1.8" ry="3" fill="#fff" opacity=".6"/></g>`;
    }
    return o;
  }

  function 걷기() { svg?.remove(); svg = null; 눈?.remove(); 눈 = null; 직전 = ""; }

  /* 눈송이 — 마당 안에 한 번만 만들어 두고, 높이만 값으로 알려 줍니다 */
  function 눈만들기(마당, H) {
    if (!눈) {
      눈 = document.createElement("div");
      눈.id = SNOW_ID;
      눈.setAttribute("aria-hidden", "true");
      const 모양 = ["❄", "❅", "•"];
      for (let i = 0; i < FLAKES; i++) {
        const f = document.createElement("i");
        f.textContent = 모양[i % 3];
        f.style.left = (Math.random() * 100).toFixed(1) + "%";
        f.style.fontSize = (9 + Math.random() * 10).toFixed(1) + "px";
        f.style.animationDuration = (7 + Math.random() * 7).toFixed(1) + "s";
        f.style.animationDelay = (-Math.random() * 12).toFixed(1) + "s";
        f.style.opacity = (0.55 + Math.random() * 0.4).toFixed(2);
        눈.appendChild(f);
      }
    }
    if (눈.parentNode !== 마당) 마당.appendChild(눈);
    눈.style.setProperty("--xm-h", (H + 30) + "px");
  }

  function 그리기() {
    if (!철인가()) { if (svg || 눈) 걷기(); return; }
    const 숨김 = (window.innerWidth || 0) < MIN_W || (typeof window.isLiteCards === "function" && window.isLiteCards());
    const 마당 = document.querySelector(".cards-area");
    if (숨김 || !마당 || !document.getElementById("room-board") && !document.querySelector(".card")) { 걷기(); return; }

    스타일심기();

    /* ★ 가랜드·눈은 카드 마당(.cards-area) **안에** 답니다 — 마당이 넘치는 걸 잘라 주니
         챗창·옆 칸·팝업은 절대 안 가리고, 배경 위에서만 보입니다. (할로윈과 같은 이유) */
    const 틀 = 마당.getBoundingClientRect();
    const ox = 틀.left + 마당.clientLeft, oy = 틀.top + 마당.clientTop;
    const W = 마당.clientWidth, H = 마당.clientHeight;
    /* 기준 자리 — 공지 줄이 있으면 그 줄, 없으면 판 위쪽 */
    const 판 = document.getElementById("room-board");
    const 공지 = document.getElementById("rb-notice");
    const 기준 = (공지 || 판)?.getBoundingClientRect();
    const 윗선 = 기준 ? 기준.top - oy : H * 0.73;
    const 왼쪽 = 기준 ? 기준.left - ox : W * 0.346;
    const yL = Math.max(60, Math.min(H - 100, 윗선 - 16));       // 긴 줄
    const yS = Math.max(70, Math.min(H - 90, 윗선 + 2));        // 짧은 줄 시작
    const sig = [W, H, Math.round(yL), Math.round(yS), Math.round(왼쪽)].join(",");
    if (svg && svg.parentNode === 마당 && 눈 && 눈.parentNode === 마당 && sig === 직전) return;
    직전 = sig;

    눈만들기(마당, H);

    if (!svg) {
      svg = document.createElementNS(NS, "svg");
      svg.id = ID;
      svg.setAttribute("aria-hidden", "true");
      svg.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:2;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25))";
    }
    if (svg.parentNode !== 마당) 마당.appendChild(svg);
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    /* ★ 짧은 줄을 먼저, 긴 줄을 나중에 — 짧은 줄의 선이 긴 줄의 전구를 가리지 않게 (할로윈과 같은 순서) */
    const 짧x1 = W * 0.98, 짧y0 = yS + 35, 짧y1 = Math.max(yS + 75, Math.min(yS + 128, H - 100));
    const 짧길이 = Math.hypot(짧x1 - 왼쪽, 짧y1 - 짧y0);
    const 짧개수 = Math.max(6, Math.round(짧길이 / 52));
    const 긴개수 = Math.max(10, Math.round(W * 0.95 / 52));
    svg.innerHTML =
      줄그리기(왼쪽, 짧y0, 짧x1, 짧y1, 55, 짧개수, 1) +
      줄그리기(W * 0.03, yL, W * 0.98, yL, 70, 긴개수, 0);
  }

  function 시작() {
    그리기();
    /* 카드 배치가 바뀌어도 따라가게 (값이 같으면 다시 안 그립니다).
       기간 밖에는 날짜만 비교하고 돌아오므로 거의 일을 안 합니다.
       시작·끝나는 순간에도 이 줄이 알아서 켜고 걷습니다. */
    setInterval(그리기, 1500);
    window.addEventListener("resize", 그리기);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", 시작);
  else 시작();
})();
