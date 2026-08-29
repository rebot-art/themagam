/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_files.js — 📁 자료실 (2026-08-18)

   [무엇인가]
   멤버들이 한글·엑셀·텍스트 같은 자료를 올리고 서로 내려받는 자리.
   대숲·살려주세요와 달리 **익명이 아닙니다** — 자료는 출처가 분명한
   편이 낫고, "내가 올린 것" 을 다른 기기에서도 지울 수 있어야 해서요.

   =====================================================================
   ★★ 목록과 내용을 **따로** 담습니다 — 이 파일에서 제일 중요한 결정
   ---------------------------------------------------------------------
       files/{id}     = { name, size, by, at }   목록
       fileBlob/{id}  = "data:...;base64,..."    내용

   한 덩어리로 두면 **자료실 창을 열기만 해도 48MB가 통째로** 내려옵니다.
   목록만 받으면 몇 KB 예요. 내용은 [받기] 를 누른 그 하나만 옵니다.
   화면 공유가 "공유 중인 사람끼리만" 보는 것과 같은 결이에요.
   ★ 보안규칙도 fileBlob 의 읽기를 **낱개($id)로만** 열어 뒀습니다.
     통째 읽기를 열면 위 설계가 무의미해집니다.

   =====================================================================
   ★ 무거운 파일을 막는 겹이 셋
   ---------------------------------------------------------------------
     ① 고르는 순간 — File.size 를 재서 **읽지도 않고** 돌려보냅니다.
        서버로 한 바이트도 안 나가요 (통신량 낭비 0). 이게 제일 중요.
     ② 보안규칙 — base64 길이 상한. 화면을 우회해도 서버가 거부합니다.
     ③ 종류 — 받을 확장자 목록에 없는 것은 애초에 안 받습니다.
        실행 파일(.exe .bat …)이 목록에 없는 이유이기도 해요.

   =====================================================================
   🔗 링크 자료 (2026-08-28 — 콩)
   ---------------------------------------------------------------------
   [왜 생겼나] 콩이 만든 편집기 프로그램(설치 파일)을 방에 두고 싶은데,
   ① 2MB 를 한참 넘고 ② 실행 파일은 일부러 안 받고 ③ 무엇보다 파일이
   DB 에 살면 **받을 때마다 요금이 나갑니다**(2026-08-22 Blaze 전환).

   그래서 **파일은 밖에 두고 목록에는 이름표만** 놓습니다.
       files/{id} = { name, size, by, at, url, note }   ← url 이 있으면 링크 자료
   위 "Storage 로 옮길 때" 를 위해 비워 뒀던 url 칸을 그대로 씁니다.

   ★★ 링크는 **방장만** 걸 수 있습니다 (isRoomOwner, 규칙도 같은 조건).
      아무나 걸 수 있으면 "원고양식.hwp" 라는 이름으로 엉뚱한 주소를
      가리키게 할 수 있어요. 자료실은 서로 믿고 받는 자리라 더 위험합니다.
   ★ https 만 받습니다. 목록에 **주소의 집(도메인)을 그대로 보여 줍니다** —
     어디로 가는지 눈으로 보고 누르시라고요.
   ★ 링크 자료는 90일에 안 사라집니다. 방장이 걸어 둔 도구는 계속 쓰니까요.
   ★ 파일이 DB 에 없으므로 **통신량·요금이 0** 입니다.

   [설치 파일을 걸 때] 서명이 없는 프로그램은 윈도우가 "알 수 없는 게시자"
   라며 막습니다. 그건 정상이라는 안내를 note 칸에 적어 두세요 — 안 적으면
   절반은 못 깔고 포기합니다.

   =====================================================================
   ★ 나중에 Firebase Storage 로 옮길 때 (요금제 결정 후)
   ---------------------------------------------------------------------
   목록(files)은 **그대로 쓰고** 내용만 옮기면 됩니다.
     · files/{id} 에 url 한 칸이 생기고,   ← 2026-08-28 에 실제로 생겼습니다
     · 받기가 "url 이 있으면 url, 없으면 fileBlob" 을 보게 하면 끝.
   섞여 있어도 돌아가므로 한꺼번에 옮길 필요도 없어요. 새로 올리는
   것부터 Storage 로 보내면, 옛 파일은 90일 뒤 저절로 사라져 이사가
   저절로 끝납니다. 크기 상한(MAX_BYTES)도 그때 한 곳만 고치면 돼요.
   ===================================================================== */
