/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_sroom.js — ⚙️ 비밀 대화방 (2026-08-29, 콩)

   [무엇인가]
   명단에 든 사람만 들어오는 조용한 방. 알약은 ⚙️ 하나뿐이고 챗 왼쪽에
   섭니다. 명단 밖 멤버가 눌러도 "준비중입니다." 만 보여요.

   =====================================================================
   ★★★ 예전 비밀방은 왜 죽었나 — 되풀이하지 않으려고 적어 둡니다
   ---------------------------------------------------------------------
   2026-08-07 에 걷어낸 첫 비밀방(messages3 · script_secret.js)은
   **이름이 부딪혀서** 죽었습니다. script_chat.js 의 _secretActive 와
   script_secret.js 의 _secretActive 가 같은 이름이라 파일 하나가 통째로
   먹통이 됐고, 감춰 둔 기능이라 **몇 주 동안 아무도 몰랐어요.**

   그래서 이번에는:
     ① 이름을 전부 sroom 으로 시작합니다. 다른 파일과 겹칠 여지가 없어요.
     ② **챗의 세 번째 탭이 아닙니다.** 제 판을 갖고, 글 쓰는 칸도 제 것을
        따로 팝니다 — 콩이 먼저 짚은 대목이에요.
        ★ 이게 큰 이득입니다. 챗·수다방은 "창은 둘, 펜은 하나" 라
          #message 를 판 사이로 옮기는데(moveInput), 거기가 바로
          2026-08-13 **한글 자소 분리 사고**가 났던 자리예요. 비밀방이
          제 입력칸을 가지면 그 지뢰를 통째로 피합니다.
     ③ 검사(checks)가 이 방을 지켜봅니다. 조용히 죽어도 알 수 있게요.

   =====================================================================
   ★★ 비밀은 **화면이 아니라 보안규칙**이 지킵니다
   ---------------------------------------------------------------------
       sallow/{uid} = "닉"      ← 명단. 방장만 고칠 수 있습니다
       sroom/{id}   = { user, msg, time }

   알약은 모두에게 보이고, 눌러도 "준비중입니다." 가 뜰 뿐입니다. 화면을
   우회해 sroom 을 직접 읽으려 해도 **규칙이 막습니다** — 명단에 없으면
   한 글자도 못 봐요. 감추는 것과 잠그는 것은 다른 일이고, 여기선 둘 다 합니다.

   ★ 명단은 uid 로 답니다. 규칙이 auth.uid 하나로 판정할 수 있어서요.
     닉으로 달면 규칙이 uid→닉을 되짚을 방법이 없습니다. 화면에서는
     닉으로 넣고 빼되, nickOwner 에서 uid 를 찾아 적습니다 (staff 와 같은 결).

   ★ 붉은 점(newmark)을 **일부러 안 답니다.** newmark 는 모두가 읽을 수
     있어서, 점 하나로 "지금 저 방에서 얘기 중" 이 새 나갑니다.
   ===================================================================== */
