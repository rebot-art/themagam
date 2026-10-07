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
    try {
      if (window.db) {
        const v = (await window.db.ref(`users/${n}/cardMemo`).once("value")).val();
        if (typeof v === "string") _memo = 다듬기(v);
        const st = (await window.db.ref(`users/${n}/cardMemoStyle`).once("value")).val();
        if (st) _style = 모양(st);
      }
    } catch (e) {}
    if (_memo) window.updateStatus?.(true);
  }
  setInterval(불러오기, 3000);
  setTimeout(불러오기, 1500);

  window.myCardMemo = () => _memo || null;
  window.myCardMemoStyle = () => (_memo ? _style : null);

  async function 저장(t, st) {
    const n = 나(); if (!n) return;
    _memo = 다듬기(t);
    if (st) _style = 모양(st);
    try { window.AppStore?.setItem("cardMemo_" + n, _memo); window.AppStore?.setItem("cardMemoStyle_" + n, _style); } catch (e) {}
    try { if (window.db) { await window.db.ref(`users/${n}/cardMemo`).set(_memo || null); await window.db.ref(`users/${n}/cardMemoStyle`).set(_style); } } catch (e) {}
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
    if (!m || 모양(row.memoStyle) !== "N") return "";
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
        <textarea class="cmemo-in" rows="2" maxlength="${MAX}" placeholder="마감 중…&#10;답변이 느려요 ㅜ^ㅜ">${esc(_memo)}</textarea>
        <div class="cmemo-cnt"><span class="cmemo-n">0</span>/${MAX} · 엔터로 두 줄까지</div>
        <div class="npop-btns">
          <button type="button" class="npop-later cmemo-off">${_memo ? "떼기" : "닫기"}</button>
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
    }));
    ta.dataset.st = 고른;
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
    veil.querySelector(".cmemo-ok").addEventListener("click", async () => { await 저장(ta.value, 고른); 닫기(); });
    veil.querySelector(".cmemo-off").addEventListener("click", async () => { if (_memo) await 저장(""); 닫기(); });
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
