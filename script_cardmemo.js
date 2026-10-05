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
  const MAIN_ON = false;                  // ★ 혼자 방에서 확인되면 true 로
  const MAX = 30;
  const 켜짐 = () => !!(window.SOLO || MAIN_ON);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const 나 = () => { try { return (typeof myNick === "string" && myNick) ? myNick : (window.myNick || ""); } catch (e) { return ""; } };

  let _memo = "";
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
    try { _memo = 다듬기(window.AppStore?.getItem("cardMemo_" + n) || ""); } catch (e) {}
    try {
      if (window.db) {
        const v = (await window.db.ref(`users/${n}/cardMemo`).once("value")).val();
        if (typeof v === "string") _memo = 다듬기(v);
      }
    } catch (e) {}
    if (_memo) window.updateStatus?.(true);
  }
  setInterval(불러오기, 3000);
  setTimeout(불러오기, 1500);

  window.myCardMemo = () => _memo || null;

  async function 저장(t) {
    const n = 나(); if (!n) return;
    _memo = 다듬기(t);
    try { window.AppStore?.setItem("cardMemo_" + n, _memo); } catch (e) {}
    try { if (window.db) await window.db.ref(`users/${n}/cardMemo`).set(_memo || null); } catch (e) {}
    window.updateStatus?.(true);
  }

  /* 카드에 얹을 조각 — script_realtime.js 가 꾸민 카드·가볍게 보기 둘 다에서 부름 */
  window.cardMemoHtml = (row) => {
    const m = 다듬기(row && row.memo);
    return m ? `<div class="card-memo" aria-label="메모: ${esc(m)}">${esc(m)}</div>` : "";
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
    veil.querySelector(".cmemo-ok").addEventListener("click", async () => { await 저장(ta.value); 닫기(); });
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
