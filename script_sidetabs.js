/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 📑 옆 탭 (script_sidetabs.js) — 2026-10-09 콩
   ---------------------------------------------------------------------
   아래 알약 줄이 너무 길어져서, **자주 쓰진 않지만 열어 두고 찬찬히 읽는**
   메뉴를 화면 오른쪽 끝 세로 탭으로 뺍니다 (🙋‍♂️ Member 탭과 같은 결).

     · 대상: 📢 공지 · 📓 표현 공부 · 🤔 Q&A   (🏢 품평은 본방에 켤 때 같이 — 혼자 방엔 품평이 없어요)
     · 폭 400px. 열리면 카드 마당이 그만큼 좁아져 카드가 다시 줄을 맞춥니다.
     · **한 번에 하나만** 열립니다 — Member 명단(250px)까지 포함해서요.
     · 탭은 Member 탭 **아래로** 차례로 쌓입니다.
     · 옮긴 메뉴의 아래 알약은 감춥니다 (html.sidetabs-on).

   [어떻게 옮기나 — 새로 그리지 않습니다]
     · 표현 공부 · Q&A : 알약 판의 알맹이(#dock-body-help / -qna)를 **통째로 이 칸에 옮겨** 옵니다.
       그리는 쪽(openHelp/openQna)은 그 id 만 보고 그려서, 어디 있든 똑같이 돕니다.
       닫으면 듣기를 끊습니다(closeHelp/closeQna) — 알약 판과 같은 통신량 원칙.
     · 공지 : 가운데 창(#notice-modal)을 옮기지 않고 **CSS 로 오른쪽 칸 자리에 앉힙니다**
       (html.side-notice). 공지 CSS 가 #notice-modal 밑으로 묶여 있어 떼어 내면 모양이 깨져요.
     · 자료실 : 공지와 같은 방식 (html.side-files) — [2026-10-09 콩] Q&A 아래 다섯째 탭

   ★ SIDE_MAIN_ON — 지금은 **혼자 방에서만** 켭니다 (새 기능은 혼자 방 먼저 — 콩).
     본방에 켤 때는 이 값을 true 로, 그리고 TABS 에 pub 을 넣습니다.
   ===================================================================== */
(function () {
  /* 🎄 크리스마스 에디션(신년 리뉴얼) 오픈 시각 — 이때부터 본방에도 작품 추천·데드라인이 열립니다.
     혼자 방(?solo=1)은 언제나 열려 있어요. script_deadline.js 도 이 함수를 같이 씁니다. */
  const RENEWAL_AT = Date.parse("2026-12-18T00:00:00+09:00");
  window.renewalOpen = function () { return window.SOLO === true || Date.now() >= RENEWAL_AT; };
  window.RENEWAL_AT = RENEWAL_AT;
  /* ⬅️ 왼쪽 사이드 바 (📢 공지 · 🙋 멤버스) — 2026-11-19 콩. 지금은 **혼자 방에서만** 시험합니다.
     본방에 켤 때는 LEFT_MAIN 을 true 로 (그러면 오른쪽 탭에서 공지가 왼쪽으로 이사합니다). */
  const LEFT_MAIN = true;
  window.leftSide = () => window.SOLO === true || LEFT_MAIN;
  const SIDE_MAIN_ON = true;   // [2026-10-09 콩] 혼자 방 시험을 마치고 본방에도 켰습니다
  if (!window.SOLO && !SIDE_MAIN_ON) return;

  /* ★ [2026-11-18 콩] 📓 표현 공부를 🤔 Q&A 에 합치고(표현 공부 탭 없앰), ✍️ Work Log 를 옆 탭(데드라인 바로 아래)으로 옮깁니다.
       둘 다 **혼자 방 먼저** — 본방에 켤 때는 아래 두 값을 true 로 바꾸면 돼요.
       (랭킹은 아래 알약 줄의 🏆 랭킹 자리로 따로 빠집니다 — script_dock.js) */
  const QNA_MERGE_MAIN = true, ACT_MAIN = true;   // 표현 공부→Q&A 합침·🧵 타임라인은 본방도 켬 (2026-11-18 콩)
  window.qnaMerged = () => window.SOLO === true || QNA_MERGE_MAIN;
  window.actSide = () => window.SOLO === true || ACT_MAIN;

  const W = 400;
  const TABS = [
    { id: "notice", label: "📢 공지" },
    /* [2026-11-09 콩] 차례 — 📢 공지 · 🏢 품평(본방) · 📓 표현 공부 · 🤔 Q&A · 📰 새소식 · 📚 작품 추천 · 📁 자료실 … ⏰ 데드라인(맨 아래) (2026-11-17 콩이 다시 정함)
       (🔗 링크 & 검색 탭은 📁 자료실 맨 위 '찾아보기'로 합쳐서 없앴어요.)
       renewal 표시가 있는 탭(새소식·작품 추천·데드라인)은 **크리스마스 에디션 날(12/18 0시 KST)부터** 본방에도 열립니다.
       그 전엔 본방에는 **이름을 가린 맛보기 탭(📰◻︎◻︎◻︎◻︎ · 📚◻︎◻︎◻︎◻︎ · ⏰◻︎◻︎◻︎◻︎)**만 있고, 열면 "준비 중 · 12/18 오픈" 안내만 떠요(통신 0).
       혼자 방(?solo=1)에서는 진짜 기능이 바로 보여요 — 날짜가 되면 새로고침만으로 열립니다(손댈 것 없음). */
    { id: "pub",    label: "🏢 출판사 품평", open: "openPubReview", close: "closePubReview", main: true },
    { id: "help",   label: "📓 표현 공부", open: "openHelp", close: "closeHelp" },
    { id: "qna",    label: "🤔 Q&A",      open: "openQna",  close: "closeQna" },
    /* [2026-11-17 콩] 📰 새소식 — Q&A 바로 아래. 누구나 올리는 공모전·프로모션 소식, 글은 1년 뒤 사라집니다. 알맹이는 script_news.js 가 칸 안에 직접 그립니다.
       작품 추천과 함께 크리스마스 에디션 날 열려요(그 전 본방엔 맛보기 탭). */
    { id: "news", label: "📰 새소식", open: "openNews", close: "closeNews", renewal: true, soon: "📰◻︎◻︎◻︎◻︎" },
    /* [2026-11-09 콩] 📚 작품 추천 — 자료실 바로 아래. 익명 · 한 줄 목록 · 👍만. 알맹이는 script_bookrec.js 가 칸 안에 직접 그립니다. */
    { id: "bookrec", label: "📚 작품 추천", open: "openBookrec", close: "closeBookrec", renewal: true, soon: "📚◻︎◻︎◻︎◻︎" },
    /* [2026-10-09 콩] 📁 자료실 — **가운데 창**(#files-modal)을 CSS 로 오른쪽 칸에 앉힙니다(html.side-files). seat 가 그 표시.
       [2026-11-09] 맨 위에 🔎 찾아보기가 들어갔어요(옛 링크 & 검색). */
    { id: "files",  label: "📁 자료실",   open: "openFiles", close: "closeFiles", seat: "side-files" },
    /* [2026-11-18 콩] 🧵 타임라인(옛 이름 활동) — 데드라인 바로 위. 오늘 24시간 타임라인(상태 바·누적 작업시간·전환 지점). 본방 오픈(ACT_MAIN=true, 2026-11-18).
       알맹이는 script_worklog.js 의 Activity 가 칸 안에 직접 그립니다. */
    { id: "activity", label: "🧵 타임라인", open: "openActivity", close: "closeActivity", act: true, bottom: true },
    /* [2026-10-12 콩] ⏰ 데드라인 — 맨 아래(bottom → CSS margin-top:auto), 워크로그와 가까워 눈에 띄게(2026-11-09).
       알맹이는 script_deadline.js 가 칸 안에 직접 그립니다. 점(새 글 표시)은 없어요. */
    { id: "deadline", label: "⏰ 데드라인", open: "openDeadline", close: "closeDeadline", renewal: true, soon: "⏰◻︎◻︎◻︎◻︎", bottom: true }
  ].filter(t => !(t.id === "notice" && window.leftSide())).filter(t => !(t.main && window.SOLO)).filter(t => !(t.id === "help" && window.qnaMerged()) && !(t.act && !window.actSide())).map(t => (t.renewal && !window.renewalOpen())
    ? { id: t.id, label: t.soon, soonTab: true, bottom: t.bottom }   // 🎁 오픈 전 맛보기 — 이름은 아직 비밀, 열면 "준비 중" 안내만
    : t);
  const el = (id) => document.getElementById(id);
  const root = document.documentElement;
  const OPEN_KEY = "sideTabOpen";
  let _cur = "";

  /* 공지 여닫기 원본을 쥐어 둡니다 — 채팅 머리말의 [📢 공지] 단추도 옆 탭으로 오게 */
  let _nOpen = null, _nClose = null;
  function 공지가로채기() {
    if (window.leftSide()) return;                 // 왼쪽 사이드 바가 공지를 맡습니다 (아래 ⬅️ 블록)
    if (_nOpen || typeof window.openNoticeBoard !== "function") return;
    _nOpen = window.openNoticeBoard; _nClose = window.closeNoticeBoard;
    window.openNoticeBoard  = () => 열기("notice");
    window.closeNoticeBoard = () => { if (_cur === "notice") 닫기(); else _nClose?.(); };
  }

  function 만들기() {
    if (el("side-tabs")) return true;
    if (!document.body || !el("dock-bar")) return false;
    const box = document.createElement("aside");
    box.id = "side-tabs"; box.className = "side-tabs";
    box.innerHTML =
      `<div class="side-tabs-col" id="side-tabs-col">` +
      TABS.map(t => `<button type="button" class="member-tab side-tab${t.bottom ? " side-tab-bottom" : ""}" id="side-tab-${t.id}" data-side="${t.id}"
          aria-expanded="false"><span>${t.label}</span><i class="side-tab-dot hidden" id="side-dot-${t.id}"></i></button>`).join("") +
      /* 📚 작품 추천은 알약이 없어 점의 원본(#dock-dot-bookrec)이 없습니다 — 숨은 자리를 하나 만들어
         script_dock.js 의 dot()/newmark 가 그대로 칠하게 하고, 아래 비추기가 탭으로 옮깁니다. */
      `<span class="dock-dot hidden" id="dock-dot-bookrec" hidden aria-hidden="true"></span>` +
      `<span class="dock-dot hidden" id="dock-dot-news" hidden aria-hidden="true"></span>` +
      `</div>
       <div class="side-pane" id="side-pane">
         <div class="side-pane-head"><b id="side-pane-title"></b>
           <button type="button" class="dock-x" id="side-pane-x" aria-label="닫기" title="닫기">✕</button></div>
         <div class="side-pane-body dock-body" id="side-pane-body"></div>
       </div>`;
    document.body.appendChild(box);
    box.addEventListener("click", (e) => {
      const t = e.target.closest("[data-side]");
      if (t) { const id = t.dataset.side; if (_cur === id) 닫기(); else 열기(id); return; }
      if (e.target.closest("#side-pane-x")) 닫기();
    });
    root.classList.add("sidetabs-on");
    /* Member 명단이 열리면 이쪽을 닫습니다 (한 번에 하나) */
    document.addEventListener("click", (e) => {
      if (e.target.closest("#member-tab")) setTimeout(() => {
        if (root.classList.contains("member-open") && _cur) 닫기();
      }, 0);
    }, true);
    /* 알약의 붉은 점을 탭에 그대로 비춥니다 */
    TABS.forEach(t => {
      const src = el("dock-dot-" + t.id), dst = el("side-dot-" + t.id);
      if (!src || !dst) return;
      const 비추기 = () => dst.classList.toggle("hidden", src.classList.contains("hidden") || _cur === t.id);
      new MutationObserver(비추기).observe(src, { attributes: true, attributeFilter: ["class"] });
      비추기();
    });
    let 기억 = "";
    try { 기억 = window.AppStore?.getItem(OPEN_KEY) || ""; } catch (e) {}
    if (기억 && TABS.some(t => t.id === 기억) && !root.classList.contains("member-open")) setTimeout(() => 열기(기억, true), 300);
    return true;
  }

  function 자리맞추기() {
    const box = el("side-tabs"), 마당 = document.querySelector(".cards-area");
    if (!box || !마당) return;
    const r = 마당.getBoundingClientRect();
    if (r.height < 40) return;
    const top = Math.round(r.top), h = Math.round(r.height);
    box.style.top = top + "px"; box.style.height = h + "px";
    root.style.setProperty("--side-top", top + "px");
    root.style.setProperty("--side-h", h + "px");
    /* 혼자 방 — 공지 탭 **아래에 Member 탭**이 끼어듭니다. Member 탭을 공지 키만큼 내리고,
       그다음 탭(표현 공부)을 Member 키만큼 더 내려서 틈을 벌려요. */
    const m = el("member-tab"), n = el("side-tab-notice"), 다음 = el("side-tab-" + (TABS[1] || {}).id);
    if (m && n && 다음) {
      m.style.marginTop = (Math.round(n.getBoundingClientRect().height) + 6) + "px";
      다음.style.marginTop = (Math.round(m.getBoundingClientRect().height) + 6) + "px";
    } else if (m && !n && TABS[0] && el("side-tab-" + TABS[0].id)) {
      /* 공지가 왼쪽으로 간 방 — Member 탭이 맨 위, 그 아래로 첫 탭 */
      m.style.marginTop = "0px";
      el("side-tab-" + TABS[0].id).style.marginTop = (Math.round(m.getBoundingClientRect().height) + 6) + "px";
    }
  }
  window.addEventListener("resize", 자리맞추기);

  function 카드다시() {
    try { window.relayoutCards?.(); } catch (e) {}
    setTimeout(() => { try { window.relayoutCards?.(); } catch (e) {} }, 280);
    setTimeout(() => { try { window.relayoutCards?.(); } catch (e) {} }, 800);   // 무거운 방에서 폭이 늦게 자리 잡을 때를 위한 한 번 더 (2026-10-14)
  }

  function 열기(id, 처음) {
    const t = TABS.find(x => x.id === id);
    if (!t || !el("side-tabs")) return;
    if (_cur && _cur !== id) 닫기(true);
    /* Member 명단이 열려 있으면 먼저 닫습니다 */
    if (root.classList.contains("member-open")) el("member-tab")?.click();
    _cur = id;
    root.classList.add("side-open");
    el("side-pane-title").textContent = t.label;
    if (id === "notice") {
      root.classList.add("side-notice");
      _nOpen?.();
    } else if (t.soonTab) {
      /* 🎁 오픈 전 맛보기 — 아무것도 읽지 않고 안내만 그립니다 */
      el("side-pane-body").innerHTML = `<div class="side-teaser"><div class="st-ic">🎁</div><b>준비 중이에요</b><p>12/18 크리스마스 에디션과 함께<br>오픈됩니다 🎄</p><small>어떤 기능일지는 비밀 ㅎㅎ</small></div>`;
    } else if (t.seat) {
      /* 가운데 창을 옆 칸에 앉히는 쪽(자료실) — 창은 그대로 두고 CSS 만 */
      root.classList.add(t.seat);
      window[t.open]?.();
      window.dockSeen?.(id);
    } else {
      try { window.dockCloseOne?.(id); } catch (e) {}
      const body = el("dock-body-" + id);
      if (body) el("side-pane-body").appendChild(body);
      window[t.open]?.();
      window.dockSeen?.(id);
    }
    TABS.forEach(x => el("side-tab-" + x.id)?.setAttribute("aria-expanded", String(x.id === id)));
    el("side-dot-" + id)?.classList.add("hidden");
    if (!처음) { try { window.AppStore?.setItem(OPEN_KEY, id); } catch (e) {} }
    자리맞추기(); 카드다시();
  }

  function 닫기(바꾸는중) {
    const id = _cur, t = TABS.find(x => x.id === id);
    if (!t) return;
    _cur = "";
    if (id === "notice") {
      _nClose?.();
      root.classList.remove("side-notice");
    } else if (t.soonTab) {
      el("side-pane-body").querySelector(".side-teaser")?.remove();
    } else if (t.seat) {
      window[t.close]?.();
      root.classList.remove(t.seat);
      window.dockSeen?.(id);
    } else {
      window[t.close]?.();
      window.dockSeen?.(id);
      const body = el("dock-body-" + id), 집 = el("dock-panel-" + id);
      if (body && 집) 집.appendChild(body);
    }
    el("side-tab-" + id)?.setAttribute("aria-expanded", "false");
    if (바꾸는중) return;
    root.classList.remove("side-open");
    try { window.AppStore?.setItem(OPEN_KEY, ""); } catch (e) {}
    카드다시();
  }

  /* 📁 자료실 — 창의 ✕·바깥 클릭이 closeFiles() 를 직접 부르면 칸만 비고 탭은 열린 채 남습니다.
     closeFiles 를 감싸서, 자료실 탭이 열려 있을 때 불리면 이쪽도 같이 닫습니다. */
  (function 자료실가로채기(n) {
    if (typeof window.closeFiles !== "function") { if (n < 40) setTimeout(() => 자료실가로채기(n + 1), 250); return; }
    const orig = window.closeFiles;
    if (orig.__sideHooked) return;
    const wrapped = function () { const r = orig.apply(this, arguments); if (_cur === "files") 닫기(); return r; };
    wrapped.__sideHooked = true;
    window.closeFiles = wrapped;
    TABS.find(x => x.id === "files").close = "__sideCloseFilesOrig";
    window.__sideCloseFilesOrig = orig;
  })(0);

  /* Esc — 공지 쪽 손가락은 창만 감추고 가서, 이쪽 칸도 같이 닫아 줍니다 */
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && _cur === "notice") setTimeout(() => { if (_cur === "notice") 닫기(); }, 0); });

  const 기다림 = setInterval(() => {
    공지가로채기();
    if (만들기()) 자리맞추기();
  }, 1000);
  void 기다림;

  window.sideTabOpen = 열기;
  window.sideTabClose = () => 닫기();
})();

