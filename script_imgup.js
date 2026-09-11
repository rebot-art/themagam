/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_imgup.js — 🖼 그림 올리기 (2026-09-11, 콩)

   [무엇인가]
   챗·수다방·비밀방에서 **화면 캡처와 사진**을 보낼 수 있게 합니다.
     · Ctrl+V 로 붙여넣기 (컴퓨터)
     · 🖼 단추로 사진 고르기 (폰에는 Ctrl+V 가 없어서 이게 유일한 길입니다)
     · 끌어다 놓기

   [★ 왜 구조를 하나도 안 바꿨나 — 여기가 이 파일의 핵심입니다]
   그림을 Storage 에 올린 뒤, **그 주소를 평범한 글 메시지로 보냅니다.**
   챗은 이미 주소를 그림으로 펼쳐 주는 장치(linkifyEscaped)를 갖고 있어서,
   그것만으로 그림이 됩니다. 그래서
     · 메시지 생김새(구조)를 안 바꿉니다 → 지난 대화가 안 깨집니다
     · 실시간 DB 보안규칙을 안 건드립니다
     · 챗·수다방·비밀방이 **같은 길**을 씁니다
   스티커가 `[[스티커:id]]` 글자 하나로 도는 것과 같은 수법이에요.

   [통신량]
   서버에 오가는 건 여전히 **주소 한 줄**입니다. 그림은 각자 브라우저가
   Storage 에서 직접 받아와요. 실시간 DB 다운로드는 늘지 않습니다.

   [올리기 전에 줄입니다]
   긴 변 1600px, 400KB 를 목표로 품질을 낮춰 갑니다. 보통 원본의 1/10
   아래로 떨어져요. 화면에서 보기엔 차이가 없습니다.

   [어디에 쌓이나]
     chatimg/{무작위20자}.jpg    ← 챗·수다방. 구글 클라우드 수명 규칙이
                                   **7일 뒤 자동으로 지웁니다**
     sroomimg/{무작위20자}.jpg   ← 비밀방. **자정 청소가 대화와 함께 지웁니다**
   ★ 규칙이 그림(image/*)만 받습니다 — 한글 파일 같은 건 서버가 거부해요.
   ===================================================================== */
(function () {
  "use strict";

  const MAX_PX     = 1600;             // 긴 변 최대
  const TARGET     = 400 * 1024;       // 목표 크기
  const HARD_MAX   = 5 * 1024 * 1024;  // 보안 규칙과 같은 값
  const QUALITIES  = [0.82, 0.7, 0.6, 0.5, 0.4];

  const 창고 = () => (window.firebase && firebase.storage) ? firebase.storage() : null;

  function 무작위(n) {
    const A = "abcdefghijklmnopqrstuvwxyz0123456789";
    const a = new Uint32Array(n || 20);
    (window.crypto || {}).getRandomValues?.(a);
    return [...a].map(x => A[x % A.length]).join("");
  }

  /** 그림을 줄이고 압축합니다. 실패하면 원본 그대로 돌려줍니다. */
  async function 줄이기(file) {
    try {
      const url = await new Promise((r, j) => {
        const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = j;
        fr.readAsDataURL(file);
      });
      const img = await new Promise((r, j) => {
        const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = url;
      });
      const k = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width  = Math.max(1, Math.round(img.width * k));
      cv.height = Math.max(1, Math.round(img.height * k));
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      for (const q of QUALITIES) {
        const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", q));
        if (!blob) break;
        if (blob.size <= TARGET || q === QUALITIES[QUALITIES.length - 1]) return blob;
      }
    } catch (e) {}
    return file;
  }

  /* 올리는 동안 글칸에 알려 줍니다 — 큰 그림은 몇 초 걸려서, 아무 표시가
     없으면 "안 됐나?" 하고 또 붙여넣게 됩니다. */
  function 알림(글칸, 글) {
    if (!글칸) return;
    if (글) { 글칸.dataset.imgupOld = 글칸.dataset.imgupOld ?? (글칸.placeholder || ""); 글칸.placeholder = 글; }
    else if (글칸.dataset.imgupOld !== undefined) { 글칸.placeholder = 글칸.dataset.imgupOld; delete 글칸.dataset.imgupOld; }
  }

  /** 한 장 올리고, 주소를 글칸에 넣어 원래 보내기로 흘려보냅니다 */
  async function 올리기(file, 곳) {
    const st = 창고();
    const 글칸 = document.getElementById(곳.inputId);
    if (!st) { 알림(글칸, "그림 보내기를 쓸 수 없어요 (창고 연결 안 됨)"); return; }
    if (!file || !/^image\//.test(file.type || "")) {
      알림(글칸, "그림만 보낼 수 있어요");
      setTimeout(() => 알림(글칸, ""), 2500);
      return;
    }

    알림(글칸, "그림 줄이는 중…");
    const blob = await 줄이기(file);
    if (blob.size > HARD_MAX) {
      알림(글칸, "너무 큰 그림이에요 (5MB 까지)");
      setTimeout(() => 알림(글칸, ""), 2500);
      return;
    }

    const 길 = 곳.folder + "/" + 무작위(20) + ".jpg";
    try {
      const ref = st.ref(길);
      const task = ref.put(blob, { contentType: blob.type || "image/jpeg" });
      task.on("state_changed", s => {
        const pct = Math.round(s.bytesTransferred / s.totalBytes * 100);
        알림(글칸, "그림 보내는 중… " + pct + "%");
      });
      await task;
      const url = await ref.getDownloadURL();
      알림(글칸, "");

      /* ★ 보내는 길은 새로 뚫지 않습니다 — 글칸에 주소를 적고 원래
         보내기를 부릅니다. 답장·멘션·수다방 판단까지 기존 흐름 그대로예요.
         (스티커가 쓰는 것과 같은 수법입니다) */
      if (글칸) {
        글칸.value = url;
        try { 곳.send?.(); } catch (e) {}
        글칸.focus();
      }
    } catch (e) {
      알림(글칸, "");
      const 왜 = (e && e.code) === "storage/unauthorized"
        ? "그림을 올릴 권한이 없어요 (보안 규칙 확인)" : "그림을 못 보냈어요";
      알림(글칸, 왜);
      setTimeout(() => 알림(글칸, ""), 3000);
    }
  }

  /* =====================================================================
     붙이기 — 한 자리에 세 가지 길(붙여넣기·단추·끌어놓기)을 답니다
     ---------------------------------------------------------------------
     곳 = { folder, inputId, btnId, hostId, send }
     ★ 여러 번 불러도 안전합니다 (판을 다시 그릴 때 또 불려요).
       같은 자리에 두 번 달리면 그림이 두 장 올라갑니다.
     ===================================================================== */
  const _달림 = new Set();

  function 붙이기(곳) {
    if (!곳 || !곳.folder || !곳.inputId) return;
    const 열쇠 = 곳.folder + "|" + 곳.inputId;

    /* 🖼 단추 — 폰에서 사진을 보낼 수 있는 **유일한 길**입니다 */
    const btn = 곳.btnId && document.getElementById(곳.btnId);
    if (btn && !btn.dataset.imgupOn) {
      btn.dataset.imgupOn = "1";
      btn.addEventListener("click", () => {
        const f = document.createElement("input");
        f.type = "file"; f.accept = "image/*"; f.multiple = false;
        f.addEventListener("change", () => { if (f.files[0]) 올리기(f.files[0], 곳); });
        f.click();
      });
    }

    if (_달림.has(열쇠)) return;
    _달림.add(열쇠);

    /* Ctrl+V — 글칸에 focus 가 있을 때만 받습니다.
       ★ 이게 없으면 챗과 비밀방이 열려 있을 때 한 번 붙여넣기에 두 장이
         올라갑니다 (두 곳이 같은 paste 를 듣게 되니까요). */
    document.addEventListener("paste", (e) => {
      const 글칸 = document.getElementById(곳.inputId);
      if (!글칸 || document.activeElement !== 글칸) return;
      const it = [...(e.clipboardData?.items || [])].find(i => /^image\//.test(i.type));
      if (!it) return;
      e.preventDefault();
      올리기(it.getAsFile(), 곳);
    });

    /* 끌어다 놓기 — 판 위 아무 데나 */
    const host = 곳.hostId && document.getElementById(곳.hostId);
    if (host && !host.dataset.imgupOn) {
      host.dataset.imgupOn = "1";
      ["dragenter", "dragover"].forEach(t =>
        host.addEventListener(t, e => { e.preventDefault(); host.classList.add("imgup-over"); }));
      ["dragleave", "dragend"].forEach(t =>
        host.addEventListener(t, () => host.classList.remove("imgup-over")));
      host.addEventListener("drop", e => {
        e.preventDefault(); host.classList.remove("imgup-over");
        const f = [...(e.dataTransfer?.files || [])][0];
        if (f) 올리기(f, 곳);
      });
    }
  }

  /* =====================================================================
     🧹 비밀방 그림 지우기 (자정 청소가 부릅니다)
     ---------------------------------------------------------------------
     비밀방은 자정에 대화가 쓸립니다. 그런데 그림이 창고에 남으면 **대화는
     사라졌는데 그림은 주소만 알면 영영 열리는** 상태가 돼요. 비밀방이라는
     이름과 어긋나서, 대화를 지울 때 그림도 같이 지웁니다 (콩 2026-09-11).

     주소에서 창고 속 자리를 되짚습니다 —
       https://firebasestorage.googleapis.com/v0/b/버킷/o/sroomimg%2Fabc.jpg?alt=...
                                                        └──── 이 조각 ────┘
     ★ 실패해도 조용히 넘어갑니다. 그림 하나 못 지운 것 때문에 대화 청소가
       멈추면 훨씬 나쁩니다.
     ===================================================================== */
  function 주소에서길(msg) {
    const m = String(msg || "").match(/\/o\/([^?\s]+)/);
    if (!m) return "";
    let 길 = "";
    try { 길 = decodeURIComponent(m[1]); } catch (e) { return ""; }
    return /^sroomimg\//.test(길) ? 길 : "";
  }

  async function 그림지우기(글들) {
    const st = 창고();
    if (!st) return;
    const 길들 = [...new Set((글들 || []).map(주소에서길).filter(Boolean))];
    for (const 길 of 길들) {
      try { await st.ref(길).delete(); } catch (e) {}
    }
  }

  window.imgUpAttach     = 붙이기;
  window.imgUpDeleteMsgs = 그림지우기;
  window.imgUpPathOf     = 주소에서길;
})();