(function () {
  "use strict";

  const DAY_MS     = 24 * 60 * 60 * 1000;
  const KEEP_MS    = 90 * DAY_MS;          // 90일 (콩 확정) — 대숲 30일보다 길게
  const MAX_BYTES  = 2 * 1024 * 1024;      // ★ 한 개당 2MB (보안규칙과 짝)
  const MAX_B64    = 2800000;              // ★ 보안규칙의 길이 상한과 같은 값
  /* 받는 종류 — 실행 파일은 일부러 없습니다 */
  const OK_EXT = ["hwp", "hwpx", "doc", "docx", "xls", "xlsx", "csv", "txt", "pdf", "zip"];
  const ICON_OF = {
    hwp: "hwp", hwpx: "hwp", doc: "doc", docx: "doc",
    xls: "xls", xlsx: "xls", csv: "xls", txt: "txt", pdf: "pdf", zip: "zip"
  };

  let _rows = [];
  let _ref = null;
  let _bound = false;
  let _busy = false;

  const el = (id) => document.getElementById(id);
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? "")) : String(s ?? ""));

  /* ★★ 내 닉네임 읽기 — 이 방에서 여러 번 데인 자리입니다.
     script_core.js 의 `let myNick` 은 파일 맨 바깥에 있어도 **window 에
     안 붙습니다** (let 의 규칙). `window.myNick` 만 보면 늘 비어 있어서
     "먼저 입장한 뒤에 올릴 수 있어요" 가 뜹니다 — 멀쩡히 입장한 사람에게도요.
     (2026-08-18 실제로 그랬습니다. 대숲·나의 작업이 쓰는 방식 그대로 고침)
     이름 그대로 읽되, 혼자 방처럼 window 에 넣어 주는 화면도 있어 둘 다 봅니다. */
  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }

  function 크기글(n) {
    n = Number(n) || 0;
    return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + "MB" : Math.round(n / 1024) + "KB";
  }
  function 언제(at) {
    const 날 = Math.floor((Date.now() - at) / DAY_MS);
    if (날 <= 0) return "오늘";
    return `${날}일 전`;
  }
  function 확장자(name) { return String(name).split(".").pop().toLowerCase(); }

  function normalize(id, v) {
    if (!v || typeof v !== "object") return null;
    const name = String(v.name || "").slice(0, 120);
    if (!name.trim()) return null;
    return {
      id, name,
      size: Math.max(0, Number(v.size) || 0),
      by: String(v.by || ""),
      at: Number(v.at) || 0,
      /* url 이 있으면 🔗 링크 자료 — 파일은 밖에 있고 여기엔 이름표만 */
      url: typeof v.url === "string" ? v.url : "",
      note: String(v.note || "").slice(0, 200)
    };
  }

  /** 주소의 집만 — 어디로 가는지 눈에 보이라고 목록에 적습니다 */
  function 집(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch (e) { return "링크"; }
  }
  const 링크인가 = (r) => !!r.url;

  /* =====================================================================
     그리기
     ===================================================================== */
  function render() {
    const box = el("files-board");
    if (!box) return;

    const list = _rows.slice().sort((a, b) => b.at - a.at);
    const 총량 = list.reduce((a, r) => a + r.size, 0);
    /* 막대는 "저장 공간 1GB 중" 이 아니라 **눈대중**입니다 — 200MB 를
       가득으로 보고 그립니다. 그쯤부터는 한번 정리할 때가 된 거예요. */
    const 참 = Math.min(100, Math.round(총량 / (200 * 1024 * 1024) * 100));

    const 줄 = list.map(r => {
      const ext = 확장자(r.name);
      const 링크 = 링크인가(r);
      /* ★ 링크 자료는 안 사라집니다 — 방장이 걸어 둔 도구는 계속 쓰니까요 */
      const 남은 = Math.max(0, 90 - Math.floor((Date.now() - r.at) / DAY_MS));
      const 곧 = !링크 && 남은 <= 14;
      const 내것 = r.by === me();
      /* 지우기는 올린 사람 + 방장·운영진 (규칙도 같은 조건) */
      const 지울수 = 내것 || !!window.canAdmin?.();
      const 곁 = 링크
        ? `${esc(집(r.url))} · ${esc(r.by)}${r.size ? " · " + 크기글(r.size) : ""}`
        : `${크기글(r.size)} · ${esc(r.by)} · ${언제(r.at)}${
            곧 ? ` <b class="fl-old">· ${남은}일 뒤 사라져요</b>` : ""}`;
      return `
        <div class="fl-row${링크 ? " link" : ""}">
          <span class="fl-ic ${링크 ? "lnk" : (ICON_OF[ext] || "txt")}">${
            링크 ? "🔗" : esc(ext.toUpperCase().slice(0, 4))}</span>
          <span class="fl-m">
            <span class="fl-n">${esc(r.name)}</span>
            <span class="fl-s">${곁}</span>
            ${링크 && r.note ? `<span class="fl-note">${esc(r.note)}</span>` : ""}
          </span>
          <button type="button" class="fl-dl" data-file-get="${esc(r.id)}">${링크 ? "열기" : "받기"}</button>
          ${지울수 ? `<button type="button" class="fl-x" data-file-del="${esc(r.id)}"
                              title="지우기" aria-label="지우기">✕</button>` : ""}
        </div>`;
    }).join("");

    box.innerHTML = `
      <div class="fl-usage">
        <span>${list.length}개 · ${크기글(총량)}</span>
        <span class="fl-bar"><i style="width:${참}%"></i></span>
        <!-- ★ 링크 자료가 섞여 있으면 "90일 뒤 사라져요" 한마디로 뭉뚱그리면
             안 됩니다 — 링크는 안 사라지거든요. 걸린 게 있을 때만 덧붙여요. -->
        <span>90일 뒤 사라져요${list.some(링크인가) ? " <b>· 🔗 링크는 그대로</b>" : ""}</span>
      </div>
      <div class="fl-list">${list.length ? 줄
        : `<p class="fl-empty">아직 올라온 자료가 없어요.<br>아래에서 파일을 골라 올려 보세요.</p>`}</div>
      <div class="fl-up">
        <label class="fl-drop" for="files-pick">
          <b>파일을 골라 올리기</b>
          <small>한글 · 워드 · 엑셀 · CSV · 텍스트 · PDF · ZIP · 한 개당 2MB까지</small>
        </label>
        <input type="file" id="files-pick" hidden
               accept=".hwp,.hwpx,.doc,.docx,.xls,.xlsx,.csv,.txt,.pdf,.zip">
        ${window.isRoomOwner?.() ? `
          <button type="button" class="fl-link" data-file-link="1">
            🔗 큰 파일은 링크로 걸기
          </button>` : ""}
        <p class="fl-msg" id="files-msg"></p>
      </div>`;
  }

  function 알림(t, cls) {
    const m = el("files-msg");
    if (m) { m.textContent = t || ""; m.className = "fl-msg " + (cls || ""); }
  }

  /* =====================================================================
     서버 — 목록만 구독합니다 (내용은 받을 때 낱개로)
     ===================================================================== */
  function listen() {
    if (_ref || !window.db) return;
    _ref = window.db.ref("files");
    _ref.on("value", snap => {
      const raw = snap.val() || {};
      const out = [];
      Object.keys(raw).forEach(id => {
        const r = normalize(id, raw[id]);
        if (r) out.push(r);
      });
      _rows = out;
      render();
      sweep();
    });
  }

  /** 90일 지난 것은 조용히 걷어냅니다 (목록과 내용 둘 다)
      ★ 🔗 링크 자료는 빼 둡니다 — DB 를 안 쓰니 걷어낼 이유가 없고,
        방장이 걸어 둔 도구가 90일 뒤 말없이 사라지면 곤란해요. */
  async function sweep() {
    if (!window.db || window.FOREST_NO_WITHER) return;
    const cut = Date.now() - KEEP_MS;
    const dead = _rows.filter(r => !링크인가(r) && r.at && r.at < cut);
    for (const r of dead) {
      try { await window.db.ref("files/" + r.id).remove(); } catch (e) {}
      try { await window.db.ref("fileBlob/" + r.id).remove(); } catch (e) {}
    }
  }

  /* =====================================================================
     ① 고르는 순간 막기 — 서버로 나가기 전에
     ===================================================================== */
  function 골랐을때(file) {
    if (!file) return;
    if (!me()) { 알림("먼저 입장한 뒤에 올릴 수 있어요.", "bad"); return; }

    const ext = 확장자(file.name);
    if (OK_EXT.indexOf(ext) < 0) {
      알림(`❌ .${ext} 는 올릴 수 없는 종류예요. 한글·워드·엑셀·CSV·텍스트·PDF·ZIP 만 받아요.`, "bad");
      return;
    }
    if (file.size > MAX_BYTES) {
      /* ★ 여기서 끝냅니다 — 파일을 **읽지도 않습니다**. 서버로 한 바이트도
         안 나가니 통신량 낭비가 없어요. 얼마나 큰지 같이 알려 줍니다. */
      알림(`❌ ${file.name} 은 ${크기글(file.size)} 예요 — 한 개당 2MB까지 올릴 수 있어요. (서버로는 아무것도 안 보냈어요)`, "bad");
      return;
    }
    올리기(file);
  }

  async function 올리기(file) {
    if (_busy) return;
    _busy = true;
    알림(`${file.name} 올리는 중…`);
    try {
      const b64 = await new Promise((ok, no) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result || ""));
        fr.onerror = () => no(new Error("read"));
        fr.readAsDataURL(file);
      });
      /* base64 는 원본보다 33% 큽니다. ②번 겹(보안규칙)과 같은 값으로
         여기서도 한 번 봅니다 — 서버가 거절하기 전에 사람 말로 알리려고요. */
      if (b64.length > MAX_B64) {
        알림(`❌ ${file.name} 은 담기에 너무 커요 (2MB까지).`, "bad");
        return;
      }
      /* 목록을 먼저 만들고 내용을 붙입니다 — 규칙이 "목록에 있는 id 만
         내용을 쓸 수 있다" 로 잠겨 있어서 순서가 중요해요. */
      const ref = window.db.ref("files").push();
      await ref.set({ name: file.name.slice(0, 120), size: file.size, by: me(), at: Date.now() });
      try {
        await window.db.ref("fileBlob/" + ref.key).set(b64);
      } catch (e) {
        /* 내용을 못 올렸으면 목록도 도로 지웁니다 — 받을 수 없는 줄이
           목록에 남아 있으면 더 헷갈려요 */
        try { await ref.remove(); } catch (e2) {}
        throw e;
      }
      window.dockMarkNew?.("files");
      알림(`✅ ${file.name} (${크기글(file.size)}) 올렸어요.`, "ok");
    } catch (e) {
      알림("올리지 못했어요. 연결을 확인해 주세요.", "bad");
    } finally {
      _busy = false;
      const inp = el("files-pick");
      if (inp) inp.value = "";       // 같은 파일을 다시 고를 수 있게
    }
  }

  /* 받기 — 그 하나만 내려받습니다 */
  async function 받기(id) {
    const r = _rows.find(x => x.id === id);
    if (!r || !window.db) return;

    /* ★ 🔗 링크 자료는 **새 창으로 엽니다.**
       download 속성은 남의 집(다른 도메인) 파일에는 안 먹어요 — 브라우저가
       무시하고 그냥 열어 버립니다. 그러느니 처음부터 새 창이 정직해요.
       ★ noopener 를 붙입니다 — 안 붙이면 열린 쪽이 window.opener 로 이
         방을 딴 주소로 돌려버릴 수 있습니다(탭내빙 수법). */
    if (링크인가(r)) {
      알림(`${집(r.url)} 로 갑니다…`);
      window.open(r.url, "_blank", "noopener,noreferrer");
      setTimeout(() => 알림(""), 2000);
      return;
    }

    알림(`${r.name} 받는 중…`);
    try {
      /* Storage 로 옮긴 뒤에는 url 이 채워집니다 — 그때는 그리로 갑니다 */
      let src = r.url;
      if (!src) src = (await window.db.ref("fileBlob/" + id).once("value")).val() || "";
      if (!src) { 알림("파일 내용을 찾지 못했어요.", "bad"); return; }
      const a = document.createElement("a");
      a.href = src; a.download = r.name;
      document.body.appendChild(a); a.click(); a.remove();
      알림("");
    } catch (e) {
      알림("받지 못했어요. 연결을 확인해 주세요.", "bad");
    }
  }

  /* =====================================================================
     🔗 링크 걸기 — **방장만** (2026-08-28)
     ---------------------------------------------------------------------
     ★ 여기 문고리는 화면일 뿐이고 진짜 자물쇠는 보안규칙입니다
       (files/$id 에 url 이 있으면 방장 uid 만 쓸 수 있게 잠갔어요).
     ★ https 만 받습니다 — http 는 중간에서 바꿔치기가 됩니다.
     ===================================================================== */
  async function 링크걸기() {
    if (!window.isRoomOwner?.()) {
      알림("링크는 방장만 걸 수 있어요.", "bad"); return;
    }
    const 주소 = String(prompt(
      "파일이 있는 주소를 붙여 넣어 주세요.\n\n" +
      "★ https:// 로 시작해야 합니다.\n" +
      "★ 큰 설치 파일은 GitHub Releases 에 올리고 그 주소를 쓰세요 —\n" +
      "   2GB 까지 되고, 요금이 안 나갑니다.") || "").trim();
    if (!주소) return;
    if (!/^https:\/\//i.test(주소)) {
      알림("❌ https:// 로 시작하는 주소만 걸 수 있어요.", "bad"); return;
    }
    const 이름 = String(prompt(
      "목록에 보일 이름을 적어 주세요.", "") || "").trim().slice(0, 120);
    if (!이름) return;
    const 안내 = String(prompt(
      "받는 분께 한 줄 안내 (없으면 비워 두세요)\n\n" +
      "설치 프로그램이라면 이렇게 적어 두시길 권해요:\n" +
      "「설치할 때 '알 수 없는 게시자' 경고가 떠요 — 추가 정보 › 실행을 누르시면 됩니다」",
      "") || "").trim().slice(0, 200);

    try {
      const ref = window.db.ref("files").push();
      const 짐 = { name: 이름, size: 0, by: me(), at: Date.now(), url: 주소 };
      if (안내) 짐.note = 안내;
      await ref.set(짐);
      window.dockMarkNew?.("files");
      알림(`✅ ${이름} 을(를) 걸었어요. (${집(주소)})`, "ok");
    } catch (e) {
      알림("걸지 못했어요 — 방장 계정인지, 보안규칙을 콘솔에 올렸는지 확인해 주세요.", "bad");
    }
  }

  async function 지우기(id) {
    const r = _rows.find(x => x.id === id);
    if (!r) return;
    if (!confirm(`${r.name} 을(를) 지울까요? 되돌릴 수 없어요.`)) return;
    try {
      await window.db.ref("fileBlob/" + id).remove();
      await window.db.ref("files/" + id).remove();
      알림("지웠어요.");
    } catch (e) {
      알림("지우지 못했어요. (올린 사람과 방장·운영진만 지울 수 있어요)", "bad");
    }
  }

  /* =====================================================================
     손가락 — 판 안쪽 상자에 답니다 (대숲에서 데인 자리)
     ===================================================================== */
  function bind() {
    const host = el("files-modal");
    if (!host || _bound) return;
    _bound = true;

    host.addEventListener("click", (e) => {
      const g = e.target.closest("[data-file-get]");
      if (g) { 받기(g.dataset.fileGet); return; }
      const d = e.target.closest("[data-file-del]");
      if (d) { 지우기(d.dataset.fileDel); return; }
      if (e.target.closest("[data-file-link]")) { 링크걸기(); return; }
    });
    host.addEventListener("change", (e) => {
      if (e.target?.id === "files-pick") 골랐을때(e.target.files?.[0]);
    });
  }

  /* [2026-08-21] 아래 알약 → 머리말 가운데 창으로 옮겼습니다.
     껍데기(#files-modal)는 index.html 에 붙박이로 있고, 여기서는 안만
     채웁니다. 판 시절과 달리 host 를 만들 필요가 없어요. */
  function openFiles() {
    const m = el("files-modal");
    if (!m) return;
    bind();
    m.style.display = "flex";
    listen();
    render();
  }
  function closeFiles() {
    const m = el("files-modal");
    if (m) m.style.display = "none";
  }
  window.openFiles  = openFiles;
  window.closeFiles = closeFiles;
})();