/* =====================================================================
   ⬅️ 왼쪽 사이드 바 — 📢 공지 · 🙋 멤버스 (2026-11-19 콩) — 지금은 혼자 방(?solo=1)에서만
   ---------------------------------------------------------------------
   [왜] 접속자가 스무 명이 넘으면 작은 화면에서는 카드가 다 안 보입니다.
        멤버스를 열면 **나 말고 접속자는 왼쪽 명단**으로 가고, 카드 마당에는 내 카드만 남습니다.
        (내가 화면 공유 중이면 공유 중인 사람의 카드·화공 카드도 남아요.) 닫으면 전원이 다시 보입니다.
   [어떻게]
     · 오른쪽 옆 탭과 거울 — 탭 줄은 화면 왼쪽 끝, 명단(250px)·공지(400px)는 탭 줄 오른쪽에 열립니다.
     · 📢 공지는 오른쪽 탭에서 **이사**합니다 (열고 닫는 법은 그대로 — 가운데 창을 CSS 로 왼쪽 칸에 앉힘).
     · 명단은 카드를 그리는 길(script_realtime.js renderUserCards)이 매번 넘겨 주는 window._cardRoster 를
       그대로 씁니다 — **서버에서 새로 읽는 것이 없어요(통신량 0)**.
     · 명단의 줄을 **더블클릭**하면 💘 하트 (script_heart.js 의 heartSend). 쪽지는 없습니다.
     · 시험: 주소 끝에 &fakemembers=25 (혼자 방 전용 — 가짜 접속자 25명).
   ===================================================================== */
