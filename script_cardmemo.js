/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   📝 카드 메모 (script_cardmemo.js) — 2026-10-04 콩

   마감으로 며칠씩 바쁠 때 내 프로필 카드에 메모를 한 장 붙여 둡니다.
   사진 위에 글씨를 얹듯이 — 흰 손글씨에 검은 테두리 (미리보기 A안).
     예) "마감 중…
          답변이 느려요 ㅜ^ㅜ"

   ★ 모두에게 **재접속 없이** 바로 보입니다 — 다들 이미 실시간으로 받는
     status/{닉} 에 memo 한 칸을 얹어요. 붙이고 뗄 때 한 번씩, 글자 몇십 바이트.
     (이 판을 한 번 받은 사람부터 보여요 — 옛 창은 그릴 줄 모르니까)
   ★ 나갔다 들어와도 유지 — users/{닉}/cardMemo 와 이 기기에 기억해 두고,
     입장할 때 다시 status 에 실어 보냅니다. 떼기 전까지 그대로.
   ★ 30자 · 두 줄까지. 엔터로 줄을 바꾸고, 세 번째 줄은 안 만들어져요.
   ★ 메모는 클릭을 통과시킵니다 — 하트·쪽지·프사 누르는 데 방해 안 돼요.
   ★ 꾸민 카드·가볍게 보기 둘 다.

   [여는 곳] 설정 → 프로필 탭 맨 위 [📝 카드 메모] · 내 카드 시간 칸 더블클릭
   [시험] 혼자 방 먼저 (MAIN_ON = false) — 그리기는 늘 켜 두고, 붙이는 손만 막습니다.
   ===================================================================== */
