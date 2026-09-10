/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_sticker.js — 채팅 스티커 (2026-08-10)
   ---------------------------------------------------------------------
   [무엇인가]
   말풍선 대신 크게 뜨는 손그림 마흔네 개. 채팅과 수다방 양쪽에서 씁니다.
   (2026-08-10 열다섯 → 08-11 스물다섯 → 09-10 서른아홉 → 마흔넷)

   [왜 그림 파일이 아니라 코드로 그리나]
   PNG 를 쓰려면 파일 저장소(Firebase Storage)가 필요하고, 그건 요금제를
   올려야 합니다. 그림을 글자로 바꿔 메시지에 실어 보내는 방법도 있지만
   한 장에 수십 KB 라 채팅이 무거워져요.

   SVG 는 선과 도형을 코드로 적는 방식이라 열다섯 개를 다 합쳐도 몇 KB 고,
   확대해도 안 깨지며, 저장소가 필요 없습니다. 더마감은 이미 프사 눈사람을
   이 방식으로 그리고 있어요.

   [서버에는 무엇이 남나]
   `[[스티커:pat]]` 같은 **짧은 글자 하나**뿐입니다. 그림은 각자 화면에서
   그려집니다. 그래서 통신량이 늘지 않고, 나중에 그림을 고쳐도 지난
   채팅까지 함께 바뀝니다.

   [크레파스 느낌은 두 가지를 겹쳤습니다]
     ① 손글씨 글꼴 — 감자꽃(Gamja Flower). index.html 에서 불러옵니다.
     ② 흔들림 필터 — feTurbulence 로 선을 미세하게 울퉁불퉁하게.
        그림 테두리와 글씨에 함께 걸려서 종이에 그린 것처럼 보입니다.

   ★ 글꼴은 인터넷에서 받아옵니다. 느리거나 막히면 잠깐 기본 글꼴로
     보였다가 바뀝니다 — 글자가 사라지진 않아요.

   [글씨 크기 — fs (2026-09-10)]
   이름은 보통 22px 로 씁니다. 그런데 「참잘했어요」처럼 다섯 자가 되면
   그 크기로는 그림 밖으로 삐져나가요. 그래서 스티커마다 `fs` 를 적어
   그 하나만 줄일 수 있게 했습니다. **안 적으면 예전 그대로 22px** 이라,
   기존 스물다섯 개는 한 글자도 안 건드렸어요.
   ===================================================================== */