(function () {
  if (typeof window.leftSide !== "function" || !window.leftSide()) return;

  const el = (id) => document.getElementById(id);
  const root = document.documentElement;
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(s) : String(s == null ? "" : s));
  const KEY = "leftTabOpen";
  const W_MEM = 250, W_NOTICE = 400;
  const TABS = [
    { id: "notice",  label: "📢 공지" },
    { id: "members", label: "🙋 Members" }
  ];
  let _cur = "";

  /* 상태 이름 — script_member.js 와 같은 표 */
  const LABEL = { idle: "☕BREAK☕", writing: "🔥WRITE🔥", focus: "💻JOB💻", multi: "💻multiT📓",
                  rest: "☕BREAK☕", away: "💤AWAY💤", repair: "🛠️REPAIR🛠️" };
  const CLS   = { idle: "status-rest", writing: "status-writing", focus: "status-focus", multi: "status-multi",
                  rest: "status-rest", away: "status-away", repair: "status-repair" };
  function whText(ms) {
    const m = Math.round(Math.max(0, Number(ms || 0)) / 60000);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}`;
  }

  /* ── 카드 마당에 남길 사람 — 멤버스가 열려 있을 때 내 카드 말고는 감춥니다 ── */
  const membersOn = () => _cur === "members";
  function keepNick(u) {
    /* 내가 화면 공유 중일 때만, 공유 중인 사람의 카드(와 그 옆 화공 카드)를 남깁니다 */
    try { if (window.isScreenSharing?.() || window.SOLO) return (window.shareNicks?.() || []).indexOf(u) >= 0; } catch (e) {}
    return false;
  }
  window.leftMembersHide = (u) => membersOn() && !keepNick(u);

  /* ── 명단 그리기 ── */
  let _lastHtml = "";
  function paint() {
    const host = el("left-pane-body");
    if (!host || !membersOn()) return;
    const me = (typeof myNick === "string" && myNick) ? myNick : (window.myNick || "");
    const rows = (window._cardRoster || []).filter(x => x.nick !== me);
    const li = rows.map(({ nick, row, prof }) => {
      const st = row.status || "idle";
      const photo = (window.photoShown || window.photoSrcOf) ? (window.photoShown || window.photoSrcOf)(prof || {}) : "";
      const ava = photo
        ? `<span class="member-ava lm-ava has-photo" data-avatar-of="${esc(nick)}"><img src="${esc(photo)}" alt="" loading="lazy"></span>`
        : `<span class="member-ava lm-ava has-snow" data-avatar-of="${esc(nick)}">${window.snowmanSvg?.(nick) || esc(String(nick).slice(0, 1))}</span>`;
      const sent = window.heartSentTo?.(nick) ? `<span class="lm-heart" title="오늘 하트를 보냈어요">❤️</span>` : "";
      return `<li class="member-row lm-row" data-lm-nick="${esc(nick)}" title="더블클릭 — 하트 보내기">
        ${ava}<span class="member-nick">${esc(nick)}</span>${sent}
        <span class="card-state ${CLS[st] || "status-rest"} member-state">${esc(row.statusLabel || LABEL[st] || "휴식")}</span>
        <span class="member-wh">⏱ ${whText(row.workMs)}</span></li>`;
    }).join("");
    const html = rows.length
      ? `<div class="member-body"><div class="member-head">나 말고 <b>${rows.length}명</b> 접속 중 <span class="member-when">더블클릭 = 💘</span></div><ul class="member-list">${li}</ul></div>`
      : `<div class="member-body"><div class="member-empty">지금은 나 혼자예요 🌙</div></div>`;
    if (html === _lastHtml) return;          // 같으면 건드리지 않습니다 (더블클릭 도중에 줄이 새로 태어나지 않게)
    _lastHtml = html;
    host.innerHTML = html;
  }
  window.leftRoster = paint;

  /* ── 만들기 ── */
  function build() {
    if (el("left-tabs")) return true;
    if (!document.body || !el("dock-bar")) return false;
    const box = document.createElement("aside");
    box.id = "left-tabs"; box.className = "left-tabs";
    box.innerHTML =
      `<div class="lside-pane" id="left-pane">
         <div class="side-pane-head"><b id="left-pane-title"></b>
           <button type="button" class="dock-x" id="left-pane-x" aria-label="닫기" title="닫기">✕</button></div>
         <div class="side-pane-body" id="left-pane-body"></div>
       </div>
       <div class="side-tabs-col left-tabs-col" id="left-tabs-col">` +
      TABS.map(t => `<button type="button" class="member-tab side-tab left-tab" id="left-tab-${t.id}" data-left="${t.id}"
          aria-expanded="false"><span>${t.label}</span><i class="side-tab-dot hidden" id="left-dot-${t.id}"></i></button>`).join("") +
      `</div>`;
    document.body.appendChild(box);
    root.classList.add("lefttabs-on");
    box.addEventListener("click", (e) => {
      const t = e.target.closest("[data-left]");
      if (t) { const id = t.dataset.left; if (_cur === id) close(); else open(id); return; }
      if (e.target.closest("#left-pane-x")) close();
    });
    /* 명단 줄 더블클릭 → 하트 (쪽지는 없습니다) */
    el("left-pane-body").addEventListener("dblclick", (e) => {
      const row = e.target.closest("[data-lm-nick]");
      if (!row) return;
      e.preventDefault();
      try { window.getSelection()?.removeAllRanges(); } catch (x) {}
      const nick = row.getAttribute("data-lm-nick");
      window.heartSend?.(nick, row);
      setTimeout(() => { _lastHtml = ""; paint(); }, 600);     // 보낸 줄에 ❤️ 표시
    });
    /* 📢 새 공지 붉은 점 — 알약의 점(#dock-dot-notice)을 탭에 비춥니다 */
    const src = el("dock-dot-notice"), dst = el("left-dot-notice");
    if (src && dst) {
      const 비추기 = () => dst.classList.toggle("hidden", src.classList.contains("hidden") || _cur === "notice");
      new MutationObserver(비추기).observe(src, { attributes: true, attributeFilter: ["class"] });
      비추기();
    }
    let 기억 = "";
    try { 기억 = window.AppStore?.getItem(KEY) || ""; } catch (e) {}
    if (기억 && TABS.some(t => t.id === 기억)) setTimeout(() => open(기억, true), 300);
    return true;
  }

  function place() {
    const box = el("left-tabs"), 마당 = document.querySelector(".cards-area");
    if (!box || !마당) return;
    const r = 마당.getBoundingClientRect();
    if (r.height < 40) return;
    const top = Math.round(r.top), h = Math.round(r.height);
    box.style.top = top + "px"; box.style.height = h + "px";
    root.style.setProperty("--lside-top", top + "px");
    root.style.setProperty("--lside-h", h + "px");
  }
  window.addEventListener("resize", place);

  function relayout() {
    try { window.relayoutCards?.(); } catch (e) {}
    setTimeout(() => { try { window.relayoutCards?.(); } catch (e) {} }, 280);
    setTimeout(() => { try { window.relayoutCards?.(); } catch (e) {} }, 800);
  }

  /* 📢 공지 여닫기 원본 — 채팅 머리말의 [📢 공지] 단추도 왼쪽 칸으로 옵니다 */
  let _nOpen = null, _nClose = null;
  function hookNotice() {
    if (_nOpen || typeof window.openNoticeBoard !== "function") return;
    _nOpen = window.openNoticeBoard; _nClose = window.closeNoticeBoard;
    window.openNoticeBoard  = () => open("notice");
    window.closeNoticeBoard = () => { if (_cur === "notice") close(); else _nClose?.(); };
  }

  function open(id, 처음) {
    const t = TABS.find(x => x.id === id);
    if (!t || !el("left-tabs")) return;
    if (_cur && _cur !== id) close(true);
    _cur = id;
    root.classList.add("left-open");
    el("left-pane-title").textContent = t.label;
    if (id === "notice") {
      root.classList.add("lside-notice");
      _nOpen?.();
    } else {
      root.classList.add("left-members");
      _lastHtml = "";
      paint();
      try { window.renderUserCards?.(); } catch (e) {}      // 카드 마당을 내 카드만으로 다시 그립니다
    }
    TABS.forEach(x => el("left-tab-" + x.id)?.setAttribute("aria-expanded", String(x.id === id)));
    el("left-dot-" + id)?.classList.add("hidden");
    if (!처음) { try { window.AppStore?.setItem(KEY, id); } catch (e) {} }
    place(); relayout();
  }

  function close(바꾸는중) {
    const id = _cur;
    if (!id) return;
    _cur = "";
    if (id === "notice") {
      _nClose?.();
      root.classList.remove("lside-notice");
    } else {
      root.classList.remove("left-members");
      el("left-pane-body").innerHTML = ""; _lastHtml = "";
      try { window.renderUserCards?.(); } catch (e) {}      // 접속자 전원이 다시 보입니다
    }
    el("left-tab-" + id)?.setAttribute("aria-expanded", "false");
    if (바꾸는중) return;
    root.classList.remove("left-open");
    try { window.AppStore?.setItem(KEY, ""); } catch (e) {}
    relayout();
  }

  /* Esc — 공지 쪽 손가락은 창만 감추고 가서, 이쪽 칸도 같이 닫아 줍니다 */
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && _cur === "notice") setTimeout(() => { if (_cur === "notice") close(); }, 0); });

  /* 화면 공유를 켜고 끄면 "남길 사람"이 달라지니 카드를 다시 그립니다 (값 하나 비교 — 서버 읽기 없음) */
  let _sh = "";
  setInterval(() => {
    hookNotice();
    if (build()) place();
    if (!membersOn()) return;
    const now = (window.isScreenSharing?.() ? "1" : "0") + (window.shareNicks?.() || []).join(",");
    if (now !== _sh) { _sh = now; try { window.renderUserCards?.(); } catch (e) {} }
  }, 1000);

  window.leftTabOpen = open;
  window.leftTabClose = () => close();
})();