(function () {
  "use strict";

  const SROOM_MAX  = 400;          // 한 번에 들고 있는 줄 수
  const SROOM_LEN  = 2000;         // 한 줄 최대 글자
  /* 🔤 글씨 크기 — 이 판에서만 씁니다 (기기별로 기억) */
  const SROOM_FS_KEY = "sroomFont";
  const SROOM_FS_MIN = 11, SROOM_FS_MAX = 20, SROOM_FS_DEF = 13;

  let _sroomRef = null;
  let _sroomRows = [];
  let _sroomOk = null;             // null = 아직 모름, true/false = 명단 안/밖
  let _sroomBound = false;
  let _sroomBusy = false;
  let _sroomList = false;          // 방장 명단 창을 펼쳤나
  let _sroomAllow = {};            // uid → 닉 (방장만 읽힙니다)
  let _sroom틀 = "";               // 지금 지어 둔 틀의 모양 (아래 그리기 참고)

  /* =====================================================================
     😊 반응 · ↩ 답글 (2026-08-30 — 콩. 수다방을 접으면서 옮겨 왔습니다)
     ---------------------------------------------------------------------
     ★★★ 반응을 **`reactions` 에 안 넣습니다.** 챗이 쓰는 그 노드는
        읽기가 **누구에게나 열려** 있어요. 거기 넣으면 "어느 비밀방 글에
        반응이 몇 개 붙었나" 가 방 밖에서도 보입니다. 글자는 안 새도
        **오갔다는 사실**이 새는 것이고, 이 방은 그걸 감추려고 만든
        자리예요 (붉은 점을 일부러 안 다는 것과 같은 이유 — 위 주석).
        → `sreactions` 를 따로 파고 **sroom 과 똑같이** 잠급니다.

     ★ 답글은 글에 `replyTo` 칸을 하나 얹습니다. 원문이 지워져도(자정
       청소) 인용은 남아요 — 그 편이 대화가 안 끊깁니다.
     ===================================================================== */
  const SROOM_반응 = [
    { id: "heart", emoji: "❤️", label: "하트" },
    { id: "up",    emoji: "👍", label: "따봉" },
    { id: "laugh", emoji: "😂", label: "웃김" },
    { id: "wow",   emoji: "😮", label: "놀람" },
    { id: "sad",   emoji: "🥹", label: "뭉클" },
    { id: "fire",  emoji: "🔥", label: "불타오르네" }
  ];
  const SROOM_반응맵 = Object.fromEntries(SROOM_반응.map(r => [r.id, r]));

  let _srReactRef = null;
  let _srReact = {};               // { 글키: { 반응id: { 닉: true } } }
  let _sr답할것 = null;            // { key, user, msg } — 지금 답글 다는 대상

  const el = (id) => document.getElementById(id);
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? "")) : String(s ?? ""));

  /* ★ script_core.js 의 myNick 은 최상위 let 이라 window 에 안 붙습니다.
     이 방에서 여러 번 데인 자리예요 (자료실·Work Log 도 같은 함수를 둡니다). */
  function sroomMe() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }
  function sroomUid() {
    try { return firebase.auth().currentUser?.uid || ""; } catch (e) { return ""; }
  }

  function 때(t) {
    const d = new Date(Number(t) || Date.now());
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
    return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${m}`;
  }

  /* =====================================================================
     명단 — 내가 들어 있나
     ★ sallow/{내 uid} 만 읽습니다. 명단 전체는 방장만 읽을 수 있어요
       (규칙이 그렇게 잠겨 있습니다). 남이 누구인지 서로 몰라도 됩니다.
     ===================================================================== */
  async function sroom들었나() {
    const uid = sroomUid();
    if (!uid || !window.db) return false;
    if (window.isRoomOwner?.()) return true;
    try {
      return (await window.db.ref("sallow/" + uid).once("value")).exists();
    } catch (e) { return false; }
  }

  /* =====================================================================
     그리기
     ===================================================================== */
  function sroom준비중() {
    return `<div class="sr-wait">준비중입니다.</div>`;
  }

  /* =====================================================================
     💬 말풍선 (2026-08-30 — 콩 "카톡처럼 보이게, 스티커도")
     ---------------------------------------------------------------------
     ★★★ 챗의 렌더러(renderChatMessage)를 **안 빌립니다.** 그쪽 말풍선에는
        반응 단추가 박혀 있고, 그 단추는 공개된 `reactions` 노드를 씁니다.
        빌려 쓰는 순간 비밀방 반응이 방 밖에서 보여요 — 방금 sreactions 로
        따로 잠가 둔 뜻이 통째로 무너집니다. 그래서 겉모습만 같게 짓고
        속은 이 방 것으로 둡니다.
     ★ 스티커·프사·닉색은 **함수만 빌립니다** — 그건 그리는 일만 하고
       서버를 안 건드려서 새는 것이 없어요.
       · window.stickerHtml    `[[스티커:id]]` → 그림
       · window.chatAvatarHtml 프사
       · window.nickColorStyle 각자 고른 닉네임 색
     ===================================================================== */

  /** 이모지 한 글자인가 — 그러면 말풍선 없이 크게 놓습니다 */
  function 이모지하나(t) {
    if (!t || t.trim() !== t) return false;
    try {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        const 조각 = [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(t)];
        if (조각.length !== 1) return false;
        return /\p{Emoji}/u.test(조각[0].segment) && !/^[0-9#*]$/.test(조각[0].segment);
      }
    } catch (e) {}
    return /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})(‍(\p{Emoji_Presentation}|\p{Extended_Pictographic})|️|⃣)*$/u.test(t);
  }

  /** @내이름 이 불렸나 — 챗과 같은 뜻입니다 */
  function 나를불렀나(t) {
    const 나 = sroomMe();
    if (!나 || !t) return false;
    try { return window.msgContainsMyMention?.(t) === true; } catch (e) {}
    return String(t).includes("@" + 나);
  }

  const 날키 = (t) => {
    const d = new Date(Number(t) || Date.now());
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  };

  /** 한 줄 — 앞줄(전)을 보고 묶을지 정합니다 */
  function sroom줄HTML(r, 전) {
    const 내것 = r.user === sroomMe();

    /* 📅 날짜가 바뀌면 가로줄 하나 — 카톡의 그 줄입니다 */
    let 날줄 = "";
    if (!전 || 날키(전.time) !== 날키(r.time)) {
      const d = new Date(Number(r.time) || Date.now());
      날줄 = `<div class="sr-date"><span></span>
        <b>${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일</b><span></span></div>`;
    }

    /* 같은 사람이 5분 안에 잇달아 말하면 이름·프사를 생략하고 붙입니다.
       ★ 날짜가 바뀌었으면 묶지 않습니다 — 줄 아래위로 갈라져야 하니까요. */
    const 묶음 = !날줄 && 전 && 전.user === r.user &&
                 Math.abs(Number(r.time) - Number(전.time)) < 5 * 60 * 1000;

    /* ↩ 답글 인용 — 원문이 자정 청소로 지워져도 이건 남습니다 */
    const 인용 = r.replyTo ? `
      <div class="sr-quote" data-sroom-goto="${esc(r.replyTo.key || "")}" title="원문으로">
        <b>↪ ${esc(r.replyTo.user || "")}</b>
        <span>${esc(r.replyTo.msg || "")}</span>
      </div>` : "";

    /* 🖼 스티커 · 😀 큰 이모지 — 둘 다 말풍선 옷을 벗깁니다 */
    const 스티커 = window.stickerHtml?.(r.msg) || "";
    const 큰이모지 = !스티커 && 이모지하나(r.msg);
    const 불렸나 = !내것 && 나를불렀나(r.msg);
    const 풍선칸 = "sr-bubble" + (스티커 ? " sticker" : 큰이모지 ? " emoji" : "")
                 + (불렸나 ? " mention" : "");
    const 속 = 스티커 || esc(r.msg);

    /* 프사 — 남의 말에만, 묶이지 않은 첫 줄에만 (카톡과 같은 결) */
    const 프사 = (!내것 && !묶음)
      ? (window.chatAvatarHtml?.(r.user, "") || `<div class="sr-ava-x">✍️</div>`)
      : `<div class="sr-ava-gap"></div>`;

    return `${날줄}
      <div class="sr-row${내것 ? " mine" : ""}${묶음 ? " grouped" : ""}"
           data-sroom-key="${esc(r.id)}">
        ${내것 ? "" : 프사}
        <div class="sr-body">
          ${(내것 || 묶음) ? "" :
            `<div class="sr-who" data-name-of="${esc(r.user)}"${window.nickColorStyle?.(r.user) || ""}>${esc(r.user)}</div>`}
          ${인용}
          <div class="sr-line">
            <div class="${풍선칸}">${속}</div>
            <div class="sr-t">${esc(때(r.time))}</div>
            <span class="sr-tools">
              <button type="button" data-sroom-react="1" aria-label="반응" title="반응 남기기">☺</button>
              <button type="button" data-sroom-reply="1" aria-label="답글" title="답글">↩</button>
            </span>
          </div>
          ${sroom반응줄HTML(r.id)}
        </div>
      </div>`;
  }

  /** 그 글에 붙은 반응 알약들 — 아무도 안 눌렀으면 줄 자체가 없습니다 */
  function sroom반응줄HTML(키) {
    const 것 = _srReact[키];
    if (!것) return "";
    const 나 = sroomMe();
    const 알약 = SROOM_반응.map(({ id, emoji }) => {
      const 누구 = 것[id];
      const n = 누구 ? Object.keys(누구).length : 0;
      if (!n) return "";
      const 내가 = !!(나 && 누구[나]);
      return `<button type="button" class="sr-react${내가 ? " on" : ""}"
                      data-sroom-toggle="${id}" title="${esc(Object.keys(누구).join(", "))}"
              >${emoji} ${n}</button>`;
    }).join("");
    return 알약 ? `<div class="sr-reacts">${알약}</div>` : "";
  }

  /* ★ [고침 2026-08-29 — 콩] 명단을 **가로로** 늘어놓습니다.
     세로로 한 줄씩 쌓으면 사람이 늘 때마다 대화가 밀려 내려가요.
     이름표(칩)로 옆으로 흐르게 두면 열 명이 넘어도 두어 줄에 들어갑니다.
     ★ "들어올 수 있는 사람" 이라는 머리글도 뺐습니다 — 👥 하나로 뜻이
       통하고, 좁은 판에서 한 줄은 큰 자리예요. */
  function sroom명단HTML() {
    if (!window.isRoomOwner?.() || !_sroomList) return "";
    const 줄 = Object.entries(_sroomAllow);
    return `
      <div class="sr-allow">
        <span class="sr-allow-ic" title="들어올 수 있는 사람">👥</span>
        ${줄.length
          ? 줄.map(([uid, 닉]) => `
              <span class="sr-chip">${esc(닉)}<button type="button"
                    data-sroom-out="${esc(uid)}" title="빼기" aria-label="빼기">✕</button></span>`).join("")
          : `<span class="sr-allow-e">아직 아무도 없어요 · 방장은 늘 들어옵니다</span>`}
        <button type="button" class="sr-allow-add" data-sroom-add="1"
                title="닉네임으로 넣기">＋</button>
      </div>`;
  }

  /* 🔤 글씨 크기 — 이 판에서만. 기기에 남습니다(서버에 안 보냅니다) */
  function sroom글씨() {
    const v = Number(window.AppStore?.getItem(SROOM_FS_KEY));
    return Number.isFinite(v) && v >= SROOM_FS_MIN && v <= SROOM_FS_MAX ? v : SROOM_FS_DEF;
  }
  function sroom글씨바꾸기(d) {
    const v = Math.max(SROOM_FS_MIN, Math.min(SROOM_FS_MAX, sroom글씨() + d));
    try { window.AppStore?.setItem(SROOM_FS_KEY, String(v)); } catch (e) {}
    /* ★★ 여기서 **다시 그리지 않습니다.** CSS 값 하나만 갈아 끼워요.
       다시 그리면 글칸이 새로 태어나 쓰던 글과 커서가 날아갑니다. */
    const 판 = el("dock-body-sroom")?.querySelector(".sr-board");
    if (판) 판.style.setProperty("--sr-fs", v + "px");
    const 숫 = el("sroom-fs");
    if (숫) 숫.textContent = v;
  }

  /* =====================================================================
     ★★★ [고침 2026-08-29 — 콩] 틀은 한 번만 짓고, 줄만 갈아 끼웁니다
     ---------------------------------------------------------------------
     [무슨 일이 있었나]
     콩: "엔터쳐서 대화 하나 날리고 나면 커서가 날아가서 연속으로 치기가
          어려워." — 글을 보내면 서버가 알려주고, 그때 판 **전체**를
     다시 그렸습니다. 그러면 <textarea> 가 통째로 새로 태어나요. 커서는
     물론이고 초점도 사라집니다.

     ★ 남이 글을 보내도 똑같이 일어났습니다. 게다가 그 순간 내가 한글을
       **조합 중이었다면 그것까지 날아가요** — 2026-08-13 자소 분리 사고와
       같은 집안입니다. 그때 얻은 교훈이 이거였어요:
       **글 쓰는 칸은 다시 만들지 말 것.**

     [그래서]
       · sroom틀짓기() — 판의 뼈대를 짓습니다. 모양이 달라질 때만 부릅니다.
       · sroom줄그리기() — .sr-log 속만 갈아 끼웁니다. 글칸은 안 건드려요.
     "모양이 달라졌나" 는 _sroom틀 에 적어 두고 견줍니다.
     ===================================================================== */
  function sroom틀모양() {
    return [_sroomOk, _sroomList, !!window.isRoomOwner?.(),
            Object.keys(_sroomAllow).join(",")].join("|");
  }

  function sroom틀짓기() {
    const box = el("dock-body-sroom");
    if (!box) return;
    _sroom틀 = sroom틀모양();

    if (_sroomOk === null) { box.innerHTML = `<div class="sr-wait">…</div>`; return; }
    if (_sroomOk === false) { box.innerHTML = sroom준비중(); return; }

    /* ★★ 아래 글 쓰는 칸은 **제 것**입니다 (#sroom-in).
       챗·수다방의 글칸을 옮겨 오지 않아요 — 그 이사가 2026-08-13
       한글 자소 분리 사고의 자리였습니다 (맨 위 머리말 참고).
       ※ 화면에 그려지는 조각에는 옛 이름을 적지 않습니다. 검사가
         "옛 얼개가 돌아왔나" 를 글자로 훑거든요. */
    box.innerHTML = `
      <div class="sr-board" style="--sr-fs:${sroom글씨()}px">
        <div class="sr-top">
          ${window.isRoomOwner?.()
            ? `<button type="button" class="sr-key" data-sroom-list="1">👥 승인</button>` : ""}
          <span class="sr-sp"></span>
          <!-- 🔤 글씨 크기 — 이 판에서만, 이 기기에서만 (콩 2026-08-29) -->
          <span class="sr-fs" title="이 방의 글씨 크기 (이 기기에서만)">
            <button type="button" data-sroom-font="-1" aria-label="글씨 작게">－</button>
            <b id="sroom-fs">${sroom글씨()}</b>
            <button type="button" data-sroom-font="1" aria-label="글씨 크게">＋</button>
          </span>
        </div>
        ${sroom명단HTML()}
        <div class="sr-log"></div>
        <div class="sr-write">
          <!-- 🖼 스티커 — 챗과 같은 것을 씁니다. 고르기 판이 "어느 글칸에
               놓을지" 를 받도록 고쳤어요 (script_sticker.js) -->
          <button type="button" class="sr-stk" id="sroom-sticker-btn"
                  data-sroom-sticker="1" aria-label="스티커" title="스티커">🙂</button>
          <textarea id="sroom-in" class="sr-in" rows="1" maxlength="${SROOM_LEN}"
                    placeholder="여기에 적어요"></textarea>
          <button type="button" class="sr-send" data-sroom-send="1"
                  aria-label="보내기" title="보내기">↑</button>
        </div>
      </div>`;
    sroom줄그리기();
  }

  /** 대화 줄만 갈아 끼웁니다 — 글칸은 손대지 않아요 (커서·조합 지킴) */
  function sroom줄그리기() {
    const 목록칸 = el("dock-body-sroom")?.querySelector(".sr-log");
    if (!목록칸) return;
    /* 바닥 언저리를 보고 있었으면 새 줄을 따라 내려갑니다. 위를 읽는
       중이었으면 그 자리를 지켜요 — 남의 글에 끌려다니지 않게. */
    const 바닥 = 목록칸.scrollHeight - 목록칸.scrollTop - 목록칸.clientHeight < 60;
    const 전 = 목록칸.scrollTop;
    목록칸.innerHTML = _sroomRows.map((r, i) => sroom줄HTML(r, _sroomRows[i - 1])).join("")
      || `<p class="sr-empty">아직 아무 말도 없어요.</p>`;
    목록칸.scrollTop = 바닥 ? 목록칸.scrollHeight : 전;
  }

  /** 모양이 달라졌으면 틀부터, 아니면 줄만 */
  function sroom그리기() {
    const box = el("dock-body-sroom");
    if (!box) return;
    if (_sroom틀 !== sroom틀모양() || !box.querySelector(".sr-board")) sroom틀짓기();
    else sroom줄그리기();
  }

  /* =====================================================================
     서버 — 판을 열 때에만 듣습니다
     ===================================================================== */
  function sroom듣기() {
    if (_sroomRef || !window.db) return;
    /* 🧹 자정 방 청소 (콩 2026-08-30) — 어제까지의 대화를 그날 처음 여는
       사람이 쓸어냅니다. 비밀방 대화는 그날의 것 — 쌓아 두지 않아요.
       승인 멤버는 $id 쓰기 권한이 있어 규칙 변경 없이 지울 수 있습니다. */
    window.자정방청소?.("sroom", "sroomSweepDay");
    sroom반응듣기();
    _sroomRef = window.db.ref("sroom").orderByChild("time").limitToLast(SROOM_MAX);
    _sroomRef.on("value", snap => {
      const raw = snap.val() || {};
      _sroomRows = Object.keys(raw)
        .map(id => {
          const v = raw[id] || {};
          const msg = String(v.msg || "");
          if (!msg.trim()) return null;
          const 답 = v.replyTo && typeof v.replyTo === "object"
            ? { key: String(v.replyTo.key || ""), user: String(v.replyTo.user || ""),
                msg: String(v.replyTo.msg || "") }
            : null;
          return { id, user: String(v.user || ""), msg: msg.slice(0, SROOM_LEN),
                   time: Number(v.time) || 0, replyTo: 답 };
        })
        .filter(Boolean)
        /* ★ 시각이 같으면 push 열쇠로 — 열쇠는 만들어진 차례를 품고 있어서
           동률에서도 줄이 그릴 때마다 뒤바뀌지 않습니다 */
        .sort((a, b) => a.time - b.time || String(a.id).localeCompare(String(b.id)));
      sroom그리기();
      /* 🧹 방을 열어둔 채 자정을 넘겼으면, 다음 말이 올 때 쓸립니다
         (도장 덕에 평소에는 첫 줄에서 곧장 돌아와요) */
      window.자정방청소?.("sroom", "sroomSweepDay");
    });
  }
  /* 😊 반응 듣기 — 판을 열 때만. 글 단위로 와서 그 줄만 다시 그립니다 */
  function sroom반응듣기() {
    if (_srReactRef || !window.db) return;
    _srReactRef = window.db.ref("sreactions");
    const 얹기 = (snap) => { _srReact[snap.key] = snap.val() || {}; sroom반응줄갱신(snap.key); };
    _srReactRef.on("child_added", 얹기);
    _srReactRef.on("child_changed", 얹기);
    _srReactRef.on("child_removed", (snap) => {
      delete _srReact[snap.key]; sroom반응줄갱신(snap.key);
    });
  }
  function sroom반응그만듣기() {
    try { _srReactRef?.off(); } catch (e) {}
    _srReactRef = null; _srReact = {};
  }

  /** 그 글의 반응 줄만 갈아 끼웁니다 — 판 전체를 다시 그리지 않아요
      (다시 그리면 쓰던 글과 커서가 날아갑니다 — 이 방의 제1원칙) */
  function sroom반응줄갱신(키) {
    const 줄 = el("dock-body-sroom")?.querySelector(`.sr-row[data-sroom-key="${CSS.escape(키)}"]`);
    if (!줄) return;
    const 있던 = 줄.querySelector(".sr-reacts");
    const 새 = sroom반응줄HTML(키);
    if (!새) { 있던?.remove(); return; }
    if (있던) 있던.outerHTML = 새;
    else 줄.insertAdjacentHTML("beforeend", 새);
  }

  /** 반응 켜고 끄기 — 누른 그 자리에서 먼저 그리고, 서버는 뒤따라옵니다 */
  async function sroom반응토글(키, id) {
    const 나 = sroomMe();
    if (!나 || !키 || !SROOM_반응맵[id] || !window.db || !_sroomOk) return;
    const 내가있나 = !!(_srReact[키]?.[id]?.[나]);
    _srReact[키] = _srReact[키] || {};
    _srReact[키][id] = _srReact[키][id] || {};
    if (내가있나) delete _srReact[키][id][나];
    else _srReact[키][id][나] = true;
    sroom반응줄갱신(키);
    try {
      const ref = window.db.ref(`sreactions/${키}/${id}/${나}`);
      await (내가있나 ? ref.remove() : ref.set(true));
    } catch (e) { /* 실패하면 서버 값이 곧 되돌려 줍니다 */ }
  }

  /* 😊 반응 고르기 — 여섯 개짜리 작은 판 */
  function sroom반응판닫기() {
    el("dock-body-sroom")?.querySelectorAll(".sr-pick").forEach(p => p.remove());
  }
  function sroom반응판열기(단추) {
    const 줄 = 단추.closest(".sr-row");
    const 키 = 줄?.dataset.sroomKey;
    if (!키) return;
    const 이미 = 줄.querySelector(".sr-pick");
    sroom반응판닫기();
    if (이미) return;                       // 같은 걸 또 누르면 닫기
    줄.insertAdjacentHTML("beforeend",
      `<div class="sr-pick">${SROOM_반응.map(({ id, emoji, label }) =>
        `<button type="button" data-sroom-toggle="${id}" title="${label}">${emoji}</button>`).join("")}</div>`);
  }

  function sroom그만듣기() {
    try { _sroomRef?.off(); } catch (e) {}
    _sroomRef = null;
    sroom반응그만듣기();
    _sr답할것 = null;
  }

  /* =====================================================================
     ↩ 답글 — 글칸 위에 "누구에게 답하는 중" 띠를 띄웁니다
     ★ 띠는 **틀을 다시 짓지 않고** 그 자리에서 넣고 뺍니다. 틀을 다시
       지으면 글칸이 새로 태어나 쓰던 글이 날아가요 (이 방의 제1원칙).
     ===================================================================== */
  function sroom답글띠() {
    const 판 = el("dock-body-sroom")?.querySelector(".sr-board");
    if (!판) return;
    let 띠 = 판.querySelector(".sr-replybar");
    if (!_sr답할것) { 띠?.remove(); return; }
    const 속 = `<span class="sr-replybar-l">↪ <b>${esc(_sr답할것.user)}</b> 님에게 답글</span>
                <span class="sr-replybar-t">${esc(_sr답할것.msg.slice(0, 60))}</span>
                <button type="button" data-sroom-replyx="1" aria-label="답글 그만">✕</button>`;
    if (띠) { 띠.innerHTML = 속; return; }
    const 쓰는칸 = 판.querySelector(".sr-write");
    쓰는칸?.insertAdjacentHTML("beforebegin", `<div class="sr-replybar">${속}</div>`);
  }
  function sroom답글켜기(단추) {
    const 줄 = 단추.closest(".sr-row");
    const 키 = 줄?.dataset.sroomKey;
    const r = _sroomRows.find(x => x.id === 키);
    if (!r) return;
    _sr답할것 = { key: r.id, user: r.user, msg: r.msg };
    sroom답글띠();
    el("sroom-in")?.focus();
  }
  function sroom답글끄기() {
    _sr답할것 = null;
    sroom답글띠();
  }

  /** 인용을 누르면 원문으로 — 없으면(자정에 쓸렸으면) 조용히 알려 줍니다 */
  function sroom원문으로(키) {
    const 줄 = el("dock-body-sroom")?.querySelector(`.sr-row[data-sroom-key="${CSS.escape(키)}"]`);
    if (!줄) return;
    줄.scrollIntoView({ block: "center", behavior: "smooth" });
    줄.classList.add("sr-blink");
    setTimeout(() => 줄.classList.remove("sr-blink"), 1200);
  }

  async function sroom보내기() {
    const 칸 = el("sroom-in");
    const raw = String(칸?.value || "").trim().slice(0, SROOM_LEN);
    if (!raw || _sroomBusy || !window.db || !_sroomOk) return;
    /* 🖍 /토닥 처럼 슬래시로 친 것도 스티커 그림으로 나가게 (2026-09-01 —
       콩 신고 "스티커 명령어가 안 먹혀"). 판정은 script_sticker.js 것을
       그대로 빌립니다 — 챗과 같은 규칙이어야 어느 방에서 쳐도 결과가
       같습니다. 판(🙂)에서 골라 이미 [[스티커:id]] 로 들어온 경우엔
       걸리는 게 없어 raw 그대로 나갑니다. */
    const t = window.stickerCmdText?.(raw) || raw;
    _sroomBusy = true;
    if (칸) { 칸.value = ""; 칸.focus(); }   // ★ 보낸 뒤에도 손이 그대로 있게
    try {
      /* ★★★ [고침 2026-08-30 — 콩 신고 "간발의 차로 먼저 올린 챗이 밀려"]
         time 을 Date.now() 로 찍고 있었습니다 — **각자 기기 시계**예요.
         이 판은 그릴 때마다 time 으로 줄을 세우는데, 기기 시계가 몇 초
         어긋난 사람의 글은 '과거'에 찍혀서 먼저 온 글 위로 끼어듭니다.
         → 서버가 받는 순간의 시각(ServerValue.TIMESTAMP)으로 바꿨어요.
           도장 찍는 자가 하나면 줄이 안 엉킵니다. */
      const 글 = {
        user: sroomMe(), msg: t, time: firebase.database.ServerValue.TIMESTAMP
      };
      /* ↩ 답글이면 인용을 함께 싣습니다 — 원문이 지워져도 남게
         (자정 청소가 도는 방이라 '원문 찾아가기' 만으론 끊깁니다) */
      if (_sr답할것) {
        글.replyTo = {
          key: String(_sr답할것.key || ""),
          user: String(_sr답할것.user || "").slice(0, 40),
          msg: String(_sr답할것.msg || "").slice(0, 120)
        };
      }
      await window.db.ref("sroom").push().set(글);
      sroom답글끄기();
    } catch (e) {
      if (칸) 칸.value = raw;             // 못 보냈으면 쓰던 글을 그대로 돌려줍니다 (변환 전 글로)
      alert("보내지 못했어요. 연결을 확인해 주세요.");
    } finally {
      _sroomBusy = false;
      /* ★ 연달아 칠 수 있게 초점을 다시 둡니다 (콩 2026-08-29).
         ※ 이건 덤이에요 — 진짜 고침은 "글칸을 다시 안 만드는 것"입니다. */
      el("sroom-in")?.focus();
    }
  }

  /* =====================================================================
     명단 관리 — 방장만
     ★ 화면에서는 **닉네임**으로 넣고 뺍니다. 사람이 uid 를 외울 순 없으니까요.
       nickOwner 에서 그 닉의 uid 를 찾아 sallow 에 적습니다.
     ===================================================================== */
  async function sroom명단읽기() {
    if (!window.isRoomOwner?.() || !window.db) return;
    try {
      _sroomAllow = (await window.db.ref("sallow").once("value")).val() || {};
    } catch (e) { _sroomAllow = {}; }
  }

  async function sroom넣기() {
    if (!window.isRoomOwner?.()) return;
    const 닉 = String(prompt("들어올 수 있게 할 사람의 닉네임을 그대로 적어 주세요.\n(카드에 보이는 이름 그대로, 이모지까지)") || "").trim();
    if (!닉) return;
    try {
      const uid = (await window.db.ref("nickOwner/" + 닉).once("value")).val();
      if (!uid) { alert(`"${닉}" 이라는 닉을 못 찾았어요. 카드에 보이는 이름 그대로 적어 주세요 (이모지까지).`); return; }
      await window.db.ref("sallow/" + uid).set(닉);
      await sroom명단읽기();
      sroom그리기();
    } catch (e) {
      alert("넣지 못했어요 — 방장 계정인지, 보안규칙을 콘솔에 올렸는지 확인해 주세요.");
    }
  }

  async function sroom빼기(uid) {
    if (!window.isRoomOwner?.()) return;
    const 닉 = _sroomAllow[uid] || uid;
    if (!confirm(`${닉} 님을 명단에서 뺄까요?\n\n지난 대화는 그대로 남지만, 더는 못 봅니다.`)) return;
    try {
      await window.db.ref("sallow/" + uid).remove();
      await sroom명단읽기();
      sroom그리기();
    } catch (e) { alert("빼지 못했어요."); }
  }

  /* =====================================================================
     손가락 — 판 안쪽에 답니다
     ===================================================================== */
  function sroom묶기() {
    const host = el("dock-body-sroom");
    if (!host || _sroomBound) return;
    _sroomBound = true;

    host.addEventListener("click", async (e) => {
      const 글씨 = e.target.closest("[data-sroom-font]");
      if (글씨) { sroom글씨바꾸기(Number(글씨.dataset.sroomFont)); el("sroom-in")?.focus(); return; }
      if (e.target.closest("[data-sroom-send]")) { sroom보내기(); return; }
      /* 🖼 스티커 — 이 방의 글칸과 이 방의 보내기로 (챗과 같은 판을 씁니다) */
      if (e.target.closest("[data-sroom-sticker]")) {
        window.toggleStickerPicker?.({ btnId: "sroom-sticker-btn",
                                       inputId: "sroom-in", send: sroom보내기 });
        return;
      }
      if (e.target.closest("[data-sroom-add]"))  { sroom넣기();  return; }
      const 뺄 = e.target.closest("[data-sroom-out]");
      if (뺄) { sroom빼기(뺄.dataset.sroomOut); return; }
      if (e.target.closest("[data-sroom-list]")) {
        _sroomList = !_sroomList;
        if (_sroomList) await sroom명단읽기();
        sroom그리기();
        return;
      }

      /* 😊 반응 · ↩ 답글 (2026-08-30) */
      const 켜기 = e.target.closest("[data-sroom-toggle]");
      if (켜기) {
        const 키 = 켜기.closest(".sr-row")?.dataset.sroomKey;
        sroom반응판닫기();
        if (키) sroom반응토글(키, 켜기.dataset.sroomToggle);
        return;
      }
      const 반응 = e.target.closest("[data-sroom-react]");
      if (반응) { sroom반응판열기(반응); return; }
      const 답 = e.target.closest("[data-sroom-reply]");
      if (답) { sroom답글켜기(답); return; }
      if (e.target.closest("[data-sroom-replyx]")) { sroom답글끄기(); el("sroom-in")?.focus(); return; }
      const 가기 = e.target.closest("[data-sroom-goto]");
      if (가기) { sroom원문으로(가기.dataset.sroomGoto); return; }

      /* 반응 고르기 판 바깥을 누르면 닫습니다 */
      sroom반응판닫기();
    });

    /* 엔터로 보내기 — ★ 한글 조합 중은 무시합니다 (이 방에서 여러 번 데인 자리) */
    host.addEventListener("keydown", (e) => {
      if (e.target?.id !== "sroom-in") return;
      if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      sroom보내기();
    });
  }

  /** 알약 판이 열릴 때 부릅니다 */
  async function openSroom() {
    sroom묶기();
    sroom그리기();
    _sroomOk = await sroom들었나();
    sroom그리기();
    if (!_sroomOk) return;              // 명단 밖이면 서버를 아예 안 건드립니다
    if (window.isRoomOwner?.()) await sroom명단읽기();
    sroom듣기();
    sroom그리기();
    setTimeout(() => el("sroom-in")?.focus(), 60);
  }
  window.openSroom = openSroom;
  window.closeSroom = sroom그만듣기;
})();