(function () {
  "use strict";

  /* 저장되는 값(id)은 짧은 영문입니다. 나중에 이름이나 그림을 바꿔도
     지난 채팅이 깨지지 않게요. cmd 는 슬래시로 부르는 이름입니다. */
  const STICKERS = [
    {
      /* 인사가 맨 앞 — 판을 열면 제일 먼저 눈에 들어오는 자리입니다.
         들어오자마자 쓰는 스티커라 손이 가장 자주 갈 거예요. */
      id: "hi", cmd: "방가", label: "방가방가",
      svg: `<circle cx="30" cy="32" r="14" fill="#8FB8E0"/>
            <circle cx="25" cy="30" r="1.8" fill="#3A2A22"/>
            <circle cx="35" cy="30" r="1.8" fill="#3A2A22"/>
            <path d="M25 36q5 5 10 0" stroke="#3A2A22" stroke-width="1.9" fill="none" stroke-linecap="round"/>
            <circle cx="20" cy="36" r="2.4" fill="#F0A0B8" opacity=".75"/>
            <circle cx="40" cy="36" r="2.4" fill="#F0A0B8" opacity=".75"/>
            <path d="M45 30q6-2 8-8" stroke="#3A2A22" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            <ellipse cx="55" cy="19" rx="6" ry="5" fill="#F3DCC4" stroke="#3A2A22"
                     stroke-width="1.7" transform="rotate(18 55 19)"/>
            <path d="M60 9l3-3M64 15h4M59 22l3 3" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#2F6191"
    },
    {
      /* 인사 둘을 나란히 — 처음 만났을 때(방가)와 다시 만났을 때(리하이).
         두 얼굴이 마주보는 그림으로, 혼자 손 흔드는 방가와 구분됩니다.
         (재출근이 이미 ↻ 를 쓰고 있어서 화살표는 피했어요) */
      id: "rehi", cmd: "리하이", label: "리하이",
      svg: `<circle cx="24" cy="34" r="11" fill="#AFA9EC"/>
            <circle cx="21" cy="33" r="1.6" fill="#3A2A22"/>
            <circle cx="28" cy="33" r="1.6" fill="#3A2A22"/>
            <path d="M21 38q3.5 3 7 0" stroke="#3A2A22" stroke-width="1.7" fill="none" stroke-linecap="round"/>
            <circle cx="48" cy="34" r="11" fill="#CFC9F4"/>
            <circle cx="44" cy="33" r="1.6" fill="#3A2A22"/>
            <circle cx="51" cy="33" r="1.6" fill="#3A2A22"/>
            <path d="M44 38q3.5 3 7 0" stroke="#3A2A22" stroke-width="1.7" fill="none" stroke-linecap="round"/>
            <path d="M36 22c-2-3-6-2-6 1 0 2.6 3.6 4.6 6 6.4 2.4-1.8 6-3.8 6-6.4 0-3-4-4-6-1z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M14 20l2 3M58 20l-2 3" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#4A3F9E"
    },
    {
      /* 인사 셋을 나란히 — 방가(처음) · 리하이(다시) · 어서와요(맞이).
         앞의 둘은 들어온 사람이 하는 말이고, 이건 **맞는 쪽**이 하는
         말이라 얼굴 하나가 아니라 두 팔을 벌린 온몸으로 그렸습니다. */
      id: "welcome", cmd: "어서와", label: "어서와요",
      cmdRe: /^\/(어서와|어서와요|환영)$/,
      svg: `<circle cx="36" cy="26" r="10" fill="#6FBF9B"/>
            <circle cx="32" cy="25" r="1.6" fill="#3A2A22"/>
            <circle cx="40" cy="25" r="1.6" fill="#3A2A22"/>
            <path d="M32 30q4 3.5 8 0" stroke="#3A2A22" stroke-width="1.7" fill="none" stroke-linecap="round"/>
            <path d="M28 38q-9 3-12 12M44 38q9 3 12 12" stroke="#3A2A22" stroke-width="2.6" fill="none" stroke-linecap="round"/>
            <path d="M36 36v16" stroke="#3A2A22" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M13 34c-1.4-2-4.2-1.4-4.2.7 0 1.8 2.5 3.1 4.2 4.4 1.7-1.3 4.2-2.6 4.2-4.4 0-2.1-2.8-2.7-4.2-.7z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.1"/>
            <path d="M59 34c-1.4-2-4.2-1.4-4.2.7 0 1.8 2.5 3.1 4.2 4.4 1.7-1.3 4.2-2.6 4.2-4.4 0-2.1-2.8-2.7-4.2-.7z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.1"/>`,
      textColor: "#2E7D57"
    },
    {
      /* ── [2026-09-10] 하루의 처음과 끝 셋 ──────────────────
         인사 넷(방가·리하이·어서와·잘가)은 **방에 들고 나는** 인사였고,
         이 셋은 **하루**를 여닫는 인사입니다. 그래서 인사 무리 안에
         섞어 두되, 굿모닝은 앞(들어올 때)·낼봐/굿밤은 뒤(나갈 때)로
         갈라 놨어요 — 판에서 위아래로 하루가 흐르게. */
      id: "morning", cmd: "굿모닝", label: "굿모닝",
      cmdRe: /^\/(굿모닝|모닝|좋은아침)$/,
      svg: `<path d="M21 44a15 15 0 0 1 30 0z" fill="#F3D9A0" stroke="#3A2A22" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M8 44h56" stroke="#3A2A22" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M36 20v-6M20 28l-4-4M52 28l4-4M13 40H7M65 40h-6" stroke="#F0C674" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M11 16q3-3 5 0q2-3 5 0" stroke="#8FB8E0" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
      textColor: "#C2762B"
    },
        {
      /* ★ 방가방가가 이미 "얼굴 + 흔드는 손" 입니다. 잘가요까지 얼굴을
         넣으면 판에서 둘이 헷갈려요. 그래서 **손만** 크게 그리고,
         흔들리는 결을 양옆에 넣어 움직임으로 구분했습니다. */
      id: "bye", cmd: "잘가", label: "잘가요",
      cmdRe: /^\/(잘가|잘가요|바이)$/,
      svg: `<path d="M32 46V28c0-3 4-3 4 0v10M36 38V24c0-3 4-3 4 0v14M40 38V26c0-3 4-3 4 0v12M44 40V30c0-3 4-3 4 0v12c0 8-4 14-10 14-7 0-12-5-12-12v-6c0-3 4-3 4 0z"
                  fill="#F3DCC4" stroke="#3A2A22" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M18 22q-4-3-4-7M20 30q-6 0-9-3M56 22q4-3 4-7M54 30q6 0 9-3"
                  stroke="#8FB8E0" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      textColor: "#2F6191"
    },
    {
      /* 낼 봐요 — 잘가요(오늘 그만) 바로 뒤. 손을 또 그리면 잘가요와
         겹치니까 **달력**으로 갔습니다. 내일 칸에 동그라미가 쳐 있어요. */
      id: "seeya", cmd: "낼봐", label: "낼 봐요",
      cmdRe: /^\/(낼봐|내일봐|낼봐요)$/,
      svg: `<path d="M26 18v6M46 18v6" stroke="#3A2A22" stroke-width="2.2" stroke-linecap="round"/>
            <rect x="16" y="22" width="40" height="32" rx="5" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M16 27a5 5 0 0 1 5-5h30a5 5 0 0 1 5 5v3H16z" fill="#8FB8E0" stroke="#3A2A22" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M23 38h6M33 38h6M43 38h6M23 46h6M33 46h6M43 46h6" stroke="#C9BCA8" stroke-width="3" stroke-linecap="round"/>
            <circle cx="36" cy="46" r="6.5" fill="none" stroke="#B3372B" stroke-width="2.2"/>
            <path d="M62 14l-3 3M9 14l3 3" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#2F6191"
    },
    {
      /* 굿밤 — 🛏️ 이불 덮고 누운 얼굴.
         ★ 초승달만 쓰면 맛저(달+별)와 헷갈리고, zZ 만 쓰면 자리 비움과
           겹칩니다. 그래서 **눕힌 얼굴 + 이불**을 본체로 두고 달·zZ 는
           곁들이로만 뒀어요 — 셋 중 어느 것과도 안 겹칩니다. */
      id: "gnight", cmd: "굿밤", label: "굿밤",
      cmdRe: /^\/(굿밤|잘자|굿나잇)$/,
      svg: `<ellipse cx="36" cy="40" rx="22" ry="9" fill="#EDE3D2" stroke="#3A2A22" stroke-width="1.5"/>
            <circle cx="30" cy="34" r="11" fill="#F3DCC4" stroke="#3A2A22" stroke-width="1.6"/>
            <path d="M24.5 33.5q2.5 2.4 5 0M32.5 33.5q2.5 2.4 5 0" stroke="#3A2A22" stroke-width="1.7" fill="none" stroke-linecap="round"/>
            <path d="M28 40q2.5 2 4.5 0" stroke="#3A2A22" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <path d="M12 43h48v6a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" fill="#8FB8E0" stroke="#3A2A22" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M12 47h48" stroke="#3A2A22" stroke-width="1.2" opacity=".45"/>
            <path d="M60 10a7 7 0 1 0 4 12 8.4 8.4 0 0 1-4-12z" fill="#F3D9A0" stroke="#3A2A22" stroke-width="1.4"/>
            <text x="43" y="24" font-family="'Gamja Flower',cursive" font-size="15" fill="#8FB8E0">zZ</text>
            <path d="M14 16l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="#AFA9EC"/>`,
      textColor: "#4A3F9E"
    },
        {
      /* ── 밥 셋 ─────────────────────────────────────────────
         날마다 오갈 말이라 인사 바로 뒤, 판의 첫 줄 언저리에 둡니다.
         밥그릇 하나를 셋이 나눠 쓰되 한눈에 갈리게 했어요 —
           밥탐 : 곁눈질하는 얼굴 + 하트 (셋 중 유일하게 얼굴이 있음)
           맛점 : 해 + 노란 그릇
           맛저 : 초승달·별 + 파란 그릇 (색이 차가워 맛점과 안 헷갈림) */
      id: "yum", cmd: "밥탐", label: "밥탐",
      cmdRe: /^\/(밥탐|배고파|배고픔)$/,
      svg: `<path d="M27 34q12-11 24 0z" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M22 34h34c0 10-7.6 16-17 16s-17-6-17-16z" fill="#F0997B" stroke="#3A2A22"
                  stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M22 34h34" stroke="#3A2A22" stroke-width="1.6"/>
            <circle cx="12" cy="24" r="8" fill="#F0C674"/>
            <circle cx="9.5" cy="23" r="1.9" fill="#3A2A22"/>
            <circle cx="15" cy="23" r="1.9" fill="#3A2A22"/>
            <path d="M10 28q2.5 2.5 5 0" stroke="#3A2A22" stroke-width="1.6" fill="none" stroke-linecap="round"/>
            <path d="M14 31q1 3 0 4" stroke="#8FB8E0" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M60 20c-1.6-2.4-5-1.6-5 .8 0 2.1 3 3.7 5 5.2 2-1.5 5-3.1 5-5.2 0-2.4-3.4-3.2-5-.8z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.2" stroke-linejoin="round"/>`,
      textColor: "#993C1D"
    },
    {
      id: "lunch", cmd: "맛점", label: "맛점",
      cmdRe: /^\/(맛점|점심)$/,
      svg: `<circle cx="55" cy="14" r="6" fill="#F3D9A0" stroke="#3A2A22" stroke-width="1.5"/>
            <path d="M55 4v3M64 14h-3M62 7l-2 2M62 21l-2-2" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M27 36q12-11 24 0z" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M22 36h34c0 10-7.6 16-17 16s-17-6-17-16z" fill="#F0C674" stroke="#3A2A22"
                  stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M22 36h34" stroke="#3A2A22" stroke-width="1.6"/>
            <path d="M30 26q3-4 0-8M45 26q3-4 0-8" stroke="#C9BCA8" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      textColor: "#C2762B"
    },
    {
      id: "dinner", cmd: "맛저", label: "맛저",
      cmdRe: /^\/(맛저|저녁)$/,
      svg: `<path d="M58 8a8 8 0 1 0 5 14 9.5 9.5 0 0 1-5-14z" fill="#EDE9F5" stroke="#3A2A22"
                  stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M13 12l1.6 3.4L18 17l-3.4 1.6L13 22l-1.6-3.4L8 17l3.4-1.6z" fill="#AFA9EC"/>
            <path d="M45 8l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#AFA9EC"/>
            <path d="M27 36q12-11 24 0z" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M22 36h34c0 10-7.6 16-17 16s-17-6-17-16z" fill="#8FB8E0" stroke="#3A2A22"
                  stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M22 36h34" stroke="#3A2A22" stroke-width="1.6"/>
            <path d="M30 26q3-4 0-8M45 26q3-4 0-8" stroke="#C9BCA8" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      textColor: "#2F6191"
    },
    {
      /* 카페인 — 밥 셋(밥탐·맛점·맛저) 뒤에 붙입니다. 마감방에서 커피는
         끼니의 넷째니까요. 김만 그리면 맛점의 김과 헷갈려서 **번개**를
         옆에 뒀어요 — "충전" 이 한눈에 읽힙니다. */
      id: "coffee", cmd: "커피", label: "카페인", fs: 21,
      cmdRe: /^\/(커피|카페인|충전)$/,
      svg: `<path d="M18 28h30v14c0 6-5 10-11 10h-8c-6 0-11-4-11-10z" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M18.5 28h29v5h-29z" fill="#7A5439"/>
            <path d="M48 32h5a6.5 6.5 0 0 1 0 13h-5" fill="none" stroke="#3A2A22" stroke-width="2"/>
            <path d="M26 22q3-4 0-8M36 22q3-4 0-8" stroke="#C9BCA8" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <path d="M62 12l-7 10h5l-4 9" stroke="#F0C674" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      textColor: "#993C1D"
    },
        {
      id: "pat", cmd: "토닥", label: "토닥토닥",
      svg: `<circle cx="27" cy="34" r="14" fill="#F0C674"/>
            <circle cx="22" cy="33" r="1.7" fill="#3A2A22"/>
            <circle cx="32" cy="33" r="1.7" fill="#3A2A22"/>
            <path d="M23 39q4 3 8 0" stroke="#3A2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <ellipse cx="41" cy="19" rx="7" ry="5" fill="#F3DCC4" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M43 24q3 3 2 7" stroke="#3A2A22" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <path d="M35 11v3M41 10v4M47 13v3" stroke="#B3372B" stroke-width="2" stroke-linecap="round" opacity=".65"/>`,
      textColor: "#B3372B"
    },
    {
      id: "fight", cmd: "파이팅", label: "파이팅",
      svg: `<circle cx="36" cy="32" r="14" fill="#6FBF9B"/>
            <circle cx="31" cy="30" r="1.7" fill="#3A2A22"/>
            <circle cx="41" cy="30" r="1.7" fill="#3A2A22"/>
            <path d="M31 37q5 4 10 0" stroke="#3A2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M22 24 18 14M50 24l4-10" stroke="#3A2A22" stroke-width="2.6" stroke-linecap="round"/>
            <circle cx="17" cy="11" r="3" fill="#B3372B"/>
            <circle cx="55" cy="11" r="3" fill="#B3372B"/>`,
      textColor: "#2E7D57"
    },
    /* [2026-08-11] 응원 두 장. 🙌 파이팅 옆에 나란히 둡니다 —
       고르는 판에서 비슷한 결끼리 모여 있어야 눈이 덜 헤맵니다. */
    {
      id: "cheerup", cmd: "힘내", label: "힘내요",
      svg: `<circle cx="28" cy="33" r="13" fill="#F2B07A"/>
            <path d="M21.5 32l2.5-3 2.5 3M30.5 32l2.5-3 2.5 3" stroke="#3A2A22" stroke-width="1.9"
                  fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M24 39q4 4 8 0" stroke="#3A2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M40 41q9 2 10-7" stroke="#3A2A22" stroke-width="2.8" fill="none" stroke-linecap="round"/>
            <path d="M43 36q5-1 6-6" stroke="#3A2A22" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/>
            <circle cx="51" cy="27" r="5.5" fill="#F2B07A" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M58 13l1.4 3.2 3.2 1.4-3.2 1.4-1.4 3.2-1.4-3.2-3.2-1.4 3.2-1.4z" fill="#B3372B" opacity=".75"/>`,
      textColor: "#993C1D"
    },
    {
      id: "cando", cmd: "할뚜", label: "할뚜이따",
      svg: `<circle cx="36" cy="32" r="14" fill="#F6C8D6"/>
            <path d="M28 31l3-3 3 3M38 31l3-3 3 3" stroke="#3A2A22" stroke-width="1.9"
                  fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <ellipse cx="36" cy="39" rx="3.4" ry="2.9" fill="#B3372B"/>
            <circle cx="25" cy="36" r="2.6" fill="#F0A0B8" opacity=".85"/>
            <circle cx="47" cy="36" r="2.6" fill="#F0A0B8" opacity=".85"/>
            <circle cx="17" cy="41" r="4.6" fill="#F6C8D6" stroke="#3A2A22" stroke-width="1.7"/>
            <circle cx="55" cy="41" r="4.6" fill="#F6C8D6" stroke="#3A2A22" stroke-width="1.7"/>
            <path d="M13 29l-3-3M59 29l3-3M36 15v-4" stroke="#F0C674" stroke-width="2.4" stroke-linecap="round"/>`,
      textColor: "#C2557A"
    },
    {
      /* 아자아자 — 주먹 둘이 위로 불끈.
         ★ [2026-09-10 · 콩] 처음엔 이 그림을 「박수」로 냈는데, 주먹이라
           손뼉으로 안 읽히고 오히려 응원처럼 보인다는 얘기가 나왔어요.
           그림은 그대로 두고 **이름만** 아자아자로 옮겼습니다 — 응원
           무리(파이팅·힘내요·할뚜이따) 바로 뒤가 제자리예요.
           박수는 아래에 글자 스티커로 새로 그렸습니다. */
      id: "aza", cmd: "아자", label: "아자아자",
      cmdRe: /^\/(아자|아자아자|아자자)$/,
      svg: `<g transform="rotate(-20 22 39)">
              <rect x="4" y="33" width="10" height="13" rx="3.5" fill="#F6C4AC" stroke="#3A2A22" stroke-width="1.5"/>
              <rect x="10" y="30" width="24" height="19" rx="8" fill="#F3DCC4" stroke="#3A2A22" stroke-width="1.7"/>
              <path d="M18 31v17M24 30.5v18M30 31.5v16" stroke="#3A2A22" stroke-width="1.4" opacity=".5"/>
            </g>
            <g transform="rotate(20 50 39)">
              <rect x="58" y="33" width="10" height="13" rx="3.5" fill="#F6C4AC" stroke="#3A2A22" stroke-width="1.5"/>
              <rect x="38" y="30" width="24" height="19" rx="8" fill="#F3DCC4" stroke="#3A2A22" stroke-width="1.7"/>
              <path d="M42 31.5v16M48 30.5v18M54 31v17" stroke="#3A2A22" stroke-width="1.4" opacity=".5"/>
            </g>
            <path d="M36 23v-9M27 26l-4-7M45 26l4-7" stroke="#F0C674" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M15 54l-3 4M57 54l3 4" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#C2762B"
    },
    {
      /* ── [2026-09-10] 칭찬 셋 ────────────────────────────
         응원(파이팅·힘내요·할뚜이따·아자아자)은 **하기 전**에 하는 말이고,
         이 셋은 **하고 난 뒤**에 하는 말입니다. 그래서 응원 바로 뒤.

         [박수는 왜 그림이 아니라 글자인가 — 콩 결정]
         손을 어떻게 그려도 58px 로 줄면 두 덩어리로 뭉개졌습니다.
         손가락을 하나하나 그린 안도 만들어 봤지만, 이 방에서 오갈 말은
         모양보다 **소리**에 가까웠어요 — 그래서 손을 빼고 「짝짝짝!」을
         그림 자리에 넣었습니다. 글씨는 다른 스티커 이름과 같은 감자꽃이고
         흔들림 필터도 똑같이 걸려서, 손그림들 사이에 놔도 안 겉돕니다.
         세 글자의 색을 조금씩 다르게 해서 소리가 연달아 나는 느낌을 줬어요. */
      id: "clap", cmd: "박수", label: "박수",
      cmdRe: /^\/(박수|짝짝|짝짝짝)$/,
      svg: `<text x="36" y="36" text-anchor="middle" font-size="21"
                  font-family="'Gamja Flower', cursive" stroke-width="0.6" paint-order="stroke"
                  transform="rotate(-5 36 34)"
            ><tspan fill="#C2762B" stroke="#C2762B">짝</tspan
            ><tspan fill="#E08A2E" stroke="#E08A2E">짝</tspan
            ><tspan fill="#B3372B" stroke="#B3372B">짝!</tspan></text>
            <path d="M14 14l1.6 3.6 3.6 1.6-3.6 1.6-1.6 3.6-1.6-3.6-3.6-1.6 3.6-1.6z" fill="#F0C674"/>
            <path d="M58 42l1.4 3.2 3.2 1.4-3.2 1.4-1.4 3.2-1.4-3.2-3.2-1.4 3.2-1.4z" fill="#F0C674"/>
            <path d="M55 13l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="#F0A0B8"/>
            <path d="M16 46l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" fill="#F0A0B8"/>
            <path d="M6 30h5M61 28h5M36 50v4M36 12v-4" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#C2762B"
    },
    {
      /* 참잘했어요 — 어릴 적 공책에 찍히던 그 도장.
         ★ 글씨가 다섯 자라 22px 로는 그림 밖으로 삐져나갑니다. 그래서
           fs 로 17px 까지 낮췄어요 (아래 stickerHtml 참고). */
      id: "stamp", cmd: "참잘", label: "참잘했어요", fs: 17,
      cmdRe: /^\/(참잘|참잘했어요|참참)$/,
      svg: `<g transform="rotate(-9 36 34)">
              <circle cx="36" cy="34" r="19.5" fill="none" stroke="#B3372B" stroke-width="2.6"/>
              <circle cx="36" cy="34" r="15" fill="#FBE7E1" stroke="#B3372B" stroke-width="1.6"/>
              <path d="M27 30q3-4 6 0M39 30q3-4 6 0" stroke="#B3372B" stroke-width="2.2" fill="none" stroke-linecap="round"/>
              <path d="M29 38q7 6 14 0" stroke="#B3372B" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            </g>
            <path d="M11 16l3 3M61 16l-3 3M36 8v3" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#B3372B"
    },
    {
      /* 칭찬해요 — 하트를 뿅뿅 날리는 얼굴.
         ★ 처음엔 "쓰다듬는 손 + 얼굴" 로 그렸는데 토닥토닥과 판박이였어요.
           손을 빼고 하트를 날리니 비로소 갈립니다. */
      id: "praise", cmd: "칭찬", label: "칭찬해요",
      cmdRe: /^\/(칭찬|칭찬해|칭찬해요)$/,
      svg: `<circle cx="26" cy="37" r="13" fill="#CFC9F4"/>
            <path d="M18 35q3-4 6 0M28 35q3-4 6 0" stroke="#3A2A22" stroke-width="2.1" fill="none" stroke-linecap="round"/>
            <path d="M21 42q5 4 10 0" stroke="#3A2A22" stroke-width="1.9" fill="none" stroke-linecap="round"/>
            <path d="M0 0c-1.6-2.4-5-1.6-5 .8 0 2.1 3 3.7 5 5.2 2-1.5 5-3.1 5-5.2 0-2.4-3.4-3.2-5-.8z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.3" stroke-linejoin="round" transform="translate(50 30)"/>
            <path d="M0 0c-1.6-2.4-5-1.6-5 .8 0 2.1 3 3.7 5 5.2 2-1.5 5-3.1 5-5.2 0-2.4-3.4-3.2-5-.8z"
                  fill="#F6C8D6" stroke="#3A2A22" stroke-width="1.6" stroke-linejoin="round" transform="translate(59 17) scale(.75)"/>
            <path d="M0 0c-1.6-2.4-5-1.6-5 .8 0 2.1 3 3.7 5 5.2 2-1.5 5-3.1 5-5.2 0-2.4-3.4-3.2-5-.8z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="2.1" stroke-linejoin="round" transform="translate(45 13) scale(.55)"/>`,
      textColor: "#C2557A"
    },
        {
      id: "away", cmd: "자리비움", label: "자리 비움",
      svg: `<rect x="18" y="24" width="36" height="22" rx="6" fill="#EDE3D2" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M26 32h20M26 38h13" stroke="#8A7B68" stroke-width="2" stroke-linecap="round"/>
            <text x="50" y="17" font-family="'Gamja Flower',cursive" font-size="17" fill="#8FB8E0">zZ</text>`,
      textColor: "#6B7C8C"
    },
    {
      id: "off", cmd: "퇴근", label: "퇴근",
      svg: `<path d="M16 32 36 17l20 15" stroke="#3A2A22" stroke-width="2.4" fill="none" stroke-linejoin="round"/>
            <rect x="22" y="31" width="28" height="17" rx="4" fill="#F0C674" stroke="#3A2A22" stroke-width="1.8"/>
            <rect x="32" y="38" width="8" height="10" rx="2" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.5"/>
            <circle cx="57" cy="14" r="5" fill="#F3D9A0"/>
            <path d="M57 6v3M64 14h-3M62 9l-2 2" stroke="#F0C674" stroke-width="2" stroke-linecap="round"/>`,
      textColor: "#C2762B"
    },
    {
      id: "on", cmd: "출근", label: "출근",
      svg: `<circle cx="36" cy="30" r="13" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M36 22v8l5 4" stroke="#B3372B" stroke-width="2.4" stroke-linecap="round" fill="none"/>
            <path d="M24 48h24M30 48l3-5M42 48l-3-5" stroke="#3A2A22" stroke-width="2" stroke-linecap="round"/>`,
      textColor: "#B3372B"
    },
    {
      id: "reon", cmd: "재출근", label: "재출근",
      svg: `<path d="M50 32a14 14 0 1 1-5-10.7" stroke="#6FBF9B" stroke-width="3.4" fill="none" stroke-linecap="round"/>
            <path d="M46 12v10H36" stroke="#6FBF9B" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="31" cy="30" r="1.8" fill="#3A2A22"/>
            <circle cx="41" cy="30" r="1.8" fill="#3A2A22"/>
            <path d="M31 37q5 4 10 0" stroke="#3A2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
      textColor: "#2E7D57"
    },
    {
      /* ── [2026-09-10] 해냈다 셋 ──────────────────────────
         자리(자리 비움·퇴근·출근·재출근)가 **어디 있는지**라면, 이 셋은
         **뭘 했는지**입니다. 자리 무리 바로 뒤에 붙였어요. */
      id: "dash", cmd: "달린다", label: "달린다",
      cmdRe: /^\/(달린다|달려|집중)$/,
      svg: `<circle cx="43" cy="18" r="6.5" fill="#6FBF9B" stroke="#3A2A22" stroke-width="1.5"/>
            <path d="M41 25l-5 12" stroke="#3A2A22" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M41 29l8 5M40 31l-9 2" stroke="#3A2A22" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M36 37l9 8M36 37l-6 11" stroke="#3A2A22" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M6 22h14M4 32h16M8 42h12" stroke="#8FB8E0" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M53 50q5-4 4-10" stroke="#F0997B" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
      textColor: "#2E7D57"
    },
    {
      /* 1빡 완료 — 뽀모 한 판을 끝냈을 때.
         ★ id 에 숫자를 못 씁니다 (판정이 /^\[\[스티커:([a-z]+)\]\]$/ 라서요).
           그래서 이름은 「1빡」이어도 id 는 pomo 예요. 여기 숫자를 넣으면
           지난 채팅의 스티커가 통째로 안 읽힙니다.
         ★ 오케이(동그라미+체크)와 안 겹치게, 체크는 토마토 **바깥**의
           작은 배지로 뺐습니다. */
      id: "pomo", cmd: "1빡", label: "1빡 완료", fs: 19,
      cmdRe: /^\/(1빡|일빡|한빡|빡완료)$/,
      svg: `<circle cx="32" cy="38" r="16" fill="#E4705C" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M23 32q4-5 9-5" stroke="#F6C4AC" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>
            <path d="M32 22v-6M32 22l-8-4M32 22l8-4M32 22l-6 5M32 22l6 5" stroke="#6FBF9B" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="55" cy="48" r="10" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.7"/>
            <path d="M50 48l3.6 4 7-8" stroke="#2E7D57" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 20l3 3M13 32H8" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#B3372B"
    },
    {
      /* 마감 완료 — 원고 더미에 깃발을 꽂았습니다. 이 방에서 제일
         자랑스러운 한 마디라 색은 붉게. */
      id: "done", cmd: "마감완료", label: "마감 완료", fs: 19,
      cmdRe: /^\/(마감완료|끝냈다|마감끝)$/,
      svg: `<rect x="14" y="32" width="34" height="22" rx="3" fill="#EDE3D2" stroke="#3A2A22" stroke-width="1.5" transform="rotate(-7 31 43)"/>
            <rect x="19" y="30" width="34" height="24" rx="3" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M25 38h22M25 44h22M25 50h13" stroke="#C9BCA8" stroke-width="2" stroke-linecap="round"/>
            <path d="M52 34V10" stroke="#3A2A22" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M52 11h14l-4 5 4 5H52z" fill="#B3372B" stroke="#3A2A22" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M11 22l3 3M14 14H9" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#B3372B"
    },
        {
      /* 따봉 — 방에서 제일 자주 오갈 말이라 크고 단순하게.
         손등(코랄)과 소매(연한 코랄)를 나눠서 작게 줄여도 형태가 삽니다. */
      id: "good", cmd: "좋아", label: "좋아요",
      svg: `<path d="M31 47V31l7-11c2-3 6.4-2 6 2l-1 7h9c2.6 0 4.4 2.4 3.6 4.8l-3.4 10.4
                     c-.7 2-2.6 3.4-4.7 3.4H31z"
                  fill="#F0997B" stroke="#3A2A22" stroke-width="1.8" stroke-linejoin="round"/>
            <rect x="18" y="31" width="12" height="17" rx="3.5"
                  fill="#F6C4AC" stroke="#3A2A22" stroke-width="1.7"/>
            <path d="M52 13l3-3M58 19h5M56 26l3 2" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#993C1D"
    },
    {
      /* ★ 따봉은 이미 좋아요가 쓰고 있습니다. 최고예요까지 손을 쓰면
         둘이 겹쳐서, 별에 얼굴을 붙였습니다. */
      id: "best", cmd: "최고", label: "최고예요",
      cmdRe: /^\/(최고|최고예요|짱)$/,
      svg: `<path d="M36 14l6.6 13.4L57 29.6 46.5 40l2.5 14.5L36 47.7 22.5 54.5 25 40 14.5 29.6l14.9-2.2z"
                  fill="#F0C674" stroke="#3A2A22" stroke-width="1.8" stroke-linejoin="round"/>
            <circle cx="31" cy="33" r="1.7" fill="#3A2A22"/>
            <circle cx="41" cy="33" r="1.7" fill="#3A2A22"/>
            <path d="M31 39q5 4 10 0" stroke="#3A2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M9 12l3 3M63 12l-3 3M36 4v4" stroke="#F0997B" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#C2762B"
    },
    {
      /* 고마워요 — 두 손으로 하트를 받쳐 든 모양.

         ★ 처음에는 두 손을 위아래로 붙여 모은 모양(🙏)이었는데,
           작게 줄이면 손 둘이 한 덩어리로 뭉쳐 보여서 무슨 그림인지
           안 읽혔습니다. 손을 **양옆으로 벌리고** 사이에 하트를 띄우니
           비로소 "건네는" 모양이 됐어요. */
      id: "thanks", cmd: "고마워", label: "고마워요",
      cmdRe: /^\/(고마워|고마워요|감사|땡큐)$/,
      svg: `<path d="M36 30c-3.5-4.6-10.5-3.4-10.5 2.9 0 5.2 7 9.2 10.5 12.6 3.5-3.4 10.5-7.4 10.5-12.6 0-6.3-7-7.5-10.5-2.9z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.7" stroke-linejoin="round"/>
            <ellipse cx="24" cy="50" rx="11" ry="6.5" fill="#F3DCC4" stroke="#3A2A22"
                     stroke-width="1.7" transform="rotate(-20 24 50)"/>
            <ellipse cx="48" cy="50" rx="11" ry="6.5" fill="#F3DCC4" stroke="#3A2A22"
                     stroke-width="1.7" transform="rotate(20 48 50)"/>
            <path d="M14 22l2 3M58 22l-2 3M36 14v4" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#993C1D"
    },
    {
      /* 끄덕끄덕 — 얼굴이 아래로 살짝 기울고, 위아래 움직임을 곡선 둘로.
         "듣고 있어요" 에 가까운 말이라 색은 차분한 연두로. */
      id: "nod", cmd: "끄덕", label: "끄덕끄덕",
      cmdRe: /^\/(끄덕|ㅇㅇ)$/,
      svg: `<g transform="rotate(9 36 32)">
              <circle cx="36" cy="32" r="14" fill="#C0DD97"/>
              <path d="M30 29q0 0 0 0" stroke="#3A2A22" stroke-width="3.4" stroke-linecap="round"/>
              <circle cx="31" cy="30" r="1.8" fill="#3A2A22"/>
              <circle cx="41" cy="30" r="1.8" fill="#3A2A22"/>
              <path d="M31 37q5 3.5 10 0" stroke="#3A2A22" stroke-width="1.8"
                    fill="none" stroke-linecap="round"/>
            </g>
            <path d="M17 20q3-4 6 0M17 44q3 4 6 0" stroke="#7FA84E" stroke-width="2.2"
                  fill="none" stroke-linecap="round"/>
            <path d="M55 20q-3-4-6 0M55 44q-3 4-6 0" stroke="#7FA84E" stroke-width="2.2"
                  fill="none" stroke-linecap="round"/>`,
      textColor: "#3B6D11"
    },
    {
      /* 오케이 — 동그라미 안에 체크.

         [다시 그린 이유]
         처음에는 손 모양(엄지·검지로 만든 원 + 뻗은 손가락 셋)을 선으로만
         그렸는데, "손인지 안 보인다"는 얘기가 나왔습니다. 손가락 셋이
         가는 선 세 개로만 남아서, 뜻 없는 획처럼 보였어요.

         손을 제대로 그리는 안도 있었지만 판에서는 58px 까지 줄어듭니다.
         그 크기에서 손가락 셋은 서로 붙어 뭉개져요. 체크는 획이 둘뿐이라
         작아져도 형태가 그대로 남습니다. */
      id: "ok", cmd: "오케이", label: "오케이",
      cmdRe: /^\/(ㅇㅋ|오케이|오키)$/,
      svg: `<circle cx="36" cy="30" r="17" fill="#9BD9C4" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M27 30l6.5 7L46 23" fill="none" stroke="#1F6B5C"
                  stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11 16l3 3M58 13l3-3M62 24h4"
                  stroke="#F0C674" stroke-width="2.4" stroke-linecap="round"/>`,
      textColor: "#1F6B5C"
    },
    {
      /* ── [2026-09-10] 반응 셋 ────────────────────────────
         맞장구(좋아요·최고예요·고마워요·끄덕끄덕·오케이) 와
         기분(ㅋㅋ·ㅎㅎ·ㅠㅠ) 사이. 남의 말에 튀어나오는 한 마디들이라
         딱 그 사이가 제자리입니다. */
      /* ★ [2026-09-10 · 콩] 처음엔 「헐 대박」이었습니다. 감탄 다섯을 들이면서
         「헐」이 따로 생겼고, 슬래시 하나가 두 스티커에 걸리면 안 되니
         이쪽을 「대박」으로 물러 줬어요. **id 는 그대로 wow** 라서 지난
         채팅에 남은 것도 안 깨지고, 이름만 「대박」으로 바뀌어 보입니다. */
      id: "wow", cmd: "대박", label: "대박",
      cmdRe: /^\/(대박|쩐다|와)$/,
      svg: `<circle cx="32" cy="34" r="14" fill="#F3D9A0"/>
            <circle cx="26" cy="31" r="3.6" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.4"/>
            <circle cx="26" cy="31" r="1.7" fill="#3A2A22"/>
            <circle cx="38" cy="31" r="3.6" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.4"/>
            <circle cx="38" cy="31" r="1.7" fill="#3A2A22"/>
            <ellipse cx="32" cy="42" rx="4.4" ry="5.4" fill="#B3372B"/>
            <path d="M55 13v12" stroke="#B3372B" stroke-width="3.2" stroke-linecap="round"/>
            <circle cx="55" cy="30" r="1.9" fill="#B3372B"/>
            <path d="M64 20v8" stroke="#F0997B" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="64" cy="32.5" r="1.5" fill="#F0997B"/>
            <path d="M10 22l4 3M8 34h5M10 46l4-3" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#C2762B"
    },
    {
      /* ── [2026-09-10] 감탄 다섯 ──────────────────────────
         대박(놀라움) 뒤, 미안해요 앞. 남의 말에 튀어나오는 소리라
         반응 무리 한가운데가 제자리입니다.

         [다섯을 한 세트로 그린 이유]
         얼굴 크기(r=14)와 자리를 다섯이 똑같이 맞추고 **눈과 입만**
         바꿨습니다. ㅋㅋㅋ·ㅎㅎㅎ·ㅠㅠㅠ 가 이미 그렇게 한 가족으로
         보이는데, 감탄도 같은 방식으로 묶어야 판에서 "이 줄은 감탄" 이
         한눈에 읽혀요. 낱개로 예쁘게 그리는 것보다 이게 낫습니다. */
      id: "wau", cmd: "와우", label: "와우",
      cmdRe: /^\/(와우|우와|와아)$/,
      svg: `<circle cx="34" cy="32" r="14" fill="#F7D154"/>
            <path d="M0 -4L1.3-1.3L4 0L1.3 1.3L0 4L-1.3 1.3L-4 0L-1.3-1.3Z" fill="#3A2A22"
                  transform="translate(28 29) scale(1.05)"/>
            <path d="M0 -4L1.3-1.3L4 0L1.3 1.3L0 4L-1.3 1.3L-4 0L-1.3-1.3Z" fill="#3A2A22"
                  transform="translate(40 29) scale(1.05)"/>
            <path d="M28 38q6 8 12 0z" fill="#B3372B" stroke="#3A2A22" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M13 15l1.6 3.6 3.6 1.6-3.6 1.6-1.6 3.6-1.6-3.6-3.6-1.6 3.6-1.6z" fill="#F0C674"/>
            <path d="M57 20l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3z" fill="#F0A0B8"/>
            <path d="M34 14v-5M52 14l3-4M16 44l-4 3M56 42l4 2" stroke="#F0C674" stroke-width="2.3" stroke-linecap="round"/>`,
      textColor: "#C2762B"
    },
    {
      /* 오 — 다섯 중 유일하게 **눈썹**이 있습니다. 눈썹이 올라가면
         담백한 감탄이 되고, 입까지 작아서 와우와 안 겹쳐요. */
      id: "oh", cmd: "오", label: "오",
      cmdRe: /^\/(오|오오|오호)$/,
      svg: `<circle cx="34" cy="32" r="14" fill="#9BD9C4"/>
            <path d="M25 24.5q3.5-3 7 0M36 24.5q3.5-3 7 0" stroke="#3A2A22" stroke-width="2" fill="none" stroke-linecap="round"/>
            <circle cx="29" cy="31" r="1.9" fill="#3A2A22"/>
            <circle cx="39" cy="31" r="1.9" fill="#3A2A22"/>
            <ellipse cx="34" cy="40" rx="2.7" ry="3.4" fill="#3A2A22"/>
            <path d="M54 24q4-3 4-8" stroke="#F0C674" stroke-width="2.3" fill="none" stroke-linecap="round"/>
            <circle cx="59" cy="30" r="1.7" fill="#F0C674"/>`,
      textColor: "#1F6B5C"
    },
    {
      /* 호에엑 — 기겁. /히이익 · /헉 도 같은 그림입니다.
         ★ 셋을 따로 그리지 않은 이유: 뜻이 거의 같아서, 판에 셋이 나란히
           있으면 고를 때 고민만 늘어납니다. 부르는 이름만 셋으로 뒀어요. */
      id: "eek", cmd: "호에엑", label: "호에엑", fs: 19,
      cmdRe: /^\/(호에엑|히이익|헉|기겁)$/,
      svg: `<circle cx="34" cy="33" r="14" fill="#B7D3E8"/>
            <circle cx="28" cy="31" r="4.2" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.4"/>
            <circle cx="28" cy="31" r="1.5" fill="#3A2A22"/>
            <circle cx="40" cy="31" r="4.2" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.4"/>
            <circle cx="40" cy="31" r="1.5" fill="#3A2A22"/>
            <path d="M27 41l3 3 3-3 3 3 3-3" stroke="#3A2A22" stroke-width="2" fill="none"
                  stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M22 15l-2-6M34 13V7M46 15l2-6" stroke="#3A2A22" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M54 26q-3 5-3 7.2a3 3 0 0 0 6 0Q57 31 54 26z" fill="#8FB8E0" stroke="#3A2A22" stroke-width="1.1"/>
            <path d="M13 30q-2.4 4-2.4 5.8a2.4 2.4 0 0 0 4.8 0Q15.4 34 13 30z" fill="#8FB8E0" stroke="#3A2A22" stroke-width="1"/>`,
      textColor: "#2F6191"
    },
    {
      /* 헐 — 얼이 빠진 놀람. 죽겠어요(×× 눈)와 달리 눈은 멀쩡한 점이고
         **입이 세로로** 벌어집니다. 뒤의 세로 점선이 충격이에요. */
      id: "heol", cmd: "헐", label: "헐",
      cmdRe: /^\/(헐|허얼)$/,
      svg: `<path d="M12 16v16M60 16v16" stroke="#A79FC4" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3 4"/>
            <circle cx="34" cy="32" r="14" fill="#EDE9F5" stroke="#C9C2D8" stroke-width="1.4"/>
            <path d="M28 20v4M40 20v4" stroke="#A79FC4" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="28" cy="30" r="2" fill="#3A2A22"/>
            <circle cx="40" cy="30" r="2" fill="#3A2A22"/>
            <ellipse cx="34" cy="41" rx="3.2" ry="5" fill="#3A2A22"/>
            <path d="M20 46q-3 3-3 6M48 46q3 3 3 6" stroke="#A79FC4" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      textColor: "#5A5175"
    },
    {
      /* 아... — 허탈하거나 이제야 알아들었을 때. 눈이 반쯤 풀린 가로선이고,
         옆의 점 셋이 말끝을 흐립니다. 고개를 살짝 기울여 힘을 뺐어요. */
      id: "ah", cmd: "아", label: "아...",
      cmdRe: /^\/(아|아아|아하)$/,
      svg: `<g transform="rotate(9 34 33)">
              <circle cx="34" cy="33" r="14" fill="#F3DCC4"/>
              <path d="M25.5 30.5h6M37.5 30.5h6" stroke="#3A2A22" stroke-width="2.2" stroke-linecap="round"/>
              <ellipse cx="34" cy="40" rx="3" ry="3.8" fill="#3A2A22"/>
            </g>
            <path d="M50 22q5-2 6-7" stroke="#C9BCA8" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <circle cx="52" cy="46" r="1.9" fill="#A79A88"/>
            <circle cx="58" cy="47" r="1.7" fill="#A79A88"/>
            <circle cx="64" cy="48" r="1.5" fill="#A79A88"/>`,
      textColor: "#6B7C8C"
    },
    {
      /* 미안해요 — 고개를 숙인 얼굴 + 땀 한 방울.
         죽겠어요(×× 눈)와 달리 눈은 감겨 있고 입이 물결입니다. */
      id: "sorry", cmd: "미안", label: "미안해요",
      cmdRe: /^\/(미안|미안해|죄송|ㅈㅅ)$/,
      svg: `<g transform="rotate(18 34 35)">
              <circle cx="34" cy="35" r="14" fill="#F5C4B3"/>
              <path d="M27 33q2.6 3 5.2 0M36 33q2.6 3 5.2 0" stroke="#3A2A22" stroke-width="1.9" fill="none" stroke-linecap="round"/>
              <path d="M30 42q2-2 4 0t4 0" stroke="#3A2A22" stroke-width="1.7" fill="none" stroke-linecap="round"/>
            </g>
            <path d="M55 24q-3 5-3 7.4a3 3 0 0 0 6 0Q58 29 55 24z" fill="#8FB8E0" stroke="#3A2A22" stroke-width="1.1"/>
            <path d="M14 22l3 3M12 34h4" stroke="#C9BCA8" stroke-width="2" stroke-linecap="round"/>`,
      textColor: "#A34A32"
    },
    {
      /* 잠깐만요 — 모래시계. 자리 비움(메모지+zZ)은 **오래** 자리를
         뜨는 것이고, 이건 **곧 돌아오는** 것입니다. */
      id: "wait", cmd: "잠깐", label: "잠깐만요",
      cmdRe: /^\/(잠깐|잠만|잠깐만|1분만)$/,
      svg: `<path d="M22 14h28M22 52h28" stroke="#3A2A22" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M26 15c0 8 10 12 10 18 0-6 10-10 10-18zM26 51c0-8 10-12 10-18 0 6 10 10 10 18z"
                  fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M28.5 19h15c-1 4-7.5 7-7.5 11 0-4-6.5-7-7.5-11z" fill="#F0C674"/>
            <path d="M28.5 48c1-4 7.5-6 7.5-6s6.5 2 7.5 6z" fill="#F0C674"/>
            <path d="M36 34v6" stroke="#F0C674" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M13 24l3 3M59 24l-3 3M13 42l3-3M59 42l-3-3" stroke="#8FB8E0" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#B07D12"
    },
        {
      /* 웃음·울음은 짝으로 둡니다. 얼굴 크기와 눈 위치를 맞춰서
         나란히 놓았을 때 한 세트로 보이게 했어요. */
      id: "haha", cmd: "ㅋㅋ", label: "ㅋㅋㅋ",
      /* /ㅋ 부터 /ㅋㅋㅋㅋㅋ 까지 다 받습니다 — 웃을 때 몇 번 치는지는
         그때그때 다르니까요. (아래 cmdRe) */
      cmdRe: /^\/ㅋ{1,12}$/,
      svg: `<circle cx="36" cy="30" r="15" fill="#F7D154"/>
            <path d="M27 26q3.5-4.5 7 0M38 26q3.5-4.5 7 0"
                  stroke="#3A2A22" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <path d="M26 34q10 13 20 0z" fill="#B3372B" stroke="#3A2A22"
                  stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M13 21l-4-3M14 29h-5M59 21l4-3M58 29h5"
                  stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#B07D12"
    },
    {
      /* ㅎㅎ 는 ㅋㅋ 보다 한 톤 낮은 웃음입니다 — 입을 벌리지 않고
         눈웃음에 볼만 발그레하게. 색도 노랑 대신 살구빛으로 낮췄어요. */
      id: "hehe", cmd: "ㅎㅎ", label: "ㅎㅎㅎ",
      cmdRe: /^\/ㅎ{1,12}$/,
      svg: `<circle cx="36" cy="30" r="15" fill="#F5C4B3"/>
            <path d="M27 28q3.5-4.5 7 0M38 28q3.5-4.5 7 0"
                  stroke="#3A2A22" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <path d="M30 37q6 5 12 0" stroke="#3A2A22" stroke-width="1.9"
                  fill="none" stroke-linecap="round"/>
            <circle cx="24" cy="35" r="3" fill="#E88A78" opacity=".7"/>
            <circle cx="48" cy="35" r="3" fill="#E88A78" opacity=".7"/>`,
      textColor: "#A34A32"
    },
    {
      id: "cry", cmd: "ㅠㅠ", label: "ㅠㅠㅠ",
      /* ㅠ 와 ㅜ 를 섞어 쳐도 받습니다 */
      cmdRe: /^\/[ㅠㅜ]{1,12}$/,
      svg: `<circle cx="36" cy="30" r="15" fill="#A8C8E8"/>
            <path d="M27 27q3.5 4.5 7 0M38 27q3.5 4.5 7 0"
                  stroke="#3A2A22" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <path d="M31 39q5-4 10 0" stroke="#3A2A22" stroke-width="1.9"
                  fill="none" stroke-linecap="round"/>
            <path d="M30 32q-2.5 5-2.5 7.5a2.5 2.5 0 0 0 5 0Q32.5 37 30 32z" fill="#5B9BD5"/>
            <path d="M42 32q-2.5 5-2.5 7.5a2.5 2.5 0 0 0 5 0Q44.5 37 42 32z" fill="#5B9BD5"/>`,
      textColor: "#2F6191"
    },
    {
      /* 죽겠어요 — 마감 앞둔 방에서 가장 자주 오갈 말입니다.
         눈이 ×× 로 풀린 얼굴에서 영혼이 빠져나가는 모양이에요.
         스무 개 중 유일하게 보라 계열이라 판에서 바로 눈에 띕니다. */
      id: "dead", cmd: "죽겠다", label: "죽겠어요",
      cmdRe: /^\/(죽겠다|죽겠어|힘들어)$/,
      svg: `<ellipse cx="34" cy="40" rx="16" ry="12" fill="#C9C2D8"/>
            <path d="M25 35l6 6M31 35l-6 6M39 35l6 6M45 35l-6 6"
                  stroke="#3A2A22" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M30 47q4-3 8 0" stroke="#3A2A22" stroke-width="1.9" fill="none" stroke-linecap="round"/>
            <path d="M50 34q5-2 4-7t3-8" stroke="#A79FC4" stroke-width="2" fill="none"
                  stroke-linecap="round" stroke-dasharray="3 3"/>
            <circle cx="58" cy="16" r="4.5" fill="#EDE9F5" stroke="#A79FC4" stroke-width="1.4"/>`,
      textColor: "#5A5175"
    },
    {
      id: "cheer", cmd: "축하", label: "축하",
      svg: `<path d="M36 44 20 24h32z" fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M20 24h32l-6-8H26z" fill="#F6C8D6" stroke="#3A2A22" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M12 14l3 4M60 14l-3 4M36 8v4" stroke="#F0C674" stroke-width="2.4" stroke-linecap="round"/>`,
      textColor: "#C2557A"
    }
  ];

  const MARK_RE = /^\[\[스티커:([a-z]+)\]\]$/;
  const byId = (id) => STICKERS.find(s => s.id === id) || null;

  window.STICKERS = STICKERS;
  window.isStickerMsg = (msg) => MARK_RE.test(String(msg || "").trim());

  /* 흔들림 필터는 화면에 딱 하나만 둡니다 (스티커마다 만들면 무거워요) */
  function ensureFilter() {
    if (document.getElementById("sticker-filter-host")) return;
    const host = document.createElement("div");
    host.id = "sticker-filter-host";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    host.innerHTML = `<svg><filter id="crayon-rough">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"
                           xChannelSelector="R" yChannelSelector="G"/>
      </filter></svg>`;
    document.body.appendChild(host);
  }

  /** 채팅 말풍선 자리에 들어갈 그림. 못 알아보는 값이면 빈 문자열. */
  window.stickerHtml = function (msg, size) {
    const m = String(msg || "").trim().match(MARK_RE);
    const s = m && byId(m[1]);
    if (!s) return "";
    ensureFilter();
    const px = size || 104;
    return `<svg class="msg-sticker" width="${px}" height="${px}" viewBox="0 0 72 82"
                 role="img" aria-label="${s.label}" filter="url(#crayon-rough)">
      ${s.svg}
      <text x="36" y="72" text-anchor="middle" font-size="${s.fs || 22}"
            font-family="'Gamja Flower', cursive" fill="${s.textColor}"
            stroke="${s.textColor}" stroke-width="0.5" paint-order="stroke"
      >${s.label}</text>
    </svg>`;
  };

  /* =====================================================================
     고르기 판
     ---------------------------------------------------------------------
     보내는 길은 새로 뚫지 않습니다. 입력칸에 `[[스티커:id]]` 를 적고
     원래 send() 를 부릅니다 — 그러면 수다방으로 갈지 채팅으로 갈지,
     답장인지 아닌지까지 기존 흐름이 알아서 판단해요.
     ===================================================================== */
  let _pop = null;

  function close() {
    if (!_pop) return;
    _pop.remove();
    _pop = null;
    document.removeEventListener("click", onDoc, true);
    document.removeEventListener("keydown", onKey, true);
  }
  function onDoc(e) {
    if (_pop && !_pop.contains(e.target) && !e.target.closest("#" + _곳.btnId)) close();
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  /* =====================================================================
     어느 글칸에 놓을 것인가 (2026-08-30 — ⚙️ 비밀방도 스티커를 쓰면서)
     ---------------------------------------------------------------------
     예전에는 #message 하나만 알고 있었습니다. 비밀방은 제 글칸(#sroom-in)
     과 제 보내기를 쓰므로, **어디에 쓸지**를 받아 둡니다.
     ★ 기본값은 그대로 챗이에요 — 부르는 쪽을 안 고쳐도 예전처럼 돕니다.
     ===================================================================== */
  let _곳 = { btnId: "sticker-btn", inputId: "message", send: () => window.send?.() };

  function pick(id) {
    const el = document.getElementById(_곳.inputId);
    if (!el) return;
    el.value = `[[스티커:${id}]]`;
    close();
    try { _곳.send?.(); } catch (e) {}
    el.focus();
    countForAchv(id);
  }

  /* 🏅 업적에 알리기 — 인사왕·토닥이·스티커 수집가가 이 숫자를 봅니다.
     ★ 업적 파일이 없어도 스티커는 그대로 돌아야 하므로 ?. 로 부릅니다. */
  function countForAchv(id) {
    try {
      window.achvBump?.("stk", id);                 // 종류 모으기
      /* [2026-08-11] 어느 스티커가 어느 업적에 드는지 한곳에 모았습니다.
         전에는 if 가 흩어져 있어서, 스티커를 늘릴 때 업적 쪽을 같이
         고쳐야 한다는 걸 놓치기 쉬웠어요.
         ★ 겹쳐도 됩니다 — 🙌 힘내요는 토닥이에도, 응원왕에도 듭니다.
           위로이면서 응원이니까요. */
      const ACHV_STK = {
        /* [2026-09-10] 새로 든 열셋 중 인사·위로·응원에 해당하는 것들을
           같이 물려 놨습니다. 업적 기준을 안 고치면, 새 스티커를 아무리
           써도 배지가 안 붙어서 "왜 나만 안 되지" 가 됩니다. */
        /* ★ 한 줄에 하나씩 — checks.js 가 줄 단위로 읽습니다 (여러 줄로
           나누면 "아예 없음" 으로 잡혀요). */
        cGreet: ["hi", "rehi", "welcome", "bye", "morning", "seeya", "gnight"], // 👋 인사왕
        cPat:   ["pat", "cheerup", "praise"],                                   // 🫶 토닥이
        cCheer: ["fight", "cheerup", "cando", "aza", "clap", "stamp"]           // 📣 응원왕
      };
      Object.keys(ACHV_STK).forEach(k => {
        if (ACHV_STK[k].includes(id)) window.achvBump?.(k);
      });
    } catch (e) {}
  }

  window.toggleStickerPicker = function (곳) {
    if (_pop) { close(); return; }
    /* 어디서 부른 것인지 — 안 주면 챗입니다 (예전 그대로) */
    _곳 = Object.assign({ btnId: "sticker-btn", inputId: "message",
                          send: () => window.send?.() }, 곳 || {});
    const btn = document.getElementById(_곳.btnId);
    if (!btn) return;
    ensureFilter();

    const pop = document.createElement("div");
    pop.className = "sticker-pop";
    pop.setAttribute("role", "menu");
    pop.setAttribute("aria-label", "스티커 고르기");
    pop.innerHTML = STICKERS.map(s => `
      <button type="button" class="sticker-opt" data-sticker="${s.id}"
              title="${s.label} (/${s.cmd})" aria-label="${s.label}"
      >${window.stickerHtml(`[[스티커:${s.id}]]`, 58)}</button>`).join("");
    document.body.appendChild(pop);

    const r = btn.getBoundingClientRect();
    /* 🧘 혼자 방의 확대·축소 — 재는 자를 하나로 맞춥니다 (진짜 방은 늘 1) */
    const _z = (window.uiZoom?.() || 1);
    const VW = innerWidth / _z, VH = innerHeight / _z;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(r.left / _z, VW - w - 8);
    let top = r.top / _z - h - 8;
    if (top < 8) top = r.bottom / _z + 8;     // 위가 좁으면 아래로
    pop.style.left = Math.max(8, left) + "px";
    pop.style.top = top + "px";

    pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sticker]");
      if (b) pick(b.dataset.sticker);
    });

    _pop = pop;
    setTimeout(() => {
      document.addEventListener("click", onDoc, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);
  };

  /* =====================================================================
     /토닥 처럼 쳐서 보내기
     ---------------------------------------------------------------------
     send() 를 고치지 않고 **감싸서** 처리합니다. 보내기 직전에 입력칸의
     `/토닥` 을 `[[스티커:pat]]` 로 바꿔 두면, 그 뒤는 원래 흐름 그대로예요.
     (수다방으로 보낼지 채팅으로 보낼지도 원래 코드가 판단합니다)

     ★ [2026-09-01 — 콩 신고 "비밀방에서 스티커 명령어가 안 먹혀"]
     판정 로직(STICKERS.find + countForAchv)을 여기 안에서만 썼더니, 글칸이
     따로인 비밀방(#sroom-in · sroom보내기())은 이 감싸기를 아예 못 거쳤어요
     — window.send 를 감싸 봐야 sroom보내기는 그 함수를 안 부르니까요.
     판단 부분만 `window.stickerCmdText`로 떼어내 script_sroom.js 도
     똑같이 가져다 씁니다. (운세·외치기는 챗 SLASH_COMMANDS 소관이라
     그대로 안 됨 — 콩 확인: "그건 안 돼도 돼".) */
  window.stickerCmdText = function (raw) {
    const m = String(raw || "").trim();
    /* cmdRe 가 있으면 그것도 봅니다 — /ㅋ 부터 /ㅋㅋㅋㅋ 까지 받으려고요.
       웃을 때 ㅋ 을 몇 번 치는지는 사람마다 그때그때 다릅니다. */
    const hit = STICKERS.find(s => m === "/" + s.cmd || (s.cmdRe && s.cmdRe.test(m)));
    if (!hit) return null;
    /* 판을 안 열고 슬래시로 친 것도 같은 값으로 셉니다 */
    countForAchv(hit.id);
    return `[[스티커:${hit.id}]]`;
  };

  function installSendHook() {
    const orig = window.send;
    if (typeof orig !== "function" || orig.__stickerHooked) return false;
    const wrapped = function () {
      try {
        const el = document.getElementById("message");
        const conv = window.stickerCmdText(el?.value);
        if (conv) el.value = conv;
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__stickerHooked = true;
    window.send = wrapped;
    return true;
  }

  /* script_chat.js 가 먼저 window.send 를 올려야 감쌀 수 있습니다.
     로드 순서가 어긋나도 되도록 잠깐 기다렸다 다시 시도합니다. */
  (function tryHook(n) {
    if (installSendHook()) return;
    if (n < 40) setTimeout(() => tryHook(n + 1), 100);
  })(0);
})();