(function () {
  const MAIN_ON = true;                   // [2026-10-04 콩] 혼자 방 시험 통과 → 본방 ON
  const MAX = 30;
  const 켜짐 = () => !!(window.SOLO || MAIN_ON);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const 나 = () => { try { return (typeof myNick === "string" && myNick) ? myNick : (window.myNick || ""); } catch (e) { return ""; } };

  let _memo = "";
  let _style = "A";       // A 손글씨 · B 포스트잇 · C 마스킹테이프 (2026-10-04 콩: 고를 수 있게)
  /* [2026-10-07 콩] N = **새 카드** — 내 카드 위에 얹지 않고, 내 카드 옆에 빈 카드를 한 장
     더 띄워 거기에 메모만 적습니다. ("화공, 워크로그 많관부 🙏" 처럼 알리고 싶은 말)
     ★ 그리기는 늘 켜 두고, **고르는 단추만** 혼자 방에 먼저 냅니다 (NEW_MAIN_ON). */
  const NEW_MAIN_ON = false;              // 혼자 방 시험 통과하면 true 로
  const 새카드켜짐 = () => !!(window.SOLO || NEW_MAIN_ON);
  const 모양 = (v) => (["A", "B", "C", "N"].includes(v) ? v : "A");
  let _불러온닉 = "";

  /* =====================================================================
     🖼 새 카드에 **그림** (2026-10-07 — 콩)
     ---------------------------------------------------------------------
     "새 창으로 열 때는 이미지도." — 그림만 넣거나, 글만 넣거나 (둘 중 하나).
     그림일 때는 닉네임 없이, 카드 크기에 맞춰 **그림 전체**를 보여 줍니다.

     ★★★ 그림은 status 에 싣지 않습니다. status 는 방 전원이 실시간으로
       주고받는 값이라, 거기에 그림을 실으면 통신량이 그대로 불어납니다.
       그래서 **창고(Storage)에 올리고 status 에는 주소 한 줄만** 싣습니다.
     ★ 자리는 프사와 같은 폴더 — profileimg/{내 uid}/memo_… .
       창고 규칙이 "이 폴더는 이 계정만 · 400KB 까지 · 그림만" 을 이미 막아 줘서
       **규칙을 안 고칩니다.**
     ★ 주소는 창고가 내어 준 것만 그립니다 (sanitizePhotoUrl) — 바깥 주소를
       걸 수 있으면 그 서버가 멤버 전원의 접속을 들여다보게 됩니다.
     ★ 🧘 혼자 방은 창고가 없어서 그림을 글자(data:)로 이 기기에만 둡니다.
     ★ 떼거나 바꾸면 창고의 옛 그림도 지웁니다.
     ===================================================================== */
  const IMG_SIDE = 480;                   // 긴 변 — 카드에 넉넉하고 수십 KB 안팎
  const IMG_IN_MAX = 12 * 1024 * 1024;
  let _img = "";
  function 그림주소(v) {
    const u = window.sanitizePhotoUrl ? window.sanitizePhotoUrl(v) : "";
    if (u) return u;
    return (window.SOLO && window.sanitizePhoto) ? (window.sanitizePhoto(v) || "") : "";
  }
  /** File → 긴 변 480 으로 줄인 그림 (비율 그대로, 자르지 않음) */
  function 그림줄이기(file) {
    return new Promise((ok, no) => {
      if (!file || !/^image\//.test(file.type || "")) { no(new Error("이미지 파일만 올릴 수 있어요.")); return; }
      if (/^image\/gif$/i.test(file.type)) { no(new Error("움직이는 GIF 는 쓸 수 없어요. 정지 그림(JPG·PNG)으로 올려 주세요.")); return; }
      if (file.size > IMG_IN_MAX) { no(new Error("파일이 너무 커요. 12MB 이하로 올려 주세요.")); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const k = Math.min(1, IMG_SIDE / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
          x.drawImage(img, 0, 0, c.width, c.height);
          if (window.SOLO) { ok({ data: c.toDataURL("image/jpeg", 0.8) }); }
          else c.toBlob(b => b ? ok({ blob: b }) : no(new Error("그림을 줄이지 못했어요.")), "image/webp", 0.75);
        } catch (e) { no(e); }
        finally { URL.revokeObjectURL(url); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); no(new Error("이 그림은 못 읽었어요.")); };
      img.src = url;
    });
  }
  /** 줄인 그림 → 주소 (본방: 창고에 올림 · 혼자 방: 글자 그대로) */
  async function 그림올리기(줄인) {
    if (줄인.data) return 줄인.data;
    const st = (window.firebase && firebase.storage) ? firebase.storage() : null;
    const uid = (() => { try { return firebase.auth().currentUser?.uid || ""; } catch (e) { return ""; } })();
    if (!st || !uid) throw new Error("창고에 연결되지 않았어요. 새로고침 후 다시 해 주세요.");
    if (줄인.blob.size > 380 * 1024) throw new Error("그림이 너무 커요. 다른 그림을 써 주세요.");
    const 끝 = /webp/.test(줄인.blob.type) ? "webp" : "jpg";
    const 이름 = "memo_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const ref = st.ref(`profileimg/${uid}/${이름}.${끝}`);
    await ref.put(줄인.blob, { contentType: 줄인.blob.type || "image/webp" });
    return await ref.getDownloadURL();
  }
  async function 옛그림지우기(url) {
    try {
      const 길 = window.imgUpPathOf?.(url);
      if (!길 || !/^profileimg\/[^/]+\/memo_/.test(길)) return;      // 프사는 절대 안 건드립니다
      await firebase.storage().ref(길).delete();
    } catch (e) {}
  }

  function 다듬기(t) {
    return String(t || "").replace(/\r/g, "").split("\n").slice(0, 2)
      .map(x => x.replace(/\s+$/g, "")).join("\n").trim().slice(0, MAX);
  }

  /* 입장하면 한 번 — 기기 값 먼저, 서버 값이 오면 그걸로 */
  async function 불러오기() {
    const n = 나();
    if (!n || _불러온닉 === n) return;
    _불러온닉 = n;
    try { _memo = 다듬기(window.AppStore?.getItem("cardMemo_" + n) || ""); _style = 모양(window.AppStore?.getItem("cardMemoStyle_" + n)); } catch (e) {}
    try { _img = 그림주소(window.AppStore?.getItem("cardMemoImg_" + n) || ""); } catch (e) {}
    try {
      if (window.db) {
        const v = (await window.db.ref(`users/${n}/cardMemo`).once("value")).val();
        if (typeof v === "string") _memo = 다듬기(v);
        const st = (await window.db.ref(`users/${n}/cardMemoStyle`).once("value")).val();
        if (st) _style = 모양(st);
        if (!window.SOLO) {
          const im = (await window.db.ref(`users/${n}/cardMemoImg`).once("value")).val();
          _img = 그림주소(im);
        }
      }
    } catch (e) {}
    if (_memo || _img) window.updateStatus?.(true);
  }
  setInterval(불러오기, 3000);
  setTimeout(불러오기, 1500);

  window.myCardMemo = () => _memo || null;
  window.myCardMemoStyle = () => ((_memo || _img) ? _style : null);
  /* 그림은 **새 카드(N)** 일 때만 나갑니다 */
  window.myCardMemoImg = () => ((_style === "N" && _img) ? _img : null);

  /* img: undefined = 그림은 그대로 · "" = 그림 떼기 · 주소 = 그 그림으로 */
  async function 저장(t, st, img) {
    const n = 나(); if (!n) return;
    _memo = 다듬기(t);
    if (st) _style = 모양(st);
    const 옛그림 = _img;
    if (img !== undefined) _img = 그림주소(img);
    if (_style !== "N" || _memo) _img = "";        // 그림은 새 카드에서만, 그리고 글이 있으면 그림은 뗍니다 (그림만 또는 글만)
    if (_img) _memo = "";
    if (옛그림 && 옛그림 !== _img) 옛그림지우기(옛그림);
    try { window.AppStore?.setItem("cardMemo_" + n, _memo); window.AppStore?.setItem("cardMemoStyle_" + n, _style); window.AppStore?.setItem("cardMemoImg_" + n, _img); } catch (e) {}
    try { if (window.db) { await window.db.ref(`users/${n}/cardMemo`).set(_memo || null); await window.db.ref(`users/${n}/cardMemoStyle`).set(_style);
          if (!window.SOLO) await window.db.ref(`users/${n}/cardMemoImg`).set(_img || null); } } catch (e) {}
    window.updateStatus?.(true);
  }

  /* 카드에 얹을 조각 — script_realtime.js 가 꾸민 카드·가볍게 보기 둘 다에서 부름 */
  window.cardMemoHtml = (row) => {
    const m = 다듬기(row && row.memo);
    if (m && 모양(row.memoStyle) === "N") return "";       // 새 카드로 따로 뜹니다 (아래)
    return m ? `<div class="card-memo s${모양(row.memoStyle)}" aria-label="메모: ${esc(m)}">${esc(m)}</div>` : "";
  };

  /* 🆕 새 카드 메모 — 그 사람 카드 **바로 뒤**에 한 장. 빈 카드에 메모와 닉만.
     ★ data-card-nick 을 안 답니다 — 하트·쪽지·프로필이 이 카드를 사람 카드로 세지 않게.
     ★ 눌러도 아무 일도 안 일어납니다 (styles.css .memo-card). */
  window.memoCardHtml = (nick, row, lite) => {
    const m = 다듬기(row && row.memo);
    if (모양(row && row.memoStyle) !== "N") return "";
    /* 🖼 그림 메모 — 닉네임 없이, 카드에 맞춰 그림 전체 (콩) */
    const 그림 = 그림주소(row && row.memoImg);
    if (그림) {
      const 태그 = `<img class="memo-card-img" src="${esc(그림)}" alt="${esc(nick)} 님이 붙인 그림" decoding="async">`;
      return lite
        ? `<div class="user-card lite-card memo-card memo-pic" data-memo-of="${esc(nick)}"><div class="memo-lite">${태그}</div></div>`
        : `<div class="user-card memo-card memo-pic" data-memo-of="${esc(nick)}">${태그}</div>`;
    }
    if (!m) return "";
    const 속 = `<div class="memo-card-t">${esc(m)}</div><div class="memo-card-by">— ${esc(nick)}</div>`;
    return lite
      ? `<div class="user-card lite-card memo-card" data-memo-of="${esc(nick)}" aria-label="${esc(nick)} 님의 메모: ${esc(m)}"><div class="memo-lite">${속}</div></div>`
      : `<div class="user-card memo-card" data-memo-of="${esc(nick)}" aria-label="${esc(nick)} 님의 메모: ${esc(m)}">${속}</div>`;
  };

  /* ── 적는 창 ── */
  function 열기() {
    if (!나()) { alert("입장 후에 메모를 붙일 수 있어요."); return; }
    if (!켜짐()) return;
    document.querySelector(".cmemo-veil")?.remove();
    const veil = document.createElement("div");
    veil.className = "hello-veil cmemo-veil";
    veil.innerHTML = `
      <div class="hello-card cmemo-card" role="dialog" aria-modal="true" aria-label="카드 메모">
        <p class="npop-h">📝 카드 메모</p>
        <p class="cmemo-sub">마감 중이거나 답이 늦을 때 카드에 붙여 두세요. 모두에게 바로 보여요.</p>
        <!-- 🎨 모양 고르기 (2026-10-04 콩) — 입력 칸 바로 위 -->
        <div class="cmemo-pick" role="radiogroup" aria-label="메모 모양">
          ${[["A", "손글씨"], ["B", "포스트잇"], ["C", "테이프"]].map(([k, l]) =>
            `<button type="button" class="cmemo-opt d${k}${_style === k ? " on" : ""}" data-st="${k}" role="radio"
                     aria-checked="${_style === k}" title="${l}" aria-label="${l}"></button>`).join("")}${
            새카드켜짐() ? `<button type="button" class="cmemo-opt dN${_style === "N" ? " on" : ""}" data-st="N" role="radio"
                     aria-checked="${_style === "N"}" title="새 카드로 띄우기 — 내 카드 옆에 메모만 적힌 카드가 한 장 더 떠요" aria-label="새 카드">new</button>` : ""}
        </div>
        <!-- 🖼 새 카드(new)일 때만 — 그림만 넣거나 글만 넣거나 (2026-10-07 콩) -->
        <div class="cmemo-imgrow" hidden>
          <button type="button" class="npop-later cmemo-imgpick">🖼 그림 넣기</button>
          <span class="cmemo-imgprev" hidden><img alt="고른 그림"><button type="button" class="cmemo-imgx" title="그림 빼기" aria-label="그림 빼기">✕</button></span>
          <input type="file" class="cmemo-file" accept="image/png,image/jpeg,image/webp" hidden>
          <span class="cmemo-imghint">그림을 넣으면 글 대신 그림만 떠요</span>
        </div>
        <textarea class="cmemo-in" rows="2" maxlength="${MAX}" placeholder="마감 중…&#10;답변이 느려요 ㅜ^ㅜ">${esc(_memo)}</textarea>
        <div class="cmemo-cnt"><span class="cmemo-n">0</span>/${MAX} · 엔터로 두 줄까지</div>
        <div class="npop-btns">
          <button type="button" class="npop-later cmemo-off">${(_memo || _img) ? "떼기" : "닫기"}</button>
          <button type="button" class="hello-ok cmemo-ok">붙이기</button>
        </div>
      </div>`;
    document.body.appendChild(veil);
    requestAnimationFrame(() => veil.classList.add("on"));
    const ta = veil.querySelector(".cmemo-in");
    let 고른 = _style;
    veil.querySelectorAll(".cmemo-opt").forEach(b => b.addEventListener("click", () => {
      고른 = b.dataset.st;
      veil.querySelectorAll(".cmemo-opt").forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); });
      ta.dataset.st = 고른;
      그림칸맞추기();
    }));
    ta.dataset.st = 고른;

    /* 🖼 그림 — 고른 것은 [붙이기] 를 눌러야 올라갑니다 (고르기만 하고 닫으면 아무 일도 없음) */
    const 줄 = veil.querySelector(".cmemo-imgrow"), 미리 = veil.querySelector(".cmemo-imgprev");
    const 파일 = veil.querySelector(".cmemo-file"), 세는줄 = veil.querySelector(".cmemo-cnt");
    let 새그림 = null;                 // 방금 고른 것 { blob | data }
    let 그림있음 = !!_img && _style === "N";
    function 그림칸맞추기() {
      const N = 고른 === "N";
      줄.hidden = !N;
      const 보임 = N && 그림있음;
      미리.hidden = !보임;
      veil.querySelector(".cmemo-imgpick").textContent = 보임 ? "🖼 그림 바꾸기" : "🖼 그림 넣기";
      ta.hidden = 보임; 세는줄.hidden = 보임;
      if (보임) 미리.querySelector("img").src = 새그림 ? (새그림.data || 새그림.미리) : _img;
    }
    veil.querySelector(".cmemo-imgpick").addEventListener("click", () => 파일.click());
    veil.querySelector(".cmemo-imgx").addEventListener("click", () => { 새그림 = null; 그림있음 = false; 그림칸맞추기(); ta.focus(); });
    파일.addEventListener("change", async () => {
      const f = 파일.files && 파일.files[0]; 파일.value = "";
      if (!f) return;
      try {
        새그림 = await 그림줄이기(f);
        if (새그림.blob) 새그림.미리 = URL.createObjectURL(새그림.blob);
        그림있음 = true; 그림칸맞추기();
      } catch (e) { alert(e.message || "그림을 못 읽었어요."); }
    });
    그림칸맞추기();
    const 세기 = () => { veil.querySelector(".cmemo-n").textContent = ta.value.length; };
    세기();
    ta.addEventListener("input", () => {
      /* 세 번째 줄은 안 만들어지게 (붙여 넣기 포함) */
      const 줄 = ta.value.split("\n");
      if (줄.length > 2) { const p = ta.selectionStart; ta.value = 줄.slice(0, 2).join("\n") + 줄.slice(2).join(""); ta.selectionStart = ta.selectionEnd = Math.min(p, ta.value.length); }
      세기();
    });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229 && ta.value.split("\n").length >= 2) e.preventDefault();
    });
    const 닫기 = () => { veil.classList.remove("on"); setTimeout(() => veil.remove(), 300); };
    veil.addEventListener("click", (e) => { if (e.target === veil) 닫기(); });
    veil.querySelector(".cmemo-ok").addEventListener("click", async (e) => {
      const 단추 = e.currentTarget;
      const 그림으로 = 고른 === "N" && 그림있음;
      try {
        if (그림으로 && 새그림) {
          단추.disabled = true; 단추.textContent = "올리는 중…";
          await 저장("", 고른, await 그림올리기(새그림));
        } else if (그림으로) {
          await 저장("", 고른);                      // 걸려 있던 그림 그대로
        } else {
          await 저장(ta.value, 고른, "");            // 글만 — 그림은 뗍니다
        }
        닫기();
      } catch (err) {
        단추.disabled = false; 단추.textContent = "붙이기";
        alert("그림을 올리지 못했어요. " + (err.message || ""));
      }
    });
    veil.querySelector(".cmemo-off").addEventListener("click", async () => { if (_memo || _img) await 저장("", undefined, ""); 닫기(); });
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }, 320);
  }
  window.openCardMemo = 열기;
  window.cardMemoOn = 켜짐;

  /* 내 카드 시간 칸 더블클릭 → 메모 */
  document.addEventListener("dblclick", (e) => {
    if (!켜짐()) return;
    const card = e.target.closest?.(".user-card.is-me");
    if (!card) return;
    if (e.target.closest(".lite-tm, .card-wh, .card-wh-t")) { e.preventDefault(); 열기(); }
  });
})();
