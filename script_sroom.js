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

  function sroom줄HTML(r) {
    const 내것 = r.user === sroomMe();
    /* 🎨 닉네임 색 — 챗과 같은 색 (2026-08-30 콩). 뽀모방과 같은 결이에요:
       프로필의 nickColor + 다크 보정을 nickColorStyle() 이 다 해 주고,
       data-name-of 덕에 테마 전환 때 refreshChatNickColors() 가 함께 갱신합니다. */
    return `
      <div class="sr-line${내것 ? " mine" : ""}">
        <span class="sr-who" data-name-of="${esc(r.user)}"${window.nickColorStyle?.(r.user) || ""}>${esc(r.user)}</span>
        <span class="sr-msg">${esc(r.msg)}</span>
        <span class="sr-t">${esc(때(r.time))}</span>
      </div>`;
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
    목록칸.innerHTML = _sroomRows.map(sroom줄HTML).join("")
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
    _sroomRef = window.db.ref("sroom").orderByChild("time").limitToLast(SROOM_MAX);
    _sroomRef.on("value", snap => {
      const raw = snap.val() || {};
      _sroomRows = Object.keys(raw)
        .map(id => {
          const v = raw[id] || {};
          const msg = String(v.msg || "");
          if (!msg.trim()) return null;
          return { id, user: String(v.user || ""), msg: msg.slice(0, SROOM_LEN), time: Number(v.time) || 0 };
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);
      sroom그리기();
    });
  }
  function sroom그만듣기() {
    try { _sroomRef?.off(); } catch (e) {}
    _sroomRef = null;
  }

  async function sroom보내기() {
    const 칸 = el("sroom-in");
    const t = String(칸?.value || "").trim().slice(0, SROOM_LEN);
    if (!t || _sroomBusy || !window.db || !_sroomOk) return;
    _sroomBusy = true;
    if (칸) { 칸.value = ""; 칸.focus(); }   // ★ 보낸 뒤에도 손이 그대로 있게
    try {
      await window.db.ref("sroom").push().set({
        user: sroomMe(), msg: t, time: Date.now()
      });
    } catch (e) {
      if (칸) 칸.value = t;               // 못 보냈으면 쓰던 글을 돌려줍니다
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
      if (e.target.closest("[data-sroom-add]"))  { sroom넣기();  return; }
      const 뺄 = e.target.closest("[data-sroom-out]");
      if (뺄) { sroom빼기(뺄.dataset.sroomOut); return; }
      if (e.target.closest("[data-sroom-list]")) {
        _sroomList = !_sroomList;
        if (_sroomList) await sroom명단읽기();
        sroom그리기();
        return;
      }
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
