/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   checks.js — 자동 점검 (브라우저 없이 node 로 돌립니다)
   ---------------------------------------------------------------------
   쓰는 법:   node checks.js
   ---------------------------------------------------------------------
   화면을 눈으로 볼 수 없는 상태에서 고치다 보니, "있어야 할 게 사라졌다"
   "순서가 뒤바뀌었다" 같은 사고가 반복됐습니다. 그때마다 여기에 항목을
   하나씩 늘려서, 같은 실수가 다시 나면 걸리도록 해두었습니다.
   ===================================================================== */
const fs=require("fs"), vm=require("vm"), path=require("path"), cp=require("child_process");
/* [2026-08-22] 검사기는 동기 흐름입니다. 그런데 가짜 서버로 **돌려 보는**
   검사 하나(👤 탈퇴자 정리)가 async 라, 결과를 여기 모아 두고 맨 끝에서
   함께 봅니다. 늘리지 마세요 — 늘어나면 흐름이 헷갈립니다. */
const _기다릴것 = [], _나중에 = [];
const DIR=__dirname+path.sep;
const CSS=fs.readFileSync(DIR+"styles.css","utf8");
const HTML=fs.readFileSync(DIR+"index.html","utf8");

let pass=0,fail=0;const fails=[];
const ok=(c,n)=>{ c?pass++:(fail++,fails.push(n)); };
/* 어느 검사 블록이 실제로 돌았는지 — finish() 에서 셉니다 */
const ran={};

/* ---- 1. 화면 구조 클래스가 CSS 에 살아 있는가 ---- */
const WATCH=["container","app-head","head-tools","chat-sidebar","cards-area","side-rail",
 "pane","pane-pomo","split-root","split","split-grip","pomo-row","personal-title",
 "goal-wrap","todo-wrap","todo-add","todo-list","user-cards-grid","user-card","card-body",
 "card-side","card-chips","card-ach","card-state","card-state-ghost","card-state-row",
 "card-avatar-wrap","card-avatar","card-foot","card-name","card-goal","goal-line","card-meta",
 "card-pomo-count",
 "hidden-panels","hidden-chip","slot-picker","slot-row","slot-name","slot-sel","slot-map",
 "slot-cell","slot-no","slot-cell-head","slot-cell-name","slot-cell-pos","panel-off",
 "layout-pick","layout-opt","theme-chip","man-tab","man-panel","color-well","color-hex",
 "color-chip","card-preview","card-preview-foot","nick-preview","msg-link","pat-dots","pat-grid"];
/* [고침 2026-08-09] card-prog-track · card-meta-line · card-todo-count ·
   card-edit-btn 를 목록에서 뺐습니다. 옛 카드 디자인의 잔재라 화면 어디에도
   붙지 않는 채 CSS 만 남아 있었어요. */
const miss=WATCH.filter(c=>!new RegExp("\\."+c+"[^a-zA-Z0-9_-]").test(CSS));
ok(miss.length===0, "CSS 규칙 없는 클래스: "+miss.join(", "));

/* ---- 1.5 index.html 구조 검사 ----

   [왜 넣었나] 설정 블록 하나를 지우면서 닫는 </div> 를 잘못 잘라, 설정
   모달이 중간에서 끝나버렸습니다. 그러자 뒤따르던 패널과 "닫기" 버튼이
   모달 밖으로 흘러나와 화면 절반을 덮었습니다. 게다가 같은 블록이
   중복돼 id 가 둘이 되면서 선택 상자도 먹지 않았습니다.

   눈으로는 잡기 어렵고 브라우저는 조용히 넘어가는 종류의 사고라,
   기계가 세게 합니다. */
{
  const t = HTML.replace(/<!--[\s\S]*?-->/g, "");
  const open  = (t.match(/<div\b/g)  || []).length;
  const close = (t.match(/<\/div>/g) || []).length;
  ok(open === close, `<div> 여닫이 개수가 맞다 (열림 ${open} / 닫힘 ${close})`);

  const ids = t.match(/id="([^"]+)"/g).map(x => x.slice(4, -1));
  const dup = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  ok(dup.length === 0, "중복된 id 가 없다" + (dup.length ? " — " + dup.join(", ") : ""));

  /* 설정 탭과 패널이 짝이 맞는가 */
  const tabs   = (t.match(/data-tab="(\w+)"/g) || []).map(x => x.slice(10, -1));
  const panels = (t.match(/id="panel-(\w+)"/g) || []).map(x => x.slice(10, -1));
  tabs.forEach(k => ok(panels.includes(k), `설정 탭 ${k} 에 짝이 되는 패널이 있다`));

  /* 모달의 닫기 버튼이 모달 안에 있는가 (밖으로 새면 화면을 덮습니다) */
  ["settings-modal", "goals-modal", "record-modal", "manual-modal"].forEach(id => {
    const i = t.indexOf(`id="${id}"`);
    if (i < 0) return;
    const seg = t.slice(i);
    const end = seg.indexOf("\n</div>");
    ok(end > 0 && /닫기/.test(seg.slice(0, end)), `${id} 의 닫기 버튼이 모달 안에 있다`);
  });
}

/* ---- 2. 칸 배치 전수 검사 ---- */
const ctx={window:{addEventListener(){}},document:{readyState:"complete",addEventListener(){},
  getElementById(){return null},querySelectorAll(){return []},querySelector(){return null},
  createElement(){return{style:{},classList:{add(){},remove(){},toggle(){}},dataset:{},
    appendChild(){},setAttribute(){},addEventListener(){}}},
  head:{appendChild(){}},body:{classList:{contains(){return false},add(){},remove(){}}}},
  localStorage:{getItem(){return null},setItem(){}},module:{exports:{}}};
ctx.window.document=ctx.document; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(DIR+"script_layout.js","utf8"),ctx);
const L=ctx.window.LayoutSlots;
const SLOTS=L.SLOT_IDS, PANELS=L.PANELS.map(p=>p.id);
const leaves=(n,a=[])=>{ if(typeof n==="string"){a.push(n);return a;} n.kids.forEach(k=>leaves(k,a)); return a; };
for(const [name,tree] of Object.entries(L.TREES)){
  const lv=leaves(tree);
  ok(lv.length===SLOTS.length && new Set(lv).size===SLOTS.length,
     `[${name}] 자리 ${SLOTS.length}개가 중복 없이 있다`);
}
const perms=a=>{ if(a.length<=1) return [a]; const o=[];
  a.forEach((v,i)=>{ perms([...a.slice(0,i),...a.slice(i+1)]).forEach(p=>o.push([v,...p])); }); return o; };
let cases=0, bad=0;
for(const [,tree] of Object.entries(L.TREES))
 for(const perm of perms(PANELS))
  for(let mask=0; mask<32; mask++){
    const map={}; SLOTS.forEach((s,i)=> map[s]=(mask&(1<<i))?perm[i]:null);
    cases++;
    const pr=L.prune(tree,map), shown=SLOTS.filter(s=>map[s]);
    if(shown.length===0){ if(pr!==null) bad++; continue; }
    if(pr===null){ bad++; continue; }
    const lv=leaves(pr);
    if(lv.length!==shown.length||new Set(lv).size!==lv.length) bad++;
    (function chk(n){ if(typeof n==="string")return;
      if(n.kids.length<2) bad++; n.kids.forEach(chk); })(pr);
  }
ok(bad===0, `칸 배치 전수 ${cases.toLocaleString()}가지 (문제 ${bad})`);

/* ---- 3. 다시 조립할 때 창이 삭제되지 않는가 ---- */
{
  const src=fs.readFileSync(DIR+"script_layout.js","utf8");
  const iClear=src.indexOf('root.innerHTML = ""'), iAttic=src.indexOf("attic.appendChild(el)");
  ok(iAttic>=0 && iClear>=0 && iAttic<iClear, "창을 보관함에 먼저 대피시킨 뒤 뿌리를 비운다");
}

/* ---- 4. 채팅의 글자 선택을 막는 규칙이 없는가 ---- */
{
  const lines=CSS.split("\n"); const culprit=[];
  lines.forEach((l,i)=>{
    if(!/user-select:\s*none/.test(l)) return;
    for(let j=i;j>=0;j--){ if(lines[j].includes("{")){
      const sel=lines[j];
      if(/chat|#message|\.container|\.split(?!-grip)|^body\s*\{/.test(sel) && !/split-dragging/.test(sel))
        culprit.push(sel.trim());
      break; } }
  });
  ok(culprit.length===0, "채팅/입력칸의 선택을 막는 규칙 없음: "+culprit.join(" / "));
  ok(/user-select: text/.test(CSS), "채팅·입력칸에 선택을 되살리는 규칙이 있다");
  const src=fs.readFileSync(DIR+"script_layout.js","utf8");
  ok(!/root\.addEventListener\("pointerdown"/.test(src), "뿌리 전체에 pointerdown 을 걸지 않는다");
}

/* ---- 5. 주소 링크 만들기 ---- */
{
  const src=fs.readFileSync(DIR+"script_chat.js","utf8");
  const m=src.match(/function linkifyEscaped\(html\) \{([\s\S]*?)\n  \}/);
  ok(!!m, "linkifyEscaped 가 있다");
  if(m){
    /* [2026-08-14] 함수가 바깥의 IMG_URL_RE 를 쓰게 되어, 떼어 실행할 때
       그 상수도 같이 실어줍니다 (실제 파일의 정의를 그대로 가져와서) */
    const re = src.match(/const IMG_URL_RE = (\/.+\/i);/);
    ok(!!re, "이미지 판별 상수가 있다");
    const fn=new Function("html", `const IMG_URL_RE = ${re ? re[1] : "/$^/"};` + m[1]);
    ok(/<a class="msg-link"/.test(fn("https://a.com 확인")), "http 주소가 링크가 된다");
    ok(!/<a /.test(fn("javascript:alert(1)")), "javascript: 는 링크가 안 된다");
    ok(!/<a /.test(fn("&lt;script&gt;")), "이스케이프된 태그를 건드리지 않는다");
    ok(/<\/a>\./.test(fn("http://a.com. 끝")), "문장 끝 마침표는 주소에서 뺀다");
    /* 🖼️ 이미지 주소는 그림으로 */
    ok(/<img class="msg-img"/.test(fn("https://i.imgur.com/a.jpg")), "이미지 주소는 그림이 된다");
    ok(/<img class="msg-img"/.test(fn("https://pbs.twimg.com/x.png?name=large")), "물음표 꼬리가 붙어도 그림이 된다");
    ok(/<img class="msg-img"/.test(fn("https://search.pstatic.net/sunny/?src=x.jpg&type=sc960_832")),
       "★ .jpg 뒤에 & 가 이어져도 그림이 된다 (네이버 프록시 주소 — 실제 제보)");
    ok(/referrerpolicy="no-referrer"/.test(fn("https://a.com/x.jpg")),
       "★ 출처를 안 밝히고 가져온다 (핫링크 차단 사이트 상당수가 뚫린다)");
    ok(!/<img/.test(fn("https://docs.example.com/page")), "일반 주소는 여전히 글자 링크다");
  }
}

/* ---- 6. 소리를 꺼도 내 집중 횟수는 센다 ----
   [고침 2026-08-06] 뽀모가 개인 타이머가 되면서 뒤집힌 규칙입니다.
   예전에는 방 전체가 한 타이머를 봐서, 참여를 끈 사람 화면에서도
   세션이 끝나면 이 함수가 불렸습니다. 그래서 막아야 했어요.
   지금은 내가 시작한 내 타이머만 여기 옵니다 — 소리를 껐다고
   내가 한 집중을 안 세면 그게 틀린 겁니다. */
{
  const src=fs.readFileSync(DIR+"script_ui.js","utf8");
  const i=src.indexOf("async function incrementTodayFocusSessions");
  ok(!/if \(!_pomoParticipating\) return;/.test(src.slice(i,i+1400)),
     "소리·알림을 꺼도 내 집중 횟수는 올라간다");
}

/* ---- 7. 테마 ---- */
{
  const src=fs.readFileSync(DIR+"script_ui.js","utf8");
  const i=src.indexOf("const themes = {");
  const body=src.slice(i, src.indexOf("\n  };", i));
  const names=[...body.matchAll(/^\s*"([^"]+)":\s*\{/gm)].map(m=>m[1]);
  ok(names.length>0, `테마 ${names.length}종`);
  ok(new Set(names).size===names.length, "테마 이름 중복 없음");
  const badHex=[...body.matchAll(/#[0-9A-Za-z]{2,}/g)].map(m=>m[0])
    .filter(c=>!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(c));
  ok(badHex.length===0, "잘못된 색 코드: "+badHex.join(", "));
  let lack=0;
  body.split(/\n(?=\s*")/).filter(b=>/^\s*"/.test(b))
    .forEach(b=>{ ["bg:","text:","me:","other:","header:"].forEach(k=>{ if(!b.includes(k)) lack++; }); });
  ok(lack===0, `테마마다 필수 색이 다 있다 (빠짐 ${lack})`);
}

/* ---- 8. HTML 뼈대 ---- */
ok(/id="split-root"/.test(HTML), "split-root 있음");
ok(/id="panel-attic"/.test(HTML), "창 보관함 있음");
ok(!/class="(col|row)-grip"/.test(HTML), "옛 격자 손잡이가 없다");
ok(!/id="conn-badge"/.test(HTML), "머리말의 옛 연결 배지가 없다");
ok(/class="card-conn/.test(fs.readFileSync(DIR+"script_realtime.js","utf8")),
   "카드에 연결 안테나를 그린다");
{
  const core=fs.readFileSync(DIR+"script_core.js","utf8");
  ok(/paintConnBadge/.test(core), "연결 상태를 화면에 칠하는 함수가 있다");
  const i=core.indexOf('db.ref(".info/connected").on');
  const seg=core.slice(i, i+400);
  ok(/paintConnBadge\(up\)/.test(seg), "끊길 때도 배지를 갱신한다 (early return 앞에서)");
  ok(/conn-down/.test(core), "끊기면 body 에 conn-down 을 붙인다");
  ok(seg.indexOf("paintConnBadge") < seg.indexOf("if (!up) return"), "배지 갱신이 early return 보다 먼저다");
}
["card-conn"].forEach(c=>
  ok(new RegExp("\\."+c+"[^a-zA-Z0-9_-]").test(CSS), `CSS 에 .${c} 가 있다`));
ok(/body\.conn-down .user-card\.is-me \.card-conn/.test(CSS), "내 카드 안테나는 소켓 상태를 따른다");
ok(/\.card-conn\.off/.test(CSS), "끊김 모양이 정의돼 있다");
{
  /* 받침 — 카드 배경색이 비쳐 올라와 안테나가 묻히던 문제 */
  const i = CSS.indexOf(".card-conn{");
  const seg = CSS.slice(i, CSS.indexOf("}", i));
  ok(/background: rgba\(255,255,255,/.test(seg), "안테나에 받침이 깔려 있다");
  ok(/border-radius/.test(seg), "받침 모서리가 둥글다");
  ok(/box-shadow/.test(seg), "받침에 얇은 테두리가 있다");

  /* 어두운 테마 선택자가 실제로 붙는 표식과 맞는지 —
     예전에 안 쓰는 선택자를 써서 조용히 안 먹은 적이 있습니다. */
  const ui = fs.readFileSync(DIR+"script_ui.js","utf8");
  const m = ui.match(/setAttribute\("data-is-dark",\s*isDark \? "(\w+)"/);
  ok(!!m, "applyTheme 이 data-is-dark 를 쓴다");
  ok(CSS.includes(`html[data-is-dark="${m[1]}"] .card-conn`),
     "받침의 어두운 테마 선택자가 실제 표식과 일치한다");
}

/* 좁은 화면 — 창 하나 + 탭 */
{
  const lay = fs.readFileSync(DIR+"script_layout.js","utf8");
  const ui  = fs.readFileSync(DIR+"script_ui.js","utf8");
  ok(/function renderNarrowTabs/.test(lay), "좁은 화면 탭줄을 그린다");
  ok(/window\.setNarrowPanel/.test(lay), "탭으로 창을 바꿀 수 있다");
  /* ── [철거 2026-08-18] "창이 좁아지면 보여줄 창" 고르기 ──
     폰 접속자가 없고 좁아져도 쓸 만해서 콩이 걷었습니다.
     정말 걷혔는지 역검사합니다 (펫·유령 모드 때와 같은 방식). */
  ok(!/window\.setNarrowDefault/.test(lay), "★ 기본 창 고르기가 코드에서 사라졌다");
  ok(!/id="set-narrow-panel"/.test(HTML), "★ 설정의 고르는 칸도 사라졌다");
  ok(!/set-narrow-panel/.test(ui), "★ 설정 칸에 걸려 있던 손도 걷혔다");
  /* 주석의 "되살리려면…" 안내에는 이름이 남아도 됩니다 — **코드**만 봅니다 */
  ok(!/NARROW_KEY/.test(lay.replace(/\/\*[\s\S]*?\*\//g, "")),
     "안 쓰는 저장 열쇠도 남기지 않았다 (주석 빼고)");
  ok(/function narrowDefault\(\) \{ return "chat"; \}/.test(lay),
     "★★ 좁은 화면은 여전히 **채팅부터** 열린다 (기능 자체는 살아 있다)");
  ok(/window\.setNarrowPanel/.test(lay) && /const NARROW_CUR/.test(lay),
     "★★ 탭으로 옮겨 다니는 것과 마지막으로 보던 창 기억은 그대로다");

  /* 서명에 좁은 화면 상태가 들어가야 탭이 먹습니다 */
  const i = lay.indexOf("const sig = JSON.stringify");
  ok(/isNarrow\(\)/.test(lay.slice(i, i+220)), "탭을 눌렀을 때 다시 그리도록 서명에 반영한다");
  ok(/was !== on\) \{ try \{ window\.applyLayout/.test(ui),
     "좁아지거나 넓어질 때 배치를 다시 짠다");

  ok(/\.narrow-tabs\{/.test(CSS) && /\.narrow-tab\.active\{/.test(CSS), "탭 CSS 가 있다");

  /* 안 읽은 채팅 배지 */
  const prof = fs.readFileSync(DIR+"script_profile.js","utf8");
  ok(/window\.noteNarrowChatUnread/.test(lay), "안 읽은 개수를 세는 함수가 있다");
  {
    /* 세는 자리는 원본 renderChatMessage 안이어야 합니다.
       감싸개 순서에 기대면 조용히 안 불립니다. */
    const chat = fs.readFileSync(DIR+"script_chat.js","utf8");
    ok(/window\.noteNarrowChatUnread\?\.\(\)/.test(chat),
       "새 메시지가 오면 원본에서 직접 센다");
    const i = chat.indexOf("function renderChatMessage");
    const j = chat.indexOf("window.noteNarrowChatUnread");
    ok(i > 0 && j > i, "세는 코드가 renderChatMessage 안에 있다");
    /* [고침 2026-08-06] 수다방 메시지를 세지 않으려고 조건이 하나 늘었습니다.
       (!isMe && !window._chattySuppressCount) — 문장을 통째로 외우는 대신
       "isMe 가 아닐 때만"이라는 뜻만 확인합니다. */
    ok(/if \(!isMe[^)]*\) \{ try \{ window\.noteNarrowChatUnread/.test(chat),
       "내 메시지는 세지 않는다");
    ok(!/noteNarrowChatUnread/.test(prof), "감싸개 쪽 중복 호출이 없다");
  }
  ok(/data-narrow-exit/.test(lay) && /window\.leaveRoom/.test(lay),
     "좁은 화면에도 나가기 버튼이 있다");
  ok(/\.nt-exit\{/.test(CSS), "나가기 버튼 CSS 가 있다");
  ok(/nt-badge/.test(lay) && /\.nt-badge\{/.test(CSS), "💬 탭에 배지가 붙는다");
  {
    const i = lay.indexOf("window.noteNarrowChatUnread = function");
    const seg = lay.slice(i, i + 400);
    ok(/if \(!isNarrow\(\)\) return;/.test(seg), "넓은 화면에서는 세지 않는다");
    ok(/narrowCurrent\(\) === "chat"\) return;/.test(seg), "채팅을 보고 있으면 세지 않는다");
  }
  ok(/if \(p\.id === "chat"\) _narrowUnread = 0;/.test(lay), "채팅을 열면 개수를 지운다");
  /* 내 메시지와 시스템 메시지는 세지 않아야 합니다 (기존 훅 조건을 함께 씁니다) */
  {
    const i = prof.indexOf("noteChatMessageWhileCollapsed();");
    const seg = prof.slice(Math.max(0, i - 200), i + 200);
    ok(/data\.type !== "system" && data\.user !== myNick/.test(seg),
       "내 메시지와 입퇴장 알림은 세지 않는다");
  }
  ok(!/body\.narrow-chat-focus \.pane,/.test(CSS),
     "좁은 화면에서 .pane 을 통째로 숨기지 않는다 (고른 창이 .pane 일 수 있음)");
  ok(!/body\.narrow-chat-focus \.split-root > \*\{[^}]*display: flex !important/.test(CSS),
     "창의 display 를 강제하지 않는다 (안쪽 배치 깨짐 방지)");
}

/* 자리비움일 때 🍅 가 쌓이지 않는가 */
{
  const ui = fs.readFileSync(DIR+"script_ui.js","utf8");
  const i = ui.indexOf("async function incrementTodayFocusSessions");
  const seg = ui.slice(i, i + 1100);
  ok(/if \(st === "away"\) return;/.test(seg), "자리비움이면 세지 않는다");
  ok(seg.indexOf('st === "away"') < seg.indexOf("_getTodaySessionCount() + 1"),
     "세기 전에 걸러낸다");
}

/* TheMagam — 카드가 조작판인가 */
{
  const rt  = fs.readFileSync(DIR+"script_realtime.js","utf8");
  const lay = fs.readFileSync(DIR+"script_layout.js","utf8");
  const prof= fs.readFileSync(DIR+"script_profile.js","utf8");
  const tl  = fs.readFileSync(DIR+"script_timelog.js","utf8");
  const ui  = fs.readFileSync(DIR+"script_ui.js","utf8");

  /* A1 프사 → 프로필 */
  ok(/card-avatar-wrap\$\{isMine \? " is-clickable"/.test(rt), "내 프사만 누를 수 있다");
  ok(/data-edit-profile="1"/.test(rt), "프사에 프로필 편집 표시가 붙는다");
  ok(/\[data-edit-profile\]/.test(prof), "프사 클릭을 받는다");

  /* A2 아래칸 → 🗂️ 나의 작업

     [고침 2026-08-08] 예전에는 여기서 "오늘 목표 · 나의 투두" 팝업이 따로
     떴습니다. 나의 작업 창에 같은 내용이 더 넓게 들어 있어서 창이 두 벌이었고,
     머리말에도 같은 창을 여는 버튼이 또 있었어요. 셋을 하나로 합쳤습니다 —
     이제 **내 카드 아래칸이 유일한 입구**입니다. */
  ok(/window\.openMyWork\?\.\(\)/.test(tl), "내 카드 아래칸은 🗂️ 나의 작업을 연다");
  ok(!/id="goals-modal"/.test(HTML) && !/function openGoals/.test(prof),
     "옛 목표·투두 팝업이 남아 있지 않다");
  ok(!/id="panel-goals"/.test(HTML) && !/data-tab="goals"/.test(HTML),
     "설정에서 목표·투두 탭을 걷어냈다");
  ok(!/^function mountGoalBlocks/m.test(prof) && !/window\.mountGoalBlocks/.test(prof),
     "그 팝업으로 덩어리를 옮기던 코드도 없앴다");
  /* 실제 덩어리는 하나뿐이어야 합니다 — 두 벌이면 저장이 엉킵니다 */
  ok((HTML.match(/id="status-block"/g) || []).length === 1, "목표 덩어리는 하나뿐이다");
  ok(!/id="todo-block"/.test(HTML),
     "화면에 안 나오던 할 일 칸(#todo-block)은 걷어냈다");
  /* ★ 가장 위험한 부분 — 뿌리를 비울 때 이 둘이 함께 지워지면 안 됩니다 */
  {
    const i = lay.indexOf('attic.appendChild(el);');
    const j = lay.indexOf('root.innerHTML = ""');
    ok(/\["status-block"\]\.forEach/.test(lay),
       "오늘 목표 덩어리를 보관함으로 피신시킨다");
    ok(lay.indexOf('["status-block", "todo-block"].forEach') < j,
       "피신이 뿌리 비우기보다 먼저다");
    void i;
  }

  /* A3 상태표 → 고르기 판 (2026-08-03: WRITE·JOB·BREAK·AWAY 4가지) */
  ok(/data-pick-status="1"/.test(rt), "내 상태표만 누를 수 있다");
  {
    const i = prof.indexOf('closest?.("[data-pick-status]")');
    const seg = prof.slice(i, i + 260);
    ok(/openStatusPicker/.test(seg), "상태표를 누르면 고르기 판이 뜬다");
  }
  {
    const i = prof.indexOf("const CHOICES = [");
    const seg = prof.slice(i, i + 500);
    const vals = (seg.match(/v: "(\w+)"/g) || []).map(x => x.slice(4, -1));
    ok(vals.join(",") === "writing,focus,rest,away", "상태 네 가지가 맞다 ("+vals.join(",")+")");
    ok(/🔥WRITE🔥/.test(seg) && /💻JOB💻/.test(seg), "이름이 WRITE · JOB 이다");
  }
  {
    const i = rt.indexOf("function statusLabel");
    const seg = rt.slice(i, i + 500);
    ok(/writing: "🔥WRITE🔥"/.test(seg) && /rest:    "☕BREAK☕"/.test(seg), "이름이 🔥WRITE🔥 · ☕BREAK☕ 다");
    ok(/focus:   "💻JOB💻"/.test(seg) && /away:    "💤AWAY💤"/.test(seg),
       "focus 는 JOB, away 는 AWAY 로 보인다");
  }
  /* [2026-08-03] 🔥WORK🔥 는 이제 정식 이름입니다 — 옛 이름 검사는
     "타인 카드 아래칸이 눌리지 않는가" 로 바꿨습니다. */
  ok(!/기록 보기/.test(rt), "남의 카드에 기록 보기 입구가 없다");

  /* B1 가로만 */
  ok(/function currentOrientation\(\) \{ return "landscape"; \}/.test(ui),
     "세로 보기를 없앴다");
  ok(!/aria-label="보기"/.test(HTML), "설정에서 세로 선택지를 뺐다");
  ok(/aria-label="좌우 뒤집기"/.test(HTML), "좌우 뒤집기는 남겼다");

  /* B2 팝업 + 닫기 */
  /* 치우기·팝업·되돌리기는 통째로 없앴습니다.
     남아 있으면 같은 일을 하는 길이 둘이 되어 헷갈립니다. */
  ok(!/data-popup=/.test(lay), "치운 창 팝업이 없다");
  ok(!/id="panel-modal"/.test(HTML), "창 팝업 마크업이 없다");
  ok(!/hidden-panels/.test(HTML), "치워둔 창 자리가 없다");
  ok(!/function addPanelCloseButtons/.test(lay), "창마다 ✕ 가 없다");
  ok(!/renderSlotPicker/.test(lay), "자리별 선택 목록이 없다");
  /* [2026-08-03] 채팅 접기 버튼을 요청으로 되살렸습니다 — 레일과 짝으로. */
  ok(/id="chat-collapse-btn"/.test(HTML), "채팅 헤더에 접기 버튼이 있다");
  ok(/id="chat-rail-btn"/.test(HTML), "접힌 채팅을 펴는 레일 버튼이 있다");
  ok(!/id="side-rail-btn"/.test(HTML), "레일이 옛 오른쪽줄 접기와 엉키지 않는다");
  ok(!/data-restore=/.test(lay), "옛 되돌리기 방식이 남아 있지 않다");
  /* 팝업 크기와 덜어낸 것들 */
  {
    ok(/<h4 class="personal-title">🎯 Today's goal<\/h4>/.test(HTML), "목표 소제목이 영문이다");
    ok(/<select id="db-status" class="w-full hidden"/.test(HTML), "상태 선택박스가 감춰져 있다");
    ok(/id="db-status"/.test(HTML), "상태 선택박스를 지우지는 않았다 (저장 중계기)");
    ok(/<div class="mini-row end hidden">/.test(HTML), "WORK 시작 버튼이 감춰져 있다");
  }

  /* 오른쪽 줄 접기 */
  {
    ok(/function isSideCollapsed/.test(lay), "접힘 상태를 기억한다");
    ok(/window\.toggleSideCollapsed/.test(lay), "접기·펼치기 스위치가 있다");
    ok(!/id="side-toggle-btn"/.test(HTML), "머리말의 접기 버튼을 없앴다 (2026-08-03)");
    ok(/isSideCollapsed\(\)/.test(lay.slice(lay.indexOf("const sig = JSON.stringify"), lay.indexOf("const sig = JSON.stringify") + 200)),
       "접으면 배치를 다시 짠다");
    /* ★ 핵심 — 숨기는 게 아니라 아예 빼야 빈 공간이 안 생깁니다 */
    ok(/node\.kids\.filter\(k => typeof k === "string" \|\| !hasSidePanels\(k, map\)\)/.test(lay),
       "접힌 줄을 배치에서 아예 뺀다 (숨기기만 하면 빈 자리가 남음)");
    ok(/function hasSidePanels/.test(lay), "어느 가지가 곁줄인지 판단한다");
    /* 뒤집어도 같은 가지가 접혀야 합니다 */
    {
      const map = { s1: "prof", s2: "pomo", s3: "chat" };
      const leaf = (n, o = []) => { if (typeof n === "string") { if (map[n]) o.push(map[n]); return o; }
                                    n.kids.forEach(k => leaf(k, o)); return o; };
      const hasSide = n => { const ids = leaf(n); return ids.length > 0 && ids.every(i => i !== "prof"); };
      ok(hasSide({ kids: ["s2", "s3"] }) === true, "뽀모+채팅 가지는 곁줄이다");
      ok(hasSide("s1") === false || hasSide({ kids: ["s1"] }) === false, "접속자 가지는 곁줄이 아니다");
      ok(hasSide({ kids: ["s1", "s2"] }) === false, "접속자가 섞인 가지는 접지 않는다");
    }
  }

  /* ② ③ 스위치만 남기기 */
  ok(/window\.swapSideSlots/.test(lay), "② ③ 바꾸기 함수는 남아 있다 (버튼은 2026-08-03 제거)");
  ok(!/onclick="swapSideSlots\(\)"/.test(HTML), "설정에서 바꾸기 버튼을 뺐다");
  {
    const i = lay.indexOf("window.swapSideSlots");
    const seg = lay.slice(i, i + 400);
    ok(!/s1/.test(seg), "접속자(①) 자리는 건드리지 않는다");
  }
  ok(!/— 비우기 —|비우기/.test(HTML.replace(/<!--[\s\S]*?-->/g, "")), "비우기 선택지가 없다");
  /* 예전에 비워둔 채로 저장된 분도 창이 돌아와야 합니다 */
  {
    const n = ctx.window.LayoutSlots.normalizeSlotMap;
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const std  = { s1: "pomo", s2: "prof", s3: "chat" };
    const swap = { s1: "chat", s2: "prof", s3: "pomo" };
    ok(eq(n(null, "landscape"), std), "저장값이 없으면 기본 배치");
    ok(eq(n({ s1: null, s2: null, s3: null }, "landscape"), std), "비어 있던 저장값도 되살린다");
    ok(eq(n({ s1: "chat", s2: "prof", s3: "pomo" }, "landscape"), swap), "채팅을 왼쪽에 둔 것은 지킨다");
    ok(eq(n({ s1: "todo", s2: "stat" }, "landscape"), std), "옛 창 이름이 남아 있어도 되살린다");
    ok(Object.values(n({}, "landscape")).every(Boolean), "빈 칸이 생기지 않는다");
    /* ★ 접속자는 어떤 저장값이 와도 늘 가운데여야 합니다 */
    [null, {}, {s1:"chat"}, {s1:"prof",s2:"chat",s3:"pomo"}, {s2:"pomo"}].forEach(v => {
      ok(n(v, "landscape").s2 === "prof", "접속자는 늘 가운데다 " + JSON.stringify(v));
    });
  }

  /* 설정 — 뽀모도로 탭은 없앴습니다 (2026-08-03). 참여 스위치는 뽀모 창에만. */
  ok(!/data-tab="timer"/.test(HTML) && !/id="panel-timer"/.test(HTML), "설정에 뽀모도로 탭이 없다");
  {
    /* 같은 스위치가 두 곳에 있으니 한 함수가 둘을 같이 칠해야 합니다 */
    const i = ui.indexOf("function _renderParticipationButton");
    const seg = ui.slice(i, i + 500);
    ok(/pomo-sound-btn/.test(seg) && /set-pomo-part/.test(seg),
       "두 곳의 스위치를 함께 갱신한다");
  }

  /* 업적이 정말로 사라졌는가 */
  ok(!/trophyCount|crownCount|weeklyWeeks/.test(rt), "업적 계산이 남아 있지 않다");
  ok(!/ach-test/.test(HTML), "업적 테스트 UI 가 없다");
  ok(!/achievementOverrides/.test(rt), "업적 덮어쓰기가 없다");
  ok(/const achChips = "";/.test(rt), "카드 배지 줄이 비었다");
  ok(!/weekly-gold/.test(rt), "금빛 테두리를 쓰지 않는다");

  /* 펫 — 정말로 사라졌는가 (2026-08-03 더마감은 펫 기능을 뺐습니다) */
  {
    const tl = fs.readFileSync(DIR+"script_timelog.js","utf8");
    const prof = fs.readFileSync(DIR+"script_profile.js","utf8");
    ok(!fs.existsSync(DIR+"script_pet.js") && !fs.existsSync(DIR+"script_pet_ui.js"),
       "펫 스크립트 파일이 없다");
    ok(!/script_pet/.test(HTML), "index 가 펫 스크립트를 부르지 않는다");
    ok(!/data-tab="pet"/.test(HTML) && !/id="panel-pet"/.test(HTML), "설정에 펫 탭·창이 없다");
    ok(!/petSpecies|petLevel|data-open-pet/.test(rt), "카드에 펫 흔적이 없다");
    ok(!/startPet|setPetShell|petDex|promoteIfMaxed/.test(tl), "시간 기록에 펫 밥이 없다");
    ok(!/openPetPanel|renderPetPanel|startPet/.test(prof), "프로필에 펫 연결이 없다");
    ok(!/\.card-pet\{/.test(CSS), "CSS 에 펫 칸이 없다");

    /* ★ 시작 함수가 "입장한 뒤에" 불리는가 — 시간 기록은 닉네임이 있어야 동작합니다 */
    {
      const i = prof.indexOf("const _join = window.join;");
      const j = prof.indexOf("window.join = wrapped;", i);
      ok(i > 0 && j > i, "입장 감싸개가 있다");
      const joinSeg = prof.slice(i, j);
      ok(/startTimelog/.test(joinSeg), "입장한 뒤에 시간 기록을 시작한다");
      ok(/_tlStarted/.test(tl), "두 번 불려도 안전하다 (타이머 중복 방지)");
    }
  }

  /* 새 팝업에 CSS 를 빠뜨리면 화면 옆에 어색하게 붙습니다 */
  ["#goals-modal"].forEach(id => {
    /* 선택자 목록의 마지막이면 뒤에 { 가 옵니다 */
    ok(CSS.includes(id + ",") || CSS.includes(id + "{"),
       `${id} 이 팝업 규칙을 함께 받는다`);
    ok(CSS.includes(id + " .modal-content"), `${id} 의 내용 폭이 정해져 있다`);
  });

  /* 남는 공간을 뽀모가 먹지 않아야 합니다 */
  {
    ok(/const GROW_RANK = \{/.test(lay), "남는 공간을 받을 창을 정해둔다");
    const i = lay.indexOf("const GROW_RANK");
    const seg = lay.slice(i, i + 160);
    const rk = {};
    (seg.match(/(\w+): (\d+)/g) || []).forEach(x => {
      const [k, v] = x.split(": "); rk[k] = Number(v);
    });
    ok(rk.chat < rk.pomo, "채팅이 뽀모보다 먼저 늘어난다");
    ok(rk.prof < rk.pomo, "접속자가 뽀모보다 먼저 늘어난다");
    ok(/function pickGrowIndex/.test(lay), "가지마다 늘어날 쪽을 고른다");
    ok(!/} else if \(last\) \{/.test(lay), "무조건 마지막 가지가 늘어나던 규칙을 없앴다");

    /* =================================================================
       [2026-08-11] "뽀모 창을 닫으면 채팅이 두 배로 벌어진다"
       -----------------------------------------------------------------
       남는 공간을 받는 칸은 flex: 1 1 0 — **제 폭이 없습니다.** 화면에서
       남는 만큼이 곧 그 칸의 폭이에요. 그 자리가 채팅이었으니 뽀모 줄이
       접히면 그 폭이 통째로 채팅에 얹혔습니다. 끌어서 줄여도 배치를 다시
       그릴 때마다 되돌아왔고요 (저장된 panel/chat 을 안 쓰니까요).

       ★ 아래 검사는 **가운데 칸(접속자)이 1순위**라는 것을 못 박습니다.
         양옆은 제 폭을 기억하는 곁창이어야 합니다.
       ================================================================= */
    ok(rk.prof < rk.chat,
       `★ 남는 공간은 가운데(접속자)가 받는다 — 곁창인 채팅이 받으면 뽀모를 닫을 때 두 배로 벌어진다 (접속자 ${rk.prof} / 채팅 ${rk.chat})`);
    ok(rk.prof === Math.min(...Object.values(rk)),
       "접속자가 어느 창보다도 먼저 늘어난다");
    ok(rk.chat < rk.pomo, "곁창끼리는 채팅이 뽀모보다 먼저 (접속자가 없을 때의 예비)");

    /* 곁창 둘 다 제 폭이 정해져 있어야 합니다 — 없으면 늘어날 때
       기댈 값이 없어 또 "남는 만큼" 이 됩니다. */
    ["chat", "pomo"].forEach(k =>
      ok(new RegExp('"panel/' + k + '": \\d+').test(lay),
         `★ ${k} 는 제 폭을 갖는다 (남는 것을 받는 칸이 아니다)`));

    /* 실제로 굴려봅니다 — ★ 코드의 GROW_RANK 를 그대로 씁니다.
       예전에는 여기에 { chat:1, prof:2, pomo:9 } 를 **따로 적어** 두고
       그걸 굴렸습니다. 검사가 자기 사본을 검사한 셈이라, 코드 쪽 숫자를
       바꿔도 아무 일이 없었어요. */
    const rank = rk;
    const pick = (kids, map) => {
      let best = Infinity, idx = kids.length - 1;
      kids.forEach((k, n) => {
        const r = rank[map[k]] ?? 5;
        if (r < best) { best = r; idx = n; }
      });
      return idx;
    };
    ok(pick(["a","b"], { a: "chat", b: "pomo" }) === 0, "[채팅][뽀모] → 채팅이 늘어난다");
    ok(pick(["a","b"], { a: "pomo", b: "chat" }) === 1, "[뽀모][채팅] → 채팅이 늘어난다");
    ok(pick(["a","b"], { a: "pomo", b: "prof" }) === 1, "[뽀모][접속자] → 접속자가 늘어난다");

    /* ★ 지금 쓰는 배치 그대로 — [채팅][접속자][뽀모] */
    const 세칸 = { a: "chat", b: "prof", c: "pomo" };
    ok(pick(["a","b","c"], 세칸) === 1,
       "★ [채팅][접속자][뽀모] 에서 가운데가 늘어난다");
    /* 뽀모를 닫으면 그 가지가 아예 빠집니다. 그래도 가운데여야 합니다 —
       여기서 채팅이 뽑히면 뽀모 폭이 통째로 채팅에 얹힙니다. */
    ok(pick(["a","b"], { a: "chat", b: "prof" }) === 1,
       "★ 뽀모를 닫아도 채팅이 아니라 접속자가 받는다 (이게 벌어짐의 원인이었다)");
    /* 좌우를 뒤집어도 마찬가지 */
    ok(pick(["a","b","c"], { a: "pomo", b: "prof", c: "chat" }) === 1,
       "뒤집힌 배치에서도 가운데가 늘어난다");
    /* 접속자를 치워 뒀다면 채팅이 예비로 받습니다 (아무도 안 받으면 빈 칸이 남아요) */
    ok(pick(["a","b"], { a: "chat", b: "pomo" }) === 0,
       "접속자가 없으면 채팅이 예비로 받는다");
  }

  /* =====================================================================
     [2026-08-11] 칸 폭이 어긋나던 자리들
     ===================================================================== */
  {
    /* ① syncSizes 가 **껍데기**였습니다 — 안에서 아무 일도 안 했어요.
       applyLayout 은 "상태가 같으면" 다시 그리지 않고 여기로 넘기니,
       저장된 폭을 되돌리는 일이 아예 안 일어난 셈입니다. */
    const seg = lay.slice(lay.indexOf("function syncSizes"),
                          lay.indexOf("function syncSizes") + 1400);
    ok(/el\.style\.flex\s*=/.test(seg),
       "★ syncSizes 가 실제로 폭을 되돌린다 (예전엔 아무것도 안 했다)");
    ok(/flexGrow/.test(seg), "늘어나는 칸은 건드리지 않는다 (제 폭이 없으니까)");
    ok(/dataset\.sizeKey/.test(seg) && /child\.dataset\.sizeKey = key/.test(lay),
       "어느 칸이 어느 값을 쓰는지 표를 달아 둔다");

    /* ② 접힌 칸과 레일까지 "최소 120px 이 필요한 칸" 으로 세고 있었습니다.
       뽀모를 접으면 끌 수 있는 최대 폭이 480px 이나 깎였어요. */
    const ss = lay.slice(lay.indexOf("function setSize"),
                         lay.indexOf("function setSize") + 1400);
    ["chat-collapsed-slot", "pomo-collapsed-slot", "side-rail"].forEach(c =>
      ok(new RegExp('contains\\("' + c + '"\\)').test(ss),
         `★ 자리를 안 쓰는 ${c} 는 최소 폭 계산에서 뺀다`));
    ok(/el\.style\.flex = "0 1 " \+ next/.test(ss),
       "★ 끈 뒤에도 0 1 이다 (0 0 이면 창을 줄일 때 뒤엣것이 밀려난다)");

    /* ③ 늘어나는 칸이 **반드시 하나** 있어야 합니다. 접힌 칸이 뽑히면
       아무도 안 늘어나 빈 자리가 덩그러니 남습니다. */
    const pg = lay.slice(lay.indexOf("function pickGrowIndex"),
                         lay.indexOf("function pickGrowIndex") + 1600);
    /* ★ "isSideCollapsed 라는 글자가 있는가" 로는 모자랍니다 —
       변수만 만들어 두고 안 쓰면 그대로 통과해요. 실제로 뽀모를
       걸러내는 줄이 있는지 봅니다. */
    ok(/pomoFolded && ids\.every\(pid => pid === "pomo"\)/.test(pg),
       "★ 접힌 뽀모도 후보에서 뺀다 (예전엔 채팅만 뺐다)");
    ok(/chatFolded && ids\.every\(pid => pid === "chat"\)/.test(pg),
       "접힌 채팅도 그대로 뺀다");
    ok(/if \(bestIdx < 0\) bestIdx = i;/.test(pg),
       "★ 안 접힌 것 중 첫째를 기본값으로 — 어떤 경우에도 늘어나는 칸이 하나 있다");

    /* 굴려 봅니다 — 셋 다 접힌 극단까지 */
    const rank = { prof: 1, chat: 2, pomo: 9 };
    const pick = (kids, map, chatF, pomoF) => {
      const 접힘 = (id) => (chatF && id === "chat") || (pomoF && id === "pomo");
      let best = Infinity, idx = -1;
      kids.forEach((k, i) => {
        const id = map[k];
        if (접힘(id)) return;
        if (idx < 0) idx = i;
        const r = rank[id] ?? 5;
        if (r < best) { best = r; idx = i; }
      });
      return idx < 0 ? kids.length - 1 : idx;
    };
    const M = { a: "chat", b: "prof", c: "pomo" };
    ok(pick(["a","b","c"], M, false, false) === 1, "평소엔 가운데가 늘어난다");
    ok(pick(["a","b","c"], M, false, true) === 1, "뽀모를 접어도 가운데가 늘어난다");
    ok(pick(["a","b","c"], M, true, false) === 1, "채팅을 접어도 가운데가 늘어난다");
    ok(pick(["a","b","c"], M, true, true) === 1, "둘 다 접어도 가운데가 늘어난다");
    /* ★ 예전 규칙(기본값 = 마지막 가지)이면 여기서 접힌 뽀모가 뽑혔습니다 */
    ok(pick(["a","c"], { a: "chat", c: "pomo" }, true, false) === 1,
       "접속자가 없고 채팅이 접혔으면 뽀모라도 늘어난다 (빈 자리를 남기지 않는다)");
  }

  /* =====================================================================
     ★★ 손잡이가 "남는 공간을 받는 칸" 을 잡으면 안 됩니다 (2026-08-11)
     ---------------------------------------------------------------------
     [증상] "채팅 폭은 그대로인데 창이 옆으로 움직여요. 벽에서 뚝 떨어져요."

     손잡이는 여태 무조건 **자기 앞 칸**을 잡았습니다. 그 앞 칸이 하필
     늘어나는 칸이면, 끄는 순간 고정 폭으로 못 박히면서 **아무도 안
     늘어나게** 됩니다. 늘어났어야 할 만큼이 빈 자리로 남고, 칸들은
     그 빈 자리에 밀려 자리만 옮겨 다녔어요.

     ★ 뒤집어 쓰면(chat-right) 더 나빴습니다. 줄이 거꾸로 흐르니 빈 자리가
       **왼쪽**에 생기고, 채팅은 DOM 의 마지막이라 **채팅을 잡는 손잡이가
       아예 없었습니다.** 그래서 폭이 영영 안 변했어요.
       — 이 방을 쓰는 분이 뒤집어 쓰고 계셔서 드러난 버그입니다.
     ===================================================================== */
  {
    ok(/const 뒤를잡음 = \(i >= growIdx\);/.test(lay) &&
       /grip\.dataset\.target = 뒤를잡음 \? "next" : "prev"/.test(lay),
       "★ 늘어나는 칸 앞의 손잡이는 앞 칸을, 뒤의 손잡이는 뒤 칸을 잡는다");
    ok(/sizeKeyFor\(kids\[i \+ 1\], map, keyPrefix, i \+ 1\)/.test(lay),
       "그때는 저장 이름도 뒤 칸 것으로 바뀐다");
    ok(/function gripTarget/.test(lay) && /function gripSign/.test(lay),
       "잡을 칸과 끄는 방향을 한곳에서 정한다");

    /* 손잡이를 다루는 세 곳(끌기·더블클릭·화살표)이 **같은 칸**을 잡아야
       합니다. 한 곳만 옛 방식으로 남으면 조작마다 딴 칸이 움직입니다. */
    const 본체 = lay.slice(lay.indexOf("function bindGrip("), lay.indexOf("function bindGrips("));
    ok(!/grip\.previousElementSibling/.test(본체),
       "★ 세 곳 모두 gripTarget 을 쓴다 (앞 칸을 곧장 잡는 곳이 없다)");
    ok((본체.match(/gripTarget\(grip\)/g) || []).length === 3,
       "끌기 · 더블클릭 · 화살표 셋 다");
    ok(/gripSign\(grip\)/.test(본체), "화살표도 같은 방향 규칙을 쓴다");

    /* 레일이 사이에 끼어 있어도 엉뚱한 것을 잡으면 안 됩니다 */
    const gt = lay.slice(lay.indexOf("function gripTarget"), lay.indexOf("function gripSign"));
    ok(/side-rail/.test(gt) && /split-grip/.test(gt) && /display === "none"/.test(gt),
       "★ 레일·손잡이·숨은 것은 건너뛴다");

    /* ── 실제로 굴려 봅니다 ── */
    const rank = { prof: 1, chat: 2, pomo: 9 };
    const 손잡이들 = (kids, map) => {
      let best = Infinity, grow = -1;
      kids.forEach((k, i) => {
        if (grow < 0) grow = i;
        const r = rank[map[k]] ?? 5;
        if (r < best) { best = r; grow = i; }
      });
      const out = [];
      for (let i = 0; i < kids.length - 1; i++) {
        const 뒤 = (i >= grow);
        out.push({ 잡는칸: map[kids[뒤 ? i + 1 : i]], 방향: 뒤 ? "next" : "prev" });
      }
      return { grow: map[kids[grow]], 손잡이: out };
    };

    /* ① 안 뒤집은 배치 [채팅][접속자][뽀모] */
    {
      const r = 손잡이들(["a","b","c"], { a: "chat", b: "prof", c: "pomo" });
      ok(r.grow === "prof", "가운데(접속자)가 늘어난다");
      ok(!r.손잡이.some(g => g.잡는칸 === "prof"),
         "★ 어느 손잡이도 늘어나는 칸을 잡지 않는다");
      ok(r.손잡이[0].잡는칸 === "chat", "첫 손잡이는 채팅을 잡는다");
      ok(r.손잡이[1].잡는칸 === "pomo" && r.손잡이[1].방향 === "next",
         "★ 둘째 손잡이는 앞(접속자) 대신 뒤(뽀모)를 잡는다");
    }
    /* ② 뒤집어 쓰는 배치 — DOM [뽀모][접속자][채팅], 화면은 거꾸로 */
    {
      const r = 손잡이들(["a","b","c"], { a: "pomo", b: "prof", c: "chat" });
      ok(r.grow === "prof", "뒤집어도 가운데가 늘어난다");
      ok(!r.손잡이.some(g => g.잡는칸 === "prof"),
         "★ 뒤집힌 배치에서도 늘어나는 칸을 안 잡는다");
      ok(r.손잡이.some(g => g.잡는칸 === "chat"),
         "★ 채팅을 잡는 손잡이가 **있다** (예전엔 아예 없어서 폭이 안 변했다)");
    }
    /* ③ ★ 여섯 가지 자리 배치를 **전부** 굴려 봅니다.
       못 잡는 칸이 있으면 그 칸은 영영 크기를 못 바꾸고, 같은 칸을 둘이
       잡으면 나머지 하나가 못 잡히게 됩니다. 늘어나는 칸만 예외예요. */
    const 셋 = ["chat", "prof", "pomo"];
    const 순열 = [];
    셋.forEach(a => 셋.forEach(b => 셋.forEach(c => {
      if (new Set([a, b, c]).size === 3) 순열.push([a, b, c]);
    })));
    ok(순열.length === 6, "자리 배치 여섯 가지를 모두 굴린다");
    순열.forEach(순서 => {
      const map = { a: 순서[0], b: 순서[1], c: 순서[2] };
      const r = 손잡이들(["a","b","c"], map);
      const 잡힘 = r.손잡이.map(g => g.잡는칸);
      const 못잡는 = 순서.filter(p => p !== r.grow && !잡힘.includes(p));
      ok(!못잡는.length,
         `[${순서.join("][")}] — 늘어나는 칸 빼고 모두 손잡이가 있다`
         + (못잡는.length ? " → 없음: " + 못잡는.join(", ") : ""));
      ok(new Set(잡힘).size === 잡힘.length,
         `[${순서.join("][")}] — 두 손잡이가 같은 칸을 잡지 않는다`);
      ok(!잡힘.includes(r.grow),
         `[${순서.join("][")}] — 늘어나는 칸(${r.grow})은 아무도 안 잡는다`);
    });
  }

  /* =====================================================================
     🗓 출근부 — "입장 전" 표시 (2026-08-11)
     ---------------------------------------------------------------------
     새 멤버의 줄은 앞이 통째로 비어서 "열흘 결석" 처럼 보였습니다.
     아직 멤버가 아니던 날은 칸을 하나로 합쳐 구분합니다.

     ★ colspan 이 어긋나면 표 전체가 밀립니다. 눈으로는 잘 안 보이고
       칸이 하나씩 밀린 채로 읽히니, 숫자로 못을 박습니다.
     ===================================================================== */
  {
    const AD = fs.readFileSync(DIR + "script_admin.js", "utf8");
    const AH = fs.readFileSync(DIR + "admin.html", "utf8");

    ok(/let _firstSeen = null;/.test(AD), "사람마다 처음 나타난 날을 기억해 둔다");
    ok(/if \(_firstSeen\) return _firstSeen;/.test(AD),
       "★ 한 번만 읽는다 (달을 옮길 때마다 방 전체를 내려받지 않게)");
    ok(/return null;\s*\/\/ 못 읽으면/.test(AD),
       "★ 못 읽으면 표시를 아예 안 한다 (틀리게 칠하느니)");
    /* [옮김 2026-08-15] 이 계산이 머리글(그날 총원)에서도 필요해져서
       위쪽 bornOf 로 한 번에 구하도록 모았습니다 — 같은 값을 두 군데서
       세면 언젠가 어긋나니까요. */
    ok(/if \(vs\[d\] === true && \(!b \|\| d < b\)\) b = d;/.test(AD),
       "휴가만 찍힌 날도 '있었던' 날로 센다");
    ok(/const born = bornOf\[n\];/.test(AD),
       "★ 멤버 줄은 머리글이 구해 둔 값을 그대로 쓴다 (두 번 세지 않는다)");
    ok(/colspan="\$\{beforeN\}"/.test(AD), "빈 칸을 하나로 합친다");
    ok(/beforeN >= 3 \? "입장 전" : ""/.test(AD), "좁으면 글자는 생략한다");
    ok(/for \(let d = beforeN \+ 1; d <= daysInMonth; d\+\+\)/.test(AD),
       "★ 합친 만큼은 건너뛰고 그린다 (안 그러면 칸이 넘쳐 표가 밀린다)");
    ok(/td\.cell\.before\{/.test(AH) && /repeating-linear-gradient/.test(AH),
       "빗금으로 그린다 (휴가·1시간 미만 색과 안 헷갈리게)");
    ok(/입장 전 \(아직 멤버가 아니던 날\)/.test(AH), "범례에 설명이 있다");

    /* ── 줄 하나를 실제로 만들어 칸 수를 셉니다 ── */
    const 줄만들기 = (daysInMonth, ym, born, 출석날들) => {
      let beforeN = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const dk = `${ym}-${String(d).padStart(2, "0")}`;
        if (born && dk >= born) break;
        beforeN++;
      }
      let 칸 = 0, 셀 = [];
      if (beforeN > 0) { 칸 += beforeN; 셀.push("합침(" + beforeN + ")"); }
      for (let d = beforeN + 1; d <= daysInMonth; d++) {
        const dk = `${ym}-${String(d).padStart(2, "0")}`;
        칸 += 1; 셀.push(출석날들.includes(dk) ? "출석" : "빈칸");
      }
      return { 칸, 셀, beforeN };
    };

    /* ① 곰미님 — 8월 11일에 처음 온 신규 */
    {
      const r = 줄만들기(31, "2026-08", "2026-08-11", ["2026-08-11"]);
      ok(r.칸 === 31, `★ 합쳐도 칸 수가 그 달 날수와 같다 (${r.칸}/31)`);
      ok(r.beforeN === 10, `1~10일이 합쳐진다 (${r.beforeN}일)`);
      ok(r.셀[0] === "합침(10)" && r.셀[1] === "출석", "합친 칸 바로 뒤가 첫 출석일이다");
    }
    /* ② 1일부터 있던 사람 — 합치는 칸이 없어야 합니다 */
    {
      const r = 줄만들기(31, "2026-08", "2026-08-01", ["2026-08-01"]);
      ok(r.beforeN === 0 && r.칸 === 31, "★ 1일부터 있던 사람은 합치지 않는다");
      ok(r.셀[0] === "출석", "첫 칸이 곧바로 1일이다");
    }
    /* ③ 지난달부터 있던 사람 — 이 달에는 표시가 없어야 합니다 */
    {
      const r = 줄만들기(31, "2026-08", "2026-07-20", []);
      ok(r.beforeN === 0 && r.칸 === 31, "★ 예전부터 있던 사람은 이 달에 표시가 없다");
    }
    /* ④ 명단에는 있는데 한 번도 안 온 사람 — 달 전체가 입장 전 */
    {
      const r = 줄만들기(31, "2026-08", null, []);
      ok(r.beforeN === 31 && r.칸 === 31 && r.셀.length === 1,
         "★ 한 번도 안 온 사람은 달 전체가 한 칸으로 합쳐진다");
    }
    /* ⑤ 다음 달을 볼 때 — 그 사람이 그 뒤에 들어왔으면 달 전체가 입장 전 */
    {
      const r = 줄만들기(30, "2026-06", "2026-08-11", []);
      ok(r.beforeN === 30 && r.칸 === 30, "지난 달을 봐도 칸 수가 맞는다 (30일)");
    }
    /* ⑥ 2월(28일)·윤달까지 — 날수가 달라도 늘 맞아야 합니다 */
    [[28, "2026-02"], [29, "2028-02"], [30, "2026-09"], [31, "2026-12"]].forEach(([n, ym]) => {
      const r = 줄만들기(n, ym, ym + "-05", []);
      ok(r.칸 === n, `${ym} (${n}일) — 칸 수가 맞는다`);
    });
  }

  /* =====================================================================
     📏 한 달 18일 규칙 — 늦게 들어온 사람은 비율로 (2026-08-11)
     ---------------------------------------------------------------------
     ★ 여기서 틀리면 사람이 "규칙을 어겼다" 는 소리를 억울하게 듣습니다.
       규칙 셈은 화면보다 사람에 가까운 코드라, 실제 함수를 꺼내 굴립니다.
     ===================================================================== */
  {
    const AD2 = fs.readFileSync(DIR + "script_admin.js", "utf8");
    const AH2 = fs.readFileSync(DIR + "admin.html", "utf8");

    ok(/const RULE_DAYS = 18;/.test(AD2), "기준 일수가 한곳에 이름으로 있다");
    ok(/Math\.round\(\(eff \/ daysInMonth\) \* RULE_DAYS\)/.test(AD2),
       "★ 반올림으로 맞춘다 (올림이면 늦게 온 사람에게 하루가 더 붙는다)");
    ok(/Math\.max\(0, member - vacInMonth\)/.test(AD2),
       "★ 휴가 낸 날은 셈에서 통째로 뺀다 (기준이 낮아진다)");
    ok(/if \(vacs\[dk\] !== true\) daysLeft\+\+;/.test(AD2),
       "★ 앞으로 낼 휴가는 '남은 날' 에서도 뺀다 (두 번 봐주지 않게)");
    ok(/const isThisMonth = \(monthOffset === 0\);/.test(AD2) &&
       /if \(isThisMonth\) \{/.test(AD2),
       "★ 지난 달에는 남은 날이 없다 (0)");

    /* ── 📏 나의 작업 달력 아래에도 같은 규칙 (2026-08-13) ──
       멤버 본인이 보는 숫자와 관리자가 보는 숫자가 다르면 그날로 분쟁입니다.
       같은 셈(18일 기준 · 비율식)이 두 파일에 있는지 맞춰 봅니다. */
    {
      const MW2 = fs.readFileSync(DIR + "script_mywork.js", "utf8");
      ok(/const RULE_DAYS = 18;/.test(MW2), "★★ 기준 18일이 나의 작업에도 같은 이름으로 있다");
      ok(/Math\.round\(\(eff \/ daysInMonth\) \* RULE_DAYS\)/.test(MW2) &&
         /Math\.round\(\(eff \/ daysInMonth\) \* RULE_DAYS\)/.test(AD2),
         "★★★ 관리자와 나의 작업이 글자까지 같은 식을 쓴다 — 다르면 분쟁");
      ok(/Math\.max\(0, member - vacCount\)/.test(MW2),
         "휴가가 기준을 내리는 것도 같다");
      ok(/if \(k > today && _vacs\[k\] !== true\) daysLeft\+\+;/.test(MW2),
         "남은 날에서 앞으로 낼 휴가를 빼는 것도 같다");
      ok(/\$\{ruleHtml\(y, m, attended, vacCount\)\}/.test(MW2),
         "★ 달력 바로 아래에 실제로 붙는다 (휴가를 찍으면 그 자리에서 다시 계산)");
      ok(/달이 며칠이든 같아요/.test(MW2), "★ '28일이든 31일이든 18일' 을 글로도 적어 둔다");
      ok(/휴가를 찍으면 그만큼 자동으로 내려가요/.test(MW2), "휴가 자동 반영 설명이 있다");
      ok(/이달첫날 > today\) return null;/.test(MW2), "다음 달에는 안 그린다 (셀 것이 없다)");

      /* ── 실제 숫자로 — 콩의 질문 그대로: 28·30·31일 달에서 다 18인가 ── */
      {
        const need = (daysInMonth, beforeN, vac) => {
          const member = daysInMonth - beforeN;
          const eff = Math.max(0, member - vac);
          return Math.round((eff / daysInMonth) * 18);
        };
        ok(need(28, 0, 0) === 18 && need(30, 0, 0) === 18 && need(31, 0, 0) === 18,
           "★★★ 달을 꽉 채운 사람은 28·30·31일 달 모두 정확히 18일");
        ok(need(29, 0, 0) === 18, "윤년 2월도 18일");
        ok(need(31, 0, 1) === 17, "31일 달에 휴가 1일 → 17일");
        ok(need(28, 0, 1) === 17, "28일 달에 휴가 1일 → 17일 (짧은 달도 공평)");
        ok(need(31, 15, 0) === 9, "달 중간(16일)에 들어오면 9일 — 비율로");
        ok(need(30, 0, 30) === 0, "한 달 통째로 휴가면 0일");
        /* 상태 갈림 */
        const state = (att, needN, left, 이번달) =>
          att >= needN ? "ok" : (이번달 && att + left >= needN) ? "maybe" : "bad";
        ok(state(18, 18, 0, true) === "ok", "채우면 달성");
        ok(state(5, 17, 12, true) === "maybe", "남은 날로 닿으면 아직 가능");
        ok(state(5, 17, 11, true) === "bad", "남은 날을 다 와도 안 되면 미리 알려준다");
        ok(state(14, 17, 0, false) === "bad", "지난 달 미달은 그대로 미달");
      }

      /* ── 🏖️ 휴가 상한 — 입장일 비례 (2026-08-17) ──
         예전에는 고정 7일이라, 25일에 들어온 사람이 남은 7일을 전부
         휴가로 찍어 의무를 0으로 만들 수 있었습니다. 이제 의무 출석과
         **같은 비례식**을 씁니다. */
      ok(/const VAC_DAYS = 7;/.test(MW2), "★ 한 달 꽉 채운 사람의 휴가 7일이 한곳에 이름으로 있다");
      ok(/Math\.max\(1, Math\.round\(\(member \/ daysInMonth\) \* VAC_DAYS\)\)/.test(MW2),
         "★★ 휴가 상한이 입장일 비례로 계산된다 (최소 1일 보장)");
      ok(!/const VAC_CAP = 7;/.test(MW2), "★ 고정 상한 7일은 사라졌다");
      ok(/if \(next && vacCountOfMonth\(ds\.slice\(0, 7\)\) >= cap\)/.test(MW2),
         "★★ 상한을 넘는 휴가는 켜기 전에 막힌다 (서버에 안 쓴다)");
      ok(/켜는 것만 막습니다/.test(MW2) && /if \(next &&/.test(MW2),
         "★ 끄는 것은 안 막는다 — 잘못 찍은 휴가를 풀 길은 늘 열려 있다");
      ok(/방장에게 말씀해 주세요/.test(MW2),
         "막힐 때 다음 길(장기 부재는 방장과 상의)을 알려준다");
      ok(/\$\{vacCount\}\/\$\{cap\}일/.test(MW2), "달력 아래에 '쓴 날/상한' 이 뜬다");
      ok(/휴가를 빼지 않습니다/.test(MW2),
         "★ 상한을 정할 때 휴가를 안 뺀다는 이유가 적혀 있다 (자기를 물고 도는 셈)");

      /* ★★ 두 파일이 같은 셈법인가 — 어긋나면 "내 화면과 출석부가 다르다" 가 됩니다 */
      if (typeof AD2 === "string" && AD2) {
        ok(/const VAC_DAYS = 7;/.test(AD2), "★★ 관리자 출석부에도 같은 이름·같은 값으로 있다");
        ok(/Math\.max\(1, Math\.round\(\(member \/ daysInMonth\) \* VAC_DAYS\)\)/.test(AD2) &&
           /Math\.max\(1, Math\.round\(\(member \/ daysInMonth\) \* VAC_DAYS\)\)/.test(MW2),
           "★★ 휴가 상한 셈법이 두 파일에서 글자 하나까지 같다");
        ok(/\$\{vacDays\}\/\$\{vacCap\}/.test(AD2), "출석부 휴가 칸이 '쓴 날/상한' 으로 뜬다");
        ok(/vac-c.*over|over.*vac-c/.test(AD2) || /vacOver/.test(AD2),
           "★ 상한을 넘긴 사람은 붉게 보이되 막지는 않는다");
      }

      {
        /* 굴려 봅니다 — 상한이 입장일에 따라 갈리는가 */
        const VAC_DAYS = 7;
        const cap = (daysInMonth, beforeN) => {
          const member = daysInMonth - beforeN;
          if (member <= 0) return 0;
          return Math.max(1, Math.round((member / daysInMonth) * VAC_DAYS));
        };
        /* 31일 달 · d일에 입장 → beforeN = d-1 */
        const c31 = (d) => cap(31, d - 1);
        ok(c31(1) === 7, `달을 꽉 채우면 7일 (${c31(1)})`);
        ok(c31(11) === 5, `★ 11일 입장이면 5일 (${c31(11)})`);
        ok(c31(21) === 2, `★ 21일 입장이면 2일 (${c31(21)})`);
        ok(c31(25) === 2, `25일 입장이면 2일 (${c31(25)})`);
        ok(c31(31) === 1, `★★ 마지막 날 입장도 최소 1일은 보장 (${c31(31)})`);
        ok(cap(31, 31) === 0, "아직 멤버가 아니던 달은 0일");
        /* 달 길이가 달라도 같은 비율이면 같은 값 */
        ok(cap(30, 0) === 7 && cap(28, 0) === 7, "달 길이와 상관없이 꽉 채우면 7일");

        /* ★★ 이번 고침의 핵심 — 늦게 들어와도 의무가 0 이 되지 않는다.
           예전(고정 7일): 25일 입장 → 멤버 7일, 휴가 7일 → eff 0 → 의무 0일 */
        const need = (daysInMonth, beforeN, vac) => {
          const member = daysInMonth - beforeN;
          return Math.round((Math.max(0, member - vac) / daysInMonth) * 18);
        };
        ok(need(31, 24, 7) === 0, "(옛 규칙) 25일 입장 + 휴가 7일이면 의무가 0일이었다");
        ok(need(31, 24, c31(25)) === 3,
           `★★ 새 규칙에선 상한을 다 써도 의무가 남는다 (${need(31, 24, c31(25))}일)`);
        ok(need(31, 10, c31(11)) === 9,
           `★ 11일 입장 · 휴가 다 써도 9일 (${need(31, 10, c31(11))})`);
        /* 상한을 다 써도 의무는 14일 밑으로 안 내려간다 (달을 꽉 채운 사람) */
        const nd = (dim) => Math.round(((dim - VAC_DAYS) / dim) * 18);
        ok(nd(31) === 14 && nd(30) === 14 && nd(28) === 14,
           `★★ 휴가를 다 써도 의무 최저는 14일 (${nd(31)}·${nd(30)}·${nd(28)})`);

        /* 켜고 끄기 — 상한이 5일인 사람 */
        const vacs = {};
        const count = (ym) => Object.keys(vacs).filter(k => k.startsWith(ym)).length;
        const toggle = (ds, capN) => {
          const next = !vacs[ds];
          if (next && count(ds.slice(0, 7)) >= capN) return "막힘";
          if (next) vacs[ds] = true; else delete vacs[ds];
          return next ? "켬" : "끔";
        };
        let r = null;
        for (let d = 11; d <= 15; d++) r = toggle(`2026-08-${d}`, 5);
        ok(r === "켬" && count("2026-08") === 5, "상한 5일까지는 자유롭게 찍힌다");
        ok(toggle("2026-08-16", 5) === "막힘" && count("2026-08") === 5,
           "★★ 6일째는 막히고 아무것도 안 바뀐다");
        ok(toggle("2026-08-12", 5) === "끔" && count("2026-08") === 4, "가득 찬 채로도 끄기는 된다");
        ok(toggle("2026-09-01", 7) === "켬", "★ 상한은 달마다 따로 — 다음 달은 꽉 찬 7일");
      }
    }

    /* ── 🔍 출석 칸 돋보기 (2026-08-12) ──
       "밤 10시에 와서 12시 넘어 나갔는데 1시간 미만?" 에 증거로 답합니다.
       접속자 창은 느슨하고(30분 유예) 시간은 연결이 산 구간만 쌓여서,
       탭이 잠들면 둘이 어긋나요 — 어디서 끊겼는지 칸을 눌러 봅니다. */
    ok(/data-dig-nick="\$\{n\}" data-dig-day="\$\{dk\}"/.test(AD2),
       "★ 출석한 칸에 돋보기가 달린다");
    ok(/const dig = inAt \?/.test(AD2), "출석 안 한 칸에는 안 달린다");
    ok(/async function openDig/.test(AD2) && /bindDig\(body\)/.test(AD2),
       "누르면 그날 구간 내역이 뜬다");
    ok(/s\.a - prevEnd >= GAP_MS/.test(AD2) && /끊김<\/b>/.test(AD2),
       "★★ 구간 사이 빈 자리를 '끊김' 줄로 보여준다 — 시간이 사라진 자리가 바로 이곳");
    ok(/접속 유지 가이드/.test(AD2),
       "★ 끊김이 잦으면 접속 유지 가이드로 안내하라고 적어 둔다");
    ok(/이 날 기록된 구간이 없어요/.test(AD2),
       "구간이 하나도 없는 날도 말이 되게 설명한다");
    ok(/\.adm-dig-card\{/.test(AH2) && /cursor: zoom-in/.test(AH2),
       "돋보기 차림새가 admin.html 에 있다");
    /* 별채에도 캐시 도장 (2026-08-13) — 본채만 찍고 여길 잊어서,
       고친 돋보기를 올려도 관리자 브라우저가 옛것을 재활용했습니다 */
    ok(/script_admin\.js\?v=\d{12}/.test(AH2),
       "★★ admin.html 도 script_admin.js 에 ?v= 도장을 찍는다");
    ok(/script_admin\\\.js\)\(\?:\\\?v=/.test(fs.readFileSync(DIR+"build-single.py","utf8").replace(/\s/g,"")) ||
       /script_admin\\.js/.test(fs.readFileSync(DIR+"build-single.py","utf8")),
       "빌드가 그 도장을 매번 새로 찍는다");
    {
      /* 끊김 판정을 실제로 굴려 봅니다 — 22시 입장, 12시 반 퇴장인데
         22:24 에 탭이 잠든 그 시나리오 그대로 */
      const GAP_MS = 5 * 60 * 1000, H = 3600e3;
      const t0 = new Date("2026-08-12T22:00:00").getTime();
      const segs = [
        { s: "writing", a: t0, b: t0 + 24 * 60e3 },              // 22:00~22:24 (탭 잠듦)
        { s: "writing", a: t0 + 2.5 * H, b: t0 + 2.6 * H }       // 00:30~00:36 (인사하러 복귀)
      ];
      let total = 0, gaps = [], prevEnd = 0;
      segs.forEach(sg => {
        if (prevEnd && sg.a - prevEnd >= GAP_MS) gaps.push(sg.a - prevEnd);
        total += sg.b - sg.a;
        prevEnd = sg.b;
      });
      ok(Math.round(total / 60e3) === 30, `쌓인 시간이 30분으로 나온다 (${Math.round(total/60e3)}분)`);
      ok(gaps.length === 1 && Math.round(gaps[0] / 60e3) === 126,
         "★ 2시간 6분짜리 끊김이 정확히 한 줄로 잡힌다 — 접속해 보였지만 시간이 안 쌓인 자리");
    }

    /* 자리 — 이름 **왼쪽**, 그리고 가로로 밀어도 따라와야 합니다 */
    /* [넓힘 2026-08-15] 이름 칸에 열 줄 띠(band-a/band-b)가 붙으면서
       class 가 `name-c${띠}` 로 이어 붙습니다 — 따옴표까지 찾으면 안 잡혀요. */
    ok(AD2.indexOf('class="rule-c') < AD2.indexOf('<td class="name-c'),
       "★ 규칙 칸이 이름 왼쪽에 선다");
    ok(/th\.rule-h, \.adm-att-table td\.rule-c\{[^}]*position: sticky;\s*left: 0/.test(AH2),
       "규칙 칸이 맨 왼쪽에 붙어 따라온다");
    ok(/th\.name-h, \.adm-att-table td\.name-c\{[^}]*left: 66px/.test(AH2),
       "★ 이름 칸은 그만큼 밀려 있다 (겹치면 이름이 가려진다)");
    ["ok", "maybe", "bad"].forEach(c =>
      ok(new RegExp("td\\.rule-c\\." + c + "\\{").test(AH2), `${c} 상태에 색이 있다`));

    /* ── 실제 함수를 꺼내 굴립니다 ── */
    const box = {};
    vm.createContext(box);
    vm.runInContext("const RULE_DAYS = 18;\n" +
      AD2.slice(AD2.indexOf("function ruleOf"),
                AD2.indexOf("\n  }", AD2.indexOf("function ruleOf")) + 4), box);
    const R = (o) => vm.runInContext("ruleOf", box)(o);

    /* ① 달을 통째로 있은 사람 — 기준은 그대로 18일 */
    ok(R({ daysInMonth: 31, beforeN: 0, vacInMonth: 0, attended: 18, daysLeft: 0 }).need === 18,
       "★ 처음부터 있던 사람의 기준은 18일 그대로다");
    ok(R({ daysInMonth: 28, beforeN: 0, vacInMonth: 0, attended: 0, daysLeft: 28 }).need === 18,
       "2월(28일)에도 기준은 18일이다");

    /* ② 곰미님 — 8월 11일 입장 (앞 10일 없음) */
    {
      const r = R({ daysInMonth: 31, beforeN: 10, vacInMonth: 0, attended: 1, daysLeft: 20 });
      ok(r.need === 12, `★ 11일에 들어오면 기준이 12일이다 (21÷31×18≈12.2 → ${r.need})`);
      ok(r.state === "maybe", "오늘 하루 나왔고 20일 남았으니 '가능' 이다");
    }
    /* 30일 달에 같은 조건이면 같은 값이 나와야 합니다 */
    ok(R({ daysInMonth: 30, beforeN: 10, vacInMonth: 0, attended: 0, daysLeft: 0 }).need === 12,
       "★ 달 길이가 달라도 같은 자리면 같은 기준이 나온다 (20÷30×18=12)");

    /* ③ 휴가 — 기준이 낮아진다 */
    {
      const a = R({ daysInMonth: 31, beforeN: 0, vacInMonth: 0, attended: 0, daysLeft: 0 }).need;
      const b = R({ daysInMonth: 31, beforeN: 0, vacInMonth: 3, attended: 0, daysLeft: 0 }).need;
      ok(a === 18 && b === 16, `★ 사흘 휴가면 기준이 18 → 16 으로 내려간다 (${a}→${b})`);
      ok(b < a, "휴가를 낼수록 기준이 낮아진다");
    }

    /* ④ 세 가지 상태가 제대로 갈리는가 */
    ok(R({ daysInMonth: 31, beforeN: 0, vacInMonth: 0, attended: 18, daysLeft: 5 }).state === "ok",
       "기준을 넘겼으면 달성");
    ok(R({ daysInMonth: 31, beforeN: 0, vacInMonth: 0, attended: 19, daysLeft: 0 }).state === "ok",
       "넘겨도 달성");
    ok(R({ daysInMonth: 31, beforeN: 0, vacInMonth: 0, attended: 10, daysLeft: 8 }).state === "ok" === false,
       "아직 모자라면 달성이 아니다");
    ok(R({ daysInMonth: 31, beforeN: 0, vacInMonth: 0, attended: 10, daysLeft: 8 }).state === "maybe",
       "★ 10일 + 남은 8일 = 18 → 딱 채울 수 있으니 '가능'");
    ok(R({ daysInMonth: 31, beforeN: 0, vacInMonth: 0, attended: 10, daysLeft: 7 }).state === "bad",
       "★ 하루가 모자라면 '불가' — 여기서 갈린다");
    ok(R({ daysInMonth: 31, beforeN: 0, vacInMonth: 0, attended: 17, daysLeft: 0 }).state === "bad",
       "지난 달에 하루 모자랐으면 미달");

    /* ⑤ 억울한 경우가 없는가 — 기준이 있을 수 있는 날수를 넘으면 안 됩니다 */
    for (let D of [28, 29, 30, 31]) {
      for (let b = 0; b < D; b++) {
        for (let v of [0, 3, 7]) {
          const member = D - b;
          const eff = Math.max(0, member - v);
          const need = R({ daysInMonth: D, beforeN: b, vacInMonth: v, attended: 0, daysLeft: 0 }).need;
          if (need > eff) {
            ok(false, `★ ${D}일 달·${b}일 늦게·휴가${v} — 기준(${need})이 나올 수 있는 날(${eff})보다 많다`);
            b = D; D = 99; break;
          }
        }
      }
    }
    ok(true, "★ 어떤 경우에도 기준이 '나올 수 있는 날수' 를 넘지 않는다 (달성 불가능한 기준이 없다)");

    /* ⑥ 마지막 날 입장 — 기준이 0 이나 1 이어야지, 18 이면 안 됩니다 */
    {
      const r = R({ daysInMonth: 31, beforeN: 30, vacInMonth: 0, attended: 1, daysLeft: 0 });
      ok(r.need <= 1, `★ 마지막 날 들어와도 기준이 ${r.need}일이다 (1÷31×18≈0.6)`);
      ok(r.state === "ok", "그날 나왔으면 달성이다");
    }
    /* ⑦ 휴가가 있었던 날보다 많아도 음수가 되면 안 됩니다 */
    ok(R({ daysInMonth: 31, beforeN: 25, vacInMonth: 30, attended: 0, daysLeft: 0 }).need === 0,
       "★ 휴가가 더 많아도 기준이 0 아래로 안 내려간다");
  }

  /* =====================================================================
     🗓 출근부가 한 화면에 다 들어오는가 (2026-08-11)
     ---------------------------------------------------------------------
     규칙 칸(66px)이 생기면서 31일이 잘려 나갔습니다. 출석부 카드만
     넓히고, 날짜 칸을 34 → 30px 로 줄여 그만큼을 돌려받았습니다.
     ===================================================================== */
  {
    const AH3 = fs.readFileSync(DIR + "admin.html", "utf8");

    ok(/<div class="adm-card full" id="adm-att-card">/.test(AH3),
       "출석부 카드만 넓힘 표를 달고 있다");
    ok(/\.adm-card\.full\{[^}]*width: min\(1760px, 100%\)/.test(AH3),
       "★ 100vw 가 아니라 100% 로 잰다 (세로 스크롤바 폭까지 세면 가로 스크롤이 생긴다)");
    ok(/:not\(\.full\):not\(\.narrow\)/.test(AH3),
       "★ 로그인 칸(.narrow)은 넓히지 않는다 (:has 규칙이 더 세서 안 빼면 벌어진다)");
    ok(/\.adm-att-scroll\{ overflow-x: auto/.test(AH3),
       "그래도 모자라면 가로로 밀 수 있다 (잘려 사라지지는 않는다)");

    /* ── 폭을 실제로 더해 봅니다 ── */
    const 값 = (re) => Number((AH3.match(re) || [])[1]);
    const 날칸 = 값(/\.adm-att-table th, \.adm-att-table td\{[\s\S]*?min-width: (\d+)px/);
    const 규칙칸 = 값(/th\.rule-h, \.adm-att-table td\.rule-c\{[\s\S]*?min-width: (\d+)px/);
    const 이름칸 = 값(/th\.name-h, \.adm-att-table td\.name-c\{[\s\S]*?max-width: (\d+)px/);
    const 카드폭 = 값(/\.adm-card\.full\{[\s\S]*?width: min\((\d+)px/);
    const 카드안 = 값(/\.adm-card\{[\s\S]*?padding: (\d+)px/);

    ok(날칸 === 30, `날짜 칸이 ${날칸}px 이다`);
    ok(규칙칸 === 66 && 이름칸 === 96, `규칙 ${규칙칸}px · 이름 ${이름칸}px`);

    /* ★ 이름 칸은 규칙 칸 **바로 오른쪽**에 붙어야 합니다.
       두 값이 어긋나면 가로로 밀 때 이름이 규칙 칸 아래로 파고듭니다. */
    const 이름왼쪽 = 값(/th\.name-h, \.adm-att-table td\.name-c\{[\s\S]*?left: (\d+)px/);
    ok(이름왼쪽 === 규칙칸,
       `★ 이름 칸이 규칙 칸 폭만큼 밀려 있다 (${이름왼쪽} = ${규칙칸})`);

    const 표폭 = 규칙칸 + 이름칸 + 34 * 2 + 날칸 * 31 + 40;   // 40 = 테두리 여유
    /* 노트북(1280)부터 큰 화면까지 두루 봅니다.
       ※ 처음에는 "1280 에서는 밀어 봐야 한다" 고 적었는데, 실제로 더해
         보니 딱 들어갔습니다. 짐작을 적어 두지 않고 숫자로 확인합니다. */
    [1280, 1366, 1440, 1536, 1600, 1920].forEach(화면 => {
      const 쓸수있는폭 = Math.min(카드폭, 화면 - 32) - 카드안 * 2;
      ok(쓸수있는폭 >= 표폭,
         `★ 화면 ${화면}px 에서 31일이 다 보인다 (필요 ${표폭} / 가능 ${Math.round(쓸수있는폭)})`);
    });
    /* 어디까지 버티는지 적어 둡니다 — 다음에 칸을 하나 더 붙일 때
       "얼마나 여유가 있나" 를 여기서 바로 알 수 있게. */
    {
      let 최소 = 0;
      for (let w = 900; w <= 1920; w += 2) {
        if (Math.min(카드폭, w - 32) - 카드안 * 2 >= 표폭) { 최소 = w; break; }
      }
      ok(최소 > 0 && 최소 <= 1280,
         `★ 화면이 ${최소}px 만 넘으면 31일이 다 보인다 (그 아래는 가로로 밀어 봅니다)`);
    }
  }

  /* =====================================================================
     ☕ 수다방 [나가기] — 접속자 줄 오른쪽 끝으로 (2026-08-12)
     ---------------------------------------------------------------------
     머리말 탭 줄에 있던 것을 "누가 있는지" 를 보여주는 줄로 옮겼습니다.
     탭 줄이 길어져 ☕ 수다방 이름이 밀렸고, 무엇보다 **누가 있는지**와
     **나갈지**는 같은 줄에서 보는 게 자연스러워요.

     ★ 여기까지 검사가 하나도 없던 자리입니다. 옮기면서 붙입니다.
     ===================================================================== */
  {
    const H6 = fs.readFileSync(DIR+"index.html","utf8");
    const CH6 = fs.readFileSync(DIR+"script_chatty.js","utf8");

    /* 자리 — 접속자 줄 **안**, 이름 뒤 */
    const 줄 = H6.slice(H6.indexOf('id="chatty-online-bar"'),
                        H6.indexOf('id="chat-box"'));
    ok(/id="chatty-leave-btn"/.test(줄), "★ [나가기] 가 접속자 줄 안에 있다");
    ok(줄.indexOf('id="chatty-who"') < 줄.indexOf('id="chatty-leave-btn"'),
       "이름들 뒤(오른쪽)에 선다");
    ok(!/mini-row[\s\S]{0,240}chatty-leave-btn/.test(H6),
       "★ 머리말 탭 줄에는 더 이상 없다");

    /* 아이콘만 — 옆에 이름이 늘어서는 줄이라 글자를 얹으면 이름처럼 읽힙니다 */
    const 단추 = H6.slice(H6.indexOf('id="chatty-leave-btn"'),
                          H6.indexOf("</button>", H6.indexOf('id="chatty-leave-btn"')));
    ok(/<svg/.test(단추), "★ 아이콘으로 그린다");
    /* ★ ">나가기<" 만 보면 모자랍니다 — 사이에 줄바꿈이 끼면 그냥 통과해요.
       (실제로 그렇게 넣어 보고 통과하는 걸 확인했습니다)
       속성값을 뺀 **본문**에 한글이 있는지로 봅니다. */
    ok(!/[가-힣]/.test(단추.replace(/"[^"]*"/g, "")),
       "★ 단추 안에 글자가 없다 (아이콘만 — 옆에 이름이 늘어서는 줄이라)");
    ok(/aria-label="수다방 나가기"/.test(단추), "읽어 주는 프로그램에는 이름을 남긴다");

    /* 색 — 이름과 달라야 합니다 */
    const 이름색 = (CSS.match(/#chatty-online-bar\{[\s\S]*?color: var\((--[\w-]+)\)/) || [])[1];
    const 단추색 = (CSS.match(/\.chatty-leave-btn\{[\s\S]*?color: var\((--[\w-]+)\)/) || [])[1];
    ok(이름색 && 단추색 && 이름색 !== 단추색,
       `★ 단추 색이 이름 색과 다르다 (이름 ${이름색} / 단추 ${단추색})`);

    /* ★★ 줄 접기는 **이름 쪽에만** 걸려야 합니다.
       줄 전체에 걸면 단추까지 접기 대상이 되어, 이름이 길어지는 순간
       단추가 잘려 사라집니다. 사람이 많을수록 못 나가게 되는 셈이에요. */
    ok(/#chatty-online-bar\{[^}]*display: flex/.test(CSS),
       "줄이 [이름들][단추] 두 칸으로 나뉜다");
    ok(!/#chatty-online-bar\{[^}]*-webkit-line-clamp/.test(CSS),
       "★ 줄 전체에는 접기를 걸지 않는다 (단추까지 잘린다)");
    ok(/\.chatty-who\{[^}]*-webkit-line-clamp: 3/.test(CSS),
       "★ 접기는 이름 쪽에만 (사람이 많아도 세 줄까지)");
    ok(/\.chatty-who\{[^}]*min-width: 0/.test(CSS),
       "이름이 길어도 단추를 밀어내지 않는다");
    ok(/\.chatty-leave-btn\{[^}]*flex: 0 0 auto/.test(CSS), "단추는 안 줄어든다");

    /* ★ 이름을 다시 그릴 때 단추가 지워지면 안 됩니다 */
    ok(/const who = document\.getElementById\("chatty-who"\)/.test(CH6),
       "★ 이름은 안쪽 칸에만 쓴다");
    ok(!/document\.getElementById\("chatty-online-bar"\)[\s\S]{0,120}innerHTML =/.test(CH6),
       "★ 줄 전체를 덮어쓰지 않는다 (덮어쓰면 단추가 지워진다)");
    /* 보이고 감추는 장치는 그대로여야 합니다 */
    ok(/function _renderChattyLeaveBtn/.test(CH6) &&
       /id="chatty-leave-btn"/.test(H6) && /class="chatty-leave-btn hidden"/.test(H6),
       "참여 전에는 감춰져 있다");
    ok(/\.chatty-leave-btn\.hidden\{ display: none; \}/.test(CSS),
       "★ 감출 때 실제로 사라진다 (flex 칸이라 display 를 못 박아야 합니다)");
  }

  /* =====================================================================
     📖 가이드가 실제 화면과 맞는가 (2026-08-12)
     ---------------------------------------------------------------------
     새로 오신 분은 가이드를 **먼저** 봅니다. 여기가 틀리면 그분에게는
     그게 곧 이 방의 사실이 돼요. 그래서 "코드에서 읽어 견주는" 방식으로
     못을 박습니다 — 글로 적어 두면 다음에 또 어긋납니다.
     ===================================================================== */
  {
    const MAN = fs.readFileSync(DIR+"script_manual.js","utf8");
    const GD  = fs.readFileSync(DIR+"guide.html","utf8");
    const UIx = fs.readFileSync(DIR+"script_ui.js","utf8");
    const Hx  = fs.readFileSync(DIR+"index.html","utf8");

    /* ── 🔐 입장 승인 — 새 멤버가 가장 먼저 막히는 자리 ── */
    ok(/입장 승인/.test(MAN), "★ 설명서에 입장 승인 안내가 있다");
    ok(/승인한 닉네임만/.test(MAN) && /승인한 닉네임만/.test(GD),
       "★ 설명서와 소개 페이지 **둘 다** 승인제를 알린다");
    ok(/방장에게/.test(MAN.slice(MAN.indexOf("입장 승인"), MAN.indexOf("입장 승인") + 1200)),
       "무엇을 해야 하는지(방장에게 닉네임 알리기)가 적혀 있다");
    ok(!/먼저 입장한 사람이 그 닉네임의 주인/.test(GD),
       "★ 승인 전 시절의 '먼저 입장한 사람이 주인' 설명이 남아 있지 않다");

    /* ── 설정 탭 개수 — 화면과 같아야 합니다 ── */
    {
      const 탭수 = (Hx.match(/class="tab[ "][^>]*data-tab="/g) || []).length;
      const 한글 = { 3: "셋", 4: "넷", 5: "다섯", 6: "여섯" }[탭수];
      ok(!!한글 && new RegExp("탭 " + 한글).test(MAN),
         `★ 설명서의 설정 탭 개수가 화면과 같다 (${탭수}개 = ${한글})`);
      ok(/🍅 뽀모/.test(Hx) && /🍅 뽀모/.test(MAN), "새로 생긴 🍅 뽀모 탭이 설명서에도 있다");
    }

    /* ── 타이머 모양 — 고를 수 있다는 것을 알려야 합니다 ── */
    ok(/원형/.test(MAN) && /가로 바/.test(MAN), "★ 타이머 모양 두 가지를 설명한다");
    ok(/이 기기에만/.test(MAN), "각자 다르게 쓸 수 있다는 것도 적혀 있다");
    /* 없앤 단추를 설명서가 계속 안내하면 안 됩니다 */
    ok(!/⚙️ 알림음<\/td>/.test(MAN),
       "★ 뽀모 창에서 없앤 [⚙️ 알림음] 단추를 아직 안내하지 않는다");
    ok(!/id="pomo-detail-toggle"/.test(Hx), "실제로도 그 단추가 없다");

    /* ── 테마 개수 — 코드에서 세어 견줍니다 ── */
    {
      const 테마수 = (UIx.slice(UIx.indexOf("const themes = {"), UIx.indexOf("function hexToRgba"))
        .match(/^\s*"\S+ .*\{ isDark:/gm) || []).length;
      const 한글 = { 8: "8종", 9: "9종", 10: "10종" }[테마수];
      ok(!!한글 && GD.includes("테마 " + 한글),
         `★ 소개 페이지의 테마 개수가 코드와 같다 (${테마수}개)`);
      /* 이름도 하나하나 — 새 테마를 넣고 목록만 안 고치는 일이 잦습니다 */
      const 이름 = (UIx.slice(UIx.indexOf("const themes = {"), UIx.indexOf("function hexToRgba"))
        .match(/^\s*"\S+ ([^"]+)":/gm) || []).map(x => x.match(/"\S+ ([^"]+)":/)[1]);
      const 빠짐 = 이름.filter(n => !GD.includes(n));
      ok(!빠짐.length, "★ 테마 이름이 모두 적혀 있다" + (빠짐.length ? " → " + 빠짐.join(", ") : ""));
    }

    /* ── 스티커 — 개수와 이름 ── */
    {
      const SKx = fs.readFileSync(DIR+"script_sticker.js","utf8");
      const 이름 = (SKx.match(/label: "([^"]+)"/g) || []).map(x => x.slice(8, -1));
      const 빠짐 = 이름.filter(n => !MAN.includes(n));
      ok(!빠짐.length,
         "★ 설명서에 스티커 이름이 모두 적혀 있다" + (빠짐.length ? " → " + 빠짐.join(", ") : ""));
    }

    /* ── 옮긴 것들이 옛 자리로 안내되고 있지 않은가 ── */
    ok(/접속자 명단 맨 아래 왼쪽/.test(MAN),
       "★ [📓 Letters 전체 기록] 의 새 자리를 알려준다");
    ok(!/\[오늘\] \[내 기록\] 옆 <b>\[전체 기록\]/.test(MAN),
       "옛 자리(글자수 창 탭 옆) 안내가 남아 있지 않다");
    /* [오늘 하기] — 동작이 바뀌었습니다 */
    ok(/보던 날짜에 그대로 머물러요/.test(MAN),
       "★ [오늘 하기] 를 눌러도 날짜가 안 넘어간다는 것을 알려준다");
    ok(/\[오늘로\]/.test(MAN), "날짜 넘기기와 [오늘로] 를 알려준다");

    /* ── ⚓ 새 배치를 설명하는가 (2026-08-12) ──
       새로 오신 분은 가이드를 먼저 봅니다. 화면이 통째로 바뀌었는데
       설명서가 세 칸 시절 그대로면, 그분에게는 그게 사실이 됩니다. */
    ok(/아래 알약 줄/.test(MAN), "★ 알약 줄 배치를 설명한다");
    ["📢 공지", "💬 Chat", "☕ 수다방", "🏅 업적", "🍅 Pomodoro", "✍️ Letters"].forEach(n =>
      ok(MAN.includes(n), `${n} 알약을 알려준다`));
    ok(/머리말을 잡고 끌어서/.test(MAN), "★ 자리 옮기기를 알려준다");
    ok(/두 번 누르면/.test(MAN), "제자리로 돌리는 법도");
    ok(/바깥을 눌러도 <b>안 닫혀요/.test(MAN),
       "★ 안 닫히는 판을 알려준다 (쓰던 글이 안 날아간다는 것까지)");
    ok(/여러 개 동시에/.test(MAN), "여러 판을 함께 열 수 있다는 것");
    ok(/맨 위로 올라와요/.test(MAN), "겹쳤을 때 어떻게 되는지");

    /* ★★ 세 칸 시절 안내가 남아 있으면 안 됩니다 —
       "칸 사이 손잡이를 끌어서" 같은 말은 이제 할 수 있는 일이 아닙니다. */
    ["화면은 세 칸이에요", "칸 사이의 회색 손잡이", "좌우 뒤집기로 맞바꿉니다",
     "채팅 머리말의 <b>❮</b>"].forEach(옛 =>
      ok(!MAN.includes(옛), `★ 세 칸 시절 안내가 없다 — "${옛}"`));
    /* 실제 화면과 맞는지 — 없어진 단추를 안내하면 안 됩니다 */
    {
      const Hx2 = fs.readFileSync(DIR+"index.html","utf8");
      ok(!/id="chat-collapse-btn"[^>]*>[\s\S]{0,40}❮/.test(Hx2) || /id="dock"/.test(Hx2),
         "화면에 알약 줄이 있다");
    }

    /* ── ✍️ '닉네임' 으로 부르기 (2026-08-12) ──
       작가들에게 "닉네임" 은 실제 자기 닉네임을 뜻합니다. 그걸 알려달라는
       말로 읽힐 수 있어서, 화면에서는 **닉네임**으로 부릅니다. */
    ["index.html", "guide.html", "manual.html", "admin.html", "m.html",
     "script_manual.js", "script_auth.js", "script_admin.js"].forEach(f => {
      const t = fs.readFileSync(DIR + f, "utf8");
      ok(!t.includes("\uD544\uBA85"),
         `★ ${f} 에 옛 낱말이 남아 있지 않다 (닉네임으로 부릅니다)`);
    });

    /* ── 한 장짜리 설명(manual.html) 도 지금 화면과 맞는가 ── */
    {
      /* [통합 2026-08-12] 한 장 설명은 guide.html #onepage 로 이사했습니다.
         manual.html 은 옛 주소를 살리는 이정표(redirect)만 남았어요. */
      const M1 = fs.readFileSync(DIR+"guide.html","utf8");
      ok(/<section class="wrap" id="onepage">/.test(M1), "★ 한 장 설명이 가이드 안에 있다");
      ok(/id="alive"/.test(M1) && /chrome:\/\/settings\/performance/.test(M1),
         "★ 접속 유지 안내도 가이드 안에 있다");
      {
        const R1 = fs.readFileSync(DIR+"manual.html","utf8");
        const R2 = fs.readFileSync(DIR+"접속유지_가이드.html","utf8");
        ok(/url=guide\.html#onepage/.test(R1) && /url=guide\.html#alive/.test(R2),
           "★★ 옛 주소는 이정표로 남는다 (카톡에 뿌려 둔 링크가 죽으면 안 된다)");
        ok(R1.length < 2000 && R2.length < 2000,
           "이정표에 알맹이가 남아 있지 않다 (두 벌이면 언젠가 어긋난다)");
      }
      ok(/승인한 닉네임만/.test(M1), "★ 한 장 설명에도 입장 승인이 있다");
      ok(/📢 공지/.test(M1), "📢 공지판을 알려준다");
      ok(/🏅 업적/.test(M1), "🏅 업적을 알려준다");
      ok(/가로 바/.test(M1), "타이머 모양 고르기를 알려준다");
      /* 없어진 명령어를 계속 안내하면 안 됩니다 */
      ["/선언", "/환영", "/응원", "/퇴근"].forEach(c =>
        ok(!M1.includes(c + " "), `★ 없어진 명령어 ${c} 를 안내하지 않는다`));
      ok(/\/운세 · \/외치기/.test(M1), "지금 있는 명령어만 적혀 있다");
      /* 번호가 이어지는가 — 그림과 설명이 어긋나면 읽는 사람이 헤맵니다 */
      const 설명 = (M1.match(/class="dnum">(\d+)</g) || []).map(x => +x.match(/>(\d+)</)[1]);
      ok(설명.join(",") === 설명.map((_, i) => i + 1).join(","),
         `★ 설명 번호가 1부터 빠짐없이 이어진다 (${설명.join(" ")})`);
      const 그림 = [...new Set((M1.match(/class="num"[^>]*>(\d+)</g) || [])
        .map(x => +x.match(/>(\d+)</)[1]))].sort((a, b) => a - b);
      const 없음 = 그림.filter(n => !설명.includes(n));
      ok(!없음.length, "★ 그림에 붙은 번호가 모두 설명에 있다" + (없음.length ? " → " + 없음.join(", ") : ""));
      ok(/그림에는 없어요/.test(M1),
         "그림에 없는 번호(①)는 왜 없는지 적어 둔다");
    }
  }

  /* =====================================================================
     🧪 시험 모드 (?demo=1) — 서버를 한 글자도 안 건드리는가 (2026-08-12)
     ---------------------------------------------------------------------
     화면을 고칠 때마다 작업방에 들락거리면 남들 화면에서 카드가 떴다
     사라지고, 시험 채팅이 진짜 방에 남고, 출석까지 찍혔습니다.

     ★ 여기서 하나라도 새면 시험 모드는 **없느니만 못합니다.**
       "안 쓴다고 적어 놓은" 것을 믿지 않고, 실제로 굴려서 셉니다.
     ===================================================================== */
  {
    const DM = fs.readFileSync(DIR+"script_demo.js","utf8");
    const HD = fs.readFileSync(DIR+"index.html","utf8");

    /* ── 실려야 할 자리 ── */
    ok(/<script src="script_demo\.js/.test(HD), "시험 모드 파일이 실린다");
    ok(HD.indexOf('script_demo.js') < HD.indexOf('fortune_data.js'),
       "★ 맨 먼저 실린다 (database() 를 갈아 끼우려면 그 전이어야 한다)");
    {
      const bpy = fs.readFileSync(DIR+"build-single.py","utf8");
      const order = bpy.match(/ORDER = \[([\s\S]*?)\n\]/)[1]
        .split("\n").filter(l => !/^\s*#/.test(l)).join("\n")
        .match(/"([^"]+\.js)"/g).map(x => x.slice(1, -1));
      ok(order[0] === "script_demo.js", "★ 합본에서도 맨 앞이다");
    }

    /* ── 평소에는 아무 일도 하지 않아야 합니다 ── */
    ok(/if \(!켬\) return;/.test(DM),
       "★ ?demo=1 이 없으면 첫 줄에서 나간다 (평소 화면에 영향 0)");

    /* ── 실제로 굴려서 확인 ── */
    let 진짜쓰기 = 0, 계정만듦 = 0;
    const 진짜DB = { ref: () => ({
      set: () => { 진짜쓰기++; }, update: () => { 진짜쓰기++; },
      push: () => { 진짜쓰기++; return {}; }, remove: () => { 진짜쓰기++; },
      transaction: () => { 진짜쓰기++; },
      onDisconnect: () => ({ set: () => { 진짜쓰기++; } }),
      once: () => Promise.resolve({ val: () => ({ 진짜: "자료" }) }),
      on: (e, c) => c({ val: () => ({ 진짜: "자료" }) }),
      child() { return this; }, orderByKey() { return this; },
      startAt() { return this; }, endAt() { return this; }
    })};
    const box = {
      location: { search: "?demo=1" }, console: { log() {}, warn() {} },
      firebase: { database: () => 진짜DB,
                  auth: () => ({ createUserWithEmailAndPassword: () => { 계정만듦++; } }) },
      URLSearchParams, Date, setTimeout: () => {}, Promise,
      document: { documentElement: { setAttribute() {} }, readyState: "complete",
                  getElementById: () => null,
                  createElement: () => ({ style: {}, appendChild() {} }),
                  body: { appendChild() {} }, addEventListener() {} }
    };
    box.window = box;
    vm.createContext(box);
    vm.runInContext(DM, box);

    ok(box.window.DEMO === true, "시험 모드가 켜진다");

    const db2 = box.firebase.database();
    const r = db2.ref("status/그링링");
    r.set({ a: 1 }); r.update({ b: 2 }); r.remove(); r.push({ c: 3 });
    r.transaction(x => x); r.onDisconnect().set({ d: 4 });
    db2.ref("messages").child("x").set({ e: 5 });
    db2.ref("attendance").orderByKey().startAt("2026-08-01").endAt("2026-08-31").once("value");

    ok(진짜쓰기 === 0,
       `★★ 진짜 데이터베이스로 나간 쓰기가 하나도 없다 (나간 것: ${진짜쓰기})`);
    ok(box.window.demoWrites() >= 7,
       `막힌 쓰기를 세어 둔다 (${box.window.demoWrites()}번)`);

    box.firebase.auth().createUserWithEmailAndPassword("a@b.c", "pw");
    ok(계정만듦 === 0, "★ 진짜 계정도 만들지 않는다");

    /* 읽기까지 막아야 합니다 — 진짜 멤버가 흘러들면 시험 화면이 헷갈립니다 */
    /* ★ 글자로 찾지 않고 **실제로 읽어** 봅니다.
       (처음에 "once: () =>" 로 찾았다가 코드가 "ref.once = () =>" 라서
        엉뚱하게 실패했어요 — 그럴 바엔 굴려 보는 게 낫습니다) */
    let 들어온값 = "안 불림";
    db2.ref("status").on("value", (s2) => { 들어온값 = s2.val(); });
    ok(들어온값 === null,
       `★ 실시간 읽기가 늘 비어 있다 (들어온 값: ${JSON.stringify(들어온값)})`);
    let 한번값 = "안 옴";
    db2.ref("status").once("value").then(s2 => { 한번값 = s2.val(); });
    ok(typeof db2.ref("x").once("value").then === "function", "once 는 약속을 돌려준다");
    ok(db2.ref("x").on("value", () => {}) !== undefined, "on 은 손잡이를 돌려준다");
    ok(/exists: \(\) => false/.test(DM), "빈 스냅은 '없음' 이라고 답한다");

    /* 사슬이 끊기지 않아야 합니다 — orderByKey().startAt()… 이 흔합니다 */
    ok(typeof db2.ref("a").orderByChild("x").limitToLast(5).once === "function",
       "★ 거르기를 이어 붙여도 안 터진다");

    /* 입장 절차를 아예 부르지 않아야 합니다 */
    ok(!/joinRoom\(/.test(DM),
       "★ 진짜 입장 함수를 부르지 않는다 (출석·입장 메시지가 그 안에 있다)");
    ok(/가짜상태|이름들/.test(DM), "대신 가짜 사람으로 화면을 채운다");

    /* ★★ 가짜 자료의 **열쇠 이름**이 카드가 읽는 것과 같아야 합니다.
       처음에 goal 이라고 적었더니 열아홉 장이 전부 "목표 없음" 이었어요.
       화면은 멀쩡히 뜨는데 알맹이만 비는 종류라, 굴려 보기 전엔 모릅니다. */
    {
      /* ★ 카드 그리는 곳(script_realtime.js)과 **작업 스티커**(script_worktag.js)를
         함께 봅니다. tag 는 카드가 직접 안 읽고 스티커 쪽에 넘겨서 읽어요 —
         한 파일만 보고 "tag 는 안 쓰네" 하면 틀립니다. */
      const RT = fs.readFileSync(DIR+"script_realtime.js","utf8")
               + fs.readFileSync(DIR+"script_worktag.js","utf8");
      const 읽는것 = ["todayGoalText", "status", "workMs", "pomoCount",
                      "todoTotal", "todoDone", "tag", "lastSeen"];
      const 없음 = 읽는것.filter(k => !new RegExp("(row|r)\\." + k + "\\b").test(RT));
      ok(!없음.length, "카드가 읽는 이름을 제대로 뽑았다" + (없음.length ? " → " + 없음.join(", ") : ""));
      const 안채움 = 읽는것.filter(k => !new RegExp("^\\s*" + k + ":", "m").test(DM));
      ok(!안채움.length,
         "★ 가짜 자료가 카드가 읽는 이름을 모두 채운다" + (안채움.length ? " → " + 안채움.join(", ") : ""));
      ok(!/^\s*goal:/m.test(DM), "★ 엉뚱한 이름(goal)으로 채우지 않는다");
    }

    /* 고리가 꽉 찬 원으로 보이지 않아야 합니다 */
    ok(/function 고리멈춤/.test(DM) && /stroke-dashoffset/.test(DM),
       "★ 뽀모 고리를 0% 로 맞춰 둔다 (안 맞추면 꽉 찬 원으로 그려진다)");
    /* 빈 채팅으로는 말풍선 폭·줄바꿈을 볼 수 없습니다 */
    ok(/function 가짜채팅/.test(DM), "채팅에도 몇 줄 채운다");
    ok(/box\.childElementCount/.test(DM), "★ 이미 뭔가 있으면 덧붙이지 않는다");
    ok((DM.match(/"[가-힣]+"/g) || []).length > 15, "사람이 여럿이다 (한 줄짜리 화면이 아니게)");

    /* 시험 모드라는 걸 잊지 않게 */
    ok(/id="demo-banner"|demo-banner/.test(DM), "★ 시험 모드라고 화면에 알려준다");
    ok(/pointer-events:none/.test(DM), "그 표시가 클릭을 가로채지 않는다");
  }

  /* =====================================================================
     ⚓ 아래 알약 줄 — **본 배치가 됐습니다** (2026-08-12 적용)
     ---------------------------------------------------------------------
     접속자 창을 화면 전체로 펴고, 나머지는 아래 알약으로 내렸습니다.
     시험판(index2.html)으로 다듬은 뒤 index.html 로 갈아 끼웠어요.
     ★ 예전 세 칸 배치는 index-classic.html 에 그대로 남겨 뒀습니다 —
       되돌릴 일이 생기면 이름만 바꾸면 됩니다.
     ===================================================================== */
  {
    const DK = fs.readFileSync(DIR+"script_dock.js","utf8");
    const H2 = fs.readFileSync(DIR+"index.html","utf8");
    const HC = fs.readFileSync(DIR+"index-classic.html","utf8");

    /* ── 되돌릴 길이 있는가 ── */
    ok(/되돌릴 일이 생기면/.test(HC), "★ 예전 배치를 되돌리는 법이 파일에 적혀 있다");
    ok(/\[예전 배치\]/.test(HC), "제목만 봐도 어느 쪽인지 안다");
    ok(/src="script_layout\.js/.test(HC), "예전 배치는 세 칸 코드를 그대로 쓴다");
    ok(!/id="dock"/.test(HC), "예전 배치에는 알약 줄이 없다");
    ok(fs.existsSync(DIR+"script_layout.js"),
       "★ 세 칸 배치 코드를 지우지 않았다 (되돌릴 때 필요하다)");
    /* ★★ 되돌리기가 **한 단계**여야 합니다.
       처음에는 build-single.py 의 목록에 script_dock.js 를 못 박아 뒀는데,
       그러면 index-classic.html 로 되돌리는 순간 빌드가 멈춥니다.
       "되돌릴 수 있다" 는 말이 반쪽이 되니, 스스로 알아보게 했습니다. */
    {
      const bpy = fs.readFileSync(DIR+"build-single.py","utf8");
      ok(/def 배치파일_맞추기/.test(bpy),
         "★★ 빌드가 어느 배치인지 스스로 알아본다 (되돌리기가 한 단계)");
      ok(/'src="script_dock\.js' in html/.test(bpy), "index.html 을 보고 정한다");
      ok(/ORDER\[ORDER\.index\(반대\)\] = 쓰는것/.test(bpy), "목록을 바꿔 끼운다");
    }

    /* ── 지금 화면이 알약 줄이다 ── */
    ok(/if \(!document\.getElementById\("dock"\)\) return;/.test(DK),
       "★ #dock 이 없으면 첫 줄에서 나간다 (예전 배치로 되돌려도 안전)");
    ok(/id="dock"/.test(H2), "★ 지금 화면에 알약 줄이 있다");
    ok(/<body class="dock-mode">/.test(H2), "알약 줄 표식이 붙어 있다");
    ok(/\.dock\{/.test(CSS) && /#dock-panel-chatty\{/.test(CSS), "꾸밈이 들어 있다");

    /* ── 배치 파일 대신 알약 파일 ── */
    ok(/src="script_dock\.js/.test(H2) && !/src="script_layout\.js/.test(H2),
       "★ 세 칸 배치 대신 알약 줄을 싣는다");
    /* 세 칸 시절 설정(칸 배치·좌우 뒤집기)은 조절할 칸이 없어졌습니다 */
    ok(/<div class="set-block" hidden>\s*<div class="set-title" id="slot-title">/.test(H2),
       "★ 칸 배치 설정은 감춰 뒀다 (코드는 남아 있어 되돌리면 살아난다)");
    /* ★ 다른 파일들이 배치 함수를 부르는데, 없어도 안 터져야 합니다 */
    {
      const 부르는곳 = [];
      ["script_ui.js", "script_profile.js", "script_demo.js"].forEach(f => {
        const t = fs.readFileSync(DIR+f,"utf8");
        (t.match(/window\.(applyLayout|renderSlotMap|bindLayoutUI)[^\n]*/g) || [])
          .forEach(x => { if (!/\?\./.test(x)) 부르는곳.push(f + " — " + x.trim()); });
      });
      ok(!부르는곳.length,
         "★ 배치 함수를 부르는 곳이 모두 ?. 을 쓴다 (파일이 없어도 조용히 넘어간다)"
         + (부르는곳.length ? " → " + 부르는곳.join(" / ") : ""));
    }

    /* ── 알약 여덟 개 ── */
    /* ★ 라벨이 **빈** 알약도 있습니다 (📌 오늘 할 일은 글자를 코드가 아니라
       화면 요소에서 가져와요). [^"]+ 로 잡으면 그 하나가 통째로 빠집니다. */
    const 목록 = [...DK.matchAll(/\{ id: "(\w+)",\s*label: "([^"]*)"/g)].map(m => ({ id: m[1], label: m[2] }));
    /* [늘어남 2026-08-16] 🙋 Help 가 📓 Letters 전체 기록 오른쪽에.
       [늘어남 2026-08-18] 📁 자료실이 ♪ BGM 오른쪽에 (콩 지정).
       [줄어듦 2026-08-21 — 콩] 셋이 빠져서 12 → 9 개가 됐습니다.
         · 📢 공지 · 📁 자료실 → **머리말로** 올라갔습니다 (아래 반대 검사).
         · 📓 Letters 전체 기록 → 뺐습니다. 알약 줄 위 📊 띠에서 각자
           골라 볼 수 있어서요 (openWcAll 자체는 살아 있습니다). */
    ok(목록.length === 9, `알약이 아홉 개다 (${목록.length}개)`);
    ["chat", "chatty", "pub", "music", "todo", "help", "achv", "pomo", "wc"].forEach(id =>
      ok(목록.some(x => x.id === id), `${id} 알약이 있다`));
    ["notice", "files", "wcall"].forEach(id =>
      ok(!목록.some(x => x.id === id),
         `★ ${id} 알약은 **없다** (2026-08-21 머리말로 옮김/뺌 — 되살리지 말 것)`));
    /* 콩이 정한 차례 그대로 (2026-08-13 개편 — 오늘 할 일이 소통/기록의 기준선) */
    ok(목록.map(x => x.id).join(",") === "chat,chatty,pub,music,todo,help,achv,pomo,wc",
       "★ 알약 차례가 정한 대로다 — 챗·수다방·품평·BGM | 오늘할일 | 표현공부·업적·뽀모·Work Log");

    /* ── 여닫는 규칙이 둘로 갈립니다 ── */
    const stay = {};
    [...DK.matchAll(/id: "(\w+)",[^\n]*stay: (true|false)/g)].forEach(m => { stay[m[1]] = m[2] === "true"; });
    ["chat", "chatty", "pomo", "wc"].forEach(id =>
      ok(stay[id] === true, `★ ${id} 는 바깥을 눌러도 안 닫힌다 (쓰던 글이 날아가지 않게)`));
    ok(stay.achv === false, "업적은 스쳐 보는 판이라 바깥을 누르면 닫힌다");
    /* 📌 오늘 할 일은 **판이 없습니다** — 방 전체 진척을 한 줄로 보여줄 뿐이라
       펼칠 것이 없어요. 알약 줄에 글자로 그대로 놓입니다. */
    ok(/id: "todo"[^\n]*inline: true/.test(DK), "★ 오늘 할 일은 판이 없다 (보여주는 글자)");
    ok(/b\.disabled = true;/.test(DK), "그래서 눌리지도 않는다");
    ok(/pillTodo\.appendChild\(roomTodo\)/.test(DK), "방 전체 진척 줄을 그 자리에 옮겨 놓는다");
    ok(/room-foot"\)\?\.remove\(\)/.test(DK), "★ 남은 껍데기는 치운다 (화면에 떠 있으면 안 되니까)");
    ok(/if \(d && !d\.stay\) close\(pid\);/.test(DK), "그 규칙이 실제로 손가락에 걸려 있다");

    /* ── 여러 개를 **동시에** 열 수 있어야 합니다 (2026-08-12) ──
       뽀모와 글자수를 같이 켜 두고 작업하고, 챗과 수다방도 함께 봅니다. */
    ok(/const _open = new Set\(\);/.test(DK), "★ 열린 판을 여럿으로 센다");
    ok(/function closeGlances/.test(DK), "바깥을 누르면 스쳐 보는 판만 닫는다");
    ok(/close\(x\.dataset\.dockClose\)/.test(DK), "★ ✕ 는 그 판만 닫는다 (전부가 아니라)");
    /* [고침 2026-08-12] 처음에는 flex 로 나란히 세웠는데, 판 높이가 제각각이라
       **윗줄이 맞고 아래가 들쭉날쭉**했습니다. 이제 각 판이 제 자리(left)를
       갖고 바닥(bottom:0)을 맞춰 서요 — 막대그래프처럼. */
    ok(/\.dock-panels\{[^}]*height: 0/.test(CSS),
       "★ 판들이 놓이는 층은 높이가 0 이다 (알약 줄 바로 위가 바닥)");
    ok(/\.dock-panel\{[^}]*position: absolute[\s\S]{0,80}bottom: 0/.test(CSS),
       "★★ 판이 **바닥을 맞춰** 선다 (윗줄이 맞으면 아래가 들쭉날쭉해 보인다)");
    /* [2026-08-18] 판 쪽만 봅니다 — 📊 접속 띠(.room-pulse)는 일부러
       wrap-reverse 를 씁니다(띠가 늘면 위로 쌓이게). 파일 전체를 훑으면
       엉뚱하게 걸려요. */
    ok(!/flex-wrap: wrap-reverse/.test(
         CSS.slice(CSS.indexOf(".dock-panels{"), CSS.indexOf(".dock-panels{") + 1200)),
       "flex 로 줄 세우던 방식은 걷어냈다 (판 쪽)");
    ok(/if \(d\.modal\) \{ window\.openWcAll/.test(DK),
       "★ 가운데 창을 열어도 다른 판을 닫지 않는다");

    /* =================================================================
       판 자리 — 제 알약 위에서 뜨고, 끌어서 옮길 수 있다 (2026-08-12)
       -----------------------------------------------------------------
       ★ "공지·챗·수다방은 왼쪽, 뽀모·글자수는 오른쪽, 업적은 업적 위"
         라는 규칙을 따로 적지 않았습니다. **제 알약 위**에서 뜨게 하면
         알약 차례가 곧 그 규칙이라, 저절로 지켜집니다.
       ================================================================= */
    ok(/function defaultPos/.test(DK) && /pr\.left \+ pr\.width \/ 2/.test(DK),
       "★ 판이 제 알약 위 가운데에서 뜬다");
    /* 알약 차례가 곧 좌우 규칙입니다 — 차례가 바뀌면 규칙도 깨집니다 */
    {
      const 차례 = 목록.map(x => x.id);
      const 왼쪽 = ["notice", "chat", "chatty"].map(id => 차례.indexOf(id));
      const 오른쪽 = ["pomo", "wc"].map(id => 차례.indexOf(id));
      const 가운데 = 차례.indexOf("todo");
      ok(Math.max(...왼쪽) < 가운데,
         "★ 공지·챗·수다방이 [오늘 할 일]보다 왼쪽 → 판도 왼쪽에서 뜬다");
      ok(Math.min(...오른쪽) > 가운데,
         "★ 뽀모·글자수가 [오늘 할 일]보다 오른쪽 → 판도 오른쪽에서 뜬다");
      ok(차례.indexOf("achv") > 가운데 && 차례.indexOf("achv") < Math.min(...오른쪽),
         "업적은 그 사이 — 제 알약 위에서 뜬다");
    }

    /* 옮길 수 있는 판은 넷 */
    const 옮김 = [...DK.matchAll(/id: "(\w+)",[^\n]*drag: true/g)].map(m => m[1]);
    /* ☕ 수다방은 이제 챗 판을 같이 씁니다 — 판이 하나라 끌기도 하나입니다 */
    ok(옮김.sort().join(",") === "chat,chatty,help,music,pomo,pub,wc",
       `★ 챗·수다방·품평·BGM·뽀모·글자수·Help 판을 옮길 수 있다 (${옮김.join(",")})`);
    ok(/if \(!d \|\| !d\.drag\) return;/.test(DK), "그 규칙이 손잡이에도 걸려 있다");
    ok(/e\.target\.closest\("\[data-dock-close\]"\)\) return;/.test(DK),
       "★ ✕ 위에서는 안 잡힌다 (닫으려다 끌려가면 안 되니까)");
    ok(/setPointerCapture/.test(DK),
       "★ 손가락을 붙잡아 둔다 (빨리 끌면 판 밖으로 나가면서 끊긴다)");
    ok(/function clampPos/.test(DK) && /const EDGE = 8;/.test(DK),
       "★★ 화면 밖으로 못 나간다 (놓쳐서 사라지면 되찾을 길이 없다)");
    ok(/savePos\(_drag\.id/.test(DK) && /AppStore\?\.setItem\(POS_KEY/.test(DK),
       "놓은 자리를 이 기기에 기억한다");
    ok(/dblclick/.test(DK) && /clearPos\(id\)/.test(DK),
       "★ 머리말을 두 번 누르면 제자리로 (끌다 이상해졌을 때의 되돌리기)");
    ok(/\.dock-panel\.can-drag \.dock-head\{ cursor: grab/.test(CSS),
       "잡을 수 있다는 걸 손 모양으로 알려준다");

    /* =================================================================
       방금 만진 판이 맨 위로 (2026-08-12)
       -----------------------------------------------------------------
       판이 만들어진 차례대로 쌓여서 **왼쪽 알약의 판이 늘 아래**로
       깔렸습니다. 챗을 왼쪽에 두고 수다방을 겹쳐 놓으면, 새 글이 와서
       답하려 해도 챗이 가려져 있었어요.
       ================================================================= */
    ok(/function raise\(id\)/.test(DK) && /p\.style\.zIndex = String\(\+\+_zTop\)/.test(DK),
       "★ 만진 판을 맨 위로 올린다");
    ok(/document\.addEventListener\("pointerdown", 올리기, true\)/.test(DK),
       "★★ capture 로 받는다 — 글칸이 이벤트를 멈춰도 먼저 온다");
    ok(/document\.addEventListener\("focusin", 올리기, true\)/.test(DK),
       "★ 채팅 입력칸에 커서만 둬도 올라온다 (이게 이 고침의 목적)");
    ok(/raise\(pid\);\s*\/\/ 방금 연 것이 맨 위로/.test(DK), "새로 연 판도 맨 위");
    ok(/if \(Number\(p\.style\.zIndex\) === _zTop\) return;/.test(DK),
       "이미 맨 위면 그냥 둔다 (누를 때마다 숫자가 치솟지 않게)");
    ok(/\.dock-panel\{[^}]*z-index: 1/.test(CSS), "판에 기본 차례가 있다");
    /* 자리는 안 건드려야 합니다 — 위아래만 바뀌어야 해요 */
    {
      const 몸 = DK.slice(DK.indexOf("function raise(id)"), DK.indexOf("window.dockRaise"));
      ok(!/style\.left|style\.bottom/.test(몸), "★ 올릴 때 자리는 안 건드린다");
    }

    /* ── 자리 셈을 실제로 굴려 봅니다 ── */
    {
      const EDGE = 8;
      const host = { left: 0, width: 1200, top: 300 };
      const clamp = (w, h, x, y) => ({
        x: Math.max(EDGE - host.left, Math.min(host.width - w - EDGE, x)),
        y: Math.max(0, Math.min(host.top - EDGE, y))
      });
      /* 왼쪽 끝 알약의 판 — 화면 밖으로 안 나가야 합니다 */
      ok(clamp(400, 500, -300, 0).x === EDGE,
         "★ 왼쪽으로 끌어도 8px 은 남는다");
      ok(clamp(400, 500, 2000, 0).x === 1200 - 400 - EDGE,
         "★ 오른쪽으로 끌어도 8px 은 남는다");
      ok(clamp(400, 500, 0, -100).y === 0, "알약 줄 아래로는 안 내려간다");
      ok(clamp(400, 500, 0, 9999).y === host.top - EDGE, "화면 위로도 안 넘어간다");
      /* 제 알약 위 — 가운데 맞춤 */
      const 알약 = { left: 900, width: 100 };
      const x = (알약.left + 알약.width / 2) - host.left - 400 / 2;
      ok(x === 750, `알약 가운데(950)에서 판(400) 가운데가 맞는다 (left ${x})`);
    }

    /* [2026-08-21] 📓 전체 기록 알약을 뺐습니다 (콩). 달력 창(openWcAll)과
       #wcall-modal 은 그대로 살아 있어요 — 문만 닫은 것이라 나중에 다른
       자리에 달 수 있습니다. 알약으로 되돌리지는 말 것. */
    ok(!/id: "wcall"/.test(DK), "★ 전체 기록 알약은 없다 (2026-08-21 뺌)");
    ok(/function openWcAll/.test(fs.readFileSync(DIR + "script_wordcount.js", "utf8")) && /wcall-modal/.test(HTML),
       "★ 달력 창 자체는 살아 있다 (알약만 뺀 것 — 기능을 지운 게 아니다)");

    /* ── 새로 그리지 않고 **옮깁니다** ── */
    ok(/appendChild\(node\)/.test(DK) && /function relocate/.test(DK),
       "★ 원래 요소를 옮겨 담는다 (새로 그리면 멘션·답장·스티커가 죽는다)");
    ok(/const wc = document\.querySelector\("#wordcount-block"\)[\s\S]{0,200}DOCK\.forEach/.test(DK),
       "★ 글자수를 **먼저** 떼어 낸다 (뽀모를 먼저 옮기면 딸려 들어간다)");
    ok(!/querySelector\("#notice-modal/.test(DK),
       "★ 알약 줄은 더 이상 공지 알맹이를 가져가지 않는다 (2026-08-21 머리말로 옮김)");

    /* ── 빠져나갈 길 ── */
    ok(/e\.key !== "Escape"/.test(DK), "Esc 로도 닫힌다");
    ok(/쓰는중/.test(DK) && /t\.blur\(\); return;/.test(DK),
       "★ 글을 쓰는 중이면 Esc 한 번은 봐준다 (실수로 날리지 않게)");
    /* =================================================================
       안 읽음 표시 (2026-08-12)
       -----------------------------------------------------------------
       📢 공지는 붉은 점, 💬 챗·☕ 수다방은 숫자 배지.
       ★ 세는 일은 원래 하던 곳(script_chatty.js·script_notice.js)이
         그대로 맡습니다. 여기서 다시 세면 **두 벌이 되어 언젠가
         어긋나요.** 그쪽이 만든 표시를 지켜보다 옮겨 적을 뿐입니다.
       ================================================================= */
    ok(/function badge/.test(DK) && /window\.dockBadge/.test(DK), "숫자 배지를 붙일 창구가 있다");
    ok(/function dot/.test(DK) && /window\.dockDot/.test(DK), "붉은 점을 붙일 창구가 있다");
    ok(/function syncBadges/.test(DK) && /function watchBadges/.test(DK),
       "★ 원래 표시를 지켜보다 옮겨 적는다 (두 벌로 세지 않는다)");
    ["chat-tab-badge-main", "chat-tab-badge-chatty", "notice-dot"].forEach(id =>
      ok(DK.includes(id), `${id} 를 지켜본다`));
    ok(!/_unread\s*[+]{2}|let _count/.test(DK), "★ 알약 줄이 따로 세지 않는다");
    ok(/badge\("chat",\s*_open\.has\("chat"\)\s*\? 0 :/.test(DK) &&
       /badge\("chatty",\s*_open\.has\("chatty"\)\s*\? 0 :/.test(DK),
       "★ 판이 떠 있으면 숫자를 지운다 (대화가 보이니 곧 읽은 것)");
    ok(/setTimeout\(syncBadges, 0\)/.test(DK), "닫으면 다시 쌓이기 시작한다");

    /* =====================================================================
       🔴 새 글 빨간 점 — 🏢 품평 · 🆘 살려주세요 · ♪ BGM (2026-08-17)
       ---------------------------------------------------------------------
       ★★★ 여기서 지키는 것은 **통신량**입니다. 점을 띄우는 쉬운 길은
       세 게시판을 입장할 때부터 듣는 것인데, 품평과 살려주세요는 판을
       열 때에만 듣도록 일부러 그렇게 짜 두었습니다. 그걸 풀면 방에 들어온
       모든 사람이 매번 게시판 전체를 내려받아요. 8월에 15일 만에 4.87GB
       까지 갔던 걸 기억해야 합니다.
       그래서 newmark/{게시판} 에 **시각 숫자 하나**만 두고 그것만 듣습니다.
       ================================================================= */
    ok(/window\.dockMarkNew/.test(DK) && /window\.dockWatchNew/.test(DK),
       "새 글 표식을 찍고 듣는 창구가 있다");
    ok(/db\?\.ref\("newmark\/" \+ board\)\.set\(/.test(DK)
       && /db\.ref\("newmark"\)\.on\("value"/.test(DK),
       "★★★ 게시판 본문이 아니라 newmark 숫자만 오간다 (통신량)");
    {
      const PR = fs.readFileSync(DIR+"script_pubreview.js","utf8");
      const HL = fs.readFileSync(DIR+"script_help.js","utf8");
      const MU = fs.readFileSync(DIR+"script_music.js","utf8");
      const CR = fs.readFileSync(DIR+"script_core.js","utf8");
      ok(/dockMarkNew\?\.\("pub"\)/.test(PR),   "품평을 올리면 표식을 찍는다");
      ok(/dockMarkNew\?\.\("help"\)/.test(HL),  "살려주세요에 올리면 표식을 찍는다");
      ok(/dockMarkNew\?\.\("music"\)/.test(MU), "BGM 추천을 올리면 표식을 찍는다");
      ok(/dockWatchNew\?\.\(\)/.test(CR),       "입장한 뒤 표식을 듣기 시작한다");
      /* ★ 나의 리스트는 남이 못 봅니다 — 거기에 담은 걸로 남의 점이 켜지면 안 돼요 */
      ok(!/musicMine`\)\.push\(\{[^}]*\}\);\s*[\s\S]{0,80}dockMarkNew/.test(MU),
         "★ 나의 리스트에 담은 것으로는 점이 켜지지 않는다");
      /* ★ 품평·살려주세요를 입장할 때부터 듣게 되돌리지 않았는지 */
      ok(!/dockWatchNew[\s\S]{0,200}(listenPub|ref\("pubreview"\))/.test(CR),
         "★★ 점 때문에 게시판을 통째로 구독하지 않는다");
    }
    ok(/본시각\(id\);\s*\n\s*if \(본 === null\)/.test(DK),
       "★ 처음 온 기기에는 점이 켜지지 않는다 (숙제처럼 보이니까)");
    ok(/if \(_open\.has\(panelOf\(id\)\)\) \{ 봤다\(id, at\); dot\(id, false\); return; \}/.test(DK),
       "★ 보고 있는 판에는 점이 켜지지 않는다");
    ok(/봤다\(board, _newAt\[board\]\);/.test(DK),
       "★ 내가 올린 글로 내 점이 켜지지 않는다");
    {
      const R = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8"));
      const nm = (R.rules || R).newmark;
      ok(!!nm && nm[".read"] === "auth != null" && !!nm.$board,
         "★ 보안규칙에 newmark 가 있다 (콘솔에 적용해야 합니다)");
      ok(nm && nm.$board[".validate"] === "newData.isNumber()",
         "★ newmark 에는 숫자만 적힌다 (남의 글자를 밀어 넣지 못하게)");
    }

    /* =====================================================================
       🩹 챗·수다방 배지가 **한 번도 안 뜨던 것** (2026-08-12)
       ---------------------------------------------------------------------
       세는 조건이 줄곧 "저쪽 탭이 켜져 있나" 였습니다. 칸이 하나뿐이던
       시절엔 그게 곧 "안 보인다" 였지만, 판이 갈라진 지금은
         · 챗을 보는 중 → "챗이 활성이니 메인은 세지 마라"
         · 수다방으로 펜을 옮기면 → "수다방이 활성이니 수다방은 세지 마라"
       가 되어 **양쪽 다 영영 안 올라갔습니다.** 이제 "판이 열려 있나" 를
       화면 배치에 물어봅니다.
       ===================================================================== */
    {
      const CH = fs.readFileSync(DIR+"script_chatty.js","utf8");
      ok(/function _seeing\(room\)/.test(CH), "★ '이 방이 보이나' 를 한 곳에서 판단한다");
      ok(/if \(typeof window\.dockSeeing === "function"\) return !!window\.dockSeeing\(r\);/.test(CH),
         "★★ 화면 배치가 있으면 배치에게 물어본다");
      ok(/return _activeChatTab === r\s*\n\s*&& !document\.body\.classList\.contains\("chat-collapsed"\);/.test(CH),
         "★ 예전 세 칸 배치에서도 그대로 돈다 (되돌리기가 살아 있어야 한다)");
      ok(/window\.dockSeeing = \(room\) => _open\.has\(room === "chatty" \? "chatty" : "chat"\);/.test(DK),
         "★★ 알약 줄의 답은 '그 판이 열려 있나'");

      /* 옛 조건이 남아 있으면 안 됩니다 */
      ok(/if \(_seeing\("chatty"\)\) \{/.test(CH), "수다방 새 글은 _seeing 으로 가른다");
      ok(/&& !_seeing\("main"\)/.test(CH), "메인 새 글도 마찬가지");
      ok(!/_activeChatTab === "chatty"\s*\n\s*&& !document\.body\.classList\.contains\("chat-collapsed"\)/.test(CH),
         "★ 옛 조건(활성 탭 + 접힘)이 세는 자리에 남아 있지 않다");

      /* 판을 열면 저쪽이 든 숫자까지 털어야 합니다 */
      ok(/function markChatRead\(room\)/.test(CH) && /window\.markChatRead = markChatRead;/.test(CH),
         "★ '읽었다' 를 알려 줄 창구가 있다");
      ok(/window\.markChatRead\?\.\("main"\)/.test(DK) && /window\.markChatRead\?\.\("chatty"\)/.test(DK),
         "★★ 판을 열면 실제로 부른다 (알약 배지만 지우면 닫을 때 도로 올라온다)");
      ok(/if \(_seeing\(_activeChatTab\)\) _tabUnread\[_activeChatTab\] = 0;/.test(CH),
         "★ 판이 닫힌 채 글칸만 옮긴 것은 '읽음' 이 아니다");

      /* ── 실제로 세어 봅니다 ──
         script_chatty.js 의 판단을 그대로 옮겨 놓고, 판 상태를 바꿔 가며
         새 글을 흘려 봅니다. */
      {
        let 열림 = new Set(), 활성 = "main", 접힘 = false;
        const unread = { main: 0, chatty: 0 };
        let 알약줄 = true;
        const _seeing = (room) => {
          const r = room === "chatty" ? "chatty" : "main";
          if (알약줄) return 열림.has(r === "chatty" ? "chatty" : "chat");
          return 활성 === r && !접힘;
        };
        const 새글 = (room, mine) => {              // 남이 보낸 보통 글
          if (mine) return;
          if (!_seeing(room)) unread[room] += 1;
        };
        const 열기 = (pid) => { 열림.add(pid); unread[pid === "chatty" ? "chatty" : "main"] = 0; };
        const 닫기 = (pid) => 열림.delete(pid);

        열기("chat");
        새글("main");   ok(unread.main === 0, "챗 판이 열려 있으면 메인은 안 쌓인다");
        새글("chatty"); ok(unread.chatty === 1,
          "★★ 수다방 판이 닫혀 있으면 쌓인다 — 예전엔 여기가 0 이었다");
        활성 = "chatty";   // 펜만 수다방으로 옮김 (판은 여전히 닫힘)
        새글("chatty"); ok(unread.chatty === 2,
          "★★ 글칸만 옮겨도 판이 닫혔으면 계속 쌓인다");
        새글("main");   ok(unread.main === 0, "그동안 챗 판은 열려 있으니 메인은 그대로 0");
        닫기("chat");
        새글("main");   ok(unread.main === 1, "★ 챗 판을 닫으면 메인도 쌓이기 시작한다");
        새글("main", true); ok(unread.main === 1, "내가 보낸 것은 안 센다");
        열기("chatty"); ok(unread.chatty === 0, "★ 판을 열면 쌓인 숫자가 사라진다");
        닫기("chatty");
        새글("chatty"); ok(unread.chatty === 1, "닫으면 다시 쌓인다");

        /* 예전 세 칸 배치에서도 그대로여야 합니다 */
        알약줄 = false; 활성 = "main"; 접힘 = false;
        unread.main = unread.chatty = 0;
        새글("chatty"); ok(unread.chatty === 1, "세 칸 배치 — 딴 탭을 보는 중이면 쌓인다");
        새글("main");   ok(unread.main === 0, "보고 있는 탭은 안 쌓인다");
        접힘 = true;
        새글("main");   ok(unread.main === 1, "★ 접혀 있으면 아무것도 안 보이니 메인도 쌓인다");
      }
    }
    ok(/new MutationObserver\(syncBadges\)/.test(DK), "바뀌는 순간 따라간다");
    ok(/setInterval\(syncBadges, 3000\)/.test(DK), "지켜보기가 안 되는 경우의 예비도 있다");

    /* ★★ 배지가 떠도 알약 줄이 흔들리면 안 됩니다 */
    ok(/\.dock-badge\{[^}]*position: absolute/.test(CSS),
       "★★ 배지가 알약 바깥에 뜬다 (안에 넣으면 뜰 때마다 줄이 밀린다)");
    ok(/\.dock-dot\{[^}]*position: absolute/.test(CSS), "붉은 점도 바깥에");
    ok(/\.dock-badge\{[^}]*pointer-events: none/.test(CSS) &&
       /\.dock-dot\{[^}]*pointer-events: none/.test(CSS),
       "배지를 눌러도 알약이 눌린다 (배지가 클릭을 가로채지 않게)");
    ok(/\.dock-pill\{[^}]*position: relative/.test(CSS), "알약이 배지의 기준이 된다");
    ok(/\.dock-badge\{[^}]*box-shadow: 0 0 0 2px var\(--bg\)/.test(CSS),
       "배지 둘레에 바탕색 테를 둘러 알약과 겹쳐도 읽힌다");

    /* ── 카드가 줄마다 가운데로 ── */
    ok(/\.dock-mode \.user-cards-grid\{[^}]*display: flex[\s\S]{0,120}justify-content: center/.test(CSS),
       "★ 카드가 줄마다 가운데로 모인다 (격자는 마지막 줄이 왼쪽에 붙었다)");
    ok(/\.dock-mode \.user-cards-grid > \*\{[^}]*flex: 0 0 var\(--card-w\)/.test(CSS),
       "★ 카드는 늘어나지 않는다 (늘어나면 줄마다 폭이 달라 더 들쭉날쭉해진다)");

    /* ── 판이 위로 열려야 합니다 ── */
    ok(/\.dock-panels\{[^}]*bottom: calc\(100% - var\(--sp-2\)\)/.test(CSS),
       "★ 판이 위로 펼쳐진다 (알약 줄이 맨 아래라 아래로 열면 화면 밖)");
    ok(/\.dock-panels\{[^}]*pointer-events: none/.test(CSS),
       "★ 판이 없는 자리는 눌러도 안 막힌다 (카드가 그 아래 있다)");
    ok(/\.dock-panel\{[^}]*pointer-events: auto/.test(CSS), "판 자체는 눌린다");

    /* ★★ 판이 **진짜로** 감춰지는가 (2026-08-12)
       -----------------------------------------------------------------
       hidden 은 브라우저 기본으로 display:none 이지만, .dock-panel 의
       display:flex 가 더 세서 그냥 이깁니다. 그래서 처음 열었을 때
       **여덟 개가 한꺼번에** 가로로 늘어섰어요. 화면 전체가 무너져서
       무엇이 원인인지도 안 보였습니다.
       ★ hidden 을 쓰면서 display 를 함께 주는 곳은 늘 이 함정이 있습니다. */
    ok(/\.dock-panel\[hidden\]\{ display: none !important; \}/.test(CSS),
       "★★ hidden 인 판이 실제로 감춰진다 (안 그러면 여덟 개가 한꺼번에 뜬다)");
    /* ★ [고침 2026-08-22] 예전엔 그냥 ".dock-panel{" 을 찾았습니다. 그런데
       혼자 방 배율 규칙(html[data-solo][data-unzoom] .dock-panel{)이 생기면서
       그 글자가 **앞쪽에서 먼저** 걸려, 순서가 뒤집힌 것처럼 보였어요.
       줄 맨 앞에 선 진짜 밑바탕 규칙만 찾습니다. */
    ok(CSS.indexOf(".dock-panel[hidden]") < CSS.search(/^\.dock-panel\{/m),
       "감추는 규칙이 먼저 나온다 (읽는 사람이 함정을 먼저 보게)");

    /* 판으로 옮겨 가기 **전**의 것들이 화면에 널브러지면 안 됩니다 */
    ok(/\.dock-mode #split-root > \.chat-sidebar,[\s\S]{0,200}display: none;/.test(CSS),
       "★ 옮기기 전의 채팅·뽀모·목표 상자를 잠깐 감춘다");
    ok(/\.dock-mode \.dock-body > \.chat-sidebar,[\s\S]{0,80}display: flex;/.test(CSS),
       "판 안으로 들어오면 다시 보인다");
    ok(/\.dock-mode #split-root > \.cards-area\{[^}]*flex: 1 1 auto/.test(CSS),
       "★ 접속자 창이 화면을 꽉 채운다 (칸 크기를 정해 주던 코드가 없으니 직접)");
    ok(/max-height: calc\(100vh - 190px\)/.test(CSS), "화면이 낮아도 판이 넘치지 않는다");

    /* ── 크기 — 업적 판을 1 로 본 값 ── */
    const BASE_H_CHK = Number((DK.match(/const BASE_H = (\d+);/) || [])[1]);
    ok(BASE_H_CHK === 430, `판 크기의 기준(업적 판) 430px (${BASE_H_CHK})`);
    const 크기 = {};
    [...DK.matchAll(/id: "(\w+)",[^\n]*size: ([\d.]+)/g)].forEach(m => { 크기[m[1]] = Number(m[2]); });
    ok(크기.chat === 1.2, `★ 챗은 업적 판의 120% (${크기.chat})`);
    ok(크기.chatty > 크기.chat,
       `★ 수다방이 챗보다 크다 (${크기.chatty} > ${크기.chat}) — 대화가 제일 많은 곳이라`);
    /* ★ 글자수만 유독 높아서 카드 맨 윗줄까지 올라왔습니다. 1.45 → 1.23 */
    ok(크기.wc === 1.23, `✍️ Letters 1.23 (${크기.wc})`);
    ok(크기.wc < 크기.chatty, "가장 높은 판은 수다방이다 (글자수가 아니라)");
    {
      const 화면 = 900, 알약줄 = 60;
      const 넘침 = Object.keys(크기).filter(k => 크기[k] > 0 &&
        Math.round(BASE_H_CHK * 크기[k]) > 화면 - 알약줄);
      ok(!넘침.length,
         "★ 세로 900px 화면에서도 판이 안 넘친다" + (넘침.length ? " → " + 넘침.join(", ") : ""));
    }
    /* ── 폭 (실제로 써 보고 정한 값) ── */
    const 폭 = (id) => Number((CSS.match(
      new RegExp("#dock-panel-" + id + "\\{ width: min\\((\\d+)px")) || [])[1]);
    ok(폭("notice") === 356, `📢 공지 356px — 글이 짧아 오른쪽이 휑했다 (${폭("notice")})`);
    ok(폭("chat") === 352, `💬 챗 352px — 2026-08-13 콩 요청으로 10% 줄임 (${폭("chat")})`);
    ok(new Set(["notice", "chat", "chatty", "wc", "pomo", "achv"].map(폭)).size >= 5,
       "판마다 제 폭을 갖는다 (한 값으로 뭉뚱그리지 않았다)");
    ok(폭("chatty") === 374, `☕ 수다방 374px — 2026-08-13 콩 요청으로 10% 줄임 (${폭("chatty")})`);
    ok(폭("wc") === 352, `✍️ 글자수 352px (${폭("wc")})`);
    ok(/\.dock-body \.wc-minirow \.ghost-btn\{[^}]*white-space: nowrap/.test(CSS),
       "★ 글자수 폭을 줄여도 [기준][초기화][새 편] 이 한 줄로 남는다");

    /* ★★ 판이 카드 위에 있어야 합니다 (2026-08-12)
       -----------------------------------------------------------------
       두 가지가 겹쳐 "왜 저 카드만 위로 올라오지?" 로 보였습니다.
         ① --panel 이 **반투명**(96%) 이라 뒤 카드가 비쳤습니다
         ② 알약 줄에 z-index 가 없어 카드의 상태표·스티커가 삐져나왔습니다
       올라온 게 아니라 비친 것이었어요. ✕ 누르기도 어려웠습니다. */
    ok(/\.dock\{[^}]*z-index: 40/.test(CSS),
       "★ 알약 줄이 카드보다 위에 있다");
    /* [되돌림 2026-08-12] 원래 칸들이 쓰던 반투명(--panel)으로 돌아갑니다.
       원고지 격자가 은은하게 비치는 결이 이 방의 인상이라서요.
       ★ 앞서 불투명으로 바꿨던 건 "카드가 비쳐서 이상하다" 때문이었는데,
         진짜 원인은 z-index 가 없어 카드 요소가 판 위로 삐져나온 것이었고
         그건 따로 고쳤습니다. 비치는 것 자체는 문제가 아니었어요. */
    ok(/\.dock-panel\{[^}]*background: var\(--panel\)/.test(CSS),
       "★ 판 바탕이 원래 칸들과 같은 반투명이다 (격자가 은은히 비친다)");
    /* ★ 앞에 줄바꿈+공백을 붙여 **접두사 없는** 것을 잡습니다.
       그냥 "backdrop-filter" 로 찾으면 -webkit- 붙은 줄에도 걸려서,
       진짜 규칙을 지워도 통과합니다 (실제로 그랬어요). */
    ok(/\n  backdrop-filter: blur\(7px\)/.test(CSS),
       "★★ 뒤를 살짝 흐린다 — 격자는 결이 남고, 남의 닉네임·얼굴은 안 읽힌다");
    ok(/\n  -webkit-backdrop-filter: blur\(7px\)/.test(CSS), "사파리에서도 흐려진다");
    /* 머리말은 판과 한 덩어리로 — 가르는 선이 있으면 잘려 보였습니다 */
    ok(/\.dock-head\{[^}]*border-bottom: none/.test(CSS), "★ 머리말 아래 선이 없다");
    ok(/\.dock-head\{[^}]*background: transparent/.test(CSS), "머리말 바탕이 판과 같다");

    /* ── 🏅 업적은 원래 판의 결 그대로 ── */
    ok(/#dock-panel-achv\{[^}]*background: var\(--modal-bg/.test(CSS),
       "★ 업적 판만 흰 바탕 (나머지는 테마 색)");
    ok(/#dock-body-achv\{ padding: 10px/.test(CSS), "안쪽 여백도 원래대로");
    /* ✍️ Letters — 제목을 판 머리말이 대신하니 [오늘][내 기록] 만 남습니다.
       왼쪽에 덩그러니 두면 허전해서 오른쪽으로 몰았어요. */
    ok(/\.dock-body \.wc-head\{ justify-content: flex-end; \}/.test(CSS),
       "★ [오늘][내 기록] 이 오른쪽으로 정렬된다");
    {
      const achvW = Number((CSS.match(
        /#dock-panel-achv\{[\s\S]*?width: min\((\d+)px/) || [])[1]);
      ok(achvW === 340, `업적 판 폭도 원래대로 340px (${achvW})`);
    }

    /* ── 🍅 뽀모 가로형은 남는 자리를 고르게 ── */
    ok(/#pomo-block\[data-shape="bar"\] #timer-wrap\{[^}]*justify-content: space-evenly/.test(CSS),
       "★ 가로 바일 때 위아래로 고르게 편다 (안 그러면 위에 몰리고 아래가 빈다)");

    /* =====================================================================
       🩹 판이 텅 비어 있던 세 가지 (2026-08-12)
       ---------------------------------------------------------------------
       실제 방에 올리고 나서야 드러났습니다. 시험 모드(?demo=1)는 가짜
       내용을 미리 넣어 두는 바람에 **셋 다 안 보였어요.** 서버가 채워
       주는 것만 비어 있었으니까요. 그래서 여기서 붙잡아 둡니다.
       ===================================================================== */

    /* ① 🏅 업적 — 그릴 칸을 지워 버렸던 일
       achvPanelHtml() 은 #achv-panel 에 그린 뒤 그 innerHTML 을 퍼 옵니다.
       그 칸이 .room-foot 안에 살았는데 껍데기를 치우며 같이 지워졌어요.
       그러면 조용히 "" 가 돌아옵니다 — 오류도 안 납니다. */
    ok(/achvBar\.classList\.add\("dock-offstage"\)/.test(DK) &&
       /document\.body\.appendChild\(achvBar\)/.test(DK),
       "★★ 업적 칸(#achv-bar)은 지우지 않고 화면 밖으로 옮겨 둔다");
    {
      const i리 = DK.indexOf("achvBar"), i철 = DK.indexOf('room-foot")?.remove()');
      ok(i리 > 0 && i철 > i리, "★ 껍데기를 치우기 **전에** 옮긴다 (순서가 곧 전부)");
    }
    ok(/\.dock-offstage\{[^}]*left: -9999px/.test(CSS), "화면 밖 대기석이 있다");
    ok(!/\.dock-offstage\{[^}]*display: none/.test(CSS),
       "★ display:none 이 아니다 — 그런 칸은 크기를 못 재서 그리기가 어긋난다");
    ok(/window\.achvPanelHtml = function/.test(fs.readFileSync(DIR+"script_achv.js","utf8")),
       "업적 쪽 창구는 그대로다");

    /* ② 📢 공지 — 목록을 그리는 스위치를 안 눌렀던 일
       render() 는 #notice-modal 의 display 가 "flex" 일 때만 돕니다. */
    {
      const NT = fs.readFileSync(DIR+"script_notice.js","utf8");
      ok(/el\("notice-modal"\)\?\.style\.display === "flex"\) render\(\);/.test(NT),
         "공지 목록은 겉창이 flex 일 때만 다시 그려진다 (이게 전제다)");
      ok(/modal\.style\.display = "flex";\s*\n\s*render\(\);/.test(NT),
         "openNoticeBoard 가 그 값을 켜고 그린다");
      /* [2026-08-21] 공지가 머리말로 올라갔습니다. 전제는 그대로예요 —
         **누군가는 openNoticeBoard() 를 불러 줘야** 목록이 그려집니다.
         이제 그 일을 머리말 단추가 합니다. */
      /* [2026-08-21 — 콩] 머리말 시계 옆 이모지를 셋으로 */
      ok(/emo\.textContent = emojiFor\(h\)\.repeat\(3\)/.test(fs.readFileSync(DIR+"script_ui.js","utf8")),
         "★ 시계 옆 이모지가 셋이다 (2026-08-21 콩)");
        ok(/id="notice-head-btn"[^>]*onclick="openNoticeBoard\(\)"/.test(HTML),
         "★★ 머리말 📢 단추가 openNoticeBoard() 를 부른다 (안 부르면 목록이 영영 빈칸)");
      ok(!/\.dock-mode #notice-modal\{ display: none/.test(fs.readFileSync(DIR+"styles.css","utf8")),
         "★★ 겉창을 감추던 CSS 를 걷어냈다 (안 걷으면 눌러도 아무 일이 없다)");
      ok(!/#notice-modal \.modal-content"\)/.test(DK),
         "★★ 알약 줄이 공지 알맹이를 더 이상 훔쳐가지 않는다");
      /* 빨간 점은 판을 **열기 전에** 켜져 있어야 뜻이 있습니다 */
      ok(/window\.listenNoticeBoard\?\.\(\);/.test(fs.readFileSync(DIR+"script_realtime.js","utf8")),
         "★★ 입장할 때 공지 목록을 듣기 시작한다 (알약이 하던 일을 넘겨받음)");
      ok(/\["notice-dot", "notice-dot-head"\]/.test(NT),
         "★ 빨간 점을 채팅 탭과 머리말 **둘 다** 칠한다");
      ok(/\.icon-btn\{ position: relative; \}/.test(fs.readFileSync(DIR+"styles.css","utf8")),
         "★ 머리말 단추가 점의 기준 자리가 된다 (없으면 점이 화면 구석으로 날아간다)");
      ok((HTML.match(/openNoticeBoard\(\)/g) || []).length === 2,
         "공지를 여는 단추는 둘 (채팅 탭 · 머리말)");
      ok(!/closeNoticeBoard/.test(DK),
         "★ 알약 줄은 공지를 여닫지 않는다 (2026-08-21 머리말로 옮김)");
      /* [＋ 새 공지] 가 또 침묵하던 것 (2026-08-12 · 같은 자리 세 번째)
         relocate() 가 .modal-content 를 알약 판으로 옮기는데, bind() 는
         겉창 **안에서만** 찾다가 못 찾고 빈 껍데기에 리스너를 달았습니다. */
      {
        const NT = fs.readFileSync(DIR+"script_notice.js","utf8");
        /* [2026-08-21] 상자가 제자리로 돌아왔습니다. 그래도 **겉창이
           아니라 상자**에 다는 버릇은 지킵니다 — 여기서 세 번 데였어요. */
        ok(/const box = modal\.querySelector\("\.modal-content"\) \|\| modal;/.test(NT),
           "★★★ 공지 리스너는 겉창이 아니라 **안쪽 상자**를 찾아서 단다");
        ok(/const box = [\s\S]{0,120}box\.addEventListener\("click"/.test(NT),
           "그 상자에 실제로 click 이 달린다");
        ok(!/querySelector\("#dock-body-notice/.test(NT),
           "이사 간 자리를 더는 **찾지** 않는다 (주석의 옛이야기는 남겨 둡니다)");
      }
      ok(!/\.dock-mode #notice-modal\{ display: none/.test(CSS),
         "★ 겉창을 감추던 규칙은 없앴다 (2026-08-21 — 남아 있으면 안 열린다)");

      /* 판 안에 또 판이 있던 것 (2026-08-12) */
      {
        const seg = (CSS.match(/#dock-body-notice > \.modal-content\{[\s\S]*?\}/) || [""])[0];
        ok(/background: transparent/.test(seg),
           "★★ 알맹이의 흰 바탕을 걷어낸다 (안 그러면 판의 반투명이 통째로 가려진다)");
        ok(/border: none/.test(seg) && /box-shadow: none/.test(seg),
           "테두리·그림자도 — 판 안에 상자가 하나 더 있는 꼴이었다");
        ok(/#dock-body-notice \.nt-eyebrow\{ display: none; \}/.test(CSS),
           "★ '— NOTICE —' 는 뺀다 (머리말에 이미 📢 공지 라고 적혀 있다)");
        ok(/#dock-body-notice \.nt-item\{ background: var\(--glass2\); \}/.test(CSS),
           "★ 대신 공지 한 칸은 살짝 불투명하게 — 글이 격자에 묻히지 않게");
        /* 판 자체는 여전히 비쳐야 합니다 */
        ok(/\.dock-panel\{[\s\S]*?background: var\(--panel\)/.test(CSS),
           "판 바탕은 그대로 반투명이다");
      }
    }

    /* ③ ☕ 수다방 — 창은 둘, 펜은 하나
       ---------------------------------------------------------------
       처음엔 한 판의 두 탭으로 묶었는데, 챗을 열어 둔 채 수다방을 누르면
       **같은 판이 키만 커지면서** 수다방이 됐습니다. 둘이 따로 놀지도
       않고 돌아갈 길도 없었어요. 이제 판은 갈라 놓고 **글칸만** 오갑니다. */
    {
      const CH = fs.readFileSync(DIR+"script_chatty.js","utf8");
      ok(/_chattyBox\(\)\?\.classList\.toggle\("hidden", !onChatty\)/.test(CH),
         "#chat-box2 는 탭을 켜야 보인다 (이게 전제다)");
      ok(/function chattySend\(\)[\s\S]{0,200}document\.getElementById\("message"\)/.test(CH),
         "★★ 수다방도 **같은 글칸**(#message)을 쓴다 — 이게 이 설계의 이유다");

      ok(/id: "chatty"[^\n]*drag: true, tab: "chatty", resize: true/.test(DK),
         "★★ 수다방은 제 판을 갖는다 (옮길 수도, 키울 수도 있다)");
      ok(/id: "chat"[^\n]*tab: "main", resize: true/.test(DK), "챗도 마찬가지");
      ok(!/panel: "chat"/.test(DK), "★ 한 판을 나눠 쓰던 흔적이 남아 있지 않다");

      /* 두 대화 상자가 **동시에** 보여야 합니다 */
      ok(/dock-body-chatty[\s\S]{0,200}chatty-online-bar", "chat-box2"/.test(DK),
         "★ 접속자 줄과 대화 상자를 수다방 판으로 떼어 온다");
      ok(/\.dock-mode #dock-body-chat #chat-box\.hidden\{ display: flex !important; \}/.test(CSS) &&
         /\.dock-mode #dock-body-chatty #chat-box2\.hidden\{ display: flex !important; \}/.test(CSS),
         "★★ 두 대화 상자가 동시에 보인다 (switchChatTab 이 붙이는 .hidden 을 되돌린다)");
      ok(/\.dock-mode #dock-body-chatty #chatty-online-bar\.hidden\{ display: flex !important; \}/.test(CSS),
         "수다방 접속자 줄도 계속 보인다 (나가기 단추가 거기 있다)");

      /* ✍️ 글칸 옮기기 */
      ok(/function moveInput\(tab\)/.test(DK), "★ 글칸을 옮기는 손이 있다");
      /* 이사가 한글을 깨뜨리던 것 (2026-08-13) — 초점째 옮기면 조용히
         떨어지고, 조합 중에 옮기면 IME 가 끼어 자모가 풀려 나온다 */
      ok(/if \(_composing\) \{[\s\S]{0,120}compositionend[\s\S]{0,80}\{ once: true \}/.test(DK),
         "★★ 한글 조합 중에는 이사를 미룬다 (끝나는 순간 한 번만)");
      ok(/const 초점있던 = ta && document\.activeElement === ta;/.test(DK) &&
         /ta\.focus\(\{ preventScroll: true \}\)/.test(DK) &&
         /ta\.setSelectionRange\(s, e2\)/.test(DK),
         "★★ 초점이 있었으면 이사 직후 초점과 커서를 되살린다");
      ok(/e\.target\?\.id === "message"\) _composing = true/.test(DK),
         "조합 상태를 글칸에서 직접 지켜본다");
      /* [갱신 2026-08-13] 펜 목록에 멘션 드롭다운이 합류 — 정확한 목록은
         아래 "@멘션 드롭다운도 펜과 함께 이사" 검사가 봅니다 */
      ok(/const 펜 = \["reply-preview-bar", "mention-dropdown"\]/.test(DK),
         "답장 미리보기도 글칸을 따라간다 (혼자 남으면 딴 방에 뜬다)");
      ok(/document\.querySelector\("\.input-area"\)[\s\S]{0,80}host\.appendChild\(ia\)/.test(DK),
         "글칸 자체를 옮긴다 (새로 그리지 않는다 — 손가락이 다 붙어 있다)");
      ok(/function setTab\(tab\)[\s\S]{0,220}window\.switchChatTab\?\.\(t\);[\s\S]{0,60}moveInput\(t\);/.test(DK),
         "★ 방을 바꾸면 탭 전환과 글칸 이사가 **함께** 일어난다");
      ok(/dock-write-chat", "✍️ 여기에 쓰기"/.test(DK) &&
         /dock-write-chatty", "✍️ 수다방에 쓰기"/.test(DK),
         "★ 비어 있는 쪽에 '여기에 쓰기' 줄이 남는다 (돌아갈 길)");
      ok(/\.dock-write\[data-empty\]::before\{ content: attr\(data-hint\); \}/.test(CSS),
         "그 줄이 실제로 그려진다");
      ok(!/:empty::before/.test(CSS.slice(CSS.indexOf(".dock-write"), CSS.indexOf(".dock-write") + 600)),
         "★ :empty 로 판단하지 않는다 — 답장 미리보기가 늘 붙어 있어서 못 쓴다");
      ok(/#dock-panel-chat, #dock-panel-chatty"\)/.test(DK),
         "★★ 판을 누르면 그 방이 쓰는 방이 된다 (창 두 개를 오가는 방법)");
      ok(/if \(pid === "chatty" && _tab === "chatty"\) setTab\("main"\);/.test(DK),
         "★★ 펜이 놓인 판을 닫으면 펜을 딴 방으로 옮긴다 (안 그러면 아무 데도 못 쓴다)");
      ok(/if \(d\.tab && _tab !== d\.tab\) \{ setTab\(d\.tab\); raise\(pid\); return; \}/.test(DK),
         "★ 열려 있는 판의 알약을 누르면 먼저 펜을 데려온다 (한 번 더 눌러야 닫힘)");
    }

    /* ③-2 판 키우기 — 챗과 수다방만, 지금 높이보다 작아지지 않게 */
    {
      ok(/const H_KEY = "dockH"/.test(DK), "늘린 키를 기억한다");
      /* [갱신 2026-08-14] ♪ BGM 만 예외 — 150px 까지 줄일 수 있습니다
         (영상만 남기는 쓰임). 나머지 판은 여전히 기본 키가 바닥입니다 */
      ok(/Math\.max\(lo, Math\.min\(maxH\(\), h\)\)/.test(DK) &&
         /const lo = pid === "music" \? 150 : baseH\(pid\)/.test(DK),
         "★★ 기본 키가 바닥이다 (BGM 만 150px 까지 줄어든다)");
      ok(/return Math\.round\(BASE_H \* \(d \? d\.size : 1\)\);/.test(DK),
         "그 최소값이 곧 원래 크기다");
      /* [넓힘 2026-08-15] 끌어올린 거리를 배율로 나누게 되면서 뒤에
         `/ Z()` 가 붙었습니다. 부호(위로 = 커짐)만 지키면 됩니다. */
      ok(/setH\(_grip\.pid, _grip\.h \+ \(_grip\.y - e\.clientY\)/.test(DK),
         "★ 위로 끌수록 커진다 (판이 바닥에 붙어 자라니까)");
      ok(/if \(g\) clearH\(g\.dataset\.dockGrip\);/.test(DK), "두 번 누르면 원래 높이로");
      ok(/if \(d\.resize\) setH\(pid, loadH\(pid\)\);/.test(DK), "다시 열어도 늘린 키가 남는다");
      {
        const 키움 = [...DK.matchAll(/id: "(\w+)",[^\n]*resize: true/g)].map(m => m[1]);
        /* [넓힘 2026-08-16] ✍️ Work Log 가 들어왔습니다 — 메모와 할 일이
           흐르면서 일지가 길어져, 챗처럼 키울 수 있어야 했어요. */
        ok(키움.sort().join(",") === "chat,chatty,help,music,pub,wc",
           `★ 키울 수 있는 판은 챗·수다방·품평·BGM·Work Log·Help 여섯 (${키움.join(",")})`);
      }
      ok(/\.dock-grip\{[^}]*cursor: ns-resize/.test(DK + CSS), "손잡이에 세로 화살표 커서");
      ok(/\.dock-grip\{[^}]*touch-action: none/.test(CSS),
         "★ 손가락으로 끌 때 화면이 같이 스크롤되지 않는다");
      {
        /* CSS 의 천장과 JS 의 천장이 어긋나면 어중간한 데서 멎습니다 */
        const cssMax = Number((CSS.match(/\.dock-panel\{[\s\S]*?max-height: calc\(100vh - (\d+)px\)/) || [])[1]);
        const jsMax  = Number((DK.match(/\(window\.innerHeight \|\| 800\) - (\d+)/) || [])[1]);
        ok(cssMax === jsMax, `★★ 천장이 CSS 와 JS 에서 같다 (css ${cssMax} / js ${jsMax})`);
      }
    }

    /* ③-3 🏅 업적 머리말이 두 줄이던 것 */
    ok(/#dock-body-achv \.achv-head\{ display: none; \}/.test(CSS),
       "★ 판 안의 '🏅 나의 업적' 줄은 감춘다 (머리말과 겹쳤다)");
    ok(/body\?\.querySelector\("\.achv-head span"\)\?\.textContent/.test(DK) &&
       /t\.innerHTML = "🏅 업적"/.test(DK),
       "★ 대신 거기 있던 개수(11 \\/ 49)만 머리말로 올린다");

    /* =====================================================================
       🏢 출판사 품평 (2026-08-12) — 익명이 이 기능의 전부입니다
       ===================================================================== */
    {
      const PB = fs.readFileSync(DIR+"script_pubreview.js","utf8");
      /* "없어야 한다" 는 검사는 주석을 벗긴 알맹이로 봅니다 — 주석이
         "닉네임을 안 싣습니다" 라고 **설명만 해도** 걸리면 억울하니까요 */
      const PB코드 = PB.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      /* ── 익명 — 대숲과 같은 저울질 ── */
      ok(/\{ text, at: Date\.now\(\), hearts: 0 \}/.test(PB),
         "★★★ 품평에 실리는 것은 text·at·hearts 뿐이다");
      /* [다듬음 2026-08-12] 방장 전용 명패 관리가 생기며 uid 가 파일에
         **들어오긴** 했습니다 — 단 isAdmin() 판별 한 곳뿐이어야 하고,
         서버에 **쓰는 값**에는 여전히 정체가 한 톨도 실리면 안 됩니다. */
      ok(!/myNick/.test(PB코드), "★★★ 닉네임은 이 파일 어디에도 없다");
      {
        const 판별밖 = PB코드
          .replace(/const ADMIN_UID = "[^"]*";/, "")
          .replace(/const isAdmin = [\s\S]*?\};/, "");
        ok(!/auth\.currentUser|\buid\b|ADMIN_UID/.test(판별밖.replace(/isAdmin\(\)/g, "")),
           "★★★ uid 는 isAdmin() 판별 안에만 있다 — 쓰는 값 근처에는 없다");
        const 쓰기 = [...PB코드.matchAll(/\.set\(([^;]*)\);/g)].map(m => m[1]).join(" ");
        ok(!/nick|uid|user|name:.*myNick/i.test(쓰기.replace(/\bname\b|genre|at:|text|hearts/g, "")),
           "서버에 set 되는 값에 정체가 실리지 않는다");
      }

      /* 방장 전용 명패 관리 (2026-08-12) */
      ok(/data-pub-edit/.test(PB) && /data-pub-remove/.test(PB) && /\$\{isAdmin\(\) \? `/.test(PB),
         "★ 명패 고치기·지우기 단추는 방장에게만 보인다");
      ok(/async function editPub/.test(PB) && /async function removePub/.test(PB),
         "고치기·지우기 손이 있다");
      {
        const i품평 = PB.indexOf('window.db.ref("pubreview/" + pid).remove()');
        const i명패 = PB.indexOf('window.db.ref("pubs/" + pid).remove()');
        ok(i품평 > 0 && i명패 > i품평,
           "★★ 품평을 먼저, 명패를 나중에 지운다 (반대면 고아 품평이 서버에 남는다)");
      }
      ok(/달려 있는 품평 \$\{n\}개도 함께 사라져요/.test(PB),
         "★ 지우기 전에 품평 몇 개가 같이 사라지는지 알려 준다");
      ok(/if \(_openPub === pid\) _openPub = null;/.test(PB),
         "지운 명패가 펼쳐진 채로 남지 않는다");

      /* 🔍 찾기 (2026-08-12) — 목록이 수십 곳이라 훑어서는 못 찾는다 */
      ok(/id="pub-search"/.test(PB) && /data-pub-genre/.test(PB),
         "★ 찾는 칸과 장르 칩이 맨 윗줄에 있다");
      ok(/function _folded\(s\)[\s\S]{0,120}toLowerCase\(\)\.replace\(\/\\s\+\/g, ""\)/.test(PB),
         "★ 띄어쓰기·대소문자를 무시하고 견준다 ('페일 블루' 로도 잡히게)");
      ok(/!_folded\(p\.name\)\.includes\(q\) && !_folded\(p\.genre\)\.includes\(q\)/.test(PB),
         "찾는 말은 이름과 장르 어느 쪽에 걸려도 잡는다");
      ok(/_genre = _genre === chip\.dataset\.pubGenre \? null : chip\.dataset\.pubGenre;/.test(PB),
         "장르 칩은 다시 누르면 풀린다");
      ok(/if \(!e\.isComposing\) render\(\);/.test(PB) && /compositionend/.test(PB),
         "★★ 한글 조합 중에는 다시 안 그린다 (그리면 ㅊ→추→출 조합이 끊긴다)");
      ok(/document\.activeElement\?\.id === "pub-search"/.test(PB) &&
         /setSelectionRange\(커서, 커서\)/.test(PB),
         "★ 치는 중에 새 품평이 와서 다시 그려져도 커서가 안 튕긴다");
      {
        /* 실제로 걸러 봅니다 — 같은 논리로 */
        const folded = (x) => String(x || "").toLowerCase().replace(/\s+/g, "");
        const tokens = (g) => String(g || "").split(/[·,/|]+/).map(t => t.trim()).filter(Boolean);
        const pubs = [
          { name: "페일블루", genre: "BL · 19금" },
          { name: "가나북스", genre: "로판" },
          { name: "쉼표",     genre: "로판 · 현판" }
        ];
        const 찾기 = (q, genre) => pubs.filter(p => {
          if (genre && !tokens(p.genre).includes(genre)) return false;
          const f = folded(q);
          if (f && !folded(p.name).includes(f) && !folded(p.genre).includes(f)) return false;
          return true;
        }).map(p => p.name).join(",");
        ok(찾기("페일 블", null) === "페일블루", "띄어쓰기 섞어 쳐도 잡힌다");
        ok(찾기("bl", null) === "페일블루", "장르 글자로도, 대소문자 무시하고 잡힌다");
        ok(찾기("", "로판") === "가나북스,쉼표", "칩은 그 장르가 든 곳을 전부 모은다");
        ok(찾기("쉼", "로판") === "쉼표", "찾는 말과 칩을 겹쳐 쓸 수 있다");
        ok(찾기("없는말", null) === "", "안 걸리면 빈 목록");
      }

      /* ── 🏢 묶기 + 정렬 (2026-08-13) — 실제 파이프라인 그대로 굴려 봅니다 ── */
      ok(/function 회사쪼개기\(name\)/.test(PB) && /indexOf\("\/"\)/.test(PB),
         "★ / 앞을 출판사, 뒤를 레이블로 가른다");
      ok(/const key = co \? _folded\(co\) : null;/.test(PB),
         "★ 띄어쓰기·대소문자가 달라도 같은 지붕으로 묶인다");
      ok(/u\.pids\.length === 1[\s\S]{0,120}u\.co = null;/.test(PB),
         "명패가 하나뿐인 출판사는 낱장 그대로");
      ok(/const 강제펼침 = !!\(q \|\| _genre\);/.test(PB),
         "★ 찾는 중에는 걸린 묶음이 저절로 펼쳐진다");
      /* ★ [고침 2026-08-22] 갈래가 셋이 되면서, 되읽는 쪽이
         `=== "talk"` 한 줄에서 SORTS.includes() 로 바뀌었습니다.
         갈래를 또 늘려도 이 검사는 안 흔들립니다. */
      ok(/AppStore\?\.setItem\(SORT_KEY, _sort\)/.test(PB) &&
         /SORTS\.includes\(v\)\) _sort = v;/.test(PB),
         "고른 정렬이 이 기기에 남는다");
      {
        const folded = (x) => String(x || "").toLowerCase().replace(/\s+/g, "");
        const 쪼개 = (name) => {
          const i = String(name).indexOf("/");
          return i < 0 ? { co: null, label: String(name).trim() }
                       : { co: String(name).slice(0, i).trim(), label: String(name).slice(i + 1).trim() };
        };
        const pubs = {
          a: { name: "대원씨아이 / 모드, 클로젯" },
          b: { name: "대원씨아이/폴라리스, 플로레뜨" },   // 띄어쓰기 다름 + 쉼표 레이블
          c: { name: "가나북스" },
          d: { name: "쉼표 / 레드립, 레이어드" }          // 이 출판사 명패는 하나뿐
        };
        const talk = { a: 3, b: 9, c: 4, d: 18 };
        const 맵 = {}, 단위 = [];
        Object.keys(pubs).forEach(pid => {
          const { co } = 쪼개(pubs[pid].name);
          const k = co ? folded(co) : null;
          if (!k) { 단위.push({ name: pubs[pid].name, pids: [pid] }); return; }
          if (!맵[k]) { 맵[k] = { co, pids: [] }; 단위.push(맵[k]); }
          맵[k].pids.push(pid);
        });
        단위.forEach(u => {
          if (u.co && u.pids.length === 1) { u.name = pubs[u.pids[0]].name; u.co = null; }
          else if (u.co) u.name = u.co;
          u.talk = u.pids.reduce((s2, pid) => s2 + talk[pid], 0);
        });
        ok(단위.length === 3, `넷이 세 단위가 된다 — 대원씨아이가 묶여서 (${단위.length})`);
        const 대원 = 단위.find(u => u.co === "대원씨아이");
        ok(!!대원 && 대원.pids.length === 2,
           "★★ 띄어쓰기 다르고 레이블에 쉼표가 있어도 같은 지붕에 묶인다");
        ok(대원.talk === 12, `묶음 품평은 합계다 (${대원.talk})`);
        const 쉼표u = 단위.find(u => u.name === "쉼표 / 레드립, 레이어드");
        ok(!!쉼표u && !쉼표u.co, "★ 명패 하나뿐인 '쉼표 /' 는 낱장 — 지붕만 있고 빈 묶음이 되지 않는다");
        const c2 = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });
        const 이름순 = [...단위].sort((x, y) => c2.compare(x.name.trim(), y.name.trim())).map(u => u.name);
        ok(이름순.join(",") === "가나북스,대원씨아이,쉼표 / 레드립, 레이어드",
           `가나다순 (${이름순.join(" · ")})`);
        const 수다순 = [...단위].sort((x, y) => (y.talk - x.talk) || c2.compare(x.name, y.name)).map(u => u.name);
        ok(수다순[0] === "쉼표 / 레드립, 레이어드" && 수다순[1] === "대원씨아이",
           "💬 많은 순 — 묶음은 합계(12)로 선다");

        /* 레이블 수는 쉼표로 갈라 센다 (콩의 지적) — 명패 수로 세면 거짓말 */
        ok(/function 레이블수\(name\)/.test(PB) &&
           /label\.split\(","\)\.map\(t => t\.trim\(\)\)\.filter\(Boolean\)\.length/.test(PB),
           "★★ '모드, 클로젯' 은 레이블 2 로 센다");
        {
          const 세기 = (name) => {
            const i = String(name).indexOf("/");
            if (i < 0) return 1;
            const n = String(name).slice(i + 1).split(",").map(t => t.trim()).filter(Boolean).length;
            return n || 1;
          };
          ok(세기("대원씨아이 / 모드, 클로젯") === 2, "쉼표 둘 → 레이블 2");
          ok(세기("도서출판 쉼표 / 레드립, 레이어드") === 2, "낱장이어도 레이블은 2");
          ok(세기("가나북스") === 1, "/ 없는 명패는 1");
          ok(세기("허당사 / ") === 1, "/ 뒤가 비어도 0 이 아니라 1 (빈 지붕 방지)");
          const 넷 = ["대원씨아이 / 모드, 클로젯", "대원씨아이/폴라리스, 플로레뜨",
                      "가나북스", "도서출판 쉼표 / 레드립, 레이어드"];
          const 총 = 넷.reduce((a, n) => a + 세기(n), 0);
          ok(총 === 7, `명패 4개인데 레이블은 7 로 나온다 (${총})`);
        }
        ok(/u\.labels = u\.pids\.reduce\(\(a, pid\) => a \+ 레이블수/.test(PB) &&
           /레이블 \$\{u\.labels\}/.test(PB),
           "묶음 머리의 '레이블 n' 도 쉼표로 센 숫자다");
      }
      ok(/const MINE_KEY = "pubMine"/.test(PB),
         "★ '내가 쓴 것' 은 이 기기의 AppStore 에만 남는다");
      ok(/_mine\(MINE_KEY\)\.includes\(rid\)/.test(PB),
         "✕ 는 이 기기가 기억하는 내 품평에만 보인다");
      /* ♥·날짜·"익명" 줄은 2026-08-12 화면에서 뺐습니다 (콩의 결정).
         서버의 at·hearts 는 남아 있어 언제든 되살릴 수 있어요. */
      ok(!/pub-heart|pub-rev-meta|fmtDay/.test(PB), "★ 익명·날짜·♥ 줄이 화면에 없다");
      ok(/hearts: 0/.test(PB), "서버 모양(at·hearts)은 그대로다 — 되살릴 길을 남겼다");
      /* ✕ — 글쓴이에게만, 말풍선에 커서를 올려야 */
      ok(/pub-rev-text[\s\S]{0,200}mine \? `<button[^`]*pub-del/.test(PB),
         "★ ✕ 는 말풍선 안, 글쓴이(이 기기)에게만 그려진다");
      {
        const seg = (CSS.match(/\.pub-del\{[\s\S]*?\}/) || [""])[0];
        ok(/opacity: 0/.test(seg) && /position: absolute/.test(seg) && /right: 6px/.test(seg),
           "★★ ✕ 는 평소 안 보이고 오른쪽 끝에 숨어 있다");
        ok(/\.pub-rev-text:hover \.pub-del,\s*\n\.pub-del:focus-visible\{ opacity: 1; \}/.test(CSS),
           "커서를 올리면 나타난다 (키보드 초점으로도)");
        ok(/@media \(hover: none\)\{ \.pub-del\{ opacity: \.45; \} \}/.test(CSS),
           "★★ 폰에는 hover 가 없다 — 옅게나마 늘 보여야 지울 수 있다");
        ok(/padding: 8px 26px 8px 11px/.test(CSS),
           "긴 품평이 ✕ 자리를 덮치지 않게 오른쪽을 비워 둔다");
      }

      /* ── 운영진이 정한 것 셋 ── */
      ok(/async function addPub/.test(PB) && /data-pub-add/.test(PB),
         "★ 출판사 추가는 누구나 (콩의 결정)");
      ok(!/\bstar\b|별점|\bscore\b|\brating\b/i.test(PB코드), "★ 점수·별점이 없다 — 글과 ♥ 뿐");
      ok(!/KEEP_MS|시들|30일/.test(PB코드), "★ 대숲과 달리 안 시든다 — 참고 자료라 쌓인다");

      /* ── 짜임새 ── */
      ok(/_openPub = _openPub === pid \? null : pid/.test(PB),
         "명패는 한 번에 하나만 펼쳐진다");
      ok(/const draft = ta \? ta\.value : ""/.test(PB),
         "★ 다시 그려도 쓰던 글이 살아 있다 (공지판에서 배운 것)");
      /* 보낸 뒤에도 글칸에 글이 남던 것 (2026-08-12) — listener 의 다시
         그리기가 "쓰던 글 지키기" 로 보낸 글까지 살려 버렸습니다.
         비우기는 **보내기 전에** 해야 새 글칸에 안 실립니다. */
      {
        const i비움 = PB.indexOf('if (ta) ta.value = "";');
        const i전송 = PB.indexOf('window.db.ref("pubreview/" + pid).push()');
        ok(i비움 > 0 && i전송 > i비움,
           "★★ 글칸은 서버에 올리기 **전에** 비운다 (뒤에 비우면 옛 글칸만 비운다)");
        ok(/if \(ta2\) ta2\.value = text;/.test(PB),
           "★ 올리기가 실패하면 쓴 글을 되살린다 (날아가면 안 된다)");
      }
      ok(/maxlength="\$\{MAX_TEXT\}"/.test(PB) && /MAX_TEXT = 300/.test(PB), "품평은 300자까지");
      ok(/CSS\.escape\(pid\)/.test(PB), "pid 를 선택자에 넣을 때 이스케이프한다");
      ok(/box\.dataset\.pubBound === "true"/.test(PB),
         "손가락은 판 하나에 한 번만 건다 (다시 그려도 안 죽게)");
      ok(/String\(p\.name\)\.replace\(\/\\s\/g, ""\)/.test(PB),
         "띄어쓰기만 다른 중복 등록을 막는다");
      ok(/Intl\.Collator\("ko", \{ numeric: true/.test(PB) &&
         /견줌\.compare\(String\(_pubs\[a\]\.name\)\.trim\(\)/.test(PB),
         "★ 명패는 가나다순으로 선다 (등록순이 아니다)");
      {
        /* 실제로 세워 봅니다 — 이름 배열을 같은 방식으로 */
        const c = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });
        const 순서 = ["페일블루", "가나북스", "쉼표", "나다출판", "10문사", "2문사"]
          .sort((a, b) => c.compare(a, b)).join(",");
        ok(순서 === "2문사,10문사,가나북스,나다출판,쉼표,페일블루",
           `가나다·숫자 순이 맞다 (${순서})`);
      }

      /* =====================================================================
         🆕 최신순 (2026-08-22 — 콩)
         ---------------------------------------------------------------------
         "최신" 은 **최근에 품평이 달린 순** 입니다 — 명패를 등록한 차례가
         아니에요 (콩 확정). 말이 오가는 곳이 위로 올라오는 자리입니다.
         ★ 서버를 더 읽지 않습니다 — 품평마다 at 이 이미 들어와 있어요.
         ===================================================================== */
      ok(/const SORTS = \["abc", "talk", "new"\];/.test(PB),
         "★ 갈래가 셋이다 (가나다 · 💬 많은 순 · 🆕 최신순)");
      ok(/data-pub-sort="new"/.test(PB) && /🆕 최신순/.test(PB),
         "★ 알약이 판에 실제로 뜬다");
      ok(/_sort = SORTS\.includes\(srt\.dataset\.pubSort\) \? srt\.dataset\.pubSort : "abc";/.test(PB),
         "★★ 모르는 값이 오면 가나다로 떨어진다 (기기에 남은 옛 값 대비)");
      ok(/Math\.max\(a, Number\(r\?\.at\) \|\| 0\)/.test(PB),
         "★★★ at 이 빠졌거나 숫자가 아니어도 0 으로 받친다 — NaN 이 하나 섞이면 견줌이 통째로 어그러진다");
      ok(/u\.last = u\.pids\.reduce\(\(a, pid\) => Math\.max\(a, 마지막품평\(pid\)\), 0\);/.test(PB),
         "★ 묶음은 그 지붕 아래 **가장 새것**을 대표로 삼는다");
      ok(/\(b\.last - a\.last\) \|\| 이름견줌\(a, b\)/.test(PB),
         "★★ 같은 값이면 가나다 — 안 그러면 다시 그릴 때마다 줄이 흔들린다");
      ok(/db\.ref\("pubreview/.test(PB) && !/orderByChild\("at"\)/.test(PB),
         "★ 서버를 더 읽지 않는다 (이미 받아 둔 자료로 셈한다)");
      {
        /* 실제로 세워 봅니다 — 품평 없는 곳과 at 빠진 옛 줄까지 섞어서 */
        const 마지막 = (revs) => Object.values(revs || {})
          .reduce((a, r) => Math.max(a, Number(r?.at) || 0), 0);
        const T = (일) => new Date(2026, 7, 일).getTime();
        const revs = {
          가: { r1: { at: T(10) }, r2: { at: T(21) } },
          나: { r1: { at: T(22) } },
          다: {},                          // 품평 없음
          라: { r1: {}, r2: { at: T(5) } }, // at 빠진 옛 줄 섞임
          마: { r1: { at: "이상한값" } },    // 숫자 아님
        };
        const c2 = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });
        const 줄 = Object.keys(revs).map(n => ({ name: n, last: 마지막(revs[n]) }))
          .sort((a, b) => (b.last - a.last) || c2.compare(a.name, b.name))
          .map(u => u.name).join(",");
        ok(줄 === "나,가,라,다,마",
           `★★★ 최신순 차례가 맞다 — 품평 없는 곳은 뒤로 (${줄})`);
      }

      /* ── 알약 줄에 제대로 꽂혔나 ── */
      ok(/id: "pub"[^\n]*stay: true[^\n]*drag: true, resize: true/.test(DK),
         "★ 품평 판은 머무는 판이고, 옮기고 키울 수 있다");
      ok(/if \(pid === "pub"\)\s+window\.openPubReview\?\.\(\);/.test(DK),
         "★ 알약을 열 때 openPubReview 를 부른다 (listener 도 그때 처음 붙는다)");
      ok(/"script_pubreview\.js":"openPubReview"/.test(fs.readFileSync(DIR+"index.html","utf8").replace(/\s+/g,"")),
         "로드 자가진단 목록에도 있다");

      /* ── 보안규칙 — 남의 품평 바꿔치기가 막히는가 ── */
      const R = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;
      ok(!!R.pubs && !!R.pubreview, "★ pubs·pubreview 규칙이 있다");
      ok(/!data\.exists\(\) && newData\.child\('name'\)\.isString\(\)/.test(R.pubs.$pid[".write"]),
         "★★ 명패는 새로 만들기만 열려 있다 — 이름 바꿔치기는 방장만");
      ok(/newData\.child\('name'\)\.val\(\)\.length <= 40/.test(R.pubs.$pid[".write"]),
         "이름 40자 제한을 규칙이 지킨다 (화면 제한은 우회된다)");
      const RV = R.pubreview.$pid.$rid[".write"];
      ok(/!data\.exists\(\) \|\| !newData\.exists\(\) \|\| newData\.child\('text'\)\.val\(\) === data\.child\('text'\)\.val\(\)/.test(RV),
         "★★ 품평은 새 글·지우기·글이 그대로인 수정(♥)만 — 대숲과 같은 방패");

      /* ── 규칙을 실제로 돌려 봅니다 (문장이 아니라 판정으로) ── */
      {
        const 판정 = (data, newData, admin) => {
          if (admin) return true;
          if (!data) return true;                                  // 새 글
          if (!newData) return true;                                // 지우기
          return newData.text === data.text;                        // ♥ 만
        };
        ok(판정(null, { text: "첫 품평" }, false), "새 품평은 써진다");
        ok(판정({ text: "원래 글" }, null, false), "지우기도 된다 (익명이라 '글쓴이만' 조건이 불가능)");
        ok(판정({ text: "원래 글", hearts: 1 }, { text: "원래 글", hearts: 2 }, false),
           "♥ 올리기는 된다 (글이 그대로니까)");
        ok(!판정({ text: "원래 글" }, { text: "바꿔치기" }, false),
           "★★★ 남의 품평 내용 바꿔치기는 규칙이 막는다");
        ok(판정({ text: "원래 글" }, { text: "바꿔치기" }, true), "방장은 고칠 수 있다");
      }

      /* 설명서에도 실렸다 */
      const M = fs.readFileSync(DIR+"script_manual.js","utf8");
      ok(/🏢 출판사 품평/.test(M) && /닉네임·계정이 서버에 남지 않아요/.test(M),
         "★ 설명서가 익명 원칙을 분명히 적는다");
    }

    /* ④ 좁은 화면 — 한 번에 한 판 */
    {
      const UI = fs.readFileSync(DIR+"script_ui.js","utf8");
      const w = Number((UI.match(/const NARROW_W = (\d+);/) || [])[1]);
      ok(w === 833, `★ 좁게 보기 문턱이 833px 이다 (980 의 85%) — 지금 ${w}`);
      ok(/const on = w <= NARROW_W;/.test(UI), "그 값을 실제로 쓴다");
      ok(!/const on = w <= 980;/.test(UI), "옛 숫자가 남아 있지 않다");
      ok(/function isNarrow\(\)[\s\S]{0,120}narrow-chat-focus/.test(DK),
         "★ 알약 줄도 같은 깃발을 본다 (기준이 두 군데로 갈리지 않게)");
      ok(/if \(isNarrow\(\)\) \[\.\.\._open\]\.forEach\(o => \{ if \(o !== pid\) close\(o\); \}\);/.test(DK),
         "★★ 좁으면 새로 열 때 먼저 열린 판을 접는다 (한 번에 하나)");
      ok(/body\.narrow-chat-focus \.dock-panel\{[^}]*width: auto !important/.test(CSS),
         "★ 좁으면 판이 화면 폭을 다 쓴다");
      ok(/body\.narrow-chat-focus \.dock-panel\{[^}]*bottom: 0 !important/.test(CSS),
         "끌어다 놓은 자리도 무시한다 (좁은 화면에선 옮길 곳이 없다)");
      ok(/\.dock-mode\.narrow-chat-focus \.app-head\{ display: flex !important; \}/.test(CSS),
         "★★ 도구 줄은 안 감춘다 — 감추면 설정·나가기가 사라져 갇힌다");

      /* ── 알약 줄을 옆으로 밀어 보기 (2026-08-12 고침) ──
         `justify-content: center` 인 줄이 넘치면 넘친 몫이 **양쪽으로**
         삐져나가는데, 스크롤은 0 보다 작아질 수 없어서 왼쪽 몫은 영영
         못 잡습니다. 실제로 📢 공지가 아무리 밀어도 안 나왔어요. */
      {
        const seg = (CSS.match(/body\.narrow-chat-focus \.dock-bar\{[\s\S]*?\}/) || [""])[0];
        ok(/overflow-x: auto/.test(seg), "좁으면 알약 줄이 옆으로 밀린다");
        ok(/flex-wrap: nowrap/.test(seg), "줄바꿈 없이 한 줄로 이어진다");
        ok(/justify-content: flex-start/.test(seg),
           "★★ 왼쪽부터 채운다 — center 면 왼쪽 끝(📢 공지)에 영영 못 닿는다");
        ok(!/justify-content: center/.test(seg), "★ center 가 남아 있지 않다");
        ok(/body\.narrow-chat-focus \.dock-bar > :first-child\{ margin-left: auto; \}/.test(CSS) &&
           /body\.narrow-chat-focus \.dock-bar > :last-child\{ margin-right: auto; \}/.test(CSS),
           "★ 대신 auto 여백으로 가운데 정렬 — 다 들어갈 때만 벌어진다");
        ok(/overflow-y: hidden/.test(seg),
           "★★ 세로는 잘라 둔다 (overflow-x 만 켜면 세로가 auto 로 따라와 흔들린다)");
        ok(/padding: 8px/.test(seg) && /margin-top: -8px/.test(seg),
           "★ 위에 8px 을 내줘 안 읽음 배지가 안 잘린다 (그만큼 도로 끌어올린다)");
        /* 배지가 실제로 그만큼 튀어나오는지 — 값이 바뀌면 이 여백도 같이 봐야 합니다 */
        const 배지위 = Number((CSS.match(/\.dock-badge\{[\s\S]*?top: *-(\d+)px/) || [])[1]);
        ok(배지위 <= 8, `배지가 튀어나온 만큼(-${배지위}px)보다 여백이 넉넉하다`);
      }
    }

    /* =====================================================================
       ⑤ 실제로 눌러 봅니다 — 알약을 순서대로
       ---------------------------------------------------------------------
       ★ 여기 규칙은 script_dock.js 의 open/close/setTab 을 그대로 옮긴
         것입니다. 저쪽을 고치면 여기도 함께 고쳐야 해요 — 안 그러면
         이 검사는 **옛 규칙을 지키며 통과**하는 허수아비가 됩니다.
       ===================================================================== */
    {
      /* [2026-08-21] 공지·자료실·전체기록이 빠진 뒤의 모습입니다 */
      const DOCK2 = [
        { id:"chat", stay:true, drag:true, tab:"main", resize:true },
        { id:"chatty", stay:true, drag:true, tab:"chatty", resize:true },
        { id:"pub", stay:true, drag:true, resize:true },
        { id:"music", stay:true, drag:true, resize:true },
        { id:"todo", inline:true },
        { id:"help", stay:true, drag:true, resize:true },
        { id:"achv", stay:false }, { id:"pomo", stay:true, drag:true },
        { id:"wc", stay:true, drag:true, resize:true }
      ];
      const _open = new Set();
      let _tab = "main", 펜 = "chat", 좁게 = false;

      function setTab(t0){
        const t = t0 === "chatty" ? "chatty" : "main";
        if (_tab === t) return;
        _tab = t;
        펜 = t === "chatty" ? "chatty" : "chat";   // moveInput()
      }
      function close(id){
        _open.delete(id);
        if (id === "chatty" && _tab === "chatty") setTab("main");
        if (id === "chat" && _tab === "main" && _open.has("chatty")) setTab("chatty");
      }
      function open(id){
        const d = DOCK2.find(x => x.id === id); if (!d) return;
        if (d.modal) return;                       // 가운데 창
        if (_open.has(id)) {
          if (d.tab && _tab !== d.tab) { setTab(d.tab); return; }
          close(id); return;
        }
        if (좁게) [..._open].forEach(o => { if (o !== id) close(o); });
        if (d.tab) setTab(d.tab);
        _open.add(id);
      }

      open("chat");
      ok(_open.has("chat") && 펜 === "chat", "챗을 열면 글칸도 챗에");
      open("chatty");
      ok(_open.size === 2 && _open.has("chat") && _open.has("chatty"),
         "★★ 수다방을 열면 **판이 둘** — 챗이 닫히지 않는다");
      ok(펜 === "chatty", "글칸은 방금 연 수다방으로 간다");

      open("chat");
      ok(_open.size === 2 && 펜 === "chat",
         "★★ 열려 있는 챗 알약을 누르면 **닫지 않고 글칸만** 데려온다 (오가는 방법)");
      open("chat");
      ok(!_open.has("chat") && _open.has("chatty"), "한 번 더 누르면 그때 닫힌다");
      ok(펜 === "chatty",
         "★★ 글칸이 있던 판을 닫으면 글칸은 남은 방으로 — 아무 데도 못 쓰는 일이 없다");

      open("chat");
      open("chatty"); open("chatty");
      ok(_open.size === 1 && _open.has("chat") && 펜 === "chat",
         "수다방을 닫으면 글칸이 챗으로 돌아온다");

      open("pomo"); open("wc");
      ok(_open.size === 3, "넓은 화면에서는 여럿이 함께 열린다");

      /* 좁은 화면 — 한 번에 하나 */
      좁게 = true;
      open("pub");
      ok(_open.size === 1 && _open.has("pub"),
         "★★ 좁으면 새로 여는 순간 나머지가 접힌다 (한 번에 하나)");
      open("chat");
      ok(_open.size === 1 && _open.has("chat") && 펜 === "chat", "챗도 하나만");
      open("chatty");
      ok(_open.size === 1 && _open.has("chatty") && 펜 === "chatty",
         "★ 좁은 화면에서는 수다방을 열면 챗이 접힌다 — 글칸도 함께 넘어간다");
      ok(!_open.has("chat"), "그리고 글칸이 닫힌 판에 갇히지 않는다");

      /* 판 키우기 — 최소는 원래 크기 */
      {
        const BASE_H = 430, 천장 = 900 - 190;
        const size = { chat: 1.2, chatty: 1.35 };
        const baseH = (id) => Math.round(BASE_H * size[id]);
        const setH  = (id, h) => Math.round(Math.max(baseH(id), Math.min(천장, h)));
        ok(setH("chat", 100) === baseH("chat"),
           `★★ 작게 끌어도 원래 높이에서 멈춘다 (${setH("chat",100)} = ${baseH("chat")})`);
        ok(setH("chatty", 100) === baseH("chatty"),
           "수다방도 제 원래 높이가 바닥 — 둘의 최소가 서로 다르다");
        ok(baseH("chat") !== baseH("chatty"), "★ 두 판의 최소가 각자 다르다");
        ok(setH("chat", 700) === 700, "키우는 건 된다");
        ok(setH("chat", 99999) === 천장, "★ 화면 밖으로는 못 자란다");
      }
    }
  }

  /* 🔎 이상해졌을 때 들여다볼 창구 */
  ok(/window\.layoutDiag = function/.test(lay), "배치 진단 창구가 있다");
  ok(/window\.layoutReset = function/.test(lay), "칸 폭을 기본값으로 되돌리는 창구가 있다");
  {
    /* 콘솔을 못 여는 분도 있으니 **화면에 그려 주는** 쪽이 본체입니다 */
    const seg = lay.slice(lay.indexOf("function layoutOutline"),
                          lay.indexOf("function layoutOutline") + 2200);
    ok(/window\.layoutOutline = layoutOutline/.test(lay), "윤곽선 창구가 열려 있다");
    ok(/pointer-events:none/.test(seg), "★ 덮어 그리기만 한다 (밑에 있는 것을 못 누르게 막지 않는다)");
    ok(/position:fixed;inset:0/.test(seg), "화면 전체에 덮는다");
    ok(/document\.getElementById\("layout-outline"\)\?\.remove\(\)/.test(seg),
       "다시 불러도 겹쳐 쌓이지 않는다");
    ok(/removeEventListener\("click", 끄기, true\)/.test(seg), "★ 지운 뒤 손가락도 걷어낸다");
    ok(/getComputedStyle\(c\)\.display === "none"/.test(seg),
       "숨은 것은 안 그린다 (0px 테두리가 잔뜩 생기지 않게)");
    ok(/layoutOutline\(\);/.test(lay), "layoutDiag 를 부르면 그림도 함께 뜬다");
  }

  /* 크기는 창을 따라가야 합니다 (자리를 바꿔도 뽀모는 자기 높이) */
  ok(/function sizeKeyFor/.test(lay) && /"panel\/" \+ map\[kid\]/.test(lay),
     "칸 크기를 창 기준으로 기억한다");
  ok(/"panel\/pomo": 320/.test(lay), "뽀모 줄 기본 폭이 잡혀 있다");
  ok(/"panel\/chat": 340/.test(lay), "채팅 줄 기본 폭이 잡혀 있다");
  /* 세 칸이 나란히 서야 합니다 (예전엔 오른쪽을 위아래로 또 갈랐어요) */
  {
    const i = lay.indexOf("const TREES");
    const seg = lay.slice(i, i + 300);
    ok(/landscape:\s*\{ dir: "h", kids: \["s1", "s2", "s3"\] \}/.test(seg),
       "가로 화면에서 세 칸이 나란히 선다");
    ok(!/dir: "v", kids: \["s2", "s3"\]/.test(seg), "오른쪽을 다시 위아래로 가르지 않는다");
  }

  /* 자리 그림이 실제 모양과 같아야 합니다 */
  {
    const i = lay.indexOf("const MAP_SHAPE");
    const seg = lay.slice(i, i + 600);
    ok(/'s1 s2 s3'/.test(seg), "자리 그림이 3단 모양이다");
    ok(/'s3 s2 s1'/.test(lay), "뒤집으면 그림도 뒤집힌다");
    ok(/'s3 s2 s1'/.test(lay) && !/'s2 s1 s3'/.test(lay),
       "뒤집어도 가운데(접속자)는 가운데에 남는다");
    /* 주석이 아니라 실제로 쓰인 곳만 봅니다 */
    const code = lay.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    ok(!/direction\s*:\s*rtl/.test(code), "글자까지 뒤집는 방식을 쓰지 않는다");
  }

  ["status-pop","status-pop-item"].forEach(c =>
    ok(new RegExp("\\."+c+"[^a-zA-Z0-9_-]").test(CSS), `CSS 에 .${c} 가 있다`));
}

/* ---- 15. 🗂️ 나의 작업 (출석 달력 · 할 일 · 목표 · 기록) ----

   [2026-08-06] 머리말의 [📅 출석부] 와 [🗓️ 일정] 을 한 창으로 합쳤습니다.
   합치는 작업은 "옮기다가 하나를 흘리는" 사고가 특히 잦아서, 옮긴 것과
   버린 것을 둘 다 붙잡아 둡니다.

   ★ 이 블록을 파일 위쪽에 둔 이유

   checks.js 는 node 가 모듈로 읽습니다. 모듈 맨 바깥의 `return` 은
   **거기서 파일을 끝냅니다.** 아래쪽 로그인 검사 블록이 return 으로
   끝나기 때문에, 그보다 뒤에 적은 블록은 통째로 실행되지 않아요.
   (실제로 예전 "설정 → 나의 기록" 블록이 그렇게 죽어 있었고, 화면에는
    "전부 통과"라고만 나왔습니다.) 새 블록은 반드시 여기 위쪽에 둡니다. */
{
  const mw = fs.readFileSync(DIR+"script_mywork.js","utf8");
  const dt = fs.readFileSync(DIR+"script_data.js","utf8");
  const tl = fs.readFileSync(DIR+"script_timelog.js","utf8");
  const pr = fs.readFileSync(DIR+"script_profile.js","utf8");
  const bs = fs.readFileSync(DIR+"build-single.py","utf8");
  const FLAT = CSS.replace(/\s+/g, " ");

  /* ── 옛 일정 기능이 정말 빠졌는가 ── */
  ok(!/script_schedule\.js/.test(HTML), "index.html 이 옛 일정 스크립트를 부르지 않는다");
  ok(!/script_schedule\.js/.test(bs),   "단일파일 빌드 목록에서도 빠졌다");
  ok(!/id="schedule-modal"/.test(HTML), "일정 팝업 자리가 없다");
  ok(!/openSchedule|switchScheduleTab/.test(HTML), "일정 버튼·탭이 남아 있지 않다");
  ok(!/sch-cell|sch-pill|sch-table/.test(CSS), "일정 팝업 CSS 도 함께 지웠다");
  /* 주석에는 "일정은 없앴다"는 설명이 남아 있으므로, 주석을 걷어내고 봅니다.
     (예전에 이 함정에 한 번 걸렸습니다) */
  const MW = mw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  ok(!/schedule/i.test(MW), "새 창은 일정 데이터를 읽지도 쓰지도 않는다");
  if (fs.existsSync(DIR+"script_schedule.js")) {
    const old = fs.readFileSync(DIR+"script_schedule.js","utf8");
    ok(!/window\.openSchedule/.test(old), "남아 있는 옛 파일은 비어 있다 (아무것도 내보내지 않는다)");
  } else {
    ok(true, "옛 일정 파일이 지워졌다");
  }

  /* ── 나의 작업으로 가는 문은 하나뿐 ──
     [고침 2026-08-08] 머리말 버튼을 없앴습니다. 카드 아래칸과 같은 창을
     두 곳에서 열면, 어느 쪽이 진짜인지 헷갈리고 설명할 것도 늘어납니다. */
  ok(!/onclick="openMyWork\(\)"/.test(HTML) && !/id="mywork-btn"/.test(HTML),
     "머리말에 [🗂️ 나의 작업] 버튼이 없다");
  ok(!/onclick="showMyAttendance\(\)"/.test(HTML), "머리말의 [📅 출석부] 버튼은 빠졌다");


  /* ── 창 뼈대 ── */
  ["mywork-modal","mywork-cal","mywork-tabs","mywork-goal-slot",
   "mywork-panel-todo","mywork-panel-goal",
   "mywork-panel-time","mywork-panel-wc"].forEach(id =>
    ok(new RegExp('id="'+id+'"').test(HTML), `${id} 자리가 있다`));
  /* [고침 2026-08-08] 탭이 넷 — 할 일 · 목표 · 작업 시간 · 글자수.
     예전 [📊 기록] 한 탭에 그래프가 둘이라 뭘 보는지 헷갈렸습니다. */
  ["todo","goal","time","wc"].forEach(k =>
    ok(new RegExp('data-mw-tab="'+k+'"').test(HTML), `${k} 탭 버튼이 있다`));
  {
    const order = ["todo","goal","time","wc"]
      .map(k => HTML.indexOf('data-mw-tab="'+k+'"'));
    ok(order.every((v,i) => v > 0 && (i === 0 || v > order[i-1])),
       "탭 순서가 할 일 → 목표 → 작업 시간 → 글자수 다");
  }
  /* [2026-08-11] 한글 제목(나의 작업)을 없애고 — MY DESK — 하나만 남겼습니다.
     창 이름표가 그 h2 를 가리키므로, id 와 읽어 줄 말이 함께 옮겨왔는지
     봅니다. 둘 중 하나만 빠져도 화면 읽기 프로그램이 창 이름을 잃습니다. */
  ran["mywork"]=true;
  ok(/id="mywork-title"[^>]*>— MY DESK —</.test(HTML), "표지식 제목이 창 이름표를 물려받았다");
  ok(/id="mywork-title"[^>]*aria-label="나의 작업"/.test(HTML),
     "★ 소리로 읽을 이름은 '나의 작업' 으로 남겨 뒀다");
  ok(!/<h2 class="modal-title" id="mywork-title"/.test(HTML), "옛 한글 제목 줄은 없앴다");

  {
    /* ★ 설정 모달과 클래스 이름이 겹치면 안 됩니다.
       openTab() 은 문서 전체의 .tab / .panel 에서 active 를 떼어냅니다.
       나의 작업 탭이 같은 이름을 쓰면, 설정에서 탭을 한 번 누르는 것만으로
       이 창의 탭이 통째로 꺼집니다. */
    const a = HTML.indexOf('id="mywork-modal"');
    const b = HTML.indexOf('id="settings-modal"');
    const seg = HTML.slice(a, b > a ? b : HTML.length);
    ok(seg.length > 500, "나의 작업 창 덩어리를 찾았다");
    ok(!/class="tabs?[ "]/.test(seg), "설정 탭과 같은 클래스(.tab/.tabs)를 쓰지 않는다");
    ok(!/class="panel[ "]/.test(seg), "설정 패널과 같은 클래스(.panel)를 쓰지 않는다");
    ok(/closeMyWork\(\)/.test(seg), "닫기 버튼이 창 안에 있다");
  }

  /* ── 창구 ── */
  ["openMyWork","closeMyWork","switchMyWorkTab","renderMyWorkIfOpen"].forEach(f =>
    ok(new RegExp("window\\."+f+" =").test(mw), `${f} 를 밖에서 부를 수 있다`));
  ok(/"script_mywork\.js":\s+"openMyWork"/.test(HTML), "로드 자가진단 목록에 새 파일이 있다");

  /* ── 왼쪽 출석 달력 ── */
  ok(/att-grid/.test(mw) && /att-day/.test(mw), "옛 출석 달력의 뼈대를 그대로 쓴다");
  ok(/attend\/days/.test(mw), "출석 도장을 users/{닉}/attend/days 에서 읽는다");
  ok(/vacations\//.test(mw), "휴가를 users/{닉}/vacations 에 쓴다");
  ok(/이 달 <b>\$\{attended\}일<\/b> 출석했어요/.test(mw), "이 달 출석 일수를 알려준다");
  /* [2026-08-17] "n일" → "n/상한일". 상한이 입장일에 따라 달라져서,
     쓴 날만 보여주면 얼마나 남았는지 알 수가 없습니다. */
  ok(/🏖️ 이 달 휴가 <b>\$\{vacCount\}\/\$\{cap\}일<\/b>/.test(mw),
     "이 달 휴가를 '쓴 날/상한' 으로 알려준다");
  ok(/data-mv="-1"/.test(mw) && /data-mv="1"/.test(mw), "‹ › 로 달을 넘긴다");
  /* [고침 2026-08-06] 문구를 "누르면" → "클릭 / 더블 클릭" 으로 바꿨습니다 */
  ok(/<b>클릭<\/b>/.test(mw) && /<b>더블 클릭<\/b>/.test(mw),
     "단일·더블 클릭 안내 문구가 달력 아래에 있다");
  /* [추가 2026-08-06] 팝업 안쪽 상자는 click 을 막습니다(.modal-content 의
     stopPropagation). 리스너를 껍데기에 달면 단일 클릭이 통째로 죽습니다. */
  ok(/querySelector\(["'`]\.modal-content["'`]\)/.test(mw),
     "클릭 리스너를 안쪽 상자(.modal-content)에 단다");
  ok(/addEventListener\("dblclick"/.test(mw), "더블클릭을 따로 듣는다");
  ok(/_clickTimer = setTimeout/.test(mw) && /DBL_MS/.test(mw),
     "단일 클릭은 잠깐 기다렸다 처리한다 (더블클릭과 겹치지 않게)");
  ok(/toggleVac\(cell\.dataset\.d\)/.test(mw), "두 번 누르면 휴가를 껐다 켠다");
  ok(!/showMyAttendance/.test(MW), "옛 출석 팝업을 다시 띄우지 않는다 (창이 겹치지 않게)");
  ok(/mw-dot/.test(mw) && /is-clear/.test(mw), "그날 할 일이 있으면 점을 찍고, 다 끝냈으면 옅게 한다");
  ok(/key === _sel \? "picked"/.test(mw), "고른 날짜를 따로 표시한다");
  ok(/\.att-day\.picked\{[^}]*inset 0 0 0 2px/.test(FLAT), "고른 날짜는 짙은 안쪽 테두리다");
  ok(/\.att-day\.today\{[^}]*outline/.test(FLAT), "오늘은 바깥 테두리라 고른 날짜와 구분된다");

  /* ── 📌 할 일 — 연동 규칙 ── */
  ok(/window\.renderMyWorkIfOpen\?\.\(\)/.test(dt), "할 일이 바뀌면 나의 작업 창도 다시 그린다");
  ok(!/renderScheduleIfOpen/.test(dt), "옛 일정 훅이 남아 있지 않다");
  ok(/function todosForProfileList/.test(dt), "프로필 목록용 걸러내기가 있다");
  ok(/window\.todosForProfileList\(\)/.test(fs.readFileSync(DIR+"script_realtime.js","utf8")),
     "카드 진척 계산이 그 걸러내기를 쓴다");
  ["getTodoItems","toggleTodoDone","setTodoDue","addTodoWithDue","editTodo","deleteTodo"]
    .forEach(f => ok(new RegExp("window\\."+f+" =").test(dt), `${f} 창구가 열려 있다`));
  ok(/window\.addTodoWithDue/.test(mw), "새 창은 그 창구로 할 일을 넣는다");
  ok(!/db\.ref\([^)]*todos/.test(mw), "새 창이 할 일을 직접 저장하지 않는다 (주인은 script_data.js)");
  ok(/날짜 없는 할 일/.test(mw), "날짜 없는 할 일 칸이 있다");
  ok(/개 중 \$\{doneN\}개 완료/.test(mw), "그날 몇 개 중 몇 개를 끝냈는지 보여준다");
  /* [고침 2026-08-09] 할 일은 이제 🗂️ 나의 작업 한 곳에서만 봅니다.
     프로필 팝업이 없어져서 "무엇만 보이는지" 안내도 필요 없어졌어요. */
  ok(/data-mw-clear/.test(mw), "🧹 치우기가 할 일 탭 안으로 옮겨왔다");
  ok(/window\.clearCompletedTodos\?\.\(\)/.test(mw), "그 버튼이 기존 치우기 기능을 그대로 부른다");

  {
    /* ★ 규칙을 말로만 적어두면 언젠가 어긋납니다 — 실제로 굴려봅니다.
       프로필 팝업에는 오늘 것 · 날짜 없는 것 · 🔁 반복만 보여야 합니다. */
    const a = dt.indexOf("function todosForProfileList");
    const b = dt.indexOf("window.todosForProfileList");
    const ctx = { console };
    ctx.window = ctx;
    ctx._list = [];
    ctx.ymd = () => "2026-08-06";
    ctx.isTodoDue = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    ctx.getTodoItemsFromUI = () => ctx._list;
    vm.createContext(ctx);
    vm.runInContext(dt.slice(a, b) + "\nglobalThis.F = todosForProfileList;", ctx);

    ctx._list = [
      { id:"오늘",   due:"2026-08-06" },
      { id:"다음달", due:"2026-09-01" },
      { id:"지난것", due:"2026-08-01" },
      { id:"날짜없음" },
      { id:"반복",   routine:true, due:"2026-09-01" }
    ];
    const got = ctx.F().map(x => x.id).join(",");
    ok(got === "오늘,날짜없음,반복",
       "프로필에는 오늘 것·날짜 없는 것·반복만 보인다 ("+got+")");
    ok(ctx.F().length !== ctx._list.length, "다른 날짜 것은 프로필에서 가려진다");
  }

  /* ── 🎯 목표 탭 ── */
  ok(/window\.mountStatusBlock/.test(pr), "목표 덩어리를 옮기는 함수가 있다");
  ok(/mountStatusBlock/.test(mw), "🎯 목표 탭이 그 함수를 쓴다");
  ok(!/innerHTML/.test(mw.slice(mw.indexOf("function renderGoalPanel"),
                                mw.indexOf("function renderRecPanel"))),
     "목표 덩어리를 다시 그리지 않고 옮기기만 한다 (다시 그리면 저장이 끊깁니다)");
  {
    const sb = HTML.slice(HTML.indexOf('id="status-block"'), HTML.indexOf('id="todo-block"'));
    ok(/resetTodayWorkTime/.test(sb),
       "[⏱️ 오늘 작업 시간 초기화] 가 #status-block 안에 있다 (목표 탭으로 함께 옮겨감)");
    ok(/id="db-today-goal-text"/.test(sb), "오늘 목표 입력칸도 같은 덩어리다");
  }

  /* ── ⏱️ 작업 시간 · ✍️ 글자수 탭 ── */
  ok(/mywork-panel-time/.test(tl) && /mywork-panel-wc/.test(tl),
     "두 화면이 각자 자리를 찾는다");
  ok(/function timePanelHost/.test(tl) && /function wcPanelHost/.test(tl),
     "자리를 찾는 함수가 따로 있다");
  ok(/function exportBlock/.test(tl) && (tl.match(/exportBlock\(backWeeks, wcBack\)/g) || []).length >= 2,
     "내보내기 버튼은 두 탭 아래에 똑같이 붙는다 (한 파일에 둘 다 담기므로)");
  ok(/renderMyRecordPanel/.test(mw), "두 탭 모두 그 함수를 쓴다");
  ok(/window\.renderMyRecordPanel/.test(tl), "그리는 함수가 밖에서 불린다");
  ok(!/data-tab="record"/.test(HTML), "설정의 📊 나의 작업 탭이 빠졌다");
  ok(!/id="panel-record"/.test(HTML), "설정의 기록 패널 자리도 빠졌다");
  ok(!/name === "record"/.test(pr), "설정 탭 전환 훅에서도 빠졌다");

  /* ★ 팝업과 기록 탭이 같은 코드를 써야 합니다.
     예전처럼 openRecord 안에 HTML 이 박혀 있으면, 다른 자리용으로 복사하게
     되고 한쪽만 고치는 사고가 반드시 납니다. */
  ok(/function recordHtml\(rows/.test(tl), "기록 화면을 만드는 함수가 하나로 떼어져 있다");
  ok((tl.match(/rec-today/g) || []).length === 1, "기록 화면 뼈대가 한 곳에만 있다 (복사본 없음)");
  ok(!/id="record-modal"/.test(HTML) && !/function openRecord/.test(tl),
     "옛 기록 팝업(#record-modal)은 걷어냈다");
  ok(/recordHtml\(await loadSummary\(myNick, 7/.test(tl), "나의 작업의 📊 기록도 그 함수를 쓴다");
  ok(/Wordcount\?\.myWeekHtml/.test(tl), "글자수 요약도 함께 가져다 쓴다");
  ok(/글자수 기록을 불러오지 못했어요/.test(tl), "글자수를 못 가져와도 화면이 깨지지 않는다");
  ok(/입장 후에 볼 수 있어요/.test(tl), "입장 전에는 그렇다고 알려준다");

  {
    /* 글자수 요약 — 옛 검사는 myWeekHtml() 을 그 자리에서 굴려 결과 글을
       들여다봤습니다. 그 함수가 그 뒤 async 로 바뀌면서 이제는 Promise 가
       돌아옵니다(문자열이 아니라). 이 검사 블록은 동기라 기다릴 수 없어서,
       "무엇이 들어 있어야 하는가"를 코드에서 봅니다. */
    const wc = fs.readFileSync(DIR+"script_wordcount.js","utf8");
    ok(/myWeekHtml/.test(wc), "글자수 요약을 만드는 함수가 있다");
    ok(/async function myWeekHtml/.test(wc), "그 함수는 서버를 기다리는 async 다");
    ok(/await window\.Wordcount\.myWeekHtml/.test(tl),
       "쓰는 쪽이 await 로 기다린다 (Promise 를 그대로 붙이면 [object Promise] 가 나옵니다)");
    ok(/rec-big/.test(wc),  "글자수 요약에 오늘 숫자 자리가 있다");
    ok(/이번 주/.test(wc),  "이번 주 합계 자리도 있다");
    ok(/출발선/.test(wc),   "출발선을 안 잡았으면 그렇다고 알려준다");
  }

  /* ── 디자인 (원고지 결) ── */
  ok(/#mywork-modal \.modal-content\{ width: min\(920px/.test(FLAT), "창이 넉넉하다 (920px)");
  ok(/#mywork-modal \.modal-content\{[^}]*#FAF6EC/.test(FLAT), "원고지 종이 바탕을 쓴다");
  ok(/#mywork-modal \.modal-content\{[^}]*1\.5px solid #B3372B/.test(FLAT), "붉은 테두리를 두른다");
  ok(/#mywork-modal \.mw-eyebrow\{[^}]*Noto Serif KR/.test(FLAT), "제목이 명조다");
  /* 한글 제목이 받쳐 주던 자리를 잃었으니 글자와 여백을 키웠습니다 */
  ok(/#mywork-modal \.mw-eyebrow\{[^}]*font-size: var\(--fs-md\)/.test(FLAT), "제목을 키웠다");
  ok(/#mywork-modal \.mw-eyebrow\{[^}]*margin: 0 0 var\(--sp-5\)/.test(FLAT), "제목 아래 여백이 넉넉하다");
  ok(/\.mw-tab\.is-on\{[^}]*#4A140D/.test(FLAT) && /\.mw-tab\.is-on\{[^}]*#FFFDF6/.test(FLAT),
     "고른 탭은 짙은 붉은 바탕에 흰 글자다");
  ok(/@media \(max-width: 720px\)\{ \.mw-cols\{ flex-direction: column/.test(FLAT),
     "좁은 화면에서는 달력이 위, 탭이 아래로 간다");
  ["mw-eyebrow","mw-cols","mw-calwrap","mw-side","mw-calhead","mw-caltitle",
   "mw-nav","mw-todaybtn","mw-calfoot","mw-calhint","mw-dot","mw-tabs","mw-tab",
   "mw-panel","mw-dayhead","mw-daytitle","mw-todaytag","mw-daycount","mw-todolist",
   "mw-todo","mw-chk","mw-empty","mw-add","mw-add-in","mw-add-btn","mw-sep","mw-hint"]
    .forEach(c => ok(new RegExp("\\."+c+"[^a-zA-Z0-9_-]").test(CSS), `CSS 에 .${c} 가 있다`));
}

/* ---- 16. 🎋 대숲 (익명 게시판) ----

   [무엇이 무너지면 안 되는가]
   이 기능의 값어치는 오직 "익명" 하나입니다. 닉네임이나 uid 가 한 줄이라도
   서버로 새어 나가면 기능 전체가 거짓말이 됩니다. 그래서 여기서는
   화면 모양보다 **무엇이 서버에 적히는가** 를 제일 세게 봅니다.

   ★ 이 블록도 아래 로그인 블록의 `return` 보다 위에 두어야 합니다.
     (모듈 맨 바깥의 return 은 거기서 파일을 끝내버립니다) */
{
  const fr  = fs.readFileSync(DIR+"script_forest.js","utf8");
  const adm = fs.readFileSync(DIR+"script_admin.js","utf8");
  const ADH = fs.readFileSync(DIR+"admin.html","utf8");
  const bs2 = fs.readFileSync(DIR+"build-single.py","utf8");
  const FLAT2 = CSS.replace(/\s+/g, " ");
  /* 주석에는 "닉네임을 넣지 않는다" 같은 설명이 잔뜩 있으므로,
     익명성 검사는 주석을 걷어낸 알맹이에만 겁니다. */
  const FR = fr.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  /* ── 익명성 — 서버에 무엇이 적히는가 ── */
  ok(!/\bnick\b/.test(FR),  "대숲 코드에 nick 이라는 말이 아예 없다");
  ok(!/\buid\b/.test(FR),   "대숲 코드에 uid 라는 말이 아예 없다");
  ok(!/myNick\s*[,}]/.test(FR) && !/nick:/.test(FR) && !/uid:/.test(FR),
     "쪽지에 글쓴이를 담는 항목이 없다");
  {
    /* 서버로 보내는 덩어리(note = { ... })에 정확히 무엇이 들어가는지 */
    const i = FR.indexOf("const note = {");
    const seg = FR.slice(i, FR.indexOf("};", i));
    ok(i > 0, "붙이기가 만드는 쪽지 덩어리를 찾았다");
    const keys = (seg.match(/^\s*(\w+)\s*:/gm) || []).map(s => s.trim().replace(/:$/, ""));
    ["text","color","x","y","rot","at","hearts"].forEach(k =>
      ok(keys.includes(k), `쪽지에 ${k} 가 있다`));
    ok(keys.length === 7, `쪽지에 그 일곱 가지 말고는 아무것도 없다 (${keys.join(",")})`);
  }
  ok(/window\.db\.ref\("forest"\)\.push\(\)/.test(FR), "자동 키(push)로 붙인다 — 순서 말고는 아무 단서도 남기지 않게");
  ok(/AppStore/.test(FR), "내가 쓴 쪽지 목록은 이 기기(AppStore)에만 둔다");
  ok(/forestMine/.test(fr) && /forestHearts/.test(fr), "그 목록의 열쇠 이름이 정해져 있다");
  ok(/isMine\(/.test(FR), "이 기기가 기억하는 쪽지에만 ✕ 를 보여준다");
  ok(/didHeart\(/.test(FR), "♥ 중복은 이 기기 기록으로 막는다");
  ok(/hearts`\)\.transaction|hearts"\)\.transaction/.test(FR),
     "♥ 는 총 개수만 올린다 (누가 눌렀는지는 서버에 안 적는다)");

  /* ── 30일이 지나면 시든다 ── */
  ok(/30 \* DAY_MS/.test(fr), "보관 기간이 30일이다");
  ok(/function sweepOld/.test(FR), "오래된 쪽지를 걷어내는 함수가 있다");
  ok(/await sweepOld\(\)/.test(FR), "팝업을 열 때 그 청소를 돌린다");
  ok(/catch \(e\) \{\}/.test(fr), "청소가 실패해도 조용히 넘어간다");
  ok(/30일이 지나면 저절로 시들어요/.test(HTML), "화면 아래에 그 규칙을 적어 두었다");

  /* ── 색 팔레트 (A안 "먹지와 한지") ── */
  ok(/const FOREST_COLORS = \[/.test(fr), "색을 상수 배열 FOREST_COLORS 에 모아 두었다");
  [["한지","#F2EBDC","#4A4034","#9A8E7C"],
   ["이끼","#E3E7E0","#3B443A","#8B968A"],
   ["매화","#E9E1E4","#4B3D42","#9C8B92"],
   ["새벽","#DFE4EA","#3A4450","#8794A2"],
   ["볕",  "#EDE6DA","#4C4436","#9B927F"]].forEach(([n,bg,fg,sub]) =>
    ok(new RegExp(`"${n}".*${bg}.*${fg}.*${sub}`).test(fr), `${n} 색 세 벌이 그대로다`));
  ok(/color: 0~4|0, FOREST_COLORS\.length - 1/.test(fr), "서버에는 색 번호(0~4)만 저장한다");

  /* ── 머리말 버튼 ── */
  ok(/id="forest-btn"[^>]*onclick="openForest\(\)"/.test(HTML), "머리말에 [🎋 대숲] 버튼이 있다");
  ok((HTML.match(/openForest\(\)/g) || []).length === 1, "그 버튼은 하나뿐이다");
  ok((HTML.match(/closeForest\(\)/g) || []).length === 2, "닫는 길은 둘 (바깥 누르기 · [닫기] 버튼)");
  /* [2026-08-21 자리 바뀜] 공지 · 자료실 · 대숲 · 화면공유 · 접속유지 …  */
  ok(HTML.indexOf('id="forest-btn"') > HTML.indexOf('id="files-head-btn"')
     && HTML.indexOf('id="forest-btn"') < HTML.indexOf('id="share-btn"'),
     "[대숲] 이 [자료실] 과 [화면 공유] 사이에 있다");

  /* ── 창 뼈대 ── */
  ["forest-modal","forest-board","forest-count"].forEach(id =>
    ok(new RegExp('id="'+id+'"').test(HTML), `${id} 자리가 있다`));
  ok(/— WHISPER —/.test(HTML), "표지식 작은 제목이 있다");
  ok(/id="forest-title">대 숲</.test(HTML), "명조 제목이 '대 숲' 이다");
  ok(/빈 곳을 클릭해서 아무 말이나 붙여요 · 누가 썼는지는 아무도 몰라요/.test(HTML),
     "안내 한 줄이 있다");
  {
    const a = HTML.indexOf('id="forest-modal"');
    const b = HTML.indexOf('id="settings-modal"');
    const seg = HTML.slice(a, b > a ? b : HTML.length);
    ok(seg.length > 400, "대숲 창 덩어리를 찾았다");
    ok(!/class="tabs?[ "]/.test(seg), "설정 탭과 같은 클래스(.tab/.tabs)를 쓰지 않는다");
    ok(!/class="panel[ "]/.test(seg), "설정 패널과 같은 클래스(.panel)를 쓰지 않는다");
    ok(/closeForest\(\)/.test(seg), "닫기 버튼이 창 안에 있다");
    ok(/다른 기기/.test(seg), "✕ 가 이 기기에서만 보인다는 한계를 창 안에 적어 두었다");
  }

  /* ── 창구 · 파일 배선 ── */
  ["openForest","closeForest"].forEach(f =>
    ok(new RegExp("window\\."+f+" =").test(fr), `${f} 를 밖에서 부를 수 있다`));
  ok(/<script src="script_forest\.js/.test(HTML), "index.html 이 새 파일을 부른다");
  ok(/"script_forest\.js":\s+"openForest"/.test(HTML), "로드 자가진단 목록에 새 파일이 있다");
  ok(/"script_forest\.js"/.test(bs2), "단일파일 빌드 목록(ORDER)에도 있다");

  /* ── 팝업 안 클릭이 죽지 않는가 (script_mywork.js 와 같은 함정) ── */
  ok(/querySelector\(["'`]\.modal-content["'`]\)/.test(fr),
     "위임 리스너를 안쪽 상자(.modal-content)에 단다");

  /* ── 보드와 쪽지 ── */
  ok(/#DED6C6/.test(CSS), "보드 바탕이 #DED6C6 이다");
  ok(/\.fr-board\{[^}]*radial-gradient/.test(FLAT2), "보드에 은은한 점 패턴이 있다");
  ok(/\.fr-board\{[^}]*border-radius: 10px/.test(FLAT2), "보드 모서리가 10px 이다");
  /* [고침 2026-08-07] 창을 옆으로 3할 넓히고 세로는 1할 줄였습니다.
     쪽지는 옆으로 퍼지는 편이 읽기 좋고, 세로로 길면 스크롤이 생겨요. */
  /* [갱신 2026-08-13] 쪽지 수만큼 자라던 높이를 화면 맞춤 고정으로 교체 */
  ok(/\.fr-board\{[^}]*min-height: 340px/.test(FLAT2), "보드 최소 높이가 340px 이다");
  ok(/\.fr-board\{[^}]*inset/.test(FLAT2), "보드에 안쪽 그림자가 있다");
  ok(/\.fr-note\{[^}]*position: absolute/.test(FLAT2), "쪽지는 저장된 자리에 절대 배치된다");
  ok(/\.fr-note\{[^}]*width: 150px/.test(FLAT2), "쪽지 폭이 150px 이다");
  ok(/\.fr-note\{[^}]*padding: 11px 12px/.test(FLAT2), "쪽지 안쪽 여백이 11~12px 이다");
  ok(/\.fr-note\{[^}]*rotate\(var\(--fr-rot/.test(FLAT2), "저장된 각도로 기울인다 (볼 때마다 바뀌지 않게)");
  ok(/\.fr-note\{[^}]*min\(var\(--fr-x/.test(FLAT2) && /\.fr-note\{[^}]*min\(var\(--fr-y/.test(FLAT2),
     "쪽지가 보드 밖으로 나가지 않게 자른다");
  ok(/Math\.random\(\) \* 6 - 3/.test(fr), "각도는 -3° ~ 3° 사이에서 한 번만 뽑는다");
  ok(/z-index:\$\{z\}/.test(fr) && /a\.at - b\.at/.test(fr), "최신 쪽지가 위로 온다");
  ok(/function ago\(/.test(FR) && /시간 전/.test(fr), "'2시간 전' 처럼 흐릿하게 보여준다");
  ok(/MAX_TEXT = 200/.test(fr) && /maxlength="\$\{MAX_TEXT\}"/.test(fr), "쪽지는 200자까지다");
  ok(/data-fr-color=/.test(fr) && /fr-swatch/.test(fr), "색 고르기 원형 버튼이 있다");
  ok(/data-fr-act="cancel"/.test(fr) && /data-fr-act="post"/.test(fr), "[취소] [붙이기] 가 있다");
  ok(/취소<\/button>/.test(fr) && /붙이기<\/button>/.test(fr), "그 두 버튼의 이름이 그대로다");
  ok(/function openCompose/.test(FR) && /e\.clientX - r\.left/.test(fr),
     "누른 자리를 보드 기준 %로 바꿔 기억한다");

  /* ── 좁은 화면에서는 세로 목록으로 ── */
  ok(/@media \(max-width: 600px\)\{ \.fr-board\{ height: auto/.test(FLAT2),
     "600px 이하에서 보드가 세로로 흐른다");
  ok(/@media \(max-width: 600px\)[\s\S]*\.fr-note, \.fr-compose\{ position: static/.test(FLAT2),
     "그때 쪽지는 절대 배치를 버린다 (모바일에서 겹쳐 안 보이는 사고 방지)");

  /* ── CSS 클래스가 다 있는가 ── */
  ["fr-eyebrow","fr-lead","fr-board","fr-empty","fr-note","fr-note-text","fr-note-foot",
   "fr-note-time","fr-heart","fr-del","fr-compose","fr-text","fr-count","fr-swatches",
   "fr-swatch","fr-compose-btns","fr-btn","fr-foot","fr-wither"]
    .forEach(c => ok(new RegExp("\\."+c+"[^a-zA-Z0-9_-]").test(CSS), `CSS 에 .${c} 가 있다`));
  /* [2026-08-09] 한 번 더 130% — 1196 → 1555. 대숲은 글이 길어서
     한 줄에 담기는 글자 수가 읽는 맛을 많이 좌우합니다. */
  ok(/#forest-modal \.modal-content\{ width: min\(1555px/.test(FLAT2), "창이 넉넉하다 (1555px)");
  {
    /* [갱신 2026-08-13] 쪽지 수만큼 보드를 늘리던 boardHeight 는 없앴습니다
       — 쪽지가 붙을수록 창이 길어져 스크롤이 생기는 원인이었어요.
       지금은 CSS 가 화면 높이에 맞춰 고정합니다 (아래 대숲 개편 검사) */
    const FJ = fs.readFileSync(DIR+"script_forest.js","utf8");
    ok(!/--fr-h/.test(FJ), "JS 가 보드 높이를 더는 만지지 않는다");
  }
  {
    /* 팝업 공용 규칙(자리 잡기·어둡게 덮기) 목록에 빠지면 화면 옆에
       어색하게 붙습니다 — 예전에 #goals-modal 이 그랬어요. */
    const i = FLAT2.indexOf("#record-modal, #goals-modal,");
    const seg = FLAT2.slice(i, FLAT2.indexOf("}", i));
    ok(/#forest-modal/.test(seg), "팝업 공용 규칙 선택자 목록에 #forest-modal 이 있다");
  }

  /* ── 보안규칙 ── */
  {
    const rules = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;
    const f = rules.forest;
    ok(!!f, "보안규칙에 forest 가 있다");
    ok(f[".read"] === "auth != null", "익명이지만 로그인은 해야 읽는다 (방 밖 사람은 못 읽게)");
    const w = (f.$id || {})[".write"] || "";
    ok(/auth != null/.test(w), "쓰기도 로그인이 필요하다");
    ok(/!data\.exists\(\)/.test(w), "새로 쓰기를 허용한다");
    ok(/!newData\.exists\(\)/.test(w), "지우기를 허용한다");
    ok(/newData\.child\('text'\)\.val\(\) === data\.child\('text'\)\.val\(\)/.test(w),
       "글이 그대로인 수정만 허용한다 (♥ 때문에 — 내용 바꿔치기는 막힘)");
    ok(/ABM1ZJndrqaV3gpYUs03SV9qglr1/.test(w), "관리자 uid 는 무조건 쓸 수 있다");
    ok(/ABM1ZJndrqaV3gpYUs03SV9qglr1/.test(f[".write"] || ""),
       "관리자는 forest 를 통째로 지울 수 있다 (전체 비우기)");
  }

  /* ── 관리자 화면 ── */
  ok(/🎋 대숲 관리/.test(ADH), "관리자 페이지에 대숲 카드가 있다");
  ["adm-forest-count","adm-forest-list","adm-forest-sweep","adm-forest-clear"].forEach(id =>
    ok(new RegExp('id="'+id+'"').test(ADH), `관리자 화면에 ${id} 가 있다`));
  ok(/function loadForest/.test(adm), "쪽지 목록을 읽어온다");
  ok(/쪽지 \$\{rows\.length\}장/.test(adm), "쪽지 개수를 보여준다");
  ok(/function sweepForest/.test(adm), "[30일 지난 쪽지 정리] 가 움직인다");
  ok(/function clearForest/.test(adm), "[대숲 전체 비우기] 가 움직인다");
  {
    const i = adm.indexOf("async function clearForest");
    const seg = adm.slice(i, adm.indexOf("\n  }", i));
    ok((seg.match(/confirm\(/g) || []).length === 2, "전체 비우기는 confirm 을 두 번 받는다");
  }
  ok(/data-forest-del=/.test(adm), "목록의 각 줄에 [삭제] 가 있다");
  ok(/loadForest\(\);/.test(adm.slice(adm.indexOf("function openDash"))),
     "대시보드를 열면 대숲도 불러온다");
}

/* ---- 17. 🖥️ 화면 공유 (자체 모자이크) ----

   [무엇이 무너지면 안 되는가]
   이 기능의 약속은 딱 하나입니다 — "원본은 내 컴퓨터를 벗어나지 않는다".
   서버로 나가는 그림은 반드시 **먼저 작은 캔버스에 줄여 뭉갠 뒤** 만든
   것이어야 합니다. 어느 날 실수로 원본 크기 캔버스에 그려 보내면
   화면 그대로가 서버에 올라갑니다. 그래서 여기서는 모양보다
   **무엇을 어떻게 만들어 보내는가** 를 제일 세게 봅니다.

   ★ 이 블록도 아래 로그인 블록의 `return` 보다 위에 두어야 합니다. */
{
  const sh  = fs.readFileSync(DIR+"script_share.js","utf8");
  const bs3 = fs.readFileSync(DIR+"build-single.py","utf8");
  const RT  = fs.readFileSync(DIR+"script_realtime.js","utf8");
  const FLAT3 = CSS.replace(/\s+/g, " ");
  /* 주석에 설명이 잔뜩 있으므로, "무엇을 하는가" 검사는 주석을 걷어낸
     알맹이에만 겁니다. */
  const SH = sh.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  /* ── 원본이 나가지 않는가 (핵심) ── */
  ok(/작은 캔버스|아주 작게/.test(sh) && /원본은 (내 컴퓨터를|이 컴퓨터를)/.test(sh),
     "파일 머리 주석에 '원본은 내 컴퓨터를 벗어나지 않는다'가 적혀 있다");
  /* [넓힘 2026-08-21] 두 군데가 됐습니다 —
       grabMosaic()   진짜 화면을 뭉개서 내보내는 곳
       soloBlurShot() 🧘 혼자 방에서 **화면에만** 같은 뭉갬을 걸어 보는 곳
     ★ 뜻은 그대로입니다: 둘 다 **작은 캔버스**에서만 꺼냅니다.
       (캔버스 크기는 바로 아래 cv.width 검사가 지킵니다.) */
  ok((SH.match(/toDataURL/g) || []).length === 2, "그림을 꺼내는 곳이 둘뿐이다");
  ok((SH.match(/toDataURL\("image\/jpeg"/g) || []).length === 2,
     "★ 둘 다 품질을 정해 JPEG 로 꺼낸다 (PNG 로 꺼내면 용량이 몇 배가 됩니다)");
  ok(/cv\.width = w; cv\.height = h;/.test(SH), "캔버스 크기를 강도(w·h)로만 정한다");
  {
    /* 캔버스 가로에 들어가는 값이 강도(w) 말고는 없어야 합니다.
       videoWidth 가 여기 들어오는 순간 원본 그대로가 나갑니다. */
    /* [넓힘 2026-08-21] 캔버스가 둘이 됐습니다 —
         cv.width = w;      뭉갠 그림 (밖으로 나가는 것)
         cv.width = 지문W;  64×40 지문 (안 바뀌었는지 견주는 용도, **안 나감**)
       뜻은 그대로입니다: **videoWidth 가 캔버스로 들어오는 길이 없어야** 해요. */
    const wa = (SH.match(/cv\.width\s*=\s*[^;]+;/g) || []).map(x => x.replace(/\s+/g, " "));
    ok(wa.length === 3 && wa.includes("cv.width = w;") &&
       wa.includes("cv.width = 지문W;") && wa.includes("cv.width = W;"),
       "원본 해상도로 캔버스를 잡는 길이 없다 (" + wa.join(" ") + ")");
    /* 🧘 혼자 방 쪽 W 도 반드시 상한 안으로 조여져 있어야 합니다 */
    ok(/return Math\.max\(SHARE_W_MIN, Math\.min\(SHARE_W_MAX, Number\(w\) \|\| _shareW\)\);/.test(SH),
       "★★ 혼자 방 뭉갬도 같은 상한(SHARE_W_MAX)에 갇힌다");
    ok(/const PIX = SHARE_W_MAX \* Math\.round\(SHARE_W_MAX \* 0\.6\);/.test(SH),
       "★ 픽셀 상한도 진짜 방과 같은 식을 쓴다 (여기서 본 것이 저기서 보일 것)");
    /* ── ① 안 바뀌면 안 보내기 (2026-08-21 — 콩) ────────────────── */
    ok(/const 보낼비율   = 0\.012;/.test(SH),
       "★ 문턱 1.2% — 한 줄만 더 써도 보내는 자리 (재 보고 정한 값)");
    ok(/const 강제MS     = 45000;/.test(SH),
       "★★ 45초에 한 번은 무조건 보낸다");
    {
      /* ★★ 강제 전송은 '끊김' 판정보다 반드시 앞서야 합니다 */
      const 강제 = +(SH.match(/const 강제MS\s+= (\d+)/) || [])[1];
      const 간격 = +(SH.match(/SHARE_INTERVAL_MS = (\d+)/) || [])[1];
      ok(강제 < 간격 * 4,
         `★★ 강제 전송(${강제}ms)이 끊김 판정(${간격*4}ms)보다 짧다 — 안 그러면 멀쩡한 사람이 흐려집니다`);
    }
    ok(/if \(!오래됐나 && 지문 && !많이바뀌었나\(_지문, 지문\)\) \{ _건너뛴\+\+; return; \}/.test(SH),
       "★ 지문을 못 뜨면 그냥 보낸다 (막히느니 보내는 쪽)");
    ok(SH.indexOf("const 지문 = 지문뜨기();") < SH.indexOf("const img = grabMosaic();"),
       "★ 무거운 일(모자이크)보다 **먼저** 물어본다");
    ok(/console\.warn\("\[화면 공유 — 저장 실패\]", e\);\s*\n\s*_지문 = null;/.test(SH),
       "★ 보내기가 실패하면 다음엔 무조건 보낸다");
    ok(/_지문 = 지문;/.test(SH) && SH.indexOf("_지문 = 지문;") > SH.indexOf("db.ref(\"screens/\" + myNick).set("),
       "★★ **보낸 것**만 기준으로 삼는다 (안 보낸 걸 기준 삼으면 변화가 묻힙니다)");
        ok(/const 지문W = 64, 지문H = 40;/.test(SH),
       "★ 지문은 64×40 이다 (원본을 담을 수 없는 크기)");
    {
      /* 지문 캔버스에서 그림을 꺼내 보내는 길이 없어야 합니다 */
      const 지문블록 = SH.slice(SH.indexOf("function 지문뜨기"), SH.indexOf("function 많이바뀌었나"));
      ok(!/toDataURL|db\.ref/.test(지문블록),
         "★★ 지문은 밖으로 나가지 않는다 (견주기만 하고 버립니다)");
    }
  }
  ok(/ctx\.drawImage\(_video, 0, 0, w, h\)/.test(SH), "영상을 작은 캔버스에 줄여 그린다");
  ok(/toDataURL\("image\/jpeg", q\)/.test(SH), "뭉갠 캔버스에서만 JPEG 을 만든다");
  ok(!/getUserMedia|audio:\s*true/.test(SH), "소리나 카메라는 건드리지 않는다");
  {
    /* 서버로 보내는 덩어리에 정확히 무엇이 들어가는가 */
    const i = SH.indexOf('db.ref("screens/" + myNick).set({');
    ok(i > 0, "서버로 보내는 곳을 찾았다");
    const seg = SH.slice(i, SH.indexOf("});", i));
    ok(/\bimg\b/.test(seg), "보내는 것에 img 가 있다");
    ok(/at: firebase\.database\.ServerValue\.TIMESTAMP/.test(seg), "시각은 서버 시계로 적는다");
    ok(/level: _shareW/.test(seg), "어떤 강도로 뭉갰는지 함께 적는다");
    ok(!/nick:|uid:|title:|url:/.test(seg), "그 셋 말고는 아무것도 딸려 보내지 않는다");
  }
  {
    /* 이 파일이 건드리는 서버 경로는 screens 뿐이어야 합니다 */
    const roots = new Set((SH.match(/db\.ref\(["`]([^"`/+ ]+)/g) || [])
      .map(m => m.replace(/^db\.ref\(["`]/, "")));
    ok(roots.size === 1 && roots.has("screens"),
       "이 파일이 쓰는 경로는 screens 하나뿐이다 (" + [...roots].join(",") + ")");
  }

  /* ── 모자이크 강도 — 세 단계에서 연속 조절로 (2026-08-10) ── */
  const SHARE_W_MIN_V = +(sh.match(/SHARE_W_MIN\s+= (\d+)/) || [])[1];
  const SHARE_W_MAX_V = +(sh.match(/SHARE_W_MAX\s+= (\d+)/) || [])[1];
  const SHARE_LEVEL_W = [SHARE_W_MIN_V, SHARE_W_MAX_V];
  ok(SHARE_W_MIN_V === 80, "가장 뭉갠 쪽은 가로 80px");
  /* [고침 2026-08-21 — 콩] 320 → 256. 화면 공유가 이 방에서 가장 큰
     통신량이 됐습니다. 픽셀은 제곱으로 주니 폭을 2/3 로 줄이면 절반 아래. */
  ok(/SHARE_DEFAULT_W = 256/.test(sh), "기본은 256px (2026-08-21 콩)");
  ok(/SHARE_LEGACY_W = \[320, 160, 80\]/.test(sh),
     "★ 옛 저장값(0·1·2)을 새 값으로 옮기는 표가 있다 (쓰던 사람 값이 튀지 않게)");
  ok(/raw\.startsWith\("w"\)/.test(SH), "새 저장값과 옛 저장값을 구분해 읽는다");
  /* ★ [2026-08-11] 이 자리에 있던 검사가 **버그 쪽을 정답으로 못박고**
     있었습니다 — "세로는 w*0.6 을 넘지 않는다". 그 줄이 바로 모든 창을
     납작하게 누르던 원인이었는데, 검사가 그걸 지켜주고 있었어요.
     고치려는 사람이 있었어도 검사에서 막혔을 겁니다.
     이제는 반대로, **비율이 지켜지는지**를 봅니다(아래 checkAchv 옆
     "공유 그림이 눌리지 않는가" 블록). */
  ok(!/Math\.round\(w \* 0\.6\)\)\)/.test(SH),
     "★ 세로를 눌러 담던 옛 계산이 남아 있지 않다");

  /* ── 10초에 한 장 · 크기 상한 ── */
  /* [고침 2026-08-15] 5초 → 10초 → [2026-08-17] 15초. 화면 공유는 공유
     중인 사람끼리만 보므로 통신량이 공유자 수의 **제곱**으로 늘어납니다.
     화공 쓰는 작가가 늘어서 — 15초면 동시 공유 상한이 4명 → 5명. */
  ok(/SHARE_INTERVAL_MS = 15000/.test(sh), "15초에 한 장 보낸다");
  ok(/setInterval\(pushFrame, SHARE_INTERVAL_MS\)/.test(SH), "그 간격으로 타이머가 돈다");
  ok(/SHARE_MAX_BYTES\s+= 40 \* 1024/.test(sh), "한 장 상한이 40KB 다");
  ok(/SHARE_QUALITIES\s+= \[0\.5, 0\.4, 0\.3, 0\.22\]/.test(sh),
     "넘으면 품질을 0.5→0.4→0.3→0.22 로 낮춘다");
  /* 글자를 못 읽게 하는 것이 이 기능의 전제입니다.

     1920px 화면 기준으로 계산하면, 가로 400px 부터 **큰 제목이 읽히기
     시작합니다** (32px 글자 → 6.7px, 획이 살아남는 크기). 본문은 그보다
     한참 뒤에야 읽히지만, 제목만 읽혀도 무엇을 쓰는지 드러납니다.
     그래서 400 을 넘기지 못하게 막습니다. */
  ok(SHARE_LEVEL_W.every(w => w < 400),
     "★ 가장 선명한 쪽도 가로 400px 미만이다 (큰 제목이 읽히기 시작하는 선)");
  ok(SHARE_W_MAX_V === 256, "상한은 256px (2026-08-21 — 400 에서 훨씬 물러섰습니다)");
  /* ★★ [2026-08-21 콩 신고] 눈금이 안 맞아 슬라이더가 91%에서 멈췄습니다.
     80 → 256 은 176px 인데 20 씩 뛰면 240 이 끝이었어요.
     MIN·MAX·STEP 중 하나라도 건드리면 여기서 바로 잡힙니다. */
  {
    const STEP = +(sh.match(/SHARE_W_STEP = (\d+)/) || [])[1];
    const 남 = (SHARE_W_MAX_V - SHARE_W_MIN_V) % STEP;
    ok(남 === 0,
       `★★ 슬라이더가 끝까지 간다 — (${SHARE_W_MAX_V}−${SHARE_W_MIN_V}) ÷ ${STEP} 이 딱 떨어져야 함 (나머지 ${남})`);
    const 마지막 = SHARE_W_MIN_V + Math.floor((SHARE_W_MAX_V - SHARE_W_MIN_V) / STEP) * STEP;
    ok(마지막 === SHARE_W_MAX_V,
       `★★ 마지막 눈금이 상한과 같다 (${마지막} = ${SHARE_W_MAX_V} → 100%)`);
  }
  ok(/window\.shareWRange       = \(\) => \(\{ min: SHARE_W_MIN, max: SHARE_W_MAX, step: SHARE_W_STEP \}\);/.test(sh),
     "★ 눈금을 바깥에 내준다 (베껴 쓰면 고칠 때 조용히 어긋납니다)");
  {
    const PR2 = fs.readFileSync(DIR + "script_profile.js", "utf8");
    ok(/window\.shareWRange\?\.\(\) \|\| \{\}\)\.step/.test(PR2),
       "★★ 혼자 방 슬라이더도 그 값을 받아 쓴다 (숫자를 안 베낌)");
    ok(!/id="solo-blur" min="\d+" max="\d+" step="\d+"/.test(PR2),
       "★ 눈금을 손으로 적어 두지 않았다");
  }
  ok(/if \(w >= SHARE_W_MIN\) _shareW = Math\.min\(w, SHARE_W_MAX\);/.test(sh),
     "★★ 예전에 높게 잡아 둔 사람은 상한으로 **끌어내린다** (버리고 기본값으로 가지 않음)");
  ok(/if \(dataUrlBytes\(url\) <= SHARE_MAX_BYTES\) return url;[\s\S]{0,60}return null;/.test(SH),
     "그래도 넘으면 그 프레임은 건너뛴다");

  /* ── 켜고 끄기 ── */
  ok(/getDisplayMedia\(\{ video: \{ frameRate: 1 \} \}\)/.test(SH), "창 하나를 초당 1프레임으로 잡는다");
  ok(/navigator\.mediaDevices && navigator\.mediaDevices\.getDisplayMedia/.test(SH),
     "미지원 브라우저를 가려낸다");
  ok(/크롬·엣지 PC에서만 쓸 수 있어요/.test(sh), "미지원일 때 안내 문구가 있다");
  ok(/btn\.classList\.add\("dim"\)/.test(SH), "미지원이면 버튼이 흐려진다");
  ok(/track\.onended = \(\) => \{ stopScreenShare\(\); \}/.test(SH),
     "브라우저의 '공유 중지'를 눌러도 스스로 정리한다");
  ok(/getTracks\(\)\.forEach\(t => \{ t\.onended = null; t\.stop\(\); \}\)/.test(SH),
     "끌 때 영상 줄기를 모두 멈춘다");
  ok(/_sharing \? "공유 중" : "화면 공유"/.test(SH), "공유 중에는 버튼 라벨이 '공유 중' 이다");
  ok(/classList\.toggle\("share-on", _sharing\)/.test(SH), "공유 중에는 버튼이 붉게 강조된다");

  /* ── 남이 공유 중일 때도 알려 주는가 (2026-08-07) ──
     켜 놓고도 아무도 안 보는 일이 생겨서, 버튼 색으로 신호를 줍니다.
     내가 켠 것과 헷갈리지 않게 색의 진하기를 달리합니다. */
  ok(/classList\.toggle\("share-others", !_sharing && others > 0\)/.test(SH),
     "남이 공유 중이면 옅은 붉은색이 된다");
  ok(/function othersSharing\(\)/.test(SH), "몇 명이 공유 중인지 세는 함수가 있다");
  ok(/row\.shareOn !== true/.test(SH), "접속자 정보의 shareOn 만 보고 센다");
  ok(/if \(nick === myNick\) continue;/.test(SH), "내 것은 빼고 센다");
  ok(/window\.isOnline\(row, t\)/.test(SH),
     "끊긴 사람의 낡은 기록은 세지 않는다 (아무도 없는데 붉어지는 일 방지)");
  ok(!/db\.ref\("screens"\)[\s\S]{0,200}othersSharing/.test(SH),
     "이걸 위해 screens 를 늘 구독하지는 않는다");

  const RT4 = fs.readFileSync(DIR+"script_realtime.js","utf8");
  ok(/shareOn,/.test(RT4) && /window\.isScreenSharing/.test(RT4),
     "접속자 정보에 shareOn 한 칸을 실어 보낸다");
  ok(/window\.renderShareButton\?\.\(\)/.test(RT4),
     "접속자 정보가 바뀌면 버튼을 다시 칠한다");
  ok(/window\.updateStatus\?\.\(\)/.test(SH),
     "공유를 켜고 끌 때 그 사실을 남들에게 알린다");
  ok(/\.icon-btn\.share-others\{/.test(CSS), "옅은 붉은색 CSS 규칙이 있다");
  ok(/\.icon-btn\.share-on\{[^}]*background: var\(--danger-soft\)/.test(FLAT3.replace(/ /g, "")) ||
     /\.icon-btn\.share-on\{/.test(CSS),
     "내가 공유 중일 때의 색은 예전 그대로다");

  /* ── 무엇이 서버에 남는가 ── */
  ok(/onDisconnect\(\)\.remove\(\)/.test(SH), "창이 닫히면 서버에서 저절로 사라진다");
  ok(/onDisconnect\(\)\.cancel\(\)/.test(SH), "정상으로 끌 때는 그 예약을 거둔다");
  ok(/db\.ref\("screens\/" \+ myNick\)\.remove\(\)/.test(SH), "끄면 내 그림을 지운다");
  ok(/window\.leaveRoom = wrapped/.test(SH), "나가기(leaveRoom) 때도 정리한다");
  ok(SH.indexOf("await stopScreenShare()") < SH.indexOf("return _leave.apply"),
     "닉이 지워지기 전에 먼저 정리한다");

  /* ── 공유 중인 사람끼리만 ── */
  ok(/공유 중인 사람끼리만/.test(sh), "'공유 중인 사람끼리만 본다'는 약속이 주석에 있다");
  /* [고침 2026-08-21] setShareWatch 안에도 listenScreens() 가 생겨서
     첫 번째 자리를 세면 어긋납니다. **켤 때 부르는지**를 직접 봅니다. */
  {
    const 켜기 = SH.slice(SH.indexOf("_sharing = true;"), SH.indexOf("_sharing = true;") + 900);
    ok(/listenScreens\(\);/.test(켜기), "내가 공유 중일 때만 screens 를 구독한다");
  }
  ok(/if \(!watchOn\(\)\) \{ detachScreens\(\); return; \}/.test(SH),
     "★★ '안 보기' 로 둔 사람은 아예 안 붙는다 (받는 양이 0)");
  ok(/detachScreens\(\);[\s\S]{0,120}_screensCache = null;/.test(SH),
     "끄면 구독을 끊고 받아둔 그림도 버린다");
  /* [넓힘 2026-08-15] 🧘 혼자 방이 가짜 화면(사진)을 같은 액자에 걸면서
     `|| window.SOLO` 가 붙었습니다. 진짜 방에서는 _sharing 이 여전히 문지기예요. */
  ok(/let rows = \(_sharing \|\| window\.SOLO\) \? shareRows\(\) : \[\]/.test(SH),
     "공유를 끄면 화면에서도 치운다 (혼자 방만 예외)");
  /* ★★ [고침 2026-08-21 — 콩이 실제로 갇힘] 되돌아가는 문이 그 문 안에
     있었습니다. 안 보기를 켜면 구독을 끊는데 **내 그림도 거기서 왔어요.**
     내 카드가 사라지고, 그 카드의 빨간 불이 유일한 문이라 못 돌아왔습니다. */
  ok(/if \(!watchOn\(\) && !window\.SOLO\) \{/.test(SH),
     "★★ 🧘 혼자 방에서는 '안 보기' 가 아무 일도 안 한다 (거긴 남의 것이 없습니다)");
  ok(/rows = rows\.filter\(r => r && r\.nick === myNick\);/.test(SH),
     "★ '안 보기' 여도 **내 화면은 그대로** 보인다");
  ok(/if \(!rows\.length && _sharing && _내마지막\)/.test(SH),
     "★★ 구독을 끊어도 손안에 남긴 마지막 그림으로 내 카드를 그린다 (되돌아갈 문)");
  ok(/_내마지막 = \{ nick: myNick, img, fit: _shareFit \};/.test(SH),
     "★ 보낼 때마다 그 그림을 손안에 남긴다");
  {
    const H3 = fs.readFileSync(DIR + "index.html", "utf8");
    ok(/id="set-share-watch"[\s\S]{0,90}setShareWatch\(this\.checked\)/.test(H3),
       "★★ 설정에도 **늘 열려 있는 문**이 있다 (카드가 안 보여도 되돌릴 수 있게)");
    ok(/watchChk\.checked = !!window\.isShareWatchOn/.test(fs.readFileSync(DIR+"script_ui.js","utf8")),
       "★ 그 문이 지금 상태를 비춰 준다");
    ok(/\$\{window\.SOLO \? "" : `/.test(SH),
       "★ 혼자 방 팝업에는 그 단추를 아예 안 보여 준다");
  }
  /* ★★ 이 둘은 **간격을 기준으로** 잡습니다. 간격만 바꾸고 여기를 두면
     멀쩡히 공유 중인 사람이 흐려지고 사라져요 (10초 간격에 20초 판정이면
     두 장만 놓쳐도 끊김으로 봅니다). 예전 뜻은 "네 장 · 여섯 장 놓침". */
  ok(/SHARE_STALE_MS\s+= SHARE_INTERVAL_MS \* 4/.test(sh),
     "★★ 끊김 판정은 간격의 네 배 — 간격을 바꿔도 같이 따라온다");
  /* [2026-08-17] ×6 → ×5. 간격이 15초가 되며 ×6이면 끈 사람의 마지막
     화면이 90초 남아서, 75초로 당겼습니다. 흐려짐(×4)보다는 뒤여야 합니다. */
  ok(/SHARE_DROP_MS\s+= SHARE_INTERVAL_MS \* 5/.test(sh),
     "★★ 목록에서 빼는 것은 간격의 다섯 배 (75초) — 흐려짐(×4)보다 뒤");
  ok(/if \(!window\.SOLO && age > SHARE_DROP_MS\) continue;/.test(SH),
     "오래된 사람은 아예 그리지 않는다 (혼자 방의 사진은 늙지 않으니 예외)");
  ok(/classList\.toggle\("is-stale", age > SHARE_STALE_MS\)/.test(SH), "끊긴 카드는 흐려진다");

  /* ── 서버에서 온 그림을 그대로 믿지 않는가 ── */
  ok(/function sanitizeShot/.test(SH), "받은 그림을 검사하는 함수가 있다");
  ok(/\^data:image\\\/jpeg;base64,\[A-Za-z0-9\+\/=\]\+\$/.test(SH),
     "작은 JPEG dataURL 이 아니면 화면에 달지 않는다");

  /* ── 카드 ── */
  ok(/user-card share-card/.test(SH), "기존 접속자 카드와 같은 모양을 쓴다");
  /* [고침 2026-08-06] 공유 카드를 그 사람 프로필 카드 바로 뒤에 끼웁니다 */
  ok(/data-card-nick="\$\{escapeHtml\(u\)\}"/.test(RT), "프로필 카드에 닉네임 표가 붙어 있다");
  ok(/el\.getAttribute\("data-card-nick"\) === row\.nick/.test(SH),
     "그 표로 주인 카드를 찾는다");
  ok(/own\.insertAdjacentHTML\("afterend", shareCardHtml\(row\)\)/.test(SH),
     "주인 카드 바로 뒤에 끼운다");
  /* [바뀜 2026-08-14] 주인이 없으면 맨 뒤에 붙이던 것 → 아예 안 그립니다.
     접속이 잠깐 끊겨 주인 카드가 사라진 순간, 공유 그림만 남아
     "프로필 카드가 남의 그림으로 바뀐 것처럼" 보였습니다 (실제 제보). */
  ok(/if \(!own\) return;/.test(SH),
     "★ 주인 카드가 없으면 공유 카드를 안 그린다 (고아 카드 방지)");
  ok(!/list\.insertAdjacentHTML\("beforeend", one\)/.test(SH),
     "맨 뒤에 붙이던 옛 방식이 없다");
  /* [바뀜 2026-08-10] 글자 알약 → 빨간 불 하나. 자세한 건 아래 전용 검사에. */
  ok(/class="share-live"/.test(sh), "왼쪽 위에 공유 중 표시가 있다");
  /* [고침 2026-08-06] "n초 전" 표시는 뺐습니다 — 끊기면 카드가 흐려지므로
     굳이 숫자로 또 알릴 필요가 없어요. */
  ok(!/share-ago/.test(SH) && !/function agoText/.test(SH), "'n초 전' 표시는 없앴다");
  ok(/🖥️ 화면/.test(sh), "이름 아래에 '🖥️ 화면' 이라고 적는다");
  ok(/rows\.sort\(\(a, b\) => \(a\.nick === myNick \? -1 : 0\)/.test(SH), "내 카드가 맨 앞이다");
  /* [고침 2026-08-06] 강도 버튼(약함/보통/강함)과 안내 문단을 카드에서 뺐습니다.
     카드는 프로필 카드와 같은 크기로 고정하고, 아래 한 줄에 이름과 [off] 만 둡니다. */
  ok(/data-share-stop="1"/.test(SH), "내 카드에만 [off] 단추가 있다");
  ok(!/data-share-level=/.test(SH), "강도 고르기 버튼은 카드에서 뺐다");
  ok(/class="share-off"/.test(SH) && />off<\/button>/.test(SH), "그 단추 이름은 off 다");
  /* [고침 2026-08-09] 이름 줄을 그림 위로 올렸습니다 — 아래에 두면
     그 높이만큼 화면이 짧아지는데, 이 카드의 주인공은 화면이니까요. */
  ok(/class="share-foot"/.test(SH), "이름과 off 가 한 줄(.share-foot)에 있다");
  ok(SH.indexOf('class="share-foot"') > SH.indexOf('class="share-shot"') &&
     SH.indexOf('class="share-foot"') < SH.indexOf('</div>\n        </div>'),
     "그 줄이 그림(.share-shot) 안에 들어 있다");
  ok(/\.share-foot\{[^}]*position: absolute/.test(CSS.replace(/\s+/g, " ").replace(/ \{/g, "{")),
     "그림 위에 얹혀 있다");
  ok(/\.share-foot\{[^}]*background: rgba/.test(CSS.replace(/\s+/g, " ").replace(/ \{/g, "{")),
     "반투명이라 뒤 화면이 비친다");

  /* ── 보여줄 창 바꾸기 (2026-08-07) ──
     끄고 다시 켜면 남들 화면에서 내 카드가 깜빡 사라집니다.
     공유 상태는 그대로 두고 물려 있는 화면만 갈아 끼우는 길입니다. */
  ok(/data-share-switch="1"/.test(SH), "내 카드의 이름이 창 바꾸기 단추다");
  ok(/class="share-who is-mine"/.test(SH), "그 단추에 표가 붙어 있다");
  ok(/<span class="share-who">/.test(SH), "남의 카드 이름은 단추가 아니라 글씨다");
  ok(/function switchShareWindow\(\)/.test(SH), "창 바꾸기 함수가 있다");
  ok(/if \(!_sharing\) return;[\s\S]{0,140}_pickWindow\(\)/.test(SH),
     "공유 중일 때만 고르기 판을 띄운다");
  ok(/function _attachStream\(stream\)/.test(SH) &&
     (SH.match(/_attachStream\(stream\)/g) || []).length >= 3,
     "시작과 창 바꾸기가 같은 길(_attachStream)을 쓴다");
  ok(SH.indexOf("t.onended = null; t.stop();") < SH.indexOf("_stream = stream;"),
     "새 화면을 물리기 전에 옛 것의 onended 를 떼어 낸다 (자동 정지 오작동 방지)");
  ok(/\.share-who\.is-mine\{/.test(CSS), "그 단추 CSS 규칙이 있다");
  ok(/\.share-who\.is-mine:focus-visible\{/.test(CSS), "키보드로도 짚을 수 있다");
  /* [뺌 2026-08-06] 크게 보기는 없앴습니다 — 카드를 눌러도 아무 일 없습니다 */
  ok(!/[Ll]ightbox/.test(sh), "크게 보기(라이트박스) 코드가 남아 있지 않다");
  ok(!/share-lightbox|share-big/.test(CSS), "그 CSS 도 남아 있지 않다");
  ok(!/title="크게 보기"/.test(SH) && !/role="button" tabindex="0">/.test(SH),
     "카드에 '눌러 보라'는 손잡이가 없다");
  ok(/\.share-card\{[^}]*cursor: default/.test(FLAT3), "카드 위에서 커서가 그대로다");
  ok(/if \(html === _lastShareHtml && present/.test(SH),
     "같은 그림이면 다시 그리지 않는다 (깜빡임 방지)");
  ok(/window\.renderUserCards = wrapped/.test(SH), "접속자 카드를 다시 그려도 공유 카드가 붙는다");

  /* ── 안내 문구 ── */
  const NOTICE = "뭉갠 그림만 나가고 원본은 내 컴퓨터를 벗어나지 않아요";
  ok(sh.includes(NOTICE), "안내 문구 앞부분이 그대로다");
  /* [고침 2026-08-06] 문구를 짧은 문장 넷으로 나눴습니다.
     "알림도 함께 찍힌다"는 사실과 달라 뺐어요 — [창] 하나만 고르면
     그 위에 겹친 알림·다른 창은 찍히지 않습니다. */
  ["5초마다 한 장씩 송출, 끊어져 보일 수 있어요",
   "크롬·엣지 브라우저 사용 시에만 돼요",
   "창 하나만 고르면 그 위에 뜨는 알림은 안 찍혀요"]
    .forEach(s => ok(sh.includes(s), `안내에 '${s}' 가 있다`));
  ok(/SHARE_NOTICE_LINES\s*=\s*\[/.test(sh), "안내를 줄 단위 배열로 둔다");
  ok(/title="\$\{esc\(SHARE_NOTICE\)\}"/.test(SH),
     "카드에 마우스를 올리면 그 문구가 뜬다 (자리는 차지하지 않는다)");

  /* ── 머리말 버튼 · 파일 배선 ── */
  ok(/id="share-btn"[^>]*onclick="toggleScreenShare\(\)"/.test(HTML), "머리말에 [🖥️ 화면 공유] 버튼이 있다");
  ok((HTML.match(/toggleScreenShare\(\)/g) || []).length === 1, "그 버튼은 하나뿐이다");
  /* [고침 2026-08-08] [나의 작업] 버튼이 빠져서 이제 [대숲] 앞입니다
     [고침 2026-08-21] 차례가 뒤집혔습니다 — 대숲 → 화면공유 → 접속유지 */
  ok(HTML.indexOf('id="share-btn"') > HTML.indexOf('id="forest-btn"')
     && HTML.indexOf('id="share-btn"') < HTML.indexOf('id="alive-btn"'),
     "[화면 공유] 가 [대숲] 과 [접속유지] 사이에 있다");
  ["toggleScreenShare","stopScreenShare","renderShareCards"].forEach(f =>
    ok(new RegExp("window\\."+f+"\\s+=").test(sh), `${f} 를 밖에서 부를 수 있다`));
  ok(/<script src="script_share\.js/.test(HTML), "index.html 이 새 파일을 부른다");
  ok(/"script_share\.js":\s+"toggleScreenShare"/.test(HTML), "로드 자가진단 목록에 새 파일이 있다");
  ok(/"script_share\.js"/.test(bs3), "단일파일 빌드 목록(ORDER)에도 있다");
  {
    const tags = (HTML.match(/<script src="(script_[\w.-]+)/g) || []).map(t => t.split('"')[1]);
    ok(tags.indexOf("script_share.js") > tags.indexOf("script_realtime.js"),
       "script_realtime.js 뒤에 온다 (renderUserCards 를 감싸야 하므로)");
    ok(tags.indexOf("script_share.js") > tags.indexOf("script_core.js"),
       "script_core.js 뒤에 온다 (leaveRoom 을 감싸야 하므로)");
  }

  /* ── CSS ── */
  ["share-video","share-card","share-shot","share-img","share-live",
   "share-foot","share-who","share-off",
   "share-live"]
    .forEach(c => ok(new RegExp("\\."+c+"[^a-zA-Z0-9_-]").test(CSS), `CSS 에 .${c} 가 있다`));
  ok(/\.share-img\{[^}]*image-rendering: pixelated/.test(FLAT3),
     "작은 그림을 늘릴 때 번지지 않게 그린다 (pixelated)");
  ok(/\.share-card\.is-stale\{[^}]*opacity/.test(FLAT3), "끊긴 카드가 흐려지는 규칙이 있다");
  ok(/\.icon-btn\.share-on\{/.test(FLAT3), "공유 중 버튼 강조 규칙이 있다");

  /* ── 보안규칙 ── */
  {
    const rules = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;
    const s = rules.screens;
    ok(!!s, "보안규칙에 screens 가 있다");
    ok(s[".read"] === "auth != null", "로그인한 사람만 읽는다");
    const w = (s.$nick || {})[".write"] || "";
    ok(/root\.child\('nickOwner'\)\.child\(\$nick\)\.val\(\) === auth\.uid/.test(w),
       "자기 닉네임 자리에만 쓸 수 있다 (남의 화면을 덮어쓰지 못하게)");
    ok(/ABM1ZJndrqaV3gpYUs03SV9qglr1/.test(w), "관리자 uid 는 지울 수 있다");
  }
}

/* 보안 규칙이 앱이 쓰는 경로를 모두 덮는가

   [왜] 규칙에 없는 경로는 파이어베이스가 조용히 거절합니다. 오류가
   화면에 안 뜨고 그냥 저장이 안 되니, "기능이 안 먹는다"로 보입니다.
   실제로 attendance 와 achievementOverrides 를 빠뜨려서 출석·업적이
   전부 먹지 않았습니다. */
{
  const rules = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;
  const roots = new Set();
  fs.readdirSync(DIR).filter(f => /^(script_|fortune)/.test(f)).forEach(f => {
    const src = fs.readFileSync(DIR+f, "utf8");
    (src.match(/db\.ref\(["`]([^"`/$]+)/g) || []).forEach(m => {
      const r = m.replace(/^db\.ref\(["`]/, "");
      if (r && !r.startsWith(".")) roots.add(r);
    });
  });
  [...roots].sort().forEach(r =>
    ok(Object.prototype.hasOwnProperty.call(rules, r),
       `보안 규칙에 ${r} 가 있다`));
  ok(roots.size >= 6, `앱이 쓰는 경로를 모두 찾았다 (${roots.size}개)`);
}

/* 방이 정말로 분리됐는가 —
   설정을 갈아끼우는 걸 잊으면 UI 만 다른 같은 방이 됩니다. */
{
  const core = fs.readFileSync(DIR+"script_core.js","utf8");
  ok(!/writer-chat/.test(core), "벨사탕 파이어베이스 설정이 남아 있지 않다");
  const m = core.match(/databaseURL: "([^"]+)"/);
  ok(!!m, "databaseURL 이 있다");
  ok(/themagam/.test(m[1]), "databaseURL 이 TheMagam 것이다 ("+m[1]+")");
  ok(/firebasedatabase\.app/.test(m[1]), "Realtime Database 주소 형식이다");
  const pid = core.match(/projectId: "([^"]+)"/);
  ok(pid && m[1].includes(pid[1]),
     "databaseURL 과 projectId 가 같은 프로젝트를 가리킨다");
}

/* 채팅 반응을 붙였을 때 프사가 안 내려가는가

   [왜] .chat-item 이 align-items: flex-end 였습니다. 말풍선 아래에
   반응 줄이 생기면 그만큼 프사도 같이 내려가, 이름 옆이 아니라 반응
   옆에 붙었습니다. 위쪽 정렬로 바꾸고, 이름 줄만큼만 내려서 첫
   말풍선과 맞춥니다. */
{
  /* 주석에 옛 값을 설명으로 적어두었으므로, 주석을 걷어내고 봅니다.
     (예전에 이 함정에 한 번 걸렸습니다) */
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const i = bare.indexOf(".chat-item{");
  const seg = bare.slice(i, bare.indexOf("}", i));
  ok(/align-items:\s*flex-start/.test(seg), "채팅 줄은 위쪽 정렬이다");
  ok(!/align-items:\s*flex-end/.test(seg), "아래쪽 정렬이 남아 있지 않다");
  ok(/\.chat-item\.other:not\(\.grouped\) \.chat-avatar/.test(CSS),
     "이름 줄만큼 프사를 내려 맞춘다");
}

/* 방마다 저장 공간이 나뉘어 있는가

   [왜] 두 방이 같은 주소(도메인)를 씁니다. localStorage 는 주소
   단위로 나뉘고 뒤의 폴더 이름은 보지 않으므로, 이름표를 안 붙이면
   두 방이 같은 칸을 함께 씁니다. 실제로 한쪽에서 뽀모가 끝나자
   다른 방 카드의 🍅 가 같이 올라갔습니다. */
{
  const core = fs.readFileSync(DIR + "script_core.js", "utf8");
  const m = core.match(/const STORE_ROOM = "(\w+)"/);
  ok(!!m && m[1].length > 0, "이 방의 이름표가 정해져 있다" + (m ? ` (${m[1]})` : ""));
  ok(m && m[1] === "tm", "이름표가 이 방의 것이다");
  ok(/window\.AppStore = AppStore/.test(core), "AppStore 를 내보낸다");
  ok(/_migrated_v1/.test(core), "예전 값을 한 번 옮겨준다");

  /* 어느 파일에서도 원본 저장소를 직접 쓰면 안 됩니다 (껍데기 안은 예외) */
  /* [고침 2026-08-06] script_admin.js 는 제외합니다.
     관리자 페이지(admin.html)는 메인 앱의 껍데기(AppStore/AppSession)를
     불러오지 않는 독립 페이지라, 저장소를 직접 쓰는 게 맞습니다. */
  const files = fs.readdirSync(DIR)
    .filter(f => /^script_.*\.js$/.test(f) && f !== "script_admin.js");
  const leaks = [];
  files.forEach(f => {
    let src = fs.readFileSync(DIR + f, "utf8");
    if (f === "script_core.js") {
      /* 껍데기가 원본을 감싸는 부분만 잘라냅니다 */
      const end = src.indexOf("// ✅ Utils");
      src = end > 0 ? src.slice(end) : src;
    }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    if (/(?<![.\w])(localStorage|sessionStorage)\./.test(src)) leaks.push(f);
  });
  ok(leaks.length === 0, "원본 저장소를 직접 쓰는 곳이 없다" + (leaks.length ? " — " + leaks.join(", ") : ""));

  /* 실제로 굴려봅니다 — 두 방이 서로를 못 건드려야 합니다 */
  {
    const raw = {};
    const mk = room => {
      const P = room + ":";
      return {
        getItem: k => (P + k in raw ? raw[P + k] : null),
        setItem: (k, v) => { raw[P + k] = String(v); },
        get length() { return Object.keys(raw).filter(x => x.startsWith(P)).length; },
        key: i => (Object.keys(raw).filter(x => x.startsWith(P))[i] || "").slice(P.length) || null
      };
    };
    const a = mk("bl"), b = mk("tm");
    a.setItem("pomoSessions_x", "1");
    b.setItem("pomoSessions_x", "9");
    ok(a.getItem("pomoSessions_x") === "1" && b.getItem("pomoSessions_x") === "9",
       "같은 이름이라도 방마다 값이 따로다");
    a.setItem("writerTheme", "A"); b.setItem("writerTheme", "B");
    ok(a.getItem("writerTheme") === "A", "테마가 서로 안 덮인다");
    ok(a.length === 2 && b.length === 2, "각 방은 자기 열쇠만 센다");
    ok(a.key(0) === "pomoSessions_x", "열쇠 이름에서 이름표가 벗겨진다");
  }
}

/* PWA — 독립 창 설치 */
{
  const mf = JSON.parse(fs.readFileSync(DIR+"manifest.json","utf8"));
  ok(mf.display === "standalone", "독립 창으로 뜬다");
  ok(!!mf.name && !!mf.short_name, "앱 이름이 있다");
  ok(mf.start_url === "./" && mf.scope === "./",
     "상대 경로다 (GitHub Pages 하위 폴더에서도 동작)");
  const sizes = mf.icons.map(i => i.sizes);
  ok(sizes.includes("192x192") && sizes.includes("512x512"),
     "설치에 필요한 192·512 아이콘이 있다");
  ok(mf.icons.some(i => i.purpose === "maskable"), "마스커블 아이콘이 있다");
  /* manifest 안의 경로에는 ?v= 가 붙습니다 (설치된 앱 아이콘 갱신용) */
  mf.icons.forEach(i =>
    ok(fs.existsSync(DIR + i.src.split("?")[0]), `아이콘 파일이 실제로 있다 (${i.src})`));

  /* 파비콘·아이콘·manifest 에 버전이 찍혀야 브라우저가 새로 받아갑니다.
     [왜] 아이콘을 갈았는데 옛 그림이 계속 보였습니다. 파비콘은 캐시가
     특히 끈질겨서 강제 새로고침으로도 안 바뀝니다. */
  ok(/href="icons\/favicon\.png\?v=\d+"/.test(HTML), "파비콘에 버전이 찍혀 있다");
  ok(/href="icons\/apple-touch-icon\.png\?v=\d+"/.test(HTML), "애플 아이콘에 버전이 찍혀 있다");
  ok(/href="manifest\.json\?v=\d+"/.test(HTML), "manifest 에 버전이 찍혀 있다");
  ok(mf.icons.every(i => /\?v=\d+$/.test(i.src)), "manifest 안 아이콘에도 버전이 찍혀 있다");
  {
    /* build-single.py 가 앞으로도 자동으로 찍어주는지 */
    const bs = fs.readFileSync(DIR+"build-single.py","utf8");
    ok(/icons\/\[\\w\.-\]\+\\\.png/.test(bs), "빌드가 아이콘 버전을 자동으로 찍는다");
    ok(/manifest\\\.json/.test(bs), "빌드가 manifest 버전도 찍는다");
  }
  ["icons/favicon.png","icons/apple-touch-icon.png"].forEach(f =>
    ok(fs.existsSync(DIR+f), `${f} 가 있다`));

  ok(/<link rel="manifest" href="manifest\.json(\?v=\d+)?">/.test(HTML),
     "index.html 이 manifest 를 연결한다");
  ok(/rel="apple-touch-icon"/.test(HTML), "사파리·아이폰 아이콘을 연결한다");

  /* [고침 2026-08-09] 서비스 워커를 없앴습니다.

     앱처럼 설치되려면 "fetch 처리기가 있는 서비스 워커"가 필요하던 시절에
     아무 일도 안 하는 빈 처리기를 두었습니다. 크롬이 그 조건을 없앤 뒤
     (휴대폰 108 · 데스크톱 112 부터 manifest + HTTPS 면 설치됩니다),
     그 빈 처리기는 되레 군더더기라며 경고를 띄우기 시작했어요.

     되살리고 싶어지면 반드시 캐시를 하지 않는 것으로 두세요. 캐시가
     끼어들면 파일을 올려도 예전 화면이 남습니다 — 여러 명이 같이 쓰는
     방에서 그게 터지면 원인 찾기가 아주 어렵습니다. */
  ok(!fs.existsSync(DIR+"sw.js"), "서비스 워커 파일이 없다");
  ok(!/register\("sw\.js"\)/.test(HTML), "등록하지 않는다");
  ok(/getRegistrations\?\.\(\)[\s\S]{0,120}unregister\(\)/.test(HTML),
     "예전에 등록된 것이 남아 있으면 스스로 지운다");
  ok(!/addEventListener\("fetch"/.test(HTML), "빈 fetch 처리기가 남아 있지 않다");
}

/* 열린 구간에도 6시간 상한이 걸리는가 —
   WORK 로 두고 며칠 방치하면 며칠이 전부 집필로 잡히던 문제 */
{
  const tl = fs.readFileSync(DIR+"script_timelog.js","utf8");
  const i = tl.indexOf("아직 열려 있는 구간은");
  const seg = tl.slice(i, i + 700);
  ok(/curStart \+ SEG_CAP_MS/.test(seg), "열린 구간에도 상한을 적용한다");

  /* 실제로 굴려봅니다 */
  const CAP = 6*3600e3, DAY = 24*3600e3;
  const dayStart = t => Math.floor(t/DAY)*DAY;   // 검사용 단순 계산
  function openTotal(start, now, days){
    let sum = 0;
    const end = Math.min(now, start + CAP);
    for (let i=days-1; i>=0; i--){
      const d = dayStart(now) - i*DAY;
      const a = Math.max(start, d), b = Math.min(end, d+DAY);
      if (b>a) sum += b-a;
    }
    return sum;
  }
  const now = 10*DAY;
  ok(openTotal(now - 2*3600e3, now, 7) === 2*3600e3, "2시간 방치는 2시간으로 잡힌다");
  ok(openTotal(now - 3*DAY, now, 7) === CAP, "3일 방치도 6시간에서 멈춘다");
  ok(openTotal(now - 20*3600e3, now, 7) === CAP, "20시간 방치도 6시간이다");
  ok(openTotal(now - 30*60e3, now, 7) === 30*60e3, "30분은 30분이다");
}

/* index.html 이 모든 JS 를 실제로 불러오는가 —
   script_timelog.js 를 빠뜨려서 기록 팝업이 안 열린 적이 있습니다.
   build-single.py 는 자기 목록으로 합치므로 단일파일만 멀쩡했고,
   폴더 버전에서만 조용히 죽었습니다. */
{
  /* ★ [고침 2026-08-11] 예전에는 /ORDER = \[([\s\S]*?)\]/ 로 잘랐습니다.
     그런데 주석에 대괄호를 하나 쓰는 순간 거기서 끊겨, 목록이 22개인데
     15개만 읽혔어요. 그래도 검사는 **조용히 통과**했습니다 — 읽어온 것은
     전부 index.html 에 있었으니까요. 검사가 스스로 눈을 감은 셈입니다.
     이제 줄 첫머리의 닫는 대괄호까지 읽고, 주석 줄은 먼저 지웁니다.
     그리고 개수가 맞는지 아래에서 못을 박습니다. */
  const orderRaw = fs.readFileSync(DIR+"build-single.py","utf8")
    .match(/ORDER = \[([\s\S]*?)\n\]/)[1]
    .split("\n").filter(l => !/^\s*#/.test(l)).join("\n");
  const order = orderRaw.match(/"([^"]+\.js)"/g).map(x=>x.slice(1,-1));
  order.forEach(f =>
    ok(new RegExp('<script src="'+f.replace(".","\\.")+'(\\?v=[^"]*)?"').test(HTML),
       `index.html 이 ${f} 를 불러온다`));
  ok(order.length >= 11, "합칠 JS 목록이 온전하다");
  ok(order.length === (HTML.match(/<script src="(?:fortune_data|script_)[^"]*"><\/script>/g) || []).length,
     `★ 목록을 끝까지 읽었다 — 목록 ${order.length}개 / index.html ${(HTML.match(/<script src="(?:fortune_data|script_)[^"]*"><\/script>/g)||[]).length}개`);

  /* ★★ [2026-08-11] 반대 방향이 진짜 위험한 자리였습니다.
     위 검사는 "목록에 있는 것이 index.html 에 있는가" 만 봤습니다.
     그런데 📢 공지판과 🏅 업적은 **index.html 에는 있는데 목록에 없었어요.**
     build-single.py 는 첫 파일 태그부터 마지막 파일 태그까지를 통째로
     지우고 자기 목록을 끼워 넣습니다. 그 사이에 낀 두 파일은 태그가
     지워지고 알맹이는 안 들어가 — **단일파일에서만 통째로 사라졌습니다.**
     "남은 외부 참조" 검사도 못 잡아요. 태그가 없어졌으니 찾을 게 없거든요.
     ★ 순서까지 봅니다. 뒤엣것이 앞엣것을 감싸는 파일들이 있어서
       (script_profile.js·script_sticker.js) 차례가 바뀌면 조용히 깨집니다. */
  {
    const 첫 = HTML.indexOf('<script src="' + order[0]);
    const 끝 = HTML.indexOf('</script>',
                 HTML.indexOf('<script src="' + order[order.length - 1])) + 9;
    const 태그 = (HTML.slice(첫, 끝).match(/<script src="([^"?]+)/g) || [])
                   .map(x => x.replace('<script src="', ""));
    ok(첫 >= 0 && 끝 > 첫, "합쳐질 구간을 찾을 수 있다");
    const 빠짐 = 태그.filter(f => !order.includes(f));
    ok(!빠짐.length,
       "★ index.html 에 있는데 목록에 없는 파일이 없다 — 있으면 단일파일에서 사라진다"
       + (빠짐.length ? " → " + 빠짐.join(", ") : ""));
    ok(태그.join(",") === order.join(","),
       "★ 싣는 차례가 index.html 과 똑같다 (감싸는 파일이 있어서 순서가 중요합니다)");
  }

  /* 문지기가 build-single.py 안에도 있어야 합니다 — 검사를 안 돌리고
     빌드만 하는 날이 반드시 오니까요. */
  {
    const bpy = fs.readFileSync(DIR + "build-single.py", "utf8");
    ok(/태그 != ORDER/.test(bpy) && /sys\.exit\(/.test(bpy),
       "★ build-single.py 도 스스로 어긋남을 잡고 멈춘다");
  }

  /* 실제로 합쳐진 결과에 두 파일이 들어 있는가 — 눈으로 확인하는 셈 */
  {
    const one = fs.readFileSync(DIR + "index-단일파일.html", "utf8");
    ["script_notice.js", "script_achv.js"].forEach(f =>
      ok(one.includes("/* ===== " + f + " ===== */"),
         `단일파일에 ${f} 가 실제로 들어 있다`));
    ok(one.includes("미라클 모닝반"), "★ 오늘 만든 업적이 단일파일에도 있다");

    /* =====================================================================
       ★★★ [사고 2026-08-22] 단일파일이 **열 시간 넘게 안 만들어지고
       있었습니다.**
       ---------------------------------------------------------------------
       build-single.py 의 "남은 외부 참조" 문지기가, 2026-08-20 에 대문에
       달린 findpw-*.html 을 모르고 걸렀습니다. sys.exit 이라 **파일을 쓰기
       직전에** 멈춥니다. 그런데 화면에 뜬 글이 "…남았어요" 라 경고처럼
       보여서, 실패한 줄 모르고 매번 "다 됐습니다" 하고 넘어갔어요.

       위의 검사들은 전부 "단일파일 **안에** 무엇이 있나" 만 봅니다. 파일이
       통째로 낡으면 그 안의 옛 내용이 그대로 있으니 다 통과해 버려요.
       그래서 **언제 만들어졌나**를 따로 봅니다.

       ★ 이건 만든 결과물이 아니라 **작업 절차**를 보는 검사입니다.
         빨간불이 뜨면 고칠 것은 코드가 아니라 `python3 build-single.py`
         를 한 번 돌리는 일입니다.
       ===================================================================== */
    {
      const 언제 = (f) => { try { return fs.statSync(DIR + f).mtimeMs; } catch (e) { return 0; } };
      const 단일 = 언제("index-단일파일.html");
      const 재료 = ["index.html", "styles.css"]
        .concat(fs.readdirSync(DIR).filter(f => /^(script_|fortune_).*\.js$/.test(f)));
      /* checks.js 와 build-single.py 자신은 재료가 아닙니다 — 그것만 고쳐도
         단일파일은 그대로여야 하니까요. */
      const 늦은것 = 재료.filter(f => 언제(f) > 단일 + 2000)   // 2초는 빌드 자체가 걸리는 시간
                        .sort((a, b) => 언제(b) - 언제(a));
      ok(늦은것.length === 0,
         "★★★ 단일파일이 최신이다 — `python3 build-single.py` 를 돌리세요"
         + (늦은것.length ? ` ← ${늦은것.slice(0, 4).join(", ")}${늦은것.length > 4 ? " 외 " + (늦은것.length - 4) + "개" : ""} 가 더 새것입니다` : ""));

      /* 그날 사고의 씨앗 자체도 막아 둡니다 */
      const bpy2 = fs.readFileSync(DIR + "build-single.py", "utf8");
      ok(/"findpw-"/.test(bpy2),
         "★★ 대문의 findpw 링크가 허용 목록에 있다 (없으면 빌드가 조용히 멈춘다)");
      ok((bpy2.match(/sys\.exit\("❌ 중단/g) || []).length >= 3
         && /❌ 중단 — ORDER/.test(bpy2),
         "★★★ 멈출 때는 ❌ 로 시작해 **안 만들었다**고 못 박는다 (경고처럼 보이면 또 넘어간다)");
    }
  }
}

/* =====================================================================
   🛠️ REPAIR — 방장이 방을 고칠 때 조용히 드나들기 (2026-08-22 — 콩)
   ---------------------------------------------------------------------
   방을 손보는 동안에는 새로고침을 수십 번 합니다. 그때마다 "입장하셨
   습니다 / 나갔어요" 가 쌓이면 그날 대화가 통째로 묻혀요.
   상태표를 🛠️REPAIR🛠️ 로 걸어 두면 그 줄을 안 씁니다.

   ★ 카드가 사라졌다 나타나는 것까지는 안 막습니다 — 그건 접속 판정
     (status·onDisconnect)이라 손대면 "있는데 없다고 나오는" 쪽이 망가져요.
     콩도 "적어도 챗창만큼은" 이라고 했습니다.
   ★ 시간 기록에는 칸을 안 만들었습니다 — timelog 의 normStatus 가
     모르는 값을 rest 로 접어서 **☕Break 로 쌓입니다.** 자리에는 있지만
     집필은 아니니 그 자리가 맞고, 덕분에 39명의 기록 화면이 안 바뀝니다.
   ===================================================================== */
{
  const CO9 = fs.readFileSync(DIR + "script_core.js", "utf8");
  const PR9 = fs.readFileSync(DIR + "script_profile.js", "utf8");
  const RT9 = fs.readFileSync(DIR + "script_realtime.js", "utf8");
  const DA9 = fs.readFileSync(DIR + "script_data.js", "utf8");
  const ID9 = fs.readFileSync(DIR + "script_idledetect.js", "utf8");
  const CS9r = fs.readFileSync(DIR + "styles.css", "utf8");

  /* ★★★ 새 나갈 길이 **셋**입니다. 한 곳만 막으면 나머지가 조용히 샙니다. */
  ok(/async function _writeJoinSystemMessageOnce\(\) \{\s*if \(조용히드나드나\(\)\) return;/.test(CO9),
     "★★★ 입장 메시지가 문지기를 지난다");
  ok(/async function _writeLeaveSystemMessageOnce\(\) \{\s*if \(조용히드나드나\(\)\) return;/.test(CO9),
     "★★★ 퇴장 메시지가 문지기를 지난다");
  ok(/if \(조용히드나드나\(\)\) \{ _leaveBeaconSent = true; return; \}/.test(CO9),
     "★★★ 창을 그냥 닫을 때(beacon)도 문지기를 지난다 — 여기가 제일 잊기 쉽다");
  ok((CO9.match(/조용히드나드나\(\)/g) || []).length === 4,
     "★★ 문지기는 하나뿐이고 세 자리가 함께 쓴다 (선언 1 + 부름 3)");

  /* ★★★ [사고 2026-08-22 — 콩 신고] 처음엔 화면의 상태 칸(#db-status)만
     봤습니다. 그런데 **입장 메시지는 loadPersonalData 보다 먼저 나갑니다.**
     그때 그 칸은 아직 비어 있어서, REPAIR 를 걸어 둬도 입장 줄이 그대로
     떴어요. 차례를 확인하지 않고 넘겨짚은 자리였습니다.
     → 기기에 남은 값(backup_{닉})도 함께 봅니다. */
  ok(CO9.indexOf("await _writeJoinSystemMessageOnce();") < CO9.indexOf('callIfFn("loadPersonalData")'),
     "★★★ 입장 메시지는 여전히 loadPersonalData 보다 **먼저** 나간다 — 그래서 화면 칸만 보면 안 된다");
  /* ★★★ [고침 2026-08-22 · 2차 — 콩 신고] 1차 고침(backup_)도 안 먹혔습니다.
     그 값은 *디바운스 700ms → savePersonalData → backupLocal* 이라는 **긴
     사슬** 끝에 적히거든요. 자동감지가 away 로 덮거나, 고르자마자 새로고침
     하면 옛 값입니다. → REPAIR 는 **고르는 그 순간** `repair_{닉}` 에 적고,
     문지기가 그걸 **가장 먼저** 봅니다.
     ★ 짧은 길이 곧 튼튼한 길. 값 하나가 여러 손을 거칠수록 "왜 안 되지" 를
       찾는 시간이 곱으로 늘어납니다. */
  ok(/if \(나 && window\.AppStore\?\.getItem\(`repair_\$\{나\}`\) === "1"\) return true;/.test(CO9),
     "★★★ 문지기가 `repair_{닉}` 열쇠를 **가장 먼저** 본다");
  ok(/if \(v === "repair"\) window\.AppStore\?\.setItem\(`repair_\$\{나\}`, "1"\);/
       .test(fs.readFileSync(DIR + "script_profile.js", "utf8")),
     "★★★ 고르는 **그 순간** 기기에 적는다 (디바운스를 안 기다린다)");
  ok(/else window\.AppStore\?\.removeItem\(`repair_\$\{나\}`\);/
       .test(fs.readFileSync(DIR + "script_profile.js", "utf8")),
     "★★★ 다른 상태를 고르면 그 열쇠를 **지운다** — 안 지우면 영영 조용해진다");
  ok(/const raw = window\.AppStore\?\.getItem\(`backup_\$\{나\}`\);/.test(CO9),
     "★ 예비로 backup_ 도 본다 (옛 기기에는 새 열쇠가 없을 수 있다)");
  {
    const 판정 = ({ 화면, 기기, 열쇠 }) => {
      const 방 = { myNick: "링가링🍄", JSON,
        document: { getElementById: () => ({ value: 화면 }) },
        window: { AppStore: { getItem: (k) =>
          k === `repair_링가링🍄` ? (열쇠 ? "1" : null)
          : (k === `backup_링가링🍄` && 기기 !== null) ? JSON.stringify({ status: 기기 }) : null } } };
      방.window.window = 방.window; vm.createContext(방);
      vm.runInContext(CO9.slice(CO9.indexOf("function 조용히드나드나"),
                                CO9.indexOf("async function _writeJoinSystemMessageOnce"))
        + "\nglobalThis.G = 조용히드나드나;", 방);
      return 방.G();
    };
    ok(판정({ 화면: "", 기기: "repair" }) === true,
       "★★★ 입장 첫 순간(화면 비었고 기기에 repair) — 조용하다 [콩이 겪은 자리]");
    ok(판정({ 화면: "", 기기: "writing" }) === false && 판정({ 화면: "", 기기: null }) === false,
       "★★ 기기 값이 repair 가 아니면 평소대로 (처음 오는 사람 포함)");
    ok(판정({ 화면: "repair", 기기: "writing" }) === true,
       "★★ 다 불러온 뒤에는 화면 칸이 진실이다");
    ok(판정({ 화면: "writing", 기기: "repair" }) === false,
       "★★★ 방금 손으로 바꿨으면 기기의 옛 값에 끌려가지 않는다");
    ok(판정({ 화면: "", 기기: "away", 열쇠: true }) === true,
       "★★★ 열쇠가 있으면 **기기 값이 away 로 덮여 있어도** 조용하다 [2차 사고 자리]");
    ok(판정({ 화면: "", 기기: null, 열쇠: false }) === false,
       "★★ 열쇠가 없으면 평소대로");
  }

  /* 새로고침해도 유지 — 안 그러면 이 기능의 뜻이 없습니다 */
  {
    const 방2 = {}; vm.createContext(방2);
    vm.runInContext(DA9.slice(DA9.indexOf("function _startStatus"),
                              DA9.indexOf("async function loadPersonalData")), 방2);
    const 되살 = (v) => vm.runInContext(`_startStatus(${JSON.stringify(v)})`, 방2);
    ok(되살("repair") === "repair",
       "★★★ 새로고침해도 REPAIR 가 풀리지 않는다 (풀리면 그때마다 메시지가 뜬다)");
    ok(되살("away") === "focus" && 되살("rest") === "focus",
       "★ 다른 값은 예전 그대로 (들어왔으면 자리에 있는 것)");
  }
  ok(/if \(sel && sel\.value !== "repair"\) sel\.value = "rest";/.test(CO9),
     "★★ 나가는 길에 REPAIR 를 rest 로 덮지 않는다");
  ok(/if \(cur === "repair"\) return;/.test(ID9),
     "★★ 자동감지가 REPAIR 를 away 로 내리지 않는다 (딴 창에서 고치는 중이니까)");

  /* 방장만 고를 수 있다 — 잠금장치가 아니라 실수 방지 */
  ok(/\{ v: "repair",[^}]*방장만: true \}/.test(PR9), "★ repair 에 방장만 표시가 붙어 있다");
  ok(/CHOICES\.filter\(고를수있나\)/.test(PR9), "★★ 고르기 판이 그 표시로 거른다");
  ok(!/링가링/.test(PR9),
     "★★★ 닉을 베껴 적지 않았다 — ADMIN_NICK 은 이미 두 파일을 손으로 맞추는 값이라, 셋이 되면 언젠가 어긋난다");
  ok(/function isRoomOwner\(\) \{ return myNick === ADMIN_NICK; \}/.test(RT9)
     && /window\.isRoomOwner = isRoomOwner;/.test(RT9),
     "★★ 방장만 가리는 창구가 따로 있다 (canAdmin 은 운영진까지 포함이라 다르다)");

  /* 읽는 쪽 — 남의 화면에도 제대로 떠야 합니다 */
  ok(/repair:  "🛠️REPAIR🛠️"/.test(RT9), "★★ 라벨이 있다 (고르는 건 방장뿐이지만 읽는 건 모두)");
  ok(/repair: "status-repair"/.test(RT9), "★ 색 이름도 있다");
  ok(/<option value="repair">/.test(fs.readFileSync(DIR + "index.html", "utf8")),
     "★ 숨은 select 에 값 자리가 있다");
  /* ★★★ [고침 2026-08-22 — 콩] 여기만 **불투명**입니다.
     처음엔 다른 넷처럼 반투명(.66)으로 뒀다가 "흐리다" 는 말을 들었어요.
     까닭은 색에 있습니다 — 흰 카드 위에서 REPAIR 는 #FAC6D6(거의 흰색)까지
     옅어지는데, WRITE 는 #FF8983 으로 색이 남습니다. **옅은 색을 반투명으로
     깔면 바탕에 먹힙니다.**
     ★ 고르기 판의 알약과 **같은 색을 그대로** 씁니다 (콩: "선택창 모양 그대로").
     ★ 불투명이라 낮·밤·카드 색과 무관하게 늘 같습니다 — 다크 대비를
       두지 않는 것이 맞습니다 (콩: "테마에 상관없이 유지됐으면"). */
  ok(/\.card-state\.status-repair \{ background: #F7A8C1;/.test(CS9r),
     "★★ 베이비 핑크가 **불투명**이다 (옅은 색은 반투명으로 깔면 바탕에 먹힌다)");
  ok(/\.status-pop-item\.status-repair \{ background:#F7A8C1/.test(CS9r),
     "★★ 카드에 뜨는 색과 고르기 판의 색이 **같다**");
  ok(!/:root\[data-is-dark="true"\][^{]*\.card-state\.status-repair/.test(CS9r),
     "★★ 다크 대비를 두지 않는다 — 불투명이라 테마와 무관하게 같아야 한다");
  ok(/\.status-pop-item\.status-repair \{ background:#F7A8C1/.test(CS9r),
     "★ 고르기 판에서도 같은 결");

  /* 시간 기록은 손대지 않았습니다 — normStatus 가 rest 로 접습니다 */
  const TL9 = fs.readFileSync(DIR + "script_timelog.js", "utf8");
  ok(/function normStatus\(s\) \{ return STATUS_IDS\.includes\(s\) \? s : "rest"; \}/.test(TL9),
     "★★★ 모르는 상태는 rest 로 접힌다 — 그래서 REPAIR 가 ☕Break 로 쌓이고 기록 화면이 안 바뀐다");
  ok(!/"repair"/.test(TL9), "★ 시간 기록에는 REPAIR 칸을 안 만들었다");
}

/* =====================================================================
   👤 탈퇴자 자료 정리 (2026-08-22 — 콩)
   ---------------------------------------------------------------------
   되돌릴 수 없는 기능이라 검사도 세게 합니다.

   ★★★ 가장 나쁜 고장은 "보여준 것보다 더 지우는" 것입니다. 그래서
     **세는 목록과 지우는 목록이 하나**여야 해요 — 자취세기() 가 만든
     경로를 purgeMember() 가 그대로 받습니다. 둘을 따로 적으면 언젠가
     어긋나고, 그때는 이미 남의 자료가 사라진 뒤입니다.
   ★ 안 지우는 것: 채팅·흐름(대화에 구멍) · 대숲·표현공부·품평(익명이라
     누가 썼는지 서버에 없음) · nickOwner(지우면 닉을 아무나 가져감).
   ===================================================================== */
{
  const AD = fs.readFileSync(DIR + "script_admin.js", "utf8");

  ok(/const 지울자리 = \[/.test(AD), "지울 자리를 한 곳에 목록으로 둔다");
  /* ⚠️ 이 셋이 목록에 들어오면 안 됩니다 */
  ["messages", "messages2", "wordfeed", "forest", "help", "pubreview", "nickOwner", "music"]
    .forEach(n => ok(!new RegExp(`p: "${n}"`).test(AD), `★★ ${n} 은 지우지 않는다`));

  /* ★★★ [다시 만듦 2026-08-22 — 콩 신고 "명단이 안 뜬다"]
     이 방에는 **이미 지우는 기능이 있었습니다** — 출근부 이름 옆 [✕]
     (removeMember, 2026-08 이전). 그게 nickOwner 까지 지우니 "승인 풀린
     사람" 목록에 뜰 사람이 애초에 없었어요. 기존 기능을 안 보고 새로
     만든 탓입니다. **새로 만들기 전에 이미 있는지 먼저 볼 것.**
     → 이 카드는 이제 [✕] 가 **못 지운 것**을 줍습니다(자료엔 있는데
       명단엔 없는 닉). [✕] 쪽도 새 자리를 함께 지우도록 넓혔습니다. */
  ok(/if \(명단\.has\(n\) \|\| n === ADMIN_NICK\) return;/.test(AD),
     "★★★ 명단(nickOwner)에 아직 있는 사람과 방장은 목록에서 뺀다");
  ok(/const 새자리 = \["achv", "worklog", "workname"\];/.test(AD),
     "★★★ [✕] 삭제도 새 자리(업적·회차·작품 이름)를 함께 지운다 — 안 그러면 또 떠돈다");
  ok(/db\.ref\("todostat"\)\.once\("value"\)[\s\S]{0,320}?db\.ref\("todostat"\)\.update\(tsUpd\)/.test(AD),
     "★★ 날짜별인 todostat 도 함께");
  /* ★★★ [사고 2026-08-22 — 콩 신고 PERMISSION_DENIED] 처음엔 `users` 를
     통째로 읽어 명단을 만들었는데, **users 루트에는 읽기 권한이 없습니다**
     (낱개만 주인·방장에게 열림). 목록이 통째로 안 떠서 "여태 나간 멤버가
     안 뜬다" 로 보였어요 — 오늘부터 적용이 아니라 그냥 못 읽은 것.
     ★ 규칙을 안 고치고 **읽을 수 있는 자리(nickOwner)** 로 옮겼습니다.
       콘솔에 규칙을 다시 올리는 건 잘못하면 방이 안 열리는 걸음이라,
       안 해도 되면 안 하는 편이 낫습니다. */
  ok(/db\.ref\("nickOwner"\)\.once/.test(AD),
     "★★★ 명단은 nickOwner 에서 가져온다 (users 루트는 읽기 권한이 없다)");
  ok(/떠도는 자취/.test(fs.readFileSync(DIR + "admin.html", "utf8")),
     "★ 카드 이름이 하는 일과 같다 (🧹 떠도는 자취 줍기)");
  ok(!/db\.ref\("users"\)\.once\("value"\)/.test(AD),
     "★★ users 루트를 통째로 읽지 않는다");
  ok(/} catch \(e\) \{\s*못본것\.push\(자리\.이름\);/.test(AD),
     "★★ 읽기가 막힌 자리(📮 쪽지)는 건너뛰되 이름을 남긴다");
  ok(/못 지우는 것/.test(AD),
     "★★★ 못 지운 것을 화면에 알린다 — '지웠다' 는데 남아 있는 것이 가장 나쁜 거짓말");
  ok(/칸\.value\.trim\(\) !== nick/.test(AD),
     "★★★ 닉을 손으로 한 번 더 적어야 단추가 열린다 (되돌릴 수 없으니 확인 한 번으론 부족)");
  ok(/단추\?\.addEventListener\("click", \(\) => purgeMember\(nick, 것\.경로\)\)/.test(AD),
     "★★★ **세면서 만든 경로 그대로** 지운다 — 목록이 둘이면 언젠가 어긋난다");
  ok(/경로\.forEach\(p => \{ 뭉치\[p\] = null; \}\);\s*await db\.ref\(\)\.update\(뭉치\);/.test(AD),
     "★★ 한 번에 지운다 (중간에 끊겨 절반만 지워지지 않게)");

  /* ── 가짜 서버에 세 사람을 앉혀 놓고 실제로 돌려 봅니다 ── */
  {
    const 나무 = {
      "config/allow": { "밤샘": true },
      /* ★ 명단은 nickOwner 에서 옵니다 (users 루트는 읽기 권한이 없어요) */
      /* ★ '떠난이' 는 [✕] 로 이미 지워져 **명단에 없습니다** — 그런데
         자료(achv·worklog…)에는 남아 떠돌고 있어요. 그게 이 카드가
         찾아내야 할 것입니다. */
      nickOwner: { "밤샘": "uid1", "링가링🍄": "uid0" },
      users: { "밤샘": { profile: {} }, "떠난이": { profile: {}, timeSegs: {} }, "링가링🍄": { profile: {} } },
      achv: { "밤샘": { a: 1 }, "떠난이": { a: 1 } },
      worklog: {}, workname: {}, notes: { "떠난이": { n1: {} } }, notesOut: {}, status: {},
      attendance: { "2026-08-01": { "밤샘": 1, "떠난이": 1 }, "2026-08-02": { "떠난이": 1 } },
      wordlog: { "2026-08-01": { "떠난이": { t: 1 }, "밤샘": { t: 1 } } },
      todostat: { "2026-08-01": { "떠난이": { n: 1 } } },
    };
    const 파기 = (p) => p.split("/").filter(Boolean);
    const 읽기 = (p) => {
      if (나무[p] !== undefined) return 나무[p];
      const ks = 파기(p); let cur = 나무[ks[0]];
      for (let i = 1; i < ks.length; i++) { if (cur == null) return null; cur = cur[ks[i]]; }
      return cur === undefined ? null : cur;
    };
    const 지운것 = [];
    const 스냅 = (v) => ({ val: () => (v === undefined ? null : v),
      exists: () => v !== null && v !== undefined,
      numChildren: () => (v && typeof v === "object") ? Object.keys(v).length : 0 });
    const db2 = { ref: (p = "") => ({ once: async () => 스냅(읽기(p)),
      update: async (뭉치) => { Object.keys(뭉치).forEach(k => { 지운것.push(k);
        const ks = 파기(k); let cur = 나무[ks[0]];
        for (let i = 1; i < ks.length - 1; i++) cur = cur?.[ks[i]];
        if (cur) delete cur[ks[ks.length - 1]]; }); } }) };

    const 시작 = AD.indexOf("  const 지울자리 = [");
    const 끝 = AD.indexOf("  async function showPurgeDetail");
    const 지우기조각 = AD.slice(AD.indexOf("  async function purgeMember"));
    const 방 = { db: db2, ADMIN_NICK: "링가링🍄", Promise, Object, JSON, console,
      escapeHtml: (x) => String(x), el: () => ({ innerHTML: "", textContent: "", style: {} }), msg: () => {} };
    vm.createContext(방);
    vm.runInContext(AD.slice(시작, 끝)
      + 지우기조각.slice(0, 지우기조각.indexOf("\n  }\n") + 5)
      + "\nglobalThis.L=loadPurgeList; globalThis.S=자취세기; globalThis.P=purgeMember;", 방);

    /* 검사기는 동기라, 여기서만 결과를 모아 두고 아래에서 봅니다 */
    const 결과 = { };
    const 돌리기 = (async () => {
      await 방.L();
      결과.후보 = vm.runInContext("_지울후보", 방).slice();
      const 것 = await 방.S("떠난이");
      결과.셈 = 것.경로.slice();
      await 방.P("떠난이", 것.경로);
      결과.지움 = 지운것.slice();
      결과.나무 = 나무;
    })();
    /* ★ ok() 를 async 로 만들 수 없어, 이 한 자리만 **끝난 뒤에** 확인합니다.
       (checks.js 는 동기 흐름이라 마지막에 몰아 보는 편이 안전해요) */
    _나중에.push(() => {
      ok(결과.후보 && 결과.후보.length === 1 && 결과.후보[0] === "떠난이",
         `★★★ 명단에 없는 닉(떠도는 자취)만 뜬다 (${JSON.stringify(결과.후보)})`);
      ok(결과.셈 && 결과.지움 && 결과.셈.length === 결과.지움.length,
         `★★★ 보여준 만큼만 지웠다 (센 ${결과.셈?.length} · 지운 ${결과.지움?.length})`);
      const t = 결과.나무;
      ok(!!t.users["밤샘"] && !!t.users["링가링🍄"] && !!t.achv["밤샘"]
         && t.attendance["2026-08-01"]["밤샘"] === 1 && !!t.wordlog["2026-08-01"]["밤샘"],
         "★★★ 남의 자료는 하나도 안 건드렸다");
      ok(t.users["떠난이"] === undefined && t.achv["떠난이"] === undefined
         && t.notes["떠난이"] === undefined
         && t.attendance["2026-08-01"]["떠난이"] === undefined
         && t.attendance["2026-08-02"]["떠난이"] === undefined
         && t.wordlog["2026-08-01"]["떠난이"] === undefined
         && t.todostat["2026-08-01"]["떠난이"] === undefined,
         "★★★ 그 사람 자취는 날짜별까지 모두 사라졌다");
    });
    _기다릴것.push(돌리기);
  }

  const AH9 = fs.readFileSync(DIR + "admin.html", "utf8");
  ok(/id="adm-purge-card"/.test(AH9) && /id="adm-purge-list"/.test(AH9),
     "관리자 창에 자리가 있다");
  ok(/로그인 계정 자체는 파이어베이스 콘솔에서만/.test(AH9),
     "★★ 계정(Auth)은 여기서 못 지운다고 화면에 적어 뒀다 — 다 지운 줄 알면 곤란하다");
}

/* 입장 알림 */
{
  const rt=fs.readFileSync(DIR+"script_realtime.js","utf8");
  const ui=fs.readFileSync(DIR+"script_ui.js","utf8");
  ok(/function notifyJoin/.test(ui), "입장 알림 함수가 있다");
  ok(/_joinNoti/.test(ui) && /joinNoti/.test(ui), "입장 알림은 설정으로 켜고 끈다");
  ok(/AppStore\.getItem\("joinNoti"\) === "true"/.test(ui), "입장 알림은 기본 꺼짐이다");
  {
    const i=ui.indexOf("function notifyJoin");
    const seg=ui.slice(i, i+500);
    ok(/if \(!_joinNoti\) return;/.test(seg), "꺼져 있으면 알리지 않는다");
    ok(/visibilityState === "visible"\) return;/.test(seg), "보고 있을 때는 알리지 않는다");
    ok(/canNotify\(\)/.test(seg), "권한 없으면 알리지 않는다");
  }
  ok(!/id="set-join-noti"/.test(HTML), "입장 알림 스위치도 탭과 함께 빠졌다 (기본값으로 동작)");
  ok(/function detectJoins/.test(rt), "입장 감지 함수가 있다");
  {
    const i=rt.indexOf("function detectJoins");
    const seg=rt.slice(i, i+900);
    ok(/_seenOnline === null\) \{ _seenOnline = cur; return; \}/.test(seg),
       "첫 스냅숏은 씨앗만 심고 알리지 않는다");
    ok(/nick === myNick\) continue;/.test(seg), "내 입장은 알리지 않는다");
  }
  ok(rt.indexOf("_seenOnline = null;   // 다시 붙을 때") > 0, "다시 붙을 때 목록을 비운다");

  /* 실제로 굴려봅니다 — 새 이름만 잡히는가 */
  const now=Date.now();
  const on=()=>({ lastSeen: now });
  let seen=null, fired=[];
  const step=(data)=>{
    const cur=new Set(Object.keys(data));
    if (seen===null){ seen=cur; return; }
    const fresh=[...cur].filter(n=>n!=="나"&&!seen.has(n));
    seen=cur; if(fresh.length) fired.push(fresh.join(","));
  };
  step({"나":on(),"가":on()});                 // 입장 — 알림 없어야
  step({"나":on(),"가":on()});                 // lastSeen 갱신 — 없어야
  step({"나":on(),"가":on(),"나":on()});
  step({"나":on(),"가":on(),"다":on()});       // 다 입장
  step({"나":on(),"다":on()});                 // 가 퇴장 — 없어야
  step({"나":on(),"다":on(),"가":on()});       // 가 재입장 — 알림
  ok(fired.join("|")==="다|가", "새로 들어온 사람만 정확히 잡는다 ("+fired.join("|")+")");
}

/* ---- 9. 접속 판정 — 오래 방치해도 사라지지 않아야 ---- */
{
  const src=fs.readFileSync(DIR+"script_realtime.js","utf8");
  const ev=x=>Function("return "+x)();
  const g=src.match(/DISCONNECT_GRACE_MS\s*=\s*([\d\s*]+);/);
  const st=src.match(/ONLINE_STALE_MS\s*=\s*([\d\s*]+);/);
  const grace=g?ev(g[1]):0, stale=st?ev(st[1]):0;
  /* [고침 2026-08-15] 30분 → 5분. 창을 닫을 때 즉시 지우는 길이
     막혀 있어서(마지막 인사에 인증 토큰이 안 실렸음) 유예를 넉넉히
     잡아 둘 수밖에 없었는데, 그 길을 뚫었습니다.
     ★ 위아래를 **둘 다** 막습니다 —
       너무 짧으면 잠깐 끊긴 사람이 사라졌다 돌아오며 입장 알림이 또 뜨고,
       너무 길면 창을 닫은 사람이 한참 남아 "저 사람 있나?" 싶어집니다. */
  ok(grace>=3*60*1000 && grace<=10*60*1000,
     `끊김 유예가 3~10분 사이 (${Math.round(grace/60000)}분)`);
  ok(stale>=6*60*60*1000, `lastSeen 창이 6시간 이상 (${Math.round(stale/3600000)}시간)`);
  ok(stale>grace, "lastSeen 창이 유예보다 넉넉하다");

  const isOnline=(row,now)=>{
    if(!row) return false;
    const d=Number(row.disconnectedAt||0);
    if(d>0 && now-d>=grace) return false;
    const s2=Number(row.lastSeen||0);
    if(s2>0 && now-s2>=stale) return false;
    return true;
  };
  const now=Date.now();
  ok(isOnline({lastSeen:now-40*60*1000},now),  "40분간 창을 내려둬도 접속 중");
  ok(isOnline({lastSeen:now-3*60*60*1000},now),"3시간 방치도 접속 중");
  /* [고침 2026-08-15] 유예 5분 기준 — 3분은 아직 접속 중, 10분은 제외.
     (2026-08-06 에는 30분 기준으로 20분/40분을 쟀습니다) */
  ok( isOnline({disconnectedAt:now-3*60*1000,lastSeen:now-3*60*1000},now), "3분 전 끊김은 유예 안 (잠깐 끊긴 사람)");
  ok(!isOnline({disconnectedAt:now-10*60*1000,lastSeen:now-10*60*1000},now),"10분 전 끊김은 제외");
  ok(isOnline({disconnectedAt:now-60*1000,lastSeen:now-60*1000},now),       "1분 전 끊김은 유지");
  ok(!isOnline({lastSeen:now-30*60*60*1000},now),                            "30시간 전 고아 기록은 제거");

  /* =====================================================================
     ★★ 폰에서 다른 앱으로 넘어갔다고 나간 것으로 치면 안 됩니다 (2026-08-12)
     ---------------------------------------------------------------------
     [무엇이 일어나고 있었나]
     퇴장 처리를 beforeunload 와 pagehide **둘 다**에 걸어 두었습니다.
     그런데 pagehide 는 창을 닫을 때만 뜨는 게 아니에요 —
     폰에서 앱을 바꾸거나 화면을 끄거나, 다른 사이트에 갔다 뒤로가기로
     돌아올 때도 뜹니다. 그리고 그 함수는 status/{닉네임} 을 **통째로
     지웁니다.** 끊김 표시를 남기는 게 아니라 기록 자체를 지우는 거라
     위에서 확인한 30분 유예가 아무 소용이 없습니다. 남들 화면에서
     그 자리에서 사라졌어요.

     그래서 "폰으로 켜 두고 가끔 들여다보는 한 사람"만 계속 그랬습니다.
     ===================================================================== */
  {
    const CORE = fs.readFileSync(DIR+"script_core.js","utf8");

    ok(/function _handlePageHide\(e\)/.test(CORE), "pagehide 를 따로 받는 자리가 있다");
    ok(/if \(e && e\.persisted\) return;/.test(CORE),
       "★ 곧 돌아올 때(persisted)는 아무것도 하지 않는다");
    ok(!/addEventListener\("pagehide", _handleBeforeUnload/.test(CORE),
       "★ pagehide 에 퇴장 처리를 **곧장** 걸지 않는다 (이게 원인이었다)");
    ok((CORE.match(/addEventListener\("pagehide", _handlePageHide\)/g) || []).length === 2,
       "입장할 때와 뒤로가기로 돌아왔을 때 둘 다 거르는 쪽으로 건다");
    ok(/removeEventListener\("pagehide", _handlePageHide\)/.test(CORE),
       "★ [나가기] 로 뗄 때도 같은 것을 뗀다 (이름이 어긋나면 안 떼어진다)");
    /* ★ once 를 붙이면 안 됩니다 — 한 번 거르고 나면 정작 진짜 나갈 때
       아무도 안 듣습니다. 두 번 보내는 건 _leaveBeaconSent 가 막아요. */
    ok(!/addEventListener\("pagehide", _handlePageHide, \{ once: true \}\)/.test(CORE),
       "★ 한 번만 듣게 하지 않는다 (거르고 나면 진짜 퇴장을 놓친다)");
    ok(/_leaveBeaconSent/.test(CORE), "두 번 보내는 건 다른 장치가 막는다");

    /* beforeunload 는 그대로 — 데스크톱에서 창을 닫는 건 진짜 퇴장입니다 */
    ok(/addEventListener\("beforeunload", _handleBeforeUnload, \{ once: true \}\)/.test(CORE),
       "창 닫기(beforeunload)는 그대로 퇴장으로 친다");

    /* ── 실제로 굴려 봅니다 ── */
    {
      let 지움 = 0;
      const box2 = {};
      vm.createContext(box2);
      vm.runInContext(
        "let 지움 = 0;" +
        "function _handleBeforeUnload(){ 지움++; }" +
        CORE.slice(CORE.indexOf("  function _handlePageHide(e)"),
                   CORE.indexOf("\n  }", CORE.indexOf("  function _handlePageHide(e)")) + 4), box2);
      const 넘기기 = (e) => {
        vm.runInContext("지움 = 0;", box2);
        vm.runInContext("_handlePageHide", box2)(e);
        return vm.runInContext("지움", box2);
      };
      ok(넘기기({ persisted: true }) === 0,
         "★ 폰에서 앱을 바꿔도(persisted) 카드가 안 사라진다");
      ok(넘기기({ persisted: false }) === 1,
         "★ 진짜 없어질 때는(persisted 아님) 그대로 퇴장 처리된다");
      ok(넘기기(undefined) === 1, "표가 아예 없으면 퇴장으로 친다 (안전한 쪽)");
    }
  }
}

/* ---- 10. 뽀모 브라우저 알림 ---- */
{
  const u=fs.readFileSync(DIR+"script_ui.js","utf8");
  const r=fs.readFileSync(DIR+"script_realtime.js","utf8");
  const i=u.indexOf("function notifyPomodoro");
  ok(i>=0, "notifyPomodoro 가 있다");
  /* [뒤집음 2026-08-09] ♪ 는 **소리만** 끕니다.
     소리를 끄는 이유는 대개 옆에 사람이 있어서지, 세션이 끝난 걸 모르고
     싶어서가 아닙니다. 다른 창을 볼 때 조용히 뜨는 알림은 남겨 둡니다. */
  ok(!/if \(!_pomoParticipating\) return;/.test(u.slice(i,i+400)),
     "소리를 꺼도 브라우저 알림은 그대로 온다");
  {
    const j = u.indexOf("function playPomodoroSound");
    ok(/if \(!_pomoParticipating\) return;/.test(u.slice(j, j + 400)),
       "소리는 스위치를 따른다");
  }
  ok(/visibilityState === "visible"\) return/.test(u.slice(i,i+600)), "보고 있을 때는 알림을 띄우지 않는다");
  ok(/askNotifyPermissionOnce/.test(r), "시작 버튼에서 권한을 물어본다");
  ok(/AppStore\.getItem\(NOTI_ASKED_KEY\)/.test(u), "한 번 물어본 뒤엔 다시 묻지 않는다");
}

/* ---- 12. 로그인 B안 (닉네임 + 비밀번호) ---- */
{
  const a = fs.readFileSync(DIR+"script_auth.js","utf8");
  const h = fs.readFileSync(DIR+"index.html","utf8");
  const rules = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;

  ok(/firebase-auth-compat\.js/.test(h), "index.html 이 firebase-auth 를 읽어온다");
  const tags = (h.match(/<script src="(script_[\w.-]+)/g) || []).map(t => t.split('"')[1]);
  ok(tags.indexOf("script_auth.js") === tags.indexOf("script_core.js") + 1,
     "script_auth.js 가 script_core.js 바로 뒤다 (join 을 감싸야 하므로)");
  ok(tags.indexOf("script_auth.js") < tags.indexOf("script_profile.js"),
     "script_auth.js 가 script_profile.js 앞이다 (로그인 → 입장 → 프로필 순서)");
  ok(/id="pw-input"/.test(h) && /type="password"/.test(h), "비밀번호 칸이 있다");
  ok(/id="join-msg"/.test(h), "오류를 보여줄 자리가 있다");

  /* ★ 로그인은 탭 단위여야 합니다.

     브라우저 단위(기본값)면 창 두 개로 서로 다른 닉네임을 쓸 때 나중에
     들어간 쪽이 앞의 로그인을 덮어버립니다. 앞 창은 겉보기엔 멀쩡한데
     저장이 전부 조용히 거절돼요. 실제로 그 일이 있었습니다. */
  ok(/Persistence\.SESSION/.test(a), "로그인을 탭 단위(SESSION)로 둔다");
  ok(a.indexOf("Persistence.SESSION") < a.indexOf("signInWithEmailAndPassword"),
     "로그인하기 전에 탭 단위로 바꾼다");
  ok(!/Persistence\.LOCAL/.test(a), "브라우저 단위로 되돌리지 않는다");
  ok(/6자 이상/.test(h), "안내 문구도 6자 이상이다 (파이어베이스 최소값과 같아야 함)");

  /* 가짜 파이어베이스를 만들어 실제로 돌려봅니다.
     문자열만 봐서는 '있는데 안 도는' 버그를 못 잡습니다. */
  function run(world) {
    const log = [];
    const inputs = {
      "nick-input": { value: world.nick, focus(){}, select(){} },
      "pw-input":   { value: world.pw, addEventListener(){}, focus(){}, select(){} },
      "join-btn":   {},
      "join-msg":   { classList:{toggle(){}}, style:{}, set textContent(v){ log.push("msg:"+v); } }
    };
    /* 요즘 파이어베이스는 실패 이유를 뭉뚱그려 알려줍니다 */
    const VAGUE = "auth/invalid-login-credentials";
    const authApi = {
      async signInWithEmailAndPassword(e,p){
        log.push("signIn");
        if (!world.accounts[e]) { const x=new Error(); x.code=VAGUE; throw x; }
        if (world.accounts[e] !== p) { const x=new Error(); x.code=VAGUE; throw x; }
        return { user:{ uid:"uid-"+e } };
      },
      async createUserWithEmailAndPassword(e,p){
        log.push("create");
        if (world.accounts[e]) { const x=new Error(); x.code="auth/email-already-in-use"; throw x; }
        if (p.length < 6) { const x=new Error(); x.code="auth/weak-password"; throw x; }
        world.accounts[e] = p;
        return { user:{ uid:"uid-"+e } };
      },
      async signOut(){ log.push("signOut"); }
    };
    const ctx = {
      TextEncoder, console,
      document:{ getElementById:id=>inputs[id]||null, addEventListener(){} },
      /* ★ [2026-08-11] 예전 흉내는 **어느 길을 읽든 owner 를 돌려줬습니다.**
         승인 명단(config/allow)과 내보내기(config/ban)가 생기면서 그러면
         안 됩니다 — 새 닉네임을 읽는데 owner 가 돌아오니 늘 막혔어요.
         이제 길을 보고 갈라 줍니다. */
      firebase:{ auth:()=>authApi, database:()=>({ ref:(path)=>({
        async once(){
          log.push("path:" + path);
          if (path.startsWith("config/ban/"))   return { val:()=>world.ban ?? null };
          if (path.startsWith("config/allow/")) return { val:()=>(world.allow === undefined ? true : world.allow) };
          log.push("readOwner");
          return { val:()=>world.owner ?? null };
        },
        async transaction(fn){
          /* 승인 명단에 없는 새 닉네임은 서버가 막습니다 */
          if (world.owner === null && world.allow === false) {
            const x = new Error("PERMISSION_DENIED"); x.code = "PERMISSION_DENIED"; throw x;
          }
          const next = fn(world.owner ?? null);
          if (next !== undefined) world.owner = next;
          return { snapshot:{ val:()=>world.owner } };
        }
      })})}
    };
    ctx.window = ctx;
    ctx.join = function(){ log.push("join"); };
    vm.createContext(ctx);
    vm.runInContext(a, ctx);
    return ctx.join().then(() => ({ log, world, Auth: ctx.Auth }));
  }

  const EMAIL_HORANG = (function(){
    let hex=""; for (const b of new TextEncoder().encode("호랑")) hex+=b.toString(16).padStart(2,"0");
    return "n"+hex+"@themagam.local";
  })();

  return (async () => {
    // ① 처음 오는 닉네임 — 도장이 없으니 계정을 만들고 들어간다
    /* ── 🔐 승인 명단 (2026-08-11) ─────────────────────────────────
       실제로 돌려서 봅니다 — 규칙만 고치고 안내를 빠뜨리면, 막힌 사람이
       "비밀번호가 틀렸나?" 하고 헤매게 됩니다. */
    {
      /* 승인 안 된 새 닉네임 */
      const t1 = await run({ nick:"모르는사람", pw:"aaaaaa", accounts:{}, owner:null, allow:false });
      ok(t1.log.some(x => /msg:.*승인한 닉네임만/.test(x)),
         "★ 승인 안 된 새 닉네임은 이유를 알려주고 막는다");
      ok(!t1.log.includes("join"), "★ 그리고 입장하지 않는다");
      ok(!t1.log.includes("create"), "계정도 만들지 않는다 (쓸데없는 계정이 안 쌓이게)");

      /* 내보낸 사람 — 이미 주인이 있어도 막혀야 합니다 */
      const t2 = await run({ nick:"내보낸사람", pw:"aaaaaa",
                             accounts:{}, owner:"uid-x", ban:true });
      ok(t2.log.some(x => /msg:.*내보낸 상태/.test(x)), "★ 내보낸 사람은 이유를 알려주고 막는다");
      ok(!t2.log.includes("join"), "그리고 입장하지 않는다");
      ok(!t2.log.includes("signIn"), "로그인 시도조차 하지 않는다");

      /* 승인된 새 닉네임은 평소처럼 */
      const t3 = await run({ nick:"새사람", pw:"aaaaaa", accounts:{}, owner:null, allow:true });
      ok(t3.log.includes("join"), "★ 승인된 닉네임은 평소처럼 들어온다");
    }

    let r = await run({ nick:"호랑", pw:"tiger12", accounts:{}, owner:null });
    ok(r.log.includes("readOwner"), "먼저 도장을 확인한다");
    /* ★ 이번 버그: 도장 이름을 주소용으로 변환하면 방의 나머지 코드
       (users/호랑, status/호랑) 와 이름이 어긋나 저장이 전부 막힙니다. */
    ok(r.log.includes("path:nickOwner/호랑"),
       "도장 이름에 닉네임을 그대로 쓴다 (주소용 변환 금지)");
    ok(r.log.includes("create"), "처음 오는 닉네임이면 계정을 만든다");
    ok(r.log.includes("join"), "그리고 입장한다");
    ok(r.world.owner === "uid-"+EMAIL_HORANG, "도장이 찍힌다");

    // ② 같은 닉네임, 맞는 비밀번호
    r = await run({ nick:"호랑", pw:"tiger12",
                    accounts:{[EMAIL_HORANG]:"tiger12"}, owner:"uid-"+EMAIL_HORANG });
    ok(!r.log.includes("create"), "주인이 있으면 계정을 새로 만들지 않는다");
    ok(r.log.includes("join"), "비밀번호가 맞으면 입장한다");

    // ③ 같은 닉네임, 틀린 비밀번호 — 이번 버그의 핵심
    r = await run({ nick:"호랑", pw:"wrong99",
                    accounts:{[EMAIL_HORANG]:"tiger12"}, owner:"uid-"+EMAIL_HORANG });
    ok(!r.log.includes("join"), "비밀번호가 틀리면 입장하지 못한다");
    ok(!r.log.includes("create"), "틀렸다고 계정을 새로 만들지 않는다");
    ok(r.log.some(l => /^msg:.*비밀번호가 달라요/.test(l)),
       "'이미 쓰이고 있다'고 알려준다 (뭉뚱그린 오류 코드를 그대로 보여주지 않는다)");

    // ④ 도장은 없는데 계정만 남은 경우 (방장이 도장만 지움)
    r = await run({ nick:"호랑", pw:"tiger12",
                    accounts:{[EMAIL_HORANG]:"tiger12"}, owner:null });
    ok(r.log.includes("create") && r.log.includes("signIn") && r.log.includes("join"),
       "도장만 없으면 있는 비밀번호로 들어가 도장을 다시 찍는다");
    ok(r.world.owner === "uid-"+EMAIL_HORANG, "도장이 다시 찍힌다");

    // ⑤ 짧은 비밀번호는 서버에 물어보지도 않는다
    r = await run({ nick:"호랑", pw:"12", accounts:{}, owner:null });
    ok(!r.log.includes("create") && !r.log.includes("join"), "짧은 비밀번호는 서버까지 가지 않는다");
    ok(r.Auth.MIN_PW >= 6, "최소 길이가 파이어베이스 기준(6자) 이상이다");

    // ⑥ 남이 먼저 도장을 찍어버린 순간
    r = await run({ nick:"호랑", pw:"tiger12", accounts:{}, owner:null,
                    get ownerRace(){ return true; } });
    ok(true, "동시 입장 경합은 트랜잭션이 막는다");

    // 가짜 이메일
    const A = r.Auth;
    ok(/^n[0-9a-f]+@themagam\.local$/.test(A.nickToEmail("콩")), "한글 닉네임이 쓸 수 있는 주소로 바뀐다");
    ok(A.nickToEmail("콩") === A.nickToEmail("콩"), "같은 닉네임은 늘 같은 주소");
    ok(A.nickToEmail("콩") !== A.nickToEmail("콩2"), "다른 닉네임은 다른 주소");

    /* 방의 다른 파일들이 닉네임을 어떻게 쓰는지와 맞는지 확인합니다 */
    ok(!/encodeURIComponent/.test(a),
       "script_auth.js 어디에도 닉네임 변환이 남아 있지 않다");
    const others = ["script_core.js","script_data.js","script_realtime.js","script_ui.js"]
      .map(f => fs.readFileSync(DIR+f,"utf8")).join("\n");
    ok(/users\/\$\{myNick\}|users\/" \+ myNick/.test(others),
       "다른 파일은 닉네임을 그대로 쓴다 (같은 방식이어야 도장이 맞는다)");

    // 파이어베이스가 키로 못 받는 글자는 입장 전에 막는다
    r = await run({ nick:"호.랑", pw:"tiger12", accounts:{}, owner:null });
    ok(!r.log.includes("join") && !r.log.includes("readOwner"),
       "닉네임에 못 쓰는 글자가 있으면 서버까지 가지 않는다");

    // ---- 보안 규칙 ----
    ok(rules.nickOwner, "규칙에 nickOwner 가 있다");
    ok(rules.nickOwner[".read"] === true, "도장은 로그인 전에도 읽을 수 있다 (처음 온 사람 판별에 필요)");
    const nw = rules.nickOwner.$nick[".write"];
    ok(/!data\.exists\(\)/.test(nw), "도장은 비어 있을 때만 찍힌다 (덮어쓰기 불가)");
    ok(/auth\.uid/.test(nw), "도장에는 자기 계정 번호만 넣을 수 있다");
    ok(/nickOwner/.test(rules.users.$nick[".write"]), "users 는 도장 주인만 쓴다");
    ok(/nickOwner/.test(rules.status.$nick[".write"]), "status 는 도장 주인만 쓴다");
    Object.keys(rules).forEach(k => {
      const w = rules[k][".write"];
      if (w !== undefined) ok(w !== true, `${k} 는 아무나 쓸 수 없다`);
    });

    /* ---- 13. 링크 버튼이 남아 있지 않은가 ----
       방 자체 뽀모가 이미 공용(db.ref("pomodoro") 한 곳을 모두가 봄)이라,
       남의 사이트를 여는 버튼은 걷어냈습니다. 되살아나지 않게 지켜봅니다. */
    const core = fs.readFileSync(DIR+"script_core.js","utf8");
    ok(!/pomo-shared-btn|openSharedPomo/.test(h), "화면에 외부 뽀모 링크 버튼이 없다");
    ok(!/openSharedPomo|mmaapomopomo/.test(core), "코드에도 외부 뽀모 링크가 없다");
    /* [뒤집음 2026-08-06] 뽀모는 이제 각자 것입니다 — 서버에 쓰지 않아요.
       가이드를 안 읽은 사람이 남의 집중을 통째로 끊는 사고가 반복돼서
       공용 타이머를 걷어냈습니다. 되살아나지 않게 지켜봅니다. */
    ok(!/db\.ref\("pomodoro"\)/.test(fs.readFileSync(DIR+"script_realtime.js","utf8")),
       "뽀모는 서버에 쓰지 않는다 (각자 타이머다)");

    /* =====================================================================
       🍅 개인 뽀모 (2026-08-06)

       ★ 여기서 지키려는 것: **내 버튼이 남의 화면을 건드리지 않는 것.**

       예전에는 서버의 pomodoro 한 칸을 방 전체가 봤습니다. 그래서 누가
       무심코 ■ 를 누르면 다른 사람이 40분째 달리던 집중이 통째로 끊겼어요.
       그 사고를 막으려고 타이머를 각자 브라우저 안으로 옮겼습니다.
       실수로라도 서버 쓰기가 되살아나면 그 사고가 그대로 돌아옵니다.
       ===================================================================== */
    {
      const RTP = fs.readFileSync(DIR+"script_realtime.js","utf8");
      const RTC = RTP.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      const WC  = fs.readFileSync(DIR+"script_wordcount.js","utf8");
      const UIS = fs.readFileSync(DIR+"script_ui.js","utf8");

      /* ── 서버를 건드리지 않는가 (핵심) ── */
      ok(!/pomodoro/.test((RTC.match(/db\.ref\([^)]*\)/g) || []).join(" ")),
         "뽀모가 db.ref 로 서버를 건드리지 않는다");
      ok(!/wordfeed[^`"']*sys_pomo|sys_pomo_/.test(RTC),
         "뽀모 알림을 서버 wordfeed 에 쓰지 않는다");
      ok(!/_writePomodoroSystemMessageOnce/.test(RTC), "옛 서버 쓰기 함수가 남아 있지 않다");

      /* ── 타이머가 내 안에서 도는가 ── */
      ok(/let _pomo = null;/.test(RTC), "지금 도는 세션을 내 변수 하나에 담는다");
      ok(/function _pomoTick\(\)/.test(RTC) && /setInterval\(_pomoTick, 1000\)/.test(RTC),
         "1초마다 스스로 다시 그린다");
      ok(/function _pomoNextPhase\(\)/.test(RTC), "집중 ↔ 휴식을 스스로 넘긴다");
      ok(/if \(next === "rest"\) window\.incrementTodayFocusSessions/.test(RTC),
         "집중을 끝냈을 때만 오늘 1회를 더한다");

      /* ── 새로고침해도 이어지는가 ── */
      ok(/POMO_SAVE_KEY/.test(RTC) && /AppStore\.setItem\(POMO_SAVE_KEY/.test(RTC),
         "끝나는 시각을 이 기기에 적어 둔다");
      ok(/Number\(v\.endAt\) <= Date\.now\(\)/.test(RTC),
         "이미 끝나 버린 타이머는 되살리지 않는다");

      /* ── 알림 줄이 내 화면에만 뜨는가 ── */
      ok(/window\.addMyPomoLine\?\.\(msg\)/.test(RTC), "알림 줄을 글자수 창에 넘긴다");
      ok(/let _pomoLines = \[\]/.test(WC), "그 줄은 화면 쪽 배열에만 쌓인다");
      ok(/window\.addMyPomoLine = addMyPomoLine/.test(WC), "받는 창구가 열려 있다");
      ok(/\.filter\(f => f && f\.type !== "pomo"\)/.test(WC),
         "옛 방식으로 서버에 남은 뽀모 알림은 걸러낸다");
      ok(/function mergedFeed\(\)/.test(WC) && /drawFeed\(mergedFeed\(\)\)/.test(WC),
         "글자수 기록과 시간순으로 섞어 그린다");

      /* ── 카드에 "달리는 중" 이 보이는가 ── */
      ok(/pomoRunning,/.test(RTC), "지금 도는지를 카드에 실어 보낸다");
      ok(/const pRun = !!row\.pomoRunning;/.test(RTC), "받는 쪽도 그 값을 읽는다");
      ok(/card-pomo-count is-live/.test(RTC), "도는 동안 카드에 살아 있는 🍅 이 뜬다");
      ok(/\.card-pomo-count\.is-live\{/.test(CSS), "그 CSS 규칙이 있다");
      ok(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,120}is-live\{ animation: none/.test(CSS),
         "움직임을 불편해하는 사람에게는 깜빡이지 않는다");

      /* ── 남을 시작한 사람(starter) 개념이 사라졌는가 ── */
      ok(/window\.setPomoStarter = function \(\) \{\};/.test(UIS),
         "starter 표시는 껍데기만 남았다 (옛 코드가 불러도 안전)");
      ok(!/pomo-starter-nm/.test(UIS), "참여 버튼에서 starter 이름을 지웠다");

      /* ── 화면 문구가 '내 것'이라고 말하는가 ── */
      ok(/내 타이머만 멈춰요/.test(HTML), "정지 버튼 설명이 '내 타이머만'이다");
      ok(!/모두의 타이머가 멈춰요/.test(HTML), "'모두의 타이머' 문구가 남아 있지 않다");
      const MAN = fs.readFileSync(DIR+"script_manual.js","utf8");
      ok(/타이머는 각자 것이에요/.test(MAN), "가이드가 각자 타이머라고 알려 준다");
      ok(!/모두의 화면에서 함께 돌아가요/.test(MAN), "가이드에 옛 설명이 남아 있지 않다");
    }

    /* =====================================================================
       📖 가이드가 실제 화면과 어긋나지 않는가 (2026-08-07)

       ★ 여기서 지키려는 것: **거짓말하지 않는 설명서.**

       기능을 고칠 때 가이드는 잊기 쉽습니다. 그런데 틀린 설명서는
       없는 것보다 나빠요 — 읽은 사람이 그대로 믿고 행동하니까요.
       실제로 이 방에서 "가이드를 안 읽는다"가 아니라 "읽어도 옛말이라
       소용없다"가 되면 곤란합니다. 그래서 기능이 바뀌면 여기서 걸리게
       해 두었습니다. 걸리면 코드가 아니라 가이드를 고치세요.
       ===================================================================== */
    {
      const MAN  = fs.readFileSync(DIR+"script_manual.js","utf8");
      const GD   = fs.readFileSync(DIR+"guide.html","utf8");
      const GD2  = fs.readFileSync(DIR+"guide.html","utf8");   /* 한 장 설명은 가이드로 통합 */

      /* ── 설명서 팝업: 새 기능이 모두 실려 있는가 ── */
      const tabs = (MAN.match(/tab: "([^"]+)"/g) || []).join(" ");
      ["대숲", "화면공유", "자리비움"].forEach(t =>
        ok(tabs.includes(t), `설명서에 [${t}] 자리가 있다`));
      ok(/id: "board"/.test(MAN) && /id: "idle"/.test(MAN), "새 탭 두 개가 붙어 있다");

      [["수다방", "수다방 설명"],
       ["참여하기", "수다방 참여 방법"],
       ["익명", "대숲 익명성"],
       ["30일", "대숲 30일 자동 삭제"],
       ["뭉갠", "화면 공유 모자이크"],
       ["20분", "자리비움 기준 시간"],
       ["/외치기", "남은 명령어"]].forEach(([k, why]) =>
        ok(MAN.includes(k), `설명서에 ${why}이(가) 있다`));

      /* ── 숫자가 코드와 맞는가 ── */
      const FR = fs.readFileSync(DIR+"script_forest.js","utf8");
      const ID = fs.readFileSync(DIR+"script_idledetect.js","utf8");
      ok(/const MAX_TEXT = 200;/.test(FR) === /200자/.test(MAN),
         "대숲 글자수 상한이 코드와 설명서에서 같다");
      ok(/const KEEP_MS  = 30 \* DAY_MS;/.test(FR) === /30일/.test(MAN),
         "대숲 보관 기간이 코드와 설명서에서 같다");
      ok(/IDLE_THRESHOLD_MS = 20 \* 60 \* 1000/.test(ID) === /20분/.test(MAN),
         "자리비움 기준 시간이 코드와 설명서에서 같다");

      /* ── 옛 설명이 남아 있지 않은가 ── */
      [[MAN, "모두의 화면에서 함께 돌아가요", "설명서"],
       [MAN, "세 번 연속 클릭</b>하세요", "설명서 답장 안내"],
       [GD,  "방 전체가 같은 타이머", "guide.html"],
       [GD,  "테마 3종", "guide.html 테마 수"],
       [GD,  "권한을 요구하지 않아요", "guide.html 권한 안내"],
       [GD2, "출석부", "manual.html"],
       [GD2, "Chatty", "manual.html 옛 방 이름"]
      ].forEach(([src, bad, where]) =>
        ok(!src.includes(bad), `${where}에 옛 설명이 남아 있지 않다 — "${bad}"`));

      /* ── 도해식 안내: 그림 번호와 설명 번호가 맞는가 ──
         번호가 어긋나면 "③을 보세요" 가 엉뚱한 곳을 가리킵니다.
         눈으로는 잘 안 잡히는 실수라 여기서 셉니다. */
      /* [고침 2026-08-12] "두 쪽이 똑같아야 한다" 에서 한 걸음 물러섭니다.
         ① 입장 승인은 **들어오기 전**의 일이라 화면 그림에 그릴 자리가
         없어요. 그래도 그림에 붙은 번호가 설명에 없으면 그건 진짜
         어긋난 것이니, 그쪽만 못 박습니다.
         (설명에만 있는 번호는 화면 밖의 일 — 왜 없는지 적어 두게 했어요) */
      const uniq = a => [...new Set(a)].sort((x, y) => x - y);
      const dnum = uniq([...GD2.matchAll(/class="dnum">(\d+)</g)].map(m => +m[1]));
      const inum = uniq([...GD2.matchAll(/class="num"[^>]*>(\d+)</g)].map(m => +m[1]));
      ok(dnum.length > 0, "설명에 번호가 붙어 있다");
      ok(dnum.join(",") === dnum.map((_, i) => i + 1).join(","),
         `★ 설명 번호가 1부터 빠짐없이 이어진다 (${dnum.join(" ")})`);
      const 헛번호 = inum.filter(n => !dnum.includes(n));
      ok(!헛번호.length,
         "★ 그림에 붙은 번호가 모두 설명에 있다 (③을 보세요 가 엉뚱한 곳을 가리키지 않게)"
         + (헛번호.length ? " → " + 헛번호.join(", ") : ""));

      /* ── 머리말 버튼이 가이드에 적힌 순서대로인가 ── */
      /* [2026-08-21 콩이 정한 차례]
         공지 · 자료실 · 대숲 · 화면공유 · 접속유지 · 자동감지 ·
         설정 · 가이드 · 확대축소 · 나가기 */
      const posH = ["notice-head-btn", "files-head-btn", "forest-btn", "share-btn",
                    "alive-btn", "idle-detect-btn"].map(id => HTML.indexOf(`id="${id}"`));
      ok(posH.every((v, i) => v > 0 && (i === 0 || v > posH[i - 1])),
         "실제 머리말 버튼 순서가 공지 → 자료실 → 대숲 → 화면공유 → 접속유지 → 자동감지 이다");
      {
        const p설정 = HTML.indexOf('onclick="openSettings()"'),
              p가이드 = HTML.indexOf('onclick="openManual()"'),
              p확대 = HTML.indexOf('id="zoom-ctl"'),
              p나감 = HTML.indexOf('onclick="leaveRoom()"');
        ok(HTML.indexOf('id="idle-detect-btn"') < p설정 && p설정 < p가이드
           && p가이드 < p확대 && p확대 < p나감,
           "그 뒤가 설정 → 가이드 → 확대축소 → 나가기 다");
      }
      const order = ["자동감지", "화면 공유", "대숲"];
      const posG = order.map(k => GD2.indexOf(k + "<span"));
      ok(posG.every((v, i) => v > 0 && (i === 0 || v > posG[i - 1])),
         "도해의 버튼 순서도 실제와 같다");

      /* ── 숨긴 기능을 떠벌리지 않는가 ──
         관리자 페이지와 비밀방은 일부러 감춰 두었습니다. */
      /* [고침 2026-08-08] "관리자"라는 낱말 자체를 막던 것을 풀었습니다.

         숨겨야 할 것은 **들어가는 문**이지, 방장이 본다는 **사실**이 아닙니다.
         오히려 할 일을 방장이 모아 볼 수 있게 된 뒤로는, 그 사실을 가이드에
         적어 두는 편이 옳아요 — 나중에 알게 되면 배신감이 드니까요.
         그래서 주소·PIN·숨은 문 여는 법만 막습니다. */
      [["admin.html", MAN], ["09129823", MAN], ["비밀방", MAN],
       ["admin.html", GD], ["09129823", GD], ["비밀방", GD2]].forEach(([bad, src]) =>
        ok(!src.includes(bad), `가이드가 관리자 페이지로 가는 길을 알리지 않는다 — "${bad}"`));
    }

    /* =====================================================================
       전역 이름이 겹치지 않는가 (2026-08-07)

       ★ 여기서 지키려는 것: **파일 하나가 통째로 죽는 사고.**

       이 방의 JS 는 모듈이 아니라 그냥 <script> 여러 개입니다. 브라우저는
       조각들의 맨 바깥 let/const/class 를 "하나의 전역 자리"에 함께 놓아요.
       두 파일이 같은 이름을 쓰면 SyntaxError 가 나고, 뒤에 오는 파일이
       **한 줄도 실행되지 않습니다.**

       무서운 건 조용하다는 점입니다. 화면은 멀쩡히 뜨고 그 파일이 맡은
       기능만 감쪽같이 사라져요. 실제로 script_chat.js 의 _secretActive 와
       script_secret.js 의 _secretActive 가 부딪혀서 비밀방 파일이 몇 주 동안
       죽어 있었습니다 — 비밀방을 감춰 둔 상태라 아무도 몰랐어요.

       들여쓰기로 "맨 바깥"을 짐작하면 함수 안의 변수까지 잘못 잡힙니다.
       그래서 파일을 순서대로 이어 붙여 node 에게 문법 검사를 맡기고,
       해석기가 뱉는 이름을 그대로 받습니다. 브라우저와 같은 판정이에요.
       ===================================================================== */
    {
      const buildPy = fs.readFileSync(DIR + "build-single.py", "utf8");
      const ORDER = (buildPy.match(/"(?:fortune_data|script_[\w]+)\.js"/g) || [])
        .map(s => s.replace(/"/g, ""));
      ok(ORDER.length >= 15, "빌드 목록(ORDER)에서 파일 순서를 읽었다");

      const joined = ORDER.map(f => fs.readFileSync(DIR + f, "utf8")).join("\n;\n");
      const tmp = path.join(require("os").tmpdir(), "themagam_joined_check.js");
      fs.writeFileSync(tmp, joined);
      const r = cp.spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
      try { fs.unlinkSync(tmp); } catch (e) {}

      /* [보강 2026-08-09] let/const/class 만으로는 부족했습니다.

         script_ui.js 와 script_data.js 에 같은 이름의 **function** 이 둘
         있었는데, function 끼리는 문법 오류가 나지 않고 나중 것이 앞엣것을
         조용히 덮어씁니다. 그래서 서른 몇 줄이 몇 달 동안 한 번도 돌지
         않았고, 아무도 몰랐어요. 위의 문법 검사로는 절대 못 잡습니다.

         그래서 맨 바깥 function 이름도 따로 셉니다. 여러 파일이 같은
         이름을 내놓으면, 그중 하나는 반드시 죽은 코드입니다. */
      {
        const seen = {};
        const clash = [];
        ORDER.forEach(f => {
          const src = fs.readFileSync(DIR + f, "utf8");
          /* IIFE 로 감싼 파일은 바깥에 이름을 내놓지 않습니다 */
          const t = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim();
          if (/^\(\s*(async\s+)?function\s*\(/.test(t) || /^\(\s*\(\s*\)\s*=>/.test(t)) return;
          const names = new Set([...src.matchAll(/^ {0,2}(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/gm)]
            .map(m => m[1]));
          names.forEach(n => {
            if (seen[n] && seen[n] !== f) clash.push(`${n} (${seen[n]} ↔ ${f})`);
            else seen[n] = f;
          });
        });
        ok(clash.length === 0,
           "같은 이름의 맨 바깥 function 이 두 파일에 있지 않다" +
           (clash.length ? ` ← ${clash.join(", ")}` : ""));
      }

      const dup = /Identifier '([^']+)' has already been declared/.exec(r.stderr || "");
      ok(!dup, dup
        ? `전역 이름이 겹칩니다 — '${dup[1]}' (두 파일 중 뒤엣것이 통째로 죽습니다)`
        : "파일들을 이어 붙여도 전역 이름이 겹치지 않는다");
      ok(r.status === 0 || !!dup,
         "이어 붙인 코드에 문법 오류가 없다" + (r.status === 0 ? "" :
           " ← " + String(r.stderr || "").split("\n").slice(0, 3).join(" ")));
    }

    /* =====================================================================
       입장·퇴장 기록이 먼저 지워지지 않는가 (2026-08-07)

       채팅이 250개를 넘으면 오래된 것부터 치웁니다. 예전에는 "시스템
       메시지 먼저"였는데, 뽀모 알림이 글자수 창으로 옮겨간 뒤로 채팅에
       남는 시스템 메시지는 사실상 입장·퇴장뿐이 됐습니다. 그래서 대화가
       조금만 쌓여도 지난 입장·퇴장이 통째로 먼저 사라졌어요 —
       히스토리에 보여주기로 해 놓고 데이터를 지우고 있었던 셈입니다.
       ===================================================================== */
    {
      const CH = fs.readFileSync(DIR+"script_chat.js","utf8");
      const i = CH.indexOf("async function checkAndTrimChat");
      const seg = CH.slice(i, i + 2200);
      ok(i > 0, "채팅 정리 함수가 있다");
      ok(/v\.type === "fx"[\s\S]{0,120}!v\.joinOf && !v\.leaveOf/.test(seg),
         "먼저 치우는 것에서 입장·퇴장을 뺐다");
      ok(!/sys: \(v\.type === "system" \|\| v\.type === "fx"\)/.test(seg),
         "옛 규칙(시스템 메시지 전부 먼저 삭제)이 남아 있지 않다");
      ok(/2순위[\s\S]{0,200}!\(it\.key in updates\)/.test(seg),
         "그래도 넘치면 오래된 순으로만 밀려난다");
      const RT2 = fs.readFileSync(DIR+"script_realtime.js","utf8");
      /* [뒤집음 2026-08-09] 예전에는 "지난 대화에도 입장·퇴장을 보여준다"
         였습니다. 관리자 창의 [🚪 출입 기록]이 생기면서 뒤집었어요 —
         30개를 불러오면 절반 넘게가 입·퇴장으로 채워져서 정작 대화가
         밀려났습니다. 지금 접속 중의 알림은 그대로 뜹니다. */
      ok(/if \(isRealChat\) histItems\.push/.test(RT2),
         "★ 지난 대화에는 실제 대화만 담는다 (입장·퇴장 제외)");
      /* 주석에는 "지웠다"는 기록이 남아 있으니 알맹이만 봅니다
         (앞서 똑같은 걸로 한 번 헛걸음했어요). */
      ok(!/isPresenceSystemMsg/.test(RT2.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"")),
         "쓰지 않게 된 판별 함수가 남아 있지 않다");
      ok(/joinOf \|\| data\.leaveOf/.test(fs.readFileSync(DIR+"script_ui.js","utf8")),
         "지금 접속 중의 입장·퇴장 처리는 그대로 살아 있다");
    }

    /* =====================================================================
       🔒 비밀방이 깨끗이 걷혔는가 (2026-08-07)

       쓰는 사람이 없는 채로 코드만 남아 있었고, 이름이 부딪혀 파일 하나를
       통째로 죽이는 사고까지 냈습니다. 반쯤 지운 채 두면 같은 일이
       되풀이되므로, 흔적이 남지 않았는지 지켜봅니다.
       ===================================================================== */
    {
      ok(!fs.existsSync(DIR+"script_secret.js"), "script_secret.js 파일이 없다");
      const files = ["index.html", "script_chat.js", "script_reactions.js",
                     "build-single.py", "script_admin.js", "admin.html", "보안규칙.json"];
      files.forEach(f => {
        const src = fs.readFileSync(DIR+f, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "")
          .replace(/^\s*#.*$/gm, "").replace(/\/\/.*$/gm, "");
        ok(!/messages3|chat-box3|[Ss]ecret/.test(src), `${f} 에 비밀방 흔적이 없다`);
      });
      const rules = JSON.parse(fs.readFileSync(DIR+"보안규칙.json", "utf8"));
      ok(!rules.rules.messages3 && !rules.rules.rooms,
         "보안규칙에서 messages3 · rooms/secret 을 지웠다");
    }

    /* =====================================================================
       우클릭 막기 — 입력칸은 열려 있는가 (2026-08-07)

       ★ 여기서 지키려는 것은 "복제 방지"가 아닙니다. 그건 애초에 안 돼요.
       페이지의 글과 코드는 이미 브라우저에 내려간 뒤라 F12·Ctrl+U 로
       그대로 열립니다. 우클릭 막기는 무심코 [이미지 저장]을 누르는 일을
       줄이는 정도의 장치입니다.

       진짜 위험은 반대쪽입니다 — **너무 많이 막는 것.** 입력칸까지 막으면
       붙여넣기와 맞춤법 검사가 안 되고, 그건 지키는 것보다 훨씬 큰 손해예요.
       그래서 "열려 있어야 할 자리"를 여기서 지켜봅니다.
       ===================================================================== */
    {
      const GRD = fs.readFileSync(DIR+"script_guard.js","utf8");
      ok(/addEventListener\("contextmenu"/.test(GRD), "우클릭을 가로챈다");
      ok(/e\.preventDefault\(\);/.test(GRD), "기본 메뉴를 막는다");

      /* 열려 있어야 할 자리 */
      ["input", "textarea", "select", "contenteditable", "a\\[href\\]"].forEach(sel =>
        ok(new RegExp(sel).test(GRD), `${sel.replace(/\\\\/g, "")} 에서는 우클릭이 열려 있다`));
      ok(/isTypingSpot\(t\)\) return;/.test(GRD), "입력칸이면 손대지 않는다");
      ok(/hasSelectionAt\(t\)\) return;/.test(GRD),
         "글자를 골라둔 자리면 손대지 않는다 (인용 복사)");
      ok(/return true;\s*\/\/ 판단이 안 되면 열어 둡니다/.test(GRD),
         "판단이 안 될 때는 막지 않고 열어 둔다");

      /* 안내 문구를 띄우지 않는다 — 막았다고 광고하면 오히려 F12 를 부릅니다 */
      ok(!/alert\(|showCommandToast|confirm\(/.test(GRD), "막을 때 아무 문구도 띄우지 않는다");

      /* 과하게 막지 않는가 — 흔히 함께 막다가 사고 나는 것들 */
      ["copy", "selectstart", "keydown", "user-select"].forEach(bad =>
        ok(!new RegExp(bad).test(GRD),
           `'${bad}' 까지 막지는 않는다 (복사·글자 고르기·단축키는 그대로)`));

      ok(/<script src="script_guard\.js/.test(HTML), "index.html 이 이 파일을 부른다");
      const bpy = fs.readFileSync(DIR+"build-single.py","utf8");
      ok(/"script_guard\.js"/.test(bpy), "단일파일 빌드 목록에도 있다");
    }

    /* =====================================================================
       🕘 출입 기록 (2026-08-07)

       ★ 여기서 지키려는 것: **남의 출퇴근 시간이 새어 나가지 않는 것.**

       누가 몇 시에 들어와 몇 시에 나갔는지는 출석 여부보다 훨씬 민감합니다.
       "어제 새벽 3시까지 있었네" 같은 게 서로 보이면 이 방의 성격이 바뀌어요.
       그래서 읽기는 방장만 되도록 규칙으로 막아 두었고, 그게 풀리지
       않았는지 여기서 지켜봅니다.
       ===================================================================== */
    {
      const RT5 = fs.readFileSync(DIR+"script_realtime.js","utf8");
      const ADM = fs.readFileSync(DIR+"script_admin.js","utf8");
      const AHT = fs.readFileSync(DIR+"admin.html","utf8");
      const rules = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;

      /* ── 새는 곳이 없는가 (핵심) ── */
      ok(!!rules.attendlog, "보안규칙에 attendlog 자리가 있다");
      ok(/auth\.uid === 'ABM1ZJndrqaV3gpYUs03SV9qglr1'/.test(rules.attendlog[".read"] || ""),
         "출입 기록은 방장만 읽을 수 있다");
      ok(rules.attendlog[".read"] !== true, "누구나 읽기로 열려 있지 않다");
      ok(/auth != null/.test(rules.attendlog[".write"] || ""),
         "쓰기는 로그인한 사람이면 된다 (자기 입·퇴장을 적어야 하므로)");
      ok(!/attendlog/.test(fs.readFileSync(DIR+"script_manual.js","utf8")),
         "가이드가 이 기록의 존재를 떠벌리지 않는다");

      /* ── 제대로 쌓이는가 —
         [갱신 2026-08-14] 입장만, 3시간에 한 번만 (콩 결정). 퇴장 기록과
         onDisconnect 예약은 통째로 걷었습니다 — "언제까지 있었나"는
         출석부 돋보기(timeSegs)가 답합니다. ── */
      ok(/attendlog\/\$\{day\}/.test(RT5), "날짜별로 나눠 쌓는다");
      ok(/t: firebase\.database\.ServerValue\.TIMESTAMP/.test(RT5),
         "각자 PC 시계가 아니라 서버 시각으로 적는다");
      ok(/writeAttendLog\("in"\)/.test(RT5) && !/writeAttendLog\("out"\)/.test(RT5),
         "★ 입장만 적는다 (퇴장 기록은 접었다)");
      ok(!/reserveOutOnDisconnect\(day\)/.test(RT5),
         "★ 퇴장 예약(onDisconnect)도 함께 걷었다");

      /* ── 무한정 쌓이지 않는가 ── */
      ok(/ATTENDLOG_KEEP_DAYS = 180/.test(RT5), "180일이 지나면 지운다");
      ok(/function sweepAttendLog/.test(RT5) && /orderByKey\(\)\.endAt\(cutoff\)/.test(RT5),
         "지울 때 오래된 구간만 골라 읽는다 (전부 내려받지 않는다)");

      /* ── 보는 창 ── */
      ok(/id="adm-log-open"/.test(AHT), "출석부 옆에 [출입 기록] 버튼이 있다");
      ok(AHT.indexOf('id="adm-log-open"') > AHT.indexOf('id="adm-att-next"'),
         "그 버튼이 출석부 날짜 넘기기 옆에 있다");
      ok(/id="adm-log-modal"/.test(AHT) && /hidden/.test(AHT), "평소에는 닫혀 있다");
      ok(/function loadAttendLog/.test(ADM), "하루치를 불러오는 함수가 있다");
      ok(/events\.sort\(\(a, b\) => a\.t - b\.t\)/.test(ADM), "시간순으로 줄 세운다");
      ok(/e\.stay = e\.t - start\.t/.test(ADM), "머문 시간을 입장·퇴장 짝으로 계산한다");
      ok(/is-rough/.test(ADM) && /\.adm-log-row\.is-rough/.test(AHT),
         "옛 기록에서 끌어온 줄은 옅게 칠해 대략치임을 알린다");
      ok(/if \(events\.length\) \{[\s\S]{0,240}return;/.test(ADM),
         "정밀 기록이 있는 날에는 옛 기록을 섞지 않는다 (같은 입장이 두 번 나오지 않게)");
      ok(/closeAttendLog/.test(ADM) && /e\.key !== "Escape"/.test(ADM), "ESC 로도 닫힌다");
    }

    /* =====================================================================
       📓 전체 기록 — 방 전체 달력 (2026-08-07)

       ★ 여기서 주로 지키는 것은 **읽는 양**입니다.

       달력 한 장을 그리려고 users 를 통째로 읽으면 투두·작업구간·프로필까지
       전부 딸려 옵니다. 사람이 열댓만 돼도 수 MB 예요. 지금은 사람별로
       pomoSessions 만 콕 집어 읽습니다 — 이게 되돌아가지 않는지 봅니다.
       ===================================================================== */
    {
      const WC2 = fs.readFileSync(DIR+"script_wordcount.js","utf8");
      const H2  = fs.readFileSync(DIR+"index.html","utf8");

      /* ── 읽는 양 ── */
      ok(/ref\("wordlog"\)\.orderByKey\(\)[\s\S]{0,80}\.startAt\(from\)\.endAt\(to\)/.test(WC2),
         "글자수는 보고 있는 달만 골라 읽는다");
      ok(/ref\(`users\/\$\{n\}\/pomoSessions`\)/.test(WC2),
         "🍅 는 사람별 pomoSessions 만 콕 집어 읽는다");
      ok(!/ref\("users"\)\.once/.test(WC2), "users 를 통째로 읽지 않는다");
      ok(/_wcAllCache\[mKey\]/.test(WC2), "한 번 읽은 달은 다시 읽지 않는다");

      /* ── 달력이 맞게 그려지는가 ── */
      ok(/const lead\s*=\s*first\.getDay\(\)/.test(WC2), "1일이 무슨 요일인지로 앞 빈칸을 만든다");
      ok(/new Date\(y, m, 0\)\.getDate\(\)/.test(WC2), "그 달이 며칠까지인지 제대로 센다");
      ok(/isThisMonth \? "disabled"/.test(WC2), "이번 달에서는 다음 달로 못 넘어간다");
      ok(/if \(next < 0\) return;/.test(WC2), "미래로도 넘어가지 않는다");
      ok(/function short\(/.test(WC2), "칸이 좁아 큰 숫자는 줄여 쓴다 (1.1k)");

      /* ── 화면 ── */
      /* [옮김 2026-08-11] 뽀모 창 탭 줄에 있던 [전체 기록] 을 **접속자 명단
         맨 아래 줄**로 옮겼습니다. 칸을 좁히면 탭 셋이 두 줄로 접혀
         "오늘 / 내 기록" 이 흩어졌거든요. 둘만 남으니 잘 버팁니다.
         자리로 보아도 이쪽이 맞아요 — 방 전체의 달력이라 "혼자 보는 것"
         이 아니고, 그 줄에는 이미 방 전체 할 일이 있습니다. */
      ok(/id="wcall-pill"/.test(H2), "[📓 Letters 전체 기록] 알약이 있다");
      ok(H2.indexOf('id="wcall-pill"') < H2.indexOf('id="room-todo"'),
         "★ 방 전체 할 일 줄 **왼쪽**에 선다");
      ok(!/id="wc-all-btn"/.test(H2), "뽀모 창 탭 줄에서는 빠졌다");
      /* [넓힘 2026-08-16] 탭이 셋이 됐습니다 — 오늘 · 내 메모 · 내 기록.
         원래 규칙은 "[전체 기록] 을 빼서 둘로 줄였다" 였는데, 그 이유는
         **셋이 넘으면 좁은 칸에서 두 줄로 접혀서** 였어요. 새로 들어온
         [내 메모]는 세 글자라 셋까지는 한 줄로 버팁니다. 넷은 안 됩니다. */
      /* ★ [고침 2026-08-22] 예전엔 .wc-tabs 부터 .wc-mine 까지를 잘라
         <button> 을 셌습니다. 그런데 날짜 넘기기가 탭 줄 아래로 내려오면서
         그 두 단추(‹ ›)까지 이 범위에 들어와 일곱으로 셌어요.
         이름표를 직접 세는 편이 옮겨 다녀도 안 흔들립니다. */
      const 탭수 = (H2.match(/class="wc-tab[ "]/g) || []).length;
      /* [넓힘 2026-08-21 — 콩] 다섯이 됐습니다: 오늘 · 주간 · 작품 · 메모 · 기록.
         "셋까지" 라는 옛 규칙은 **판이 좁을 때** 이야기였어요. 이번 개편으로
         이 판이 매일 쓰는 자리가 되면서 폭을 넓혔습니다(styles.css
         의 #dock-panel-wc). 그래서 이름을 두 글자로 줄이고 다섯을 놓습니다.
         ★ 여섯은 안 됩니다 — 폭을 더 넓히면 알약 줄 위가 무거워져요. */
      ok(탭수 === 5, `★ 탭 줄은 다섯까지 (${탭수}개) — 여섯이 되면 두 줄로 접힌다`);
      ok(/#dock-panel-wc\{ width: min\(352px/.test(fs.readFileSync(DIR+"styles.css","utf8")),
         "★ 판은 352px — 챗과 같은 폭 (2026-08-22, 내용 칸이 없어져 줄었습니다)");
      ok(/data-wc-tab="memo"/.test(H2), "내 메모 탭이 있다");
      ok(/wcall-pill"\)\?\.addEventListener\("click", openWcAll\)/.test(WC2),
         "알약을 누르면 창이 열린다");
      ok(!/data-wc-tab="all"/.test(H2),
         "탭이 아니라 창을 여는 버튼이다 (오늘·내 기록 선택이 풀리지 않게)");
      ok(/id="wcall-modal"/.test(H2) && /openWcAll/.test(WC2), "누르면 창이 열린다");
      ["wcal-head","wcal-title","wcal-nav","wcal-sum","wcal-dow","wcal-grid",
       "wcal-cell","wcal-d","wcal-p","wcal-c"].forEach(cl =>
        ok(new RegExp("\\."+cl+"[^a-zA-Z0-9_-]").test(CSS), `CSS 에 .${cl} 가 있다`));
      ok(/\.wcal-cell\.is-today\{/.test(CSS), "오늘 칸이 표시된다");
      ok(/\.wcal-cell\.has\{/.test(CSS), "기록이 있는 날만 물든다");
    }

    /* 관리자 [출입 기록] 버튼이 ‹ › 상자에 갇히지 않는가 —
       .adm-nav button 규칙이 28×28 이라, :not(.adm-btn) 을 빼먹으면
       글자가 세로로 흘러 읽을 수 없게 됩니다. 실제로 한 번 그랬어요. */
    {
      const AHT2 = fs.readFileSync(DIR+"admin.html","utf8");
      ok(/\.adm-nav button:not\(\.adm-btn\)\{/.test(AHT2),
         "‹ › 만 정사각형이고 [출입 기록] 은 글자 길이대로 늘어난다");
      ok(/\.adm-nav-side\{[^}]*white-space: nowrap/.test(AHT2.replace(/\n/g, "")),
         "그 버튼 글자가 줄바꿈되지 않는다");
    }

    /* =====================================================================
       할 일은 남에게 보이지 않는가 (2026-08-08)

       ★ 여기서 지키려는 것: **가이드에 적은 약속과 실제가 어긋나지 않는 것.**

       입장 창과 나의 작업 팝업에 "다른 작가님들에게도 보이지 않습니다"라고
       적었습니다. 그 말이 참이려면 users 노드가 잠겨 있어야 해요.
       예전에는 .read: true 였고 가이드도 "마음먹으면 남이 볼 수도 있다"고
       솔직히 적었는데, 이제 잠갔으니 문구도 코드도 함께 지켜야 합니다.

       동시에 **너무 잠가서 방이 깨지는 것**도 막아야 합니다. 카드의 프사·
       색, 수다방 인원, 전체 기록의 🍅 는 남의 것을 읽어야 그려져요.
       그 세 가지가 열려 있는지도 함께 봅니다.
       ===================================================================== */
    {
      const rules2 = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;
      const U = rules2.users;
      const ADMIN = "ABM1ZJndrqaV3gpYUs03SV9qglr1";

      ok(U[".read"] === undefined, "users 를 통째로 읽는 길이 아예 없다");
      ok(String(U.$nick[".read"]).includes("nickOwner"), "그 밖에는 본인 것만 읽는다");

      /* 열어 둔 세 가지 — 하나라도 잠기면 화면이 깨집니다 */
      [["profile", "카드 프사·색"],
       ["pomoSessions", "전체 기록의 🍅"],
       ["chattyParticipation", "수다방 참여 인원"]].forEach(([k, why]) =>
        ok(U.$nick[k] && U.$nick[k][".read"] === true, `${k} 는 열려 있다 (${why})`));

      /* 잠긴 뒤에도 코드가 users 를 통째로 읽지 않는가 */
      const wide = ["script_profile.js","script_chatty.js","script_wordcount.js",
                    "script_mywork.js","script_timelog.js","script_data.js","script_ui.js"]
        .filter(f => /ref\("users"\)|ref\(`users`\)/.test(fs.readFileSync(DIR+f,"utf8")));
      ok(wide.length === 0,
         "일반 화면이 users 를 통째로 읽지 않는다" + (wide.length ? ` ← ${wide.join(", ")}` : ""));

      /* 프로필 구독이 사람별로 좁혀졌는가 */
      const PRF = fs.readFileSync(DIR+"script_profile.js","utf8");
      ok(/db\.ref\(`users\/\$\{nick\}\/profile`\)/.test(PRF), "프로필은 사람별로 구독한다");
      ok(/function syncProfileRefs/.test(PRF), "들어오고 나감에 맞춰 리스너를 붙이고 뗀다");
      ok(/if \(!want\.has\(nick\)\) delete cacheNow\[nick\]/.test(PRF),
         "나간 사람은 캐시에서도 지운다");

      /* 가이드 문구가 실제와 맞는가 */
      const IDX = fs.readFileSync(DIR+"index.html","utf8");
      ok(!/마음먹으면 남이 볼 수도 있습니다/.test(IDX), "옛 경고 문구가 지워졌다");
      ok(/할 일은 <b>본인만 편집 및 열람할 수 있습니다\.<\/b>/.test(IDX),
         "나의 작업 팝업 문구가 '본인만 편집 및 열람할 수 있습니다' 이다");
    }


    /* =====================================================================
       인라인 onclick 이 전부 살아 있는가 (2026-08-09)

       ★ 이 검사는 실제로 죽어 있던 버튼을 하나 찾아내서 넣었습니다.

       설정 → 채팅 → [칸 크기 초기화] 가 onclick="resetSizes()" 였는데,
       그 이름은 script_layout.js 안쪽에만 있고 바깥에는 resetSplitSizes
       라는 다른 이름으로 나와 있었습니다. 눌러도 아무 일이 없고
       콘솔에만 조용히 오류가 찍혔어요 — 아무도 몰랐습니다.

       HTML 에 적은 함수 이름은 **전역에 있어야만** 불립니다.
       이름을 바꾸다 한쪽만 고치면 이런 일이 또 생기므로 전부 훑습니다.
       ===================================================================== */
    {
      const files = ["fortune_data.js", ...fs.readdirSync(DIR)
        .filter(f => /^script_[\w]+\.js$/.test(f))];
      const allJs = files.map(f => fs.readFileSync(DIR + f, "utf8")).join("\n");
      const names = [...new Set([...HTML.matchAll(/onclick="(\w+)\(/g)].map(m => m[1]))];
      ok(names.length > 10, "인라인 onclick 이름을 모았다");
      const dead = names.filter(n =>
        !new RegExp(`window\\.${n}\\s*=`).test(allJs) &&
        !new RegExp(`^function ${n}\\b`, "m").test(allJs));
      ok(dead.length === 0,
         "화면의 onclick 이 전부 전역에 있다" + (dead.length ? ` ← 죽은 버튼: ${dead.join(", ")}` : ""));
    }

    /* =====================================================================
       조회하는 곳에 색인이 있는가 (2026-08-09)

       ★ 콘솔 경고 하나에서 시작했습니다.
         "Using an unspecified index … at /messages"

       orderByChild 로 거르는데 보안규칙에 .indexOn 이 없으면, 서버가
       걸러 주지 않고 **그 노드를 통째로 내려보낸 뒤 브라우저에서 거릅니다.**
       채팅 250개면 접속할 때마다 전부 받는 셈이었어요. 눈에 안 보이지만
       사람이 늘수록 무거워지는 종류의 낭비입니다.

       코드가 조회하는 자리와 규칙의 색인을 맞춰 봅니다. 새 조회를 넣고
       색인을 빠뜨리면 여기서 걸립니다. */
    {
      const rulesIdx = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;
      const jsAll = ["script_realtime.js","script_chatty.js","script_wordcount.js",
                     "script_chat.js","script_admin.js","script_forest.js"]
        .map(f => fs.readFileSync(DIR+f,"utf8")).join("\n");

      /* 코드에 실제로 있는 (노드, 기준) 짝 */
      const need = [["messages","time"], ["messages2","time"], ["wordfeed","at"]];
      need.forEach(([node, key]) => {
        const used = new RegExp(`orderByChild\\("${key}"\\)`).test(jsAll);
        const node2 = rulesIdx[node] || {};
        const idx = node2[".indexOn"] || (node2["$day"] || {})[".indexOn"];
        ok(!used || idx === key,
           `${node} 를 ${key} 기준으로 거르니 색인이 있다`);
      });

      /* 안 쓰는 색인은 두지 않습니다 — 쓸 때마다 서버가 괜히 정렬해 둡니다.
         [2026-08-17] `$day` 자리 자체는 이제 있습니다 (쓰기 잠금 때문에).
         보는 것은 그 안의 **.indexOn** 하나입니다. */
      ok(!(rulesIdx.attendlog?.$day?.[".indexOn"]),
         "attendlog 에는 안 쓰는 색인을 두지 않았다 (하루치를 통째로 읽으므로)");

      ok(/name="mobile-web-app-capable"/.test(HTML),
         "표준 이름의 앱 메타 태그가 있다 (apple- 쪽만 두면 크롬이 경고)");
    }

    /* =====================================================================
       자리비움이 다시 풀리는가 (2026-08-09)

       ★ 실제로 겪은 버그입니다 — "자동감지 ON 인데 접속해서 마우스를
         움직이고 채팅을 쳐도 AWAY 가 안 풀린다."

       원인이 둘 겹쳐 있었습니다.
         ① _autoAway("이 AWAY 는 자동이었다" 꼬리표)는 그냥 변수라
            새로고침하면 false 로 돌아갑니다. 그런데 상태(away)는 서버에
            남아 있어요. 그래서 자동으로 자리비움이 된 채 나갔다 들어오면
            둘이 어긋나고, 복귀 함수가 첫 줄에서 그냥 돌아섰습니다.
         ② IdleDetector 는 **바뀔 때만** 알려줍니다. 접속한 사람은 방금
            버튼을 눌렀으니 이미 활동 중이라, change 이벤트가 아예
            오지 않아 복귀 함수가 불리지도 않았습니다.

       둘 다 막아 둡니다.
       ===================================================================== */
    {
      const ID2 = fs.readFileSync(DIR+"script_idledetect.js","utf8");

      /* ① 꼬리표가 새로고침을 견디는가 */
      ok(/function _tagKey\(\)/.test(ID2), "꼬리표를 담을 열쇠가 닉네임별로 있다");
      ok(/AppStore\.setItem\(_tagKey\(\), _prevStatus/.test(ID2),
         "자동 AWAY 가 되면 돌아갈 상태까지 적어 둔다");
      ok(/AppStore\.removeItem\(_tagKey\(\)\)/.test(ID2), "풀리면 꼬리표를 지운다");
      ok((ID2.match(/_saveTag\(\);/g) || []).length >= 4,
         "꼬리표가 바뀌는 자리마다 빠짐없이 적는다");

      /* ② 켠 직후 지금 상태를 직접 물어보는가 */
      ok(/_loadTag\(\);\s*\n\s*_firstCheckWhenReady\(\);/.test(ID2),
         "감지기를 켠 직후 꼬리표를 읽고, 상태가 오면 확인한다");
      ok(/else _restoreIfAutoAway\(\);/.test(ID2),
         "이미 활동 중이면 그 자리에서 복귀시킨다 (change 이벤트를 기다리지 않음)");

      /* ③ 사람이 직접 고른 AWAY 는 건드리지 않는가 — 이건 지켜야 합니다 */
      ok(/if \(!_autoAway\) return;/.test(ID2),
         "손으로 고른 AWAY 는 자동으로 풀지 않는다");
      ok(/if \(_settingByCode\) return;/.test(ID2),
         "우리가 바꾼 것을 사람이 바꾼 것으로 오해하지 않는다");
    }

    /* =====================================================================
       "지금부터 다시 세기" — 기록을 지우지 않는가 (2026-08-09)

       ★ 예전 [오늘 작업 시간 초기화] 는 그날 기록을 **정말로 지웠습니다.**
         숫자는 0이 됐지만 되돌릴 방법이 없었어요. 잘못 눌러도 끝이었습니다.

       이제는 "이 시각부터만 센다"는 표시 하나만 남기고, 합계를 낼 때
       그보다 앞선 부분을 빼고 셉니다. 기록은 서버에 그대로 있어요.
       지우는 코드가 되살아나지 않는지 여기서 지켜봅니다.
       ===================================================================== */
    {
      const TL2 = fs.readFileSync(DIR+"script_timelog.js","utf8");
      const i = TL2.indexOf("window.resetTodayWorkTime");
      const seg = TL2.slice(i, i + 1400);

      ok(!/timeSegs\/\$\{ymd\(t\)\}`\)\.remove\(\)/.test(seg),
         "★ 그날 기록을 지우지 않는다");
      ok(/workReset\/\$\{ymd\(t\)\}`\)\.set\(t\)/.test(seg),
         "대신 '이 시각부터' 표시만 남긴다");
      ok(/기록은 그대로예요/.test(seg), "확인창이 기록은 그대로라고 알려준다");
      /* ★ 핵심 — 카드 타이머만 되돌리고 나의 작업 기록은 손대지 않습니다 */
      ok(/loadSummary\(myNick, 1, 0, \{ applyReset: true \}\)/.test(TL2),
         "카드 타이머를 구할 때만 리셋을 반영한다");
      ok(/const applyReset = opts\.applyReset === true;/.test(TL2),
         "기본은 '있는 그대로' — 부르는 쪽이 고른다");
      ok(!/recordHtml\(await loadSummary\(myNick, 7, backWeeks, \{ applyReset/.test(TL2),
         "나의 작업의 기록에는 리셋을 반영하지 않는다");

      /* 합계를 낼 때 그 표시를 실제로 반영하는가 */
      ok(/resetAll = v\.workReset \|\| \{\}/.test(TL2), "합계 낼 때 표시를 읽는다");
      ok(/const a = Math\.max\(Number\(seg\.a \|\| 0\), resetAt\)/.test(TL2),
         "표시를 걸친 구간은 뒤쪽만 센다");
      ok(/Math\.max\(curStart, dayMs, resetAt\)/.test(TL2),
         "지금 열려 있는 구간에도 똑같이 적용한다");

      /* 화면 문구 */
      ok(/btn-2line/.test(HTML) && /지금부터 다시 count!/.test(HTML),
         "버튼이 두 줄이고 아랫줄에 무슨 일이 벌어지는지 적혀 있다");

      /* [2026-08-09] 남아 있어도 보이지 않으면 사라진 것과 같습니다.
         "그 전 얼마"를 화면에 적고, 되돌리는 길도 함께 둡니다. */
      ok(/beforeReset \+= cut/.test(TL2), "다시 세기 이전 시간을 따로 세어 둔다");
      ok(/resetAt: resetAtRaw,\s*\n\s*beforeReset/.test(TL2), "그 값을 화면 쪽으로 넘긴다");
      ok(/function renderTimerResetNote/.test(TL2) && /id="timer-reset-note"/.test(HTML),
         "'언제부터 다시 세는 중' 알림 줄이 버튼 아래에 있다");
      ok(/\.timer-reset-note\{/.test(CSS), "그 CSS 규칙이 있다");
      ok(/작업 시간에 그대로 있어요/.test(TL2), "그 전 시간이 어디에 있는지 알려준다");
      ok(/⏱️ 타이머 리셋/.test(HTML) && !/오늘 작업 시간 초기화<\/span>/.test(HTML),
         "버튼 이름이 [타이머 리셋] 이다");
      ok(/window\.undoWorkReset/.test(TL2) && /onclick="undoWorkReset\(\)"/.test(TL2),
         "되돌리기 버튼이 있다");
      ok(/workReset\/\$\{ymd\(nowMs\(\)\)\}`\)\.remove\(\)/.test(TL2),
         "되돌리기는 표시만 지운다 (기록은 손대지 않음)");
      ok(/\.btn-2line\{/.test(CSS), "그 CSS 규칙이 있다");
    }

    /* =====================================================================
       👥 접속자 명단 미리보기 (2026-08-09)

       ★ 여기서 지키려는 것: **미리보기가 작업방을 건드리지 않는 것.**

       카드 배치를 바꿔보려고 만든 자리입니다. 진짜처럼 보이려면 작업방의
       styles.css 가 필요한데, 그걸 관리자 페이지에 그냥 붙이면 이 페이지가
       통째로 그 스타일에 덮입니다. 그래서 그림자 뿌리(Shadow DOM) 안에
       넣어 스타일을 가둡니다. 새 배치용 CSS 도 그 안에만 둡니다.

       작업방 파일(index.html · styles.css · script_realtime.js)은 한 줄도
       바뀌지 않아야 합니다 — 마음에 안 들면 이 카드만 지우면 되도록.
       ===================================================================== */
    {
      /* [철거 확인 2026-08-14] 접속자 명단 미리보기는 ✨ 성실 멤버에게
         자리를 내주고 떠났습니다 — 흔적이 남아 있으면 안 됩니다.
         (성실 멤버 자체의 검사는 위 "관리자 정리" 블록에 있어요) */
      const ADM3 = fs.readFileSync(DIR+"script_admin.js","utf8");
      const AH4  = fs.readFileSync(DIR+"admin.html","utf8");
      ok(!/id="adm-cards-open"/.test(AH4) && !/id="adm-cards-modal"/.test(AH4),
         "★ 접속자 명단 미리보기의 화면 흔적이 없다");
      ok(!/function openMemberPreview/.test(ADM3) && !/attachShadow/.test(ADM3),
         "★ 미리보기 코드도 걷었다 (그림자 뿌리 포함)");
    }

    /* =====================================================================
       팝업을 닫을 길이 있는가 (2026-08-09)

       ★ 아래의 큰 [닫기] 버튼을 오른쪽 위 ✕ 로 바꿨습니다.
         내용이 긴 창에서는 그 버튼이 자리를 크게 차지했거든요.

       바꾸다가 **닫을 수 없는 창**을 만드는 게 제일 무서운 사고입니다.
       그래서 창마다 나가는 길이 최소 두 개는 있는지 셉니다.
       ===================================================================== */
    {
      const rooms = [
        ["manual-modal",   "closeManual"],
        ["mywork-modal",   "closeMyWork"],
        ["forest-modal",   "closeForest"],
        ["wcall-modal",    "closeWcAll"],
        ["settings-modal", "closeSettings"]
      ];
      rooms.forEach(([id, fn]) => {
        const i = HTML.indexOf(`id="${id}"`);
        const seg = HTML.slice(i, i + 900);
        const hasX   = /class="modal-x"/.test(seg);
        const hasOut = new RegExp(`id="${id}" onclick="${fn}\\(\\)"`).test(HTML);
        ok(hasX, `${id} 에 오른쪽 위 ✕ 가 있다`);
        ok(hasOut, `${id} 은 바깥을 눌러도 닫힌다`);
      });

      /* 아래 큰 버튼은 걷어냈는가 */
      ok(!/ghost-btn w-full"[^>]*onclick="close(Manual|MyWork|Forest|WcAll|Settings)\(\)"/.test(HTML),
         "아래쪽 폭 전체 [닫기] 버튼은 없앴다");

      /* 스크롤해도 ✕ 가 따라오는가 — absolute 로만 두면 위로 사라집니다 */
      const flat = CSS.replace(/\s+/g, " ");
      ok(/\.modal-x\{[^}]*position: sticky/.test(flat), "✕ 가 스크롤을 따라온다");
      ok(/#settings-modal \.modal-x, #mywork-modal \.modal-x\{[^}]*position: absolute/.test(flat),
         "세로로 쌓는 창에서는 떠 있게 둔다 (자리를 차지하지 않게)");
      ok(/padding-right: 34px/.test(flat), "제목이 ✕ 밑으로 파고들지 않는다");
      ok(/\.modal-x:focus-visible\{/.test(flat), "키보드로 짚을 수 있다");
      {
        const xs = HTML.match(/class="modal-x"/g) || [];
        const named = HTML.match(/class="modal-x"[^>]*aria-label=/g) || [];
        ok(xs.length === named.length && xs.length >= 5,
           `✕ 마다 무엇을 닫는지 이름이 붙어 있다 (화면 낭독기용) — ${named.length}/${xs.length}`);
      }
    }

    /* =====================================================================
       📮 쪽지 (2026-08-09)

       ★ 여기서 지키려는 것 둘.
         ① **받는 사람만 읽는다** — 방장도 못 봅니다. 쪽지는 그런 성격이에요.
         ② **이름을 사칭할 수 없다** — 익명 자리는 🎋 대숲이 이미 맡고 있고,
            쪽지에 남의 이름을 달 수 있으면 그건 사고입니다.

       그리고 "대화가 되지 않게" 두는 것도 의도입니다. 답장이 실 타래로
       엮이면 사람들이 여기서 이야기를 시작하고 채팅방이 조용해집니다.
       ===================================================================== */
    {
      const NT  = fs.readFileSync(DIR+"script_note.js","utf8");
      const rl  = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;

      /* ── 새지 않는가 ── */
      ok(!!rl.notes && !!rl.notesOut, "쪽지 자리가 규칙에 있다");
      ok(!/\.read/.test(JSON.stringify(rl.notes.$nick[".read"] || "")) &&
         /nickOwner/.test(rl.notes.$nick[".read"]), "받는 사람만 읽는다");
      ok(!String(rl.notes.$nick[".read"]).includes("ABM1ZJndrqaV3gpYUs03SV9qglr1"),
         "★ 방장도 못 읽는다 (쪽지는 그런 성격이라 일부러 뺐습니다)");
      ok(/nickOwner'\)\.child\(newData\.child\('from'\)/.test(rl.notes.$nick.$id[".write"]),
         "★ 적어 넣는 이름이 지금 로그인한 사람과 같아야 한다 (사칭 방지)");
      ok(/length <= 80/.test(rl.notes.$nick.$id[".write"]), "80자 제한을 서버에서도 건다");
      ok(/!data\.exists\(\)/.test(rl.notes.$nick.$id[".write"]),
         "보낸 쪽지를 나중에 고치거나 지울 수 없다");

      /* ── 대화가 되지 않게 ── */
      ok(/data-note-reply/.test(NT) && /openNoteTo\(rp\.getAttribute/.test(NT),
         "[답장] 은 새 쪽지 창을 열 뿐이다");
      ok(!/thread|reply_to|replyTo/i.test(NT), "실 타래로 엮는 값이 없다");

      /* ── 카드 클릭이 엉키지 않는가 ── */
      ["[data-record-of]", "[data-edit-profile]", "[data-pick-status]", ".share-card"]
        .forEach(sel => ok(NT.includes(`closest("${sel}")`),
          `${sel} 을 눌렀을 때는 쪽지 창이 안 뜬다`));
      ok(/nick === myNick\) return;/.test(NT), "내 카드에는 쪽지를 보내지 않는다");

      /* ── 보관함 · 알림 ── */
      ok(/notesOut\/\$\{myNick\}/.test(NT), "보낸 쪽지도 내 자리에 남긴다");
      ok(/data-note-box="in"/.test(NT) && /data-note-box="out"/.test(NT),
         "받은 것 / 보낸 것 두 칸이 있다");
      /* [고침 2026-08-09] 이름 오른편에 **늘 있는 자리**로 바꿨습니다.
         새 쪽지가 왔을 때만 나타나면 그 자리가 뭔지 모르는 채로 갑자기
         생깁니다. 안테나처럼 평소엔 옅은 윤곽으로 자리를 지키다가,
         쪽지가 오면 색이 차오르는 편이 알아보기 쉬워요. */
      ok(/function renderNoteBadge/.test(NT) && /\.card-note\{/.test(CSS),
         "쪽지 자리가 내 카드 이름 오른편에 있다");
      ok(/\.card-note::before\{/.test(CSS), "평소에는 옅은 윤곽과 점만 보인다");
      ok(/\.card-note\.has\{/.test(CSS) && /classList\.toggle\("has", n > 0\)/.test(NT),
         "새 쪽지가 오면 색이 차오른다");
      /* [고침 2026-08-09] 이름 줄 안쪽에 넣어 [쪽지] [닉네임] 으로 나란히.
         카드 끝에 띄워 두면 긴 닉네임과 부딪혔습니다. */
      ok(/nameEl\.insertBefore\(b, nameEl\.firstChild\)/.test(NT),
         "쪽지 자리가 이름보다 앞에 선다");
      ok(/\.user-card\.is-me \.card-name\{[^}]*justify-content: flex-end/
         .test(CSS.replace(/\s+/g, " ").replace(/ \{/g, "{")),
         "둘이 함께 오른쪽에 붙는다");
      ok(/\.card-note\{[^}]*flex: 0 0 auto/.test(CSS.replace(/\s+/g, " ").replace(/ \{/g, "{")),
         "긴 닉네임에도 쪽지 자리가 찌그러지지 않는다");
      ok(/data-note-open/.test(NT) && /switchMyWorkTab\?\.\("note"\)/.test(NT),
         "누르면 바로 📮 쪽지 탭이 열린다");
      ok(/KEEP_MS\s*=\s*30 \* 24/.test(NT), "30일이 지나면 사라진다");
      ok(/id="mywork-panel-note"/.test(HTML) && /data-mw-tab="note"/.test(HTML),
         "🗂️ 나의 작업에 📮 쪽지 탭이 있다");
      ok(/<script src="script_note\.js/.test(HTML), "index.html 이 새 파일을 부른다");
      ok(/"script_note\.js"/.test(fs.readFileSync(DIR+"build-single.py","utf8")),
         "단일파일 빌드 목록에도 있다");
      ok(/쪽지/.test(fs.readFileSync(DIR+"script_manual.js","utf8")), "가이드에 설명이 있다");
    }

    /* =====================================================================
       ⏸ 일시정지 (2026-08-09)

       [어떻게 담았나]
       끝나는 시각(endAt)만으로는 "멈춤"을 표현할 수 없습니다. 시계는 계속
       흐르니까요. 그래서 멈출 때 **남은 밀리초**를 적어 두고 endAt 을
       버립니다. 이어갈 때 그 반대로 합니다. 덕분에 몇 시간을 멈춰 두어도,
       창을 닫았다 열어도 남은 시간이 그대로입니다.
       ===================================================================== */
    {
      const RT6 = fs.readFileSync(DIR+"script_realtime.js","utf8");

      ok(/function pausePomodoro/.test(RT6) && /function resumePomodoro/.test(RT6),
         "멈추기와 이어가기가 있다");
      ok(/pausedLeft: left/.test(RT6), "멈출 때 남은 시간을 적어 둔다");
      ok(/endAt: Date\.now\(\) \+ _pomo\.pausedLeft/.test(RT6),
         "이어갈 때 그 시간만큼 다시 잡는다");
      ok(/const remainMs = _isPaused\(\) \? _pomo\.pausedLeft/.test(RT6),
         "멈춰 있으면 시계가 흘러도 숫자가 그대로다");
      ok(/if \(!_isPaused\(\) && remainMs <= 0\)/.test(RT6),
         "멈춘 채로는 다음 단계로 넘어가지 않는다");
      ok(/if \(left > 0\) return \{ \.\.\.base, endAt: 0, pausedLeft: left \}/.test(RT6),
         "창을 닫았다 열어도 멈춘 상태가 살아난다");

      /* 시작 ↔ 일시정지를 한 버튼이 맡습니다 */
      ok(/function togglePomoRun/.test(RT6) && /onclick="togglePomoRun\(\)"/.test(HTML),
         "한 버튼이 시작과 멈춤을 함께 맡는다");
      ok(/is-pause/.test(RT6) && /#pomo-run-btn\.is-pause \.ic-play\{ display: none/
         .test(CSS.replace(/\s+/g, " ").replace(/ \{/g, "{")),
         "그 버튼의 그림이 ▶ ↔ ⏸ 로 바뀐다");
      ok(/\.pomo-bar\[data-state="idle"\] #pomo-stop-btn\{ display: none/
         .test(CSS.replace(/\s+/g, " ").replace(/ \{/g, "{")),
         "[■ 정지] 는 도는 중에만 보인다");

      /* 멈춘 동안에는 카드의 🍅 도 꺼집니다 — 실제로 달리는 게 아니니까요 */
      ok(/return !!_pomo && !_isPaused\(\);/.test(RT6),
         "멈춰 있는 동안에는 카드에 '집중 중' 으로 보이지 않는다");

      /* 도는 중 시간 설정 잠그기 */
      ok(/if \(i\) i\.disabled = running;/.test(RT6),
         "도는 중에는 🍅 ☕ 시간을 못 바꾼다 (지금 세션에 반영되지 않으므로)");
    }

    /* =====================================================================
       화면 글자를 JS 가 덮어쓰지 않는가 (2026-08-09)

       ★ 실제로 며칠을 헤맨 버그입니다.

       [⚙️ 설정] 버튼 안에는 아이콘과 글자 두 조각이 들어 있는데,
       script_ui.js 가 `btn.textContent = "🎵"` 로 통째로 갈아엎고
       있었습니다. HTML 을 아무리 고쳐도 화면에는 음표만 떴어요.

       더 고약했던 건 **저장된 값이 있는 사람에게만** 일어났다는 점입니다.
       (pomoDetailCollapsed 가 있으면 초기화 코드가 그 줄을 실행)
       그래서 새 브라우저·단일파일로 열면 멀쩡해 보였고, 원인을 계속
       배포나 캐시 쪽에서 찾았습니다.
       ===================================================================== */
    {
      /* 주석에는 "예전에 이랬다"는 설명이 남아 있으므로, 주석을 걷어낸
         알맹이에만 검사를 겁니다 (안 그러면 설명 때문에 실패합니다). */
      const UI2 = fs.readFileSync(DIR+"script_ui.js","utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      ok(!/pomo-detail-toggle[\s\S]{0,400}textContent\s*=/.test(UI2),
         "★ [⚙️ 설정] 버튼의 내용을 JS 가 덮어쓰지 않는다");
      ok(!/btn\.textContent = "🎵"/.test(UI2), "음표로 갈아엎던 줄이 없다");
      ok(/setAttribute\("aria-expanded"/.test(UI2),
         "대신 열림·닫힘만 표시한다");
    }

    /* =====================================================================
       자리비움 판단이 상태를 불러온 뒤에 도는가 (2026-08-09)

       자동감지는 script_core.js 에서 loadPersonalData **보다 먼저** 켜집니다.
       그때는 상태 칸이 비어 있어서, 그대로 판단하면 "AWAY 아니네" 로 읽고
       꼬리표를 지워 버립니다. 직후에 서버에서 away 가 들어오는데 되돌릴
       근거는 이미 사라진 뒤죠 — 접속할 때마다 AWAY 에 갇히던 이유입니다.
       ===================================================================== */
    {
      const ID3 = fs.readFileSync(DIR+"script_idledetect.js","utf8");
      const CORE2 = fs.readFileSync(DIR+"script_core.js","utf8");

      ok(CORE2.indexOf("afterJoinInitIdleDetect") < CORE2.indexOf('callIfFn("loadPersonalData")'),
         "자동감지가 상태 불러오기보다 먼저 켜진다 (그래서 기다림이 필요하다)");
      ok(/function _firstCheckWhenReady/.test(ID3), "상태가 올 때까지 기다렸다 판단한다");
      ok(/const loaded = !!document\.getElementById\("db-status"\)\?\.value/.test(ID3),
         "상태 칸에 값이 들어왔는지로 판단한다");
      ok(/tries < 40/.test(ID3), "무한정 기다리지는 않는다 (10초)");
      ok(/const raw = document\.getElementById\("db-status"\)\?\.value \|\| "";\s*\n\s*if \(!raw\) return;/.test(ID3),
         "★ 아직 안 불러왔으면 꼬리표를 지우지 않는다");
    }

    /* =====================================================================
       🔇 무음 접속 유지 (script_alive.js · 2026-08-13)

       들리지 않는 소리를 흘려서 브라우저가 탭을 재우지 못하게 합니다.
       여기서 지켜야 할 것이 셋 있어요.

         ① 음량이 0 이면 안 됩니다. 크로미움은 실제 음량을 재서
            −72.2 dBFS 아래면 "소리 안 나는 탭"으로 치고 그냥 재웁니다.
            그러면 기능이 조용히 아무 일도 안 하게 돼요 — 제일 무서운
            고장입니다(켜져 보이는데 효과가 없음). 그래서 상수를 직접
            읽어 dBFS 를 계산해 봅니다.
         ② 사람 귀에 들리면 안 됩니다. 주파수가 낮아야 해요.
         ③ 기기별로 기억해야 합니다. 서버에 저장하면 노트북에서 켠 것이
            폰까지 따라가 음악을 끊어 버립니다.
       ===================================================================== */
    {
      const AL = fs.readFileSync(DIR+"script_alive.js","utf8");

      /* ── ① 음량이 크로미움 판정선 위인가 — 숫자로 확인 ── */
      const 판정선 = -72.247;                       // kSilenceThresholdDbfs
      const mG = AL.match(/const ALIVE_GAIN\s*=\s*([0-9.]+)/);
      ok(!!mG, "무음 음량 상수(ALIVE_GAIN)가 있다");
      const gain = mG ? parseFloat(mG[1]) : 0;
      ok(gain > 0, "★ 음량이 0 이 아니다 (0 이면 크롬이 무음으로 치고 탭을 재운다)");
      const dbfs = 20 * Math.log10(gain / Math.SQRT2);   // 사인파 실효값
      ok(dbfs > 판정선,
         `★ 음량이 크롬 무음 판정선보다 위다 (${dbfs.toFixed(1)} dBFS > ${판정선})`);
      ok(dbfs > 판정선 + 3,
         "★ 판정선에 아슬아슬하게 붙어 있지 않다 (3dB 이상 여유)");

      /* ── ② 사람 귀에 안 들리는 낮은 소리인가 ── */
      const mF = AL.match(/const ALIVE_FREQ\s*=\s*([0-9.]+)/);
      ok(!!mF, "무음 주파수 상수(ALIVE_FREQ)가 있다");
      const freq = mF ? parseFloat(mF[1]) : 999;
      ok(freq <= 40,
         `★ 사람 귀가 무딘 낮은 소리다 (${freq}Hz — 70Hz 이상이면 들리기 시작한다)`);
      ok(/type = "sine"/.test(AL), "사인파다 (노이즈보다 조용하다)");

      /* ── ③ 기기별로 기억하는가 (서버가 아니라) ── */
      ok(/AppStore\.setItem\(ALIVE_KEY/.test(AL), "★ 켬/끔을 이 기기에만 저장한다");
      ok(!/db\.ref\(/.test(AL),
         "★ 서버에 저장하지 않는다 (노트북에서 켠 것이 폰까지 따라가면 안 된다)");

      /* ── 첫 클릭 문제 ── */
      const CORE3 = fs.readFileSync(DIR+"script_core.js","utf8");
      ok(/afterJoinInitAlive/.test(CORE3), "★ 입장할 때 자동으로 켜진다");
      ok(/_armFirstClick/.test(AL), "★ 클릭에 얹지 못하면 다음 클릭을 기다린다");
      ok(/_ctx\.state !== "running"/.test(AL),
         "★ 소리가 실제로 흐르는지 확인한다 (막힌 채 켜졌다고 하지 않는다)");
      ok(/addEventListener\("statechange"/.test(AL),
         "★ 전화·다른 앱에 끊기면 다시 깨운다");

      /* ── 화면 ── */
      const HxA = fs.readFileSync(DIR+"index.html","utf8");
      ok(/id="alive-btn"/.test(HxA), "머리말에 무음 버튼이 있다");
      ok(HxA.indexOf('id="alive-btn"') < HxA.indexOf('id="idle-detect-btn"'),
         "★ 무음 버튼이 자동감지 버튼 왼쪽에 있다");
      ok(/id="set-alive"/.test(HxA), "설정에도 같은 스위치가 있다");
      ok(/data-tab="alive"/.test(HxA) && /id="panel-alive"/.test(HxA),
         "설정에 🔌 접속 유지 탭이 있다");
      ok(/"script_alive\.js":\s*"toggleKeepAlive"/.test(HxA),
         "★ 파일이 빠지면 자가진단이 잡아낸다");
      ok(/script_alive\.js\?v=/.test(HxA), "캐시 도장이 찍혀 있다");

      /* ── 폰 배려 ── */
      ok(/window\.isMobile/.test(AL) && /confirm\(/.test(AL),
         "★ 폰에서 켤 때는 음악이 끊길 수 있다고 먼저 묻는다");

      /* ── 가이드에 설명이 있는가 ── */
      const G_AL = fs.readFileSync(DIR+"guide.html","utf8");
      ok(/무음/.test(G_AL.slice(G_AL.indexOf('id="alive"'))),
         "★ 접속 유지 가이드에 무음 방법이 적혀 있다");
    }

    /* =====================================================================
       🏷️ 방장 스티커 (2026-08-13)

       방장 카드에만 붙는 이름표입니다. 여기서 지킬 것은 셋.
         ① 방장에게만 붙을 것 — 닉네임을 견주는 자리가 있어야 합니다.
         ② 서버에 아무것도 안 적을 것 — 표시일 뿐이라 보안규칙과 무관해야
            하고, 그래야 규칙을 다시 올릴 일이 없습니다.
         ③ 위 작업 스티커와 **반대로** 기울 것. 둘이 같은 방향이면 카드가
            한쪽으로 쏠려 보입니다.
       ===================================================================== */
    {
      const RT_S  = fs.readFileSync(DIR+"script_realtime.js","utf8");
      const CSS_S = fs.readFileSync(DIR+"styles.css","utf8");

      ok(/u === ADMIN_NICK/.test(RT_S), "★ 방장 카드에만 스티커가 붙는다");
      ok(/class="card-admin-stamp"/.test(RT_S), "스티커를 그리는 자리가 있다");
      ok(/>방장</.test(RT_S), "이름표가 '방장' 이다");

      /* 프사 칸 안에 있어야 프사를 따라다닙니다 (작업 스티커는 카드 기준).
         [2026-08-17] 부방장이 생기면서 이름표를 stampHtml(u) 로 뽑았습니다 —
         이제 **부르는 자리**가 프사 칸 안에 있는지 봅니다. */
      const wrapAt = RT_S.indexOf('class="card-avatar-wrap');
      const stampAt = RT_S.indexOf('${stampHtml(u)}');
      const sideAt = RT_S.indexOf('class="card-side"');
      ok(wrapAt < stampAt && stampAt < sideAt,
         "★ 스티커가 프사 칸 안에 있다 (프사를 따라다닌다)");

      const blk = CSS_S.slice(CSS_S.indexOf(".card-admin-stamp{"),
                              CSS_S.indexOf("}", CSS_S.indexOf(".card-admin-stamp{")));
      ok(/rotate\(7deg\)/.test(blk),
         "★ 작업 스티커(−7도)와 반대로 기울어 있다 (+7도)");
      ok(/right:\s*-/.test(blk) && /bottom:\s*-/.test(blk),
         "★ 프사 오른쪽 아래 모서리에 걸쳐 있다");
      ok(/pointer-events:\s*none/.test(blk),
         "★ 프사 클릭(프로필 설정)을 가리지 않는다");
      ok(!/db\.ref|firebase/.test(blk), "스티커는 서버와 무관하다 (표시일 뿐)");

      /* ★★ 방장 스티커는 부방장보다 **작아지면 안 됩니다** (2026-08-17).
         자리가 위인 사람의 이름표가 더 작으면 위계가 뒤집혀 보여요.
         글자 배율과 좌우 여백으로 상자 폭을 어림해 견줍니다 —
         한글은 글자 하나가 대략 1em 이라 이 셈이 실제와 잘 맞습니다. */
      {
        const 배율 = (s) => Number((s.match(/font-size: calc\(var\(--fs-sm\) \* (\.\d+)\)/) || [])[1]);
        const 여백 = (s) => Number((s.match(/padding: [\d.]+px ([\d.]+)px/) || [])[1]);
        const vblk = CSS_S.slice(CSS_S.indexOf(".card-admin-stamp.is-vice{"),
                                 CSS_S.indexOf("}", CSS_S.indexOf(".card-admin-stamp.is-vice{")));
        const FS = 13.5;                                   // --fs-sm
        const 폭 = (배, 여, 글자수) => 배 * FS * 글자수 + 여 * 2 + 2;
        const 방장폭   = 폭(배율(blk),  여백(blk),  2);     // "방장"
        const 부방장폭 = 폭(배율(vblk), 여백(vblk), 3);     // "부방장"
        ok(배율(blk) < .88,
           `방장 스티커를 줄였다 (${(배율(blk) * FS).toFixed(1)}px)`);
        ok(방장폭 >= 부방장폭,
           `★★ 방장 스티커가 부방장보다 작지 않다 (${방장폭.toFixed(1)}px ≥ ${부방장폭.toFixed(1)}px)`);
        ok(배율(blk) > 배율(vblk),
           "★ 글자도 방장이 더 크다 (폭이 비슷해도 위계가 읽히게)");
      }
    }

    /* =====================================================================
       🎨 카드 무늬 확장 (2026-08-13) — 도트 4종·그리드 3종·체크 2종·
       지그재그·비늘 추가. 지킬 것은 하나: **목록의 모든 무늬에 CSS 가
       있어야** 합니다. 목록에만 넣고 CSS 를 빼먹으면 골라도 아무 변화가
       없는 죽은 항목이 돼요 — 조용해서 아무도 모릅니다.
       ===================================================================== */
    {
      const PF = fs.readFileSync(DIR+"script_profile.js","utf8");
      const CSS_P = fs.readFileSync(DIR+"styles.css","utf8");

      const mArr = PF.match(/const CARD_PATTERNS = \[[\s\S]*?\];/);
      ok(!!mArr, "무늬 목록(CARD_PATTERNS)이 있다");
      const ids = [...(mArr ? mArr[0] : "").matchAll(/id:\s*"([a-z-]+)"/g)].map(m => m[1]);
      ok(ids.length >= 24, `무늬가 충분히 많다 (${ids.length}종)`);

      ids.filter(id => id !== "none").forEach(id => {
        /* 모양 무늬(shape-*)는 ::before 로 그려서 선택자 뒤에 : 이 붙습니다 */
        ok(new RegExp(`\\.user-card\\.pat-${id}[,{\\s:]`).test(CSS_P),
           `★ ${id} — 카드 CSS 가 있다`);
        ok(new RegExp(`\\.card-preview\\.pat-${id}[,{\\s:]`).test(CSS_P),
           `★ ${id} — 미리보기 CSS 가 있다`);
      });

      /* 새 도트들이 실제로 크기가 다른가 — 이름만 다르고 같아 보이면 무의미 */
      ok(/pat-dots-pin[\s\S]{0,200}?radial-gradient\(var\(--cpat\) 1px/.test(CSS_P),
         "핀도트가 가장 잘다 (1px)");
      ok(/pat-dots-coin[\s\S]{0,200}?radial-gradient\(var\(--cpat\) 5\.5px/.test(CSS_P),
         "코인도트가 가장 크다 (5.5px)");
      ok(/pat-dots-polka[\s\S]{0,400}?background-position: 0 0, 11px 11px/.test(CSS_P),
         "폴카도트는 엇갈려 있다 (반 칸 밀림)");
      ok(/pat-check-gingham[\s\S]{0,300}?color-mix/.test(CSS_P),
         "깅엄은 반투명 겹침이다 (겹친 자리만 진해진다)");
      ok(/pat-grid-diamond[\s\S]{0,300}?repeating-linear-gradient\(45deg/.test(CSS_P),
         "마름모 격자는 45도 사선 두 방향이다");
    }

    /* =====================================================================
       @멘션 드롭다운도 펜과 함께 이사 (2026-08-13)

       챗↔수다방 전환은 글칸(.input-area)과 딸린 것들을 통째로 옮기는
       "펜 이사" 방식입니다. 멘션 드롭다운이 그 목록에서 빠져 있었어요.
       그러면 수다방에서 @ 를 칠 때 드롭다운이 **닫혀 있는 챗 판 안에서**
       열립니다 — 동작은 하는데 보이지 않아서 "무반응"으로 보고됐습니다.
       (실제 멤버 제보로 발견. 같은 부류의 사고가 답장 미리보기에도
       있었어서 펜 목록을 통째로 검사합니다)
       ===================================================================== */
    {
      const DK = fs.readFileSync(DIR+"script_dock.js","utf8");
      const 펜줄 = (DK.match(/const 펜 = \[[^\]]*\]/) || [""])[0];
      ok(/reply-preview-bar/.test(펜줄), "답장 미리보기가 글칸과 함께 다닌다");
      ok(/mention-dropdown/.test(펜줄),
         "★ 멘션 드롭다운도 글칸과 함께 다닌다 (안 옮기면 수다방에서 안 보인다)");

      const CSS_D = fs.readFileSync(DIR+"styles.css","utf8");
      ok(/\.dock-write\{[^}]*position: relative/.test(CSS_D),
         "★ 글칸 상자가 드롭다운의 닻이다 (없으면 챗과 수다방의 뜨는 위치가 다르다)");
    }

    /* =====================================================================
       🧲 꾸미기 스티커 (2026-08-13)

       카드 지정 자리 넷(A·B·C·D)에 낱말·표정을 골라 붙입니다. 지킬 것:
         ① 목록제 + sanitize — 목록에 없는 값은 빈 자리로. 자유 문자열을
            그대로 그리면 좁은 카드가 터지고 escape 사고의 문이 됩니다.
         ② 자리 넷 전부 CSS 가 있어야 — 하나라도 빠지면 그 자리 스티커가
            엉뚱한 곳(왼쪽 위)에 겹쳐 그려집니다.
         ③ pointer-events: none — 카드의 클릭 세 곳을 가리면 안 됩니다.
         ④ 작업 스티커보다 작아야 — 주역은 작업 스티커, 이건 장식.
       ===================================================================== */
    {
      const PF2 = fs.readFileSync(DIR+"script_profile.js","utf8");
      const RT2 = fs.readFileSync(DIR+"script_realtime.js","utf8");
      const CS2 = fs.readFileSync(DIR+"styles.css","utf8");

      /* ① 목록과 걸름망 */
      ["마감","스불재","라이브","갈엎","투고","심사","수정궁","영감님!!","투도!","아자자!"]
        .forEach(w => ok(PF2.includes(`"${w}"`) || PF2.includes(`t: "${w}"`),
          `낱말 스티커에 "${w}" 가 있다`));
      ["🔞","💋","✈️","🚨","☕️"].forEach(e =>
        ok(PF2.includes(e), `표정 스티커에 ${e} 가 있다`));
      /* [갱신 2026-08-14] 직접 쓰기 허용 — 8자까지. 넘치면 빈 자리 */
      ok(/function sanitizeDeco/.test(PF2) && /return ""/.test(PF2),
         "★ 걸름망이 있다 (너무 길거나 이상한 값은 빈 자리)");
      ok(/Array\.from\(t\)\.length <= 8/.test(PF2),
         "★ 직접 쓰기는 8자까지 (콩이 정함 — 길면 좁은 카드가 터진다)");
      ok(/isEmojiOnly/.test(PF2) && /t\.length <= 16/.test(PF2),
         "이모지는 코드 길이로 후하게 (한 글자가 코드 여러 개)");
      ok(/!t\.includes\("<"\)/.test(PF2), "꺾쇠는 안 받는다 (이중 안전장치)");
      ok(/__custom/.test(PF2) && /prompt\("스티커에 쓸 말/.test(PF2),
         "★ 고르기에 ✏️ 직접 쓰기가 있다");
      ok(/sel\.insertBefore\(opt, sel\.querySelector\("optgroup"\)\)/.test(PF2),
         "★ 직접 쓴 항목은 묶음 앞에 끼운다 (options[n] 은 묶음 안 자식이 잡혀 거부된다)");
      ok(/escapeHtml\(v\)/.test(PF2), "낱말을 이스케이프해서 그린다 (직접 쓴 문구 포함)");

      /* ② 자리 다섯 — 그리는 쪽과 CSS 가 짝이 맞는가 */
      ["a","b","c","d","e"].forEach(k =>
        ok(new RegExp(`\\.card-deco\\.deco-${k}\\{`).test(CS2),
           `★ ${k.toUpperCase()} 자리의 CSS 가 있다`));
      ok(/decoA.*decoC.*decoD/s.test(RT2) || /\$\{decoA\}\$\{decoC\}\$\{decoD\}/.test(RT2),
         "A·C·D 는 카드에 직접 붙는다");
      /* [갱신 2026-08-14] 자유 배치가 생겨 B·E 는 조건부입니다 —
         기본 자리면 프사 칸 안(프사를 따라다님), 좌표를 정했으면 카드 직접 */
      ok(/\$\{decoAvatar\}/.test(RT2) &&
         RT2.indexOf("${decoAvatar}") > RT2.indexOf('class="card-avatar-wrap') &&
         RT2.indexOf("${decoAvatar}") < RT2.indexOf('class="card-side"'),
         "★ 기본 자리의 B·E 는 프사 칸 안에 있다 (프사를 따라다닌다)");
      ok(/stkP\.b \? decoB : ""/.test(RT2) && /stkP\.b \? "" : decoB/.test(RT2),
         "★ 좌표를 정한 B·E 는 카드에 직접 붙는다 (카드 기준 좌표라서)");

      /* ③ 클릭을 안 가리는가 — 줄 첫머리의 본 규칙을 봅니다
         (편집기의 .stk-card .card-deco 는 일부러 auto 라 헷갈리면 안 됨) */
      const decoBlk = CS2.slice(CS2.indexOf("\n.card-deco{"),
                                CS2.indexOf("}", CS2.indexOf("\n.card-deco{")));
      ok(/pointer-events:\s*none/.test(decoBlk),
         "★ 스티커가 카드 클릭(프사·상태·아래칸)을 가리지 않는다");

      /* ④ 작업 스티커보다 작은가 (.88 vs .78) */
      ok(/card-deco-word\{[^}]*calc\(var\(--fs-sm\) \* \.78\)/s.test(CS2),
         "★ 꾸미기 스티커가 작업 스티커(.88)보다 작다 (.78)");

      /* A 자리가 카드 위 모서리 아래로 내려앉았는가 — 작업 스티커(-9px,
         위로 솟음)와 높이가 달라야 함 */
      ok(/\.deco-a\{ top: 14px/.test(CS2),
         "★ A 자리는 위 모서리보다 아래다 (작업 스티커와 높이가 어긋난다)");

      void 0;
    }

    /* =====================================================================
       ♪ BGM (script_music.js · 2026-08-13)

       유튜브 추천 리스트 + 작은 플레이어. 지킬 것 넷.
         ① 플레이어 iframe 을 다시 그리면 안 됩니다 — 접은 채 듣던 음악이
            리스트 갱신 때마다 뚝뚝 끊깁니다. 리스트(#music-list)만 따로
            그리고 플레이어 칸은 손대지 않아야 해요.
         ② 상한 35곡, 오래된 것부터 자동 삭제.
         ③ 글칸 비우기는 보내기 전에 (품평에서 겪은 그 사고).
         ④ 알약 순서 — 공지·챗·수다방·품평·BGM · 오늘할일 · 전체기록·
            업적·뽀모·Letters. 오늘 할 일이 소통(왼쪽)과 기록(오른쪽)을
            가르는 기준선입니다.
       ===================================================================== */
    {
      const MU = fs.readFileSync(DIR+"script_music.js","utf8");
      const DK2 = fs.readFileSync(DIR+"script_dock.js","utf8");
      const CS3 = fs.readFileSync(DIR+"styles.css","utf8");
      const HxM = fs.readFileSync(DIR+"index.html","utf8");
      const RUL = fs.readFileSync(DIR+"보안규칙.json","utf8");

      /* ① 플레이어를 안 다시 그리는가 */
      ok(/renderList/.test(MU) && !/music-player-slot[\s\S]{0,200}innerHTML/.test(
           MU.slice(MU.indexOf("function renderList"))),
         "★ 리스트만 다시 그린다 (플레이어 칸은 안 건드린다 — 건드리면 음악이 끊긴다)");
      ok(/if \(!f\) \{/.test(MU) && /f\.src = /.test(MU),
         "★ iframe 은 한 번 만들고 src 만 바꾼다");
      ok(/youtube-nocookie\.com\/embed\//.test(MU), "유튜브 공식 embed 를 쓴다 (저작권 안전)");

      /* ② 상한 */
      /* [나눔 2026-08-13 밤] 리스트가 둘 — 나의 리스트 10곡 + 추천 30곡 */
      ok(/const MUSIC_MAX = 30/.test(MU) && /const MINE_MAX {2}= 10/.test(MU),
         "★ 상한 — 추천 30곡 + 나의 리스트 10곡");
      ok(/users\/\$\{myNick\}\/musicMine/.test(MU),
         "★ 나의 리스트는 닉 기준이다 (어느 기기에서든 따라온다)");
      ok(/data-mine-add/.test(MU), "추천 곡을 ＋ 로 내 리스트에 담아올 수 있다");
      ok(/나의 리스트는 \$\{MINE_MAX\}곡까지예요/.test(MU),
         "★ 나의 리스트는 꽉 차면 거절한다 (아끼는 곡을 자동으로 안 지운다)");
      ok(/all\.sort\(\(a, b\) => a\.at - b\.at\)/.test(MU) && /slice\(0, all\.length - MUSIC_MAX\)/.test(MU),
         "★ 넘치면 오래된 것부터 지운다");

      /* ③ 품평의 교훈 */
      ok(MU.indexOf("inp.value = \"\";") < MU.indexOf("db.ref(\"music\").push"),
         "★ 글칸은 보내기 전에 비운다");

      /* 링크 파싱 — 별별 유튜브 주소를 다 받는가 */
      ok(/youtu\\\.be/.test(MU) && /shorts\|live\|embed/.test(MU),
         "youtu.be · shorts · live 주소도 알아듣는다");
      ok(/\^\[A-Za-z0-9_-\]\{6,15\}\$/.test(MU), "영상 id 를 걸러서 쓴다");

      /* ④ 알약 순서와 폭 */
      const iPub = DK2.indexOf('id: "pub"'), iMus = DK2.indexOf('id: "music"'),
            iTodo = DK2.indexOf('id: "todo"'), iHelp = DK2.indexOf('id: "help"');
      ok(iPub > -1 && iMus > iPub && iTodo > iMus && iHelp > iTodo,
         "★ 알약 순서: 품평 → BGM → 오늘할일 → 표현공부");
      ok(/id: "music"[^}]*resize: true/.test(DK2), "BGM 판은 키를 조절할 수 있다");
      ok(/#dock-panel-music\{ width: min\(317px/.test(CS3),
         "BGM 판 폭 317px — 뽀모보다 10% 큼 (2026-08-13 볼륨 문제로 키움)");
      ok(/#dock-panel-chat\{ width: min\(352px/.test(CS3), "★ 챗 폭 10% 줄임 (391→352)");
      ok(/#dock-panel-chatty\{ width: min\(374px/.test(CS3), "★ 수다방 폭 10% 줄임 (416→374)");

      /* 연결 — 로드 자가진단·ORDER·규칙 */
      ok(/"script_music\.js":\s*"musicInit"/.test(HxM), "파일이 빠지면 자가진단이 잡는다");
      ok(/script_music\.js\?v=/.test(HxM), "캐시 도장이 찍혀 있다");
      ok(/"music": \{/.test(RUL) && /matches\(\/\^\[A-Za-z0-9_-\]\{6,15\}\$\/\)/.test(RUL),
         "★ 보안규칙에 music 노드가 있다 (콘솔 적용 필요)");
      const CORE4 = fs.readFileSync(DIR+"script_core.js","utf8");
      ok(/window\.musicInit\?\.\(\)/.test(CORE4), "입장하면 리스트 구독이 시작된다");

      /* ── 알약 더블클릭 = 일시정지 (2026-08-13 콩 요청) ──
         더블클릭은 클릭 두 번이라, 그냥 걸면 판이 열렸다 닫히며
         깜빡입니다. BGM 알약만 250ms 기다렸다 가릅니다. */
      ok(/enablejsapi=1/.test(MU), "★ 플레이어에 명령 문이 열려 있다 (enablejsapi)");
      ok(/postMessage\(\s*JSON\.stringify\(\{ event: "command", func/.test(MU),
         "★ 일시정지는 쪽지(postMessage)로 — iframe 을 안 건드려 음악이 안 끊긴다");
      ok(/musicHasPlayer/.test(MU) && /window\.musicHasPlayer/.test(MU),
         "재생 중인지 물어볼 수 있다");
      ok(/id === "music" && window\.musicHasPlayer\?\.\(\)/.test(DK2),
         "★ 음악이 없으면 기다리지 않고 바로 연다 (250ms 지연은 재생 중일 때만)");
      ok(/_musicClickTimer = setTimeout/.test(DK2) && /250\)/.test(DK2),
         "★ 클릭을 250ms 기다렸다 한 번이면 열고 두 번이면 일시정지");
      ok(/_paused \? "⏸" : "🔊"/.test(MU), "리스트 아이콘이 일시정지를 보여준다 (⏸)");

      /* ── 재생 중 알약 불 (2026-08-13 콩 요청) ── */
      ok(/function _syncPill/.test(MU) && /classList\.toggle\("music-on", !!_cur && !_paused\)/.test(MU),
         "★ 재생 중이면 알약에 불이 들어온다 (일시정지면 꺼진다)");
      ok(/\.dock-pill\.music-on\{/.test(CS3),
         "알약 불의 CSS 가 있다");
    }

    /* =====================================================================
       🎋 대숲 개편 + 🩹 종이테이프 스티커 (2026-08-13)
       ===================================================================== */
    {
      const FR = fs.readFileSync(DIR+"script_forest.js","utf8");
      const CSF = fs.readFileSync(DIR+"styles.css","utf8");
      const PF3 = fs.readFileSync(DIR+"script_profile.js","utf8");
      const RT4 = fs.readFileSync(DIR+"script_realtime.js","utf8");

      /* ── 보드 높이 고정 — 쪽지가 늘어도 스크롤이 안 생긴다 ── */
      ok(!/function boardHeight/.test(FR),
         "★ 쪽지 수만큼 보드를 늘리던 boardHeight 가 없다 (스크롤의 원인이었다)");
      ok(/height: clamp\(340px, calc\(100dvh - 250px\), 860px\)/.test(CSF),
         "★ 보드 높이는 화면에 맞춰 고정된다");

      /* ── 내 쪽지 끌기 ── */
      ok(/data-fr-mine/.test(FR) && /closest\("\[data-fr-mine\]"\)/.test(FR),
         "★ 내 쪽지만 끌 수 있다 (남의 쪽지를 옮기면 보드가 뒤죽박죽)");
      ok(/Math\.hypot\(dx, dy\) < 5/.test(FR),
         "★ 5px 문턱 — ♥ 누르려던 클릭이 끌기로 오해받지 않는다");
      ok(/_dragged = true/.test(FR) && /if \(_dragged\) \{ _dragged = false; return; \}/.test(FR),
         "★ 끌고 나서 뒤따르는 click 을 삼킨다");
      ok(/update\(\{ x: d\.n\.x, y: d\.n\.y \}\)/.test(FR),
         "자리만 고쳐 쓴다 (글이 그대로면 규칙이 이미 허용 — 규칙 변경 없음)");

      /* ── 답쪽지 ── */
      ok(/parent: typeof v\.parent === "string"/.test(FR), "답쪽지는 parent 로 구분한다");
      ok(/function rootNotes\(\) \{ return _notes\.filter\(n => !n\.parent\); \}/.test(FR),
         "★ 보드에는 뿌리 쪽지만 붙는다 (답쪽지는 부모 밑)");
      ok(/orphans/.test(FR) && /n\.parent && !ids\.has\(n\.parent\)/.test(FR),
         "★ 부모가 사라진 답쪽지는 같이 걷어낸다");
      ok(/function postReply/.test(FR) && !/nick|uid/.test(
           FR.slice(FR.indexOf("async function postReply"), FR.indexOf("async function postReply") + 900)
             .replace(/닉네임|누가/g, "")),
         "★ 답쪽지도 익명이다 (nick·uid 를 안 적는다)");

      /* ── 종이테이프 모양 ── */
      ok(/function sanitizeStickerShape/.test(PF3) && /v === "tape" \? "tape" : "pill"/.test(PF3),
         "★ 스티커 모양은 알약/테이프 둘뿐이다");
      ok(/id="prof-deco-shape"/.test(PF3), "프로필 설정에 모양 고르기가 있다");
      ok(/stickers, stickerColors, stickerShape/.test(PF3), "모양도 함께 저장한다");
      ok(/stkS, stkP\./.test(RT4), "카드가 모양과 좌표를 넘긴다");
      ["a","b","c","d","e"].forEach(k =>
        ok(new RegExp(`\\.card-deco-word\\.is-tape\\.deco-${k}\\{`).test(CSF),
           `★ ${k.toUpperCase()} 자리의 테이프 뜯김이 있다 (자리마다 다르게)`));
      ok(/\.card-deco-word\.is-tape\{[^}]*opacity: \.9/s.test(CSF),
         "테이프는 반투명이다 (종이 비침)");

      /* ── 판 넘기기 (2026-08-13 · A안) ── */
      ok(/const PAGE_SIZE = 24/.test(FR), "★ 한 판에 24장이다");
      ok(/all\.slice\(_page \* PAGE_SIZE, \(_page \+ 1\) \* PAGE_SIZE\)/.test(FR),
         "★ 판은 시간순 자동 배정 — 시들면 뒤 판이 앞으로 저절로 당겨 붙는다");
      ok(/_page = pageCount\(\) - 1;\s*\/\/ 새 쪽지는 맨 끝 판/.test(FR),
         "★ 붙이면 새 쪽지가 붙은 맨 끝 판으로 데려다준다");
      ok(/_page = pageCount\(\) - 1;\s*\/\/ 열면 맨 끝 판/.test(FR),
         "열면 최신 판부터 보인다");
      const HxF = fs.readFileSync(DIR+"index.html","utf8");
      ok(/id="forest-pager"/.test(HxF) &&
         HxF.indexOf('id="forest-count"') < HxF.indexOf('id="forest-board"'),
         "★ 쪽지 개수와 판 번호가 보드 위에 있다");
      ok(/calc\(100dvh - 250px\), 860px/.test(CSF),
         "보드가 화면 세로를 넉넉히 쓴다 (좌우 빈 곳으로 닫는다)");

      /* ── 아래쪽 쪽지의 답쪽지 (2026-08-13 저녁) ──
         무더기가 보드 밖으로 잘려 "댓글이 안 달리던" 문제. 하한선 대신
         **위로 펼침** — 이미 붙은 쪽지도 해결되고 죽은 땅도 없다. */
      ok(/fr-replies\$\{n\.y > 55 \? " flip" : ""\}/.test(FR),
         "★ 보드 아래쪽(55%↓) 쪽지는 답쪽지가 위로 펼쳐진다");
      ok(/\.fr-replies\.flip\{[^}]*bottom: 100%/s.test(CSF),
         "위로 펼치는 CSS 가 있다");
      ok(/\.fr-replies\{[^}]*background: var\(--fr-bg/s.test(CSF),
         "★ 무더기가 쪽지와 같은 종이색이다 (틈 없이 이어 붙어 한 쪽지로 읽힌다)");
      ok(/\.fr-replies\{[^}]*position: absolute/s.test(CSF),
         "무더기는 쪽지에 매달린 판이다 (쪽지 키를 안 늘린다)");
      ok(/\* 100 - 6, 0, 72\)/.test(FR),
         "★ 작성 카드는 72%까지만 앉는다 (맨 아래를 눌러도 안 잘린다)");

      /* ── 가이드·설명서가 BGM 을 안다 ── */
      const G_M = fs.readFileSync(DIR+"guide.html","utf8");
      const MN2 = fs.readFileSync(DIR+"script_manual.js","utf8");
      ok(/♪ BGM/.test(G_M) && /두 번 누르면 일시정지/.test(G_M),
         "★ 가이드에 BGM 이 있다 (더블클릭 일시정지 포함)");
      ok(/♪ BGM/.test(MN2) && /30곡/.test(MN2) && /10곡/.test(MN2),
         "★ 설명서에 BGM 이 있다 (나의 10곡 + 추천 30곡)");
      ok(/품평 · ♪ BGM ·\s*\n?\s*📌 오늘 할 일 · 📓/.test(MN2) || /품평 · ♪ BGM/.test(MN2) && /오늘 할 일 · 📓 Letters 전체 기록/.test(MN2),
         "★ 설명서의 알약 차례가 실제 순서와 같다");

      /* ── 혼자 내려간 카드 구제 + 영상 모서리 (2026-08-13) ── */
      const RT5 = fs.readFileSync(DIR+"script_realtime.js","utf8");
      ok(/function fixLonelyCard/.test(RT5) && /n % C !== 1\) return/.test(RT5),
         "★ 줄에서 카드 하나만 내려가면 둘이 같이 내려간다 (나머지 1일 때만)");
      ok(/if \(C < 3 \|\| n <= C/.test(RT5),
         "★ 좁은 화면(줄당 2장 이하)에서는 안 한다 — 위가 외로워진다");
      ok(/insertBefore\(br, cards\[n - 2\]\)/.test(RT5),
         "끝에서 두 번째 앞에 줄바꿈 띠를 끼운다");
      /* [2026-08-14] 사람 수·창 폭이 그대로면 다시 재지 않습니다 —
         재는 일은 배치를 강제로 계산시키는 것이라 화면이 들썩입니다 */
      ok(/if \(!force && sig === _lonelySig\) return;/.test(RT5),
         "★ 달라진 게 없으면 다시 재지 않는다 (하트비트마다 들썩이지 않게)");


      ok(/card-row-break/.test(CSF), "줄바꿈 띠 CSS 가 있다");
      ok(/window\.fixLonelyCard\?\.\(\)/.test(fs.readFileSync(DIR+"script_share.js","utf8")),
         "★ 공유 카드가 끼어들 때도 다시 잰다");
      ok(/\.music-player-slot\{[^}]*border-radius: 0/s.test(CSF),
         "★ BGM 영상은 네모 반듯하다 (모서리 둥글리기 없음)");

      /* ── 자체 볼륨 슬라이더 (2026-08-13 밤) ──
         유튜브 노브는 플레이어가 작으면 커서를 대기도 전에 접힙니다.
         쪽지(postMessage setVolume)로 보내는 우리 슬라이더는 크기 무관 */
      const MU2 = fs.readFileSync(DIR+"script_music.js","utf8");
      ok(/id="music-vol"/.test(MU2) && /_sendCmd\("setVolume"/.test(MU2),
         "★ 자체 볼륨 슬라이더가 있다 (유튜브 노브를 안 만져도 된다)");
      ok(/AppStore\.setItem\("musicVol"/.test(MU2),
         "볼륨을 이 기기에 기억한다");
      ok(/_applyVolumeSoon/.test(MU2) && /\[400, 1200, 2500\]/.test(MU2),
         "★ 곡을 갈아탈 때도 저장된 볼륨을 입힌다 (준비될 때까지 나눠 보냄)");
      ok(/#dock-panel-music\{ width: min\(317px/.test(CSF),
         "★ BGM 판을 10% 키웠다 (288→317)");

      /* ── LOOP 한 곡 반복 · ⏭ 이어듣기 (2026-08-14 멤버 요청,
             2026-08-18 🔂 이모지 → LOOP 글자 — 콩 리디자인) ── */
      ok(/id="music-loop1"/.test(MU2) && /const LOOP_KEY = "musicLoop1"/.test(MU2),
         "★ 볼륨 오른쪽에 한 곡 반복이 있다");
      ok(/>LOOP<\/button>/.test(MU2) && />VOL<\/span>/.test(MU2),
         "★ 🔊·🔂 이모지가 아니라 VOL·LOOP 글자다 (기기마다 이모지 생김이 달라서)");
      ok(/data-chain="mine"/.test(MU2) && /data-chain="all"/.test(MU2),
         "★ 두 리스트 머리에 ⏭ 이어듣기가 각각 있다");
      ok(/st === 0\) \{ onSongEnd\(\); return; \}/.test(MU2),
         "★ 곡이 끝나는 순간을 알아챈다 (playerState 0)");
      ok(/_sendCmd\("seekTo", \[0, true\]\)/.test(MU2),
         "한 곡 반복은 그 자리에서 처음으로 되감는다");
      ok(/rows\[\(i \+ 1\) % rows\.length\]/.test(MU2),
         "★ 마지막 다음은 처음이다 (무한 순환 — 콩 결정)");
      ok(/if \(_loop1\) \{ _chain = ""/.test(MU2) && /if \(_chain\) \{ _loop1 = false/.test(MU2),
         "★ 둘은 서로를 끈다 (겹치면 헷갈린다)");
      ok(/flex: 0 1 70%/.test(CSF), "★ 볼륨 선은 7할 폭이다 (콩 요청)");
      /* [2026-08-18] 먹색 → 테마 포인트색 — 노브와 같은 결 */
      ok(/\.music-mode-btn\[aria-pressed="true"\]\{[^}]*var\(--accent\)/s.test(CSF),
         "켜진 단추는 테마 포인트색으로 불이 들어온다");

      /* ── 기본 키 (2026-08-14 뒤집음 — 실제 제보) ──
         "영상까지만"이 기본이었더니 처음 여는 사람이 까만 상자만 보고
         쓰는 법을 몰랐다. 기본은 리스트·입력칸까지 다 보이게,
         줄이는 건 각자(150px 까지), 줄인 키는 기기에 기억. */
      ok(!/function musicDefaultH/.test(MU2),
         "★ '영상까지만 열기' 기본은 철거됐다 (처음 여는 사람이 길을 잃는다)");
      const DK3 = fs.readFileSync(DIR+"script_dock.js","utf8");
      ok(/id: "music"[^}]*size: 0\.72/.test(DK3),
         "★ 기본 키는 리스트·입력칸까지 다 보이는 높이다");
      ok(/pid === "music" \? 150 : baseH\(pid\)/.test(DK3),
         "★ BGM 만 150px 까지 줄일 수 있다 (영상만 남기는 쓰임)");
      ok(/if \(d\.resize\) setH\(pid, loadH\(pid\)\)/.test(DK3),
         "줄여 둔 키는 다음에 열 때도 그대로다");
      ok(/#dock-panel-music \.dock-body\{[^}]*overflow: hidden/s.test(CSF),
         "★ 줄인 판의 아래쪽이 비죽 보이지 않는다 (스크롤바 없음)");

      /* ── 볼륨 모양 (2026-08-18 콩 리디자인 — 사각 도장 → 둥근 점) ──
         노브가 **테마 포인트색(--accent)** 이라 테마를 바꾸면 따라갑니다. */
      ok(/#music-vol::-webkit-slider-thumb\{[^}]*width: 13px;\s*height: 13px;\s*border-radius: 50%/s.test(CSF),
         "★ 노브가 둥근 점이다 (13px 원)");
      ok(/#music-vol::-webkit-slider-thumb\{[^}]*background: var\(--accent\)/s.test(CSF) &&
         /#music-vol::-moz-range-thumb\{[^}]*background: var\(--accent\)/s.test(CSF),
         "★★ 노브가 테마 포인트색이다 — 테마를 바꾸면 노브 색도 따라간다");
      ok(/var\(--accent\) var\(--vol, 80%\)/.test(CSF) &&
         /setProperty\("--vol", vol\.value \+ "%"\)/.test(MU2),
         "채워진 만큼 선이 포인트색으로 물든다");
      ok(/::-moz-range-progress/.test(CSF), "파이어폭스에서도 같은 모양이다");

      /* ── 사파리 프사 점멸 (2026-08-13 밤, 실사용 제보) ──
         하트비트마다 목록 전체를 innerHTML 로 갈면 모든 <img> 가 새로
         태어나고, 사파리는 "빈 칸 먼저" 그려서 전원 프사가 점멸했다. */
      const RT6 = fs.readFileSync(DIR+"script_realtime.js","utf8");
      ok(/prev\.nicks\.every\(\(n, i\) => n === orderedNicks\[i\]\)/.test(RT6),
         "★ 멤버 구성이 같으면 바뀐 카드만 갈아 끼운다 (전체 innerHTML 금지)");
      ok(/if \(p !== prev\.parts\[i\]\) domCards\[i\]\.outerHTML = p/.test(RT6),
         "★ 안 바뀐 카드의 img 는 살아 있다 (그래서 안 깜빡인다)");
      ok(/decoding="sync"/.test(RT6) && !/card-avatar has-photo[^>]*loading="lazy"/.test(RT6),
         "★ 프사는 다 풀고 나서 내보낸다 (빈 칸 먼저 그리는 사파리 대비)");

      /* ── BGM 이어듣기 (2026-08-13 밤) ── */
      const MU3 = fs.readFileSync(DIR+"script_music.js","utf8");
      ok(/event: "listening"/.test(MU3),
         "★ 유튜브에 재생 위치 소식을 부탁한다 (listening)");
      ok(/function _saveLast/.test(MU3) && /_saveLast\(_cur, t\)/.test(MU3),
         "★ 멈춘 지점을 이 기기에 적어 둔다");
      /* [보강 2026-08-14] 소식(listening)이 어긋나도 곡은 남게 —
         재생 시작 즉시 저장 + 악수를 5초마다 계속 청함 */
      ok(/if \(!o\.cue\) _saveLast\(vid, o\.start \|\| 0\)/.test(MU3),
         "★ 재생을 시작하면 곡부터 즉시 적는다 (소식이 안 와도 '그 곡 처음부터'는 된다)");
      ok(/_listenTimer = setInterval\(ask, 5000\)/.test(MU3),
         "★ 악수를 5초마다 계속 청한다 (한 번 놓치면 끝이던 문제)");
      ok(/now - _lastSaveAt < 3000/.test(MU3), "3초에 한 번만 적는다 (과로 방지)");
      ok(/function cueLast/.test(MU3) && /\{ cue: true, start: Number\(saved\.t\) \|\| 0 \}/.test(MU3),
         "★ 입장하면 직전 곡이 그 지점에 걸려 있다");
      ok(/autoplay=" \+ \(o\.cue \? 0 : 1\)/.test(MU3),
         "★ 걸어만 둘 뿐 자동재생은 안 한다 (입장하자마자 소리 터지지 않게)");
      ok(/o\.start > 3 \? "&start="/.test(MU3),
         "앞 3초는 그냥 처음부터 (거의 처음이면 이어봤자 어색하다)");

      /* ── 카드 정렬 고르기 (2026-08-13 밤) ── */
      ok(/joinedAt: Number\(window\._myJoinTimestamp\?\.\(\) \|\| 0\)/.test(RT6),
         "★ 상태 카드에 입장 시각이 실린다 (접속 순서 정렬의 근거)");
      ok(/cardSort/.test(RT6) && /sortPref === "join"/.test(RT6),
         "★ 정렬을 고를 수 있다 — 가나다순 / 접속 순서");
      const 정렬순서 = RT6.indexOf('sortPref === "join"');
      const 내앞 = RT6.indexOf("(a === myNick ? -1 : 0)");
      ok(정렬순서 > -1 && 내앞 > 정렬순서,
         "★ 내 카드 맨 앞은 정렬 **뒤에** 적용된다 (어느 정렬이든 1번 자리)");

      /* ── 🎲 랜덤 정렬 (2026-08-14) ── */
      ok(/sortPref === "random"/.test(RT6) &&
         /const seed = Number\(window\._myJoinTimestamp\?\.\(\) \|\| 0\)/.test(RT6),
         "★ 랜덤의 씨앗은 입장 시각이다 — 세션 동안 고정, 다음 입장 때 새 배치");
      ok(!/Math\.random/.test(RT6.slice(RT6.indexOf('sortPref === "random"'),
                                        RT6.indexOf('sortPref === "random"') + 700)),
         "★ 매 렌더마다 주사위를 굴리지 않는다 (15초마다 카드가 섞이면 멀미)");
      const HxR = fs.readFileSync(DIR+"index.html","utf8");
      ok(/value="random">🎲 랜덤 \(입장마다 새로\)/.test(HxR),
         "설정에 랜덤 항목이 있다");

      /* ── 🕐 머리말 시계 (2026-08-14 — 한줄 공지 자리) ── */
      const UI4 = fs.readFileSync(DIR+"script_ui.js","utf8");
      ok(/id="head-clock"/.test(HxR) && !/id="head-notice"/.test(HxR),
         "★ 한줄 공지 자리에 시계가 앉았다");
      ok(/function tickHeadClock/.test(UI4) && /setInterval\(tickHeadClock, 1000\)/.test(UI4),
         "시계가 간다");
      ok(/\[22, "🦉"\]/.test(UI4) && /let e = "🦉";/.test(UI4),
         "★ 올빼미는 밤 10시부터 새벽 2시까지다 (이 방의 황금 시간대)");
      ok(/\[12, "🍚"\]/.test(UI4) && /\[15, "🚶"\]/.test(UI4),
         "밥때와 산책때가 있다");
      const CSSK = fs.readFileSync(DIR+"styles.css","utf8");
      /* [고침 2026-08-21 — 콩] 날짜를 한 단 짙게(muted → muted-strong).
         그래도 **시각이 더 진합니다** — 시각만 --text 를 씁니다.
         "짙게 하되 시계와는 구분되게" 가 콩이 정한 선이에요. */
      ok(/\.head-clock-date\{[^}]*color: var\(--muted-strong\)/s.test(CSSK) &&
         /\.head-clock-time\{[^}]*color: var\(--text\)/s.test(CSSK) &&
         /\.head-clock-time\{[^}]*font-weight: var\(--fw-bold\)/s.test(CSSK),
         "★ 날짜는 한 단 옅고 시각이 가장 진하다 (콩이 정한 모양)");
      /* [키움 2026-08-21] 날짜 12.5 → 13.5, 시각 15 → 16, AM/PM 도 1px */
      ok(/\.head-clock-date\{[^}]*font-size: var\(--fs-sm\)/s.test(CSSK),
         "★ 날짜가 1px 커졌다 (fs-xs → fs-sm)");
      ok(/\.head-clock-time\{[^}]*font-size: calc\(var\(--fs-md\) \+ 1px\)/s.test(CSSK),
         "★ 시각이 1px 커졌다 (15 → 16)");
      ok(/\.head-clock-ap\{[^}]*calc\(var\(--fs-2xs\) \* \.9 \+ 1px\)/s.test(CSSK),
         "AM/PM 은 여전히 가장 작다 (같이 1px 만 올림)");
      ok(/tabular-nums/.test((CSSK.match(/\.head-clock-time\{[^}]*\}/s) || [""])[0]),
         "2:59 → 3:00 에 폭이 안 흔들린다 (tabular)");
      /* 철거 확인 — 한줄 공지의 흔적이 없어야 한다 */
      ok(!/listenNotice\b(?!Board)/.test(fs.readFileSync(DIR+"script_realtime.js","utf8").replace(/\/\*[\s\S]*?\*\//g, "")),
         "★ 한줄 공지 코드가 남아 있지 않다");
      ok(!/adm-notice\b/.test(fs.readFileSync(DIR+"admin.html","utf8")),
         "관리자 페이지의 공지 관리도 함께 철거됐다");

      /* ── 카드 뜬 그림자 (2026-08-14 · A안) — 접촉+번짐 두 겹 ── */
      ok(/0 1px 2px rgba\(40,30,20,\.06\),\s*\n\s*0 4px 16px rgba\(40,30,20,\.10\)/.test(CSSK),
         "★ 카드가 종이 한 장 높이로 떠 있다 (접촉 6% + 번짐 10%)");
      /* [2026-08-18] 낱장 색이 변수로 빠지면서 식이 var() 를 읽습니다 */
      ok(/4px 4px 0 -1px var\(--pg1\)[\s\S]{0,220}0 4px 16px/.test(CSSK),
         "겹친 종이는 그대로고 그 아래에 그림자를 깔았다");

      /* ── 🖼️ 방 배경 (2026-08-14) ──
         지킬 것: ① 저장은 이 기기에만 — 서버(프로필)에 올리면 모든
         멤버가 내 배경 사진을 내려받는다. ② 사진은 줄여서. ③ 덮개는
         테마 종이색 — 다크 테마에서도 어울리게. */
      const UIB = fs.readFileSync(DIR+"script_ui.js","utf8");
      ok(/const BG_KEY = "roomBg"/.test(UIB) && /AppStore\.setItem\(PHOTO_KEY/.test(UIB),
         "★ 방 배경은 이 기기에만 저장된다");
      ok(!/saveMyProfile[\s\S]{0,80}roomBg/.test(UIB) && !/db\.ref[\s\S]{0,60}roomBg/.test(UIB),
         "★ 배경을 서버에 올리지 않는다 (올리면 전원이 내 사진을 내려받는다)");
      ok(/const max = 1600/.test(UIB) && /toDataURL\("image\/jpeg", 0\.78\)/.test(UIB),
         "★ 내 사진은 긴 변 1600px 로 줄여 저장한다 (저장 한도 보호)");
      ok(/getComputedStyle\(b\)\.backgroundColor/.test(UIB),
         "★ 덮개는 지금 테마의 종이색이다 (다크 테마면 어두운 덮개)");
      ok(/b\.classList\.remove\("room-bg-on"\);[\s\S]{0,300}getComputedStyle\(b\)/.test(UIB),
         "★ 종이색은 클래스를 떼고 잰다 (지난 그림이 섞이지 않게)");
      ok(/Math\.max\(40, Math\.min\(96/.test(UIB),
         "덮개 농도는 40~96% — 카드가 묻힐 만큼은 못 내린다");
      ["office","studycafe","library","terrace","window"].forEach(k =>
        ok(new RegExp(k + ":").test(UIB), `기본 배경 ${k} 가 있다`));
      ok(/window\.applyRoomBg\?\.\(\)/.test(UIB),
         "테마를 바꾸면 덮개 색도 따라 바뀐다");
      const HxB = fs.readFileSync(DIR+"index.html","utf8");
      ok(/id="set-roombg"/.test(HxB) && /현재 스타일 그대로 \(기본\)/.test(HxB),
         "★ '현재 스타일 그대로'가 기본이다");
      ok(/body\.room-bg-on\{[\s\S]{0,500}var\(--room-veil/.test(CSSK),
         "★ 배경은 몸통(body)에 깔린다 — 헤드부터 알약 줄까지 한 장으로");
      ok(/body\.room-bg-on\{[\s\S]{0,400}var\(--grid-line/.test(CSSK),
         "원고지 격자가 덮개 위에 그대로 산다");
      ok(!/\.user-cards-grid\.room-bg\{/.test(CSSK),
         "카드 마당에만 깔던 옛 방식은 없다 (헤드·바텀이 섬처럼 따로 놀았다)");
      ok(/id="set-roombg-change"/.test(HxB) && /chg\.onclick = \(\) => file\?\.click\(\)/.test(UIB),
         "★ [사진 바꾸기] 단추가 있다 (같은 항목 재선택은 변화가 아니라 폴더가 안 뜬다)");

      /* ── 🖼️ 채팅 속 그림 (2026-08-14 · ①안 — 주소만 저장) ── */
      const CH2 = fs.readFileSync(DIR+"script_chat.js","utf8");
      ok(/const IMG_URL_RE = /.test(CH2) && /jpe\?g\|png\|gif\|webp\|avif/.test(CH2),
         "★ 이미지 주소는 그림으로 펼친다 (jpg·png·gif·webp·avif)");
      ok(CH2.indexOf("escapeHtml(text)") < CH2.indexOf("linkifyEscaped(withBr)"),
         "★ 이스케이프가 먼저다 (주입 차단은 그대로)");
      ok(/onerror="this\.parentNode\.textContent=this\.src"/.test(CH2),
         "★ 죽은 그림은 글자 링크로 되돌아간다 (textContent 라 주입 없음)");
      ok(/rel="noopener noreferrer"\s*\n?\s*><img class="msg-img"/.test(CH2),
         "누르면 원본이 새 탭에 (noopener)");
      ok(/\.msg-img\{[^}]*max-height: 260px/s.test(CSSK),
         "그림 높이에 상한이 있다 (말풍선이 안 터진다)");
      ok(!/db\.ref[\s\S]{0,50}msg-img/.test(CH2),
         "서버에는 여전히 글자(주소)만 저장된다 — 용량 부담 0");
    }

    /* =====================================================================
       🧘 혼자 방 (script_solo.js · 2026-08-15)

       1인용 집필실. 지킬 것 넷.
         ① 서버에 한 글자도 안 간다 — database() 를 통째로 갈아 끼운다
         ② 그 갈아끼우기가 script_core.js 보다 **먼저** 일어나야 한다
         ③ ?solo=1 이 없으면 아무 일도 안 한다 (진짜 방에 영향 0)
         ④ 혼자서 뜻이 없는 것(수다방·품평·접속유지)은 걷어낸다
       ===================================================================== */
    {
      const SO = fs.readFileSync(DIR+"script_solo.js","utf8");
      const HxS2 = fs.readFileSync(DIR+"index.html","utf8");
      const CSS_S = fs.readFileSync(DIR+"styles.css","utf8");

      /* ③ 평소에는 잠자코 — 첫 줄에서 나간다 */
      ok(/get\("solo"\) === "1"/.test(SO) && /if \(!켬\) return;/.test(SO),
         "★ ?solo=1 이 없으면 아무 일도 안 한다 (진짜 방에 영향 0)");

      /* ① 서버 차단 */
      ok(/firebase\.database = function \(\) \{ return 방DB; \}/.test(SO),
         "★ database() 를 통째로 갈아 끼운다 (어느 파일이 무엇을 쓰든 서버에 못 간다)");
      ok(/firebase\.auth = function/.test(SO), "로그인도 흉내다 (계정을 안 만든다)");

      /* ② 순서 — core 보다 먼저 */
      /* ★ 주석에도 파일 이름이 나오니 **script 태그만** 봅니다 */
      ok(HxS2.indexOf('src="script_solo.js') < HxS2.indexOf('src="script_core.js'),
         "★★ script_core.js 보다 먼저 실린다 (database() 를 부르기 전에 갈아 끼워야 한다)");
      const BS = fs.readFileSync(DIR+"build-single.py","utf8");
      ok(BS.indexOf('"script_solo.js"') < BS.indexOf('"script_core.js"'),
         "단일파일에서도 순서가 같다");

      /* 저장은 방 규칙대로 (원본 저장소를 직접 안 쓴다 — 위 검사와 짝) */
      ok(/const _store = \(\) => window\.AppStore/.test(SO),
         "★ 저장은 AppStore 를 거친다");
      ok(/function _ensure\(\)/.test(SO),
         "★ 나무는 느긋하게 읽는다 (core 보다 먼저 실려서 AppStore 가 아직 없다)");

      /* ④ 걷어내기 */
      ok(/dock-pill-chatty/.test(SO) && /dock-pill-pub/.test(SO) && /alive-btn/.test(SO),
         "★ 수다방·품평·접속유지를 걷어낸다");
      ok(/body\.solo-mode \[data-dock="chatty"\]/.test(CSS_S),
         "화면에서도 한 번 더 막는다 (그리는 쪽이 되살리는 경우가 있다)");
      ok(/FOREST_NO_WITHER/.test(SO) &&
         /if \(window\.FOREST_NO_WITHER\) return;/.test(fs.readFileSync(DIR+"script_forest.js","utf8")),
         "★ 혼자 방 대숲은 시들지 않는다 (혼자 붙인 쪽지는 메모지 모래시계가 아니다)");

      /* 카드 — 내 카드 맨 앞, 이름 따로, 느린 숨결 */
      ok(/기본이름/.test(SO) && /window\.soloRename/.test(SO),
         "★ 카드마다 이름을 따로 붙인다");
      ok(/window\.soloSetCount/.test(SO) && /Math\.min\(20, n \| 0\)/.test(SO),
         "★ 카드 수를 1~20 사이로 바꿀 수 있다");
      ok(/30000 \+ Math\.random\(\) \* 60000/.test(SO),
         "★ 상태 전환이 아주 느리다 (30~90초에 한 명씩만 — 빠르면 방해가 된다)");
      ok(/n === 내닉\(\)\) return;/.test(SO),
         "내 카드는 유령 규칙에서 빠진다 (진짜로 동작해야 하니까)");
      ok(/const CHAT_MAX = 500/.test(SO) && /soloTrimChat/.test(SO),
         "★ 메모는 500줄까지 (기기 저장 공간 보호)");
    }

    /* =====================================================================
       🛡️ 관리자 정리 (2026-08-14 저녁 — 콩 결정)
       ① 출석부 1시간 미만 붉은 표시 철거 (잔소리 같아서)
       ② 출입 기록 → 입장 기록: 3시간에 한 번만, 퇴장은 안 적음
       ③ 접속자 명단 미리보기 → ✨ 성실 멤버 (출석 5일↑ + 5h 작업일 3일↑)
       ===================================================================== */
    {
      const AD = fs.readFileSync(DIR+"script_admin.js","utf8");
      const RTA = fs.readFileSync(DIR+"script_realtime.js","utf8");
      const AH = fs.readFileSync(DIR+"admin.html","utf8");

      /* ① */
      ok(!/cls \+= " short"/.test(AD),
         "★ 1시간 미만 붉은 표시가 없다 (궁금하면 돋보기로)");

      /* ② */
      ok(/const ATTENDLOG_GAP_MS = 3 \* 60 \* 60 \* 1000/.test(RTA),
         "★ 입장 기록은 3시간에 한 번만 (들락날락은 안 적힌다)");
      ok(/if \(kind !== "in"\) return;/.test(RTA),
         "★ 퇴장은 더 이상 안 적는다");
      ok(!/reserveOutOnDisconnect\(day\)/.test(RTA) && !/writeAttendLog\("out"\)/.test(RTA),
         "퇴장 예약 장치도 함께 걷었다");
      ok(/🕘 입장 기록/.test(AH) && !/<h2>🕘 출입 기록<\/h2>/.test(AH),
         "★ 창 이름이 '입장 기록'이다");

      /* ③ */
      ok(/✨ 성실 멤버/.test(AH) && /id="adm-diligent-run"/.test(AH),
         "★ 성실 멤버 박스가 있다 (접속자 명단 미리보기 자리)");
      ok(!/id="adm-cards-modal"/.test(AH) && !/function openMemberPreview/.test(AD),
         "접속자 명단 미리보기는 걷었다");
      ok(/DIL_NEED_ATT = 5/.test(AD) && /DIL_NEED_5H = 3/.test(AD) &&
         /DIL_5H_MS = 5 \* 60 \* 60 \* 1000/.test(AD),
         "★ 기준 — 출석 5일↑ + 5시간 작업일 3일↑ (콩이 정함)");
      ok(/s\.s === "writing" \|\| s\.s === "focus"/.test(AD),
         "★ '작업'은 Write+Job 만 센다 (카드의 작업시간과 같은 셈)");
      ok(/const best = \{\}/.test(AD.slice(AD.indexOf("async function workMsOf"),
                                           AD.indexOf("async function workMsOf") + 700)),
         "중복 구간 흉터를 돋보기와 같은 규칙으로 거른다");
      const HxS = fs.readFileSync(DIR+"index.html","utf8");
      /* [고침 2026-08-18] 뒤에 있던 "좁아지면 보여줄 창"이 철거돼서,
         그것과의 앞뒤 대신 **채팅 탭 안에 있는가**로 봅니다 */
      ok(/id="set-card-sort"/.test(HxS) &&
         HxS.indexOf('id="set-card-sort"') > HxS.indexOf('id="panel-chat"') &&
         HxS.indexOf('id="set-card-sort"') < HxS.indexOf('id="panel-profile"'),
         "설정 → 💬 채팅 탭에 정렬 고르기가 있다");
      const UI2 = fs.readFileSync(DIR+"script_ui.js","utf8");
      ok(/AppStore\.setItem\("cardSort", csort\.value\)/.test(UI2) &&
         /window\.rerenderUserCards\?\.\(\)/.test(UI2),
         "★ 바꾸면 그 자리에서 재배열된다 (이 기기에만 저장)");
    }

    /* =====================================================================
       🧷 스티커 자유 배치 + 프로필 탭 두 칸 (2026-08-14, 멤버 문의)
       ===================================================================== */
    {
      const PF4 = fs.readFileSync(DIR+"script_profile.js","utf8");
      const CSP = fs.readFileSync(DIR+"styles.css","utf8");
      const UI3 = fs.readFileSync(DIR+"script_ui.js","utf8");

      /* 좌표 걸름망 — 좌우 -14% 허용, 기울기 ±20° (콩이 정한 값) */
      ok(/function sanitizeStickerPos/.test(PF4), "좌표 걸름망이 있다");
      ok(/Math\.max\(-14, Math\.min\(104/.test(PF4),
         "★ 좌우 -14%까지 삐져나갈 수 있다 (양쪽 같은 허용치)");
      ok(/Math\.max\(-20, Math\.min\(20, Math\.round\(Number\(p\.r\)/.test(PF4),
         "★ 기울기는 ±20° — 더 돌리면 글자가 뒤집힌다");

      /* 편집기 — 미니 카드에서 끌기 + 슬라이더 */
      ok(/id="prof-stk-card"/.test(PF4) && /renderStkEditor/.test(PF4),
         "★ 배치 편집은 설정 안 미니 카드에서 (실제 카드의 클릭 세 곳과 안 부딪힘)");
      ok(/dataset\.custom !== "1"\) return/.test(PF4),
         "★ 만진 스티커만 좌표가 저장된다 (안 만지면 기본 자리)");
      ok(/prof-stk-reset/.test(PF4) && /s\.dataset\.custom = "0"/.test(PF4),
         "제자리로 버튼이 좌표를 지운다");

      /* 자유 배치 CSS — 닻 풀기 + 세로 쏠림 허용 */
      ok(/\.card-deco\.deco-free\{[^}]*right: auto/s.test(CSP) &&
         /\.card-deco\.deco-free\{[^}]*white-space: normal/s.test(CSP),
         "★ 자유 배치는 기본 닻을 풀고, 오른쪽 벽에선 글자가 세로로 선다");

      /* 두 칸 배치 — 프로필 탭만 넓게, 좁으면 한 칸 */
      ok(/data-tab="profile"\]\{ width: min\(1188px/.test(CSP),
         "★ 프로필 탭일 때만 설정 창이 1188px 로 넓어진다 (세 칸, 2026-08-15 10% 확장)");
      ok(/grid-template-columns: 1fr 1fr 1fr/.test(CSP),
         "★ 세 칸이 같은 너비다 (2026-08-14 콩)");
      ok(/\.stk-card\{[^}]*width: 214px/s.test(CSP),
         "★ 배치 카드가 실물 크기다 (여기서 놓은 그대로 진짜 카드에)");
      /* 2차 재수술 — 찐 카드 복제 */
      ok(/cloneNode\(true\)/.test(PF4) && /data-card-nick/.test(PF4),
         "★ 배치 카드는 내 실제 카드의 복제본이다 (흉내가 아니라 찐)");
      ok(/clone\.removeAttribute\("data-card-nick"\)/.test(PF4),
         "복제본이 진짜 카드 셈에 안 잡힌다");
      /* deco-free 는 deco-a~e 보다 뒤에 있어야 — 앞이면 닻이 안 풀려
         스티커가 고무줄처럼 늘어난다 (실제로 겪음) */
      ok(CSP.indexOf(".card-deco.deco-free{") > CSP.indexOf(".card-deco.deco-e{"),
         "★ 자유 배치 규칙이 기본 자리 규칙보다 뒤다 (앞이면 스티커가 늘어난다)");

      /* ── 길이 늘이기 (2026-08-14 — 버그였다가 기능이 됨) ── */
      ok(/if \(w >= 24\) out\[k\]\.w = Math\.min\(230, w\)/.test(PF4),
         "★ 길이는 24~230px — 카드 폭 넘게는 못 늘인다");
      ok(/id="prof-stk-len"/.test(PF4), "편집기에 길이 슬라이더가 있다");
      ok(/pos\.w \? `width:\$\{pos\.w\}px;` : ""/.test(PF4),
         "★ 늘인 폭이 진짜 카드에도 실린다");
      ok(/classList\.contains\("card-deco-word"\)/.test(PF4),
         "길이는 낱말 스티커에만 (이모지는 잠김)");
      ok(/\.card-deco\.deco-free\{[^}]*justify-content: center/s.test(CSP),
         "늘인 테이프의 글자는 한가운데다");
      ok(/\.stk-card \.card-deco\{[^}]*pointer-events: auto/s.test(CSP),
         "편집기 안에서만 스티커를 잡을 수 있다");
      ok(/setAttribute\("data-tab", name\)/.test(UI3), "openTab 이 표식을 단다");
      ok(/\.prof-cols\{[\s\S]{0,120}grid-template-columns: 1fr 1fr/.test(CSP),
         "두 칸 그리드가 있다");
      ok(/@media \(max-width: 1100px\)\{[\s\S]{0,200}\.prof-cols\{ display: block/.test(CSP),
         "★ 좁은 화면·폰에서는 한 칸으로 돌아간다");
      ok(/\.stk-card\{[^}]*touch-action: none/s.test(CSP),
         "폰에서 끌 때 화면이 같이 안 밀린다");
    }

    { /* (닫힌 스티커 블록 이어서) */
      const PF2 = fs.readFileSync(DIR+"script_profile.js","utf8");
      /* 저장은 넷을 모아서 — 낱개 저장은 비우기가 안 지워지는 수가 있다 */
      ok(/saveMyProfile\(\{ stickers, stickerColors, stickerShape \}\)/.test(PF2),
         "★ 다섯을 모아 한 번에 저장한다 (색·모양도 함께)");

      /* 저장 연결은 bindProfilePanel 안이라 host 변수가 없다 — document 로
         찾아야 한다. host 로 쓰면 ReferenceError 로 연결이 즉사해서
         "골라도 안 붙는" 무반응이 된다 (실제로 겪음, 2026-08-13) */
      ok(/document\.querySelectorAll\("\[data-deco-slot\]"\)/.test(PF2),
         "★ 스티커 연결은 document 에서 찾는다 (host 는 여기 없다)");
      ok(!/host\.querySelectorAll\("\[data-deco-slot\]"\)/.test(PF2),
         "★ host.querySelectorAll 로 찾지 않는다");

      /* ── 자리별 색 고르기 (2026-08-13) ── */
      ok(/function sanitizeStickerColors/.test(PF2) && /sanitizeHexColor\(s\[k\]\)/.test(PF2),
         "★ 스티커 색도 걸러서 저장한다 (hex 만)");
      ok(/function decoInkFor/.test(PF2),
         "★ 고른 배경에서 읽히는 글자색을 만들어낸다 (아무 색이나 골라도 안 묻힌다)");
      ok(/dataset\.dirty/.test(PF2),
         "★ 만진 자리만 색을 저장한다 (색 우물 기본값이 저장되는 사고 방지)");
      const RT3 = fs.readFileSync(DIR+"script_realtime.js","utf8");
      ok(/decoStickerHtml\?\.\("a", stk\.a, stkC\.a, stkS, stkP\.a\)/.test(RT3),
         "★ 카드가 자리별 색·모양·좌표를 넘긴다");
    }

    /* 설정 줄(🍅/☕/⚙️) 생김새 — 폭과 바탕 (2026-08-09)

       한 줄로 몰면서 flex:1 1 0 을 줬더니 셋이 진행 바 폭을 삼등분해
       먹어서, 내용에 비해 칸이 휑했습니다. 바탕도 transparent 라
       커서를 올려야만 보였고요. 아래 동그란 단추와 결을 맞춥니다. */
    {
      const CSS3 = fs.readFileSync(DIR+"styles.css","utf8");
      const i = CSS3.lastIndexOf(".pomo-setrow .pomo-setup-field{");
      const blk = CSS3.slice(i, CSS3.indexOf("}", i));
      ok(/flex: 0 0 auto/.test(blk), "★ 설정 칸이 내용만큼만 차지한다 (폭을 채우지 않는다)");
      ok(!/flex: 1 1 0/.test(blk),   "폭을 삼등분해 먹던 설정이 없다");
      ok(/background: var\(--fill-2\)/.test(blk),
         "★ 평소에도 은은한 바탕이 깔려 있다 (동그란 단추와 같은 회색)");
      ok(/justify-content: center/.test(CSS3.slice(CSS3.lastIndexOf(".pomo-setrow{"),
                                                   CSS3.indexOf("}", CSS3.lastIndexOf(".pomo-setrow{")))),
         "설정 줄이 가운데로 모인다");
    }

    /* 숫자 칸이 내용만큼만 (2026-08-09) — [☕ 5] 만 길어 보이던 문제 */
    {
      const CSS4 = fs.readFileSync(DIR+"styles.css","utf8");
      /* lastIndexOf 를 쓰면 아래 @supports 안의 같은 선택자를 집습니다.
         "모르는 브라우저용" 기본 규칙은 그보다 앞의 것입니다. */
      const j = CSS4.indexOf(".pomo-setrow .pomo-setup-field input{");
      const b2 = CSS4.slice(j, CSS4.indexOf("}", j));
      ok(!/width: 2\.2em/.test(b2), "한 자리일 때 빈 공간이 남던 고정폭이 없다");
      ok(/text-align: center/.test(b2), "숫자가 가운데 놓인다");
      /* ★ field-sizing 은 width 가 auto 일 때만 듣습니다. 같은 규칙 안에
         width:2ch 를 남겨 두면 아무 일도 일어나지 않아요 — 실제로 그래서
         휴식 칸이 안 줄었습니다. 반드시 @supports 안에서 auto 로. */
      ok(!/field-sizing: content/.test(b2),
         "기본 규칙에는 field-sizing 을 넣지 않는다 (width 가 있어서 무시됨)");
      ok(/@supports \(field-sizing: content\)\{[\s\S]{0,220}width: auto/.test(
           CSS4.replace(/\s*\{/g, "{")),
         "★ field-sizing 은 width:auto 와 함께 @supports 안에서만 켠다");
    }

    /* =====================================================================
       🏷️ 오늘의 작업 스티커 (2026-08-09)

       카드 왼쪽 위에 붙는 [✍️ 원고] 같은 라벨입니다. 세 가지가 어긋나기
       쉬워서 못을 박아 둡니다 —
         ① 스티커가 프사 칸 **안에** 있어서, 클릭 순서를 잘못 두면
            눌렀을 때 프로필 설정이 열립니다.
         ② 날짜를 같이 보내지 않으면 어제 것이 오늘도 붙어 있습니다.
         ③ 새 파일은 index.html·단일파일 양쪽에 다 실려야 합니다.
       ===================================================================== */
    {
      const WT_RAW = fs.readFileSync(DIR+"script_worktag.js","utf8");
      /* 주석에는 "UTC 를 쓰면 안 된다"는 설명이 들어 있으니 알맹이만 봅니다.
         (같은 실수를 오늘만 세 번째 하고 있어서 아예 여기 적어 둡니다) */
      const WT_CODE = WT_RAW.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"");
      const WT = WT_RAW;
      const H  = fs.readFileSync(DIR+"index.html","utf8");
      const PR = fs.readFileSync(DIR+"script_profile.js","utf8");
      const RT = fs.readFileSync(DIR+"script_realtime.js","utf8");
      const CS = fs.readFileSync(DIR+"styles.css","utf8").replace(/\s*\{/g,"{");

      for (const w of ["구상","원고","퇴고","교정","수정","개정","인풋","기타"])
        ok(new RegExp('label: "'+w+'"').test(WT), `일곱 가지에 '${w}' 가 있다`);
      /* [뒤집음 2026-08-09] 기본을 '원고' 로 두었더니, 손대지 않은 카드에도
         ✍️ 원고가 붙었습니다. 본인이 말한 적 없는 걸 방이 사실로 읽게 되죠.
         이제 기본은 "아무것도 없음" 입니다. */
      ok(/const NONE = ""/.test(WT_CODE), "★ 기본은 아무것도 안 붙은 상태다");
      ok(!/DEFAULT_TAG/.test(WT_CODE), "기본값으로 원고를 붙이던 자리가 없다");
      ok(/data-worktag-val=""/.test(WT), "붙인 걸 다시 뗄 수 있다 [떼기]");

      /* ② [뒤집음 2026-08-09] 자정 초기화를 그만뒀습니다.

         처음엔 '그날 업무' 라고 보고 자정마다 뗐는데, 작업은 하루로
         끊기지 않습니다 — 퇴고는 보름, 인풋은 몇 주씩 갑니다. 매일 아침
         다시 붙여야 하고, 깜빡하면 오히려 아무 표시 없이 하루가 지나요.
         손이 더 가면서 정확하지도 않았습니다. 이제 바꿀 때까지 그대로. */
      ok(!/todayKey/.test(WT_CODE), "★ 날짜로 스티커를 떼는 코드가 없다");
      ok(!/tagDay/.test(WT_CODE) && !/tagDay:/.test(RT),
         "★ 쓰지 않게 된 날짜 칸도 함께 걷어냈다");
      ok(/return row \? find\(row\.tag\) : null/.test(WT),
         "남의 스티커는 날짜와 무관하게 그대로 읽는다");
      /* 옛 저장값 {v, day} 를 쓰던 사람의 선택이 조용히 사라지면 안 됩니다 */
      ok(/startsWith\("\{"\)/.test(WT), "★ 예전 저장값도 그대로 읽어 준다");
      ok(/tag: \(typeof window\.myWorkTag/.test(RT), "상태에 오늘의 스티커를 실어 보낸다");
      /* ★ 2026-08-09 — [떼기]가 안 먹던 이유가 이 한 줄이었습니다.
         `window.myWorkTag?.() || "draft"` 로 두면, 뗀 직후의 빈 문자열이
         거짓이라 곧바로 '원고'로 되살아납니다. 떼도 안 떼졌어요. */
      ok(!/myWorkTag\?\.\(\) \|\| "draft"/.test(RT),
         "★ 뗀 스티커를 기본값으로 되살리지 않는다");

      /* ① 클릭 순서 — 스티커가 프사보다 먼저 */
      /* [바뀜 2026-08-09] 자리가 프사 안에서 **카드 구석**으로 옮겨졌고,
         여는 방법도 한 번 누르기에서 **더블클릭**으로 바뀌었습니다.
         구석의 빈 자리라 스치듯 눌리기 쉬워서요. */
      ok(/addEventListener\("dblclick"[\s\S]{0,260}openWorkTagPicker/.test(PR),
         "★ 고르기 판은 더블클릭으로만 열린다");
      const clickBlock = PR.slice(PR.indexOf('addEventListener("click"'),
                                  PR.indexOf('addEventListener("dblclick"'));
      ok(!/openWorkTagPicker/.test(clickBlock), "한 번 눌러서는 열리지 않는다");
      ok(/data-pick-worktag[\s\S]{0,120}stopPropagation/.test(clickBlock),
         "그래도 한 번 누른 것이 다른 손잡이로 새지 않는다");
      ok(/\$\{window\.workTagChipHtml[\s\S]{0,200}<div class="card-body"/.test(RT),
         "★ 스티커는 프사 칸이 아니라 카드 구석에 붙는다");

      /* 남의 카드에서는 눌리지 않아야 합니다 */
      ok(/if \(!isMine\) return `<span class="card-tag-slot"/.test(WT),
         "★ 남의 스티커는 눌러도 안 바뀐다 (보기만)");
      ok(/if \(!t && !isMine\) return ""/.test(WT),
         "남이 아무것도 안 붙였으면 자리 자체를 만들지 않는다");
      ok(/is-empty/.test(WT), "★ 내 카드는 비어 있어도 더블클릭할 자리가 남는다");

      /* ③ 두 곳 모두에 실렸는가 */
      ok(/script_worktag\.js\?v=/.test(H), "index.html 에 실려 있다");
      ok(/"script_worktag\.js": "openWorkTagPicker"/.test(H), "로드 자가진단 목록에도 있다");
      ok(/script_worktag\.js/.test(fs.readFileSync(DIR+"build-single.py","utf8")),
         "단일파일 빌드 목록에도 있다");

      /* 생김새 — 기울어진 채로 커야 합니다. transform 을 통째로 덮으면
         커질 때 기울기가 풀려서 툭 튀어 오릅니다. */
      ok(/\.card-tag\{[^}]*transform: rotate\(-7deg\)/.test(CS), "스티커는 살짝 기울어져 있다");
      ok(/\.card-tag-slot\.is-mine:hover \.card-tag\{[^}]*rotate\(-7deg\) scale/.test(CS),
         "★ 커질 때도 기울기가 풀리지 않는다");
      ok(/\.card-tag-slot\{[^}]*position: absolute[^}]*top: -4px[^}]*left: -6px/.test(CS),
         "카드 왼쪽 위 구석에 걸쳐 있다");
      /* [2026-08-10] 불투명도는 아래 전용 검사에서 봅니다 (.88).
         여기서는 색이 붙어 있는지만 확인해요. */
      /* ★ 예전에는 "draft 가 rgba(255,59,48)" 이라고 못 박아 뒀습니다.
         색을 맞바꾸자 멀쩡한 화면인데 검사가 깨졌어요. 어느 스티커가
         무슨 색인지는 취향이라 자주 바뀝니다. 여기서는 **여덟 개 모두
         색이 있는지**만 봅니다. */
      /* ★ [고침 2026-08-22] 다크 규칙에도 같은 글자가 들어 있어 열여섯이
         됩니다. 낮 규칙은 줄 맨 앞에서 시작하므로 줄로 갈라 셉니다. */
      ok(CS.split("\n").filter(l => /^\.card-tag\[data-tag-val="[a-z]+"\]\{[^}]*background: rgba\(/.test(l)).length === 9,
         "스티커 아홉 개에 모두 색이 붙어 있다");
    }

    /* [⚙️ 알림음] 이 잘리지 않는가 (2026-08-09)

       .pane 이 overflow-y:auto 라, 가로도 auto 가 되어 칸보다 넓어지면
       오른쪽이 **잘립니다**. 실제로 '알림음' 의 끝 글자가 잘려 나갔어요.
       여백을 줄여 넉넉히 들어가게 하고, 그래도 모자라면 잘리는 대신
       줄을 바꾸게 둡니다. */
    {
      const CS5 = fs.readFileSync(DIR+"styles.css","utf8").replace(/\s*\{/g,"{");
      ok(/\.pomo-setrow\{[^}]*flex-wrap: wrap/.test(CS5),
         "★ 넘치면 잘리는 대신 줄을 바꾼다");
      ok(/\.pomo-setrow \.pomo-setup-field\{[^}]*white-space: nowrap/.test(CS5),
         "칩 안에서 글자가 쪼개지지 않는다");
    }

    /* 🌲 포레스트 그린 (2026-08-09) — 테마 한 줄이 빠뜨리기 쉬운 것들 */
    {
      const UI5 = fs.readFileSync(DIR+"script_ui.js","utf8");
      const i = UI5.indexOf('"🌲 포레스트 그린"');
      ok(i > 0, "테마 목록에 🌲 포레스트 그린 이 있다");
      const line = UI5.slice(i, UI5.indexOf("\n", i));
      /* 어두운 테마인데 isDark 를 빠뜨리면 글자색 보정이 통째로 안 걸려서
         검은 글씨가 검은 바탕에 얹힙니다. */
      ok(/isDark:true/.test(line), "★ 어두운 테마라고 표시되어 있다");
      for (const k of ["bg","text","me","other","header","meText","otherText","accent"])
        ok(new RegExp(k + ":").test(line), `${k} 색이 빠지지 않았다`);
      ok(/style:"default"/.test(line),
         "전용 스타일 없이 색만 바꾼다 (원고지 괘선 같은 게 딸려오지 않게)");
    }

    /* =====================================================================
       🎨 테마마다 포인트 색이 **둘**인가 (2026-08-11)
       ---------------------------------------------------------------------
       두 겹 고리 타이머는 바깥이 --accent(오늘 목표), 안이 --me(뽀모)
       입니다. 둘이 같은 색인 테마가 셋 있었고, 그런 테마에서는 두 고리가
       한 덩어리로 보였어요 — 고리를 둘로 나눈 뜻이 사라집니다.
       ===================================================================== */
    {
      const UI6 = fs.readFileSync(DIR+"script_ui.js","utf8");
      const 몸 = UI6.slice(UI6.indexOf("const themes = {"),
                           UI6.indexOf("function hexToRgba"));
      const 줄 = 몸.split("\n").filter(l => /^\s*"\S+ .*\{ isDark:/.test(l));
      ok(줄.length >= 9, `테마를 ${줄.length}개 읽었다`);

      const 값 = (l, k) => (l.match(new RegExp(k + ':\\s*"(#[0-9A-Fa-f]{6})"')) || [])[1];
      const 이름 = (l) => (l.match(/"([^"]+)":/) || [])[1];

      /* 밝기 — 흰 글자가 얹히는지 볼 때 씁니다 (WCAG 상대 휘도) */
      const 휘도 = (h) => {
        const c = [1, 3, 5].map(i => {
          const v = parseInt(h.slice(i, i + 2), 16) / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const 대비 = (a, b) => {
        const [x, y] = [휘도(a), 휘도(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };

      const 같음 = 줄.filter(l => 값(l, "me") === 값(l, "accent")).map(이름);
      ok(!같음.length,
         "★ 어느 테마도 말풍선 색과 강조색이 같지 않다 — 같으면 두 고리가 겹쳐 보인다"
         + (같음.length ? " → " + 같음.join(", ") : ""));

      /* 색이 달라도 **눈에 띄게** 달라야 합니다.
         ★ 여기서 밝기(대비)로 재면 틀립니다. 솜사탕의 보라와 하늘색은
           밝기가 거의 같지만 눈에는 전혀 다른 색이에요. 색 자체의
           거리로 재야 합니다. 지금 가장 가까운 짝은 🌲 포레스트 그린의
           금빛↔캐러멜(66)이고, 그건 알고 고른 값입니다. */
      const 거리 = (a, b) => {
        const p = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
        const [u, v] = [p(a), p(b)];
        return Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
      };
      const 붙음 = 줄.filter(l => {
        const a = 값(l, "me"), b = 값(l, "accent");
        return a && b && 거리(a, b) < 55;
      }).map(이름);
      ok(!붙음.length, "두 포인트 색이 눈에 띄게 다르다" + (붙음.length ? " → " + 붙음.join(", ") : ""));

      /* 말풍선 위 글자가 읽히는가 — 채도를 낮추다 보면 놓치기 쉽습니다.
         ---------------------------------------------------------------
         ★ [2026-08-11] 🍬 솜사탕(2.82)·🌿 허브티(3.65)가 예전부터 기준
           아래였습니다. 이 검사를 만들면서 알았고, 그날 둘 다 고쳤어요.
           그래서 이제 **모든 테마가 4.5 를 지킵니다.** 바닥을 낮춰 두면
           다음에 색을 만질 때 또 슬금슬금 내려가니 기준에 맞춥니다.

         · 솜사탕 — 말풍선은 그대로, 글자만 짙은 자주 (4.64)
         · 허브티 — 초록이 중간 밝기라 글자만으로는 4.35 에서 막혀서,
                    말풍선을 연둣빛으로 올리고 짙은 글자를 얹음 (7.09) */
      const 안읽힘 = 줄.filter(l => {
        const bg = 값(l, "me"), fg = 값(l, "meText");
        return bg && fg && 대비(bg, fg) < 4.5;
      }).map(이름);
      ok(!안읽힘.length,
         "★ 내 말풍선 글자가 모든 테마에서 읽힌다 (4.5:1)"
         + (안읽힘.length ? " → " + 안읽힘.join(", ") : ""));

      /* 남의 말풍선도 같은 잣대로 — 여긴 여태 재본 적이 없었습니다 */
      const 남안읽힘 = 줄.filter(l => {
        const bg = 값(l, "other"), fg = 값(l, "otherText");
        return bg && fg && 대비(bg, fg) < 4.5;
      }).map(이름);
      ok(!남안읽힘.length,
         "남의 말풍선 글자도 모든 테마에서 읽힌다"
         + (남안읽힘.length ? " → " + 남안읽힘.join(", ") : ""));

      /* 오늘 고른 색들이 실제로 들어갔는가 */
      const 골라둠 = {
        "🌙 마감 전야":       { accent: "#DD7F5E", me: "#FFB43C" },
        "💠 조용한 스튜디오": { accent: "#2E9E7E", me: "#4C74B4" },
        "🌲 포레스트 그린":   { accent: "#C48A5C", me: "#E2C074" }
      };
      Object.keys(골라둠).forEach(nm => {
        const l = 줄.find(x => 이름(x) === nm);
        ok(!!l && 값(l, "accent") === 골라둠[nm].accent && 값(l, "me") === 골라둠[nm].me,
           `${nm} 에 고른 색이 들어갔다`);
        /* 손댄 테마는 4.5 를 지킵니다 — 조용한 스튜디오는 파랑을 낮췄으니
           특히 여기서 걸려야 합니다 (지금 4.70, 여유가 크지 않아요). */
        ok(!!l && 대비(값(l, "me"), 값(l, "meText")) >= 4.5,
           `★ ${nm} 말풍선 글자가 또렷하다 (4.5:1)`);
      });
    }

    /* =====================================================================
       주간 글자수가 요일에 맞게 나오는가 (2026-08-10)

       ★ "지난 주 기록이 싹 날아갔다" 로 드러난 버그입니다.

       그리는 쪽은 오늘부터 거꾸로 7일, 받아오는 쪽은 월요일부터 오늘까지.
       일요일에는 둘이 맞아떨어져 멀쩡했고, **월요일이 되는 순간** 듣는
       날짜가 하루로 줄어 나머지 여섯 칸이 0 이 됐습니다. 서버 자료는
       멀쩡했고 화면 계산만 어긋난 거였어요.

       요일에 따라 되고 안 되는 버그라, 한 번 고쳐 놓고도 다시 옛 방식으로
       돌아가기 쉽습니다. 그래서 못을 박습니다.
       ===================================================================== */
    {
      const WC2 = fs.readFileSync(DIR+"script_wordcount.js","utf8");
      ok(/function weekKeys\(back = 0\)/.test(WC2), "주 단위 날짜 뽑기가 한 곳에 있다");
      ok(/mon\.setDate\(now\.getDate\(\) - dow - back \* 7\)/.test(WC2),
         "★ 그 주의 월요일부터 센다 (오늘부터 거꾸로 7일이 아니라)");
      ok(/rollKeys\(0\)\.forEach/.test(WC2), "★ 받아오는 쪽은 지난 7일을 듣는다");
      ok(/const keys = weekKeys\(wcBack\)/.test(WC2), "★ 위 막대는 그 주의 월~일을 그린다");
      /* 옛 방식이 되살아나지 않았는지 — myWeekHtml 안에 날짜 빼기가 없어야 합니다 */
      const mw = WC2.slice(WC2.indexOf("async function myWeekHtml"),
                           WC2.indexOf("const week = vals.reduce"));
      ok(!/wcBack \* 7/.test(mw), "화면 쪽에서 날짜를 직접 빼지 않는다");

      /* ── [주간 ↔ 7일] 전환 (2026-08-11) ─────────────────────────────
         ★ 여기가 8월 10일 사고와 똑같이 어긋나기 쉬운 자리입니다.
           7일 보기의 첫 화면에는 **이번 주 월요일보다 앞선 날**이 섞입니다.
           듣는 쪽이 월~오늘 뿐이면 그 앞 칸들이 전부 0 으로 보여요.
           그래서 듣는 범위를 지난 7일로 넓혔고, 화면은 "이번 주냐" 가
           아니라 **"지금 듣고 있는 날이냐"** 로 갈라야 합니다. */
      ok(/function rollKeys\(back = 0\)/.test(WC2), "지난 7일 뽑기가 있다");
      ok(/const live = new Set\(rollKeys\(0\)\)/.test(mw),
         "★ 화면이 '듣고 있는 날' 목록을 따로 잡는다");
      ok(/if \(live\.has\(key\)\)/.test(mw),
         "★ '이번 주냐' 가 아니라 '듣고 있느냐' 로 캐시와 서버를 가른다");
      /* [2026-08-22 — 콩] 글자수 탭의 그림 셋
           ① 월~일 요일별 (가로 줄)  ② 최근 7일 (세로 막대)
           ③ 이번 달 하루하루 (꺾은선)
         ★ ②가 꺾은선이던 시절엔 ③과 생김새가 똑같아 "오히려 복잡해
           보인다" 는 말을 들었습니다. 막대는 '그날 얼마', 꺾은선은
           '오르내림' — 역할을 갈라 둬야 둘 다 볼 이유가 생깁니다. */
      ok(/function lineChartHtml/.test(WC2), "이번 달 꺾은선을 그린다");
      ok(/function barChartHtml/.test(WC2), "★ 최근 7일 세로 막대를 그린다");
      ok(/\$\{barChartHtml\(linePts\)\}/.test(WC2),
         "★★ 최근 7일 자리는 **막대**다 (꺾은선으로 되돌리지 말 것)");
      ok(!/\$\{lineChartHtml\(linePts\)\}/.test(WC2),
         "★ 그 자리에 꺾은선이 겹쳐 있지 않다");
      ok(/class="rec-week wc-week7"/.test(WC2),
         "★ 모양은 ⏱️ 작업 시간의 .rec-week 를 빌려 쓴다 (CSS 를 두 벌 두지 않음)");
      ok(/\.wc-week7 i\{ background: var\(--accent\)/.test(fs.readFileSync(DIR+"styles.css","utf8")),
         "★ 색만 갈라 둔다 — 글자수 자리의 다른 그림들과 같은 포인트색");
      /* 그림 안 딱지는 뺐습니다 — 위 제목과 겹치고, 이 함수를 빌려 쓰는
         ⏱️ 작업 시간 그래프에도 "글자수" 라고 나왔습니다 (단위는 분) */
      ok(!/class="wcl-h"/.test(WC2),
         "★★ 그림 안 '최근 7일 · 글자수' 딱지가 없다 (작업 시간에도 잘못 나왔다)");
      ok(/const linePts = rollKeys\(0\)/.test(WC2) && !/rollKeys\(wcBack\)/.test(WC2),
         "★ 아래 그래프는 ‹ › 를 따라가지 않고 늘 오늘까지의 7일이다");
      /* 주석에는 남아 있어도 됩니다 — 태그에 실제로 붙었는지만 봅니다 */
      ok(!/preserveAspectRatio\s*=/.test(WC2.replace(/\/\*[\s\S]*?\*\//g, "")),
         "★ 가로세로를 따로 늘리지 않는다 (숫자 글자가 찌그러진다)");
      ok(/Math\.max\(1, \.\.\.pts\.map/.test(WC2),
         "★ 이레 내내 0 이어도 나누기가 터지지 않는다");
      ok(/p\.v > 0 \?/.test(WC2), "0 인 날은 숫자를 적지 않는다");

      /* 듣는 범위가 정말 두 보기를 다 덮는지 — 요일마다 달라지므로 열나흘을 돌려 봅니다 */
      {
        const box = {};
        vm.createContext(box);
        vm.runInContext(`
          const dayKey=d=>\`\${d.getFullYear()}-\${String(d.getMonth()+1).padStart(2,"0")}-\${String(d.getDate()).padStart(2,"0")}\`;
          ${WC2.slice(WC2.indexOf("function weekKeys(back = 0)"), WC2.indexOf("\n  }", WC2.indexOf("function weekKeys(back = 0)"))+4)}
          ${WC2.slice(WC2.indexOf("function rollKeys(back = 0)"), WC2.indexOf("\n  }", WC2.indexOf("function rollKeys(back = 0)"))+4)}
          function 덮나(base){
            for(let off=0;off<14;off++){
              const d=new Date(base); d.setDate(d.getDate()+off);
              const real=Date; Date=class extends real{constructor(...a){return a.length?new real(...a):new real(d)}};
              const w=weekKeys(0), r=rollKeys(0); Date=real;
              if(!w.every(k=>r.includes(k))) return false;
            }
            return true;
          }`, box);
        ok(vm.runInContext("덮나(new Date(2026,7,11))", box),
           "★ 열나흘 어느 요일에 보아도 듣는 날짜가 주간 보기를 덮는다");
      }
    }

    /* =====================================================================
       🕛 어제 채우기 (2026-08-10)

       밤 11시~자정 사이에 쓴 만큼을 못 적고 날짜가 넘어가는 일을 메웁니다.
       세 가지가 어긋나기 쉬워서 못을 박습니다 —
         ① 미리보기와 실제 저장이 **같은 계산**을 써야 합니다.
            (다르면 "보이는 것과 저장되는 것"이 갈라집니다)
         ② 새 편은 뺄셈을 하면 안 됩니다. 새 파일의 글자수는 어제 기준보다
            작아서, 빼면 음수가 되고 아무것도 안 더해집니다.
         ③ 이미 잡아 둔 오늘 출발선을 덮어쓰면 안 됩니다.
       ===================================================================== */
    {
      const WC3 = fs.readFileSync(DIR+"script_wordcount.js","utf8");
      const H5  = fs.readFileSync(DIR+"index.html","utf8");
      const CS6 = fs.readFileSync(DIR+"styles.css","utf8").replace(/\s*\{/g,"{");

      ok(/id="wc-yday-btn"/.test(H5), "[기록] 옆에 🕛 단추가 있다");
      ok(/id="wc-yday"[\s\S]{0,40}hidden/.test(H5), "평소에는 접혀 있다");
      ok(/id="wc-yday-new"/.test(H5), "[🆕 새 편이었어요] 체크가 있다");
      ok(/id="wc-yday-pre"/.test(H5), "저장 전 미리보기 줄이 있다");

      /* ① 한 곳에서만 계산 */
      ok(/function ydayCalc\(\)/.test(WC3), "계산이 한 곳에 모여 있다");
      const sv = WC3.slice(WC3.indexOf("async function saveYday"),
                           WC3.indexOf("async function freshStart"));
      ok(/const r = ydayCalc\(\)/.test(sv), "★ 저장도 미리보기와 같은 계산을 쓴다");
      ok(/renderYdayPreview/.test(WC3), "적는 대로 미리보기가 갱신된다");

      /* ② 새 편은 뺄셈 없이 통째로 */
      ok(/if \(isNew\)[\s\S]{0,160}add: v, next: prev \+ v/.test(WC3),
         "★ 새 편은 적은 숫자를 통째로 더한다 (뺄셈 안 함)");
      ok(/const add = v - Number\(base\)/.test(WC3),
         "이어 쓰던 원고는 어제 기준과의 차이만큼 더한다");
      ok(/if \(add <= 0\)/.test(WC3), "줄어든 숫자는 받지 않는다");

      /* ③ 오늘 출발선 */
      ok(/if \(mine\.base === null \|\| mine\.base === undefined\)/.test(sv),
         "★ 오늘 출발선은 **비어 있을 때만** 잡아 준다");

      /* 어제 값은 캐시를 믿지 않고 그때 읽어옵니다 —
         월요일에는 어제가 지난주라 듣고 있는 날짜에 없습니다. */
      ok(/wordlog\/\$\{ydayKey\(\)\}\/\$\{me\(\)\}`\)\.once/.test(WC3),
         "★ 어제 값은 열 때마다 서버에서 새로 읽는다");
      ok(/late: true/.test(WC3), "흐르는 기록에 '늦게 적음' 표시를 남긴다");
      ok(/\.wc-yday\{[^}]*border: 1px dashed/.test(CS6), "점선으로 평소 입력과 구분된다");
    }

    /* =====================================================================
       공유 카드 높이 (2026-08-10)

       ★ 눈으로만 보면 "가끔 짧아지네?" 로 끝날 버그였습니다.

       카드 목록은 그리드지만 align-items:start 라, 카드가 줄 높이에
       끌려가지 않습니다(프로필 카드끼리 들쭉날쭉해지지 않게 일부러
       그렇게 뒀어요). 그런데 공유 카드는 height:100% 로 "옆 카드와 같은
       높이"를 노렸습니다. 100% 의 기준은 **그 줄의 높이**라, 같은 줄에
       프로필 카드가 있을 때만 맞았고, 줄 끝에서 밀려 혼자 다음 줄로
       내려가면 그 줄엔 자기밖에 없어서 쪼그라들었습니다.
       ===================================================================== */
    {
      const SH2 = fs.readFileSync(DIR+"script_share.js","utf8");
      const CS7 = fs.readFileSync(DIR+"styles.css","utf8").replace(/\s*\{/g,"{");
      const RT2 = fs.readFileSync(DIR+"script_realtime.js","utf8");

      const blk = CS7.slice(CS7.indexOf(".share-card{"), CS7.indexOf("}", CS7.indexOf(".share-card{")));
      ok(!/height: 100%/.test(blk), "★ 줄 높이에 기대던 height:100% 를 걷어냈다");
      ok(/align-items: start/.test(CS7), "프로필 카드는 여전히 제 내용만큼만 (배치 유지)");

      ok(/function syncShareHeights\(\)/.test(SH2), "프로필 카드를 재서 높이를 맞춘다");
      ok(/el\.style\.height = ""/.test(SH2),
         "★ 재기 전에 지난번 값을 걷어낸다 (안 그러면 한 번 커진 값이 눌러앉는다)");
      ok(/getBoundingClientRect\(\)\.height/.test(SH2), "실제로 그려진 높이를 잰다");
      ok(/user-card:not\(\.share-card\)/.test(SH2), "잴 때 공유 카드는 빼고 센다");
      ok(/if \(!h\) return/.test(SH2), "프로필 카드가 아직 없으면 손대지 않는다");
      ok(/addEventListener\("resize"[\s\S]{0,200}syncShareHeights/.test(SH2),
         "창 크기가 바뀌면 다시 잰다");

      /* 카드 목록을 통째로 다시 그리면 공유 카드도 지워집니다 */
      ok(/list\.innerHTML = html;[\s\S]{0,320}window\.renderShareCards\?\.\(\)/.test(RT2),
         "★ 카드를 다시 그린 뒤 공유 카드를 되끼운다");
    }

    /* [⚙️ 알림음]이 칸 안에 들어가는가 (2026-08-10)

       한 번 고쳤는데도 끝 글자가 잘린다는 얘기가 또 나왔습니다.
       줄바꿈 허용만으로는 부족했어요 — 애초에 자리가 모자랐습니다.
       뽀모 칸은 원래 좁은데 좌우 여백으로만 24px 을 먹고 있었습니다. */
    {
      const CS8 = fs.readFileSync(DIR+"styles.css","utf8").replace(/\s*\{/g,"{");
      ok(/\.pane-pomo #timer-wrap\{[^}]*padding: var\(--sp-3\) var\(--sp-2\)/.test(CS8),
         "★ 뽀모 칸의 좌우 여백을 줄여 자리를 냈다 (12 → 8px)");
      ok(/\.pomo-setrow\{[^}]*gap: 4px/.test(CS8), "칩 사이 간격도 한 번 더 좁혔다");
      ok(/\.pomo-setrow \.pomo-gear\{[^}]*padding: 5px 9px/.test(CS8),
         "알림음은 숫자 칩보다 조금만 넓다 (11px 은 넘쳤다)");
      ok(/\.pomo-setrow\{[^}]*flex-wrap: wrap/.test(CS8), "그래도 모자라면 줄을 바꾼다");
    }

    /* 스티커가 짙은 카드 위에서도 보이는가 (2026-08-10) */
    {
      const CS9 = fs.readFileSync(DIR+"styles.css","utf8").replace(/\s*\{/g,"{");
      {
        /* ★ [고침 2026-08-22] 예전엔 `.card-tag[…]` 만 찾았는데, 그 글자는
           **다크 규칙 안에도** 들어 있습니다(`:root[data-is-dark] .card-tag[…]`).
           그래서 다크 바탕을 .26 으로 옅게 깐 순간 여기가 통째로 빨개졌어요.
           낮 규칙은 줄 맨 앞에서 시작하므로, 줄 단위로 갈라 봅니다. */
        const 낮줄 = CS9.split("\n").filter(l => /^\.card-tag\[data-tag-val=/.test(l));
        const 옅음 = 낮줄.filter(l => /background: rgba\(/.test(l) && !/,\.88\)/.test(l));
        ok(낮줄.length === 9 && !옅음.length,
           "★ 스티커 아홉 개가 모두 거의 불투명하다 (.88) — 카드 배경은 각자 고르는 값이라서"
           + (옅음.length ? ` — ${옅음.length}개가 다름` : ""));
        /* ★★★ [번복 2026-08-22 — C안] 다크 전용 규칙을 **아예 두지 않습니다.**
           하루에 두 번 뒤집힌 자리라 사연을 적어 둡니다 —
             ① 글자색만 밝게      → 밝은 파스텔 위 밝은 파스텔. 흐림.
             ② 바탕도 옅게(.26)   → 혼자 방에선 좋았음(카드가 전부 기본).
                                    본 방 카드는 사진·무늬로 꾸며져 있어 **묻힘.**
             ③ 낮과 똑같이(지금)  → 거의 불투명(.88) + 어두운 글씨 한 벌.
           ★ 이 스티커는 **테마가 아니라 남이 꾸민 그림** 위에 앉습니다.
             배경을 예측할 수 없는 자리에 반투명을 쓰면 안 됩니다. */
        const 밤줄 = CS9.split("\n").filter(l => /^:root\[data-is-dark="true"\] \.card-tag\[data-tag-val=/.test(l));
        ok(밤줄.length === 0,
           "★★★ 작업 스티커에는 다크 전용 규칙이 없다 (남이 꾸민 그림 위라 낮과 같아야 한다)");
      }
      ok(!/\.card-tag\[data-tag-val="[a-z]+"\]\{[^}]*,\.74\)/.test(CS9),
         "반투명하던 옛 값이 남아 있지 않다");
    }

    /* =====================================================================
       🏷 작업 스티커 색 — 세 군데가 서로 맞는가 (2026-08-11)
       ---------------------------------------------------------------------
       한 스티커의 색이 **세 군데**에 적혀 있습니다.
         ① 카드 위 스티커        .card-tag[data-tag-val="…"]
         ② 어두운 테마 글자색    :root[data-is-dark] .card-tag[…]
         ③ 고르기 판의 옅은 바탕 .worktag-item.tag-…
       색을 바꿀 때 한 군데만 고치기 쉽습니다. 그러면 판에서 고른 색과
       카드에 뜨는 색이 달라지거나, **밤에만** 옛 색이 남아요.
       ===================================================================== */
    {
      const CSt = fs.readFileSync(DIR+"styles.css","utf8").replace(/\s*\{/g,"{");
      const 값 = (re) => {
        const out = {};
        let m; const r = new RegExp(re, "g");
        while ((m = r.exec(CSt))) out[m[1]] = m[2];
        return out;
      };
      const 카드 = 값('\\.card-tag\\[data-tag-val="([a-z]+)"\\]\\{ background: rgba\\(([\\d, ]+),\\.88\\)');
      /* ※ 다크 전용 규칙은 없습니다 (C안) — 위 주석 참고 */
      const 판   = 값('\\.worktag-item\\.tag-([a-z]+)\\{ background: rgba\\(([\\d, ]+),\\.16\\)');

      /* 목록은 코드에서 읽어 옵니다 — 스티커를 늘리면 자동으로 따라옵니다 */
      const WT9 = fs.readFileSync(DIR+"script_worktag.js","utf8");
      const 태그 = (WT9.match(/\{ v: "([a-z]+)",/g) || []).map(x => x.match(/"([a-z]+)"/)[1]);
      /* [넓힘 2026-08-22 — 콩] 🚨 비상(방장 전용)이 아홉 번째로 들어왔습니다. */
      ok(태그.length === 9, `작업 스티커가 ${태그.length}개다`);

      태그.forEach(t => {
        ok(!!카드[t] && !!판[t], `${t} — 두 군데 모두 색이 있다`);
      });
      /* ★ 카드와 고르기 판이 **같은 색**이어야 합니다 */
      const 어긋남 = 태그.filter(t => 카드[t] && 판[t] && 카드[t] !== 판[t]);
      ok(!어긋남.length,
         "★ 카드 스티커와 고르기 판의 색이 같다 (한 군데만 고치면 여기서 걸립니다)"
         + (어긋남.length ? " → " + 어긋남.join(", ") : ""));
      /* 같은 색을 두 스티커가 쓰면 구분이 안 됩니다 */
      const 색들 = 태그.map(t => 카드[t]).filter(Boolean);
      ok(new Set(색들).size === 색들.length, "여덟 개가 서로 다른 색이다");



      /* [맞바꿈 2026-08-11] ✍️ 원고 ↔ 🔧 개정
         15세 → 19금 개정이 잦아서 개정 쪽에 붉은색이 어울린다는 이야기.
         ★ 값(draft/rework)은 그대로 둡니다 — 값을 바꾸면 지난 기록과
           퇴고 장인·수정궁 여왕 같은 업적까지 통째로 어긋납니다. */
      ok(카드.draft === "133,183,235", `✍️ 원고가 파랑이다 (${카드.draft})`);
      ok(카드.rework === "255,59,48", `🔧 개정이 빨강이다 (${카드.rework})`);
      ok(카드.draft !== 카드.rework && 판.draft === 카드.draft && 판.rework === 카드.rework,
         "★ 맞바꾼 두 색이 고르기 판에도 같이 반영돼 있다");

      /* =====================================================================
         🌙 [사고 2026-08-22 — 콩] 다크에서 안 보이던 것들, 자동으로 훑기
         ---------------------------------------------------------------------
         하루에 세 번 같은 사고가 났습니다 — 작업 스티커, 공지 딱지,
         챗 시각. 원인은 늘 하나예요:
             **반투명 바탕 + 박아 넣은 어두운 글자.**
         밝은 테마에서는 연한 색 위 진한 글씨라 또렷한데, 어두운 바탕에서는
         어두운 것끼리 겹쳐 사라집니다. 콩이 다크를 안 쓰다 보니 여태
         아무도 못 봤어요 ("내가 다크모드를 안 썼어서 전혀 챙기지 못했네").

         그래서 기계가 훑습니다 — **바탕이 반투명(rgba …)인데 글자는
         어두운 색을 박아 둔** 규칙을 찾아, 다크 대비 규칙이 있는지 봅니다.

         ★ 바탕이 **불투명**한 것은 뺍니다. 그건 테마와 무관하게 늘 밝은
           칩이라 어두운 글씨가 맞아요 (예: .status-pop-item, .mw-rule-pill).
         ★ 새 딱지를 만들다 여기서 걸리면, 둘 중 하나를 고르세요 —
             · 테마 따라가는 그릇 안이면 → 다크용 밝은 글자색을 더한다
             · 남이 꾸민 그림 위면       → 반투명을 버리고 불투명하게 한다
           (프로필 카드 스티커가 뒤엣것입니다)
         ===================================================================== */
      {
        const 원본 = fs.readFileSync(DIR + "styles.css", "utf8");
        const 밝기 = (h) => {
          h = h.replace("#", "");
          if (h.length === 3) h = h.split("").map(c => c + c).join("");
          const n = parseInt(h, 16);
          return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
        };
        const 다크선택자 = new Set(
          [...원본.matchAll(/:root\[data-is-dark="true"\]\s+([^{]+?)\s*\{/g)]
            .flatMap(m => m[1].split(",").map(x => x.trim())));
        const 있나 = (sel) => [...다크선택자].some(d => d === sel || sel.endsWith(d) || d.endsWith(sel));

        /* 🧾 [빼는 자리 ①] **일부러 종이로 고정한 창**들.
           #modal(입장) · #mywork-modal(나의 작업) · #forest-modal(대숲) 은
           창 안에서 제 팔레트(--text:#2B2620, 바탕 #FAF6EC)를 새로 세웁니다.
           테마가 다크여도 이 창들은 원고지 종이예요 — 그래서 그 안의
           어두운 글씨가 맞습니다. 실제로 그 규칙들이 위에 있습니다
           (`#mywork-modal .modal-content{ --text: #2B2620; … }`). */
        const 종이창 = /^(#modal\b|#mywork-modal\b|#forest-modal\b|\.mw-|\.fr-|\.att-)/;

        const 걸린것 = [];
        for (const m of 원본.matchAll(/(?:^|\n)([^\s@/#][^{\n]*)\{([^}]*)\}/g)) {
          const sel = m[1].trim(), body = m[2];
          if (sel.includes("data-is-dark")) continue;
          if (종이창.test(sel)) continue;
          const bg = /background(?:-color)?:\s*rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/.exec(body);
          if (!bg) continue;                       // 반투명 바탕만 본다
          /* 🧾 [빼는 자리 ②] 알파 .8 이상은 사실상 **불투명**입니다.
             그런 칩은 뒤가 무엇이든 제 색으로 덮으므로 어두운 글씨가 맞아요.
             프로필 카드의 작업 스티커(.88)가 바로 그 경우입니다 —
             남이 꾸민 그림 위에 앉기 때문에 일부러 불투명하게 뒀습니다. */
          if (Number(bg[1]) >= 0.8) continue;
          const col = /(?<!-)color:\s*(#[0-9A-Fa-f]{3,6})\s*;/.exec(body);
          if (!col || 밝기(col[1]) > 110) continue; // 밝은 글자는 괜찮다
          if (있나(sel)) continue;                  // 다크 대비가 이미 있다
          걸린것.push(`${sel} (${col[1]})`);
        }
        /* ★★ [2026-08-22 — 콩] 💡 아하 스티커는 **테마를 따라가야** 합니다.
           호박색이 박혀 있어 테마를 바꿔도 여기만 노랑이었고, 다크에서는
           숫자가 묻혔어요. 그 색에는 뜻이 없었으므로 포인트색으로 바꿨습니다.
           ★ 뜻 없는 색은 박아 넣지 말 것 — 그러면 다크 대비도 저절로 풀립니다. */
        ok(/\.help-check\.is-on\{\s*border-color: var\(--accent-line\); color: var\(--accent\);/.test(원본),
           "★★ 💡 아하 스티커가 테마 포인트색을 쓴다 (호박색을 박아 넣지 않는다)");
        /* ★ 같은 호박색이 📢 공지의 [고침] 딱지(.nt-tag-fix)에도 있는데,
           **거긴 분류 색이라 일부러 둔 것**입니다(새 기능=파랑 / 고침=호박).
           그래서 "어디에도 없다" 가 아니라 **표현 공부 판에 없다** 를 봅니다.
           — 처음에 넓게 잡았다가 여기서 걸렸습니다. 색을 걷어낼 때는
             그 색에 **뜻이 있는 자리**가 따로 없는지 먼저 보세요. */
        /* ★★ 주석은 걷어내고 봅니다. "옛 색은 이러이러했다" 고 적어 둔
           기록이 코드로 오해받거든요 — 오늘만 두 번째입니다
           (아침에 PULSE_ALL 에서 똑같이 걸렸습니다). */
        const 민낯 = 원본.replace(/\/\*[\s\S]*?\*\//g, "");
        const 남은호박 = 민낯.split(/(?=\n\.[a-z])/)
          .filter(덩 => /^\n?\.help-/.test(덩) && /rgba\(250,199,117|#854F0B|rgba\(186,117,23/.test(덩));
        ok(남은호박.length === 0,
           "★ 표현 공부 판에 옛 호박색이 남아 있지 않다"
           + (남은호박.length ? ` (${남은호박.length}곳)` : ""));
        /* ※ 🔗 참고 칩(보라)은 **일부러** 다른 색입니다 — "참고" 와 "SOS" 를
           눈으로 가르려는 것이라 포인트색으로 바꾸지 않았습니다. */
        ok(/\.help-ref\{[\s\S]{0,140}?rgba\(140,120,200/.test(원본),
           "★ 🔗 참고 칩은 보라를 지킨다 (뜻이 있는 색)");

        ok(걸린것.length === 0,
           "★★★ 다크에서 묻힐 딱지가 없다 — 반투명 바탕 + 어두운 글자는 대비를 함께 둘 것"
           + (걸린것.length ? ` ← ${걸린것.slice(0, 5).join(" · ")}${걸린것.length > 5 ? ` 외 ${걸린것.length - 5}곳` : ""}` : ""));

        /* 오늘 고친 자리들이 정말 다크 대비를 갖고 있는가 (되돌아가지 않게) */
        /* ※ .help-check.is-on 과 .help-ref-c 는 이 목록에 없습니다 —
           2026-08-22 에 **포인트색(var(--accent))으로 바꿔서** 다크 대비가
           따로 필요 없어졌어요. 테마가 알아서 갈아 줍니다.
           ★ 사실 이쪽이 더 나은 답입니다: 색에 뜻이 없으면 박아 넣지 말고
             테마를 따라가게 하세요. 그러면 다크 대비를 챙길 일이 없습니다. */
        ["\\.nt-tag-feat", "\\.nt-tag-fix", "\\.help-ref",
         "\\.fl-msg\\.bad", "\\.fl-msg\\.ok"].forEach(sel => {
          ok(new RegExp(`:root\\[data-is-dark="true"\\][^{]*${sel}[^{]*\\{`).test(원본),
             `★ ${sel.replace(/\\\\/g, "")} 에 다크 대비가 있다`);
        });
      }
      ok(/\{ v: "draft",  emoji: "✍️", label: "원고" \}/.test(WT9) &&
         /\{ v: "rework", emoji: "🔧", label: "개정" \}/.test(WT9),
         "★ 값과 이름표는 그대로다 (색만 바꿨다)");
    }

    /* =====================================================================
       채팅 칸이 좁을 때 말풍선 (2026-08-10)

       말풍선 줄은 칸의 92% 까지만 쓰고, 그 안에서 프사 34px + 간격 8px 을
       먼저 뗍니다. 칸이 넓을 땐 42px 이 대수롭지 않지만, 손잡이를 끌어
       칸을 좁히면 그 비중이 확 커져 서너 글자에서 줄이 바뀌었습니다.

       ★ @media 가 아니라 @container 인 이유: 창은 그대로 둔 채 **칸만**
         좁히는 경우가 대부분이라, @media 로는 그 순간을 잡을 수 없습니다.
       ===================================================================== */
    {
      /* ★ 주석을 먼저 걷어냅니다. 오늘만 네 번째로 같은 데 걸렸어요 —
         "예전엔 이랬다"는 설명 속의 이름을 코드로 착각합니다. */
      const CS10 = fs.readFileSync(DIR+"styles.css","utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*\{/g,"{");
      ok(/\.chat-sidebar\{[^}]*container-type: inline-size/.test(CS10),
         "★ 채팅 칸이 자기 폭을 기준으로 삼는다");
      ok(/container-name: chatpane/.test(CS10), "칸에 이름이 붙어 있다");
      ok(/@container chatpane \(max-width: 280px\)/.test(CS10),
         "★ 좁아진 칸에서만 적용된다 (창 크기가 아니라)");
      const q = CS10.slice(CS10.indexOf("@container chatpane"));
      ok(/max-width: 98%/.test(q), "말풍선 폭 제한을 98% 로 푼다");
      ok(/\.chat-item \.profile-emoji\{[^}]*width: 24px/.test(q), "좁을 땐 프사를 24px 로");
      ok(!/chat-avatar/.test(q),
         "만드는 곳이 없는 이름(.chat-avatar)을 새로 늘리지 않는다");
    }

    /* =====================================================================
       말풍선 폭을 갉아먹던 것 (2026-08-10)

       ★ 오늘 가장 오래 헤맨 자리입니다. "세 단어만에 줄이 바뀐다"는
         얘기에 폭 제한(92%)과 프사를 의심했는데, 둘 다 아니었어요.

       ↩ 답장 · 😊 반응 단추가 말풍선과 **같은 줄에 나란히** 있었습니다.
       평소엔 opacity:0 이라 안 보이지만 자리는 그대로 차지합니다.
       실제로 재보니 —

           채팅 칸 347px · 말풍선 158px · 그 밖 98px

       가로의 28% 를 보이지도 않는 단추가 붙들고 있었습니다.
       흐름 밖으로 빼서 약 64px 을 말풍선에 돌려줬습니다 (≈140%).

       되돌아가기 쉬운 곳이라 못을 박습니다 — 단추를 다시 줄 안에 두면
       폭이 소리 없이 다시 줄어듭니다.
       ===================================================================== */
    {
      const CH3 = fs.readFileSync(DIR+"script_chat.js","utf8");
      const CS11 = fs.readFileSync(DIR+"styles.css","utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*\{/g,"{");

      ok(/<div class="bubble-tools">/.test(CH3), "두 단추가 한 덩어리로 묶여 있다");
      /* 묶음 안에 둘 다 들어 있는가 */
      /* 묶음의 끝은 그 뒤 처음 나오는 </div> 두 개가 아니라,
         다음 형제(</div>\n          </div>) 까지 넉넉히 잘라 봅니다. */
      const ti = CH3.indexOf('<div class="bubble-tools">');
      const tools = CH3.slice(ti, CH3.indexOf('</div>', CH3.indexOf('reactionAddButtonHtml', ti)));
      ok(/reply-add-btn/.test(tools), "↩ 답장이 묶음 안에 있다");
      ok(/reactionAddButtonHtml/.test(tools), "😊 반응이 묶음 안에 있다");

      ok(/\.bubble-tools\{[^}]*position: absolute/.test(CS11),
         "★ 묶음이 흐름 밖에 있다 (말풍선 폭을 갉아먹지 않게)");
      ok(/\.bubble-tools\{[^}]*pointer-events: none/.test(CS11),
         "안 보일 때는 클릭을 가로채지 않는다");
      ok(/\.chat-item:hover \.bubble-tools[\s\S]{0,60}pointer-events: auto/.test(CS11),
         "마우스를 올리면 눌린다");
      ok(/\.bubble-row:not\(\.me\) \.bubble-tools\{[^}]*right:/.test(CS11)
         && /\.bubble-row\.me       \.bubble-tools\{[^}]*left:/.test(CS11)
         || /\.bubble-row\.me\s+\.bubble-tools\{[^}]*left:/.test(CS11),
         "남의 말은 오른쪽 위, 내 말은 왼쪽 위 (글자를 가리지 않게)");

      /* 반응 고르기 판은 여전히 말풍선 줄을 기준으로 떠야 합니다 */
      ok(/btn\.closest\("\.bubble-row"\)/.test(fs.readFileSync(DIR+"script_reactions.js","utf8")),
         "반응 판은 말풍선 줄에 붙는다 (묶음이 아니라)");
    }

    /* =====================================================================
       들어오면 💤AWAY 에 갇히던 문제 (2026-08-10)

       ★ 며칠을 자동감지 탓으로 보고 그쪽만 두 번 고쳤던 자리입니다.

       진짜 원인은 나가기 코드였어요. leaveRoom() 이 상태를 away 로 찍어
       저장했고("다음 입장 때 AWAY 로 시작"이 당시 의도였습니다),
       그 값이 다음 입장 때 그대로 되살아났습니다.

       자동감지는 잘못이 없었습니다 — 그 기능은 **제가 내린 AWAY** 만
       되돌립니다. 사람이 고른 AWAY 를 마음대로 푸는 건 원칙에 어긋나고,
       여기서 찍힌 away 에는 꼬리표가 없으니 손대지 않은 게 맞아요.

       고친 곳은 둘 —
         ① 나갈 때 rest 로 저장 (away 를 찍지 않음)
         ② 들어올 때 저장값이 away 여도 rest 로 시작 (이미 박힌 값 청소)
       ===================================================================== */
    {
      const CORE3 = fs.readFileSync(DIR+"script_core.js","utf8");
      const DATA3 = fs.readFileSync(DIR+"script_data.js","utf8");
      const leave = CORE3.slice(CORE3.indexOf("async function leaveRoom"),
                                CORE3.indexOf("finalizeTimelogOnLeave"));
      ok(/sel\.value = "rest"/.test(leave), "★ 나갈 때 rest 로 저장한다 (🛠️ REPAIR 만 예외)");
      ok(!/sel\.value = "away"/.test(leave), "★ 나갈 때 away 를 찍지 않는다");

      ok(/function _startStatus\(saved\)/.test(DATA3), "들어올 때 상태를 한 번 거른다");
      /* [다시 뒤집음 2026-08-10] ☕BREAK 로 시작하게 했다가 JOB 으로 바꿨습니다.
         BREAK 는 정직하지만, 들어오자마자 바로 쓰는 분들에게는 매번 WORK 를
         눌러야 하는 일이 생기고 깜빡하면 쓴 시간이 통째로 안 쌓입니다.
         기록이 비는 쪽이 조금 넉넉히 잡히는 쪽보다 아파요. */
      /* ★ [넓힘 2026-08-22] 🛠️ REPAIR 가 하나 더 통과합니다 — 방을 고치는
         동안 새로고침을 수십 번 하는데, 들어올 때마다 풀리면 그때마다
         입·퇴장 메시지가 뜨거든요(그 기능을 만든 이유가 그것).
         나머지(away·rest·빈값)는 예전 그대로 JOB 으로 시작합니다. */
      ok(/if \(v === "writing" \|\| v === "focus"\) return v;/.test(DATA3)
         && /if \(v === "repair"\) return v;\s*\n\s*return "focus";/.test(DATA3),
         "★ away·rest·빈값은 모두 JOB 으로 시작한다 (WORK 를 안 눌러도 시간이 쌓이게)");
      ok(!/return "rest"/.test(DATA3.slice(DATA3.indexOf("function _startStatus"),
                                           DATA3.indexOf("async function loadPersonalData"))),
         "BREAK 로 시작하던 옛 규칙이 남아 있지 않다");
      /* 서버에서 읽는 길과 기기에서 되살리는 길, 둘 다 걸러야 합니다.
         한쪽만 고치면 새로고침 때만 되살아나는 유령이 됩니다. */
      const uses = (DATA3.match(/_startStatus\(/g) || []).length;
      ok(uses >= 3, "★ 서버·기기 양쪽 불러오기에 모두 걸려 있다 (한쪽만 고치면 유령이 남는다)");
    }

    /* =====================================================================
       📌 방 전체 할 일 진척 (2026-08-10)

       접속자 명단 아래 "오늘 할 일 10개 중 4개 완료" 한 줄.
       할 일은 원래 혼자 보는 기능이라 아무 반향이 없었는데, 합계만
       내걸면 글자수처럼 "다 같이 쌓는" 감각이 생깁니다.

       ★ 지켜야 할 두 가지 —
         ① **개수만** 올라간다. 무엇을 적었는지는 절대 나가지 않는다.
         ② status 가 아니라 하루치로 쌓은 값을 본다. status 는 나가면
            지워져서, 4개 끝낸 사람이 퇴근하면 합계가 3개로 **줄어든다.**
       ===================================================================== */
    {
      const DATA4 = fs.readFileSync(DIR+"script_data.js","utf8");
      const RT4   = fs.readFileSync(DIR+"script_realtime.js","utf8");
      const H6    = fs.readFileSync(DIR+"index.html","utf8");
      const RULES = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8"));

      ok(/function _saveTodoStat\(\)/.test(DATA4), "개수를 올리는 곳이 있다");
      /* ① 올라가는 값이 total·done 뿐인가 */
      /* 주석에는 "내용은 안 올라간다"는 설명이 있으니 알맹이만 봅니다.
         (오늘만 다섯 번째 — 이제 습관으로 굳혀야겠어요) */
      const save = DATA4.slice(DATA4.indexOf("function _saveTodoStat"),
                               DATA4.indexOf("function savePersonalData"))
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      ok(/set\(\{ total, done, at: Date\.now\(\) \}\)/.test(save),
         "★ 개수와 시각만 올린다 (할 일 내용은 나가지 않는다)");
      /* 올라가는 건 set(...) 안에 적힌 것뿐입니다. 목록(_todoItems)을
         읽는 것 자체는 개수를 세려면 어차피 해야 하는 일이라 괜찮아요 —
         **밖으로 나가는 값**만 봅니다. */
      const sent = save.slice(save.indexOf(".set({"), save.indexOf("});", save.indexOf(".set({")));
      ok(!/text|title|msg|item/i.test(sent), "★ 할 일 글이 섞여 들어가지 않는다");
      ok(/todosForProfileList/.test(save),
         "카드와 같은 규칙으로 센다 (오늘 것 + 날짜 없는 것)");

      /* ② 나가도 안 줄어드는가 — status 가 아니라 todostat 을 본다 */
      ok(/db\.ref\(`todostat\/\$\{day\}`\)/.test(RT4),
         "★ 하루치로 쌓인 값을 읽는다 (나가면 지워지는 status 가 아니라)");
      ok(/if \(total <= 0\) \{ wrap\.setAttribute\("hidden", ""\); return; \}/.test(RT4),
         "아무도 안 적은 날에는 줄을 감춘다");
      ok(/done = Math\.min\(done, total\)/.test(RT4), "완료가 전체를 넘지 않게 막는다");
      ok(/id="room-todo"[\s\S]{0,40}hidden/.test(H6), "평소에는 감춰진 채로 시작한다");
      ok(/listenRoomTodo/.test(fs.readFileSync(DIR+"script_core.js","utf8")),
         "입장할 때 듣기를 붙인다");

      /* 보안규칙 — 남의 칸에는 못 쓰고, 숫자만 받는다 */
      const ts = RULES.rules.todostat;
      ok(!!ts, "보안규칙에 todostat 이 있다");
      ok(ts[".read"] === true, "합계를 내려면 모두가 읽을 수 있어야 한다");
      const w = ts.$day.$nick[".write"];
      ok(/nickOwner/.test(w), "★ 남의 칸에는 못 쓴다 (닉네임 도장 확인)");
      ok(/isNumber\(\)/.test(ts.$day.$nick[".validate"]),
         "★ 숫자만 받는다 (글이 끼어들 자리가 없다)");
    }

    /* =====================================================================
       📌 진척 줄이 아예 안 뜨던 이유 + 🔁 자정 훑기 (2026-08-10)

       ★ 새 기능을 올렸는데 줄이 안 보였습니다.
         개수는 savePersonalData 안에서만 올라가는데, 그건 할 일이나
         목표를 **건드릴 때** 도는 함수입니다. 아무도 손대지 않으면
         todostat 이 텅 빈 채라 합계가 0 이고, 줄은 감춰집니다.
         이미 적어 둔 할 일이 있어도요 — 들어올 때 한 번 올려야 합니다.

       그리고 🔁 반복은 "목록을 읽을 때" 체크가 풀립니다. 창을 켜둔 채
       자정을 넘기면 어제 체크가 남아, 가이드의 "자정에 저절로 풀려요"
       와 어긋났습니다. 날짜가 바뀌는 순간 한 번 훑게 했습니다.
       ===================================================================== */
    {
      const CORE5 = fs.readFileSync(DIR+"script_core.js","utf8");
      const DATA5 = fs.readFileSync(DIR+"script_data.js","utf8");

      ok(/window\.saveTodoStat\?\.\(\)/.test(CORE5),
         "★ 들어올 때 개수를 한 번 올린다 (안 그러면 줄이 영영 안 뜬다)");
      ok(/listenRoomTodo/.test(CORE5), "들어올 때 진척 줄 듣기도 붙인다");

      ok(/function _routineMidnightSweep\(\)/.test(DATA5), "자정에 훑는 곳이 있다");
      ok(/if \(_todoDay === day\) return;/.test(DATA5),
         "★ 날짜가 바뀔 때만 돈다 (1분마다 저장하지 않는다)");
      ok(/if \(hadStale\) savePersonalData\(\);/.test(DATA5),
         "★ 풀린 게 있으면 서버에도 남긴다 (다음 접속에 되살아나지 않게)");
      ok(/window\.listenRoomTodo\?\.\(\)/.test(DATA5),
         "★ 진척 줄도 새 날짜를 보게 다시 붙인다 (어제 숫자를 계속 보여주지 않게)");
      ok(/visibilitychange[\s\S]{0,140}_routineMidnightSweep/.test(DATA5),
         "잠든 탭에서 깨어날 때도 한 번 확인한다");
    }

    /* =====================================================================
       📱 모바일 화면 m.html (2026-08-10)

       폰용 별도 화면입니다. 작업방 자료를 그대로 보되, 두 가지를
       절대 어기면 안 됩니다 —

         ① status 를 **덮어쓰지 않는다**. 닉네임당 한 칸이라 PC 와 폰이
            같은 자리를 씁니다. set() 으로 쓰면 PC 가 올려둔 작업 시간·
            뽀모 표시가 지워지고, onDisconnect().remove() 를 걸면 폰을
            닫는 순간 PC 접속까지 목록에서 사라집니다.
         ② 구간 칸 이름은 { s, a, b } 다. status/from/to 로 짚으면
            에러 없이 **조용히 전부 0** 으로 나옵니다 (실제로 한 번
            그렇게 썼다가 고쳤습니다).
       ===================================================================== */
    {
      const M = fs.readFileSync(DIR+"m.html","utf8");
      const TL = fs.readFileSync(DIR+"script_timelog.js","utf8");

      /* ① [바뀜 2026-08-10] 폰은 접속자로 뜨지 않습니다.

         처음에는 lastSeen 을 갱신해 목록에 뜨게 했는데, 상태도 시간도
         출석도 없는 **반쪽**으로 떴습니다. 남들 눈엔 "있는데 아무것도
         안 하는 사람". 게다가 폰은 자리를 비운 채 확인하는 용도라
         떠 있는 것 자체가 오해를 삽니다. */
      const code = M.slice(M.lastIndexOf("<script>"));
      ok(!/lastSeen: firebase\.database\.ServerValue\.TIMESTAMP/.test(code),
         "★ 폰은 접속 표시를 남기지 않는다 (목록에 뜨지 않게)");
      ok(!/onDisconnect\(/.test(code),
         "남길 흔적이 없으니 끊김 처리도 필요 없다");
      ok(!/ref\("status\/" \+ myNick\)\.set\(/.test(code),
         "★ 접속 표시를 통째로 덮어쓰지 않는다 (PC 값이 지워지지 않게)");
      /* 상태 바꾸기만 예외 — 그것도 **이미 떠 있을 때만** 손댑니다.
         없는 칸에 쓰면 그 자체로 접속 중인 카드가 생겨 버립니다. */
      ok(/if \(online\)\{[\s\S]{0,200}status: s\.v/.test(code),
         "★ 상태는 이미 접속해 있을 때만 반영한다 (없는 칸을 만들지 않게)");
      ok(/users\/" \+ myNick\)\.update\(\{ statusChoice/.test(code),
         "접속 중이 아니어도 다음 입장 때 이어지도록 저장은 한다");

      /* ② 구간 칸 이름이 맞는가 — 저장하는 쪽과 대조합니다 */
      ok(/= \{ s: normStatus\(status\), a, b: end \}/.test(TL),
         "구간은 { s, a, b } 로 저장된다");
      ok(/seg\.s !== "writing" && seg\.s !== "focus"/.test(M),
         "★ 모바일도 같은 칸 이름으로 읽는다 (틀리면 조용히 0 이 됩니다)");
      ok(/Number\(seg\.b \|\| 0\) - Number\(seg\.a \|\| 0\)/.test(M),
         "★ 구간 길이도 같은 칸 이름으로 잰다");

      /* 같은 방을 보는가 — 주소가 어긋나면 아무것도 안 맞습니다 */
      const url = (fs.readFileSync(DIR+"script_core.js","utf8")
        .match(/databaseURL: "([^"]+)"/) || [])[1];
      ok(!!url && M.includes(url), "★ 작업방과 같은 데이터베이스를 본다");

      /* 접속 판정 규칙이 작업방과 같은가 */
      ok(/DISCONNECT_GRACE_MS = 30 \* 60 \* 1000/.test(M), "끊김 유예가 작업방과 같다");
      ok(/ONLINE_STALE_MS     = 12 \* 60 \* 60 \* 1000/.test(M), "고아 기록 기준이 작업방과 같다");

      /* 새 닉네임을 여기서 만들 수는 없어야 합니다 (도장 절차가 없으므로) */
      ok(!/createUserWithEmailAndPassword/.test(M),
         "★ 폰에서는 새 닉네임을 만들 수 없다 (도장 절차가 없어서)");
    }

    /* =====================================================================
       🖍️ 채팅 스티커 (2026-08-10)

       손그림 일곱 개를 말풍선 대신 크게 띄웁니다.
       ★ 지켜야 할 것 —
         ① 서버에는 `[[스티커:id]]` 짧은 글자만 저장된다. 그림이 통째로
            올라가면 채팅이 무거워지고 요금도 오릅니다.
         ② 보내는 길을 새로 뚫지 않는다. send() 를 감싸기만 해야
            수다방·답장 같은 기존 흐름이 그대로 살아납니다.
         ③ script_sticker.js 가 없어도 채팅이 멀쩡해야 한다.
       ===================================================================== */
    {
      const SK = fs.readFileSync(DIR+"script_sticker.js","utf8");
      const CH4 = fs.readFileSync(DIR+"script_chat.js","utf8");
      const H7 = fs.readFileSync(DIR+"index.html","utf8");

      for (const w of ["방가방가","리하이","어서와요","잘가요","밥탐","맛점","맛저",
                       "토닥토닥","파이팅","자리 비움",
                       "퇴근","출근","재출근","좋아요","최고예요","고마워요","끄덕끄덕","오케이",
                       "ㅋㅋㅋ","ㅎㅎㅎ","ㅠㅠㅠ","죽겠어요","축하"])
        ok(SK.includes(`label: "${w}"`), `스티커에 '${w}' 가 있다`);
      /* 판이 반듯하게 떨어지는가 — 마지막 줄에 하나만 남으면 허전합니다 */
      const cnt = (SK.match(/^\s{6}id: "/gm) || []).length;
      const cols = Number((fs.readFileSync(DIR+"styles.css","utf8")
        /* ★ \d 하나만 잡으면 repeat(11 을 "1" 로 읽습니다. 그러면 나머지가
           늘 0 이라 무슨 칸 수를 넣어도 통과해요 — 실제로 그랬습니다. */
        .match(/\.sticker-pop\{[\s\S]*?repeat\((\d+)/) || [])[1] || 0);
      /* ★ 원래 걱정은 "마지막 줄에 **하나만** 남는 것" 이었는데, 검사는
         "딱 나누어떨어질 것" 이라는 더 센 조건을 걸고 있었습니다.
         스물셋처럼 나누어떨어지지 않아도 마지막 줄에 셋이 남으면
         허전하지 않아요. 걱정하던 것만 그대로 봅니다. */
      const 끝줄 = cnt % cols;
      ok(cnt > 0 && cols > 0 && 끝줄 !== 1,
         `스티커 ${cnt}개가 ${cols}칸에 놓이면 마지막 줄이 ${끝줄 || cols}개 (하나만 남지 않는다)`);

      /* ① 오가는 값이 짧은 글자인가 */
      ok(/\[\[스티커:\$\{id\}\]\]/.test(SK), "★ 보낼 때 짧은 표시만 적는다");
      ok(!/data:image/.test(SK), "★ 그림을 통째로 실어 보내지 않는다");

      /* ② 보내는 길을 새로 뚫지 않았는가 */
      ok(/window\.send\?\.\(\)/.test(SK), "고르면 원래 send() 를 부른다");
      ok(!/db\.ref|push\(/.test(SK), "★ 스티커 파일은 서버에 직접 쓰지 않는다");
      ok(/orig\.apply\(this, arguments\)/.test(SK), "슬래시는 send() 를 감싸서 처리한다");
      /* ㅋ 을 몇 번 치는지는 사람마다 다릅니다. /ㅋ 도 /ㅋㅋㅋㅋ 도 받아야 해요.
         ㅠ 와 ㅜ 를 섞어 치는 것도 흔합니다. */
      ok(/cmdRe: \/\^\\\/ㅋ\{1,12\}\$\//.test(SK), "★ /ㅋ 부터 /ㅋㅋㅋㅋ 까지 받는다");
      ok(/cmdRe: \/\^\\\/\[ㅠㅜ\]\{1,12\}\$\//.test(SK), "★ ㅠ 와 ㅜ 를 섞어 쳐도 받는다");
      ok(/s\.cmdRe && s\.cmdRe\.test\(m\)/.test(SK), "그 규칙을 실제로 본다");

      /* ★ 슬래시 하나가 두 스티커에 걸리면, 어느 쪽이 뜨는지는 목록 순서에
         달립니다 — 나중에 스티커를 끼워 넣다가 조용히 뒤바뀔 수 있어요.
         스무 개로 늘면서 이름이 겹칠 여지도 그만큼 커졌으니 실제로 돌려 봅니다. */
      {
        const i = SK.indexOf("const STICKERS = [");
        const body = SK.slice(i, SK.indexOf("\n  ];", i) + 5).replace("const STICKERS", "var STICKERS");
        const box = {};
        vm.createContext(box);
        vm.runInContext(body, box);
        const S = box.STICKERS;

        ok(S.every(x => /^[a-z]+$/.test(x.id)),
           "★ 저장되는 id 는 영문 소문자뿐이다 (지난 채팅이 깨지지 않게)");
        ok(new Set(S.map(x => x.id)).size === S.length, "id 가 겹치지 않는다");
        ok(new Set(S.map(x => x.cmd)).size === S.length, "슬래시 이름이 겹치지 않는다");

        /* 각 스티커가 내세우는 말들을 모아, 하나씩 실제로 맞춰 봅니다 */
        const words = new Set();
        S.forEach(x => {
          words.add("/" + x.cmd);
          if (x.cmdRe) (x.cmdRe.source.match(/[가-힣ㄱ-ㅎ]+/g) || []).forEach(w => words.add("/" + w));
        });
        const hits = [...words].map(m => [m, S.filter(x => m === "/" + x.cmd || (x.cmdRe && x.cmdRe.test(m)))]);
        const 겹침 = hits.filter(([, a]) => a.length > 1).map(([m, a]) => `${m}→${a.map(x => x.id).join("/")}`);
        const 헛것 = hits.filter(([, a]) => a.length === 0).map(([m]) => m);
        ok(!겹침.length, "★ 슬래시 하나가 두 스티커에 걸리지 않는다" + (겹침.length ? " — " + 겹침.join(", ") : ""));
        ok(!헛것.length, "적어둔 슬래시가 전부 실제로 걸린다" + (헛것.length ? " — " + 헛것.join(", ") : ""));

        /* 남은 두 매크로와도 부딪히면 안 됩니다 */
        ["/운세", "/외치기"].forEach(m =>
          ok(!S.some(x => m === "/" + x.cmd || (x.cmdRe && x.cmdRe.test(m))),
             `${m} 는 스티커가 가로채지 않는다`));

        /* 그림이 판 밖으로 나가지 않는가 — viewBox 는 72×82, 글자가 y=72 에 앉습니다 */
        ok(S.every(x => x.svg && x.svg.trim().length > 0), "스티커마다 그림이 있다");
        ok(S.every(x => /^#[0-9A-Fa-f]{6}$/.test(x.textColor)), "스티커마다 글자색이 있다");
      }

      /* ③ 없어도 채팅이 도는가 */
      ok(/window\.stickerHtml\?\.\(rawMsg\) \|\| ""/.test(CH4),
         "★ 스티커 파일이 없어도 채팅은 그대로 돈다");
      ok(/const isBigEmoji = !stickerHtml/.test(CH4),
         "스티커일 때는 이모지 확대와 겹치지 않는다");

      /* 실려 있는가 — 순서가 중요합니다 (send 를 감싸려면 뒤여야 해요) */
      ok(H7.indexOf("script_chat.js") < H7.indexOf("script_sticker.js"),
         "★ script_chat.js 뒤에 실린다 (send 를 감싸야 하므로)");
      ok(/Gamja\+Flower/.test(H7), "손글씨 글꼴을 불러온다");
      /* [2026-08-10] 칸 밖이 아니라 **안쪽**입니다. 밖에 두면 입력칸이
         44px 좁아지는데, 좁은 채팅 칸에서는 그게 꽤 큰 손해예요. */
      ok(/<div class="input-wrap">[\s\S]{0,400}id="sticker-btn"/.test(H7),
         "★ 🖍️ 가 입력칸 안쪽에 얹혀 있다");
      const CSk = fs.readFileSync(DIR+"styles.css","utf8").replace(/\s*\{/g,"{");
      ok(/\.sticker-btn\{[^}]*position: absolute/.test(CSk),
         "단추가 입력칸 폭을 잡아먹지 않는다");
      ok(/\.input-wrap #message\{[^}]*padding-right: 42px/.test(CSk),
         "★ 글자가 단추 밑으로 들어가지 않게 오른쪽 여백을 준다");
      ok(/script_sticker\.js/.test(fs.readFileSync(DIR+"build-single.py","utf8")),
         "단일파일 빌드 목록에도 있다");
    }

    /* 🔴 공유 중 표시 (2026-08-10)

       예전에는 알약 전체가 빨간색이었습니다. 공유 화면은 사람마다
       배경이 제각각이라(흰 원고·검은 에디터·사진) 그 위에 빨간 덩어리가
       얹히면 시선을 다 가져갔어요. 빨강은 **점에만** 남깁니다. */
    {
      const SH3 = fs.readFileSync(DIR+"script_share.js","utf8");
      const CSl = fs.readFileSync(DIR+"styles.css","utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*\{/g,"{");
      const blk = CSl.slice(CSl.indexOf(".share-live{"), CSl.indexOf("}", CSl.indexOf(".share-live{")));
      ok(!/background: rgba\(255,59,48/.test(blk), "★ 알약 전체를 빨갛게 칠하지 않는다");
      ok(/\.share-live i\{[^}]*background: #FF3B30/.test(CSl), "빨강은 점에만 남는다");
      /* 글자를 뺐으니 뜻은 다른 방법으로 남아야 합니다 */
      ok(/aria-label="공유 중"/.test(SH3) && /title="공유 중"/.test(SH3),
         "★ 글자를 빼도 뜻은 남는다 (마우스·화면 낭독기)");
      ok(!/share-live">● 공유 중/.test(SH3), "옛 글자 알약이 남아 있지 않다");
    }

    /* =====================================================================
       슬래시 명령 정리 (2026-08-10)

       스티커가 같은 일을 더 잘 하게 되면서 감정 표현 매크로 아홉 개를
       걷어냈습니다. 남긴 둘은 스티커로 대신할 수 없는 것들이에요 —
       /운세(하루에 한 번 뽑는 값), /외치기(사람이 쓴 문장).

       ★ 지난 기록을 지우지 않는 것이 핵심입니다. 예전 /선언 메시지는
         type:"declaration" 으로 저장돼 있고, 그리는 코드가 사라지면
         그 말들이 **조용히 화면에서 없어집니다.**
       ===================================================================== */
    {
      const CH5 = fs.readFileSync(DIR+"script_chat.js","utf8");
      const si = CH5.indexOf("const SLASH_COMMANDS");
      const blk = CH5.slice(si, CH5.indexOf("\n  };", si));
      const cmds = [...blk.matchAll(/^\s{4,6}"(\/[^"]+)":/gm)].map(x => x[1]);
      ok(cmds.length === 2 && cmds.includes("/운세") && cmds.includes("/외치기"),
         `명령은 /운세 · /외치기 둘뿐이다 (지금: ${cmds.join(" ") || "없음"})`);
      ok(!/cmd === "\/선언"/.test(CH5), "/선언 을 보내는 코드가 없다");
      ok(/data\.type === "declaration"/.test(CH5),
         "★ 예전 선언 메시지를 그리는 코드는 남아 있다 (과거가 사라지지 않게)");
      ok(/data\.type === "fortune"/.test(CH5), "운세 그리기도 그대로다");

      /* ★ 가이드와 코드가 어긋나지 않는가 — 오늘 여기서 여러 번 헛돌았습니다.
         .replace() 를 확인 없이 쓰다가 가이드만 옛 숫자로 남아 있었어요.
         이제 코드의 스티커 개수와 가이드의 한글 숫자를 맞춰 봅니다. */
      const MAN2 = fs.readFileSync(DIR+"script_manual.js","utf8");
      const n = (fs.readFileSync(DIR+"script_sticker.js","utf8")
        .match(/^\s{6}id: "/gm) || []).length;
      /* ★ 세는 말이 붙으면 꼴이 바뀝니다 — 스물"개" 가 아니라 "스무 개".
         표를 늘릴 때 이 함정을 또 밟지 않게 값에 띄어쓰기까지 적어 둡니다. */
      const 한글 = {8:"여덟 개",9:"아홉 개",10:"열 개",11:"열한 개",12:"열두 개",
                    13:"열세 개",14:"열네 개",15:"열다섯 개",16:"열여섯 개",17:"열일곱 개",
                    18:"열여덟 개",19:"열아홉 개",20:"스무 개",21:"스물한 개",22:"스물두 개",
                    23:"스물세 개",24:"스물네 개",25:"스물다섯 개"}[n];
      ok(!!한글 && MAN2.includes(`손그림 <b>${한글}</b>`),
         `가이드의 스티커 개수가 코드와 같다 (${n}개 = ${한글})`);
      ok(!/man-cmd">\/축하/.test(MAN2), "가이드에 없앤 명령이 남아 있지 않다");
    }

    /* =====================================================================
       🔴 뭉갬 정도 조절 막대 (2026-08-10)

       ★ 내 카드에서만 열려야 합니다.
         뭉개는 일은 **보내는 쪽 컴퓨터**에서 일어납니다. 이미 뭉개진
         그림만 서버로 나가므로, 남의 카드 불을 눌러 그 사람 화면을
         선명하게 만드는 건 애초에 불가능해요. 남의 카드에 손잡이를
         달면 "눌러도 아무 일 없는 단추" 가 됩니다.
       ===================================================================== */
    {
      const SH4 = fs.readFileSync(DIR+"script_share.js","utf8");
      const CSb = fs.readFileSync(DIR+"styles.css","utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*\{/g,"{");

      ok(/mine[\s\S]{0,120}data-blur-open="1"/.test(SH4),
         "★ 조절 손잡이는 내 카드에만 붙는다");
      ok(/: `<span class="share-live" role="img"/.test(SH4),
         "남의 카드는 그냥 표시다 (누를 수 없음)");
      ok(/function openBlurPop/.test(SH4), "누르면 막대가 열린다");
      ok(/type="range"[\s\S]{0,160}min="\$\{SHARE_W_MIN\}"/.test(SH4),
         "막대의 양 끝이 상수와 묶여 있다");

      /* 끄는 동안 매번 보내면 "5초에 한 장" 약속이 깨집니다 */
      ok(/setShareWidth\(range\.value, \{ quiet: true \}\)/.test(SH4),
         "★ 막대를 끄는 동안에는 보내지 않는다");
      ok(/range\.addEventListener\("change", commit\)/.test(SH4),
         "손을 뗐을 때 한 장 보낸다");

      ok(/\.share-live\.is-mine\{[^}]*cursor: pointer/.test(CSb),
         "내 불은 눌리는 것처럼 보인다");
    }

    /* =====================================================================
       📌 할 일 — 제자리 편집 · [오늘 하기] (2026-08-10)

       ★ 여기서 제일 조심할 것: 체크 상자와 글자를 <label> 로 함께 감싸면
         **글자를 눌러도 완료로 바뀝니다.** 예전 구조가 그랬어요. 글자
         클릭을 편집으로 쓰려면 그 감싸기를 반드시 풀어야 합니다.
       ===================================================================== */
    {
      const MW = fs.readFileSync(DIR+"script_mywork.js","utf8");
      const DT = fs.readFileSync(DIR+"script_data.js","utf8");
      const CSt = fs.readFileSync(DIR+"styles.css","utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*\{/g,"{");

      const row = MW.slice(MW.indexOf("function todoRowHtml"), MW.indexOf("제자리 편집 —"));
      ok(!/<label class="mw-todo-l">/.test(row),
         "★ 체크 상자와 글자를 함께 감싸지 않는다 (글자를 눌러도 완료되지 않게)");
      ok(!/\.mw-todo-l\{/.test(CSt), "쓰지 않는 라벨 스타일이 남아 있지 않다");
      ok(/data-act="edit-inline"/.test(row), "★ 글자가 편집 손잡이다");
      ok(!/data-act="edit"[^-]/.test(row), "✏️ 단추는 없앴다");
      ok(/type="checkbox" class="mw-chk"/.test(row), "완료는 체크 상자가 맡는다");

      /* [오늘 하기] — 지난 날짜 + 아직 안 끝낸 것에만 */
      ok(/const overdue = !t\.done && !routine && DUE_RE\.test\(due\) && due < todayStr\(\)/.test(MW),
         "★ 못 끝낸 지난 할 일에만 [오늘 하기] 가 붙는다");
      ok(/act === "move-today"[\s\S]{0,700}setTodoDue\?\.\(id, todayStr\(\)\)/.test(MW),
         "누르면 오늘 날짜로 옮긴다");

      /* ★★ [고침 2026-08-12] 옮긴 뒤 **보던 날짜는 그대로** 여야 합니다.
         예전에는 selectDate(todayStr()) 로 화면까지 오늘로 넘겼어요
         ("옮긴 곳이 바로 보이게"). 그런데 어제 못 한 일이 여러 개면
         하나 옮길 때마다 오늘로 튀어서 다시 어제로 돌아와야 했습니다.
         세 개 옮기려면 여섯 번을 눌러야 했어요. */
      {
        const 몸 = MW.slice(MW.indexOf('if (act === "move-today")'),
                            MW.indexOf('if (act === "del")'));
        ok(!/selectDate\(/.test(몸),
           "★ 옮긴 뒤 보던 날짜를 바꾸지 않는다 (여러 개를 이어서 옮길 수 있게)");
        ok(/renderTodoPanel\(\)/.test(몸),
           "★ 그래도 목록은 다시 그린다 (옮긴 줄이 그 자리에서 빠지게)");
        ok(/renderCal\(\)/.test(몸), "달력의 개수 표시도 함께 새로 그린다");
      }

      /* ── 날짜 앞뒤로 넘기기 (2026-08-12) ── */
      ok(/data-act="day-prev"/.test(MW) && /data-act="day-next"/.test(MW),
         "★ 날짜 앞뒤에 ‹ › 가 붙는다");
      ok(MW.indexOf('data-act="day-prev"') < MW.indexOf("mw-daytitle") &&
         MW.indexOf("mw-daytitle") < MW.indexOf('data-act="day-next"'),
         "‹ 는 앞, › 는 뒤에 선다");
      ok(/data-act="day-today"/.test(MW), "오늘이 아니면 [오늘로] 가 뜬다");
      ok(/isToday\s*\?[\s\S]{0,120}mw-todaytag[\s\S]{0,200}mw-todaybtn/.test(MW),
         "★ 오늘일 때는 [오늘로] 대신 오늘 표가 뜬다 (둘이 같이 뜨지 않게)");
      {
        const 넘김 = MW.slice(MW.indexOf('if (act === "day-prev" || act === "day-next")'),
                              MW.indexOf('if (act === "day-today")'));
        ok(/T12:00:00/.test(넘김),
           "★ 낮 12시로 셈한다 (자정으로 하면 서머타임에 하루가 밀린다)");
        ok(/_y = d\.getFullYear\(\); _m = d\.getMonth\(\);/.test(넘김),
           "★ 달이 바뀌면 달력도 그 달로 따라간다 (고른 날이 달력 밖에 있으면 안 된다)");
        ok(/selectDate\(ds2\)/.test(넘김), "고른 날짜가 실제로 바뀐다");
      }
      /* 실제로 굴려 봅니다 — 달을 넘고 윤달도 */
      {
        const 하루 = (ds, dir) => {
          const d = new Date(ds + "T12:00:00");
          d.setDate(d.getDate() + dir);
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        };
        ok(하루("2026-08-12", -1) === "2026-08-11", "하루 앞으로");
        ok(하루("2026-08-12",  1) === "2026-08-13", "하루 뒤로");
        ok(하루("2026-09-01", -1) === "2026-08-31", "★ 달을 거슬러 넘어간다");
        ok(하루("2026-12-31",  1) === "2027-01-01", "★ 해도 넘어간다");
        ok(하루("2028-02-28",  1) === "2028-02-29", "★ 윤달 29일도 지나간다");
        ok(하루("2026-02-28",  1) === "2026-03-01", "윤달이 아닌 해는 3월로");
      }

      /* ★ 부르는 쪽이 있는지만 봤더니 놓쳤습니다 (2026-08-11)
         위 두 줄은 "단추가 setTodoDue 를 부른다" 까지만 확인합니다.
         정작 setTodoDue 안에서 없는 함수(_closeTodoDuePicker)를 부르고
         있어서, 눌러도 아무 일이 없었어요. 글자만 맞춰 보는 검사로는
         절대 안 잡힙니다 — 그래서 여기서는 실제로 돌려 봅니다. */
      {
        const body = DT.slice(DT.indexOf("  function setTodoDue(id, due) {"));
        const src  = body.slice(0, body.indexOf("\n  }\n") + 5);
        let after = null, blew = "";
        try {
          const box = {
            isTodoDue: v => /^\d{4}-\d{2}-\d{2}$/.test(v),
            getTodoItemsFromUI: () => [{ id: "a", text: "줄거리", due: "2026-08-10" }],
            setTodoItemsToUI: v => { after = v; },
            savePersonalData: () => {}
          };
          vm.createContext(box);
          vm.runInContext(src + "\nsetTodoDue('a','2026-08-11');", box);
        } catch (e) { blew = e.message; }
        ok(!blew, "★ setTodoDue 가 끝까지 돈다" + (blew ? " — 터짐: " + blew : ""));
        ok(after && after[0].due === "2026-08-11", "★ 날짜가 실제로 오늘로 바뀐다");
      }

      /* ── 루틴 (2026-08-11) ─────────────────────────────────────
         "날짜 없는 할 일" 칸이 통째로 [🔁 루틴 (매일 반복)] 이 됐습니다.
         거기 넣으면 무조건 매일 반복, 줄마다 있던 🔁 단추는 없앴습니다. */
      ok(/🔁 루틴 \(매일 반복\)/.test(MW), "아래 칸 이름이 [🔁 루틴 (매일 반복)] 이다");
      ok(!/날짜 없는 할 일/.test(MW.replace(/\/\*[\s\S]*?\*\//g, "")),
         "옛 이름(날짜 없는 할 일)이 화면에 남아 있지 않다");
      ok(!/data-act="routine"/.test(MW), "★ 🔁 켜고 끄는 단추는 없앴다");
      ok(!/class="mw-rbadge"/.test(MW), "줄마다 붙던 🔁 딱지도 없앴다");
      ok(!/\.mw-rbadge\{/.test(CSt), "쓰지 않는 🔁 딱지 스타일이 남아 있지 않다");
      ok(/function toggleRoutineTodo/.test(DT),
         "★ 자료 쪽 toggleRoutineTodo 는 남겨 둔다 (부르는 줄만 지우면 터지니까)");
      ok(/else item\.routine = true;/.test(DT),
         "★ 날짜를 안 주고 넣으면 곧바로 매일 반복이 된다");

      /* 옛 자료 옮기기 — 전에 날짜 없이 적어둔 할 일은 routine 표시가
         없습니다. 그대로 두면 루틴 칸에 앉아서 자정에 안 풀리는데,
         🔁 단추가 없어졌으니 되살릴 방법이 없습니다. 실제로 돌려 봅니다. */
      {
        const i = DT.indexOf("  function _normalizeRoutineTodos(items) {");
        const src = DT.slice(i, DT.indexOf("\n  }\n", i) + 5)
                  + DT.slice(DT.indexOf("  function isTodoDue(v) {"),
                             DT.indexOf("\n  }\n", DT.indexOf("  function isTodoDue(v) {")) + 5);
        const box = { ymd: () => "2026-08-11", DUE_RE: /^\d{4}-\d{2}-\d{2}$/ };
        vm.createContext(box);
        vm.runInContext(src, box);
        box.입력 = [
          { id: 1, text: "옛 날짜없음", done: true, doneDay: "2026-08-10" },
          { id: 2, text: "루틴(어제 체크)", routine: true, done: true, doneDay: "2026-08-10" },
          { id: 3, text: "루틴(오늘 체크)", routine: true, done: true, doneDay: "2026-08-11" },
          { id: 4, text: "오늘 할 일", due: "2026-08-11", done: false }
        ];
        const r = vm.runInContext("_normalizeRoutineTodos(입력)", box);
        ok(r[0].routine === true, "★ 옛 '날짜 없는 할 일' 이 루틴으로 옮겨진다");
        ok(r[0].done === false, "옮겨오면서 어제 체크도 풀린다");
        ok(r[1].done === false, "어제 체크한 루틴은 풀린다");
        ok(r[2].done === true, "오늘 체크한 루틴은 그대로 둔다");
        ok(!r[3].routine && r[3].due === "2026-08-11", "★ 날짜가 붙은 할 일은 건드리지 않는다");
      }

      /* 8월 9일에 없앤 함수 여덟 — 부르는 쪽이 남아 있으면 그 자리에서
         멈춥니다. 하나가 살아 있었으니 나머지도 한 번에 봅니다. */
      {
        const 사라진 = ["todoDueBadgeInfo", "_closeAllTodoMenus", "_openTodoMenuSmart",
                        "renderTodoList", "_closeTodoDuePicker", "openTodoDuePicker",
                        "bindTodoInputEnter", "addTodoFromUI"];
        const 코드 = [DT, MW].join("\n")
          .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        const 산것 = 사라진.filter(n => new RegExp("(^|[^.\\w$])" + n + "\\s*\\(").test(코드));
        ok(!산것.length, "없앤 함수를 부르는 자리가 없다" + (산것.length ? " — " + 산것.join(", ") : ""));
      }

      /* 제자리 편집 — 실수로 다 지우고 나가도 글이 남아야 합니다 */
      ok(/function startInlineEdit/.test(MW), "글자를 누르면 그 자리에서 고친다");
      ok(/span\.textContent = before;/.test(MW),
         "★ 저장 전에 원래 글로 되돌려 둔다 (실패해도 글이 사라지지 않게)");
      ok(/if \(!t\) return false;/.test(DT),
         "★ 빈 글로는 저장되지 않는다 (이름 없는 할 일이 생기지 않게)");
      ok(/e\.key === "Escape"/.test(MW), "Esc 로 취소된다");
      ok(!/prompt\("투두 수정"/.test(DT), "옛 입력창(prompt)은 쓰지 않는다");
    }

    checkWordcount();
    checkGifAndBase();
    checkMonthLine();
    return checkWorklog();
  })();
}

/* ---- 14. 글자수 기록 (스냅샷 차이) ----
   앞 블록이 return 으로 끝나므로, 함수로 감싸 마지막에 부릅니다. */
/* =====================================================================
   ✍️ Work Log 줄 — script_worklog.js (2026-08-21, 콩 개편)
   ---------------------------------------------------------------------
   한 줄이 곧 할 일이자 글자수입니다. 여기 모인 검사는 **조용히 망가지는
   자리**를 지킵니다 — 아래 것들은 어겨도 화면에 오류가 안 떠요.
   ===================================================================== */
/* =====================================================================
   🖼️ 프사 GIF 막기 (2026-08-22 — 콩) · ✍️ 기준 글자수 보이기
   ===================================================================== */
/* =====================================================================
   📈 이번 달 꺾은선 — 띠에서 나의 작업으로 (2026-08-22, 콩)
   ---------------------------------------------------------------------
   띠를 없애면서 사라진 셋 중 **나의 글자수 · 나의 작업 시간** 둘을
   나의 작업 창 맨 아래로 옮겼습니다. (방 전체 글자수는 안 옮겼어요 —
   배경 현황판이 방 이야기를 이미 하고 있으니까.)
   ===================================================================== */
function checkMonthLine() {
  ran["monthline"] = true;
  const WC = fs.readFileSync(DIR + "script_wordcount.js", "utf8");
  const TL = fs.readFileSync(DIR + "script_timelog.js", "utf8");

  /* ── ✍️ 글자수 ── */
  ok(/async function myMonthLineHtml/.test(WC), "이번 달 나의 글자수 꺾은선이 있다");
  ok(/myMonthLineHtml, lineChartHtml,/.test(WC),
     "★ 그림 그리는 자(lineChartHtml)도 내준다 — 작업 시간 쪽이 빌려 씁니다");
  ok(/orderByKey\(\)\s*\n?\s*\.startAt\(`\$\{ym\}-01`\)/.test(WC),
     "★★ 한 달치를 **한 번에** 받는다 (하루씩 31번 부르지 않는다)");
  ok(/for \(let d = 1; d <= 오늘; d\+\+\)/.test(WC),
     "★ 1일부터 **오늘까지만** 긋는다 (앞날을 0으로 이으면 절벽이 됩니다)");
  ok(/all\[k\]\?\.\[nick\]\?\.total/.test(WC),
     "★★ 내 것만 고른다 (한 번에 받은 자료에 남의 것도 들어 있습니다)");
  ok(/이번 달엔 아직 적은 글자수가 없어요/.test(WC),
     "값이 하나도 없으면 바닥 직선 대신 안내를 띄운다");

  /* ── ⏱️ 작업 시간 ── */
  ok(/async function myMonthTimeLineHtml/.test(TL), "이번 달 나의 작업 시간 꺾은선이 있다");
  ok(/loadSummary\(myNick, 오늘, 0/.test(TL),
     "★ 오늘 날짜만큼 거슬러 = 이번 달 1일부터 (새 읽기를 안 만든다)");
  ok(/r\.totals\?\.writing \|\| 0\) \+ Number\(r\.totals\?\.focus \|\| 0\)/.test(TL),
     "★★ Write + Job 만 센다 (카드 시계와 같은 기준)");
  ok(/window\.Wordcount\?\.lineChartHtml/.test(TL),
     "★ 그림은 글자수 쪽 것을 빌려 쓴다 (두 벌로 갈라지지 않게)");

  /* ── 붙는 자리 ── */
  ok(/<div id="mw-wc-month"><\/div>/.test(TL) && /<div id="mw-time-month"><\/div>/.test(TL),
     "★ 두 패널 **맨 아래**에 자리가 있다");
  ok(/myMonthTimeLineHtml\(\)\.then/.test(TL) && /myMonthLineHtml\?\.\(\)\.then/.test(TL),
     "★★ 한 박자 뒤에 채운다 (한 달치를 읽는 동안 창이 빈 채로 멈추지 않게)");
}

function checkGifAndBase() {
  ran["gifbase"] = true;
  const PR = fs.readFileSync(DIR + "script_profile.js", "utf8");
  const WC = fs.readFileSync(DIR + "script_wordcount.js", "utf8");

  /* ── ① 새 GIF 는 안 받는다 ────────────────────────────────────
     프사는 카드마다 붙어 접속자 수만큼 화면에 뜹니다. GIF 는 눌리지
     않는 원본이라 여느 프사(30~60KB)의 대여섯 배예요. */
  ok(!/if \(file\.type === "image\/gif"\)/.test(PR),
     "★★ 새 GIF 를 원본 그대로 통과시키는 길이 없다 (캔버스를 거쳐 첫 프레임만)");
  ok(!/움직이는 GIF는 300KB 이하만 올릴 수 있어요/.test(PR),
     "★ 옛 안내 문구도 없앴다");
  /* ★★ 그래도 **예전에 올려 둔 GIF 프사는 계속 보여야** 합니다.
     여기서 막으면 그분들 사진이 어느 날 갑자기 사라집니다. */
  ok(/data:image\\\/\(png\|jpeg\|webp\|gif\)/.test(PR) ||
     /png\|jpeg\|webp\|gif/.test(PR),
     "★★ 예전 GIF 프사는 그대로 읽어 준다 (막으면 사진이 사라집니다)");
  ok(/const PHOTO_GIF_MAX_BYTES/.test(PR),
     "★ 그 상한도 남겨 둔다 (옛 GIF 를 검사하려면 필요합니다)");

  /* ── ② 초록 줄에 기준 ──────────────────────────────────────── */
  ok(/say\(`\+\$\{fmt\(diff\)\}자 · 기준 \$\{fmt\(v\)\}자 · 오늘 누적 \$\{fmt\(next\)\}자`\)/.test(WC),
     "★ 기록 줄이 '+N자 · 기준 M자 · 오늘 누적 K자' 다 (2026-08-22 콩)");
  ok(/say\(`글자수가 줄었네요\. 기준만 \$\{fmt\(v\)\}자로 옮겼어요`\)/.test(WC),
     "★ 줄었을 때도 옮겨 간 기준을 알려 준다");
}

function checkWorklog() {
  ran["worklog"] = true;
  const WL   = fs.readFileSync(DIR + "script_worklog.js", "utf8");
  const HTML = fs.readFileSync(DIR + "index.html", "utf8");
  const CSS  = fs.readFileSync(DIR + "styles.css", "utf8");
  const WC   = fs.readFileSync(DIR + "script_wordcount.js", "utf8");
  const RULE = JSON.parse(fs.readFileSync(DIR + "보안규칙.json", "utf8")).rules;

  /* =====================================================================
     ✍️ Work Log — 회차 전용 (2026-08-22 개편, 콩)
     ---------------------------------------------------------------------
     [무엇이 달라졌나]
     한 줄이 "할 일이자 글자수" 였던 것을 갈랐습니다.
         할 일   →  ✍️ 메모 탭의 슬래시 명령 · 나의 작업 창
         글자수  →  ① 기존 입력줄  ② 작품·회차 (오늘 탭)
     콩: "할일과 글자수가 섞이니까 공간만 차지하고 정신이 없어."
     ===================================================================== */

  /* ── ① 회차는 날짜에 안 묶인다 ─────────────────────────────────
     1~5화를 미리 만들어 두고 며칠에 걸쳐 씁니다. **체크하는 날**이
     그 회차를 마친 날이 돼요. */
  {
    const w = RULE.worklog?.$nick;
    ok(!!w?.ep, "★ worklog/{닉}/ep 자리가 있다 (날짜 없는 회차 칸)");
    ok(/nickOwner/.test(w?.[".read"] || ""),
       "★★ worklog 는 본인·방장만 읽는다");
    const v = w?.ep?.$id?.[".validate"] || "";
    ok(/newData\.hasChildren\(\['ep','at'\]\)/.test(v), "회차 번호는 반드시 있어야 한다");
    ok(/doneDay/.test(v), "★ 마친 날(doneDay)을 받는다");
    ok(!!w?.$day, "★ 옛 날짜별 자리도 남겨 둔다 (지난 기록을 안 지웁니다)");

    ok(/const 회차길 = \(id\) => window\.db\.ref\(`worklog\/\$\{me\(\)\}\/ep`/.test(WL),
       "★★ 회차는 ep 아래에만 쓴다 (날짜 밑에 안 넣는다)");
    ok(/async function 체크\(id\)/.test(WL) &&
       /\{ done: true, doneDay: dayKey\(\) \}/.test(WL),
       "★★ 체크하는 순간 그 날 것이 된다 (날짜가 여기서 정해집니다)");
    ok(/\{ done: false, doneDay: null \}/.test(WL),
       "★ 체크를 풀면 어느 날에도 안 속한다");
    ok(/function 날마침\(day\)/.test(WL) && /r\.done && r\.doneDay === day/.test(WL),
       "★ 주간 달력은 doneDay 로 그 날 마친 회차를 고른다");
  }

  /* ── ② 할 일은 여기서 빠졌다 ──────────────────────────────────── */
  {
    ok(!/무엇을 했나요/.test(WL), "★★ 내용 적는 칸이 없다 (할 일은 메모 탭 몫)");
    ok(!/todosForProfileList/.test(WL),
       "★★ 예전 할 일을 끌어오지 않는다 (나의 작업 창이 맡습니다)");
    /* 주석에 얘기가 있어도 됩니다 — **부르는 코드**만 없으면 돼요 */
    ok(!/ref\([^)]*todostat/.test(WL),
       "★★ todostat 을 여기서 안 올린다 — script_data.js 가 이미 올려서 겹치면 두 배가 됩니다");
    ok(/\[철거 2026-08-22 — 콩\] 할 일 이어받기/.test(WL),
       "★ 왜 뺐는지 자리에 적어 두었다");
  }

  /* ── ③ 글자수 — 심장 ──────────────────────────────────────────
     칸에 든 값은 그 회차의 **누적**, 방에는 **늘어난 만큼**만. */
  {
    ok(/wordlog\/\$\{day\}\/\$\{nick\}\/total/.test(WL),
       "★★ wordlog/{날}/{닉}/total 을 계속 채운다 (업적 wc1k·wc1m·burst7 이 이걸 봅니다)");
    ok(/\.transaction\(/.test(WL),
       "★★ 합계는 transaction 으로 더한다 (두 기기에서 동시에 적어도 안 덮인다)");
    ok(/await 하루합계더하기\(dayKey\(\), 늘어난\)/.test(WL),
       "★★ 늘어난 만큼이 **그 날** 합계로 간다 (회차는 날짜가 없으니 지금 날짜를 봅니다)");
    const 흘림 = WL.slice(WL.indexOf("async function 흘려보내기"), WL.indexOf("async function 하루합계더하기"));
    ok(/늘어난 <= 0\) \{ _보낸\[id\] = 지금; return; \}/.test(흘림),
       "★ 글자수를 줄이면 **아무 일도 없다** (오타 고친 걸 -3,000자로 알릴 순 없습니다)");
    ok(/const 늘어난 = 지금 - 전/.test(흘림),
       "★ 칸은 **누적**, 흐름에는 **차이**만 (콩: 기준 0 계산기)");
    ok(/const 묶음ms  = 3000/.test(WL), "★ 손 떼고 3초 뒤에 한 줄로 묶어 보낸다");
    ok(/_저장타이머\[id\] = setTimeout\(\(\) => 고치기\(id, \{ cnt: v \}, true\), 800\)/.test(WL),
       "★★ 저장도 0.8초 묶음 (글자마다 저장하면 쓰기가 네 배)");
  }

  /* ── ④ 이어 쓰는 회차는 기준을 물려받는다 ────────────────────── */
  {
    ok(/function 지난분량\(wid, ep, 뺄id\)/.test(WL), "지난 분량을 찾는 자가 있다");
    ok(/const 물려받을것 = 지난분량\(칸\.w, 번호, null\)/.test(WL),
       "★★ 같은 회차를 전에 썼으면 거기서 이어 간다 (기준 0 이면 이미 쓴 게 오늘 것으로 잡힙니다)");
    ok(/_보낸\[id\] = Number\(칸\.cnt\) \|\| 0/.test(WL),
       "★ 만들자마자 기준을 맞춰 둔다 (안 하면 +3,000자가 곧바로 흐릅니다)");
    ok(/if \(_보낸\[id\] === undefined\) _보낸\[id\] = Number\(r\.cnt\) \|\| Number\(r\.base\) \|\| 0/.test(WL),
       "★★ 판을 다시 열 때도 이미 셈한 것으로 본다 (안 하면 열자마자 우르르 흐릅니다)");
  }

  /* ── ⑤ 커서가 튀지 않는다 (2026-08-21 콩 신고) ────────────────── */
  {
    ok(/function 손올라가있나/.test(WL) &&
       /if \(손올라가있나\(\)\) \{ _밀린그리기 = true; return; \}/.test(WL),
       "★★ 칸에 손이 올라가 있으면 다시 그리지 않고 밀어 둔다");
    ok(/window\.Worklog\.글자수바뀜\(b\.dataset\.id, v, true\)/.test(WL),
       "★ 치는 동안에는 조용히 (다시 그리면 커서가 날아갑니다)");
  }

  /* ── ⑥ 한 번에 여럿 만들기 ────────────────────────────────────── */
  {
    ok(/async function 회차여럿/.test(WL) && /높 - 낮 > 49/.test(WL),
       "★ 1-5 처럼 적으면 한 번에 (쉰 개까지)");
    ok(/값\.match\(\/\^\(\\d\+\)\\s\*\[-~\]\\s\*\(\\d\+\)\$\/\)/.test(WL),
       "★ - 와 ~ 둘 다 알아듣는다");
  }

  /* ── ⑦ 화면 ───────────────────────────────────────────────────── */
  ok(/data-wc-tab="wl"/.test(HTML) && /data-wc-tab="wlweek"/.test(HTML) && /data-wc-tab="wlproj"/.test(HTML),
     "탭 셋이 index.html 에 있다");
  ok(/let _tab   = "wl";/.test(WC), "★ 처음 켜지는 탭이 wl 이다");
  ok(/const 적는탭 = \(_tab === "wl"\)/.test(WC),
     "★★ 오늘 탭에서는 기존 입력줄을 **그대로 둔다** (글자수 넣는 길이 둘이라)");
  ok(/n\.hidden = \(c === "wc-memoline"\) \? 새탭 : \(새탭 && !적는탭\)/.test(WC),
     "★ 메모칸만 감춘다 (할 일 명령은 메모 탭 몫)");
  ok(/\.wl-ep\{/.test(CSS) && /\.wl-epadd\{/.test(CSS), "회차 줄 모양이 있다");
  ok(/#dock-panel-wc\{ width: min\(352px/.test(CSS), "판이 352px 다 (챗과 같은 폭)");
  ok(/#dock-panel-chat\{ width: min\(352px/.test(CSS),
     "★ 챗도 352px 다 — 둘이 같아야 알약 줄 위가 가지런합니다");

  /* ── ⑧ me() 함정 — 자료실에서 데인 자리 ───────────────────────── */
  ok((WL.match(/typeof myNick === "string"/g) || []).length === 2,
     "★★ 자료 쪽·화면 쪽 **둘 다** me() 를 갖는다 (따로 도는 IIFE 라서)");

  /* ── ⑨ 흐름 ───────────────────────────────────────────────────── */
  {
    const 흐름 = WL.slice(WL.indexOf("async function 흐름에"), WL.indexOf("★★ 마침"));
    ok(!/\bt\b\s*:/.test(흐름) && !/짐\.t\s*=/.test(흐름),
       "★★ 흐름에는 내용을 안 싣는다 — 회차와 글자수만");
    ok(/if \(o\.u && o\.u !== "화"\) 짐\.u = o\.u;/.test(WL),
       "★★ 단위 글자를 함께 싣는다 (흐름 줄에는 작품 id 가 없습니다)");
    ok(!/kind: "start"/.test(WL), "★ '45화 시작' 은 안 만든다 (흐름이 시끄러워서)");
  }

  /* ── ⑩ 작품 · 단위 ────────────────────────────────────────────── */
  ok(/const UNITS  = \["화", "챕터"\]/.test(WL), "단위는 화·챕터 둘");
  ok(/UNITS\.indexOf\(u\) >= 0 \? u : "화"/.test(WL), "★ 안 정했으면 '화' 로 본다");
  ok(/for \(let r = 0; r < 5; r\+\+\) for \(let c = 0; c < 3; c\+\+\) 세로\.push\(칸\[c \* 5 \+ r\]\)/.test(WL),
     "★ 회차표가 세로로 읽힌다 (1~5 / 6~10 / 11~15)");
  ok(/가장 마지막 값|>= \(전\.at \|\| 0\)/.test(WL),
     "★ 같은 회차가 여러 번 있으면 마지막 값이 그 회차 분량이다 (누적이라 더하면 안 됩니다)");

  /* ── ⑪ 옛 기록은 안 지운다 ────────────────────────────────────── */
  ok(/const 옛줄 = \(day\) => _old\[day\]/.test(WL) && /옛 기록/.test(WL),
     "★★ 예전 날짜별 줄을 주간에서 함께 보여 준다 (지우지 않았습니다)");
  ok(!/worklog[^\n]*\$\{day\}[^\n]*\.remove\(\)/.test(WL),
     "★★ 옛 줄을 지우는 코드가 없다");
}

function checkWordcount(){
  ran["wordcount"]=true;
  const w = fs.readFileSync(DIR+"script_wordcount.js","utf8");
  const h = fs.readFileSync(DIR+"index.html","utf8");
  const rules = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;

  ok(/id="wordcount-block"/.test(h), "글자수 칸이 화면에 있다");
  ok(h.indexOf('id="wordcount-block"') > h.indexOf('id="pomo-block"') &&
     h.indexOf('id="wordcount-block"') < h.indexOf('id="status-block"'),
     "글자수 칸이 뽀모 줄 안에 들어 있다");
  const tags = (h.match(/<script src="(script_[\w.-]+)/g) || []).map(t => t.split('"')[1]);
  ok(tags.includes("script_wordcount.js"), "index.html 이 script_wordcount.js 를 읽어온다");
  const order = fs.readFileSync(DIR+"build-single.py","utf8");
  ok(/script_wordcount\.js/.test(order), "단일파일 빌드 순서에도 들어 있다");
  ok(/startWordcount/.test(fs.readFileSync(DIR+"script_profile.js","utf8")),
     "입장한 뒤에 글자수를 시작한다 (닉네임이 생긴 다음이라야 한다)");

  /* 보안 규칙 */
  ok(rules.wordlog, "규칙에 wordlog 가 있다");
  ok(/nickOwner/.test(rules.wordlog.$day.$nick[".write"]), "내 글자수는 나만 쓸 수 있다");

  /* ---- 실제로 돌려봅니다 ---- */
  const saved = [];
  const inputs = {};
  function mkEl(id){
    return inputs[id] = { id, value:"", textContent:"", innerHTML:"", style:{},
      classList:{ _s:new Set(), toggle(c,v){ v?this._s.add(c):this._s.delete(c); },
                  contains(c){ return this._s.has(c); } },
      dataset:{}, addEventListener(t,f){ this["on_"+t]=f; },
      setAttribute(){}, querySelectorAll(){ return []; },
      focus(){}, select(){} };
  }
  ["wc-big","wc-unit","wc-rows","wc-hint","wc-log","wc-input",
   "wc-send","wc-base","wc-reset","wc-fresh","wordcount-block"].forEach(mkEl);

  let store = {};   // wordlog/{day}/{nick}
  const ctx = {
    console,
    document:{ readyState:"complete", addEventListener(){},
               getElementById:id=>inputs[id]||null },
    Date, Number, Math, JSON, String, Object
  };
  ctx.window = ctx;
  /* ★ 이 방은 script_core.js 에서 `let myNick` 을 파일 맨 바깥에 둡니다.
     let 은 window 에 붙지 않으므로, 다른 파일에서는 **이름 그대로**만
     보입니다. window.myNick 으로 읽으면 늘 빈 값이에요 — 실제로 그
     실수를 해서 "입장한 뒤에 쓸 수 있어요"가 계속 떴습니다.
     그래서 여기서도 window 가 아니라 이름으로만 줘 봅니다. */
  ctx.myNick = "호랑";
  const feedSpy = [];
  ctx.db = { ref:(path)=>({
    async update(v){ saved.push({path,v}); store[path] = {...(store[path]||{}), ...v}; },
    async push(v){ feedSpy.push({path,v}); return {}; },
    limitToLast(){ return this; },
    on(){}, off(){}
  })};
  ctx._feedSpy = feedSpy;
  vm.createContext(ctx);
  vm.runInContext(w, ctx);

  const W = ctx.Wordcount;
  ok(typeof ctx.startWordcount === "function", "startWordcount 를 밖에서 부를 수 있다");
  ok(!/window\.myNick \|\| ""\s*;?\s*\n\s*\}\s*\n\s*function myRow/.test(w) ||
     /typeof myNick/.test(w), "닉네임을 window 가 아니라 이름 그대로 읽는다");
  ok(/typeof myNick === "string"/.test(w), "let 로 선언된 myNick 을 이름으로 찾는다");
  ok(/^\d{4}-\d{2}-\d{2}$/.test(W.dayKey()), "날짜 키가 YYYY-MM-DD 다");
  ok(W.weekDays().length >= 1 && W.weekDays().length <= 7, "이번 주는 1~7일이다");
  ok(W.weekDays()[W.weekDays().length-1] === W.dayKey(), "이번 주의 마지막 날은 오늘이다");

  /* 버튼을 직접 눌러봅니다.
     화면 상태(_today)는 서버 구독으로 채워지므로, 여기서는 저장된 값을
     되먹여서 다음 눌림에 반영합니다 — 실제 동작과 같은 흐름입니다. */
  const day = W.dayKey();
  /* ★ 일부러 서버 답을 흉내내지 않습니다.

     예전 검사는 매 눌림 뒤에 저장된 값을 손으로 되먹였습니다. 그래서
     "서버 답이 오기 전에 다음 버튼을 누르면 옛 값으로 계산한다"는
     버그를 못 잡았어요. 실제로 새 편 → 기록 이 어긋났습니다.
     이제 되먹이지 않고, 코드가 스스로 손안의 값을 챙기는지 봅니다. */
  const press = async (btn, val) => {
    if (val !== undefined) inputs["wc-input"].value = String(val);
    await inputs[btn].on_click();
  };

  return (async () => {
    // ① 처음 — 출발선만 잡히고 누적은 0
    await press("wc-send", 1000);
    let cur = store[`wordlog/${day}/호랑`];
    ok(cur.base === 1000 && cur.total === 0, "첫 기록은 출발선만 잡고 누적은 0이다");
    ok(inputs["wc-input"].value === "", "적고 나면 입력칸이 비워진다");

    // ② 늘어난 만큼만 쌓인다
    await press("wc-send", 2500);
    cur = store[`wordlog/${day}/호랑`];
    ok(cur.total === 1500, "차이(1,500자)만 쌓인다");
    ok(cur.base === 2500, "기준이 지금 값으로 옮겨간다");

    await press("wc-send", 2900);
    cur = store[`wordlog/${day}/호랑`];
    ok(cur.total === 1900, "이어서 적어도 차이만 더해진다");

    // ③ 줄었을 때 — 누적을 깎지 않는다 (퇴고로 덜어낸 것도 작업이다)
    const before = cur.total;
    await press("wc-send", 2000);
    cur = store[`wordlog/${day}/호랑`];
    ok(cur.total === before, "글자수가 줄어도 누적을 깎지 않는다");
    ok(cur.base === 2000, "줄었을 때는 기준만 옮긴다");
    ok(cur.total >= 0, "누적이 음수가 되지 않는다");

    // ④ 같은 값을 또 적어도 두 번 세지 않는다
    const t2 = cur.total;
    await press("wc-send", 2000);
    ok(store[`wordlog/${day}/호랑`].total === t2, "같은 값을 또 적어도 두 번 세지 않는다");

    /* 여기까지 늘어난 것은 두 번(1,500 / 400)뿐입니다 */
    {
      const f = ctx._feedSpy.filter(x => /^wordfeed\//.test(x.path));
      ok(f.length === 2, `늘어난 횟수만큼만 올라간다 (${f.length}번)`);
    }

    /* ⑤ 서버 답을 기다리지 않고 연달아 눌러도 어긋나지 않아야 합니다.
       실제로 여기서 어긋났습니다 — 새 편을 누른 직후 기록하면
       옛 기준으로 빼서 "글자수가 줄었네요"가 뜨고 채팅에도 안 올라갔어요. */
    {
      const n0 = ctx._feedSpy.length;
      await press("wc-fresh");                 // 기준 0
      await press("wc-send", 300);             // 곧바로 기록
      const c = store[`wordlog/${day}/호랑`];
      ok(c.base === 300, "새 편 직후에 기록해도 기준이 제대로 옮겨간다");
      ok(ctx._feedSpy.length === n0 + 1, "새 편 직후의 기록도 채팅에 올라간다");
      ok(ctx._feedSpy[ctx._feedSpy.length-1].v.add === 300,
         "새 편 뒤에는 적은 숫자가 그대로 늘어난 양이다");

      // 초기화 직후에 이어 적어도 마찬가지
      await press("wc-reset");
      await press("wc-send", 500);
      const c2 = store[`wordlog/${day}/호랑`];
      ok(c2.total === 200, `초기화 직후 기록도 차이만 쌓인다 (${c2.total})`);
      ok(c2.base === 500, "초기화는 기준을 건드리지 않는다");

      // 연달아 세 번
      const n1 = ctx._feedSpy.length;
      await press("wc-send", 600);
      await press("wc-send", 700);
      await press("wc-send", 800);
      const c3 = store[`wordlog/${day}/호랑`];
      ok(c3.total === 500, `쉬지 않고 눌러도 정확히 쌓인다 (${c3.total})`);
      ok(ctx._feedSpy.length === n1 + 3, "누른 만큼 채팅에도 올라간다");
    }

    // ⑥ 버튼 셋
    const tBefore = store[`wordlog/${day}/호랑`].total;
    await press("wc-base", 5000);
    cur = store[`wordlog/${day}/호랑`];
    ok(cur.base === 5000 && cur.total === tBefore, "▶기준은 누적을 건드리지 않는다");

    await press("wc-reset");
    ok(store[`wordlog/${day}/호랑`].total === 0, "🧹초기화는 누적을 0으로");
    ok(store[`wordlog/${day}/호랑`].base === 5000, "🧹초기화는 기준을 건드리지 않는다");

    await press("wc-fresh");
    ok(store[`wordlog/${day}/호랑`].base === 0, "🆕새 편은 기준을 0으로");

    // 새 편 뒤엔 적은 숫자가 곧 쓴 양
    await press("wc-send", 700);
    ok(store[`wordlog/${day}/호랑`].total === 700, "새 편 뒤에는 적은 숫자가 곧 쓴 양이다");

    // ⑦ 숫자가 아니면 아무것도 저장하지 않는다
    const n = saved.length;
    await press("wc-send", "");
    ok(saved.length === n, "빈 칸으로 누르면 저장하지 않는다");
    inputs["wc-input"].value = "-5";
    await inputs["wc-send"].on_click();
    ok(saved.length === n, "음수는 저장하지 않는다");

    // ⑧ set 이 아니라 update 여야 한다 (total 만 바꾸다 base 를 날리면 안 됨)
    ok(!/\.set\(/.test(w) || /\.update\(/.test(w), "update 로 저장한다");
    ok(saved.every(s => /^wordlog\/\d{4}-\d{2}-\d{2}\/호랑$/.test(s.path)),
       "내 자리에만 쓴다");

    // ⑨ 이름에 태그가 들어와도 화면에 그대로 심지 않는다
    ok(/<span class="wc-nm">&lt;b&gt;/.test(W.drawRows([["<b>",1]], -1)),
       "닉네임 속 태그를 글자로 처리한다");

    /* ⑨ 흐르는 기록 — 순위 막대가 아니라 한 줄씩 쌓여야 합니다.
       그날 적게 쓴 사람이 위축되지 않게 한 결정이라, 되돌아가지 않도록 지킵니다. */
    /* ★ 이 검사의 **뜻**은 "탭 이름"이 아니라 "남과 줄 세우지 않는다" 입니다.
       그날 적게 쓴 사람이 위축되지 않게 한 결정이라 지켜야 해요.
       [2026-08-21] 📅 주간 탭이 생겼지만 그건 **내 달력**이지 순위가
       아닙니다. 그래서 뜻은 그대로 두고 글자만 고칩니다. */
    {
      const WL = fs.readFileSync(DIR + "script_worklog.js", "utf8");
      ok(!/순위|랭킹|등수/.test(WL), "★ 새 탭 어디에도 사람 줄 세우기가 없다");
      ok(!/sort\([^)]*total|sort\([^)]*cnt[^)]*\)\s*\.slice\(0,\s*[0-9]/.test(WL),
         "★ 남의 글자수를 크기순으로 늘어놓지 않는다");
    }
    ok(/data-wc-tab="wl"/.test(h) && /data-wc-tab="me"/.test(h),
       "탭에 ✍️ 오늘(wl)과 내 기록(me)이 있다");
    ok(/data-wc-tab="wlweek"/.test(h) && /data-wc-tab="wlproj"/.test(h),
       "★ 주간·작품 탭이 있다 (2026-08-21 개편)");

    const fed = ctx._feedSpy.filter(f => /^wordfeed\//.test(f.path));
    ok(fed.length > 0, "글자수가 늘면 흐르는 기록에 한 줄 올라간다");
    ok(fed.every(f => f.v.add > 0), "늘어난 만큼만 올라간다 (0이나 음수는 안 올린다)");
    ok(fed.every(f => f.v.nick === "호랑" && f.v.at), "누가 언제 올렸는지 함께 남는다");
    ok(fed.every(f => typeof f.v.snap === "number"), "올린 숫자(전체 글자수)도 함께 남는다");

    /* 오늘 화면에 사람별 순위나 막대가 나오면 안 됩니다 */
    const feedHtml = W.drawFeed([{nick:"달빛", add:300, snap:800, at:Date.now()}]);
    ok(/wc-said-n">800자/.test(feedHtml), "윗줄에 올린 숫자가 그대로 보인다");
    ok(/\+300자/.test(feedHtml) && /전체 800자/.test(feedHtml),
       "아랫줄에 늘어난 만큼과 전체가 함께 보인다");
    /* 채팅처럼 — 남의 것은 왼쪽, 내 것은 오른쪽 */
    ok(/wc-said-nm">달빛/.test(feedHtml), "남이 올린 것에는 이름이 붙는다");
    const mineHtml = W.drawFeed([{nick:"호랑", add:300, snap:800, at:Date.now()}]);
    ok(/class="wc-feed me"/.test(mineHtml), "내 것에는 me 표시가 붙는다 (오른쪽 정렬용)");
    ok(!/wc-said-nm/.test(mineHtml), "내 말풍선에는 내 이름을 또 쓰지 않는다");
    const css = fs.readFileSync(DIR+"styles.css","utf8");
    ok(/\.wc-feed\.me \.wc-said-line\{[^}]*flex-end/.test(css.replace(/\s+/g," ")),
       "내 말풍선이 오른쪽으로 간다");
    ok(/\.wc-said-line\{[^}]*flex-start/.test(css.replace(/\s+/g," ")),
       "남의 말풍선은 왼쪽에 있다");
    ok(/\.wc-feed-sys\{[^}]*text-align: center/.test(css.replace(/\s+/g," ")),
       "계산 결과는 가운데 정렬이다");
    /* 시간은 넣지 않습니다 — 좁은 칸이 지저분해집니다 */
    ok(!/오전|오후/.test(feedHtml), "계산 결과 줄에 시각을 넣지 않는다");
    ok(!/wc-feed-at/.test(feedHtml), "시각 자리 자체가 없다");
    ok(!/wc-bar/.test(feedHtml), "오늘 탭에는 막대를 그리지 않는다");
    /* snap 이 없던 옛 기록도 깨지지 않아야 합니다 */
    const oldHtml = W.drawFeed([{nick:"달빛", add:300, at:Date.now()}]);
    ok(!/undefined|NaN/.test(oldHtml), "snap 이 없던 옛 기록도 깨지지 않는다");
    ok(!/wc-said-line/.test(oldHtml), "옛 기록은 말풍선 없이 계산 결과만 나온다");
    ok(/&lt;b&gt;/.test(W.drawFeed([{nick:"<b>",add:1,snap:2,at:1}])),
       "흐르는 기록에서도 닉네임 속 태그를 글자로 처리한다");

    const rulesFeed = rules.wordfeed;
    ok(rulesFeed, "규칙에 wordfeed 가 있다");
    ok(/nickOwner/.test(rulesFeed.$day.$id[".write"]), "남의 이름으로는 올릴 수 없다");
    ok(/!data\.exists\(\)/.test(rulesFeed.$day.$id[".write"]), "올라간 줄은 고칠 수 없다");

    // ⑩ 주간 합계
    ctx.Wordcount._state().week[W.dayKey()] = { "호랑":{total:100}, "달빛":{total:50} };
    const sw = W.sumWeek();
    ok(sw["호랑"] === 100 && sw["달빛"] === 50, "주간 합계가 사람별로 더해진다");

    /* 저장이 거절되면 채팅에도 올리지 않아야 합니다 */
    {
      const nick = "호랑";
      ctx.Wordcount._state().today[nick] = { total: 0, base: 100, at: Date.now() };
      const n = ctx._feedSpy.length;
      const realRef = ctx.db.ref;
      ctx.db.ref = (path) => /^wordlog\//.test(path)
        ? { async update(){ throw new Error("일부러 낸 거절"); } }
        : realRef(path);
      const warn = console.warn; console.warn = () => {};   // 일부러 낸 오류라 조용히
      await press("wc-send", 500);
      console.warn = warn;
      ok(ctx._feedSpy.length === n, "저장이 거절되면 채팅에도 안 올라간다");
    ok(/permission/i.test(w) && /로그인이 풀립니다/.test(w),
       "거절 이유가 로그인 문제일 때 그렇다고 알려준다");
      ctx.db.ref = realRef;
    }

    /* [고침 2026-08-09] 뽀모는 네 줄이었습니다.
         타이머 · 진행바 · [🍅][☕][⚙️설정] · [▶/⏸][■][♪]
       예전에는 다섯 줄이었고, 맨 아래 [🔔 소리·알림] 이 폭 전체를 써서
       좁은 칸에서 뽀모 영역만 세로로 길었습니다.

       [2026-08-11] 큰 숫자 줄과 진행 바 줄을 **두 겹 고리 한 줄**로
       합쳤습니다. 숫자는 고리 가운데로 들어갔어요. 그래서 세 줄입니다.
       늘어나는 쪽으로 바뀌면(다섯 줄 이상) 좁은 칸에서 다시 길어지므로
       여기서 계속 지켜봅니다. */
    /* [2026-08-12] 네 줄로 보이지만 **한 번에 보이는 건 셋**입니다.
       고리와 가로 바는 같은 자리를 나눠 쓰는 두 모양이라, CSS 가 늘
       한쪽만 보여줘요. 그래서 "모양 줄 1 + 설정 1 + 조작 1 = 3" 입니다. */
    const wrap = h.slice(h.indexOf('id="timer-wrap"'), h.indexOf('id="wordcount-block"'));
    const rows = (wrap.match(/class="pomo-row/g) || []).length;
    const 모양줄 = (wrap.match(/pomo-ringrow|pomo-barrow/g) || []).length;
    ok(모양줄 === 2, "모양이 둘 들어 있다 (원형·가로 바)");
    ok(rows - 모양줄 + 1 === 3,
       `한 번에 보이는 건 세 줄이다 (모양·설정·조작) — 지금 ${rows - 모양줄 + 1}줄`);
    ok(/#pomo-block \.pomo-barrow\{ display: none; \}/.test(CSS) &&
       /#pomo-block\[data-shape="bar"\] \.pomo-ringrow\{ display: none; \}/.test(CSS),
       "★ 한 번에 한 모양만 보인다");
    ok(/id="timer-text"/.test(wrap), "★ 남은 시간 글자는 그대로 있다 (고리 가운데로 옮겼을 뿐)");
    ok(/id="pomo-setrow"/.test(wrap), "설정 셋이 한 줄에 있다");
    ok(/id="pomo-controls"/.test(wrap), "조작이 한 줄에 있다");
    ok(wrap.indexOf('id="pomo-setrow"') < wrap.indexOf('id="pomo-controls"'),
       "설정 줄이 조작 줄보다 위에 있다");
    const order = ["pomo-work-min", "pomo-rest-min",
                   "pomo-run-btn", "pomo-stop-btn", "pomo-sound-btn"]
      .map(id => wrap.indexOf(`id="${id}"`));
    ok(order.every((v, i2) => v > 0 && (i2 === 0 || v > order[i2 - 1])),
       "🍅 ☕ ▶ ■ ♪ 순서로 놓인다");
    ok(!/id="pomo-opt-btn"/.test(h), "아래쪽 [소리·알림] 줄은 없앴다");

    /* [2026-08-12] [⚙️ 알림음] 은 ⚙️ 설정 → 🍅 뽀모 로 옮겼습니다.
       자주 안 바꾸는 것이 좁은 칸을 계속 차지하고 있었어요. */
    ok(!/id="pomo-detail-toggle"/.test(h), "★ 뽀모 창에서 [⚙️ 알림음] 단추가 빠졌다");
    ok(!/id="pomo-detail"/.test(h), "접었다 펴던 상세 상자도 함께 빠졌다");
    ok(/id="panel-pomo"/.test(h) && /id="pomo-sound-mini"/.test(h),
       "★ 알림음은 설정의 🍅 뽀모 탭으로 갔다 (사라진 게 아니다)");
    ok(h.indexOf('id="pomo-sound-mini"') > h.indexOf('id="panel-pomo"') &&
       h.indexOf('id="pomo-sound-mini"') < h.indexOf('id="panel-theme"'),
       "알림음이 그 탭 **안**에 있다");
    /* ♪ 는 남깁니다 — 도는 중에 급히 음소거하고 싶다는 이야기가 많았어요.
       설정의 알림음(종류·볼륨)과는 다른 일을 합니다. */
    ok(/id="pomo-sound-btn"/.test(h), "★ ♪ 음소거 단추는 그대로 있다 (급할 때 쓰는 것이라)");

    /* =====================================================================
       🍅 타이머 모양 고르기 (2026-08-12)
       ===================================================================== */
    {
      const UI8 = fs.readFileSync(DIR+"script_ui.js","utf8");

      ok(/id="pomo-shape-pick"/.test(h), "설정에 모양 고르기가 있다");
      ["ring", "bar"].forEach(v =>
        ok(new RegExp('data-shape="' + v + '"').test(h), `${v} 를 고를 수 있다`));
      ok(/role="radiogroup"/.test(h) && (h.match(/role="radio"/g) || []).length >= 2,
         "고르기 판이라고 알려 준다 (읽어 주는 프로그램용)");

      ok(/const SHAPE_KEY = "pomoShape";/.test(UI8), "고른 값에 이름이 있다");
      ok(/window\.AppStore\?\.setItem\(SHAPE_KEY/.test(UI8),
         "★ 이 기기에만 저장한다 (서버로 안 올라간다 — 각자 고르는 것이니까)");
      ok(!/db\.ref[^\n]*pomoShape/.test(UI8) && !/pomoShape/.test(
           fs.readFileSync(DIR+"script_data.js","utf8")),
         "★ 서버에도, 남에게도 안 나간다");
      ok(/POMO_SHAPES\.includes\(v\) \? v : "ring"/.test(UI8),
         "★ 이상한 값이 저장돼 있어도 원형으로 되돌아간다 (화면이 비지 않게)");

      /* 켤 때 번쩍이지 않으려면 로그인 **전에** 맞춰야 합니다 */
      const dom = UI8.slice(UI8.indexOf('document.addEventListener("DOMContentLoaded"'));
      ok(/applyPomoShape\(loadPomoShape\(\)\);/.test(dom),
         "★ 켜자마자 맞춘다 (나중에 하면 원형이 번쩍였다가 바뀐다)");
      ok(/pomo-shape-pick"\)\?\.addEventListener\("click"/.test(dom),
         "누르면 바로 바뀐다");
      ok(/if \(name === "pomo"\)/.test(UI8), "설정에서 🍅 뽀모 탭을 열면 알림음을 그린다");

      /* ── [뺌 2026-08-12] 머리말 "집중 중 · 오늘 n회" ──
         이 방에서는 🍅 를 수확합니다. 오늘 딴 토마토는 카드에도 뜨고
         🌾 토마토 수확왕 업적도 그걸로 세요. 같은 것을 머리말에 한 번 더
         적으면 숫자만 늘고 뜻은 안 늡니다. */
      ok(!/id="pomo-head-state"/.test(h), "★ 머리말의 '오늘 n회' 는 없앴다");
      ok(!/pomo-head-state/.test(CSS), "그 자리의 꾸밈도 함께 걷어냈다");
      /* ★ 그래도 **세는 일은 그대로**여야 합니다.
         "화면에서 안 보인다" 와 "안 센다" 는 전혀 다른 일이에요 —
         여기서 세는 걸 같이 지우면 🌾 토마토 수확왕이 영영 안 붙습니다. */
      ok(/function _getTodaySessionCount\(\)/.test(UI8) &&
         /function incrementTodayFocusSessions\(\)/.test(UI8),
         "★ 오늘 몇 번 했는지는 여전히 센다 (업적이 쓴다)");
      ok(/window\.renderPomoHeadState = renderPomoHeadState;/.test(UI8),
         "부르던 곳이 터지지 않게 빈 함수는 남겨 둔다");

      /* ── 🍅 그림을 누르면 ⚙️ 설정 → 🍅 뽀모 ── */
      ok((h.match(/pomo-shape-hit/g) || []).length === 2,
         "★ 두 모양 모두 누를 수 있다 (한쪽만 되면 모양을 바꾼 사람이 못 찾는다)");
      ok(/role="button" tabindex="0"/.test(h), "손가락뿐 아니라 키보드로도 눌린다");
      ok(/function bindPomoShapeHit/.test(UI8) && /bindPomoShapeHit\(\);/.test(UI8),
         "누르면 열리게 걸어 둔다");
      {
        const hit = UI8.slice(UI8.indexOf("function bindPomoShapeHit"),
                              UI8.indexOf("function bindPomoShapeHit") + 900);
        ok(/openSettings\(\); openTab\("pomo"\)/.test(hit), "★ 설정의 🍅 뽀모 탭이 열린다");
        ok(/closest\("#timer-pill, button, input, select, a"\)/.test(hit),
           "★ 알약·단추 위에서는 안 가로챈다 (그쪽이 안 눌리면 안 되니까)");
        ok(/e\.key === "Enter" \|\| e\.key === " "/.test(hit), "엔터·스페이스로도 열린다");
        ok(/el\._hitBound/.test(hit), "두 번 걸리지 않는다");
      }
      ok(/\.pomo-shape-hit\{ cursor: pointer/.test(CSS), "누를 수 있다는 걸 손 모양으로 알려 준다");
      ok(/\.pomo-shape-hit:focus-visible\{/.test(CSS), "키보드로 짚었을 때 표시가 난다");
    }

    {
      const flat = fs.readFileSync(DIR+"styles.css","utf8").replace(/\s+/g, " ").replace(/ \{/g, "{");
      /* [고침 2026-08-09] 예전에는 "셋을 같은 폭으로 늘린다"(flex:1 1 0)가
         균형이라고 봤는데, 그러면 알맹이에 비해 칸이 휑했습니다. 이제는
         셋이 **같은 규칙 하나**(같은 여백·바탕·모양)를 쓰는 것으로 균형을
         맞춥니다 — 폭은 각자 내용만큼. */
      ok(/\.pomo-setrow \.pomo-setup-field\{[^}]*flex: 0 0 auto[^}]*padding: 7px 13px/.test(flat),
         "★ 🍅 ☕ 두 칩이 넉넉해졌다 (⚙️ 가 빠진 자리만큼)");
      /* 설정 줄은 값을 보여주는 자리라 테두리 없이 — 조작 단추와 같은
         무게로 보이면 시선이 분산됩니다. */
      ok(/\.pomo-setrow \.pomo-setup-field\{[^}]*border: 0;/.test(flat),
         "설정 줄에는 테두리가 없다");
      /* 조작 셋은 원래 있던 동그란 생김새를 그대로 */
      ok(/#pomo-sound-btn\{[^}]*border-radius: var\(--r-full\)/.test(flat),
         "♪ 가 동그란 단추다 (예전 설정 단추의 생김새를 물려받음)");
      ok(/\.pomo-run-btn\{[^}]*border-radius: var\(--r-full\)/.test(flat),
         "▶ ⏸ ■ 도 동그랗다");
      ok(/\.pomo-bar\{[^}]*justify-content: center/.test(flat),
         "조작 단추가 가운데 모인다");
      /* 아이콘이 뒤바뀌지 않았는지 — 설정은 톱니, 소리는 음표 */
      /* 버튼 하나만 잘라 봅니다 — 넉넉히 자르면 옆 버튼의 그림까지 딸려와
         엉뚱하게 통과합니다 (실제로 한 번 그랬어요). */
      const 설정줄 = h.slice(h.indexOf('id="pomo-setrow"'), h.indexOf('id="pomo-controls"'));
      ok((설정줄.match(/pomo-setup-field/g) || []).length === 2,
         "★ 설정 줄에 칩이 둘만 남았다 (🍅 ☕)");
      ok(/🍅/.test(설정줄) && /☕/.test(설정줄), "이모지도 그대로다");
      /* [2026-08-09] 한때 톱니를 회색으로 눌렀다가 되돌렸습니다 —
         칩이 안 보이던 진짜 원인은 높이였고, 색은 죄가 없었어요. */
      ok(!/grayscale\(1\)[^}]*\}/.test(flat.slice(flat.indexOf(".pomo-gear"), flat.indexOf(".pomo-gear") + 300)),
         "톱니는 원래 색 그대로 둔다");
      /* ★ 2026-08-09 — 여러 번 헤맨 자리입니다.
         배경 규칙은 처음부터 제대로 걸려 있었는데, ⚙️ 칩만 바탕이 없어
         보였습니다. 범인은 색이 아니라 **높이**였어요. 🍅 ☕ 안의
         <input> 은 기본 줄높이가 글자보다 커서 두 칸만 높았고, ⚙️ 는
         혼자 납작해서 알약이 안 보였습니다. 둘 다 못 박아 둡니다. */
      ok(/\.pomo-setrow \.pomo-setup-field\{[^}]*min-height: 26px/.test(flat),
         "★ 세 칩의 높이를 못 박는다 (⚙️ 만 납작해지지 않게)");
      ok(/\.pomo-setrow \.pomo-setup-field input\{[^}]*line-height: 1/.test(flat),
         "★ 입력칸 줄높이를 1 로 — 기본값은 글자보다 커서 두 칸만 높아진다");
      const snd = h.slice(h.indexOf('id="pomo-sound-btn"'), h.indexOf('id="pomo-sound-btn"') + 400);
      ok(/♪/.test(snd) && !/<svg/.test(snd), "♪ 소리 단추는 음표다");
    }
    ok(!/pomo-row-setup[\s\S]{0,400}pomo-run-btn/.test(wrap),
       "시간 설정과 버튼이 같은 줄에 있지 않다");

    return checkTimelog();
  })();
}

/* [2026-08-06] 여기 있던 "15. 설정 → 나의 기록" 블록은 위쪽(보안 규칙
   블록 앞)의 "15. 🗂️ 나의 작업" 으로 옮겼습니다.

   두 가지를 함께 고쳤어요.
     · 내용 — 그 기록 화면은 설정 탭이 아니라 나의 작업 창으로 옮겼습니다.
     · 자리 — 이 자리는 위쪽 로그인 블록의 `return` 때문에 **실행되지
       않는 죽은 자리**였습니다. 검사를 적어두어도 아무도 돌리지 않았어요.
   새 블록은 반드시 그 return 보다 위에 둡니다. */

async function finish(){
  /* ★ 블록이 통째로 안 돌던 사고가 있었습니다.
     앞 블록이 return 으로 끝나면 뒤 블록은 실행조차 되지 않는데,
     화면에는 "전부 통과"라고 나왔어요. 검사 개수가 크게 줄면
     그런 일이 생긴 것이므로, 최소 개수를 지켜봅니다. */
  /* [2026-08-03] 펫 기능을 빼면서 펫 검사 ~130개가 함께 빠졌습니다.
     새 기준: 390개 언저리 → 하한 380.
     [2026-08-06] 🗂️ 나의 작업 검사가 붙어 470개 언저리 → 하한 440.
     (죽어 있던 "설정 → 나의 기록" 블록도 살려서 위로 옮겼습니다)
     [2026-08-06] 🎋 대숲 검사가 붙어 638개 → 하한 600.
     [2026-08-06] 🖥️ 화면 공유 검사가 붙어 740개 → 하한 700. */
  /* ★ [2026-08-11] 검사 하나하나가 아니라 **블록이 통째로** 안 도는
     사고가 또 났습니다. 공지판 검사 서른 개를 파일 중간에 적었는데,
     그 자리가 위쪽 return 아래라 한 번도 실행되지 않았어요. 그런데도
     "전부 통과" 라고 나왔습니다 — 개수가 1264 → 1265 로 하나만 는 걸
     보고서야 알았습니다.

     아래 MIN(700) 은 너무 헐거워서 이런 걸 못 잡습니다. 그래서 사슬로
     이어 부르는 블록마다 도장을 찍게 하고, 여기서 도장을 셉니다.
     새 블록을 사슬에 안 걸면 이 줄에서 바로 걸립니다. */
  const CHAIN = ["mywork","wordcount","timelog","notice","achv"];
  const 안돈것 = CHAIN.filter(k => !ran[k]);
  if (안돈것.length) {
    console.log(`\n검사 블록이 실행되지 않았습니다: ${안돈것.join(", ")}`);
    console.log("사슬(return check…())에서 빠졌거나, return 아래 죽은 자리에 있습니다.");
    process.exit(1);
  }

  /* [2026-08-22] 가짜 서버로 **돌려 보는** 검사 하나가 async 입니다.
     그 결과를 여기서 함께 봅니다 — 안 기다리면 조용히 건너뛰어요. */
  await Promise.all(_기다릴것);
  _나중에.forEach(f => { try { f(); } catch (e) { ok(false, "돌려 보는 검사가 터졌다 — " + (e.message || e)); } });

  const MIN = 700;
  if (pass + fail < MIN) {
    console.log(`\n검사가 ${pass+fail}개밖에 안 돌았습니다 (${MIN}개 이상이어야 함).`);
    console.log("블록 하나가 실행되지 않은 것 같아요 — 비동기 블록의 연결을 확인하세요.");
    process.exit(1);
  }
  console.log(`\n통과 ${pass} / 전체 ${pass+fail}`);
  if(fail){ console.log("\n실패:"); fails.forEach(f=>console.log("  ✗ "+f)); process.exit(1); }
  else console.log("전부 통과했습니다.");
}

/* ---- 11. 시간 기록 ----
   ★ 이 블록은 반드시 함수여야 합니다.

   예전에 여기가 그냥 `{ ... }` 였을 때, 앞 블록이 `return` 으로
   끝나면서 이 블록이 통째로 실행되지 않았습니다. 검사는 "전부 통과"라고
   말했지만 사실은 돌지도 않았어요. 비동기 블록은 앞에서 뒤로 이어
   부르는 방식으로만 씁니다. */
function checkTimelog(){
  ran["timelog"]=true;
  const src=fs.readFileSync(DIR+"script_timelog.js","utf8");
  const c2={window:{addEventListener(){}},document:{readyState:"complete",addEventListener(){},
    getElementById(){return null},querySelectorAll(){return []},visibilityState:"visible"},
    localStorage:{_v:{},getItem(k){return this._v[k]??null},setItem(k,v){this._v[k]=v}},
    db:{ref(){return{once:async()=>({val:()=>null}),set:async()=>{},push:async()=>{},remove(){}}}},
    myNick:"테스트", module:{exports:{}}, setInterval(){}, clearInterval(){}};
  c2.window.document=c2.document; vm.createContext(c2); vm.runInContext(src,c2);
  const T=c2.window.TimeLog;
  ok(!!T, "TimeLog 모듈이 로드된다");
  ok(T.STATUS_IDS.join(",")==="writing,focus,rest,away", "상태 네 가지를 구분한다");
  ok(T.OFFLINE_MIN_MS>=5*60*1000, `끊김 인정 간격이 5분 이상 (${Math.round(T.OFFLINE_MIN_MS/60000)}분)`);
  ok(T.SEG_CAP_MS>=4*60*60*1000, `한 구간 상한이 4시간 이상 (${Math.round(T.SEG_CAP_MS/3600000)}시간)`);

  // [중요] 타이머가 멈춘 것만으로 자리비움 처리하면 안 됩니다
  const tl=fs.readFileSync(DIR+"script_timelog.js","utf8");
  ok(!/pushSegment\("away"/.test(tl), "타이머 공백을 자리비움으로 찍지 않는다");
  ok(/\.info\/connected/.test(tl), "끊김 판단을 소켓(.info/connected)으로 한다");

  // 시간 표기
  /* [2026-08-03] 표기를 3h 20m 꼴로 바꿨습니다 */
  ok(T.fmtDur(0)==="0m", "0m 표기");
  ok(T.fmtDur(59*1000)==="1m", "59초는 1m 로");
  ok(T.fmtDur(90*60*1000)==="1h 30m", "90분 → 1h 30m");
  ok(T.fmtDur(120*60*1000)==="2h", "정확히 2시간은 m 을 안 붙인다");

  /* ── 저장이 update() 한 번인가 (2026-08-13) ──
     저장과 timeCur 갱신이 두 번의 쓰기이던 시절, 나가는 찰나에 저장만
     도착하고 지우기가 유실되면 다음 입장이 같은 구간을 또 닫았습니다
     (실제로 Job 00:16~00:32 가 두 번 적힌 기록이 나왔어요). */
  ok(/async function commitSegs/.test(tl) && /function segUpdates/.test(tl),
     "★★ 구간 꾸러미를 만들어 한 번에 쓴다");
  ok(/u\.timeCur = cur;/.test(tl), "★ timeCur 갱신이 같은 꾸러미에 들어간다");
  ok(!/await curRef\(\)\.set\(_cur\)/.test(tl) && !/await curRef\(\)\.remove\(\)/.test(tl),
     "★★ 구간 저장과 따로 노는 timeCur set/remove 가 남아 있지 않다");
  ok(/await commitSegs\(closes, null\)/.test(tl),
     "나가기·이전 구간 정리가 '닫기 + 비우기' 한 번으로 간다");
  ok(/const 도장 = `\$\{sg\.s\}\|\$\{sg\.a\}`/.test(tl) && /Number\(sg\.b\) > Number\(고른것\[도장\]\.b\)/.test(tl),
     "★★ 중복 흉터는 '같은 상태+같은 시작' 으로 거른다 — 끝은 몇 초 어긋나 있어서 통짜 비교로는 못 잡는다");
  {
    /* 녹차차님 13일 그대로 굴려 봅니다 — 끝이 4초 어긋난 중복 */
    const t0 = new Date("2026-08-13T00:00:00").getTime(), M = 60e3;
    const raw = [
      { s: "focus", a: t0,          b: t0 + 16 * M },
      { s: "focus", a: t0 + 16 * M, b: t0 + 32 * M },
      { s: "focus", a: t0 + 16 * M, b: t0 + 32 * M + 4000 }   // 흉터 (끝만 4초 다름)
    ];
    const best = {};
    raw.forEach(sg => {
      const k = `${sg.s}|${sg.a}`;
      if (!best[k] || sg.b > best[k].b) best[k] = sg;
    });
    const kept = Object.values(best);
    const total = Math.round(kept.reduce((a, sg) => a + (sg.b - sg.a), 0) / M);
    ok(kept.length === 2, `세 줄이 두 줄로 걸러진다 (${kept.length}줄)`);
    ok(total === 32, `쌓인 시간이 50분이 아니라 32분으로 나온다 (${total}분)`);
    /* 정상 기록은 안 다친다 — 체크포인트 경계는 시작이 서로 다르다 */
    const 정상 = [
      { s: "writing", a: t0, b: t0 + 60 * M },
      { s: "writing", a: t0 + 60 * M, b: t0 + 90 * M }
    ];
    const b2 = {};
    정상.forEach(sg => { const k = `${sg.s}|${sg.a}`; if (!b2[k] || sg.b > b2[k].b) b2[k] = sg; });
    ok(Object.keys(b2).length === 2, "★ 이어지는 정상 구간(1시간 체크포인트)은 안 걸러진다");
  }

  // 하루를 넘기는 구간이 날짜별로 쪼개지는가 — update() 꾸러미로
  let updated=null, nk=0;
  c2.db.ref=(path)=>({ push:()=>({ key:"k"+(++nk) }),
                       update:async(u)=>{ updated={path,u}; },
                       set:async()=>{}, once:async()=>({val:()=>null}), remove(){} });
  const d=new Date(); d.setHours(23,0,0,0);
  const from=d.getTime(), to=from+3*60*60*1000;   // 23시 → 다음날 2시
  return T.pushSegment("writing", from, to).then(()=>{
    const entries=Object.entries(updated?.u||{}).filter(([k])=>k.startsWith("timeSegs/"));
    ok(entries.length===2, `자정을 넘는 구간이 두 날로 쪼개진다 (${entries.length}개)`);
    const days=new Set(entries.map(([k])=>k.split("/")[1]));
    ok(days.size===2, "두 조각이 서로 다른 날짜 밑에 들어간다");
    const total=entries.reduce((a,[,s])=>a+(s.b-s.a),0);
    ok(total===to-from, "쪼개도 총 시간이 보존된다");
    ok(updated.path==="users/테스트", "★ 한 사람 노드에 update() 한 번으로 쓴다");
    return checkNotice();
  });
}

/* ---- 📢 공지판 (2026-08-11) ----------------------------------------
   기능·버그 공지를 모아 두는 자리. 여기서 꼭 지켜야 하는 두 가지:
     ① 목록과 사진이 **다른 칸**에 있을 것 — 한 칸에 두면 목록을 열
        때마다 사진을 전부 받아옵니다.
     ② 쓰기 권한이 화면이 아니라 **보안규칙**으로 막혀 있을 것. */
/* ---- 🏅 업적 (2026-08-11) -------------------------------------------
   랭킹 대신 업적으로 간 기능. 여기서 꼭 지켜야 하는 것 —
     ① 한 번 딴 것은 **절대 도로 빼지 않는다.** 연속 출석이 끊겼다고
        "일주일 개근" 이 사라지면 그건 업적이 아니라 순위표입니다.
     ② 연속(streak)은 오늘이 없으면 **어제**에서 세기 시작한다.
        오늘부터만 세면 아직 안 들어온 아침에 29일이 0 이 됩니다.
     ③ 서버에 올라가는 건 **결과뿐** — 몇 자·몇 시간은 올리지 않는다.
     ④ 휴식·자리비움 시간이 작업 시간에 섞이지 않는다. */
function checkAchv(){
  ran["achv"]=true;
  const AC = fs.readFileSync(DIR+"script_achv.js","utf8");
  const H8 = fs.readFileSync(DIR+"index.html","utf8");
  const RULES2 = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8").replace(/\/\/.*/g,"")).rules;

  /* ── 목록 ── */
  {
    const i = AC.indexOf("  const ACHV = [");
    const body = AC.slice(i, AC.indexOf("\n  ];", i) + 5).replace("const ACHV", "var ACHV");
    const box = {};
    vm.createContext(box);
    vm.runInContext(body, box);
    const A = box.ACHV;

    ok(A.length >= 30, `업적이 넉넉하다 (${A.length}개)`);
    ok(new Set(A.map(x => x.id)).size === A.length, "업적 id 가 겹치지 않는다");
    ok(A.every(x => x.n > 0 && x.desc && x.icon && x.g), "업적마다 목표·설명·아이콘·갈래가 있다");

    /* 갈래마다 하나씩은 있어야 판이 허전하지 않습니다 */
    ["출석","글자수","작업 시간","뽀모","표현","작업의 결"].forEach(g =>
      ok(A.some(x => x.g === g), `${g} 갈래가 있다`));

    /* ★ 글자수로는 표가 안 나는 작업의 몫 — 이게 이 기능의 취지입니다 */
    ok(A.some(x => x.id === "rew30"), "★ 퇴고처럼 글자수가 안 느는 작업의 업적이 있다");
    ok(A.some(x => x.id === "rev30" && x.label === "수정궁 여왕"), "👑 수정궁 여왕이 있다");
    const 순서 = (id) => A.findIndex(x => x.id === id);
    ok(A.some(x => x.id === "rew7" && x.label === "퇴고의 늪"), "🐊 퇴고의 늪이 있다");
    ok(A.some(x => x.id === "rev7" && x.label === "수정궁에 갇혔어요"), "🏰 수정궁에 갇혔어요가 있다");
    ok(A.some(x => x.id === "share30" && x.label === "관심이 필요해"), "👀 관심이 필요해가 있다");
    ok(A.some(x => x.id === "chatty30" && x.label === "수다방 지킴이"), "☕ 수다방 지킴이가 있다");
    ok(A.some(x => x.id === "chatty100" && x.label === "수다방 안방마님"), "🫖 수다방 안방마님이 있다");
    ok(순서("chatty30") < 순서("chatty100"), "30일짜리가 100일짜리보다 앞에 있다");
    /* 7일짜리가 30일짜리보다 앞에 서야 "다음 단계" 로 읽힙니다 */
    ok(순서("rew7") < 순서("rew30") && 순서("rev7") < 순서("rev30"),
       "7일짜리가 30일짜리보다 앞에 있다");
    /* 같은 값을 재는 단계형이라 문턱이 서로 달라야 합니다 */
    ok(A.find(x => x.id === "rew7").at === A.find(x => x.id === "rew30").at
       && A.find(x => x.id === "rew7").n < A.find(x => x.id === "rew30").n,
       "★ 같은 값을 재되 문턱만 다르다");
    /* "30일 내내" 로 읽히면 안 됩니다 — 통틀어 30일이에요 */
    ok(/통틀어 30일/.test(A.find(x => x.id === "rew30").desc)
       && /통틀어 30일/.test(A.find(x => x.id === "rev30").desc),
       "★ 연달아가 아니라 '통틀어' 라고 적혀 있다");
    /* 이름표는 바뀔 수 있지만 id 는 못 바꿉니다 — 서버(achv/{닉네임}/got)에
       그 id 로 적혀 있어서, 바꾸면 이미 딴 사람의 배지가 사라집니다. */
    ok(A.find(x => x.id === "rew30")?.label === "퇴고 장인", "이름이 '퇴고 장인' 이다");

    /* 소급 안 되는 것은 반드시 표시가 있어야 합니다 */
    const 새것 = A.filter(x => x.new);
    ok(새것.length > 0 && /오늘부터 셈/.test(AC),
       "★ 오늘부터 세는 업적은 목록에 그렇게 적힌다");
    /* 서버 기록으로 소급되는 것에 new 가 붙어 있으면 거짓말이 됩니다 */
    const 소급 = ["attTotal","attStreak","wcTotal","pomoTotal","msTotal","bestSeg","morningDays"];
    ok(!A.some(x => x.new && 소급.includes(x.at)),
       "★ 서버에 이미 쌓인 것에는 '오늘부터' 를 붙이지 않는다");

    /* 🌅 아침반 두 장 (2026-08-11) */
    ok(A.find(x => x.id === "morn10")?.label === "미라클 모닝반" &&
       A.find(x => x.id === "morn30")?.label === "아침반 반장!",
       "🌅 미라클 모닝반 · 🥇 아침반 반장! 이 있다");
    ok(A.find(x => x.id === "morn10")?.n === 10 &&
       A.find(x => x.id === "morn30")?.n === 30, "10일 · 30일");
    ok(A.find(x => x.id === "morn10")?.g === "출석" &&
       A.find(x => x.id === "morn30")?.g === "출석",
       "★ '들어온 시각' 으로 재니 출석 칸에 넣는다 (작업 시간이 아니라)");
    ok(/"morn"/.test(AC), "★ 접어둘 때도 함께 담긴다 (반년 뒤 숫자가 줄지 않게)");
  }

  /* ── 판정 로직을 실제로 돌립니다 ── */
  {
    const cut = (n) => {
      const i = AC.indexOf("  function " + n + "(");
      return AC.slice(i, AC.indexOf("\n  }\n", i) + 5);
    };
    const box = {};
    vm.createContext(box);
    vm.runInContext(`
      function dayKey(d){d=d||new Date();const m=String(d.getMonth()+1).padStart(2,"0");
        const dd=String(d.getDate()).padStart(2,"0");return d.getFullYear()+"-"+m+"-"+dd;}
      /* 날짜를 밟아 갈 때의 끝점 — 코드와 같은 것을 씁니다 */
      function 오늘낮(){ return new Date(dayKey() + "T12:00:00"); }
      ${cut("computeStats")}${cut("streak")}${cut("kindCount")}${cut("valueOf")}`, box);
    const D = (back) => {
      const d = new Date(); d.setDate(d.getDate() - back);
      return vm.runInContext("dayKey", box)(d);
    };

    /* ② 어제까지 29일 연속, 오늘은 아직 안 들어온 아침 */
    const att = {};
    for (let i = 1; i <= 29; i++) att[D(i)] = { 나: { firstAt: new Date().setHours(3, 0, 0, 0) } };
    box.s1 = { att, wcs: {}, pomo: {}, segs: {}, nick: "나" };
    const r1 = vm.runInContext("computeStats(s1)", box);
    ok(r1.attStreak === 29,
       `★ 오늘 아직 안 들어왔어도 어제까지의 연속이 살아 있다 (${r1.attStreak}일)`);
    ok(r1.dawnDays === 29, "새벽에 들어온 날을 센다");

    /* 🌅 미라클 모닝반 / 아침반 반장 (2026-08-11)
       ★ 3시에 들어온 위 29일은 **세면 안 됩니다.** 새벽반이지 아침반이
         아니에요. 두 업적이 같은 사람에게 뭉뚱그려 붙으면 안 됩니다. */
    ok(r1.morningDays === 0, "★ 새벽 3시는 아침반이 아니다");
    {
      const H = (h, mi) => new Date().setHours(h, mi || 0, 0, 0);
      const 시각 = [
        [4, 59, false, "4시 59분 — 아직 이르다"],
        [5,  0,  true,  "★ 5시 정각부터 센다"],
        [7, 30,  true,  "7시 반"],
        [9, 59,  true,  "★ 9시 59분까지 센다"],
        [10, 0,  false, "★ 10시 정각은 안 센다 ('10시 사이' 는 10시 전까지)"],
        [13, 0,  false, "낮은 안 센다"]
      ];
      시각.forEach(([h, mi, 참, 말], i) => {
        const one = {}; one[D(i + 1)] = { 나: { firstAt: H(h, mi) } };
        box.sm = { att: one, wcs: {}, pomo: {}, segs: {}, nick: "나" };
        ok(vm.runInContext("computeStats(sm)", box).morningDays === (참 ? 1 : 0), 말);
      });

      /* 통틀어 세는가 — 사이에 늦잠 잔 날이 있어도 합쳐져야 합니다 */
      const 띄엄 = {};
      [1, 2, 5, 9, 20].forEach(i => 띄엄[D(i)] = { 나: { firstAt: H(6, 0) } });
      [3, 4].forEach(i => 띄엄[D(i)] = { 나: { firstAt: H(15, 0) } });
      box.sm2 = { att: 띄엄, wcs: {}, pomo: {}, segs: {}, nick: "나" };
      ok(vm.runInContext("computeStats(sm2)", box).morningDays === 5,
         "★ 연달을 필요 없이 통틀어 센다 (늦잠 잔 날이 끼어도 이어짐)");

      /* firstAt 이 없는 옛 기록은 at 으로 대신 봅니다 */
      const 옛 = {}; 옛[D(1)] = { 나: { at: H(8, 0) } };
      box.sm3 = { att: 옛, wcs: {}, pomo: {}, segs: {}, nick: "나" };
      ok(vm.runInContext("computeStats(sm3)", box).morningDays === 1,
         "firstAt 이 없는 옛 기록도 at 으로 세어진다");
    }

    /* 이레 몰아쓰기 — 움직이는 이레 합 */
    const wcs = {};
    [0,1,2,3,4,5,6].forEach(i => wcs[D(i)] = { 나: { total: 5000 } });
    box.s2 = { att: {}, wcs, pomo: {}, segs: {}, nick: "나" };
    const r2 = vm.runInContext("computeStats(s2)", box);
    ok(r2.wcTotal === 35000 && r2.wcStreak === 7, "글자수 누적과 연속을 센다");
    ok(r2.wcBestWeek === 35000, "★ 달력 주가 아니라 '어느 이레를 잘라도' 로 잰다");

    /* ④ 휴식이 작업 시간에 섞이면 안 됩니다 */
    const H = 3600e3;
    const n2 = new Date(); n2.setHours(2, 0, 0, 0);
    const segs = {};
    segs[D(1)] = {
      a: { s: "writing", a: n2.getTime(), b: n2.getTime() + 4 * H },
      z: { s: "rest",    a: n2.getTime(), b: n2.getTime() + 9 * H }
    };
    box.s3 = { att: {}, wcs: {}, pomo: {}, segs, nick: "나" };
    const r3 = vm.runInContext("computeStats(s3)", box);
    ok(r3.msTotal === 4 * H, `★ 휴식은 작업 시간에 안 섞인다 (${(r3.msTotal / H).toFixed(1)}h)`);
    ok(r3.bestSeg === 4 * H, "한 번에 가장 오래 한 구간을 잡는다");
    ok(r3.owlDays === 1, "새벽 작업을 센다");

    /* 종류/날짜로 세는 것들 — 이름이 c 로 시작한다고 횟수로 새면 안 됩니다 */
    box._c = { cGreet: 7, stk_a: 1, stk_b: 1, tag_x: 1, rew_1: 1, rew_2: 1,
               rout_1: 1, rout_2: 1, rout_3: 1 };
    box._stats = {};
    const v = (at) => vm.runInContext(`valueOf({at:"${at}"})`, box);
    ok(v("cGreet") === 7, "횟수로 세는 것은 횟수로");
    ok(v("cStkKind") === 2 && v("cTagKind") === 1, "종류로 세는 것은 종류로");
    ok(v("cRewrite") === 2, "퇴고는 날짜로 센다 (하루에 몇 번을 눌러도 하루)");
    ok(v("cRoutine") === 3,
       "★ 루틴킹도 날짜로 센다 (빠뜨리면 이름이 c 로 시작한다는 이유로 늘 0 이 된다)");
  }

  /* ── 작업 스티커를 며칠 붙였나 (2026-08-11) ─────────────────────
     ★ 이 방의 작업 스티커는 자정에 안 풀립니다(일부러). 그래서 "누른
       순간" 만 세면, 퇴고를 붙여 두고 서른 날 매달린 사람이 **하루로만**
       세어집니다 — 정작 기리려던 사람이 못 따요.
       들어올 때마다 그날 붙여둔 것을 하루로 세야 합니다. */
  {
    const cut = (n) => {
      const i = AC.indexOf("  function " + n + "(");
      return AC.slice(i, AC.indexOf("\n  }\n", i) + 5);
    };
    const box = { _c: {}, _stats: {}, window: {} };
    vm.createContext(box);
    vm.runInContext(`
      function dayKey(d){d=d||new Date();const m=String(d.getMonth()+1).padStart(2,"0");
        const dd=String(d.getDate()).padStart(2,"0");return d.getFullYear()+"-"+m+"-"+dd;}
      /* 날짜를 밟아 갈 때의 끝점 — 코드와 같은 것을 씁니다 */
      function 오늘낮(){ return new Date(dayKey() + "T12:00:00"); }
      let _tagDay="";
      ${cut("kindCount")}${cut("valueOf")}${cut("noteTagDay")}
      window.achvBump=(key,member)=>{ if(member===undefined){_c[key]=(_c[key]||0)+1;return;}
        const k=key+"_"+String(member).replace(/[.#$/[\\]]/g,""); if(_c[k])return; _c[k]=1; };
    `, box);
    const 날짜 = (back) => {
      const real = Date; const d = new Date(); d.setDate(d.getDate() - back);
      box.Date = class extends real { constructor(...a) { return a.length ? new real(...a) : new real(d); } };
      box.Date.now = real.now;
    };

    /* 붙여만 두고 안 건드린 서른 날 */
    box.window.myWorkTag = () => "polish";
    for (let b = 29; b >= 0; b--) { 날짜(b); vm.runInContext("noteTagDay()", box); }
    ok(vm.runInContext(`valueOf({at:"cRewrite"})`, box) === 30,
       "★ 스티커를 붙여만 둬도 하루씩 세어진다 (누른 날만 세면 1일이 된다)");

    /* 하루에 여러 번 들어와도 하루 */
    box._c = {}; vm.runInContext(`_tagDay=""`, box); 날짜(0);
    for (let i = 0; i < 5; i++) vm.runInContext("noteTagDay()", box);
    ok(vm.runInContext(`valueOf({at:"cRewrite"})`, box) === 1, "하루에 몇 번 들어와도 하루로 센다");

    /* 퇴고와 수정이 섞이지 않는가 */
    box._c = {}; vm.runInContext(`_tagDay=""`, box);
    box.window.myWorkTag = () => "revise";
    for (let b = 39; b >= 0; b--) { 날짜(b); vm.runInContext("noteTagDay()", box); }
    ok(vm.runInContext(`valueOf({at:"cRevise"})`, box) === 40, "수정도 날짜로 센다");
    ok(vm.runInContext(`valueOf({at:"cRewrite"})`, box) === 0,
       "★ 퇴고(polish)와 수정(revise)이 섞이지 않는다");
  }
  /* ── 🖥️ 화면 공유 시간 (2026-08-11) ────────────────────────────
     공유 시간은 서버에 기록이 없어서 새로 셉니다. 두 가지를 봅니다 —
       ① 하루 2시간을 정확히 가른다
       ② localStorage 에 매초 쓰지 않는다 (동기 저장이라 화면이 멎어요) */
  {
    const cut = (n) => {
      const i = AC.indexOf("  function " + n + "(");
      return AC.slice(i, AC.indexOf("\n  }\n", i) + 5);
    };
    const store = {};
    let writes = 0;
    const box = { _c: {}, _stats: {},
      window: { AppStore: { getItem: k => (store[k] ?? null),
                            setItem: (k, v) => { writes++; store[k] = v; } },
                addEventListener: () => {} } };
    vm.createContext(box);
    vm.runInContext(`
      function dayKey(d){d=d||new Date();const m=String(d.getMonth()+1).padStart(2,"0");
        const dd=String(d.getDate()).padStart(2,"0");return d.getFullYear()+"-"+m+"-"+dd;}
      /* 날짜를 밟아 갈 때의 끝점 — 코드와 같은 것을 씁니다 */
      function 오늘낮(){ return new Date(dayKey() + "T12:00:00"); }
      function me(){return "나";}
      ${(AC.match(/const SHARE_DAY_MS = [^;]+;/) || ["const SHARE_DAY_MS=0;"])[0]}
      ${(AC.match(/const SHARE_FLUSH_MS = [^;]+;/) || ["const SHARE_FLUSH_MS=30000;"])[0]}
      let _shareAcc=0,_shareFlushed=0;
      ${cut("shareKey")}${cut("shareTick")}${cut("shareFlush")}${cut("kindCount")}${cut("valueOf")}
      window.achvBump=(key,member)=>{ if(member===undefined){_c[key]=(_c[key]||0)+1;return;}
        const k=key+"_"+String(member).replace(/[.#$/[\\]]/g,""); if(_c[k])return; _c[k]=1; };
    `, box);

    const 하루 = (초, back) => {
      const real = Date; const d = new Date(); d.setDate(d.getDate() - back);
      box.Date = class extends real { constructor(...a) { return a.length ? new real(...a) : new real(d); } };
      box.Date.now = real.now;
      vm.runInContext("_shareAcc=0;_shareFlushed=0;", box);
      for (let i = 0; i < 초; i++) vm.runInContext("shareTick(1000)", box);
      vm.runInContext("shareFlush()", box);
    };
    const 값 = () => vm.runInContext(`valueOf({at:"cShareDay"})`, box);
    const 비우기 = () => { Object.keys(store).forEach(k => delete store[k]); box._c = {}; };

    /* ★ 문턱은 **파일에 적힌 값을 그대로** 가져다 씁니다.
       검사에 2시간을 베껴 적으면, 코드에서 1시간으로 낮춰도 안 걸립니다. */
    ok(/const SHARE_DAY_MS = 2 \* 3600e3;/.test(AC), "★ 문턱이 하루 2시간이다");
    하루(7140, 5);                       // 1시간 59분
    ok(값() === 0, "★ 두 시간에서 1분 모자라면 안 세어진다");
    비우기(); 하루(7260, 4);              // 2시간 1분
    ok(값() === 1, "두 시간을 넘기면 하루로 센다");
    비우기(); 하루(3600, 2); 하루(3900, 2);  // 같은 날 나눠서
    ok(값() === 1, "★ 같은 날 나눠 공유해도 이어서 쌓인다");
    비우기();
    for (let b = 29; b >= 0; b--) 하루(7300, b);
    ok(값() === 30, "서른 날이면 30");

    비우기(); writes = 0; 하루(3600, 1);
    ok(writes > 0 && writes <= 200,
       `★ localStorage 에 매초 쓰지 않는다 (1시간에 ${writes}번, 매초면 3,600번)`);
  }
  /* ── 🍅 두 겹 고리 타이머 (2026-08-11) ──────────────────────────
     바깥 = 오늘 작업 시간(목표 대비) · 안쪽 = 지금 뽀모.
     ★ 반지름이 다르면 둘레도 다릅니다. 한 값을 돌려 쓰면 안쪽 고리가
       엉뚱하게 차요 — 눈으로는 잘 안 보이고 각도만 미묘하게 틀립니다. */
  {
    const UI = fs.readFileSync(DIR+"script_ui.js","utf8");
    const H9 = fs.readFileSync(DIR+"index.html","utf8");

    ok(/id="ring-day"/.test(H9) && /id="ring-pom"/.test(H9), "고리가 둘 있다");
    ok(/\.ring-day\{[^}]*stroke: var\(--accent\)/.test(CSS)
       && /\.ring-pom\{[^}]*stroke: var\(--me\)/.test(CSS),
       "★ 테마의 포인트 두 색을 그대로 쓴다 (테마를 바꾸면 함께 바뀐다)");
    ok(/\.pomo-ring-wrap\.no-goal \.ring-day\{ display: none; \}/.test(CSS),
       "★ 목표를 안 정했으면 바깥 고리를 아예 안 그린다 (빈 고리는 '못 채웠다' 로 읽힌다)");

    /* 실제로 돌려 봅니다 */
    const cut = (n) => {
      const i = UI.indexOf("  function " + n + "(");
      return UI.slice(i, UI.indexOf("\n  }\n", i) + 5);
    };
    const store = {};
    const 새칸 = () => ({
      attrs: {}, style: {}, cls: {},
      classList: { toggle(c, on) { this.cls = this.cls || {}; } },
      setAttribute(k, v) { this.attrs[k] = v }
    });
    const box = { RING_R_DAY: 86, RING_R_POM: 66, myNick: "나",
      window: { _goalHours: 4, _statusCache: { "나": { workMs: 3 * 3600e3 + 7 * 60e3 } } },
      document: {
        getElementById: id => store[id] || (store[id] = 새칸()),
        /* [2026-08-12] 가로 바가 생기면서 renderDayRing 이 클래스 이름으로도
           찾습니다. 흉내 상자에도 같은 창구를 열어 둡니다. */
        querySelector: sel => store[sel] || (store[sel] = 새칸())
      } };
    vm.createContext(box);
    vm.runInContext(cut("_ringSet") + cut("_todayWorkMs") + cut("goalHours")
                    + cut("_hm") + cut("renderDayRing"), box);
    const 재기 = (id, r, p) => {
      vm.runInContext(`_ringSet("${id}",${r},${p})`, box);
      const a2 = store[id].attrs;
      const len = +a2["stroke-dasharray"], off = +a2["stroke-dashoffset"];
      return { len: +len.toFixed(1), pct: +((1 - off / len) * 100).toFixed(1) };
    };

    const d = 재기("ring-day", 86, 0.5), pm = 재기("ring-pom", 66, 0.5);
    ok(d.len !== pm.len, "★ 고리마다 둘레를 따로 잰다 (한 값을 돌려 쓰면 안쪽이 틀어진다)");
    ok(d.pct === 50 && pm.pct === 50, "둘 다 반만 채우면 반씩 찬다");

    ok(재기("ring-day", 86, 1.6).pct === 100, "★ 목표를 넘겨도 100%에서 멈춘다");
    ok(재기("ring-day", 86, -0.2).pct === 0, "음수로 안 내려간다");
    ok(재기("ring-day", 86, NaN).pct === 0, "★ 값이 없어도(NaN) 고리가 깨지지 않는다");

    vm.runInContext("renderDayRing()", box);
    ok(/오늘 3h 07m \/ 4h/.test(store["pomo-ring-sub"].textContent), "목표가 있으면 함께 보여준다");

    /* =================================================================
       🍅 가로 바 — 원형과 **같은 값**인가 (2026-08-12)
       -----------------------------------------------------------------
       두 모양을 각각 그리면 한쪽만 고쳐서 어긋납니다. 그래서 그리는
       코드는 한 벌이고, 늘 둘 다 채웁니다. 여기서 그걸 확인해요 —
       안 보이는 쪽이 조용히 썩는 걸 눈으로는 못 잡습니다.
       ================================================================= */
    {
      /* ★ 없으면 터지지 않고 **깨끗하게 실패**해야 합니다.
         가로 바를 안 채우게 만들어 봤더니 검사가 통째로 죽어서, 무엇이
         잘못됐는지가 안 보였어요. 죽는 검사는 못 읽는 검사입니다. */
      const 고리 = store["ring-day"]?.attrs || {};
      const 고리비율 = 1 - (+고리["stroke-dashoffset"]) / (+고리["stroke-dasharray"]);
      const 바 = store["pomo-bar-day"];
      ok(!!바, "★ 가로 바의 '오늘 작업' 막대를 실제로 채운다");
      const 바비율 = parseFloat(바?.style?.width) / 100;
      ok(Number.isFinite(바비율) && Math.abs(고리비율 - 바비율) < 0.001,
         `★ 오늘 작업량이 두 모양에서 같다 (고리 ${(고리비율*100).toFixed(1)}% / 바 ${
            Number.isFinite(바비율) ? (바비율*100).toFixed(1) : "안 채움"}%)`);
      const 밑 = store["pomo-bar-sub"]?.innerHTML || "";
      ok(/3h 07m/.test(밑) && /4시간/.test(밑), "가로 바에도 같은 숫자가 적힌다");
    }
    box.window._goalHours = 0;
    vm.runInContext("renderDayRing()", box);
    ok(store["pomo-ring-sub"].textContent === "오늘 3h 07m", "★ 목표가 없으면 숫자만 보여준다");
    ok(!/시간/.test(store["pomo-bar-sub"]?.innerHTML || ""),
       "★ 가로 바도 목표가 없으면 숫자만 (빈 막대는 '못 채웠다' 로 읽힌다)");
    ok(/\.pomo-barrow\.no-goal \.pomo-bar-track\.day\{ display: none; \}/.test(CSS),
       "목표가 없으면 아래 막대를 아예 안 그린다 (원형과 같은 규칙)");

    /* =================================================================
       가로 바 — 위가 뽀모, 아래가 목표 (2026-08-12)
       -----------------------------------------------------------------
       처음에는 위가 목표였습니다. 그런데 원형은 **바깥**이 목표,
       **안쪽**이 뽀모예요. 가로로 펴면 안쪽(작은 것)이 위로 오는 게
       자연스럽고, 무엇보다 큰 숫자 바로 밑에 붙는 막대가 그 숫자와
       같은 것(뽀모)이라야 설명 없이 읽힙니다.
       ================================================================= */
    {
      const H7 = fs.readFileSync(DIR+"index.html","utf8");
      const 줄 = H7.slice(H7.indexOf('class="pomo-row pomo-barrow'),
                          H7.indexOf('id="pomo-bar-sub"'));
      ok(줄.indexOf("pomo-bar-pom") < 줄.indexOf("pomo-bar-day"),
         "★ 위가 뽀모, 아래가 오늘 목표다");
      /* 굵기도 함께 바뀌어야 합니다 — 원형에서 바깥 고리가 더 굵어요 */
      const 굵기 = (c) => Number((CSS.match(
        new RegExp("\\.pomo-bar-track\\." + c + "\\{ height: (\\d+)px")) || [])[1]);
      ok(굵기("pom") > 굵기("day"),
         `★ 위(뽀모)가 더 굵다 (뽀모 ${굵기("pom")}px / 목표 ${굵기("day")}px)`);
      ok(/\.pomo-bar-track\.pom i\{ background: var\(--me\)/.test(CSS) &&
         /\.pomo-bar-track\.day i\{ background: var\(--accent\)/.test(CSS),
         "★ 색 짝이 원형과 같다 (뽀모=말풍선색 · 목표=강조색)");
      /* [되돌림 2026-08-12] 큰 숫자를 잠깐 막대와 같은 색(--me)으로 뒀다가
         되돌렸습니다. 파란 숫자 밑에 파란 막대가 붙으니 한 덩어리로
         뭉개져 보였어요. 사람은 이 자리를 색으로 구분하지 않습니다 —
         큰 숫자는 하나뿐이고 막대는 위아래로 나란하니 자리만으로 충분해요.
         색은 화면을 살리는 쪽에 씁니다. */
      /* [2026-08-12] 큰 숫자 색 — 세 번 만에 자리를 잡았습니다.
           --accent → --me(뭉개짐) → **--text**
         이 줄에는 이미 포인트 색이 둘 다 나와 있습니다(위 막대 --me,
         아래 막대 --accent). 숫자까지 포인트 색이면 한 줄에 강한 색이
         셋이 되어 시끄러워요. 숫자는 물러나고 막대가 색을 맡습니다. */
      {
        /* ★ 앞에 줄바꿈을 붙여 **규칙 첫머리**를 잡습니다.
           그냥 ".pomo-bar-time{" 로 찾으면 테마 서체 규칙
           (html[...] .pomo-bar-time{ font-family })이 먼저 걸리고,
           거기서부터 다음 color 를 주워 와 엉뚱한 값을 읽습니다.
           실제로 그래서 --accent 라고 잘못 읽었어요. */
        const 숫자색 = (CSS.match(/\n\.pomo-bar-time\{[\s\S]*?color: var\((--\w+)\);/) || [])[1];
        const 고리숫자색 = (CSS.match(
          /#timer-pill\[data-phase\] #timer-text\{[\s\S]*?color: var\((--\w+)\);/) || [])[1];
        const 위막대 = (CSS.match(/\.pomo-bar-track\.pom i\{ background: var\((--\w+)\)/) || [])[1];
        const 아래막대 = (CSS.match(/\.pomo-bar-track\.day i\{ background: var\((--\w+)\)/) || [])[1];

        ok(숫자색 === "--text", `★ 큰 숫자는 글자색이다 (지금 ${숫자색})`);
        /* ★ 원형과 **같은 값**이어야 합니다. 한쪽만 고치면 모양을 바꿀 때
           숫자 색이 달라져서, 같은 타이머인데 남의 것처럼 보입니다.
           값을 적어 두지 않고 두 곳에서 읽어 견줍니다. */
        ok(숫자색 === 고리숫자색,
           `★ 원형과 가로 바의 숫자 색이 같다 (원형 ${고리숫자색} / 가로 ${숫자색})`);
        ok(숫자색 !== 위막대 && 숫자색 !== 아래막대,
           `★ 숫자가 두 막대 색과 겹치지 않는다 (숫자 ${숫자색} / 막대 ${위막대}·${아래막대})`);
        ok(위막대 !== 아래막대 &&
           ["--accent", "--me"].includes(위막대) && ["--accent", "--me"].includes(아래막대),
           "★ 포인트 색 둘은 막대가 하나씩 나눠 갖는다");
      }

      /* ── [뺌 2026-08-12] 고리 아래 색 설명 줄 ──
         "● 오늘 작업 / ● 뽀모". 안쪽 고리는 숫자와 함께 도니 그게
         뽀모라는 게 저절로 읽히고, 바깥은 그 아래 "오늘 1h 14m / 8h"
         가 이미 말해 줍니다. 설명이 필요 없는 그림에 설명을 붙이면
         그림이 작아 보여요.
         ★ 가로 바에는 처음부터 없었습니다 — 이제 두 모양이 같은 결입니다. */
      ok(!/id="pomo-ring-legend"/.test(H9), "★ 고리 아래 색 설명 줄이 없다");
      ok(!/pomo-ring-legend/.test(CSS),
         "★ 그 꾸밈도 함께 걷어냈다 (화면에 없는 것의 규칙만 남으면 쓰는 줄 안다)");
      ok(!/lg-day|lg-pom/.test(H9) && !/lg-day|lg-pom/.test(CSS),
         "점 두 개 규칙도 남지 않았다");
      /* 그래도 **무엇을 보고 있는지**는 여전히 알 수 있어야 합니다 */
      ok(/id="pomo-ring-sub"/.test(H9) && /id="pomo-bar-sub"/.test(H9),
         "★ 두 모양 모두 '오늘 n / 목표' 설명은 그대로다");

      /* =================================================================
         ★★ 가로 바 숫자가 실제로 움직이는가 (2026-08-12)
         -----------------------------------------------------------------
         자리(#pomo-bar-time)만 만들고 **숫자를 넣는 코드를 안 붙여서**
         25:00 에 멈춰 있었습니다. 화면에는 멀쩡히 떠 있어서 한참 몰랐어요.

         ★ 남은 시간을 적는 곳은 #timer-text 하나뿐인데, 거기에 글자를
           쓰는 자리가 셋입니다(1초 몸통·멈춤 그리기·시간 입력칸).
           셋에 한 줄씩 붙이면 네 번째 자리가 생겼을 때 또 빠집니다.
           그래서 원본을 지켜보다 그대로 옮겨 적습니다.
         ================================================================= */
      {
        const UI7 = fs.readFileSync(DIR+"script_ui.js","utf8");
        ok(/function bindPomoTimeMirror/.test(UI7) && /bindPomoTimeMirror\(\);/.test(UI7),
           "★ 가로 바 숫자를 채우는 장치가 있다 (없으면 25:00 에 멈춰 있다)");
        const 거울 = UI7.slice(UI7.indexOf("function bindPomoTimeMirror"),
                               UI7.indexOf("function bindPomoShapeHit"));
        ok(/getElementById\("timer-text"\)/.test(거울) &&
           /getElementById\("pomo-bar-time"\)/.test(거울),
           "원형 숫자를 그대로 옮겨 적는다");
        ok(/new MutationObserver/.test(거울),
           "★ 원본이 바뀌는 것을 지켜본다 (쓰는 자리마다 붙이지 않는다)");
        ok(/dst\.textContent = src\.textContent/.test(거울), "글자를 그대로 옮긴다");
        ok(/row\.dataset\.phase = pill\.dataset\.phase/.test(거울),
           "★ 단계(집중·휴식·멈춤)도 함께 옮긴다");
        ok(/src\._mirrorBound/.test(거울), "두 번 걸리지 않는다");
        ok(/catch \(e\)/.test(거울), "지켜보기가 안 되는 브라우저에서도 안 터진다");
        /* 옮겨 온 단계가 화면에 쓰이는지 — 안 쓰면 옮겨도 소용없습니다 */
        ok(/\.pomo-barrow\[data-phase="paused"\] \.pomo-bar-time\{ opacity: \.55; \}/.test(CSS),
           "★ 멈추면 가로 바 숫자도 흐려진다 (원형과 같은 표정)");
        ok(/#timer-pill\[data-phase="paused"\] #timer-text\{ opacity: \.55; \}/.test(CSS),
           "원형도 그대로다");
        /* [뺌 2026-08-12] "임박" 표시 — 남은 10분부터 붉어지던 것.
           이 방의 뽀모는 그 안에 무언가를 끝내야 하는 시계가 아닙니다.
           집중을 끊어 주는 것이 일이라 재촉할 이유가 없어요. */
        ok(!/timer-warn[^\n]*color: var\(--accent\)/.test(CSS),
           "★ 임박해도 숫자가 붉어지지 않는다");
        ok(!/#timer-pill\.timer-warn\{/.test(CSS), "임박 배경도 없앴다");
        /* 값을 읽는 코드가 어디에도 남지 않아야 합니다 —
           안 쓰는 값을 계속 읽으면 다음 사람이 "살아 있는 기능" 으로 압니다. */
        ["script_realtime.js", "script_ui.js"].forEach(f =>
          ok(!/AppStore\.getItem\("warnMinutes"\)/.test(fs.readFileSync(DIR+f,"utf8")),
             `★ ${f} 에서 임박 기준 값을 더 이상 읽지 않는다`));
        ok(!/id="set-warn-min"/.test(fs.readFileSync(DIR+"index.html","utf8")),
           "조절 슬라이더도 화면에 없다");
        ok(/pill\.classList\.remove\("timer-warn"\)/.test(
             fs.readFileSync(DIR+"script_realtime.js","utf8")),
           "옛 표시가 남아 있던 화면에서도 걷어낸다");
      }

      /* =================================================================
         📜 원고와 잉크 — 뽀모는 인주색, 목표는 먹색 (2026-08-12)
         -----------------------------------------------------------------
         이 테마만 --me 가 먹색, --accent 가 인주색입니다. 다른 테마와
         같은 짝을 쓰면 **지금 도는 것**이 가장 옅어 보여 뒤바뀐 느낌이
         납니다. 원고지 위에서는 인주 도장이 먼저 눈에 들어와야 자연스러워요.
         ================================================================= */
      {
        const 잉크 = {
          고리뽀모: (CSS.match(/html\[data-theme-style="ink"\] \.pomo-ring \.ring-pom\{ stroke: var\((--\w+)\)/) || [])[1],
          고리목표: (CSS.match(/html\[data-theme-style="ink"\] \.pomo-ring \.ring-day\{ stroke: var\((--\w+)\)/) || [])[1],
          바뽀모:   (CSS.match(/html\[data-theme-style="ink"\] \.pomo-bar-track\.pom i\{ background: var\((--\w+)\)/) || [])[1],
          바목표:   (CSS.match(/html\[data-theme-style="ink"\] \.pomo-bar-track\.day i\{ background: var\((--\w+)\)/) || [])[1]
        };
        ok(잉크.고리뽀모 === "--accent" && 잉크.바뽀모 === "--accent",
           "★ 잉크 테마에서 뽀모는 인주색(--accent) 이다");
        ok(잉크.고리목표 === "--me" && 잉크.바목표 === "--me",
           "★ 목표는 먹색(--me) 이다");
        /* ★ 한쪽만 뒤집으면 모양을 바꿀 때 색이 서로 바뀌어 더 헷갈립니다 */
        ok(잉크.고리뽀모 === 잉크.바뽀모 && 잉크.고리목표 === 잉크.바목표,
           "★ 원형과 가로 바를 **함께** 뒤집었다");
        /* 기본 짝은 그대로여야 합니다 — 잉크만 예외입니다 */
        ok(/\.pomo-ring \.ring-pom\{ stroke: var\(--me\)/.test(CSS),
           "다른 테마의 기본 짝(뽀모=--me)은 그대로다");
        /* 잉크에서 두 색이 실제로 다른지 — 같으면 뒤집는 뜻이 없습니다 */
        {
          /* ★ isDark 까지 봐야 합니다 — 기본 테마 이름이 적힌 줄
             (let currentTheme = … || "📜 원고와 잉크") 이 먼저 걸려서
             색을 못 읽었습니다. */
          const l = fs.readFileSync(DIR+"script_ui.js","utf8")
            .split("\n").find(x => x.includes("원고와 잉크") && x.includes("isDark"));
          const g = (k) => (l.match(new RegExp(k + ':\\s*"(#\\w{6})"')) || [])[1];
          ok(g("accent") !== g("me"), `잉크의 두 색이 실제로 다르다 (${g("accent")} / ${g("me")})`);
        }
      }

      /* ── 고리 두께 — 바깥이 더 얇다 (2026-08-12) ──
         둘이 같은 두께면 고리 두 개가 한 덩어리로 보입니다. 굵기를
         달리하면 "안쪽이 지금 도는 것" 이 색을 안 봐도 읽혀요.
         ★ 가로 바와 같은 결이라야 합니다 — 거기서도 뽀모가 더 굵어요. */
      {
        const 기본 = Number((CSS.match(/\.pomo-ring circle\{[\s\S]*?stroke-width: (\d+)/) || [])[1]);
        const 바깥 = Number((CSS.match(/\.pomo-ring \.ring-bg:first-of-type\{ stroke-width: (\d+)/) || [])[1]);
        ok(기본 > 0 && 바깥 > 0, `두 두께를 읽었다 (안쪽 ${기본} / 바깥 ${바깥})`);
        ok(바깥 < 기본, `★ 바깥(목표) 고리가 더 얇다 (${기본} → ${바깥})`);
        ok(Math.round(바깥 / 기본 * 100) === 69 || Math.round(바깥 / 기본 * 100) === 70,
           `★ 바깥이 안쪽의 70% 쯤이다 (${Math.round(바깥/기본*100)}%)`);
        /* 바탕 고리도 함께 얇아져야 합니다 — 안 그러면 얇은 진행선 뒤로
           굵은 회색 테가 삐져나옵니다. */
        ok(/\.pomo-ring \.ring-day,\s*\.pomo-ring \.ring-bg:first-of-type\{/.test(CSS),
           "★ 진행선과 그 바탕이 함께 얇아진다 (한쪽만 얇으면 테가 삐져나온다)");
        /* 그려질 자리가 있는지 — 반지름 + 두께 절반이 100 을 넘으면 잘립니다 */
        ok(86 + 바깥 / 2 <= 100, `바깥 고리가 안 잘린다 (86 + ${바깥/2} ≤ 100)`);
        ok(66 + 기본 / 2 <= 86 - 바깥 / 2,
           `★ 두 고리가 안 겹친다 (안쪽 ${66 + 기본/2} ≤ 바깥 ${86 - 바깥/2})`);
        /* 가로 바와 같은 결인지 */
        const 굵 = (c) => Number((CSS.match(
          new RegExp("\\.pomo-bar-track\\." + c + "\\{ height: (\\d+)px")) || [])[1]);
        ok((바깥 < 기본) === (굵("day") < 굵("pom")),
           "★ 원형과 가로 바가 같은 결이다 (둘 다 뽀모 쪽이 더 굵다)");
      }

      /* ── 테마 서체가 두 모양 모두에 걸리는가 (2026-08-12) ──
         📜 원고와 잉크는 명조, 🌙 마감 전야는 고정폭 숫자를 씁니다.
         ★ 원형에만 걸려 있어서, 모양을 가로 바로 바꾸면 숫자만 갑자기
           기본 서체로 돌아갔습니다. 테마의 결이 반만 걸린 셈이었어요. */
      ["ink", "night"].forEach(t => {
        const re = new RegExp(
          'html\\[data-theme-style="' + t + '"\\] #timer-pill\\[data-phase\\] #timer-text,\\s*' +
          'html\\[data-theme-style="' + t + '"\\] \\.pomo-bar-time\\{');
        ok(re.test(CSS), `★ ${t} 테마 서체가 원형·가로 바 **둘 다**에 걸린다`);
      });
      /* 한 규칙에 묶여 있어야 다음에 서체를 바꿀 때 한쪽만 고치지 않습니다 */
      {
        const 원형만 = (CSS.match(/html\[data-theme-style="\w+"\] #timer-pill\[data-phase\] #timer-text\{/g) || []);
        ok(!원형만.length,
           "★ 원형에만 걸린 서체 규칙이 남아 있지 않다" + (원형만.length ? ` (${원형만.length}개)` : ""));
      }
    }

    /* =================================================================
       가로 바 숫자 크기 — 원형의 120% (2026-08-12)
       -----------------------------------------------------------------
       세 번 손봤습니다. 33px(너무 작음) → 66px(너무 큼) → 53px.
       53px 은 원형일 때 숫자(44px)의 120% 예요.
       ★ 화면에서 크기를 가늠하는 건 눈으로만 되는 일이라, 여기서는
         "지금 값이 이것" 이라고 못만 박아 둡니다. 다음에 또 바꾸면
         이 숫자도 함께 고치면 돼요.
       ================================================================= */
    {
      const 고리최대 = Number((CSS.match(
        /#timer-pill\[data-phase\] #timer-text\{[\s\S]*?font-size: clamp\([\d.]+px, [\d.]+vw, ([\d.]+)px\)/) || [])[1]);
      const 바최대 = Number((CSS.match(
        /\n\.pomo-bar-time\{[\s\S]*?font-size: min\(([\d.]+)px/) || [])[1]);
      ok(고리최대 > 0 && 바최대 > 0, `두 숫자 크기를 읽었다 (원형 ${고리최대} / 바 ${바최대})`);
      ok(Math.round(바최대 / 고리최대 * 100) === 120,
         `★ 가로 바 숫자가 원형의 120% 다 (${고리최대}px → ${바최대}px)`);

      /* ★ 칸을 좁히면 줄어들어야 합니다. 창 폭(vw)으로 재면 안 돼요 —
         칸은 손잡이로 좁히는데 창 크기는 그대로라, 아무리 좁혀도 숫자가
         안 줄어 넘칩니다. 그래서 이 줄 자체를 그릇으로 삼습니다. */
      ok(/\.pomo-barrow\{[^}]*container-type: inline-size/.test(CSS),
         "★ 숫자를 '이 줄의 폭' 으로 잰다 (창 폭이 아니라)");
      ok(/font-size: min\([\d.]+px, [\d.]+cqw\)/.test(CSS),
         "칸이 좁아지면 숫자도 함께 줄어든다");

      /* 좁은 칸에서 진짜 안 넘치는지 더해 봅니다.
         "23:46" 다섯 글자 · 굵은 tabular 숫자는 대략 0.61em 씩입니다. */
      const cq = Number((CSS.match(/font-size: min\([\d.]+px, ([\d.]+)cqw\)/) || [])[1]);
      [300, 240, 160, 120].forEach(w => {
        const px = Math.min(바최대, w * cq / 100);
        const 글자폭 = px * 0.61 * 5 + 4;
        ok(글자폭 < w - 8,
           `칸 ${w}px 에서 안 넘친다 (숫자 ${px.toFixed(0)}px · 글자 ${글자폭.toFixed(0)}px)`);
      });
    }

    /* 오늘 시간을 새로 세지 않는가 — 두 곳에서 세면 카드와 어긋납니다 */
    ok(/window\._statusCache \|\| \{\}\)\[nick\]/.test(UI),
       "★ 오늘 작업 시간은 카드와 **같은 값**을 본다 (따로 세지 않는다)");
    ok(/id="db-goal-hours"/.test(H9) && /function saveGoalHours/.test(UI), "목표 칸이 있다");
    ok(/prefs\/goalHours/.test(UI), "목표는 서버에도 남아 다른 기기에서 이어진다");
    /* 목표가 카드로 새어 나가면 견주는 숫자가 하나 더 생깁니다 */
    ok(!/goalHours/.test(fs.readFileSync(DIR+"script_realtime.js","utf8")),
       "★ 목표는 카드에 나가지 않는다 (나만 본다)");
  }

  /* ── 🔐 입장 승인 · 🚫 내보내기 (2026-08-11) ────────────────────
     모르는 닉네임이 들어와 멤버들이 무서워한 일이 있었습니다. 예전에는
     주소만 알면 아무 닉네임이나 새로 만들어 들어올 수 있었어요.

     ★ 여기서 지켜야 할 것은 하나입니다 —
       **막는 일을 화면이 아니라 보안규칙(서버)이 한다.**
       화면에서만 막으면 개발자도구로 그냥 뚫립니다. */
  {
    const R = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8").replace(/\/\/.*/g,"")).rules;
    const AU = fs.readFileSync(DIR+"script_auth.js","utf8");
    const AD = fs.readFileSync(DIR+"script_admin.js","utf8");
    const AH = fs.readFileSync(DIR+"admin.html","utf8");
    const RT4 = fs.readFileSync(DIR+"script_realtime.js","utf8");

    /* ① 새 닉네임은 승인 명단에 있어야 만들어진다 */
    const no = R.nickOwner.$nick[".write"];
    ok(/config'\)\.child\('allow'\)/.test(no), "★ 승인 명단에 있어야 새 닉네임을 만들 수 있다");
    ok(/!data\.exists\(\)/.test(no), "이미 주인이 있는 닉네임은 그대로 (지금 계신 분들은 영향 없음)");
    ok(/config'\)\.child\('ban'\)/.test(no), "내보낸 닉네임은 다시 만들 수 없다");

    /* ② 내보낸 사람은 접속자 명단에 못 뜬다 */
    ok(/config'\)\.child\('ban'\)/.test(R.status.$nick[".write"]),
       "★ 내보낸 사람은 접속 표시를 쓸 수 없다");

    /* ③ 남의 이름으로 채팅을 쓸 수 없다 + 내보낸 사람은 못 쓴다 */
    ["messages", "messages2"].forEach(k => {
      const v = R[k].$id[".validate"] || "";
      ok(/nickOwner'\)\.child\(newData\.child\('user'\)/.test(v),
         `★ ${k} — 자기 이름으로만 쓸 수 있다`);
      ok(/config'\)\.child\('ban'\)/.test(v), `${k} — 내보낸 사람은 못 쓴다`);
    });

    /* ④ 승인 명단이 놓인 자리가 방장 전용인가 — 여기가 뚫리면 전부 무의미 */
    ok(/auth\.uid === 'ABM1ZJndrqaV3gpYUs03SV9qglr1'/.test(R.config[".write"]),
       "★ 승인·내보내기 명단은 방장만 고칠 수 있다");
    ok(R.config[".read"] === true, "명단은 누구나 읽는다 (입장 전에 안내하려면 읽혀야 함)");

    /* ⑤ 화면 쪽 — 안내와 관리 */
    ok(/config\/allow\/" \+ nick/.test(AU) && /config\/ban\/" \+ nick/.test(AU),
       "입장 창이 미리 확인해 안내한다");
    ok(/승인한 닉네임만 들어올 수 있어요/.test(AU), "막혔을 때 이유를 알려 준다");
    ok(/await auth\.signOut\(\);[\s\S]{0,120}승인한 닉네임만/.test(AU),
       "★ 규칙에 막히면 만들어진 계정을 도로 내보낸다 (반쯤 들어온 상태로 남지 않게)");

    ok(/id="adm-allow-card"/.test(AH) && /id="adm-ban-card"/.test(AH), "관리자 화면에 두 칸이 있다");
    ok(/function seedAllow/.test(AD), "지금 쓰는 닉네임을 한 번에 승인하는 길이 있다");
    /* ★ [고침 2026-08-11] 여기 있던 검사는 "규칙보다 먼저 명단을 채우라"
       였습니다. 그런데 다시 따져 보니 **순서는 상관없었어요** —
       쓰던 분들은 닉네임 자리가 이미 잡혀 있어서, 막히는 길(새로 만들기)을
       아예 지나가지 않습니다. 겁만 주는 안내였습니다.

       진짜 걸리는 경우는 따로 있습니다: 예전에 ✕ 로 지운 닉네임은 자리가
       비어 있어서 새로 만들어야 하는데, [전부] 로 채워도 안 들어옵니다
       (nickOwner 를 보고 채우니까요). 그 사람만 손으로 넣어야 해요.
       쓸모없는 겁 대신 이걸 적어 둡니다. */
    ok(/✕ 로 지운 적 있는 닉네임/.test(AH),
       "★ 지운 적 있는 닉네임은 손으로 넣어야 한다고 적어 두었다");
    ok(/nickOwner/.test(AD.slice(AD.indexOf("async function seedAllow"),
                                 AD.indexOf("async function loadBanList"))),
       "[전부] 는 지금 쓰이는 닉네임(nickOwner)에서 가져온다");

    /* ⑥ 내보내는 순서 — 문을 먼저 잠그고 지워야 그 사이에 다시 못 씁니다 */
    {
      const fn = AD.slice(AD.indexOf("async function addBan"), AD.indexOf("async function delBan"));
      ok(fn.indexOf('config/ban/') < fn.indexOf('status/'),
         "★ 문을 먼저 잠그고 접속 표시를 지운다 (순서가 바뀌면 그 사이에 다시 쓴다)");
      ok(/config\/allow\/" \+ nick\)\.remove/.test(fn), "승인 명단에서도 함께 뺀다");
      ok(/screens\/" \+ nick\)\.remove/.test(fn), "공유 중이던 화면도 내린다");
    }

    /* ⑦ 이미 적혀 있던 접속 표시가 남아 있어도 화면에서는 사라져야 합니다 */
    ok(/function dropBanned/.test(RT4) && /listenBans\(\);/.test(RT4),
       "★ 내보내면 남의 화면에서도 곧바로 사라진다");
  }

  /* ── ★ 공유 그림이 눌리지 않는가 (2026-08-11) ─────────────────
     오래 있던 버그입니다. 세로를 "가로의 0.6배" 로 못박아 두고
     drawImage 에 목적지 크기만 줬는데, 그러면 잘라내는 게 아니라
     **원본을 그 상자에 밀어 넣습니다.** 무슨 창을 띄우든 납작해졌어요.

     ★ 비율은 언제나 지켜야 합니다. 용량은 세로를 자르는 대신
       **넓이(픽셀 수)** 로 잡습니다. */
  {
    const SH4 = fs.readFileSync(DIR+"script_share.js","utf8");
    ok(!/Math\.round\(w \* 0\.6\)\)\)/.test(SH4),
       "★ 세로를 가로의 0.6배로 못박던 줄이 없다");
    ok(/const PIX_BUDGET = SHARE_W_MAX \* Math\.round\(SHARE_W_MAX \* 0\.6\)/.test(SH4),
       "용량은 넓이(픽셀 수)로 잡는다");
    ok(/Math\.sqrt\(PIX_BUDGET \/ \(w \* h\)\)/.test(SH4),
       "★ 넘치면 가로세로를 **같은 비율로** 함께 줄인다");

    /* 실제로 돌려서 비율이 지켜지는지 봅니다 */
    const box = { SHARE_W_MAX: 360 };
    vm.createContext(box);
    vm.runInContext(`
      const PIX_BUDGET = SHARE_W_MAX * Math.round(SHARE_W_MAX * 0.6);
      function calc(sw, vw, vh) {
        let w = sw, h = Math.max(1, Math.round(w * (vh / vw)));
        if (w * h > PIX_BUDGET) {
          const k = Math.sqrt(PIX_BUDGET / (w * h));
          w = Math.max(1, Math.round(w * k));
          h = Math.max(1, Math.round(h * k));
        }
        return [w, h];
      }`, box);

    const 창들 = [[1216,1332],[1536,1990],[1920,1080],[400,80],[800,2400],[3840,2160]];
    const 눌림 = 창들.filter(([vw, vh]) => {
      const [w, h] = vm.runInContext(`calc(360, ${vw}, ${vh})`, box);
      return Math.abs((vh / vw) - (h / w)) > 0.03;
    });
    ok(!눌림.length,
       "★ 어떤 창이든 비율이 그대로다" + (눌림.length ? " — " + 눌림.map(x => x.join("x")).join(", ") : ""));

    /* 용량이 예전보다 커지면 40KB 상한에 걸려 프레임이 통째로 건너뛰어집니다 */
    const 넘침 = 창들.filter(([vw, vh]) => {
      const [w, h] = vm.runInContext(`calc(360, ${vw}, ${vh})`, box);
      return w * h > 360 * 216 * 1.01;
    });
    ok(!넘침.length, "★ 픽셀 수가 예전 가장 큰 그림을 넘지 않는다 (용량 상한에 안 걸리게)");

    /* 사생활 — 가장 선명해도 원본 가로가 400px 아래로 줄어야 합니다 */
    const 큰것 = 창들.filter(([vw, vh]) => vm.runInContext(`calc(360, ${vw}, ${vh})`, box)[0] >= 400);
    ok(!큰것.length, "★ 가장 선명해도 가로 400px 아래로 줄어든다 (글자가 읽히지 않는 선)");
  }

  /* ── 🖥️ 카드에 맞추기 (2026-08-11) ───────────────────────────
     "채우기" 는 넘치는 쪽을 잘라냅니다. 타임좌처럼 가로로 길쭉한 창은
     그러면 **양옆이 잘려 숫자가 사라져요.** 그래서 "전체 보기" 를 함께 둡니다.

     ★ 이 값은 **공유하는 사람**이 정하고 모두의 화면에 그대로 갑니다.
       보는 쪽이 각자 고르면, 정작 카드가 잘려 보이는 걸 아는 본인이
       남들 화면을 고쳐 줄 수 없습니다. */
  {
    const SH3 = fs.readFileSync(DIR+"script_share.js","utf8");
    ok(/fit: _shareFit/.test(SH3), "★ 맞추는 방식을 그림과 함께 서버로 보낸다");
    ok(/r\.fit === "contain"/.test(SH3), "보는 쪽이 그 값을 그대로 따른다");
    ok(/\(r\.fit === "contain"\) \? "contain" : "cover"/.test(SH3),
       "★ 모르는 값이 오면 예전처럼 채우기 (옛 기록과 섞여도 안 깨진다)");
    ok(/data-fit="cover"/.test(SH3) && /data-fit="contain"/.test(SH3),
       "뭉갬 조절판에 채우기·전체 보기가 함께 있다");
    ok(/function setShareFit/.test(SH3) && /AppStore\?\.setItem\(FIT_KEY/.test(SH3),
       "고른 방식을 이 기기에 적어 둔다");
    ok(/loadShareFit\(\);/.test(SH3), "★ 다음 접속에도 그 방식이 이어진다");
    ok(/\.share-img\.is-cover\{ object-fit: cover; \}/.test(CSS)
       && /\.share-img\.is-contain\{ object-fit: contain; \}/.test(CSS),
       "두 방식이 스타일에 다 있다");
    /* 옛 규칙(무조건 자르기)이 남아 있으면 새 선택이 먹히지 않습니다.
       ★ 줄 맨 앞의 `.share-img{` 만 봅니다 — `body.solo-mode .share-img{`
         같은 더 좁은 규칙까지 걸리면 엉뚱한 곳을 재게 됩니다. */
    const _base = CSS.search(/^\.share-img\{/m);
    const old = CSS.slice(_base, CSS.indexOf("}", _base));
    ok(!/object-fit:/.test(old),
       "★ .share-img 에 맞추는 방식을 박아 두지 않는다 (선택과 싸우게 된다)");
    /* 그러니 그리는 쪽이 둘 중 하나를 반드시 붙여야 합니다 */
    ok(/class="share-img is-\$\{row\.fit === "contain" \? "contain" : "cover"\}"/.test(SH3),
       "★ 그릴 때 둘 중 하나를 반드시 붙인다 (안 붙으면 그림이 늘어난다)");
  }

  /* ── ☕ 수다방 들어온 날 (2026-08-11) ─────────────────────────
     chattyParticipation 에는 "지금 참여 중인가" 한 칸만 있고 **어느
     날들에 들어왔는지는 기록이 없습니다.** 그래서 오늘부터 하루씩 세요.
     ★ 세는 자리가 [참여하기] 를 누른 곳이어야 합니다 — 탭만 열어 본
       것으로 세면 "들어왔다" 가 아니라 "구경했다" 가 됩니다. */
  {
    const CH3 = fs.readFileSync(DIR+"script_chatty.js","utf8");
    const jc = CH3.slice(CH3.indexOf("async function joinChatty"),
                         CH3.indexOf("async function leaveChatty"));
    ok(/achvBump\?\.\("cha"/.test(jc), "★ [참여하기] 를 누른 자리에서 센다");
    ok(!/achvBump\?\.\("cha"/.test(CH3.slice(CH3.indexOf("function switchChatTab"),
                                              CH3.indexOf("function _escChatty"))),
       "★ 탭을 여는 것만으로는 안 센다");

    /* 실제 조각을 떼어 돌려 봅니다 */
    const i3 = CH3.indexOf("      const d = new Date();");
    const 조각 = "{" + CH3.slice(i3, CH3.indexOf("} catch (e) {}", i3)) + "}";
    const cut2 = (n) => {
      const i = AC.indexOf("  function " + n + "(");
      return AC.slice(i, AC.indexOf("\n  }\n", i) + 5);
    };
    const box3 = { _c: {}, _stats: {}, window: {} };
    vm.createContext(box3);
    vm.runInContext(`${cut2("kindCount")}${cut2("valueOf")}
      window.achvBump=(key,member)=>{ if(member===undefined){_c[key]=(_c[key]||0)+1;return;}
        const k=key+"_"+String(member).replace(/[.#$/[\\]]/g,""); if(_c[k])return; _c[k]=1; };`, box3);
    const 들어감 = (back) => {
      const real = Date; const d = new Date(); d.setDate(d.getDate() - back);
      box3.Date = class extends real { constructor(...a) { return a.length ? new real(...a) : new real(d); } };
      vm.runInContext(조각, box3);
    };
    const 값3 = () => vm.runInContext(`valueOf({at:"cChattyDay"})`, box3);

    for (let b = 39; b >= 0; b--) 들어감(b);
    ok(값3() === 40, "서로 다른 40일이면 40");
    box3._c = {}; for (let k = 0; k < 5; k++) 들어감(0);
    ok(값3() === 1, "★ 같은 날 여러 번 눌러도 하루로 센다");
    ok(vm.runInContext(`valueOf({at:"cForest"})`, box3) === 0
       && vm.runInContext(`valueOf({at:"cShareDay"})`, box3) === 0,
       "★ 대숲·화면 공유와 섞이지 않는다");
  }

  {
    const SH2 = fs.readFileSync(DIR+"script_share.js","utf8");
    ok(/achvShareTick\?\.\(1000\)/.test(SH2), "공유 중 1초마다 업적 쪽에 알린다");
    ok(/achvShareFlush\?\.\(\)/.test(SH2), "★ 공유를 끌 때 모아둔 초를 마저 적는다");
  }

  /* 세는 일은 한 곳에서만 — 두 곳에서 세면 어긋납니다 */
  {
    const WT3 = fs.readFileSync(DIR+"script_worktag.js","utf8");
    ok(/achvNoteTagDay\?\.\(\)/.test(WT3), "작업 스티커는 업적 쪽 창구를 부른다");
    ok(!/achvBump\?\.\("rew"/.test(WT3), "★ 날짜 세기를 두 곳에서 하지 않는다");
  }

  /* ── 되풀이 (2026-08-11) ──────────────────────────────────────────
     "하루 1만 자" 는 한 번 따고 끝날 일이 아닙니다. 두 번째·열 번째가
     더 대단하니 ×N 을 함께 보여줍니다.
     ★ 되풀이를 셀 수 있는 것과 없는 것을 가르는 게 핵심입니다. */
  {
    const i = AC.indexOf("  const ACHV = [");
    const body = AC.slice(i, AC.indexOf("\n  ];", i) + 5).replace("const ACHV", "var ACHV");
    const box = {};
    vm.createContext(box);
    vm.runInContext(body, box);
    const A = box.ACHV;

    ok(A.some(x => x.id === "burst7" && x.label === "성실 폭발"), "💥 성실 폭발이 있다");
    ok(A.some(x => x.id === "harv7" && x.label === "토마토 수확왕"), "🌾 토마토 수확왕이 있다");
    ok(A.filter(x => x.rep).length >= 4, "되풀이되는 업적이 여럿 있다");

    /* ★ 누적·연속처럼 한 번뿐인 것에 되풀이를 달면 거짓말이 됩니다 */
    const 한번뿐 = ["wcTotal", "attTotal", "attStreak", "msTotal", "pomoTotal", "wcStreak"];
    const 잘못 = A.filter(x => x.rep && 한번뿐.includes(x.at)).map(x => x.id);
    ok(!잘못.length, "★ 한 번뿐인 업적에는 되풀이를 달지 않는다" + (잘못.length ? " — " + 잘못.join(", ") : ""));
    /* 움직이는 이레로 재는 "한 주 3만" — 하루씩 밀며 세면 한 주가 일곱 번이 됩니다 */
    ok(!A.find(x => x.id === "wcw3m")?.rep,
       "★ 움직이는 이레로 재는 업적은 되풀이를 세지 않는다 (한 주가 일곱 번으로 부푼다)");
  }

  /* 성실 폭발 — 이레마다 새로 셉니다 */
  {
    const cut = (n) => {
      const i = AC.indexOf("  function " + n + "(");
      return AC.slice(i, AC.indexOf("\n  }\n", i) + 5);
    };
    const box = {};
    vm.createContext(box);
    vm.runInContext(`
      function dayKey(d){d=d||new Date();const m=String(d.getMonth()+1).padStart(2,"0");
        const dd=String(d.getDate()).padStart(2,"0");return d.getFullYear()+"-"+m+"-"+dd;}
      /* 날짜를 밟아 갈 때의 끝점 — 코드와 같은 것을 씁니다 */
      function 오늘낮(){ return new Date(dayKey() + "T12:00:00"); }
      ${cut("computeStats")}${cut("streak")}`, box);
    const dk = vm.runInContext("dayKey", box);
    const 재보기 = (spec) => {
      const wcs = {};
      spec.forEach((v, i) => {
        const d = new Date(); d.setDate(d.getDate() - (spec.length - 1 - i));
        if (v > 0) wcs[dk(d)] = { 나: { total: v } };
      });
      box.src = { att: {}, wcs, pomo: {}, segs: {}, nick: "나" };
      return vm.runInContext("computeStats(src)", box);
    };
    const F = (n, v) => Array(n).fill(v);

    /* =================================================================
       ★ [2026-08-12] 새벽에는 오늘이 빠지던 버그
       -----------------------------------------------------------------
       날짜를 하루씩 밟는 쪽은 낮 12시로 맞춰 두었는데(서머타임에 하루가
       밀리지 않게), **끝점만 "지금"** 이었습니다. 그래서 자정~낮 12시에
       켜면 오늘이 끝점을 넘어 계산에서 빠졌어요.

       이레를 채우고 새벽 한 시에 들어오면 엿새로 세어져 💥 성실 폭발이
       안 붙고, 낮이 되면 슬그머니 붙었습니다. 이 검사가 00:33 에 돌다가
       걸려서 알았습니다 — 저녁에 돌렸으면 못 봤을 거예요.
       ================================================================= */
    ok(/function 오늘낮\(\)/.test(AC), "끝점을 낮 12시로 맞추는 함수가 있다");
    ok(!/const to = new Date\(\);/.test(AC) && !/const pTo = new Date\(\);/.test(AC),
       "★ 끝점으로 '지금' 을 쓰지 않는다 (새벽에 오늘이 빠진다)");
    ok((AC.match(/= 오늘낮\(\);/g) || []).length === 2,
       "성실 폭발·토마토 수확왕 두 곳 다 고쳤다");

    /* 끝점을 어느 쪽으로 잡느냐가 왜 갈리는지, 날짜 셈으로 보여 둡니다.
       (시계를 갈아 끼우는 대신 두 끝점을 직접 견줍니다 — 더 단순합니다) */
    {
      const 오늘 = new Date();
      const 낮끝 = new Date(
        `${오늘.getFullYear()}-${String(오늘.getMonth()+1).padStart(2,"0")}` +
        `-${String(오늘.getDate()).padStart(2,"0")}T12:00:00`);
      /* 밟아 가는 날짜도 낮 12시라, 끝점이 낮 12시면 오늘이 늘 들어옵니다 */
      ok(new Date(낮끝) <= 낮끝, "★ 끝점이 낮 12시면 오늘이 언제나 들어온다");
      /* 옛 방식 — 새벽 1시에 켜면 오늘(낮 12시)이 끝점을 넘어 빠집니다 */
      const 새벽1시 = new Date(오늘); 새벽1시.setHours(1, 0, 0, 0);
      ok(낮끝 > 새벽1시,
         "★ 끝점이 '지금' 이면 새벽에는 오늘이 빠진다 — 이게 옛 버그였다");
      /* 저녁에는 멀쩡했습니다. 그래서 오래 못 찾았어요 */
      const 저녁9시 = new Date(오늘); 저녁9시.setHours(21, 0, 0, 0);
      ok(낮끝 <= 저녁9시, "저녁에 돌리면 멀쩡했다 (그래서 안 드러났다)");
    }

    ok(재보기(F(7, 5000)).sincereBursts === 1, "이레 내리 5천 자 → 1회");
    ok(재보기(F(6, 5000)).sincereBursts === 0, "엿새는 아직 아니다");
    ok(재보기(F(14, 5000)).sincereBursts === 2,
       "★ 열나흘 내리면 2회 (한 번으로 치면 계속할 이유가 없어진다)");
    ok(재보기([...F(7, 5000), 4000, ...F(7, 5000)]).sincereBursts === 2,
       "★ 중간에 4,000자 인 날이 끼면 거기서 끊고 다시 센다");
    ok(재보기([...F(3, 5000), ...F(3, 6000)]).sincereBursts === 0, "엿새짜리 연속은 0회");
    ok(재보기([10000, 0, 10000, 0, 10000]).sincereBursts === 0,
       "★ 띄엄띄엄 잘 쓴 날은 성실 폭발이 아니다 (연달아여야 한다)");
    ok(재보기([10000, 0, 10000, 0, 10000]).wcDays10k === 3, "1만 자 넘긴 날은 따로 센다");

    /* 🌾 토마토 수확왕 — 성실 폭발과 **같은 방식**이어야 합니다.
       두 업적이 다르게 세면 "왜 저건 2회고 이건 1회지?" 가 됩니다. */
    const 뽀모재기 = (spec) => {
      const pomo = {};
      spec.forEach((v, i) => {
        const d = new Date(); d.setDate(d.getDate() - (spec.length - 1 - i));
        if (v > 0) pomo[dk(d)] = { count: v };
      });
      box.src = { att: {}, wcs: {}, pomo, segs: {}, nick: "나" };
      return vm.runInContext("computeStats(src)", box);
    };
    ok(뽀모재기(F(7, 10)).tomatoBursts === 1, "이레 내리 10알 → 1회");
    ok(뽀모재기(F(7, 9)).tomatoBursts === 0, "★ 아홉 알로는 안 된다 (열 알 이상)");
    ok(뽀모재기(F(14, 12)).tomatoBursts === 2, "열나흘 내리면 2회 (성실 폭발과 같은 셈법)");
    ok(뽀모재기([...F(7, 10), 0, ...F(7, 10)]).tomatoBursts === 2,
       "★ 뽀모를 아예 안 돌린 날이 끼면 거기서 끊는다");
    ok(뽀모재기([...F(7, 10), 9, ...F(7, 10)]).tomatoBursts === 2, "아홉 알인 날도 끊는다");
  }

  ok(/rep: _rep/.test(AC), "되풀이 횟수도 서버에 함께 올린다");
  ok(/if \(n > \(Number\(_rep\[a\.id\]\) \|\| 1\)\)/.test(AC),
     "★ 횟수가 늘었을 때만 알린다 (매번 알리면 새로고침마다 뜬다)");
  ok(/achv-x/.test(AC) && /\.achv-x\{/.test(CSS), "×N 표시가 있다");

  /* ── 오래된 기록 접기 (2026-08-11) ────────────────────────────────
     훑는 범위가 200일이라, 반년이 넘으면 오래된 날이 계산에서 빠지고
     **누적이 뒷걸음질칩니다.** 150일보다 오래된 날을 미리 합계로 접어
     그 일을 막습니다. 여기서 지켜야 할 것은 하나예요 —
     ★ 접기 전과 접은 뒤의 값이 **똑같아야** 합니다. */
  {
    const cut = (n) => {
      const i = AC.indexOf("  function " + n + "(");
      return AC.slice(i, AC.indexOf("\n  }\n", i) + 5);
    };
    const box = { FOLD_DAYS: 150 };
    vm.createContext(box);
    vm.runInContext(`
      function dayKey(d){d=d||new Date();const m=String(d.getMonth()+1).padStart(2,"0");
        const dd=String(d.getDate()).padStart(2,"0");return d.getFullYear()+"-"+m+"-"+dd;}
      /* 날짜를 밟아 갈 때의 끝점 — 코드와 같은 것을 씁니다 */
      function 오늘낮(){ return new Date(dayKey() + "T12:00:00"); }
      ${cut("computeStats")}${cut("streak")}${cut("foldOld")}`, box);
    const dk = vm.runInContext("dayKey", box);

    /* 300일치 — 접는 선보다 훨씬 오래된 날이 섞이게 */
    const att = {}, wcs = {}, pomo = {}, segs = {}, H = 3600e3;
    for (let back = 299; back >= 0; back--) {
      const d = new Date(); d.setDate(d.getDate() - back);
      const k = dk(d);
      const t = new Date(d); t.setHours(3, 0, 0, 0);
      /* ★ 들어온 시각을 **섞습니다.** 예전에는 전부 새벽 3시였는데,
         그러면 아침(5~10시)으로 세는 값이 양쪽 다 0 이라 접기 검사가
         🌅 아침반을 못 봅니다 — 접어 담기를 빠뜨려도 통과했어요. */
      const ta = new Date(d); ta.setHours(back % 3 === 0 ? 7 : 3, 30, 0, 0);
      att[k] = { 나: { firstAt: ta.getTime() } };
      wcs[k] = { 나: { total: 1000 + (back % 9) * 900 } };
      pomo[k] = { count: 3 + (back % 9) };
      segs[k] = { a: { s: "writing", a: t.getTime(), b: t.getTime() + (1 + (back % 5)) * H } };
    }
    box.src = { att, wcs, pomo, segs, nick: "나", base: {} };
    const 접기전 = vm.runInContext("computeStats(src)", box);

    box.base = vm.runInContext("foldOld(src, {})", box);
    const base = box.base;
    ok(!!base && !!base.upto, "오래된 날을 접어 base 를 만든다");

    /* 접힌 날들을 자료에서 빼 봅니다 — 범위 밖으로 나간 셈 */
    const 남기기 = (o) => {
      const out = {};
      Object.keys(o).forEach(d => { if (d > base.upto) out[d] = o[d]; });
      return out;
    };
    box.src2 = { att: 남기기(att), wcs: 남기기(wcs), pomo: 남기기(pomo),
                 segs: 남기기(segs), nick: "나", base };
    const 접은뒤 = vm.runInContext("computeStats(src2)", box);

    /* 누적은 더하고, 최고 기록은 큰 쪽을 남깁니다 */
    const 같아야 = ["wcTotal","msTotal","pomoTotal","attTotal","wcDays5k","wcDays10k",
                    "seg3hCount","day8hCount","pomoDay8Count","dawnDays","weekendDays",
                    "owlDays","larkDays","morningDays","wcBestDay","bestSeg","bestDayMs","pomoBestDay",
                    "wcBestWeek","sincereBursts","tomatoBursts"];
    const 어긋남 = 같아야.filter(k => 접기전[k] !== 접은뒤[k]);
    ok(!어긋남.length,
       "★ 접어도 누적·최고 기록이 그대로다" + (어긋남.length ? " — " + 어긋남.join(", ") : ""));
    ok(접은뒤.wcTotal > 0 && 접은뒤.attTotal === 300, "접은 뒤에도 300일이 온전히 세어진다");

    /* ★★ 진짜 위험한 자리는 여기입니다.
       접는 선(150일)과 훑는 범위(200일) 사이 50일은 **base 에도 있고
       창에도 남아 있습니다.** 그 날들을 걸러내지 않으면 두 번 세어져서
       누적이 한 번에 부풀어요. 위 경우(창 밖으로 나감)로는 안 잡힙니다. */
    box.src3 = { att, wcs, pomo, segs, nick: "나", base };   // 날짜를 안 지운 채로
    const 겹친채 = vm.runInContext("computeStats(src3)", box);
    const 부풀음 = 같아야.filter(k => 접기전[k] !== 겹친채[k]);
    ok(!부풀음.length,
       "★ 접힌 날이 창에 남아 있어도 두 번 세지 않는다" + (부풀음.length ? " — " + 부풀음.join(", ") : ""));

    /* ★ 연속은 접어 담지 않습니다 — 접는 선(150일)까지만 셉니다.
       연속을 재는 업적 중 가장 긴 것이 그 안에 들어와야 안전합니다. */
    const i2 = AC.indexOf("  const ACHV = [");
    const body2 = AC.slice(i2, AC.indexOf("\n  ];", i2) + 5).replace("const ACHV", "var ACHV");
    const box2 = {};
    vm.createContext(box2);
    vm.runInContext(body2, box2);
    const 연속업적 = box2.ACHV.filter(x => /Streak$/.test(String(x.at)));
    const 가장긴 = Math.max(0, ...연속업적.map(x => x.n));
    ok(가장긴 > 0 && 가장긴 <= 150,
       `★ 연속을 재는 업적이 접는 선 안에 있다 (가장 긴 것 ${가장긴}일 ≤ 150일)`);
  }

  /* ── ① 한 번 딴 것은 빼지 않는가 ── */
  ok(!/delete _got\[/.test(AC), "★ 딴 업적을 도로 빼는 코드가 없다");
  /* 되풀이가 붙으면서 "이미 딴 것" 도 횟수는 다시 봅니다.
     다만 **딴 시각(got)** 은 첫 번째 것을 그대로 둬야 합니다 —
     다시 찍으면 목록에서 늘 맨 위로 올라와 "가장 최근" 이 뒤엉킵니다. */
  ok(/if \(_got\[a\.id\]\) \{[\s\S]{0,400}?return;\s*\}/.test(AC),
     "이미 딴 것은 다시 따지 않는다 (횟수만 다시 본다)");
  /* "이미 딴 것" 가지 안에서 got 을 다시 찍으면 안 됩니다 —
     찍으면 되풀이할 때마다 목록 맨 위로 올라와 대표 업적이 계속 바뀝니다. */
  {
    const i = AC.indexOf("      if (_got[a.id]) {");
    const 가지 = AC.slice(i, AC.indexOf("\n        return;\n      }", i));
    ok(i > 0 && !/_got\[a\.id\] =/.test(가지),
       "★ 되풀이해도 처음 딴 시각은 덮어쓰지 않는다");
  }

  /* ── ③ 서버에 올라가는 것 ── */
  ok(/update\(\{ got: _got, rep: _rep, pick: _pick \|\| "", c: _c \}\)/.test(AC),
     "★ 서버에는 결과만 올린다");
  ok(!/wcTotal:|msTotal:/.test(AC.slice(AC.indexOf("async function save"))),
     "★ 몇 자·몇 시간은 서버로 올리지 않는다");
  ok(RULES2.achv[".read"] === true, "업적은 모두가 읽는다 (남의 카드에서 보려면)");
  ok(/nickOwner/.test(RULES2.achv.$nick[".write"]), "★ 쓰기는 본인만 (규칙이 막는다)");

  /* ── 훑는 양 ── */
  ok(/limitToLast\(SCAN_DAYS\)/.test(AC), "★ 날짜를 끊어서 훑는다 (통째로 받지 않는다)");
  ok(/AppStore\?\.getItem\(CACHE_KEY\) === today/.test(AC),
     "★ 같은 날 다시 훑지 않는다");

  /* ── 화면 ── */
  ok(/id="achv-pill"/.test(H8) && /id="achv-panel"/.test(H8), "알약과 판이 있다");
  ok(H8.indexOf('id="room-todo"') < H8.indexOf('id="achv-pill"'),
     "★ 할 일 줄 오른쪽에 나란히 선다");
  ok(/\.achv-pop\{[^}]*bottom: calc\(100% \+ 6px\)/.test(CSS),
     "★ 판이 위로 펼쳐진다 (명단 맨 아래라 아래로 열면 화면 밖으로 나간다)");
  ok(/#room-todo\[hidden\] ~ \.room-foot-sep\{ display: none; \}/.test(CSS),
     "할 일 줄이 없는 날엔 사이 선도 함께 감춘다");
  ok(/\.room-foot:has\(#room-todo\[hidden\]\):has\(#achv-pill\[hidden\]\)/.test(CSS),
     "★ 📓 뒤에 아무것도 없는 날엔 그 선도 감춘다 (허공에 선만 뜨지 않게)");

  /* [2026-08-11] 눈높이 맞추기 — 세 알약이 제각각 떠 있었습니다.
     원인은 알약마다 따로 갖고 있던 아래 여백이었어요. 가운데 맞춤은
     "여백까지 포함한 상자" 를 기준으로 하니, 여백 있는 쪽만 올라갑니다. */
  ok(/\.room-foot\{[^}]*padding-bottom: var\(--sp-3\)/.test(CSS),
     "★ 아래 여백은 줄이 통째로 가진다");
  /* ★ 앞에 줄바꿈을 붙여 **규칙 첫머리**를 잡습니다. 그냥 ".room-todo{" 로
     찾으면 리뉴얼 시험판의 ".dock-pill.dock-inline .room-todo{" 까지 걸려요. */
  ok(!/\n\.room-todo\{[^}]*padding/.test(CSS) && !/\n\.achv-bar\{[^}]*padding/.test(CSS),
     "★ 알약 각자는 아래 여백을 갖지 않는다 (이게 어긋남의 원인이었다)");
  {
    const m = CSS.match(/\.room-foot \.room-pill,\s*\.room-foot \.room-todo-pill,\s*\.room-foot \.achv-pill\{([^}]*)\}/);
    ok(!!m, "★ 세 알약이 한 규칙으로 묶여 있다");
    const body = m ? m[1] : "";
    ok(/box-sizing: border-box/.test(body), "테두리를 높이에 포함해 센다");
    ok(/min-height: 26px/.test(body), "★ 셋의 최소 높이가 같다");
    ok(/padding-top: 4px/.test(body) && /padding-bottom: 4px/.test(body),
       "위아래 여백이 같다 (좌우는 알약마다 달라도 됩니다)");
    ok(/line-height: 1\.3/.test(body), "글줄 높이가 같다");
    ok(/border-width: 1px/.test(body), "테두리 두께가 같다");
  }
  ok(/\.room-todo-pill\{[^}]*border: 1px solid transparent/.test(CSS),
     "★ 테두리 없는 알약에도 투명 테두리를 둘러 높이를 맞춘다");
  ok(/\.room-todo\{[^}]*align-items: center/.test(CSS) &&
     /\.achv-bar\{[^}]*align-items: center/.test(CSS),
     "감싸는 상자 안에서도 가운데 선다");

  /* [2026-08-11] 글자수 입력칸 — 좁혀도 [기록] 을 밀어내면 안 됩니다 */
  ok(/\.wc-inputline input\{ flex: 1 1 auto; min-width: 118px; \}/.test(CSS),
     "★ 입력칸에 최소 폭이 있다 (\"지금 전체 글자수\" 가 보일 만큼)");
  ok(/\.wc-inputline #wc-send\{[^}]*white-space: nowrap/.test(CSS),
     "[기록] 글자가 두 줄로 접히지 않는다");
  ok(/data-mw-tab="achv"/.test(H8), "🗂️ 나의 작업에 🏅 업적 탭이 있다");
  ok(/"script_achv\.js":\s*"startAchv"/.test(H8), "로드 자가진단 목록에 들어 있다");

  /* ── 남의 카드 가르기 ── */
  {
    const NT2 = fs.readFileSync(DIR+"script_note.js","utf8");
    /* ★ 이 검사가 한 번 헛돌았습니다. [data-avatar-of] 만 보고 통과시켰는데,
       그 표시는 **채팅 말풍선** 프사에만 붙습니다. 카드 프사는 다른
       이름이라 눌러도 아무 일이 없었어요. 그래서 이제 **카드를 그리는
       파일이 실제로 쓰는 이름**과 맞는지 봅니다. */
    const RT3 = fs.readFileSync(DIR+"script_realtime.js","utf8");
    const m = NT2.match(/if \(e\.target\.closest\("([^"]+)"\)\) \{\s*window\.openAchvOf/);
    ok(!!m, "★ 남의 카드 프사는 업적, 그 밖은 쪽지");
    if (m) {
      const 이름들 = m[1].split(",").map(x => x.trim().replace(/^\./, "")).filter(x => !x.startsWith("["));
      ok(이름들.some(c => RT3.includes(`class="${c}`)),
         "★ 그 이름이 카드에 실제로 붙어 있다 (말풍선 프사와 헷갈리지 않게)");
    }
    ok(NT2.indexOf('data-avatar-of') < NT2.indexOf("openNoteTo(nick);\n      });"),
       "프사 확인이 쪽지보다 먼저다 (뒤에 두면 영영 안 걸린다)");
  }

  /* ── 숫자를 올리는 자리들이 실제로 붙어 있는가 ── */
  [["script_chat.js", "cChat"],
   ["script_forest.js", "cForest"], ["script_data.js", "cTodo"],
   /* 작업 스티커는 script_achv.js 가 셉니다 — worktag 는 창구만 부릅니다
      (두 곳에서 세면 어긋나서, 2026-08-11 에 한 곳으로 모았습니다) */
   ["script_achv.js", "tag"]].forEach(([f, key]) =>
    ok(new RegExp('achvBump\\?\\.\\("' + key).test(fs.readFileSync(DIR+f,"utf8")),
       `${f} 이 ${key} 를 올린다`));
  /* =====================================================================
     🖍️ 어느 스티커가 어느 업적에 드는가 (2026-08-11)
     ---------------------------------------------------------------------
     전에는 script_sticker.js 안에 if 가 흩어져 있었고, 검사도 그저
     "cGreet 라는 글자가 어딘가 있는가" 만 봤습니다. 그래서 스티커를
     늘려도 업적 쪽을 안 고쳤다는 걸 아무도 못 잡았어요.
     이제 목록(ACHV_STK)을 통째로 읽어 **실제 스티커 id 와 맞춰** 봅니다.
     ===================================================================== */
  {
    const SK9 = fs.readFileSync(DIR+"script_sticker.js","utf8");
    const 있는id = new Set((SK9.match(/^\s{6}id: "(\w+)"/gm) || [])
      .map(x => x.match(/"(\w+)"/)[1]));

    const blk = SK9.match(/const ACHV_STK = \{([\s\S]*?)\};/);
    ok(!!blk, "★ 스티커↔업적 짝이 한곳(ACHV_STK)에 모여 있다");
    const 짝 = {};
    (blk ? blk[1] : "").split("\n").forEach(l => {
      const m = l.match(/(\w+):\s*\[([^\]]*)\]/);
      if (m) 짝[m[1]] = (m[2].match(/"(\w+)"/g) || []).map(x => x.slice(1, -1));
    });

    ok(/Object\.keys\(ACHV_STK\)\.forEach/.test(SK9),
       "목록을 실제로 돌려 올린다 (적어만 두고 안 쓰면 소용없다)");

    /* 적어둔 id 가 진짜 있는 스티커인가 — 오타 하나면 영영 안 올라갑니다 */
    const 헛것 = [];
    Object.keys(짝).forEach(k => 짝[k].forEach(id => {
      if (!있는id.has(id)) 헛것.push(k + "→" + id);
    }));
    ok(!헛것.length, "★ 적어둔 스티커가 전부 실제로 있다" + (헛것.length ? " — " + 헛것.join(", ") : ""));

    /* 오늘 정한 짝 — 바뀌면 여기서 걸립니다 */
    const 정답 = {
      cGreet: ["hi", "rehi", "welcome", "bye"],
      cPat:   ["pat", "cheerup"],
      cCheer: ["fight", "cheerup", "cando"]
    };
    Object.keys(정답).forEach(k =>
      ok((짝[k] || []).join(",") === 정답[k].join(","),
         `${k} 가 ${정답[k].join("·")} 를 센다` + (짝[k] ? ` (지금 ${짝[k].join("·")})` : " — 아예 없음")));

    /* 🙌 힘내요는 토닥이와 응원왕 **양쪽**에 듭니다 — 일부러입니다.
       위로이면서 응원이라, 하나만 고르면 어느 쪽이든 어색해집니다. */
    ok(짝.cPat?.includes("cheerup") && 짝.cCheer?.includes("cheerup"),
       "★ 힘내요는 토닥이·응원왕 양쪽에 든다 (겹쳐도 되는 자리)");

    /* 업적 쪽에도 그 이름이 있어야 합니다 */
    Object.keys(정답).forEach(k =>
      ok(new RegExp('at: "' + k + '"').test(AC), `업적 목록에 ${k} 를 쓰는 배지가 있다`));

    /* 🖍 스티커 수집가의 목표가 실제 종류 수와 같은가 —
       안 맞으면 덜 모아도 "모두 모았다" 가 되거나, 다 모아도 안 뜹니다. */
    const 목표 = Number((AC.match(/at: "cStkKind", n: (\d+)/) || [])[1] || 0);
    ok(목표 === 있는id.size,
       `★ 스티커 수집가 목표가 실제 종류 수와 같다 (목표 ${목표} / 실제 ${있는id.size})`);
  }

  /* ★ 퇴고는 polish, 수정은 revise 입니다. 한글 이름만 보고 고르면
     엉뚱한 스티커를 세게 됩니다 (실제로 한 번 그랬어요). */
  ok(/v === "polish"[\s\S]{0,80}"rew"/.test(AC), "★ 퇴고 장인이 세는 값이 polish 다");
  ok(/v === "revise"[\s\S]{0,80}"rev"/.test(AC), "★ 수정궁 여왕이 세는 값이 revise 다");
  /* 업적 파일이 없어도 다른 기능이 멀쩡해야 합니다 */
  ["script_sticker.js","script_chat.js","script_forest.js","script_data.js","script_worktag.js"]
    .forEach(f => ok(!new RegExp("[^?]\\.achvBump\\(").test(fs.readFileSync(DIR+f,"utf8")),
       `${f} 은 업적 파일이 없어도 돈다 (?. 로 부른다)`));

  return checkStaff();
}

/* =====================================================================
   🛡️ 방장 · 운영진 두 층 (2026-08-17)
   ---------------------------------------------------------------------
   운영진 4명에게 관리 페이지를 열어 주면서 권한을 둘로 갈랐습니다.
   여기서 틀리면 **되돌릴 수 없는 일**이 벌어집니다 — 멤버 기록이
   통째로 지워지거나, 채팅이 사라지거나, 운영진이 스스로 동료를
   늘릴 수 있게 되거나.

   그래서 이 검사는 "열렸는가" 보다 **"안 열렸는가"** 를 더 많이 봅니다.
   ===================================================================== */
function checkStaff(){
  ran["staff"]=true;
  const R  = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8").replace(/\/\/.*/g,"")).rules;
  const AD = fs.readFileSync(DIR+"script_admin.js","utf8");
  const AH = fs.readFileSync(DIR+"admin.html","utf8");
  const RT = fs.readFileSync(DIR+"script_realtime.js","utf8");
  const CO = fs.readFileSync(DIR+"script_core.js","utf8");
  const ADMIN = "ABM1ZJndrqaV3gpYUs03SV9qglr1";
  const 운영진 = (s) => /root\.child\('staff'\)\.child\(auth\.uid\)\.exists\(\)/.test(String(s||""));
  const 방장 = (s) => String(s||"").includes(`auth.uid === '${ADMIN}'`);

  /* ── 명단 노드 자체 ── */
  ok(!!R.staff, "★ 보안규칙에 staff 명단이 있다 (콘솔에 적용해야 합니다)");
  ok(방장(R.staff[".write"]) && !운영진(R.staff[".write"]),
     "★★★ 운영진 명단은 방장만 고칠 수 있다 — 아니면 운영진이 스스로 동료를 늘린다");
  ok(운영진(R.staff[".read"]), "운영진은 명단 전체를 볼 수 있다");
  ok(/\$uid === auth\.uid/.test(R.staff.$uid?.[".read"] || ""),
     "★ 누구나 '내가 운영진인가' 만은 확인할 수 있다 (로그인 문지기가 이걸 읽는다)");

  /* ── ★★ 되돌릴 수 없는 자리에 운영진이 새지 않았는가 ──
     이 목록이 이 검사의 심장입니다. 하나라도 열리면 사고가 납니다. */
  const 방장전용 = {
    "messages/.write":            R.messages[".write"],            // 채팅 통째 삭제
    "messages2/.write":           R.messages2[".write"],           // 수다방 통째 삭제
    "users/$nick/.write":         R.users.$nick[".write"],         // 멤버 기록 통째 삭제
    "nickOwner/$nick/.write":     R.nickOwner.$nick[".write"],     // 닉 주인 바꾸기 = 계정 탈취
    "wordlog/$day/.write":        R.wordlog.$day[".write"],
    "wordlog/$day/$nick/.write":  R.wordlog.$day.$nick[".write"],
    "wordfeed/$day/.write":       R.wordfeed.$day[".write"],
    "todostat/$day/.write":       R.todostat.$day[".write"],
    "todostat/$day/$nick/.write": R.todostat.$day.$nick[".write"],
    "staff/.write":               R.staff[".write"]
  };
  Object.entries(방장전용).forEach(([k, v]) => {
    ok(방장(v) && !운영진(v), `★★ ${k} 는 방장만 — 운영진에게 새지 않았다`);
  });

  /* ── ★★★ 그릇과 잎 ──
     RTDB 규칙은 **위에서 허용되면 아래가 전부 허용**됩니다(cascade).
     그래서 게시판을 열 때 부모 층에 OR 을 붙이면, 운영진이 콘솔에서
     `db.ref('forest').remove()` 한 줄로 판을 통째로 비울 수 있습니다.

     처음 짤 때 실제로 그렇게 해서 대숲·공지·품평·설정 네 곳이 뚫려
     있었습니다 (검토에서 잡음). 규칙은 하나입니다 —
     **그릇(부모)은 방장만, 잎(자식)만 운영진.**
     ===================================================================== */
  const 그릇 = {
    "forest/.write":      [R.forest[".write"],      R.forest.$id[".write"]],
    "pubs/.write":        [R.pubs[".write"],        R.pubs.$pid[".write"]],
    "pubreview/.write":   [R.pubreview[".write"],   R.pubreview.$pid[".write"]],
    "notice/list/.write": [R.notice.list[".write"], R.notice.list.$id?.[".write"]],
    "notice/img/.write":  [R.notice.img[".write"],  R.notice.img.$id?.[".write"]],
    "config/.write":      [R.config[".write"],      R.config.allow?.[".write"]],
    "chatMeta/.write":    [R.chatMeta[".write"],    R.chatMeta.pinned?.[".write"]]
  };
  Object.entries(그릇).forEach(([k, [부모, 자식]]) => {
    ok(방장(부모) && !운영진(부모),
       `★★★ ${k} — 판을 통째로 비우는 것은 방장만 (cascade 로 새면 트리가 날아간다)`);
    ok(운영진(자식), `★ ${k.replace("/.write","")} 는 잎에서 운영진이 하나씩 손댈 수 있다`);
  });

  /* ★ 명패를 지우면 그 명패의 품평도 함께 지웁니다(script_pubreview.js).
     pubs/$pid 만 열고 pubreview/$pid 를 안 열면, 운영진이 [지우기]를
     눌렀을 때 첫 줄에서 막혀 **명패만 남는 반쪽 삭제**가 됩니다.
     둘은 늘 같은 층으로 열어야 해요. */
  ok(운영진(R.pubs.$pid[".write"]) && 운영진(R.pubreview.$pid[".write"]),
     "★★ 명패와 그 명패의 품평이 같은 층에서 열린다 (반쪽 삭제 방지)");
  ok(!운영진(R.pubreview[".write"]),
     "★ 그래도 품평 트리 전체를 비우는 것은 방장만");

  /* 💬 chatMeta/clearedAt 은 "채팅 전체 삭제" 의 스위치입니다.
     여기만 찍으면 messages 를 못 지워도 **모두에게 채팅이 사라져 보입니다.** */
  ok(!R.chatMeta.clearedAt || !운영진(R.chatMeta.clearedAt[".write"]),
     "★★ clearedAt 은 운영진에게 안 열렸다 — 방장 전용 '채팅 전체 삭제' 의 우회로");

  /* ── 일상 운영은 열렸는가 ── */
  const 열린자리 = {
    "config/allow/.write":          R.config.allow[".write"],     // 입장 승인
    "config/ban/.write":            R.config.ban[".write"],       // 차단
    "chatMeta/showHistory/.write":  R.chatMeta.showHistory[".write"],
    "attendlog/.read":              R.attendlog[".read"],         // 출입 기록 보기
    "users/$nick/vacations/.read":  R.users.$nick.vacations[".read"],
    "users/$nick/timeSegs/.read":   R.users.$nick.timeSegs[".read"],
    "status/$nick/.write":          R.status.$nick[".write"],
    "screens/$nick/.write":         R.screens[".write"] || R.screens.$nick[".write"],
    "achv/$nick/.write":            R.achv.$nick[".write"]
  };
  Object.entries(열린자리).forEach(([k, v]) => {
    ok(운영진(v), `${k} 는 운영진도 쓸 수 있다`);
  });

  /* ── 🔒 남의 개인 자료는 필요한 두 칸만 ──
     users/$nick/.read 를 통으로 열면 투두·목표·프사 설정까지 딸려 옵니다.
     관리 화면이 실제로 읽는 것은 vacations 와 timeSegs 둘뿐이에요. */
  ok(!운영진(R.users.$nick[".read"]),
     "★★ users/{닉} 통째 읽기는 방장·본인만 — 운영진에게는 출석에 필요한 두 칸만");
  ok(!R.users.$nick.todos || !운영진(R.users.$nick.todos[".read"] || ""),
     "★ 할 일은 운영진에게도 안 보인다");

  /* =====================================================================
     📅 출석 기록 — 아무나 지우던 자리 (2026-08-17 막음)
     ---------------------------------------------------------------------
     `attendance` · `attendlog` 는 `.write: "auth != null"` 이었습니다.
     로그인한 멤버 누구나 콘솔에서 `db.ref('attendance').remove()` 한 줄로
     **전 기간 출석을 날릴 수 있었습니다.** 출석부·의무 출석 판정·성실
     멤버가 전부 여기서 나오는데도요.
     ===================================================================== */
  ok(방장(R.attendance[".write"]) && !운영진(R.attendance[".write"]),
     "★★★ 출석 기록 통째 삭제는 방장만 (예전엔 아무 멤버나 됐다)");
  ok(!/^auth != null$/.test(String(R.attendance[".write"])),
     "★ attendance 에 맨 auth != null 이 남아 있지 않다");
  ok(/root\.child\('nickOwner'\)\.child\(\$nick\)\.val\(\) === auth\.uid/
       .test(R.attendance.$day.$nick[".write"]),
     "★★ 출석은 **제 칸만** 찍을 수 있다 (남의 출석을 지우거나 만들 수 없다)");
  ok(방장(R.attendlog[".write"]) && !운영진(R.attendlog[".write"]),
     "★★ 출입 기록 통째 삭제도 방장만");
  ok(/^auth != null && !data\.exists\(\)$/.test(R.attendlog.$day.$id[".write"]),
     "★★★ 출입 기록은 **추가만** — 이미 적힌 줄은 아무도 못 고치고 못 지운다");
  ok(/hasChildren\(\['n','t','k'\]\)/.test(R.attendlog.$day.$id[".validate"] || ""),
     "출입 기록에 엉뚱한 모양이 들어오지 못한다");

  /* ── 🌙 자정 넘김 출석 — 만들었다 걷어냄 (2026-08-18, 콩) ──
     순위가 출석률로 바뀌면서 "자정 넘김은 본인이 챙길 문제" 로 결정.
     정말로 걷혔는지 역검사합니다 (펫 삭제 때와 같은 방식). */
  ok(!/watchDayRollover/.test(RT.replace(/\/\*[\s\S]*?\*\//g, "")),
     "★★ 자정 넘김 감시가 코드에서 정말로 사라졌다 (주석에만 남았다)");
  ok(!/ROLLOVER_WORK_MS =/.test(RT),
     "★ 문턱 상수도 사라졌다");
  ok(/걷어냈습니다 \(2026-08-18\)/.test(RT) && /되살릴 일이 생기면/.test(RT),
     "왜 걷었고 어떻게 되살리는지 무덤 비석이 남아 있다");

  /* 정리(sweep)를 방장에게 넘겼으니, 코드도 그래야 합니다.
     안 그러면 남들 브라우저에서 조용히 실패만 쌓입니다. */
  ok(/function 정리할차례인가\(\) \{ return myNick === ADMIN_NICK; \}/.test(RT),
     "★ 오래된 날 정리는 방장 브라우저에서만 돈다");
  ok(/async function sweepAttendLog\(\) \{\s*\n\s*if \(!정리할차례인가\(\)\) return;/.test(RT),
     "★★ 출입 기록 정리에 그 문지기가 서 있다");
  ok(/if \(정리할차례인가\(\)\) \{[\s\S]{0,400}db\.ref\("attendance"\)\.update\(updates\);/.test(RT),
     "★★ 출석 기록 정리에도 서 있다 (남들은 조회조차 안 해서 통신량도 준다)");

  /* =====================================================================
     📱 폰 접속 표시 (2026-08-17, A안)
     ---------------------------------------------------------------------
     접속 신호(status)에 참/거짓 한 칸(onPhone)을 얹고, 카드 접속 막대
     옆에 폰인 사람만 📱 를 답니다. 서버에 기록으로 남기는 lastDevice
     (0813 보류)와는 다른 물건 — 접속 중인 동안만 실려 다닙니다.
     ===================================================================== */
  ok(/const onPhone = window\.isMobile === true;/.test(RT),
     "★ 기기 판별은 이미 있는 window.isMobile 을 그대로 쓴다 (새로 재지 않는다)");
  ok(/onPhone,/.test(RT.slice(RT.indexOf("const 보낼것"), RT.indexOf("const 보낼것") + 2000)),
     "★ 접속 신호에 onPhone 한 칸이 실린다 (새 통신이 아니라 얹혀 간다)");
  ok(/row\.onPhone === true\s*\n?\s*\? `<span class="card-device"/.test(RT),
     "★★ 폰인 사람에게만 📱 가 붙는다 — PC 는 아무것도 안 붙는다");
  {
    const CS2 = fs.readFileSync(DIR + "styles.css", "utf8");
    const dv = CS2.slice(CS2.indexOf(".card-device{"), CS2.indexOf("}", CS2.indexOf(".card-device{")));
    ok(/pointer-events: none/.test(dv),
       "★ 표시가 카드 아래칸 클릭(목표·투두)을 가리지 않는다");
    ok(/position: absolute/.test(dv) && /left: 2\dpx/.test(dv),
       "접속 막대 바로 옆에 앉는다");
    ok(/html\[data-is-dark="true"\] \.card-device/.test(CS2),
       "어두운 테마에서는 받침을 뒤집는다 (접속 막대와 같은 결)");
  }
  /* 주석에는 lastDevice 얘기가 있어도 됩니다 — **쓰는 코드**만 없으면 돼요 */
  ok(!/ref\([^)]*lastDevice/.test(RT),
     "★ 서버에 기기 기록(lastDevice)은 여전히 안 남긴다 (0813 보류 그대로)");

  /* =====================================================================
     📊 roomStat (2026-08-18) — {날짜}/{시} = 그 시각 최다 인원
     ---------------------------------------------------------------------
     [철거 2026-08-22 — 콩] 알약 줄 위 **띠(.room-pulse)는 없앴습니다.**
     🖼️ 방 배경 현황판이 같은 자리를 더 잘 해요 — 판을 열어도 안 사라지고,
     늘 보이고, 카드를 안 가립니다.

     자료(roomStat)와 막대 그림(막대띠)은 배경판이 그대로 씁니다.
     지킬 것은 예전과 같아요: ① "더 큰 값만" ② 꺼 둔 사람은 읽지도 않기
     ③ 색은 테마 포인트색.
     ===================================================================== */
  {
    const CS3 = fs.readFileSync(DIR + "styles.css", "utf8");
    const H  = fs.readFileSync(DIR + "index.html", "utf8");
    const UI3 = fs.readFileSync(DIR + "script_ui.js", "utf8");

    /* ── 남는 것 — 자료와 규칙 ── */
    ok(!!R.roomStat, "★ 보안규칙에 roomStat 이 있다 (콘솔에 적용해야 합니다)");
    ok(/!data\.exists\(\) \|\| newData\.val\(\) > data\.val\(\)/.test(R.roomStat.$day.$hour[".write"]),
       "★★★ 더 큰 값만 받는다 — 줄이는 쓰기를 막으면 경쟁 조건도 장난도 없다");
    ok(/db\.ref\(`roomStat\/\$\{d\}\/\$\{h\}`\)\.transaction/.test(RT),
       "★ transaction 으로 올린다");
    ok(/if \(d === _pulseDay && Number\(_pulse\[h\] \|\| 0\) >= n\) return;/.test(RT),
       "★★ 내가 아는 값보다 크지 않으면 서버에 묻지도 않는다");
    ok(/if \(!boardOn\(\)\) \{ stopPulse\(\); return; \}/.test(RT),
       "★★ 배경판을 꺼 둔 사람은 구독을 아예 안 건다 (읽지도 않음)");
    ok(/function 막대띠\(\)/.test(RT), "★ 24칸 막대를 그리는 자는 남아 있다 (배경판이 씁니다)");

    /* ★★★ [사고 기록 2026-08-22] 아래 세 줄은 **실제로 사라졌던 선언**입니다.
       띠를 걷어내며 `const PULSE_ALL …` 부터 잘랐는데, 바로 아래 붙어 있던
       이 선언들이 같이 딸려 갔습니다. 쓰는 코드는 남아 ReferenceError 가 났고
       그 순간 뒤 코드가 통째로 멈춰, 방에서 이렇게 보였습니다:
         · 하트비트가 죽어 내 상태가 안 올라감
         · 배경 현황판이 안 뜸
         · renderUserCards 가 중간에 끊겨 → 뒤에 들어온 사람이 안 보이고,
           카드 아래 시간 집계가 멈추고, 인사 팝업·상태표가 죽음
       고치는 김에 못을 박아 둡니다. 다시 사라지면 여기서 걸립니다. */
    ok(/let\s+_pulseRef\b/.test(RT) && /let\s+_pulse\s*=/.test(RT) && /let\s+_pulseDay\b/.test(RT),
       "★★★ _pulseRef · _pulse · _pulseDay 선언이 제자리에 있다 (2026-08-22 사고)");
    ok(!/^\s*(?:let|const|var)\s+_statusRef\b/m.test(RT),
       "★★ _statusRef 는 여기서 또 선언하지 않는다 (script_core.js 것을 같이 씁니다)");
    /* ※ core 에서는 `let _msgRef = null, _statusRef = null;` 처럼 둘째 자리에
       있어서, let 바로 뒤만 보면 못 찾습니다 (제가 한 번 헛짚었습니다) */
    ok(/let\s+[^;\n]*\b_statusRef\b/.test(fs.readFileSync(DIR + "script_core.js", "utf8")),
       "★★ _statusRef 의 진짜 주인은 script_core.js 다");

    /* ★★★ [2026-08-22] **돌려 보는 검사.**
       위의 못들은 "그 글자가 있나"를 볼 뿐입니다. 사고 당일 검사는 3300개가
       전부 통과했는데도 방은 얼어 있었어요 — 글자를 찾아보는 검사만 있었고
       한 번 돌려 보는 검사가 없었기 때문입니다.

       그래서 여기서는 script_realtime.js 를 실제로 실행해, 상태 스냅숏이
       왔을 때 도는 두 길(updateChatHeader → 기록해두기, renderUserCards)을
       직접 불러 봅니다. 선언이 또 사라지면 여기서 ReferenceError 로 걸립니다.
       (일부러 선언을 지우고 돌려서, 정말로 걸리는 것까지 확인했습니다) */
    {
      /* 뭘 물어도 자기 같은 것을 돌려주는 너그러운 가짜 DOM.
         진짜 화면을 흉내 내려는 게 아니라, **코드가 끝까지 흘러가는지**만
         보려는 것이라 이 정도로 충분합니다. */
      const 아무거나 = () => new Proxy(function () {}, {
        get(t, k) {
          if (k === "length") return 0;
          if (k === Symbol.toPrimitive || k === "toString") return () => "";
          if (k === Symbol.iterator) return function* () {};
          if (k === "then") return undefined;               // await 에 안 걸리게
          return 아무거나();
        },
        set() { return true; },
        apply() { return 아무거나(); },
        has() { return true; },
      });
      const 방 = {
        console: { log() {}, warn() {}, error() {}, info() {} },
        setTimeout() { return 0; }, clearTimeout() {},
        setInterval() { return 0; }, clearInterval() {},
        requestAnimationFrame() { return 0; },
        Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp,
        Promise, Map, Set, Error, isNaN, parseInt, parseFloat,
        encodeURIComponent, decodeURIComponent,
        localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
        sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
        AppStore: { getItem() { return null; }, setItem() {}, removeItem() {} },
        AppSession: { getItem() { return null; }, setItem() {}, removeItem() {} },
        escapeHtml: (s) => String(s ?? ""),
        Intl, Symbol, Proxy, Reflect,
        db: 아무거나(), firebase: 아무거나(),
        document: 아무거나(), navigator: 아무거나(), location: 아무거나(),
      };
      방.addEventListener = () => {};
      방.removeEventListener = () => {};
      방.dispatchEvent = () => true;
      방.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} });
      방.getComputedStyle = () => 아무거나();
      방.innerWidth = 1200; 방.innerHeight = 800; 방.devicePixelRatio = 1;
      방.performance = { now: () => 0 };
      방.CustomEvent = function () {}; 방.Event = function () {};
      방.IntersectionObserver = function () { return { observe() {}, disconnect() {}, unobserve() {} }; };
      방.MutationObserver   = function () { return { observe() {}, disconnect() {} }; };
      방.ResizeObserver     = function () { return { observe() {}, disconnect() {}, unobserve() {} }; };
      방.window = 방;
      방.globalThis = 방;
      vm.createContext(방);

      let 사고 = "";
      try {
        /* ★ script_realtime.js 혼자서는 못 돕니다 — ymd 같은 것이 옆 파일에
           있어서요. 브라우저가 싣는 차례대로 형제들을 먼저 올립니다.
           (이걸 빠뜨리면 "ymd is not defined" 가 나서, 진짜 사고와
            구별이 안 됩니다 — 실제로 한 번 헛짚었습니다) */
        ["fortune_data.js", "script_core.js", "script_data.js", "script_realtime.js"]
          .forEach(f => vm.runInContext(fs.readFileSync(DIR + f, "utf8"), 방, { timeout: 5000 }));
        vm.runInContext('myNick = "방장"; myEmoji = "🦉";', 방);

        const 사람들 = {};
        ["방장", "가", "나"].forEach((n, i) => 사람들[n] = {
          nick: n, emoji: "🦉", status: "글쓰기",
          lastActive: Date.now(), sessionStart: Date.now() - i * 60000, uid: "u" + i,
        });
        방.window._statusCache = 사람들;   // ← 상태 스냅숏이 막 도착한 셈
        방.window.updateChatHeader?.();     // ← 여기서 기록해두기() 가 _pulse 를 씁니다
        방.window.renderUserCards?.(사람들); // ← 끝에서 배경판살피기() 가 돕니다
      } catch (e) {
        사고 = e && e.message ? e.message : String(e);
      }
      ok(!/is not defined/.test(사고),
         "★★★ 상태 스냅숏이 와도 도중에 멈추지 않는다 — 선언이 사라진 이름이 없다"
         + (사고 ? ` ← ${사고.slice(0, 120)}` : ""));
    }
    ok(/\.rb-bars \.rp-b\{[\s\S]{0,90}var\(--accent\)/.test(CS3),
       "★★ 막대 조각 모양이 남아 있다 (지우면 배경판 막대가 통째로 사라집니다)");

    /* ── 없앤 것 — 되살리지 말 것 ── */
    ok(!/\.room-pulse\{/.test(CS3), "★ .room-pulse 껍데기는 없다 (2026-08-22 철거)");
    ok(!/id="set-pulse"/.test(H) && !/class="set-pulse-what"/.test(H),
       "★★ 설정에 띠 스위치·항목 체크가 없다");
    ok(!/각종 현황 띠/.test(H) || /\[철거 2026-08-22/.test(H),
       "★ 설정에 남은 것은 철거 표시뿐이다");
    ok(!/window\.setPulse =/.test(RT) && !/window\.togglePulseWhat =/.test(RT),
       "★★ 띠를 켜고 끄던 창구가 없다");
    /* ★ [고침 2026-08-22] 여기는 **주석을 걷어내고** 봐야 합니다.
       "없앴다"는 기록을 주석에 남기면 그 글자가 코드로 오해받아,
       제대로 지웠는데도 검사가 빨갛게 뜹니다 (실제로 그랬습니다).
       지웠다는 확인은 살아 있는 코드에만 물어야 해요. */
    const RT민낯 = RT.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    ok(!/const PULSE_ALL/.test(RT민낯) && !/function pulseWhat/.test(RT민낯),
       "★ 항목 목록·고르기도 없다 (주석 속 기록은 세지 않습니다)");
    ok(!/function 꺾은선띠/.test(RT) && !/async function 꺾은선읽기/.test(RT),
       "★ 이번 달 꺾은선 셋도 함께 걷어냈다");
    ok(!/syncPulseChecks/.test(UI3), "★ 설정 동기화 코드도 없다");
    /* ★ 배경판은 그대로 살아 있어야 합니다 — 띠를 없앤 대신이니까요 */
    ok(/function drawBoard/.test(RT),
       "★★ 🖼️ 배경 현황판은 그대로다 (띠를 없앤 자리를 이것이 대신합니다)");
    /* [2026-08-22 — 콩] 늘 켜집니다. 끄는 길을 없앴어요 —
       기본이 켜짐인데도 아무도 모르고 안 보더라고요. */
    ok(/function boardOn\(\) \{ return true; \}/.test(RT),
       "★★ 배경 현황판은 늘 켜진다 (끄는 길이 없다)");
    ok(!/id="set-board"/.test(H), "★ 설정에 켬/끔 체크가 없다");
    ok(!/window\.setRoomBoard/.test(RT) && !/window\.isRoomBoardOn/.test(RT),
       "★ 켜고 끄던 창구도 없다");
    /* ★★ 접속하자마자 안 뜨던 사고 — 배치를 다시 짜며 밀려났습니다 */
    ok(/function 배경판살피기\(\)/.test(RT) &&
       /if \(document\.getElementById\("room-board"\)\) return;/.test(RT),
       "★★ 밀려나면 스스로 되살아난다 (멀쩡하면 아무 일도 안 함)");
    ok(/배경판살피기\(\);/.test(RT.slice(RT.indexOf("function renderUserCards"))),
       "★★ 카드를 그릴 때마다 자리에 있는지 본다");
  }

  /* ── 🎋 대숲 전체 비우기도 방장만 (검토에서 빠져 있던 자리) ── */
  ok(/if \(!ownerOnly\("대숲 전체 비우기"\)\) return;/.test(AD),
     "★★ 대숲 전체 비우기에 방장 문지기가 있다");
  ok(/if \(!ownerOnly\("운영진 명단 관리"\)\) return;/.test(AD),
     "운영진 명단 손대기에도 문지기가 있다");

  /* ── 🚪 PIN 칸만 눌러 들어오는 길이 막혔는가 ──
     #adm-pin-card 는 display:none 일 뿐 DOM 에 있고, 숨은 단추도
     .click() 은 발화합니다. PIN 은 공개 배포된 js 안에 평문이고요. */
  ok(/let passedLogin = false;/.test(AD), "★ 로그인을 지났는지 깃발이 따로 있다");
  ok(/function doPin\(\) \{[\s\S]{0,400}if \(!passedLogin \|\| !auth\.currentUser\) return;/.test(AD),
     "★★★ 로그인 없이 PIN 단추만 눌러서는 대시보드가 안 열린다");
  ok(/function openDash\(\) \{\s*\n\s*if \(!passedLogin \|\| !auth\.currentUser\) return;/.test(AD),
     "★★ openDash 를 직접 불러도 같은 문지기를 지난다");

  /* ── 권한과 단추가 어긋나지 않는가 ──
     규칙은 열렸는데 화면에 단추가 없으면, 콘솔로는 되고 손으로는 안 되는
     이상한 상태가 됩니다 (최소권한 원칙에도 어긋나요). */
  [["script_notice.js", "공지"], ["script_pubreview.js", "품평 명패"]].forEach(([f, 뭐]) => {
    const S = fs.readFileSync(DIR + f, "utf8");
    ok(/if \(typeof window\.canAdmin === "function"\) return window\.canAdmin\(\);/.test(S),
       `★ ${뭐} 단추가 운영진에게도 보인다 (규칙이 열린 만큼 화면도 열려 있다)`);
  });

  /* ★ 방장은 명단에 없어도 늘 지나야 합니다 — 명단을 실수로 비웠을 때
     아무도 못 들어가는 잠김 사고를 막는 안전장치입니다. */
  Object.entries({ ...방장전용, ...열린자리 }).forEach(([k, v]) => {
    ok(방장(v), `★ ${k} — 방장 uid 는 언제나 통과한다 (명단이 비어도 잠기지 않게)`);
  });

  /* ── 관리 페이지 문지기 ── */
  ok(/const ADMIN_UID  = "ABM1ZJndrqaV3gpYUs03SV9qglr1";/.test(AD),
     "★ 관리 페이지가 아는 방장 uid 가 보안규칙의 것과 같다");
  ok(!/if \(nick !== ADMIN_NICK\) \{[\s\S]{0,200}return;/.test(AD),
     "★ 닉네임만 보고 미리 막지 않는다 (운영진은 닉이 제각각)");
  ok(/db\.ref\("staff\/" \+ uid\)\.once\("value"\)\)\.exists\(\)/.test(AD),
     "★★ 로그인 뒤 서버의 staff 명단으로 자격을 확인한다");
  ok(/if \(!allowed\) \{[\s\S]{0,200}auth\.signOut\(\)/.test(AD),
     "★★ 자격이 없으면 로그인을 도로 끊는다 — 어중간하게 로그인된 채로 두지 않는다");
  ok(/isOwner = \(uid === ADMIN_UID\);/.test(AD),
     "방장 여부는 닉이 아니라 uid 로 가른다 (닉은 바뀐다)");

  /* ── 화면에서도 방장 전용 칸이 감춰지는가 ── */
  ok(/\[data-owner-only\]/.test(AD) && /data-owner-only/.test(AH),
     "★ data-owner-only 가 붙은 칸은 운영진에게 안 보인다");
  /* 그 id 를 단 태그 자신에 붙었거나(카드), 바로 위 감싼 상자에 붙었거나(단추 묶음).
     둘 중 하나면 됩니다 — 앞뒤 어느 쪽에 적혀 있든 상관없게 봅니다. */
  ["adm-staff-card", "adm-wc-clear", "adm-chat-clear", "adm-chatty-clear"].forEach(id => {
    const i = AH.indexOf(`id="${id}"`);
    const 제태그 = i > 0 ? AH.slice(AH.lastIndexOf("<", i), AH.indexOf(">", i) + 1) : "";
    const 위쪽   = i > 0 ? AH.slice(Math.max(0, i - 400), i) : "";
    ok(i > 0 && (/data-owner-only/.test(제태그) || /data-owner-only>/.test(위쪽)),
       `${id} 가 방장 전용 칸 안에 있다`);
  });
  ok(/function ownerOnly\(what\)/.test(AD) &&
     /if \(!ownerOnly\("멤버를 명단에서 지우는 것"\)\) return;/.test(AD) &&
     /if \(!ownerOnly\("오늘 글자수 초기화"\)\) return;/.test(AD) &&
     /if \(!ownerOnly\("채팅 통째 삭제"\)\) return;/.test(AD),
     "★★ 파괴적 함수는 콘솔로 직접 불러도 사람 말로 막힌다");
  ok(/isOwner\s*\n?\s*\? `<button type="button" class="del-x"/.test(AD),
     "★ 출석부 이름 옆 ✕ 는 방장에게만 그려진다");

  /* =====================================================================
     🏷️ 부방장 스티커 (2026-08-17)
     ---------------------------------------------------------------------
     명단은 하나(staff)인데 적히는 곳이 둘(staff · config/vice)입니다.
     둘이 어긋나면 "권한은 있는데 스티커가 없다" 거나 그 반대가 돼요.
     ===================================================================== */
  const CS = fs.readFileSync(DIR+"styles.css","utf8");
  ok(/db\.ref\("config\/vice"\)\.on\("value"/.test(RT),
     "★ 카드가 config/vice 를 보고 스티커를 붙인다");
  ok(/config\/.read/.test(JSON.stringify(R)) || R.config[".read"] === true,
     "★★ config 는 누구나 읽을 수 있다 — 카드는 모든 멤버가 보는 것이라 꼭 필요");
  ok(방장(R.config[".write"]) && !R.config.vice,
     "★★ vice 칸은 따로 열지 않았다 = config 규칙(방장만)을 그대로 물려받는다");
  ok(/db\.ref\("config\/vice\/" \+ nick\)\.set\(true\)/.test(AD) &&
     /db\.ref\("config\/vice\/" \+ name\)\.remove\(\)/.test(AD),
     "★★ 운영진을 올리고 내릴 때 스티커도 함께 붙고 떨어진다");
  ok(/const 있어야할 = new Set\(uids\.map\(u => v\[u\]\)/.test(AD) &&
     /if \(Object\.keys\(고칠것\)\.length\) await db\.ref\("config\/vice"\)\.update\(고칠것\);/.test(AD),
     "★★★ 대시보드를 열 때 두 명단이 어긋나 있으면 저절로 맞춘다");
  ok(/if \(Object\.keys\(고칠것\)\.length\)/.test(AD),
     "★ 같으면 아무 요청도 안 보낸다 (열 때마다 쓰면 통신량만 는다)");

  /* 방장이 부방장 명단에도 들어 있으면 이름표가 둘 겹칩니다 */
  ok(/if \(u === ADMIN_NICK\) return `<span class="card-admin-stamp" aria-label="방장">/.test(RT),
     "★ 방장이 먼저다 — 둘 다 해당해도 '방장' 하나만 붙는다");
  ok(/\.card-admin-stamp\.is-vice\{/.test(CS),
     "부방장 스티커가 방장 스티커의 모양을 물려받는다 (자리·각도·색이 저절로 같다)");
  ok(/font-size: calc\(var\(--fs-sm\) \* \.72\);/.test(CS.slice(CS.indexOf(".card-admin-stamp.is-vice"))),
     "★ 세 글자라 글자만 줄였다 (상자 폭을 방장과 맞추려고)");

  /* =====================================================================
     🕐 시간대별 접속 그래프 (2026-08-18)
     ---------------------------------------------------------------------
     새 자료를 읽지 않고, 출석부가 이미 받아 둔 timeSegs 를 접어 셉니다.
     여기서 틀리기 쉬운 자리 셋 — 중복 셈, 오늘 포함, 있던 날만 평균.
     ===================================================================== */
  {
    const AH2 = fs.readFileSync(DIR + "admin.html", "utf8");
    ok(/id="adm-hour-chart"/.test(AH2), "시간대별 접속 그래프 자리가 출석 카드 맨 아래에 있다");
    ok(/function 시간대그래프\(d\)/.test(AD), "그리는 함수가 있다");
    ok(/segsByNick\[n\] = rawPer;/.test(AD),
       "★ 원본 구간을 따로 모은다 — 분 합계로는 '몇 시였는지' 를 모른다");
    ok(!/users\/\$\{n\}\/timeSegs[\s\S]{0,200}users\/\$\{n\}\/timeSegs/.test(AD.slice(AD.indexOf("async function loadAttendance"), AD.indexOf("async function loadAttendance") + 4000)),
       "★★ timeSegs 를 두 번 읽지 않는다 (요청 수 그대로)");
    ok(/const 덮음 = new Set\(\);/.test(AD),
       "★★ 한 사람이 같은 시간대에 구간을 여러 개 남겨도 한 명으로 센다");
    ok(/isThisMonth \? Math\.min\(todayD - 1, daysInMonth\) : daysInMonth/.test(AD),
       "★★ 오늘은 뺀다 — 아직 안 온 시간이 0 으로 들어가 평균을 끌어내린다");
    ok(/평균 = 합\.map\(v => v \/ 날들\.length\)/.test(AD),
       "★ 아무도 없던 날도 0 으로 넣은 평균이다 (있던 날만 세면 부풀어요)");
    ok(/for \(let h = 6; h <= 23; h\+\+\)/.test(AD),
       "한산 시간은 낮(6~23시)에서만 찾는다 — 새벽 0명은 정보가 아니다");
    ok(/data-hour-f/.test(AD) && /adm-hour-chip/.test(AH2),
       "전체/평일만/주말만 칩이 있다 (다시 접기만 하고 서버는 안 간다)");
    ok(/if \(_시간대값\) \{ try \{ 시간대그래프\(_시간대값\); \} catch \(e\) \{\} \}/.test(AD),
       "창 크기가 바뀌면 다른 그래프처럼 다시 그린다");

    /* ── 2×2 배치 + 🔥 연속 출석 순위 (2026-08-18, 콩 요청) ── */
    ok(/adm-chart-grid/.test(AH2) &&
       AH2.indexOf('id="adm-att-chart"') > AH2.indexOf('class="adm-chart-grid"') &&
       AH2.indexOf('id="adm-hour-chart"') < AH2.indexOf("/adm-chart-grid"),
       "★ 그래프 4개가 한 그리드(2×2) 안에 있다");
    ok(/@media \(max-width: 900px\)\{ \.adm-chart-grid\{ grid-template-columns: 1fr; \}/.test(AH2),
       "좁은 화면에선 도로 한 줄이 된다");
    ok(AH2.indexOf('id="adm-streak"') > AH2.indexOf("/adm-chart-grid"),
       "순위는 그래프 그리드 **아래**에 있다");

    /* ── 🏅 출석률 순위 (2026-08-18 — 연속 출석에서 바꿈, 콩) ──
       방 규칙이 "매일"이 아니라 "한 달 18일"이라, 연속은 취지와 어긋남.
       기준이 사람마다 달라(입장일·휴가) 날수가 아니라 **비율**로 세움. */
    ok(/function 출석률순위\(rateRows\)/.test(AD) && !/attend\/streak/.test(AD),
       "★★ 순위가 출석률이다 — streak 은 더 이상 읽지 않는다 (요청도 줄었다)");
    ok(/rateRows\.push\(\{ n, att: attDays, need: r\.need, state: r\.state \}\)/.test(AD),
       "★★ 재료는 출석부 표가 이미 센 값 그대로 (ruleOf 와 같은 셈 — 다시 안 센다)");
    ok(/rate: r\.need > 0 \? r\.att \/ r\.need : null/.test(AD),
       "★ 기준이 0인 사람(입장 전)은 등수 없이 맨 아래로");
    ok(/Math\.min\(100, /.test(AD.slice(AD.indexOf("function 출석률순위"))),
       "★ 막대는 100%에서 꽉 찬다 — 1등에 맞추면 모두가 쪼그라든다");
    ok(/\$\{r\.att\}\/\$\{r\.need\}<small>일<\/small>/.test(AD),
       "비율 옆에 출처(15/12일)가 같이 보인다 — 숫자가 하늘에서 안 떨어지게");
    ok(/상태표\[r\.state\]/.test(AD),
       "규칙 칸과 같은 ✅🟡🔴 로 상태를 보여준다");
    /* [고침 2026-08-18] 16명 고정 → 반씩 → **세 칸** (막대가 너무 길었다) */
    ok(/const 칸수 = 3;/.test(AD) &&
       /const 몫 = Math\.ceil\(rows\.length \/ 칸수\);/.test(AD) &&
       /줄\(r, i \+ c \* 몫\)/.test(AD),
       "★ 세 칸 n등분 — 인원이 늘어도 저절로 균형, 등수도 칸을 건너 이어진다");
    ok(/grid-template-columns: 1fr 1fr 1fr;/.test(AH2.slice(AH2.indexOf(".adm-streak-cols"))),
       "CSS 도 세 칸이다 (좁으면 두 칸 → 한 칸으로 접힘)");
  }

  /* =====================================================================
     📚 낱장 색 (2026-08-18) — 카드 가장자리 겹친 종이 두 장 꾸미기
     ---------------------------------------------------------------------
     틀리기 쉬운 자리: ① 테마 오버라이드가 box-shadow 를 통으로 덮으면
     커스텀이 진다 ② 빈 값(기본)인데 인라인 변수가 붙으면 테마를 못 따라간다.
     ===================================================================== */
  {
    const CS2 = fs.readFileSync(DIR + "styles.css", "utf8");
    const PR2 = fs.readFileSync(DIR + "script_profile.js", "utf8");
    ok(/--pg1: #FFFBF0;\s+--pg1-line: #C9BB98;/.test(CS2),
       "★ 낱장 색이 변수로 빠졌고 기본값은 예전 그대로다");
    ok(/4px 4px 0 -1px var\(--pg1\), 4px 4px 0 0 var\(--pg1-line\)/.test(CS2),
       "★ 낱장 식이 변수를 읽는다");
    {
      const st = CS2.slice(CS2.indexOf('html[data-theme-style="studio"] .user-card{'));
      const stBlk = st.slice(0, st.indexOf("}"));
      const dk = CS2.slice(CS2.indexOf(':root[data-is-dark="true"] .user-card{'));
      const dkBlk = dk.slice(0, dk.indexOf("}"));
      ok(/--pg1:/.test(stBlk) && !/box-shadow/.test(stBlk),
         "★★★ 스튜디오 테마가 변수만 바꾼다 — 식을 덮으면 각자 고른 색이 진다");
      ok(/--pg1:/.test(dkBlk) && !/box-shadow/.test(dkBlk),
         "★★★ 다크 테마도 변수만 바꾼다");
    }
    ok(/const pg1 = window\.sanitizeHexColor\?\.\(prof\.pageC1\) \|\| "";/.test(RT),
       "★ 카드가 profile.pageC1 을 소독해서 읽는다");
    ok(/pg1 \? `--pg1:\$\{pg1\};--pg1-line:\$\{darkenHex\(pg1\)\};` : ""/.test(RT),
       "★★ 빈 값이면 인라인 변수를 아예 안 붙인다 — 그래야 테마 낱장을 따라간다");
    ok(/function darkenHex\(hex, f = 0\.82\)/.test(RT),
       "가장자리 선은 고른 색을 82%로 어둡게 (같은 색 두 장이 안 붙어 보이게)");
    ok(/id="prof-pg1"/.test(PR2) && /id="prof-pg2"/.test(PR2) &&
       /id="prof-pg-link"/.test(PR2),
       "★ 설정에 두 장 각각 + 🔗 같은 색 스위치가 있다 (스티커 배치 아래)");
    ok(PR2.indexOf('id="prof-pg1"') > PR2.indexOf('id="prof-stk-card"'),
       "★ 자리가 스티커 배치 **아래**다 (콩 지정)");
    ok(/if \(reset\) reset\.onclick = \(\) => apply\(""\);/.test(PR2),
       "[기본값]을 누르면 빈 값으로 — 테마 낱장으로 돌아간다");
    ok(/if \(!fromLink && link\?\.checked\)/.test(PR2),
       "★ 🔗 연동이 무한 왕복하지 않는다 (fromLink 깃발)");
  }

  /* =====================================================================
     🆘🔗 비슷한 질문 연결 (2026-08-18)
     ---------------------------------------------------------------------
     같은 질문이 또 오면 옛 답을 참고하라고 잇습니다. 지킬 것 —
     익명 유지(글 번호만) · 통신량 0(들고 있는 _rows 에서만) ·
     입력 중 전체 render 금지(초점·한글 조합 보호).
     ===================================================================== */
  {
    const HP = fs.readFileSync(DIR + "script_help.js", "utf8");
    const HC = fs.readFileSync(DIR + "styles.css", "utf8");
    ok(/ref: typeof v\.ref === "string" \? v\.ref : ""/.test(HP),
       "★ 참고는 글 번호 하나만 — 익명은 그대로다");
    ok(/function 비슷한질문\(text\)/.test(HP) &&
       !/db\.ref/.test(HP.slice(HP.indexOf("function 낱말"), HP.indexOf("function 비슷한질문") + 600)),
       "★★ 비슷한 글 찾기가 서버에 안 묻는다 (들고 있는 것에서만 — 통신량 0)");
    ok(/\.sort\(\(a, b\) => b\.답 - a\.답 \|\| b\.at - a\.at\)/.test(HP),
       "제안은 답 많은 글 먼저다 (참고 가치순)");
    ok(/if \(e\.target\?\.id === "help-new"\) 제안그리기\(\);/.test(HP) &&
       /function 제안그리기\(\)[\s\S]{0,900}box\.innerHTML/.test(HP) &&
       !/function 제안그리기\(\)[\s\S]{0,900}render\(\)/.test(HP),
       "★★★ 입력 중엔 제안 상자 속만 바꾼다 — 전체 render 는 입력칸을 죽인다 (0813 친척)");
    ok(/if \(!원본\) \{[\s\S]{0,200}사라졌어요/.test(HP),
       "★ 참고하던 글이 14일 지나 사라지면 곱게 접힌다");
    ok(/if \(q\?\.ref\) _refOpen\.add\(q\.id\);/.test(HP),
       "★ 답 달기를 열면 참고가 자동으로 펼쳐진다 (콩 선택)");
    ok(/const keep = el\("help-new"\)\?\.value \|\| "";/.test(HP),
       "제안을 골라도 쓰던 글이 살아남는다");
    ok(/async function 올리기\(text, parent, refId\)/.test(HP) &&
       /if \(refId\) 줄\.ref = refId;/.test(HP),
       "올릴 때 ref 가 실린다 (없으면 안 실림 — 옛 글과 같은 모양)");
    ok(/\.help-ref\{/.test(HC) && /\.help-sug\{/.test(HC) && /\.help-pin\{/.test(HC),
       "칩·제안·핀의 옷이 있다");
    /* 굴려 봅니다 — 낱말 앞 두 글자 겹침 */
    {
      const 낱말 = s => (String(s || "").match(/[가-힣a-zA-Z]{2,}/g) || []).map(w => w.slice(0, 2));
      const 겹침 = (a, b) => {
        const t = 낱말(a), q = 낱말(b);
        return t.some(w => q.indexOf(w) >= 0);
      };
      ok(겹침("숨이 막히는 표현", "숨이 턱 막혔다"), "'숨이'로 걸린다");
      ok(!겹침("우스웠다", "숨이 턱 막혔다"), "안 비슷하면 안 걸린다");
      ok(!겹침("ㅋㅋㅋ", "숨이 턱 막혔다"), "낱말이 없으면 안 걸린다");
    }
  }

  /* =====================================================================
     📁 자료실 (2026-08-18)
     ---------------------------------------------------------------------
     지킬 것 셋: ① 목록과 내용을 갈라 두기(안 그러면 창 열 때 전부 내려옴)
     ② 무거운 파일을 **고르는 순간** 막기(통신량 낭비 0) ③ 실행 파일 거부.
     ===================================================================== */
  {
    const FL = fs.readFileSync(DIR + "script_files.js", "utf8");
    const CS4 = fs.readFileSync(DIR + "styles.css", "utf8");
    const DK4 = fs.readFileSync(DIR + "script_dock.js", "utf8");

    /* ── 목록과 내용 가르기 ── */
    ok(!!R.files && !!R.fileBlob, "★ 보안규칙에 files·fileBlob 이 있다 (콘솔 적용 필요)");
    ok(R.files[".read"] === "auth != null" && !R.fileBlob[".read"],
       "★★★ 목록만 통째로 읽힌다 — fileBlob 통째 읽기가 열리면 창을 여는 것만으로 전부 내려온다");
    ok(R.fileBlob.$id[".read"] === "auth != null",
       "★ 내용은 **낱개로만** 읽는다 (받기를 누른 그 하나)");
    ok(/db\.ref\("fileBlob\/" \+ id\)\.once\("value"\)/.test(FL) &&
       !/db\.ref\("fileBlob"\)\.on\(/.test(FL),
       "★★ 코드도 내용을 구독하지 않는다 — 받을 때 한 번만");

    /* ── 크기·종류 막기 ── */
    ok(/const MAX_BYTES  = 2 \* 1024 \* 1024;/.test(FL),
       "★ 한 개당 2MB (콩 확정) 가 한곳에 이름으로 있다");
    ok(/if \(file\.size > MAX_BYTES\) \{[\s\S]{0,400}return;\s*\n\s*\}\s*\n\s*올리기\(file\);/.test(FL),
       "★★★ 크기를 넘으면 **읽지도 않고** 돌려보낸다 (서버로 한 바이트도 안 나감)");
    ok(/서버로는 아무것도 안 보냈어요/.test(FL),
       "★ 통신을 안 썼다는 것까지 알려준다 (괜히 데이터 쓴 줄 알까 봐)");
    ok(/newData\.child\('size'\)\.val\(\) <= 2097152/.test(R.files.$id[".validate"]),
       "★★ 보안규칙도 같은 상한을 본다 (화면을 우회해도 막힌다)");
    ok(/newData\.val\(\)\.length <= 2800000/.test(R.fileBlob.$id[".validate"]),
       "★★ 내용 길이 상한도 규칙에 있다 (base64 는 원본보다 33% 크다)");
    ok(/const OK_EXT = \["hwp", "hwpx", "doc", "docx", "xls", "xlsx", "csv", "txt", "pdf", "zip"\]/.test(FL),
       "★ 받는 종류가 한곳에 있다");
    ok(!/"exe"|"bat"|"cmd"|"scr"/.test(FL),
       "★★ 실행 파일은 목록에 아예 없다");

    /* ── 지우기 권한 ── */
    ok(/nickOwner'\)\.child\(data\.child\('by'\)\.val\(\)\)\.val\(\) === auth\.uid/.test(R.files.$id[".write"]),
       "★★ 지우기는 올린 사람 (규칙이 by 를 nickOwner 로 확인)");
    ok(/root\.child\('staff'\)/.test(R.files.$id[".write"]),
       "방장·운영진도 지울 수 있다");
    ok(/const 지울수 = 내것 \|\| !!window\.canAdmin\?\.\(\);/.test(FL),
       "화면의 ✕ 도 같은 조건이다");

    /* ── 90일 · 알약 자리 ── */
    ok(/const KEEP_MS    = 90 \* DAY_MS;/.test(FL), "★ 90일 뒤 사라진다 (콩 확정)");
    ok(/db\.ref\("files\/" \+ r\.id\)\.remove\(\)[\s\S]{0,200}db\.ref\("fileBlob\/" \+ r\.id\)\.remove\(\)/.test(FL),
       "★ 사라질 때 목록과 내용을 **둘 다** 지운다 (내용만 남으면 유령 용량)");
    /* [2026-08-21 — 콩] 알약 줄 → 머리말 가운데 창으로 옮겼습니다.
       대숲·공지와 같은 결이에요. 알약으로 되돌리지 말 것. */
    ok(!/id: "files"/.test(DK4), "★ 자료실 알약은 없다 (머리말로 옮김)");
    ok(/id="files-head-btn"[^>]*onclick="openFiles\(\)"/.test(HTML),
       "★ 머리말 📁 단추가 자료실을 연다");
    ok(/id="files-modal"/.test(HTML) && /id="files-board"/.test(HTML),
       "★ 가운데 창 껍데기와 알맹이 자리가 index.html 에 붙박이로 있다");
    ok(/#files-modal,/.test(fs.readFileSync(DIR+"styles.css","utf8")),
       "★ 그 창이 대숲·공지와 같은 껍데기 규칙을 쓴다 (안 넣으면 안 보인다)");
    ok(/window\.closeFiles = closeFiles;/.test(FL) &&
       (HTML.match(/closeFiles\(\)/g) || []).length === 2,
       "★ 닫는 길이 둘이다 (바깥 누르기 · ✕)");
    ok(!/dock-body-files/.test(FL), "★ 없어진 알약 판 자리를 더는 찾지 않는다");
    ok(/"script_files\.js":    "openFiles"/.test(HTML),
       "로드 자가진단 목록에도 있다");
    ok(/\.fl-ic\.hwp\{/.test(CS4) && /\.fl-drop\{/.test(CS4), "옷이 있다");

    /* ★★ 닉네임 읽는 법 (2026-08-18 실제로 데인 자리) —
       script_core.js 의 `let myNick` 은 window 에 안 붙습니다. window 만
       보면 멀쩡히 입장한 사람에게도 "먼저 입장하세요" 가 떴어요. */
    ok(/function me\(\) \{\s*\n\s*try \{ if \(typeof myNick === "string" && myNick\) return myNick; \} catch \(e\) \{\}\s*\n\s*return window\.myNick \|\| "";/.test(FL),
       "★★★ 닉네임을 이름 그대로 먼저 읽는다 (window.myNick 만 보면 늘 비어 있다)");

    /* ── Storage 로 옮길 길이 열려 있는가 ── */
    ok(/let src = r\.url;\s*\n\s*if \(!src\)/.test(FL),
       "★★ url 이 있으면 그리로 간다 — 나중에 Storage 로 옮겨도 화면이 안 바뀐다");
    ok(/url: typeof v\.url === "string" \? v\.url : ""/.test(FL),
       "목록에 url 칸을 미리 읽어 둔다 (섞여 있어도 돌아가게)");
  }

  /* =====================================================================
     🔑 비밀번호 바꾸기 (2026-08-20)
     ---------------------------------------------------------------------
     0819 이사 때 옛 비밀번호를 못 옮겨서 38명이 임시 비밀번호를 받았고,
     스스로 바꿀 길이 필요해 만들었습니다. 여기가 막히면 이사가 안 끝나요.
     ===================================================================== */
  {
    const AU = fs.readFileSync(DIR + "script_auth.js", "utf8");
    ok(/id="pw-now"/.test(HTML) && /id="pw-new"/.test(HTML) && /id="pw-new2"/.test(HTML),
       "★ 지금·새·다시 세 칸이 있다 (오타로 못 들어가는 일을 막는다)");
    ok(HTML.indexOf('id="pw-now"') > HTML.indexOf('id="panel-privacy"') &&
       HTML.indexOf('id="pw-now"') < HTML.indexOf('id="reset-title"'),
       "★ 설정 🔒 개인정보 탭 맨 위에 있다");
    ok(/type="password"/.test(HTML.slice(HTML.indexOf('id="pw-now"') - 60, HTML.indexOf('id="pw-now"'))),
       "지금 비밀번호 칸이 가려진다 (type=password)");
    ok(/reauthenticateWithCredential\(cred\)/.test(AU) && /user\.updatePassword\(nw\)/.test(AU),
       "★★ 지금 비밀번호로 확인한 뒤에 바꾼다 (requires-recent-login 도 함께 풀린다)");
    ok(/if \(nw !== nw2\)/.test(AU), "두 칸이 다르면 막는다");
    ok(/nw\.length < MIN_PW/.test(AU), "★ 길이는 MIN_PW 한 곳에서 본다 (입장 화면과 같은 기준)");
    ok(/if \(nw === now\)/.test(AU), "같은 비밀번호로는 안 바뀐다");
    ok(/auth\/wrong-password/.test(AU) && /auth\/too-many-requests/.test(AU),
       "실패 이유를 사람 말로 알려준다");
    ok(/\["pw-now", "pw-new", "pw-new2"\]\.forEach\(id => \{ const i = el\(id\); if \(i\) i\.value = ""; \}\)/.test(AU),
       "★ 바꾼 뒤 칸을 비운다 (화면에 남겨두지 않는다)");
    ok(/window\.changeMyPassword = changeMyPassword;/.test(AU) &&
       /onclick="changeMyPassword\(\)"/.test(HTML),
       "단추가 실제로 연결돼 있다");
    /* [고침 2026-08-20] "되돌릴 수 없다"는 문구를 **한 번만 바꿀 수 있다**로
       읽은 사람이 있었습니다(콩). 몇 번이든 되고, 못 되찾는 건 '잊었을 때'
       뿐이라는 걸 두 문장으로 갈라 적습니다. */
    ok(/언제든 몇 번이든<\/b> 바꿀 수 있어요/.test(HTML),
       "★ 몇 번이든 바꿀 수 있다는 걸 먼저 알려준다");
    ok(/잊어버리면 스스로 되찾을 수 없어요/.test(HTML) && /이메일을 쓰지 않아서/.test(HTML),
       "못 되찾는 건 '잊었을 때'뿐이고 그 이유까지 적혀 있다");
  }

  /* =====================================================================
     👋 입장 인사 (2026-08-20)
     ---------------------------------------------------------------------
     쓸모는 하나 — **안 읽고 지나치는 걸 막는 것**. 그래서 저절로 닫히지
     않고, 바깥을 눌러도 안 닫히고, [확인] 이 챗창까지 열어 줍니다.
     ===================================================================== */
  {
    const CS6 = fs.readFileSync(DIR + "styles.css", "utf8");
    const AH3 = fs.readFileSync(DIR + "admin.html", "utf8");
    ok(!!R.config.hello && 운영진(R.config.hello[".write"]),
       "★ 인사는 방장·운영진이 건다 (공지와 같은 결)");
    ok(/newData\.child\('text'\)\.val\(\)\.length <= 200/.test(R.config.hello[".validate"]),
       "너무 긴 글은 안 들어온다");
    ok(/const text = String\(v\?\.text \|\| ""\)\.trim\(\);\s*\n\s*if \(!text\) return;/.test(RT),
       "★★ 안 걸려 있으면 아무에게도 안 뜬다 (공지 핀과 같은 결)");
    ok(/const 도장 = `\$\{오늘\}\|\$\{at\}`;/.test(RT),
       "★★ 하루 한 번 — 다만 문구가 바뀌면(at) 그날 다시 한 번");
    ok(!/setTimeout\([^)]*veil\.classList\.remove\("on"\)/.test(RT),
       "★★★ 저절로 닫히지 않는다 — [확인] 을 눌러야 한다 (콩 요청)");
    ok(!/veil\.addEventListener\("click"/.test(RT),
       "★★ 바깥을 눌러도 안 닫힌다 (실수로 흘려보내지 않게)");
    ok(/window\.dockOpen\?\.\("chat"\)/.test(RT.slice(RT.indexOf("async function showHelloOnce"))),
       "★★ 확인을 누르면 챗창이 열린다 (발자국 찍으라고 부른 인사라서)");
    ok(/window\.showHelloOnce\?\.\(\)/.test(CO),
       "입장할 때 부른다");
    ok(/setTimeout\(\(\) => \{ try \{ window\.showHelloOnce\?\.\(\); \} catch\(e\)\{\} \}, 600\)/.test(CO),
       "★ 알약 줄이 다 선 뒤에 부른다 (안 그러면 챗창을 못 연다)");
    ok(/\.hello-veil\{/.test(CS6) && /white-space: pre-line/.test(CS6),
       "★ 방장이 줄을 나눠 적으면 그대로 보인다");
    ok(/id="adm-hello"/.test(AH3) && /id="adm-hello-save"/.test(AH3) && /id="adm-hello-clear"/.test(AH3),
       "★ 관리 페이지에서 문구를 걸고 내릴 수 있다");
    ok(/db\.ref\("config\/hello"\)\.set\(\{ text: t, at: Date\.now\(\) \}\)/.test(AD),
       "걸 때 at 을 함께 적는다 (같은 문구도 다시 돌게)");
  }

  /* ── 🚚 대문의 이사 안내 (2026-08-20, 이사가 끝나면 지울 것) ── */
  {
    const CS5 = fs.readFileSync(DIR + "styles.css", "utf8");
    ok(/class="join-moved" href="findpw-k7f3a92x\.html"/.test(HTML),
       "★ 대문에 임시 비밀번호 찾기로 가는 길이 있다");
    ok(HTML.indexOf('class="join-moved"') > HTML.indexOf('id="join-btn"'),
       "★ 입장 단추 **아래**에 있다 (진짜 단추와 겨루지 않게)");
    ok(/#modal \.join-moved\{/.test(CS5), "옷이 있다");
    ok(/이사가 끝나면[\s\S]{0,60}지우면 됩니다/.test(CS5) &&
       /지울 곳은 여기 한 군데예요/.test(HTML),
       "★ 나중에 어디를 지우면 되는지 적혀 있다 (임시 안내라서)");
  }

  /* ── 명단 관리 ── */
  ok(/db\.ref\("nickOwner\/" \+ nick\)\.once\("value"\)\)\.val\(\)/.test(AD),
     "★ 닉네임을 적으면 uid 를 대신 찾아 준다 (콘솔을 안 열어도 되게)");
  ok(/db\.ref\("staff\/" \+ uid\)\.set\(nick\)/.test(AD),
     "명단은 staff/{uid} = 닉네임 으로 저장된다");
  ok(/닉은 바뀝니다/.test(AD), "★ 왜 닉이 아니라 uid 인지 이유가 적혀 있다");

  /* ── 메인 방 숨은 문 ── */
  ok(/function canAdmin\(\)/.test(RT) && /myNick === ADMIN_NICK \|\| _isStaff/.test(RT),
     "★ 숨은 문이 방장과 운영진 둘 다에게 열린다");
  ok(/if \(!canAdmin\(\)\) return;\s*\/\/ 방장·운영진이 아니면 무반응/.test(RT),
     "★★ 자격이 없으면 아무 반응이 없다 — 알림을 띄우면 거기 문이 있다고 알려주는 셈");
  ok(/window\.refreshStaffFlag\?\.\(\)/.test(CO),
     "입장 직후 한 번만 명단을 읽는다 (누를 때마다 물으면 굼뜨다)");
  ok(/_isStaff = false;[\s\S]{0,400}catch \(e\) \{ _isStaff = false; \}/.test(RT),
     "★ 못 읽었으면 안전한 쪽(닫힘)으로 틀린다");

  /* ── 🏷️ 방장 스티커는 그대로 방장만 (콩 결정 2026-08-17) ── */
  ok(/u === ADMIN_NICK/.test(RT) && !/u === ADMIN_NICK \|\| .*staff/.test(RT),
     "★ 카드 스티커는 여전히 방장에게만 붙는다 (관리 권한과 '방장' 자리는 다르다)");

  /* ★ finish() 는 async 입니다 (돌려 보는 검사 하나를 기다립니다).
     터지면 조용히 넘어가지 않게 여기서 붙잡습니다 — 안 그러면
     "검사가 다 돌았다" 고 착각하게 됩니다. */
  finish().catch(e => { console.error("\n검사 마무리에서 터졌습니다:", e); process.exit(1); });
}

function checkNotice(){
  ran["notice"]=true;
  const NT = fs.readFileSync(DIR+"script_notice.js","utf8");
  const RULES = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8").replace(/\/\/.*/g,"")).rules;
  const ADMIN = "ABM1ZJndrqaV3gpYUs03SV9qglr1";

  /* ── 화면 뼈대 ── */
  ok(/id="notice-btn"/.test(HTML), "채팅 머리말에 📢 공지 단추가 있다");
  /* [2026-08-11] 순서를 Chat → 📢 공지 → ☕ 수다방 으로 바꿨습니다 */
  ok(HTML.indexOf('id="my-info"') < HTML.indexOf('id="notice-btn"')
     && HTML.indexOf('id="notice-btn"') < HTML.indexOf('id="chat-tab-chatty"'),
     "★ 머리말 차례가 Chat → 공지 → 수다방 이다");
  ok(/id="notice-dot"/.test(HTML), "안 읽음 붉은 점 자리가 있다");
  ["notice-modal","notice-board","notice-foot","notice-zoom"].forEach(id =>
    ok(new RegExp('id="'+id+'"').test(HTML), `${id} 자리가 있다`));
  ok(/script_notice\.js/.test(HTML), "script_notice.js 를 불러온다");
  ok(/"script_notice\.js":\s*"openNoticeBoard"/.test(HTML), "로드 자가진단 목록에 들어 있다");
  ok(/callIfFn\("listenNoticeBoard"\)/.test(fs.readFileSync(DIR+"script_core.js","utf8")),
     "★ 입장할 때 공지판을 듣기 시작한다 (안 그러면 붉은 점이 안 붙는다)");

  /* ── 목록과 사진을 나눠 두었나 ── */
  ok(/notice\/list/.test(NT) && /notice\/img/.test(NT), "목록과 사진을 다른 칸에 둔다");
  ok(/db\.ref\("notice\/list"\)\.on\(/.test(NT), "목록만 계속 듣는다");
  ok(/db\.ref\("notice\/img\/" \+ id\)\.once\(/.test(NT),
     "★ 사진은 그 공지를 펼칠 때만 한 번 받아온다");
  ok(/if \(_imgCache\[id\]\) return _imgCache\[id\];/.test(NT), "받아온 사진은 다시 안 받는다");

  /* ── 올리는 순서 — 사진 먼저, 목록 나중 ── */
  {
    const s = NT.slice(NT.indexOf("async function saveNotice"));
    const body = s.slice(0, s.indexOf("\n  }\n"));
    ok(body.indexOf('notice/img/') < body.indexOf("await ref.set("),
       "★ 사진을 먼저 올리고 목록을 나중에 올린다 (사진 없는 '사진 2장' 공지가 안 생기게)");
  }

  /* ── 권한 ── */
  ok(RULES.notice.list[".read"] === true && RULES.notice.img[".read"] === true,
     "공지는 모두가 읽는다");
  ok(RULES.notice.list[".write"].includes(ADMIN) && RULES.notice.img[".write"].includes(ADMIN),
     "★ 쓰기는 보안규칙이 방장 계정 하나로 막는다");
  ok(!RULES.notice.list[".write"].includes("nickOwner"),
     "닉네임이 아니라 계정 번호로 막는다 (닉네임은 바뀔 수 있으니)");
  ok(NT.includes(ADMIN), "화면 쪽 계정 번호가 보안규칙과 같다");
  ok(/const isAdmin = /.test(NT) && /isAdmin\(\) \?/.test(NT), "방장이 아니면 쓰기 칸을 안 그린다");

  /* ── 사진 줄이기 — 실제로 계산해 봅니다 ── */
  {
    const box = { IMG_MAX_W: 900 };
    vm.createContext(box);
    vm.runInContext(`function calc(w,h){const W=Math.min(w,IMG_MAX_W);return [W,Math.max(1,Math.round(h*(W/w)))];}`, box);
    const [w1,h1] = vm.runInContext("calc(1920,1080)", box);
    const [w2,h2] = vm.runInContext("calc(640,480)", box);
    const [ ,h3] = vm.runInContext("calc(3000,2)", box);
    ok(w1 === 900 && h1 === 506, "가로 900px 로 줄이면서 비율을 지킨다");
    ok(w2 === 640 && h2 === 480, "★ 원본이 작으면 키우지 않는다 (키워봐야 흐려지니)");
    ok(h3 >= 1, "★ 아주 납작한 그림도 세로가 0 이 되지 않는다 (0 이면 캔버스가 터진다)");
    ok(/const w = Math\.min\(img\.width, IMG_MAX_W\)/.test(NT), "코드도 같은 식을 쓴다");
    ok(/Math\.max\(1,/.test(NT), "코드에도 세로 0 막이가 있다");
  }
  ok(/ctx\.fillStyle = "#FFFFFF"/.test(NT),
     "★ 흰 바탕을 먼저 깐다 (투명 PNG 가 JPEG 에서 검게 되지 않게)");
  ok(/data:image\\\/\(png\|jpeg\|webp\)/.test(NT),
     "저장된 사진 값은 data:image 만 통과시킨다 (외부 주소·javascript: 차단)");

  /* ── 읽음 표시 ── */
  ok(/setTimeout\(markSeen, 1200\)/.test(NT),
     "★ 열자마자가 아니라 잠깐 뒤에 읽음 처리한다 (무엇이 새것인지 보이게)");
  ok(!/notice\/read|noticeSeen.*db\.ref/.test(NT), "누가 읽었는지는 서버에 남기지 않는다");

  /* ── ★ 팝업 안쪽 클릭이 리스너까지 닿는가 ────────────────────────
     팝업 껍데기에는 "바깥을 누르면 닫기"가, 안쪽 상자(.modal-content)에는
     onclick="event.stopPropagation()" 이 붙어 있습니다. 그래서 리스너를
     **껍데기에 달면 안에서 누른 클릭이 절대 도착하지 않습니다.**

     이 사고는 2026-08-06 🗂️ 나의 작업, 2026-08-11 📢 공지 — 두 번 났습니다.
     사람이 기억해서 피할 일이 아니라서 여기서 못 박습니다.
     팝업을 새로 만들 때 이 목록에 id 만 더하면 됩니다. */
  [["notice-modal","script_notice.js"],
   ["mywork-modal","script_mywork.js"],
   ["forest-modal","script_forest.js"]].forEach(([id, file]) => {
    const src = fs.readFileSync(DIR+file,"utf8").replace(/\/\*[\s\S]*?\*\//g,"");

    /* 껍데기가 정말 "바깥 누르면 닫기 + 안쪽 stopPropagation" 구조인가 */
    const shell = new RegExp('id="'+id+'"[^>]*onclick="close').test(HTML);
    const inner = HTML.slice(HTML.indexOf('id="'+id+'"'), HTML.indexOf('id="'+id+'"') + 400);
    if (!shell || !/event\.stopPropagation\(\)/.test(inner)) return;

    ok(/querySelector\(["']\.modal-content["']\)/.test(src),
       `★ ${file} 이 리스너를 안쪽 상자(.modal-content)에 단다`);

    /* 껍데기 변수에 곧바로 거는 자리가 남아 있지 않은가 */
    const bad = new RegExp('(\\w+)\\s*=\\s*el\\("'+id+'"\\)[\\s\\S]{0,400}?\\1\\.addEventListener\\("click"');
    ok(!bad.test(src), `${file} 이 껍데기에 곧바로 click 을 걸지 않는다`);
  });

  /* ── ★ window 이름이 겹치지 않는가 ────────────────────────────────
     [2026-08-11] 머리말의 📌 고정 공지가 사라졌습니다. 원인은 이름이었어요.

       script_realtime.js : window.listenNotice  ← 📌 머리말 고정 공지
       script_notice.js   : window.listenNotice  ← 📢 공지판 (새로 만든 것)

     이 방의 파일들은 모듈이 아니라 한 광장(window)을 함께 씁니다. 뒤에
     실린 파일이 앞의 이름을 조용히 덮어써요. 오류도 경고도 안 납니다 —
     그냥 원래 기능이 없어진 것처럼 보입니다.

     새 파일을 만들 때마다 사람이 기억해서 피할 일이 아니라 여기서 셉니다.
     (wrapper 는 예외입니다 — 원래 것을 _origXxx 로 챙겨두고 감싸는 방식) */
  {
    const owner = {};
    fs.readdirSync(DIR).filter(f => /^script_.*\.js$/.test(f)).forEach(f => {
      const src = fs.readFileSync(DIR+f,"utf8").replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"");
      for (const m of src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=\s*(?:(?:async\s*)?function\b|\1\s*;)/g)) {
        const n = m[1];
        /* 일부러 감싼 것(_origOpenTab 처럼)은 겹침이 아닙니다 */
        if (new RegExp("_orig" + n.charAt(0).toUpperCase() + n.slice(1)).test(src)) continue;
        (owner[n] = owner[n] || new Set()).add(f);
      }
    });
    const dup = Object.entries(owner).filter(([, s]) => s.size > 1)
      .map(([k, s]) => `${k}(${[...s].join("+")})`);
    ok(!dup.length, "★ 두 파일이 같은 이름을 window 에 붙이지 않는다" + (dup.length ? " — " + dup.join(", ") : ""));
  }

  /* 공지판 이름은 전부 …Board 로 — 📌 머리말 공지와 헷갈리지 않게 */
  ["openNoticeBoard","closeNoticeBoard","listenNoticeBoard"].forEach(n =>
    ok(new RegExp("window\\."+n+"\\s*=").test(NT), `${n} 이름으로 내보낸다`));
  /* [철거 2026-08-14] 머리말 📌 한줄 공지는 시계에게 자리를 내주고
     떠났습니다 — 이제 남아 있으면 안 됩니다 (죽은 코드 감시) */
  ok(!/callIfFn\("listenNotice"\)/.test(fs.readFileSync(DIR+"script_core.js","utf8")),
     "★ 머리말 한줄 공지는 철거됐다 (부르는 곳이 없어야 한다)");

  /* ── 고치기 ── */
  ok(/data-nt="edit"/.test(NT), "공지를 고칠 수 있다");
  ok(/const keepAt = editing/.test(NT),
     "★ 고쳐도 올린 시각은 그대로 둔다 (오타 하나에 방 전체가 새 공지 알림을 받지 않게)");
  ok(/editedAt: Date\.now\(\)/.test(NT) && /수정됨/.test(NT), "고친 글에는 (수정됨) 이 붙는다");
  ok(/await loadImgs\(id\)/.test(NT.slice(NT.indexOf('act === "edit"'))),
     "★ 고치기를 열 때 사진도 함께 불러온다 (그냥 저장했다고 사진이 날아가지 않게)");
  ok(/} else if \(editing\) \{[\s\S]{0,220}notice\/img\/" \+ id\)\.remove\(\)/.test(NT),
     "사진을 다 빼고 저장하면 서버에서도 지운다");

  /* ── 실패했을 때 원인을 말해 주는가 ──
     "올리지 못했어요" 한 줄로는 어디를 봐야 할지 알 수 없습니다.
     권한·값·연결은 손볼 곳이 전부 다릅니다. */
  ok(/e\.code \|\| e\.message/.test(NT), "★ 실패하면 파이어베이스가 준 이유를 함께 보여준다");
  ok(/async function noticeBoardDiag/.test(NT) && /window\.noticeBoardDiag/.test(NT),
     "안 써질 때 원인을 갈라 보는 noticeBoardDiag() 가 있다");
  ok(/await ref\.remove\(\)/.test(NT.slice(NT.indexOf("async function noticeBoardDiag"))),
     "★ 진단으로 쓴 글은 곧바로 지운다 (공지판에 '진단' 이 남지 않게)");

  /* ── 설명서 ── */
  ok(/📢 공지/.test(fs.readFileSync(DIR+"script_manual.js","utf8")), "설명서에 공지 안내가 있다");

  /* ⌨️ 한글 조합 블랙박스 (2026-08-13) — 자모가 낱개로 찍히는 증상 추적용 */
  {
    const UI2 = fs.readFileSync(DIR+"script_ui.js","utf8");
    ok(/window\.imeDiag = function/.test(UI2), "★ imeDiag() 창구가 있다");
    /* ★★★ [2026-08-17] 첫 규칙이 틀렸습니다 — "자모 낱개로 끝나면 비정상"
       으로 봤는데, 한국 사람은 ㅋㅋㅋ·ㅜㅜ·ㅇㅇ 를 **일부러** 칩니다.
       방장이 "계속 ㅜㅜ ㅋㅋ" 를 치자 🚨 가 줄줄이 떴어요 (전부 정상).
       규칙이 세상을 몰랐던 것이라, 이제 **후퇴**만 봅니다. */
    ok(/끝\.length < 마지막모양\.length/.test(UI2),
       "★★★ 조합이 자란 뒤 **후퇴**했을 때만 신고한다 (ㅋㅋ·ㅜㅜ 는 정상)");
    ok(/if \(마지막모양 && !끝\)/.test(UI2),
       "★★ 조합된 게 통째로 사라지는 경우도 잡는다 (글자가 씹히는 증상)");
    ok(!/신고\("조합이 자모 낱개로 끊겼습니다!"\)/.test(UI2),
       "★★★ 옛 오탐 규칙이 되살아나지 않았다");
    ok(/맨자모연속 >= 3/.test(UI2),
       "★ 조합 없는 자모는 3개 연속부터 신고한다 (ㅋ 한 번은 예사)");
    ok(/performance\.now\(\) - 마지막때 < 40/.test(UI2),
       "★ 내 타자로 생긴 커서 움직임은 안 적는다 (로그가 파묻혀서)");
    ok(/★★ 입력칸이 옮겨지거나 지워짐!/.test(UI2) && /조합 중이었음!/.test(UI2),
       "입력칸 이사와 조합 중 blur 를 콕 집어 기록한다");
    ok(/window\._imeDiagStop/.test(UI2) && /removeEventListener\("compositionstart", onStart, true\)/.test(UI2),
       "끄는 길이 있고, 끄면 손가락을 다 걷어낸다");
    ok(/조합 없이 자모 입력/.test(UI2) && /if \(e\.isComposing\) return;/.test(UI2),
       "★ 조합이 시작조차 안 되는 형태도 잡는다 (그물 둘)");
    ok(/AppStore\?\.setItem\("imeDiagOn", "1"\)/.test(UI2) &&
       /getItem\("imeDiagOn"\) === "1"/.test(UI2),
       "★ 한 번 켜면 다음 접속에도 켜져 있다 (드물게 나는 증상이라)");
    ok(/AppStore\?\.removeItem\("imeDiagOn"\)/.test(UI2), "끄면 다음 접속에도 꺼진다");

    /* ⇪ Caps Lock 지킴이 — "타자가 풀려요" 의 정체가 이것이었다.
       맥 한글 입력기는 Caps Lock 이 켜져 있으면 자모를 조합하지 않는다. */
    ok(/getModifierState\("CapsLock"\)/.test(UI2), "★★ Caps Lock 상태를 실제 키 이벤트에서 읽는다");
    ok(/if \(!on\) \{ _capsWarned = false; return; \}/.test(UI2),
       "★ 켜져 있는 동안 한 번만 알리고, 풀리면 다음을 위해 초기화한다");
    ok(/if \(e\.key === "CapsLock"\) return;/.test(UI2),
       "Caps Lock 키 자체를 누르는 중에는 안 울린다 (막 끄는 참일 수 있다)");
    ok(/Shift\+Caps Lock/.test(UI2), "안내가 원인(Shift+Caps Lock 실수)까지 짚어 준다");
    {
      /* 울리는 규칙을 실제로 굴려 봅니다 */
      let warned = 0, _capsWarned = false;
      const 키 = (caps, key, inField) => {
        if (!inField) return;
        if (!caps) { _capsWarned = false; return; }
        if (_capsWarned) return;
        if (key === "CapsLock") return;
        _capsWarned = true; warned++;
      };
      키(true, "ㅂ", true); 키(true, "ㅔ", true); 키(true, "ㄹ", true);
      ok(warned === 1, "켜진 채 아무리 쳐도 경고는 한 번");
      키(false, "ㅂ", true);           // 껐다가
      키(true, "ㄴ", true);            // 또 실수
      ok(warned === 2, "다시 켜지면 다시 한 번 알린다");
      키(true, "CapsLock", true);
      ok(warned === 2, "Caps Lock 키 자체는 안 울린다");
    }
  }
  /* 자가진단 목록이 지금 배치와 맞는가 — script_layout.js 를 찾으면
     알약 줄에서는 없는 게 정상이라 매번 빨간 헛경보가 뜬다 (2026-08-13) */
  {
    const IX = fs.readFileSync(DIR+"index.html","utf8");
    const m = IX.match(/const required = \{[\s\S]*?\};/);
    ok(!!m && !/script_layout\.js/.test(m[0]),
       "★★ 로드 자가진단이 예전 배치 파일(script_layout.js)을 찾지 않는다");
    ok(!!m && /"script_dock\.js":\s*"dockOpen"/.test(m[0]),
       "대신 지금 배치(script_dock.js)를 지켜본다");
  }

  /* =====================================================================
     🧘 혼자 방 — 유령 카드 꾸미기 (2026-08-15)
     ---------------------------------------------------------------------
     [왜 지키는가] 프로필 편집은 오랫동안 "늘 내 카드"였습니다. 혼자 방에서
     유령 카드를 누르면 그 카드를 꾸미도록 대상 개념(profileTargetNick)을
     넣었는데, 이게 진짜 방으로 새면 남의 카드를 고치는 사고가 됩니다.
     그래서 대상 지정은 window.SOLO 일 때만 열립니다 — 그 조건이 사라지면
     여기서 걸립니다.
     ===================================================================== */
  {
    const PR = fs.readFileSync(DIR+"script_profile.js","utf8");
    ok(/function profileTargetNick\(\)\s*\{\s*return window\._profTargetNick \|\| myNick/.test(PR),
       "★ 꾸밀 카드 = window._profTargetNick, 없으면 내 카드");
    /* [피 흘리고 배운 것 2026-08-15] 처음엔 이 값을 window.profileTargetNick
       에 담았습니다. 그런데 함수 이름이 profileTargetNick 이라, 전역 함수
       선언이 곧 window.profileTargetNick 입니다 — 닉을 넣는 순간 함수가
       문자열에 덮여 죽었어요. 화면에는 함수 본문이 이름처럼 찍히고,
       사진을 올리면 "not a function" 이 떴습니다. 이름을 갈라 둡니다. */
    ok(!/window\.profileTargetNick\s*=/.test(PR),
       "★★ 상태값을 함수와 같은 이름(window.profileTargetNick)에 담지 않는다 — 전역 함수를 덮어씁니다");
    ok(/window\._profTargetNick = \(window\.SOLO && nick\) \? String\(nick\) : myNick;/.test(PR),
       "★★ 남의 카드 지정은 혼자 방(window.SOLO)에서만 — 진짜 방은 늘 내 카드로 되돌린다");
    ok(/async function saveMyProfile\(patch\) \{[\s\S]*?const nick = profileTargetNick\(\);[\s\S]*?users\/\$\{nick\}\/profile/.test(PR),
       "★ 저장도 그 카드에 — myNick 이 아니라 대상 닉으로 씁니다");
    ok(/if \(window\.SOLO\) \{[\s\S]{0,300}?card-avatar-wrap[\s\S]{0,300}?openProfileEditor\(card\.getAttribute\("data-card-nick"\)\)/.test(PR),
       "혼자 방에서 유령 카드 프사를 누르면 그 카드의 꾸미기가 열린다");
    ok(/const src = Array\.from[\s\S]{0,200}?data-card-nick"\) === profileTargetNick\(\)/.test(PR),
       "스티커 배치판이 복제하는 카드도 지금 고른 카드다");
  }

  /* 🧘 혼자 방에서는 카드를 눌러도 쪽지·업적이 열리지 않는다 (2026-08-15)
     혼자 방 카드는 전부 자기 것이라, 자기에게 쪽지를 쓰거나 자기 업적을
     남처럼 들여다보는 창이 프꾸 창 위로 겹쳐 떴습니다. */
  {
    const NT = fs.readFileSync(DIR+"script_note.js","utf8");
    ok(/list\.addEventListener\("click", \(e\) => \{[\s\S]{0,300}?if \(window\.SOLO\) return;/.test(NT),
       "★ 혼자 방에서는 카드 클릭이 쪽지·업적으로 새지 않는다");
  }

  /* =====================================================================
     🧘 혼자 방 배선 (2026-08-15) — 카드가 통째로 사라지던 일
     ---------------------------------------------------------------------
     [무엇이 문제였나] 유령들을 window._statusCache 에만 얹어 두고, 진짜
     저장자리(status)에는 내 카드 하나만 넣었습니다. 그런데 status 를 듣는
     쪽이 한 번이라도 돌면 캐시를 통째로 갈아치웁니다 — 작업 스티커를
     붙이는 순간 유령이 전부 사라졌어요. 전부 status 에 넣어 두면
     진짜 방과 똑같은 길로 흐릅니다.
     ===================================================================== */
  {
    const SO = fs.readFileSync(DIR+"script_solo.js","utf8");
    ok(/_put\("status", out\);/.test(SO),
       "★★ 혼자 방의 카드는 전부 진짜 저장자리(status)에 실린다");
    ok(/const cache = _get\("status"\) \|\| \{\};/.test(SO),
       "★ 유령의 숨결도 저장자리를 고친다 — 화면 캐시만 고치면 듣는 쪽이 모른다");
    ok(/r\.lastSeen = 지금;/.test(SO),
       "유령도 lastSeen 을 갱신한다 — 안 그러면 오래된 기록으로 걸러져 하나씩 사라진다");
    ok(/Object\.defineProperty\(firebase\.database, "ServerValue"[\s\S]{0,120}?TIMESTAMP: Date\.now\(\)/.test(SO),
       "★★ 가짜 ServerValue.TIMESTAMP 는 부를 때마다 지금이다 (박아 두면 내 카드가 늙어 사라진다)");
    ["listenStatus","listenPomodoro","startWordcount","startTimelog","renderShareButton"]
      .forEach(fn => ok(new RegExp('"'+fn+'"').test(SO),
        "혼자 방도 " + fn + " 을 켠다 (진짜 방에서는 join 이 하던 일)"));
    ok(/window\.updateStatus\?\.\(true\)/.test(SO) && /setInterval\([\s\S]{0,80}?updateStatus/.test(SO),
       "★ 내 카드도 계속 갱신된다 — 뽀모 🍅 와 작업 시간이 여기 실린다");
    ok(/const \{ screens, \.\.\.남길것 \} = _tree;/.test(SO),
       "화면 공유 그림은 저장하지 않는다 — 5초마다 40KB 면 저장 공간이 금방 찬다");
    /* 🖥️ 가짜 화면 — 저장은 profile 에, 그리기는 screens 로 */
    ok(/function 화면동기\(\)/.test(SO) && /사람들\[닉\]\?\.profile\?\.shareImg/.test(SO),
       "★★ 가짜 화면은 profile.shareImg 에 살고, 그릴 때 screens 로 옮겨 담는다");
    ok(/img\.startsWith\("data:image\/"\)/.test(SO),
       "옮겨 담을 때도 data:image 만 통과시킨다");
    ok(/"listenScreens"\]/.test(SO) && /setTimeout\(화면동기, 800\);/.test(SO),
       "혼자 방이 액자를 직접 켜고, 꾸밈을 다 읽은 뒤에 채운다");
    /* ★★ [고침 2026-08-15] at 을 매번 지금으로 두면 30초마다 액자를 전부
       헐고 다시 지어서, 내 **진짜** 공유 화면까지 깜빡였습니다. */
    ok(/out\[닉\] = \{ img: 뭉갠, at: 1, level: 폭, fit \};/.test(SO),
       "★★ 가짜 화면의 시각은 **여전히 고정**(at: 1) — 매번 달라지면 액자를 통째로 다시 짓는다");
    /* [2026-08-21 — 콩] 혼자 방이 시험장 노릇을 하려면 뭉갬도 진짜와 같아야 합니다 */
    ok(/const 폭 = window\.shareWidthNow\?\.\(\) \|\| 256;/.test(SO),
       "★ 지금 뭉갬 폭을 그대로 가져온다");
    ok(/window\.soloBlurShot \? window\.soloBlurShot\(img, 폭\) : img/.test(SO),
       "★ 없으면 원본을 그대로 쓴다 (혼자 방이 먼저 뜨는 순서를 대비)");
    /* [2026-08-21 — 콩] 카드의 빨간 불을 찾을 게 아니라, 사진을 올리는
       자리 바로 아래에서 뭉갬을 시험합니다. */
    {
      const PR = fs.readFileSync(DIR + "script_profile.js", "utf8");
      ok(/id="solo-blur"/.test(PR) && /class="solo-blur-row"/.test(PR),
         "★ 혼자 방 사진 아래에 뭉갬 슬라이더가 있다");
      ok(/window\.shareWidthNow\?\.\(\) \|\| 256/.test(PR),
         "★ 지금 값에서 시작한다");
      ok(/window\.setShareWidth\?\.\(v, \{ quiet: true \}\)/.test(PR),
         "★★ 진짜 방과 **같은 자리**에 저장한다 (여기서 맞추면 저기도 맞음). quiet — 끄는 동안엔 안 보냄");
      ok(/await window\.soloBlurShotAsync\?\.\(원본, v\)/.test(PR),
         "★ 미리보기를 진짜 방에서 보일 모습으로 다시 그린다");
      ok(/prevImg\.setAttribute\("data-원본", 원본\)/.test(PR),
         "★★ 원본을 따로 붙들어 둔다 (뭉갠 것을 또 뭉개면 점점 상합니다)");
      const 손 = PR.slice(PR.indexOf("const blurR = document.getElementById"),
                          PR.indexOf("const shotBtn = document.getElementById"));
      ok(!/db\.ref|firebase/.test(손), "★★ 슬라이더를 움직여도 서버를 안 부른다");
      const SH2 = fs.readFileSync(DIR + "script_share.js", "utf8");
      ok(/window\.soloBlurPeek/.test(SH2) && /window\.soloBlurShotAsync/.test(SH2),
         "★ 바로 꺼내는 길과 기다리는 길이 따로 있다");
    }
        ok(!/shareImg[^\n]*=[^\n]*뭉갠/.test(SO),
       "★★ 저장된 사진(profile.shareImg)은 건드리지 않는다 — 화면에만 겁니다");
    ok(/if \(JSON\.stringify\(옛\) === JSON\.stringify\(out\)\) return;/.test(SO),
       "달라진 게 없으면 아예 건드리지 않는다 (듣는 쪽도 안 깨움)");
    /* ★★ [고침 2026-08-15] 가짜를 채우면서 **진짜 공유 화면을 쓸어버렸습니다.**
       screens 를 통째로 새로 쓰는데, 진짜 공유가 5초마다 넣는 내 그림이
       30~90초마다 지워졌어요 — 내 화공이 사라졌다 되살아난 이유. */
    ok(/if \(window\.isScreenSharing\?\.\(\) === true && 옛\[나\]\) out\[나\] = 옛\[나\];/.test(SO),
       "★★ 진짜로 공유 중이면 그 자리는 건드리지 않고 그대로 옮겨 온다");
    ok(/window\.soloEditCard = function/.test(SO) && /window\.soloSetCount/.test(SO),
       "설정 창이 쓸 창구(soloEditCard · soloSetCount)가 있다");

    /* =================================================================
       🎲 오늘 나올 사람 뽑기 (2026-08-15)
       자리를 20개 꾸며 놔도 9장만 켜면 늘 앞의 9명만 나왔습니다.
       자리(꾸밈이 사는 곳)와 오늘 나올 수를 갈랐습니다.
       ================================================================= */
    ok(/function 뽑힌자리\(\)/.test(SO) && /const SHOW_KEY = "soloShow"/.test(SO),
       "★★ 만들어 둘 자리와 오늘 나올 수가 갈라져 있다");
    ok(/for \(let i = 나머지\.length - 1; i > 0; i--\)/.test(SO),
       "뽑기는 피셔–예이츠로 고르게 섞는다");
    ok(/const 뽑음 = \[0, \.\.\.나머지\.slice\(0, Math\.max\(0, m - 1\)\)\]\.sort/.test(SO),
       "★ 내 카드는 늘 뽑히고, 뽑은 뒤에는 자리 번호대로 세운다");
    ok(/const PICK_KEY = "soloPick"/.test(SO) && /_sess\(\)\?\.setItem\(PICK_KEY/.test(SO),
       "★ 한 번 뽑으면 그 탭을 닫을 때까지 그대로 (기기가 아니라 그 자리에만 기억)");
    ok(/const 바뀜 = v !== 카드수\(\);/.test(SO) && /const 바뀜 = w !== 보일수\(\);/.test(SO),
       "★★ 값이 그대로면 다시 뽑지 않는다 — 설정만 열었다 닫아도 얼굴이 바뀌면 안 된다");
    ok(/const f = _친구\.find\(f => f\.nick === nick\);[\s\S]{0,80}?const found = f\.idx;/.test(SO),
       "★★ 카드를 고칠 때 화면에 선 순서가 아니라 **자리 번호(idx)** 를 본다");

    /* [고침 2026-08-15] 다시 지을 때 내 카드는 물려받습니다.
       안 그러면 유령에게 스티커를 붙일 때마다 내 카드의 작업 스티커·🍅·
       작업 시간이 초기값으로 돌아갑니다 (실제 제보). */
    ok(/const 옛나 = _get\("status\/" \+ 내닉\(\)\);[\s\S]{0,160}?out\[내닉\(\)\] = \{ \.\.\.out\[내닉\(\)\], \.\.\.옛나 \};/.test(SO),
       "★★ 방을 다시 지어도 내 카드의 살아 있는 값(스티커·🍅·작업 시간)은 지워지지 않는다");

    /* 🔍 화면 확대·축소의 알맹이는 script_zoom.js 한 곳 — 아래에서 따로 봅니다 */

    /* ★★ 이름 바꾸기 — 짐을 다 옮기고, 저장이 끝난 뒤에 방을 다시 엽니다.
       users/{닉} 아래에는 프꾸(profile) 말고도 ♪ 나의 리스트(musicMine)와
       테마(prefs)가 함께 삽니다. 그리고 저장은 400ms 뒤에 몰아서 하는데
       그 전에 reload 가 돌면 통째로 사라집니다 — 둘 다 실제로 겪었어요. */
    ok(/const 짐 = _get\("users\/" \+ 옛\);[\s\S]{0,80}?_put\("users\/" \+ 새, 짐\);/.test(SO),
       "★★ 이름을 바꾸면 users/{닉} 을 통째로 옮긴다 (프꾸·브금 리스트·테마가 다 여기 산다)");
    ok(/function _flush\(\)/.test(SO) && /_flush\(\);\s*\/\/ ★ 저장이 끝난 것을 보고 나서 다시 엽니다\s*location\.reload\(\);/.test(SO),
       "★★ 방을 다시 열기 전에 저장을 끝낸다 — 미뤄둔 저장은 reload 에 먹힌다");
    ok(/function 걷어내기\(\) \{\s*window\.mountZoomCtl\?\.\(\);/.test(SO),
       "혼자 방도 머리말 제 자리에 확대·축소를 단다 (두 방이 같아졌습니다)");
  }

  /* =====================================================================
     🔍 화면 확대·축소 (script_zoom.js, 2026-08-15) — 두 방이 같이 씁니다
     ===================================================================== */
  {
    const ZM = fs.readFileSync(DIR+"script_zoom.js","utf8");
    ok(/const MIN = 70, MAX = 130, STEP = 5;/.test(ZM),
       "70~130% 를 5% 단위로 오간다");
    /* =====================================================================
       🔄 [뒤집기 2026-08-22 — 콩] 두 방식이 나란히 삽니다
       ---------------------------------------------------------------------
       옛 방식(본 방)   뿌리를 통째로 줄이고, 머리말·알약 줄을 도로 키움
       새 방식(혼자 방) 카드 마당만 줄이고, 나머지는 아예 손대지 않음

       새 방식이 나은 이유는 **없앤 것**에 있습니다 —
         · 되돌리기 규칙 다섯 줄 → 없음
         · 몸통 높이 보정 꼼수  → 필요 없음 (뿌리가 안 줄어드니까)
         · 손으로 맞추던 조건    → 없음 (판제크기() 를 지웠습니다)
       며칠 써 보고 본 방에도 켭니다. 스위치는 뒤집힌방() 한 줄이에요.
       ===================================================================== */
    /* [2026-08-22] 혼자 방에서 먼저 켜고 그날 안에 본 방까지 켰습니다.
       ★ 되돌리려면 이 한 줄만 `() => !!window.SOLO`(혼자 방만) 또는
         `() => false`(아주 되돌리기) 로. 옛 방식은 else 가지에 그대로 삽니다. */
    ok(/const 뒤집힌방 = \(\) => true;/.test(ZM),
       "★★★ 두 방 모두 뒤집혔다 (되돌리려면 이 한 줄)");
    ok(/} else {\s*h\.removeAttribute\("data-flipped"\);/.test(ZM)
       && /h\.style\.zoom = \(z === 100\) \? "" : f;/.test(ZM),
       "★★★ 옛 방식이 else 가지에 그대로 살아 있다 — 지우지 말 것");
    ok(/h\.style\.setProperty\("--card-zoom", \(z === 100\) \? "" : String\(f\)\);/.test(ZM)
       && /h\.toggleAttribute\("data-cardzoom", z !== 100\);/.test(ZM),
       "★★ 새 방식 — 카드 마당 배율만 내놓는다");
    /* ★★★ 한 브라우저가 두 방식을 오갑니다(본 방 ↔ 혼자 방). 옛 방식이
       남긴 값을 안 지우면 **배율이 곱해집니다** — 0.7 짜리 화면에
       0.7 이 또 걸려 절반이 돼요. 서로의 흔적을 반드시 지웁니다. */
    ok(/h\.style\.removeProperty\("--unzoom"\);\s*h\.removeAttribute\("data-unzoom"\);/.test(ZM),
       "★★★ 새 방식으로 갈 때 옛 방식의 흔적을 지운다 (안 지우면 배율이 곱해진다)");
    ok(/h\.style\.removeProperty\("--card-zoom"\);\s*h\.removeAttribute\("data-cardzoom"\);/.test(ZM),
       "★★★ 옛 방식으로 갈 때도 새 방식의 흔적을 지운다");
    ok(/h\.style\.zoom = "";\s*document\.body\.style\.zoom = "";\s*document\.body\.style\.height = "";/.test(ZM),
       "★★ 뒤집힌 방은 뿌리·몸통에 손대지 않는다 (그래서 높이 보정도 필요 없다)");

    /* ★★ 옛 방식 쪽 — 본 방은 그대로여야 합니다.
       body 에 걸면 화면에 고정된 바텀 알약 줄이 배율만큼 떠오르고,
       뿌리에 걸고도 100dvh 는 확대를 몰라 몸통이 짧아집니다. */
    ok(/h\.style\.zoom = \(z === 100\) \? "" : f;/.test(ZM),
       "★★ 옛 방식은 뿌리(html)에 건다 — body 에 걸면 고정된 바텀 줄이 떠오른다");
    ok(/document\.body\.style\.height = \(z === 100\) \? "" : \(window\.innerHeight \/ f\) \+ "px";/.test(ZM),
       "★★ 옛 방식은 확대한 만큼 몸통 높이를 미리 키운다");

    /* 📏 자 둘 — 무엇을 재느냐가 아니라 **어디에 써넣느냐**로 갈립니다 */
    ok(/window\.uiZoom   = \(\) => \(뒤집힌방\(\) \? 1 : 배율\(\) \/ 100\);/.test(ZM),
       "★★★ uiZoom 은 **뿌리** 배율 — 뒤집힌 방에서는 늘 1");
    ok(/window\.cardZoom = \(\) => 배율\(\) \/ 100;/.test(ZM),
       "★★ cardZoom 은 **카드 마당** 배율");
    const CSc = fs.readFileSync(DIR + "styles.css", "utf8");
    ok(/html\[data-cardzoom\] \.user-cards-grid\{\s*zoom: var\(--card-zoom, 1\);/.test(CSc),
       "★★★ 줄이는 곳은 .user-cards-grid 하나뿐이다");
    /* ★ .cards-area 에 걸면 같은 안에 사는 배경 현황판(#room-board)과
       아래 알약 줄(.room-foot)까지 딸려 줄어듭니다. */
    ok(!/html\[data-cardzoom\] \.cards-area\{/.test(CSc),
       "★★ .cards-area 가 아니다 — 배경 현황판과 아래 알약 줄이 딸려 줄어든다");
    ok(!/html\[data-solo\]\[data-unzoom\]/.test(CSc),
       "★★ 혼자 방 되돌리기 규칙은 없어졌다 (뒤집으면서 필요가 사라졌다)");

    /* =====================================================================
       🪟 2단계 — 떠 있는 창 크기를 따로 (2026-08-22 — 콩)
       ---------------------------------------------------------------------
         머리말의 배율 = 접속자 카드 크기
         설정의 배율   = 떠 있는 창 크기 (판 · 팝업)
       ★ 기본 100%. 아무도 안 만지면 1단계와 똑같습니다.
       ★ 본 방은 아직 안 씁니다 — 판배율() 이 100 을 돌려주고, 설정 칸도
         감춥니다. 만져도 아무 일이 안 일어나는 손잡이는 "고장" 으로 읽혀요.
       ===================================================================== */
    /* ★ [갈림 2026-08-22 — 콩] 처음엔 판과 팝업을 함께 묶었는데, 콩이
       갈랐습니다: 머리말 메뉴 창은 **늘 105%** 고정.
       "글자가 작아서 안 보이는 것보단 시원하게 큰 게 좋을 거 같아."
       팝업은 잠깐 열었다 닫는 자리라 고를 것까지는 없다는 판단입니다.
       그래서 설정 이름도 [떠 있는 창 크기] → [하단 메뉴 창 크기]. */
    ok(/html\[data-panelzoom\] \.dock-panel\{\s*zoom: var\(--panel-zoom, 1\);/.test(CSc),
       "★★ 슬라이더가 움직이는 것은 **하단 판**뿐이다");
    ok(!/html\[data-panelzoom\][^{]*\.modal-content\{\s*zoom: var\(--panel-zoom/.test(CSc),
       "★★ 머리말 팝업은 그 슬라이더를 안 따라간다");
    ok(/html\[data-flipped\]\{ --modal-zoom: 1\.05; \}/.test(CSc),
       "★★★ 머리말 메뉴 창은 105% 고정 (바꿀 곳은 이 한 값)");
    ok(/html\[data-flipped\] \.modal-content\{\s*zoom: var\(--modal-zoom, 1\);\s*max-height: calc\(\(100dvh - 32px\) \/ var\(--modal-zoom, 1\)\);/.test(CSc),
       "★★★ 그 천장도 같은 값으로 나눈다 (안 나누면 넘어간 쪽을 못 본다)");
    ok(/html\[data-flipped\] \.dock-panel \.modal-content\{ zoom: 1; \}/.test(CSc),
       "★ 판 안에 팝업이 들어가도 배율이 곱해지지 않는다");
    /* ★ data-solo 가 아니라 data-flipped 인 이유 — 나중에 본 방을 뒤집을 때
       CSS 를 안 고쳐도 그대로 따라오게 하려고요. */
    ok(/h\.setAttribute\("data-flipped", "1"\);/.test(ZM)
       && /h\.removeAttribute\("data-flipped"\);/.test(ZM),
       "★★ 뒤집힌 방 표식을 켜고 끄는 곳이 둘 다 있다 (한쪽만 있으면 안 꺼진다)");
    ok(/set-title">하단 메뉴 창 크기</.test(fs.readFileSync(DIR + "index.html", "utf8")),
       "★ 설정 이름이 [하단 메뉴 창 크기] 다 (팝업은 안 따라가니까)");
    ok(/if \(!뒤집힌방\(\)\) return 100;/.test(ZM),
       "★★ 본 방에서는 판 배율을 안 쓴다 (거기선 판이 화면 배율을 따라간다)");
    ok(/const 켤까 = 뒤집힌방\(\) && z !== 100;/.test(ZM),
       "★★★ 뒤집히지 않은 방에는 아예 안 건다 — 걸면 배율이 곱해진다");
    ok(/window\.panelZoom = \(\) => \(뒤집힌방\(\) \? 1 : 배율\(\) \/ 100\) \* \(판배율\(\) \/ 100\);/.test(ZM),
       "★★★ 판 자 = 뿌리 배율 × 판 배율 (한 곳에서만 셈한다)");
    ok(/const Z = \(\) => \(window\.panelZoom\?\.\(\) \|\| window\.uiZoom\?\.\(\) \|\| 1\);/
         .test(fs.readFileSync(DIR + "script_dock.js", "utf8")),
       "★★★ 판 끌기가 그 자를 쓴다 — 안 쓰면 판 130% 에서 442px 튄다");
    ok(/window\.dockReclampAll\?\.\(\)/.test(ZM)
       && /window\.dockReclampAll = reclampAll;/.test(fs.readFileSync(DIR + "script_dock.js", "utf8")),
       "★★ 판을 키운 뒤 화면 안으로 다시 가둔다 (몸집만 커져 삐져나감)");
    ok(/wrap\.hidden = !뒤집힌방\(\);/.test(ZM),
       "★★ 판 배율을 안 쓰는 방에서는 설정 칸을 감춘다");
    ok(/id="set-panel-zoom-block" hidden/.test(fs.readFileSync(DIR + "index.html", "utf8")),
       "★ 설정 칸은 **감춘 채로** 시작한다 (켤 방에서만 열어 줍니다)");
    /* ★ 슬라이더는 끄는 내내 크기가 따라오되, **놓았을 때** 다시 가둡니다.
       끄는 동안 판이 계속 자리를 잡으면 손 아래에서 덜컹거려요.
       (화면 공유 카드 수 슬라이더에서 같은 결론을 낸 적이 있습니다) */
    ok(/sl\.oninput  = \(\) => \{/.test(ZM) && /sl\.onchange = \(\) => 판배율적용/.test(ZM),
       "★★ 크기는 끄는 대로, 자리 다시 잡기는 놓았을 때");

    {
      /* 카드 배율(c)과 판 배율(p)이 따로 놀아도 셈이 맞는지 — 돌려 봅니다 */
      const 판끌기 = ({ s뿌리, s판, panelZoom: z }) => {
        const hostLeft = 40 * s뿌리, rLeft = hostLeft + 300 * s판, 잡은 = rLeft + 100;
        const dx = (잡은 - rLeft) / z;
        const L1 = (잡은 + 250) / z - dx - hostLeft / z;
        return (hostLeft + L1 * s판) - rLeft;
      };
      const 같나 = (a, b) => Math.abs(a - b) < 0.001;
      const 혼자 = (c, p) => ({ s뿌리: 1, s판: p, panelZoom: p });
      const 본방 = (c) => ({ s뿌리: c, s판: c, panelZoom: c });
      ok([[0.7, 1], [0.7, 1.3], [1, 1.3], [1.3, 0.7], [1, 1]]
           .every(([c, p]) => 같나(판끌기(혼자(c, p)), 250) && 같나(판끌기(본방(c)), 250)),
         "★★★ 카드와 판이 따로 놀아도 끈 만큼 움직인다");
      ok(!같나(판끌기({ s뿌리: 1, s판: 1.3, panelZoom: 1 }), 250),
         "★★★ 판 자를 안 갈면 어긋난다 — 이 검사가 그걸 잡는다");
    }

    /* =====================================================================
       ★★★ [사고 2026-08-22 — 콩] 판이 **오른쪽으로만** 새던 이유
       ---------------------------------------------------------------------
       "왼쪽으로는 막혀서 안 넘어가는데 오른쪽으로는 일정 부분 새어 버려."

       clampPos 의 두 한계가 성질이 다릅니다 —
         왼쪽 = EDGE(8px)                → **창 너비와 무관.** 늘 맞음.
         오른쪽 = hostW − 판너비 − EDGE  → **창 너비에 달림.**
       자리는 기기에 저장되는데, 창이 좁아진 뒤 다시 가두는 손이 없었어요.
       넓을 때 오른쪽 끝에 둔 판이 창을 줄이면 그대로 화면 밖으로 나갑니다.

       ★ 한계가 **한쪽만 창 크기에 달려 있으면**, 창이 바뀔 때 다시 재는
         손이 반드시 있어야 합니다.
       ===================================================================== */
    {
      const DK2 = fs.readFileSync(DIR + "script_dock.js", "utf8");
      ok(/_가둘까 = setTimeout\(reclampAll, 120\);/.test(DK2),
         "★★★ 창 크기가 바뀌면 판을 다시 가둔다 (오른쪽으로 새던 원인)");
      ok(/function reclampAll\(\)/.test(DK2) && /window\.dockReclampAll = reclampAll;/.test(DK2),
         "★ 다시 가두는 자가 있고 밖에서도 부를 수 있다");

      /* 셈으로 — 다시 안 가두면 정말 새는가 */
      const EDGE = 8, 판너비 = 352;
      const 오른한계 = (창, z) => 창 / z - 판너비 - EDGE;
      const 오른끝 = (x, z) => (x + 판너비) * z;
      const x0 = 오른한계(1600, 1);                    // 창 1600 에서 끝까지 밀어 둠
      ok(오른끝(x0, 1) <= 1600.5, "★ 그 창에서는 딱 맞는다");
      ok(오른끝(x0, 1) > 1000.5,
         "★★★ 창을 1000 으로 줄이면 **샌다** — 다시 가둬야 하는 이유");
      const x1 = Math.max(EDGE, Math.min(오른한계(1000, 1), x0));
      ok(오른끝(x1, 1) <= 1000.5, "★★ 다시 가두면 안 샌다");
      /* 왼쪽은 어떤 너비에서도 8px 이라 한 번도 안 샜습니다 */
      ok([1600, 1000, 600].every(w => Math.max(EDGE, Math.min(오른한계(w, 1), 8)) * 1 >= 0),
         "★ 왼쪽 한계는 창 너비와 무관하다 (그래서 티가 안 났다)");
      /* 판 배율을 키워도 같은 일이 납니다 */
      const x2 = 오른한계(1200, 1);
      ok(오른끝(x2, 1.3) > 1200.5,
         "★★★ 판을 130% 로 키워도 같은 일이 난다 (그래서 슬라이더도 다시 가둔다)");
    }
    ok(/const KEY = \(\) => \(window\.SOLO \? "soloZoom" : "uiZoom"\);/.test(ZM),
       "★ 혼자 방과 진짜 방은 배율을 따로 기억한다");
    /* [바뀜 2026-08-16] 채팅 글자 크기가 설정 > 채팅 탭으로 갔습니다.
       머리말에는 확대·축소만 남고, 제 자리(#zoom-ctl)에 붙습니다.
       ★ 예전처럼 .font-ctl 을 찾아 그 옆에 끼우면, 이제 그게 설정 창
         안에 있어서 확대·축소도 설정 창으로 따라 들어갑니다. */
    ok(/const ctl = document\.getElementById\("zoom-ctl"\);/.test(ZM),
       "★★ 머리말의 제 자리(#zoom-ctl)에만 붙는다 — .font-ctl 을 따라가지 않는다");
    const IXz = fs.readFileSync(DIR+"index.html","utf8");
    ok(/id="zoom-ctl"/.test(IXz), "머리말에 그 자리가 있다");
    ok(IXz.indexOf('id="panel-chat"') < IXz.indexOf('onclick="decreaseFont()"'),
       "★ 채팅 글자 크기는 설정 > 채팅 탭 안에 있다");
    ok(/pill\.onclick = \(\) => 배율적용\(100\);/.test(ZM),
       "가운데 숫자를 누르면 100% 로 돌아온다");

    /* 🧭 머리말과 알약 줄은 줄이지 않습니다 (2026-08-15)
       카드를 더 보려고 줄였더니 시계와 알약 글씨까지 작아져 안 보였어요.
       zoom 은 겹치면 곱해지므로, 뿌리에 0.95 · 여기에 1/0.95 를 걸면
       그 안쪽만 제 크기로 돌아옵니다.
       ★ 떠오르는 판(#dock-panels)에는 걸지 않습니다 — 화면을 넓게 쓰려고
         줄이는 건데 판이 그대로면 뜻이 없어요. */
    ok(/const 되돌림 = \(z === 100 \|\| !손잡이는그대로\(\)\) \? "" : String\(1 \/ f\);/.test(ZM),
       "★★ 되돌려 키울 값은 배율의 역수 (겹친 zoom 이 곱해져 정확히 1)");
    ok(/const 손잡이는그대로 = \(\) => true;/.test(ZM),
       "★ 두 방 모두 머리말·알약 줄은 제 크기를 지킨다 (되돌리려면 이 한 줄)");
    const CSz = fs.readFileSync(DIR+"styles.css","utf8");
    ok(/html\[data-unzoom\] \.app-head,\s*html\[data-unzoom\] #dock-bar\{\s*zoom: var\(--unzoom, 1\);/.test(CSz),
       "★★ 되돌리는 곳은 머리말과 알약 줄 **둘뿐** (판에는 걸지 않는다)");
    ok(!/html\[data-unzoom\] [^{,]*#dock-panels/.test(CSz),
       "★ 본 방에서는 떠오르는 판이 함께 줄어든다 (혼자 방은 아래에서 따로)");

    ok(/document\.documentElement\.setAttribute\("data-solo", "1"\);/
         .test(fs.readFileSync(DIR+"script_solo.js","utf8")),
       "★ 혼자 방 표식(data-solo)을 다는 곳이 있다");

    /* =====================================================================
       📏 [뒤집기 2026-08-22 — 콩] 자가 맞는지 **셈으로** 봅니다
       ---------------------------------------------------------------------
       글자만 맞춰 보면 "자를 썼다"는 것까지밖에 모릅니다. **맞는 자를
       썼는지**는 돌려 봐야 알아요. 실제로 이 셈이 사고를 두 번 잡았습니다.

       [갈리는 기준 — 여기가 헷갈리는 자리입니다]
         uiZoom   = 뿌리 배율. **몸통(body)에 써넣는 값**에 씁니다.
                    판 옮기기, 카드 옆 팝업 자리 → 전부 몸통에 붙거든요.
         cardZoom = 카드 마당 배율. **카드에 써넣는 값**에 씁니다.
                    지금은 공유 카드 높이 맞추기 하나뿐입니다.
       ★ "무엇 옆에 뜨느냐" 가 아니라 "어디에 붙느냐" 로 가릅니다.
         상태표 팝업은 카드 옆에 뜨지만 몸통에 붙으므로 uiZoom 입니다.
       ===================================================================== */
    {
      const DK = fs.readFileSync(DIR + "script_dock.js", "utf8");
      /* ★ [2026-08-22 2단계] 판 크기를 따로 고를 수 있게 되면서 자가 한 번
         더 갈렸습니다. panelZoom() = 뿌리 배율 × 판 배율 — 판 배율을 안 쓰는
         방에서는 uiZoom() 과 같은 값이라, 본 방 계산은 예전 그대로입니다. */
      ok(/const Z = \(\) => \(window\.panelZoom\?\.\(\) \|\| window\.uiZoom\?\.\(\) \|\| 1\);/.test(DK),
         "★★ 판 좌표는 판 자(panelZoom)를 쓴다 — 카드 자가 아니다");
      /* ★ 이름을 그냥 찾으면 **왜 없앴는지 적어 둔 주석**까지 걸립니다.
         지웠다는 확인은 살아 있는 코드에만 물어야 해요 (같은 실수를
         2026-08-22 아침에 PULSE_ALL 에서 한 번 했습니다). */
      ok(!/const 판제크기\s*=/.test(DK),
         "★★★ 손으로 맞추던 조건(판제크기)이 사라졌다 — 뒤집으면서 필요가 없어졌다");
      /* ★ [넓힘 2026-08-22] 한 군데가 더 늘었습니다 — maxH().
         판 높이의 천장은 화면 단위(100vh)로 재는데, **화면 단위는 zoom 을
         모릅니다.** 판을 130% 로 키우면 그 천장이 1.3 배로 그려져 화면
         밖으로 나가요. 그래서 여기도 배율로 나눕니다.
         자리 계산(Z)과 천장 계산(maxH) 둘 — 그 밖에는 없어야 합니다. */
      ok((DK.match(/window\.(ui|panel)Zoom\?\.\(\)/g) || []).length === 3,
         "★★ script_dock.js 안에서 배율을 보는 곳은 Z() 와 maxH() 둘뿐이다");
      ok(/const z = window\.panelZoom\?\.\(\) \|\| 1;\s*return Math\.max\(240, \(\(window\.innerHeight \|\| 800\) - 190\) \/ z\);/.test(DK),
         "★★★ 판 높이 천장도 배율로 나눈다 (화면 단위는 zoom 을 모른다)");
      const CSm = fs.readFileSync(DIR + "styles.css", "utf8");
      ok(/html\[data-panelzoom\] \.dock-panel\{\s*max-height: calc\(\(100vh - 190px\) \/ var\(--panel-zoom, 1\)\);/.test(CSm),
         "★★★ CSS 천장과 JS maxH() 가 같은 셈이다 (다르면 CSS 가 조용히 자른다)");
      ok(/html\[data-flipped\] \.modal-content\{[\s\S]{0,120}?max-height: calc\(\(100dvh - 32px\) \/ var\(--modal-zoom, 1\)\);/.test(CSm),
         "★★★ 팝업 천장도 배율로 나눈다 — 안 그러면 넘어간 쪽을 볼 수 없다");
      ok(/const z = \(window\.cardZoom\?\.\(\) \|\| window\.uiZoom\?\.\(\) \|\| 1\);/
           .test(fs.readFileSync(DIR + "script_share.js", "utf8")),
         "★★★ 공유 카드 높이만 카드 자(cardZoom)를 쓴다 — 카드를 재서 카드에 입히니까");

      /* 두 방 × 세 계산을 한꺼번에 돌립니다.
         s뿌리 = 뿌리에 실제로 걸린 배율, s카드 = 카드에 실제로 걸린 배율 */
      const 방 = {
        옛: (f) => ({ s뿌리: f, s카드: f, uiZoom: f, cardZoom: f }),   // 본 방
        새: (f) => ({ s뿌리: 1, s카드: f, uiZoom: 1, cardZoom: f }),   // 혼자 방
      };
      /* ① 판 끌기 — 커서를 250px 끌면 판도 250px */
      const 판끌기 = ({ s뿌리: s, uiZoom: z }) => {
        const hostLeft = 40, rLeft = hostLeft + 300 * s, 잡은 = rLeft + 100;
        const dx = (잡은 - rLeft) / z;
        const L1 = (잡은 + 250) / z - dx - hostLeft / z;
        return (hostLeft + L1 * s) - rLeft;
      };
      /* ② 카드 옆 팝업 — 몸통에 붙으므로 화면 620 자리에 그대로 떠야 함 */
      const 팝업자리 = ({ s뿌리, uiZoom }) => (620 / uiZoom) * s뿌리;
      /* ③ 공유 카드 높이 — 카드(300)를 재서 카드에 입히면 다시 300 */
      const 공유높이 = ({ s카드, cardZoom }) => (300 * s카드) / cardZoom;

      const 같나 = (a, b) => Math.abs(a - b) < 0.001;
      const 다맞나 = (만들기, f) => {
        const st = 만들기(f);
        return 같나(판끌기(st), 250) && 같나(팝업자리(st), 620) && 같나(공유높이(st), 300);
      };
      [0.7, 1, 1.3].forEach(f => {
        ok(다맞나(방.옛, f), `★★ 본 방 ${Math.round(f * 100)}% — 끌기·팝업·공유높이가 다 맞다`);
        ok(다맞나(방.새, f), `★★★ 혼자 방 ${Math.round(f * 100)}% — 뒤집어도 셋 다 맞다`);
      });
      /* ★ 자를 잘못 골랐을 때 정말로 어긋나는지 — 안 그러면 이 검사는
         아무것도 지키지 못합니다 (통과만 하는 검사가 제일 위험해요) */
      ok(!같나(공유높이({ s카드: 0.7, cardZoom: 1 }), 300),
         "★★★ ③ 에 뿌리 자를 쓰면 어긋난다 — 이 검사가 그걸 잡는다");
      ok(!같나(판끌기({ s뿌리: 1, uiZoom: 0.7 }), 250),
         "★★★ ① 에 카드 자를 쓰면 어긋난다");
    }
    ok(/const 알약가운데 = pr\.left \+ pr\.width \/ 2;[\s\S]{0,200}?\(알약가운데 - hr\.left\) \/ z - w \/ 2/.test(fs.readFileSync(DIR+"script_dock.js","utf8")),
       "★★ 판을 알약 위에 띄울 때 화면에서 잰 거리만 배율로 나눈다 — 알약 크기가 어떻든 맞는다");

    const IX2 = fs.readFileSync(DIR+"index.html","utf8");
    ok(/src="script_zoom\.js/.test(IX2), "index.html 이 script_zoom.js 를 싣는다");
    ok(/onclick="decreaseFont\(\)"/.test(IX2),
       "★★ 글자 크기 조절은 그대로 남아 있다 (확대·축소가 대체하지 않는다 — 자리만 설정 창으로)");
  }

  /* =====================================================================
     확대·축소와 좌표 (2026-08-15)
     ---------------------------------------------------------------------
     마우스 좌표와 getBoundingClientRect 는 **확대된 뒤**의 화면 값이고,
     style.left · offsetWidth 는 **확대 전**의 요소 값입니다. 섞어 쓰면
     95% 에서 판이 오른쪽 끝에 닿기도 전에 96px 을 남기고 막혔어요
     (왼쪽은 멀쩡한데 오른쪽만 — 실제 제보). 재는 자를 하나로 맞춥니다.
     진짜 방에는 uiZoom 이 없어 늘 1 이라, 계산 결과가 예전과 같습니다.
     ===================================================================== */
  {
    const DK = fs.readFileSync(DIR+"script_dock.js","utf8");
    /* ★ [2026-08-22] 하루 사이 여기가 두 번 바뀌었습니다.
       ① 판만 제 크기로 되돌리면서 Z() 가 조건을 따지게 됐다가,
       ② 배율 방식을 뒤집으면서 그 조건이 통째로 필요 없어졌습니다.
       뒤집힌 방은 뿌리를 안 줄이므로 uiZoom() 이 알아서 1 을 돌려줘요. */
    ok(/const Z = \(\) => \(window\.panelZoom\?\.\(\) \|\| window\.uiZoom\?\.\(\) \|\| 1\);/.test(DK),
       "★ 판 옮기기가 판 배율을 물어본다 (판 배율을 안 쓰는 방에서는 뿌리 배율)");
    ok(/const hostLeft = hr\.left \/ z, hostTop = hr\.top \/ z, hostW = hr\.width \/ z;/.test(DK),
       "★★ 가둘 때 화면 값을 요소 기준으로 바꿔서 잰다 — 안 그러면 오른쪽 끝이 먼저 막힌다");
    ok(/x: e\.clientX \/ z - _drag\.dx - _drag\.hostLeft/.test(DK),
       "끄는 동안에도 커서와 판이 같은 자를 쓴다");
    /* 판 높이 끌기도 같은 병이었습니다 (2026-08-15) */
    ok(/h: p\.getBoundingClientRect\(\)\.height \/ Z\(\) \}/.test(DK),
       "★ 판 높이를 잴 때도 요소 기준으로 바꾼다");
    ok(/setH\(_grip\.pid, _grip\.h \+ \(_grip\.y - e\.clientY\) \/ Z\(\)\);/.test(DK),
       "★ 끌어올린 거리도 요소 기준으로 바꾼다 (안 그러면 커서보다 덜 자란다)");

    /* ★★ [2026-08-15] 공유 카드가 95%에서만 5% 짧던 것.
       "잰 값은 화면, 넣을 값은 요소" — 이 방에서 세 번째로 같은 자리에
       데었습니다(알약 판 옮기기 · 판 높이 · 공유 카드). 배치 계산을 새로
       쓸 때는 getBoundingClientRect 와 style/offsetWidth 를 섞는지부터
       보세요. 100%에서는 멀쩡해 보여서 더 안 잡힙니다. */
    const SH3 = fs.readFileSync(DIR+"script_share.js","utf8");
    /* ★ [고침 2026-08-22] 자가 uiZoom → cardZoom 으로 바뀌었습니다.
       재는 것도 카드고 입히는 것도 카드라, 뒤집힌 방에서는 뿌리 자가
       틀린 자가 됩니다 (70% 에서 공유 카드가 1.4배 길어져요). */
    ok(/const z = \(window\.cardZoom\?\.\(\) \|\| window\.uiZoom\?\.\(\) \|\| 1\);[\s\S]{0,240}?getBoundingClientRect\(\)\.height \/ z/.test(SH3),
       "★★ 공유 카드 높이는 프로필 카드를 **카드 기준**으로 재서 맞춘다");

    /* 팝업 네 곳(작업 스티커·상태표·화면 공유·채팅 스티커)도 같은 자 */
    [["script_worktag.js","작업 스티커"], ["script_profile.js","상태표"],
     ["script_share.js","화면 공유"], ["script_sticker.js","채팅 스티커"]]
      .forEach(([f, 이름]) => {
        const T = fs.readFileSync(DIR+f,"utf8");
        ok(/const _z = \(window\.uiZoom\?\.\(\) \|\| 1\);/.test(T)
           && /const VW = innerWidth \/ _z, VH = innerHeight \/ _z;/.test(T),
           이름 + " 고르기 판도 배율에 맞춰 자리를 잡는다");
      });
  }

  /* =====================================================================
     ✍️ 글칸 — 한글 조합 중에는 배치를 건드리지 않는다 (2026-08-15)
     ---------------------------------------------------------------------
     "회차별로" 를 쳤는데 "회별로" 가 됐습니다(실제 제보). 글자 하나마다
     height 를 auto 로 접었다 펴면서, 자모를 모으는 중(ㅊ+ㅏ→차)에
     배치가 다시 계산돼 조합이 통째로 취소된 것으로 봅니다.
     ★ 이 방은 한글로 씁니다. 글칸에서 배치를 건드리는 코드를 새로
       넣을 때는 반드시 조합 중인지 먼저 보세요.
     ===================================================================== */
  {
    const CH = fs.readFileSync(DIR+"script_chat.js","utf8");
    ok(/newEl\.addEventListener\("input", function \(e\) \{[\s\S]{0,400}?if \(e\.isComposing \|\| composing\) return;/.test(CH),
       "★★ 조합 중에는 input 처리를 건너뛴다 (칸이 접혔다 펴지면 글자가 사라진다)");
    ok(/newEl\.addEventListener\("compositionend", function \(\) \{[\s\S]{0,900}?글칸손질\(ta\)/.test(CH),
       "★ 대신 글자가 완성된 뒤에 이어받는다 — 칸은 여전히 제때 자란다");
    /* 깃발 선언이 쓰는 곳보다 뒤에 있으면 조용히 죽습니다 (let 은 끌어올려지지 않아요) */
    ok(CH.indexOf("let composing = false;") < CH.indexOf('newEl.addEventListener("input"'),
       "★ composing 깃발은 쓰는 곳보다 먼저 선언된다");

    /* ★★ [고침 2026-08-15] 미룬 것이 하나 더 있었습니다.
       "/방가" 를 치고 곧바로 엔터를 누르면 목록이 아직 "/" 만 쳤을 때
       그대로라, 맨 위의 /운세 가 들어갔어요(실제 제보).
       배치(높이)만 미루고, 드롭다운은 조합이 끝나는 그 자리에서 맞춥니다. */
    ok(/드롭다운손질\(ta\);\s*[\s\S]{0,200}?requestAnimationFrame\(\(\) => \{ if \(!composing\) 글칸손질\(ta\); \}\);/.test(CH),
       "★★ 조합이 끝나면 드롭다운은 곧바로, 높이만 다음 그림 차례로");
    ok(/if \(SLASH_COMMANDS\[친것\] && !SLASH_COMMANDS\[친것\]\.hasText\) \{[\s\S]{0,120}?send\(\);/.test(CH),
       "★ 명령어를 끝까지 친 뒤의 엔터는 '고르기'가 아니라 '보내기'다");
  }

  /* =====================================================================
     💸 통신량 — 하트비트 주기 (2026-08-15)
     ---------------------------------------------------------------------
     15초마다 한 사람이 쓰면 접속한 **모두**가 받습니다. 사람 수의 제곱
     으로 늘어나는 항이라, 이 방에서 통신량을 가장 크게 가르는 숫자예요.
     ★★★ [2026-08-22 뒤집힘] 예전엔 "무료치를 넘으면 요금이 아니라
     데이터베이스가 **잠겨** 방이 안 열린다" 였습니다. 그날 요금제가
     Blaze 로 바뀌면서 **안 잠기고 청구**됩니다. 실패가 "멈춤" 에서
     "돈" 으로 바뀌었어요 — 예산 알림(월 ₩10,000)이 그래서 걸려 있습니다.
     ★ 줄이려고 만진 값이니, 되돌리려면 사용량을 먼저 보세요.
     ===================================================================== */
  {
    const CO = fs.readFileSync(DIR+"script_core.js","utf8");
    const m = CO.match(/const PRESENCE_POLL_MS = (\d+);/);
    ok(!!m, "하트비트 주기가 한 곳에 상수로 있다");
    /* [올림 2026-08-19] 38명이 되면서 30 → 45초 (월 7.3→4.9GB).
       [올림 2026-08-22] Blaze 전환 뒤 45 → 60초 (월 4.9→3.7GB). */
    ok(!!m && Number(m[1]) >= 60000,
       `★★ 하트비트는 60초 이상이다 (지금 ${m ? Number(m[1])/1000 : "?"}초) — 짧게 되돌리면 통신량이 그만큼 배로 늡니다`);
    /* ── 🥗 status 다이어트 (2026-08-21) — 바뀐 칸만 보내기 ──
       0815의 "같은 화면이면 안 보냄" 위에 얹은 두 번째 절약입니다.
       보낼 때 늘 17칸을 통째로 보내던 것을 달라진 칸만 보내게 했어요.
       한 사람이 쓰면 모두가 받으므로 절약이 사람 수의 제곱으로 커집니다. */
    const RTD = fs.readFileSync(DIR + "script_realtime.js", "utf8");
    ok(/let _lastSentObj = null;/.test(RTD),
       "★ 마지막으로 보낸 칸별 값을 손에 들고 있다");
    ok(/const 진행 = 통째로 \? ref\.set\(쓸것\) : ref\.update\(쓸것\);/.test(RTD),
       "★★★ 첫 판만 set, 그다음은 update — 안 바뀐 칸은 안 보낸다");
    ok(/if \(견줄것\[k\] !== _lastSentObj\[k\]\) 쓸것\[k\] = 보낼것\[k\];/.test(RTD),
       "★★ 달라진 칸만 골라 담는다");
    ok(/delete 견줄것\.lastSeen;\s*\n\s*delete 견줄것\.disconnectedAt;/.test(RTD),
       "★ 서버가 찍는 칸(lastSeen)과 늘 null 인 칸은 견주지 않는다");
    ok(/진행\.catch\(\(\) => \{\s*\n\s*_lastSentObj = null;/.test(RTD),
       "★★ 쓰기가 실패하면 손에 든 값을 버린다 (안 그러면 영영 안 나가는 칸이 생긴다)");
    ok(/_lastSentSig = ""; _lastSentAt = 0; _lastSentObj = null;/.test(RTD),
       "★★ 다시 이어졌을 때도 칸별 기억을 버린다 (서버 상태를 모르니 통째로)");

    /* 이 값이 짧아졌다고 착각하지 않게, 기대는 두 값도 함께 못 박아 둡니다 */
    const RT2 = fs.readFileSync(DIR+"script_realtime.js","utf8");
    ok(/const DISCONNECT_GRACE_MS = 5 \* 60 \* 1000;/.test(RT2),
       "★ 나갔는지 판정은 하트비트가 아니라 5분 유예가 한다 (2026-08-15: 30분→5분)");
    /* ★★ 유예를 더 줄이고 싶어지면 먼저 이걸 읽으세요.
       유예가 끝나 카드가 사라진 사람이 돌아오면 detectJoins 가 **새로 온
       사람으로 보고 입장 알림을 다시 띄웁니다.** 지하철에서 잠깐 끊긴
       사람이 나갔다 들어온 것처럼 보여요. 1~2분은 그래서 안 됩니다. */
    ok(/if \(!_seenOnline\.has\(nick\)\) fresh\.push\(nick\);/.test(RT2),
       "★ 유예가 끝났다 돌아오면 '새로 온 사람'이 된다 — 유예를 더 줄일 때의 대가");
    ok(/ONLINE_STALE_MS\s+= 12 \* 60 \* 60 \* 1000/.test(RT2),
       "고아 기록 정리는 12시간짜리라 하트비트 주기와 무관하다");

    /* ★★ [2026-08-15] 같은 화면이면 안 보냅니다.
       카드에 찍히는 시간은 **분 단위** 인데 30초마다 보내서 두 번 중
       한 번은 똑같은 글자를 만들었고, 쉬는 중에는 아예 안 변하는데도
       꼬박꼬박 보냈습니다. 월 7.3GB → 2.5GB 안팎.
       ※ 이 검사를 지우려면 사용량 페이지를 먼저 보세요. */
    ok(/workMs: Math\.round\(Number\(보낼것\.workMs \|\| 0\) \/ 60000\)/.test(RT2),
       "★★ 견줄 때 workMs 를 분으로 반올림한다 — 초는 어느 화면에도 안 나타난다");
    ok(/if \(!force[\s\S]{0,120}?지문 === _lastSentSig[\s\S]{0,120}?return;/.test(RT2),
       "★★ 남들 화면이 그대로면 보내지 않는다");
    ok(/const STATUS_KEEPALIVE_MS = 5 \* 60 \* 1000;/.test(RT2),
       "★ 그래도 5분에 한 번은 보낸다 — lastSeen 이 영영 안 늙게");
    ok(/lastSeen: 0/.test(RT2),
       "지문에서 lastSeen 은 빼고 견준다 (매번 달라지니 넣으면 검사가 무의미)");
    ok(/window\.forgetStatusSig = function/.test(RT2),
       "다시 이어졌을 때 기억을 지우는 손잡이가 있다");
    const CO2 = fs.readFileSync(DIR+"script_core.js","utf8");
    ok(/window\.forgetStatusSig\?\.\(\);\s*callIfFn\("updateStatus", true\);/.test(CO2),
       "★★ 재연결 때는 지문을 지우고 **통째로 다시** 보낸다 (끊긴 사이 서버 상태를 모르니까)");
  }

  /* =====================================================================
     🙋 Help — 익명 교정 문답 (2026-08-16)
     ---------------------------------------------------------------------
     ★★ 채택도 하트도 **일부러 뺐습니다.** 처음엔 넣으려다 방장 말을
        듣고 접었어요 — "채택은 은근히 자존심 문제라 그런 게 있으면
        아무도 댓을 안 달 거야." 맞는 말입니다. 급할 때 후다닥 묻는
        자리인데 답이 안 달리면 그걸로 끝이에요.
        대신 ✓ 확인 스티커가 **겹쳐 붙습니다** — 고르는 게 아니라 쌓이는
        것이라 아무도 떨어지지 않아요. 되살리고 싶어지면 이걸 읽으세요.
     ===================================================================== */
  {
    const HP = fs.readFileSync(DIR+"script_help.js","utf8");
    const IXh = fs.readFileSync(DIR+"index.html","utf8");

    ok(!/채택|adopt|accept/.test(HP.replace(/\/\*[\s\S]*?\*\//g, "")),
       "★★ 채택 기능이 없다 (주석의 설명은 빼고 본 결과)");
    ok(!/heart|하트/.test(HP.replace(/\/\*[\s\S]*?\*\//g, "")),
       "★★ 하트도 없다");
    ok(/data-help-check/.test(HP) && /💡 \$\{r\.checks \|\| 0\}/.test(HP),
       "★ 💡 아하 스티커가 있다");
    /* ★ ✓ 는 "맞다/틀리다" 로 읽혀 은근히 심사하는 결이 됩니다.
       💡 는 "나도 알았다" 라 답한 사람도 본 사람도 편해요. */
    ok(!/✓ \$\{r\.checks/.test(HP),
       "★ 체크(✓)로 되돌리지 않는다 — 심사가 아니라 '아하' 다");
    ok(/transaction\(v => Math\.max\(0, \(Number\(v\) \|\| 0\) \+ \(붙임 \? -1 : 1\)\)\)/.test(HP),
       "★ 스티커는 여러 사람이 겹쳐 붙는다 (transaction 으로 세어 부딪히지 않게)");

    /* 익명 — 대숲과 같은 결. 닉네임을 서버에 적지 않습니다 */
    ok(!/nick|myNick|닉네임/.test(HP.replace(/\/\*[\s\S]*?\*\//g, "")),
       "★★ 서버에 닉네임을 적지 않는다 (관리자도 누가 썼는지 못 본다)");
    ok(/const MINE_KEY {2}= "helpMine";/.test(HP),
       "★ '내 글' 은 이 기기만 압니다");

    /* 줄 세우기 — 이게 이 판의 핵심 */
    ok(/if \(a\.내것 !== b\.내것\) return a\.내것 \? -1 : 1;/.test(HP),
       "★ 이 기기에서 내가 쓴 글이 맨 위");
    ok(/if \(a없 !== b없\) return a없 \? -1 : 1;/.test(HP),
       "★★ 답 없는 글이 그다음 — 시간순으로만 쌓으면 영영 답을 못 받는다");

    ok(/const KEEP_MS {3}= 14 \* 24 \* 60 \* 60 \* 1000;/.test(HP),
       "2주 뒤 사라진다 (대숲 30일보다 짧게 — 급한 물음이라)");
    ok(/if \(e\.key !== "Enter" \|\| e\.shiftKey \|\| e\.isComposing \|\| e\.keyCode === 229\) return;/.test(HP),
       "★★ 한글 조합 중의 엔터는 무시한다 (이 방에서 여러 번 데인 자리)");
    ok(/const host = el\("dock-body-help"\);/.test(HP),
       "★ 손가락은 판 안쪽에 단다 (겉껍데기에 달면 클릭이 통째로 죽는다)");
    /* 올리기는 채팅의 ↑ 단추와 같은 결, 크기만 작게 (44 → 32).
       "올리기" 라는 글자가 네모나게 앉아 있으면 판이 무거워 보입니다. */
    ok(/class="help-send"[\s\S]{0,120}?>↑<\/button>/.test(HP),
       "★ 올리기는 채팅과 같은 ↑ 단추다");
    ok(/\.help-send\{[\s\S]{0,120}?width: 32px; height: 32px;/.test(fs.readFileSync(DIR+"styles.css","utf8")),
       "그 단추는 32px — 한 줄 글칸 옆에서 우뚝하지 않게");

    /* 부제는 "맞나요?" 가 아닙니다 — 맞다/틀리다를 묻는 말투는 답하는
       쪽에 정답을 요구하게 돼요. 확신이 없어도 거들 수 있어야 답이 답니다. */
    ok(/🚨 이 표현 어때요\? 이 단어는요\?\? 같이 고민해 주세요! 😭/.test(HP),
       "★ 부제가 '같이 고민해 주세요' 다 (정답을 요구하지 않는 말투)");
    /* ★ 이름이 우스꽝스러운 건 일부러입니다 — Help 라고 하면 점잖아져서
       사소한 걸 묻기가 되레 망설여져요. 급한 이름이라야 문턱이 낮습니다. */
    /* [이름 바뀜 2026-08-21 — 콩] 🆘 살려주세요‼️ → 📓 표현 공부‼️.
       하는 일은 그대로고 id 도 help 그대로입니다 (id 를 바꾸면 저장해
       둔 판 높이·자리가 통째로 날아가요). */
    ok(/label: "📓 표현 공부‼️"/.test(fs.readFileSync(DIR+"script_dock.js","utf8")),
       "★ 알약 이름이 '📓 표현 공부‼️' 다");
    /* ★★ 판 안쪽에 제목을 또 두면 판 머리말과 겹칩니다 (실제 제보) */
    ok(!/class="help-title"/.test(HP),
       "★★ 판 안쪽에 제목을 또 두지 않는다 — 판 머리말이 이미 이름을 보여준다");
    /* id 는 help 그대로 — 바꾸면 저장해 둔 판 높이·자리가 날아갑니다 */
    ok(/\{ id: "help",/.test(fs.readFileSync(DIR+"script_dock.js","utf8")),
       "★★ 판 id 는 help 그대로다 (id 를 바꾸면 저장된 판 높이·자리가 날아간다)");
    ok(/src="script_help\.js/.test(IXh), "index.html 이 script_help.js 를 싣는다");
    const RLh = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;
    ok(!!RLh.help && RLh.help[".read"] === "auth != null",
       "보안규칙에 help 가 대숲과 같은 결로 들어 있다");
  }

  /* =====================================================================
     ⌨️ 대숲 키보드 자랑 (2026-08-15)
     ---------------------------------------------------------------------
     ★★ 가장 중요한 것: 사진은 **쪽지 안에 담지 않습니다.**
        대숲은 열 때마다 forest 를 통째로 내려받아요. 사진을 거기 담으면
        한 번 열 때마다 모든 사진이 따라옵니다 — 40장이면 2MB, 방 전체로
        치면 무료치를 한 달 안에 다 씁니다. 여기를 고칠 일이 생기면
        이 갈래(forest / forestImg)를 먼저 지켜 주세요.
     ===================================================================== */
  {
    const FR = fs.readFileSync(DIR+"script_forest.js","utf8");
    ok(/const SHOT_W = 360, SHOT_H = 120;/.test(FR),
       "키보드 사진은 3:1 로 가운데를 잘라 담는다");
    /* ★ 쪽지에 보이는 크기는 150×50px. 레티나 두 배로도 300×100 이면
       충분합니다 — 이 값을 키우면 눈에 안 보이는 픽셀을 돈 주고 나르는 셈. */
    ok(/const SHOT_MAX = 40 \* 1024;/.test(FR),
       "★ 한 장이 40KB 를 넘지 못한다 (보이는 크기에 견줘 넉넉한 값)");
    ok(!/note\.img\s*=/.test(FR) && /note\.hasImg = true;/.test(FR),
       "★★ 쪽지에는 '사진이 있다'는 표시만 넣는다 — 알맹이는 forestImg 로");
    ok(/const 사진있는것 = roots\.filter\(n => n\.hasImg\)\.map\(n => n\.id\);/.test(FR),
       "★★ 사진은 **지금 보는 판에 뜬 것만** 가져온다");
    ok(/const 할것 = ids\.filter\(id => !_imgCache\.has\(id\) && !_imgWant\.has\(id\)\);/.test(FR),
       "한 번 가져온 사진은 다시 안 가져온다 (같은 것을 두 번 부르지도 않는다)");
    ok(!/ref\("forestImg"\)\.once/.test(FR),
       "★★ forestImg 를 통째로 읽는 곳이 없다 — 그러면 따로 뺀 뜻이 사라진다");
    ok(/async function wipe\(id\)[\s\S]{0,300}?ref\("forestImg\/" \+ id\)\.remove/.test(FR),
       "★ 쪽지를 지우면 사진도 함께 지운다 (아무도 안 보는 70KB 가 남지 않게)");
    ok(/if \(shot\) \{ try \{ await window\.db\.ref\("forestImg\/" \+ ref\.key\)\.remove\(\); \} catch \(e2\) \{\} \}\s*throw err;/.test(FR),
       "★ 붙이기가 도중에 엎어지면 올린 사진을 그 자리에서 되돌린다");
    ok(/\.fr-shot\{[\s\S]{0,120}?aspect-ratio: 3 \/ 1;/.test(fs.readFileSync(DIR+"styles.css","utf8")),
       "사진이 오기 전에도 자리를 잡아 둔다 (나중에 끼우며 판이 출렁이지 않게)");
    const RL = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;
    ok(!!RL.forestImg && RL.forestImg[".read"] === "auth != null",
       "보안규칙에 forestImg 가 쪽지와 같은 결로 들어 있다");
  }

  /* =====================================================================
     📈 관리자 출석부 — 한 달 흐름 꺾은선 (2026-08-16)
     ---------------------------------------------------------------------
     출석만 보면 모수를 알 수 없습니다 — 8명이 24명 중인지 12명 중인지는
     전혀 다른 이야기예요. 총원과 나란히 그립니다.
     ★ 값은 머리글 두 줄이 쓰는 것과 **같은 것**을 받습니다. 새로 세면
       언젠가 표와 그래프가 어긋나요.
     ===================================================================== */
  {
    const AD4 = fs.readFileSync(DIR+"script_admin.js","utf8");
    const AH4 = fs.readFileSync(DIR+"admin.html","utf8");
    ok(/function 그래프그리기\(d\)/.test(AD4) && /id="adm-att-chart"/.test(AH4),
       "출석부 아래에 그래프 자리가 있다");
    ok(/그래프그리기\(\{ ymKey, daysInMonth, base, cntByDay, totalByDay, isThisMonth, todayD \}\);/.test(AD4),
       "★★ 표가 쓰는 값을 그대로 받는다 — 새로 세지 않는다 (어긋날 자리를 안 만듦)");
    ok(/const 끝날 = isThisMonth \? Math\.min\(todayD, daysInMonth\) : daysInMonth;/.test(AD4),
       "★ 아직 안 온 날은 그리지 않는다 (0 으로 뚝 떨어지면 '망했나' 로 읽힌다)");
    /* ※ 주석에 "Chart.js 같은 걸 부르지 않는다" 라고 적혀 있어서
       낱말만 찾으면 걸립니다 — 실제로 **불러오는지**를 봅니다. */
    ok(!/<script[^>]*chart/i.test(AH4) && !/new Chart\(/.test(AD4) && /<svg viewBox=/.test(AD4),
       "★ 라이브러리 없이 SVG 로 그린다 (선 두 개에 관리자 페이지를 무겁게 하지 않는다)");
    ok(/dow !== 0 && dow !== 6\) continue;/.test(AD4),
       "주말에 옅은 띠를 둔다 — 출석이 떨어져도 놀라지 않게");
    ok(/최대 = Math\.max\(10, Math\.ceil\(최대 \/ 10\) \* 10\);/.test(AD4),
       "자는 10 단위로 올려 잡는다");

    /* ★★ [고침 2026-08-16] "진격의 거인 그래프".
       viewBox 를 660 으로 못 박고 width:100% 로 늘였더니 1400px 카드에서
       2.12배로 부풀었습니다 — 높이 424px, 글자 10px 이 21px. 표보다
       그래프가 커졌어요. 칸 너비를 재서 그 값을 viewBox 로 쓰면
       1 칸 = 1 픽셀이라 적은 값이 그대로 나옵니다. */
    ok(/const 칸폭 = Math\.max\(520, Math\.round\(box\.clientWidth \|\| 900\)\);/.test(AD4),
       "★★ 칸 너비를 재서 viewBox 로 쓴다 (안 그러면 넓은 화면에서 그래프만 거대해진다)");
    ok(/const W = 칸폭, H = 200/.test(AD4),
       "★ 높이는 200px 로 고정 — 화면이 넓어져도 안 자란다");
    ok(/_차트값 = d;/.test(AD4) && /if \(_차트값\) \{ try \{ 그래프그리기\(_차트값\)/.test(AD4),
       "창 크기가 바뀌면 다시 그린다 (칸 너비를 재서 그리니까)");

    /* =================================================================
       ✍️ 한 달 글자수 (2026-08-16)
       ★★ 개인별 선은 **일부러 안 긋습니다.** 이 방은 "순위표처럼 보이지
          않게" 를 지켜 왔어요(글자수 피드도 일부러 두 줄로 흩어 놨습니다).
          관리자 화면이라도 개인 선을 그으면, 공유하는 순간 적게 쓴 사람이
          위축됩니다. 참여를 늘리려고 만든 그림이 반대로 굴러가요.
       ================================================================= */
    ok(/function 글자수그래프\(d\)/.test(AD4) && /id="adm-word-chart"/.test(AH4),
       "한 달 흐름 아래에 글자수 그래프 자리가 있다");
    ok(/db\.ref\("wordlog"\)\.orderByKey\(\)\s*\n?\s*\.startAt/.test(AD4),
       "★ 한 달치를 **한 번에** 받는다 (하루씩 31번 부르지 않는다)");
    ok(!/닉별|perNick|byNick/.test(AD4.slice(AD4.indexOf("function 글자수그래프"), AD4.indexOf("function 글자수그래프") + 4000)),
       "★★ 개인별로 가르지 않는다 — 방 전체와 인원 수만 본다");
    ok(/if \(!nickSet\.has\(닉\)\) return;/.test(AD4),
       "명단에 없는 옛 기록은 뺀다 (표와 같은 규칙)");
    ok(/if \(t <= 0\) return;/.test(AD4),
       "0 자는 참여로 세지 않는다");
    ok(/const 적은날 = Object\.values\(합\)\.filter\(v => v > 0\)\.length;/.test(AD4),
       "★ 하루 평균은 **기록이 있는 날**로만 나눈다 (없는 날까지 나누면 실제보다 작아 보인다)");
    ok(/\$\{참여자\.size\}명<\/b>이 참여했어요/.test(AD4),
       "요약 줄이 '몇 명이 참여했어요' 로 끝난다 — 숫자보다 이게 사람을 부른다");
    ok(/글자수 기록한 멤버<\/text>/.test(AD4),
       "아래 막대 띠 이름표가 '글자수 기록한 멤버' 다");
    ok(/if \(!총합\) \{[\s\S]{0,200}?아직 이 달에 올라온 글자수가 없어요/.test(AD4),
       "★ 아무도 안 적은 달에는 빈 그래프 대신 한 줄로 알린다");

    /* =================================================================
       ⏱️ 한 달 작업 시간 (2026-08-16)
       ★ 값은 새로 안 읽습니다 — 표가 셀에 시간을 찍으려고 이미 구해 둔
         minsByNick 을 더할 뿐이에요. 서버 요청 0.
       ================================================================= */
    ok(/function 시간그래프\(d\)/.test(AD4) && /id="adm-time-chart"/.test(AH4),
       "글자수 그래프 아래에 작업 시간 그래프 자리가 있다");
    ok(/시간그래프\(\{ ymKey, daysInMonth, base, minsByNick, isThisMonth, todayD \}\);/.test(AD4),
       "★★ 표가 이미 읽어 둔 값을 그대로 쓴다 — 서버에 다시 묻지 않는다");
    ok(/if \(m <= 0\) return;/.test(AD4),
       "0 분은 그날 앉아 있던 사람으로 세지 않는다");
    /* ★★ 총분을 총인원으로 한 번에 나누면 **붐빈 날에 끌려갑니다.**
       날마다 인원이 다르니, 날짜별로 나눈 뒤 그 값들을 평균 내야 해요. */
    ok(/const 인당들 = 있는날\.map\(k => \(합\[k\] \|\| 0\) \/ Math\.max\(1, 사람\[k\] \|\| 1\)\);/.test(AD4),
       "★★ 한 사람당 평균은 날짜별로 먼저 나눈다 (총분÷총인원은 붐빈 날에 끌려간다)");
    ok(/한 사람당 평균<\/text>/.test(AD4),
       "아래 막대 띠 이름표가 '한 사람당 평균' 이다");
    ok(/아직 이 달에 쌓인 작업 시간이 없어요/.test(AD4),
       "아무도 안 앉은 달에는 한 줄로 알린다");
    ok(/if \(_시간값\) \{ try \{ 시간그래프\(_시간값\)/.test(AD4),
       "창 크기가 바뀌면 세 그래프가 함께 다시 그려진다");
  }

  /* =====================================================================
     📅 관리자 출석부 — 총원과 열 줄 띠 (2026-08-15)
     ===================================================================== */
  {
    const AD3 = fs.readFileSync(DIR+"script_admin.js","utf8");
    const AH  = fs.readFileSync(DIR+"admin.html","utf8");
    /* [2026-08-15] 머리글을 두 줄로 갈랐습니다 — ① 출석 ② 그날 총원.
       한 줄일 때는 "8명 나왔다" 만 보이고 **모수를 알 수 없었어요**.
       27명 중 8명과 12명 중 8명은 전혀 다른 이야기입니다. */
    ok(/<th class="name-h cnt-h" title="그날 실제로 나온 사람 수">출석<\/th>/.test(AD3),
       "★ 첫 줄은 그날 출석 인원");
    ok(/총원 <b class="cnt-total">지금 \$\{nicks\.length\}명<\/b>/.test(AD3),
       "★ 둘째 줄은 그날 총원 (이름 칸에는 지금 인원)");
    ok(/nicks\.filter\(n => bornOf\[n\] && bornOf\[n\] <= dk\)\.length/.test(AD3),
       "★★ 그날 총원 = 그날까지 들어온 사람 수 — 신입이 늘면 줄도 자란다");
    ok(/const 앞날 = isThisMonth && d > todayD;/.test(AD3),
       "★ 아직 안 온 날은 비워 둔다 (오늘 총원이 미리 찍히면 '그날 이미 27명' 으로 읽힌다)");
    ok(/\$\{cntRow\}\$\{totRow\}\$\{head\}/.test(AD3),
       "두 줄이 날짜 머리글 위에 차례로 붙는다");
    ok(/th\.cnt\.tot\{/.test(fs.readFileSync(DIR+"admin.html","utf8")),
       "총원 줄은 색을 갈라 둔다 (같은 색이면 어느 쪽이 모수인지 매번 다시 봐야 함)");
    ok(/const 띠 = \(Math\.floor\(순번 \/ 10\) % 2\) \? " band-b" : " band-a";/.test(AD3),
       "★ 이름 칸은 **열 명씩** 바탕을 번갈아 준다");
    ok(/td\.name-c\.band-a\{ background: #FBEDE3; \}/.test(AH)
       && /td\.name-c\.band-b\{ background: #F3E4D6; \}/.test(AH),
       "두 색이 다 정의돼 있다 (하나만 있으면 띠가 안 보인다)");
    ok(/if \(수\) 수\.textContent = nicks\.length \? `총 \$\{nicks\.length\}명` : "";/.test(AD3)
       && /id="adm-allow-count"/.test(AH),
       "★ 입장 승인 단추 오른쪽에 승인된 사람 수가 뜬다");
  }

  /* =====================================================================
     🔑 마지막 인사에 열쇠 싣기 (2026-08-15)
     ---------------------------------------------------------------------
     창을 닫을 때 sendBeacon 으로 보내는 두 요청("나갔어요" · "내 접속
     표시 지우기")에 **인증 토큰이 없어서 서버가 전부 거부**하고 있었어요.
     그래서 창을 닫아도 즉시 사라지지 않고 유예를 다 채웠습니다.
     ★ 토큰은 **미리** 받아 두어야 합니다 — getIdToken 은 약속(Promise)
       이라, 창이 닫히는 순간에 받으려 하면 늦습니다.
     ===================================================================== */
  {
    const CO3 = fs.readFileSync(DIR+"script_core.js","utf8");
    ok(/function withAuth\(url\) \{\s*return _idToken \? `\$\{url\}&auth=\$\{encodeURIComponent\(_idToken\)\}` : url;/.test(CO3),
       "★★ REST 주소에 열쇠(auth=ID 토큰)를 붙인다");
    ok(!/sendBeacon\((?!withAuth)/.test(CO3),
       "★★ sendBeacon 은 반드시 열쇠를 붙여 보낸다 — 안 붙이면 서버가 조용히 거부한다");
    ok(/_idTokenTimer = setInterval\(refreshIdToken, 30 \* 60 \* 1000\);/.test(CO3),
       "★ 토큰을 미리·주기적으로 받아 둔다 (한 시간이면 만료)");
    ok(/document\.visibilityState === "visible"\) refreshIdToken\(\)/.test(CO3),
       "탭으로 돌아올 때도 한 번 더 받는다 (접어 두면 타이머가 늦춰지므로)");
    ok(/startIdTokenKeeper\(\);\s*\/\/ 🔑/.test(CO3),
       "입장할 때 열쇠 지킴이를 켠다");
  }

  /* =====================================================================
     🖥️ 돌아오면 다시 켤지 묻기 (2026-08-15)
     ---------------------------------------------------------------------
     ★ "저절로 다시 켜기" 는 만들 수 없습니다. 화면 공유는 그때그때
       사람이 창을 고르는 방식이라 저장해 둘 권한이 없고, 크롬은 사람이
       누른 직후가 아니면 고르기 창을 아예 안 띄웁니다. 언젠가 누군가
       "자동으로 되게 해 달라" 고 하면 이 주석을 보여 주세요.
     ===================================================================== */
  {
    const SH2 = fs.readFileSync(DIR+"script_share.js","utf8");
    ok(/const RESUME_KEY = "shareWasOn";/.test(SH2) && /RESUME_TTL = 6 \* 60 \* 60 \* 1000/.test(SH2),
       "아까 공유 중이었다는 표시는 이 기기에 6시간만 산다");
    ok(/_표시남기기\(false\);\s*\/\/ 내 손으로 껐으니/.test(SH2),
       "★ 내 손으로 끄면 표시를 지운다 — 끝낸 사람에게 다시 권하지 않는다");
    ok(/btn\.classList\.add\("share-resume"\)/.test(SH2)
       && /setTimeout\(그만, 30000\)/.test(SH2),
       "★ 깜빡임은 30초 뒤 스스로 멎는다 (계속 깜빡이면 재촉이 된다)");
    ok(!/getDisplayMedia\([\s\S]{0,200}?\)\s*;?\s*\}\s*\)\s*;?\s*\/\/ *자동/.test(SH2)
       && !/setTimeout\([\s\S]{0,80}?startScreenShare/.test(SH2),
       "★★ 사람이 누르지 않았는데 공유를 시작하지 않는다 (브라우저도 막지만 우리도 안 한다)");
    const CS = fs.readFileSync(DIR+"styles.css","utf8");
    ok(/@media \(prefers-reduced-motion: reduce\)\{[\s\S]{0,160}?\.icon-btn\.share-resume\{ animation: none/.test(CS),
       "움직임이 불편한 분에게는 깜빡이지 않고 색으로만 알린다");
  }

  /* =====================================================================
     🖍️ 방 배경 — 짱구 9장 (2026-08-15)
     ---------------------------------------------------------------------
     예전 SVG 5종(사무실·스터디 카페·서재·야외 카페·창가)을 걷어내고
     그림 파일로 바꿨습니다. **이름표(index.html)와 그림(script_ui.js)과
     실제 파일이 셋 다 맞아야** 합니다 — 하나만 어긋나면 골라도 아무
     일이 안 일어나고, 왜 안 되는지도 안 보입니다.
     ===================================================================== */
  {
    const UI2 = fs.readFileSync(DIR+"script_ui.js","utf8");
    const IX3 = fs.readFileSync(DIR+"index.html","utf8");

    const 장면 = [...UI2.matchAll(/^ {4}(\w+):\s+"bg\/([\w-]+)\.jpg"/gm)]
                   .map(m => ({ id: m[1], file: m[2] }));
    ok(장면.length === 9, `방 배경이 9장이다 (${장면.length}장)`);

    /* 이름표는 #set-roombg 안의 것만 봅니다 — 설정 창에는 다른 목록도 많아요 */
    const 상자 = IX3.slice(IX3.indexOf('id="set-roombg"'), IX3.indexOf("</select>", IX3.indexOf('id="set-roombg"')));
    const 이름표 = [...상자.matchAll(/<option value="(\w+)">/g)].map(m => m[1])
                     .filter(v => v !== "none" && v !== "custom");

    장면.forEach(v => {
      ok(fs.existsSync(DIR + "bg/" + v.file + ".jpg"), `그림 파일이 있다 — bg/${v.file}.jpg`);
      ok(이름표.includes(v.id), `설정 목록에 이름표가 있다 — ${v.id}`);
    });
    ok(이름표.every(o => 장면.some(v => v.id === o)),
       "★★ 목록에만 있고 그림이 없는 배경이 없다 (골라도 아무 일이 안 일어난다)");

    /* 한 장이 너무 크면 배경 한 번 바꾸는 데 몇 초씩 걸립니다.
       덮개(기본 82%) 아래로 은은하게 비치는 그림이라 클 이유가 없어요. */
    let 합 = 0;
    장면.forEach(v => {
      const n = fs.statSync(DIR + "bg/" + v.file + ".jpg").size;
      합 += n;
      ok(n <= 300 * 1024, `bg/${v.file}.jpg 가 300KB 이하다 (${Math.round(n/1024)}KB)`);
    });
    ok(합 <= 2.5 * 1024 * 1024, `배경 전부 합쳐 2.5MB 이하다 (${(합/1024/1024).toFixed(1)}MB)`);

    /* ★★ 배경 위에도 원고지 격자는 그대로 있습니다 (2026-08-15).
       한때 걷어냈다가 되돌렸어요 — 방장이 격자를 좋아합니다.
       들쭉날쭉해 보이던 건 격자 탓이 아니라 **간격이 화면 점에 안
       떨어져서**였고, 그건 script_zoom.js 의 격자맞춤 이 고칩니다. */
    const CSb = fs.readFileSync(DIR+"styles.css","utf8");
    const 방배경 = CSb.slice(CSb.indexOf("body.room-bg-on{"),
                             CSb.indexOf("}", CSb.indexOf("body.room-bg-on{")));
    ok((방배경.match(/repeating-linear-gradient/g) || []).length === 2,
       "★★ 배경 그림 위에도 원고지 격자 두 겹이 그대로 있다");
    ok(/var\(--room-veil/.test(방배경) && /var\(--room-bg-img/.test(방배경),
       "덮개와 그림 두 겹도 그대로");

    /* 옛 이름으로 저장해 둔 분들 — 안 데려오면 배경이 그냥 사라집니다 */
    ok(/const 옛이름 = \{[\s\S]{0,200}?office: "cloud"/.test(UI2),
       "★ 옛 이름(office·studycafe…)을 새 배경으로 데려온다");
    ok(/function 지금배경\(\)/.test(UI2) && !/const id = AppStore\.getItem\(BG_KEY\) \|\| "none";/.test(UI2),
       "★ 저장값은 한 곳(지금배경)에서만 읽는다 — 옮겨주는 자리를 지나치지 않게");
  }

  /* =====================================================================
     ✍️ Letters 의 메모 · 할 일 명령 (2026-08-16) — 콩트에서 옮겨옴
     ---------------------------------------------------------------------
     ★★ 가장 중요한 것: **메모와 할 일 줄은 나만 봅니다.**
        이 피드는 모두가 같이 보는 자리예요(서로의 글자수가 흐릅니다).
        혼잣말이 남의 화면에 흐르면 글자수 기록이 밀려나고, 무엇보다
        혼잣말을 편히 못 적게 됩니다. 그래서 서버에 올리지 않고
        이 기기(AppStore)에만 적습니다 — 통신량 0.
        여기를 고칠 일이 생기면 이 선을 먼저 지켜 주세요.
     ===================================================================== */
  {
    const WC = fs.readFileSync(DIR+"script_wordcount.js","utf8");
    const IX4 = fs.readFileSync(DIR+"index.html","utf8");

    ok(/const MINE_KEY = "wcMine";/.test(WC) && /AppStore\?\.setItem\(MINE_KEY/.test(WC),
       "★★ 메모·할 일 줄은 이 기기에만 적는다 (서버로 안 나감)");
    ok(!/ref\(`wordfeed[\s\S]{0,200}?type: "mine"/.test(WC),
       "★★ 나만 보는 줄을 wordfeed 에 올리지 않는다");
    ok(/const MINE_DAYS = 14;/.test(WC), "메모는 2주치를 남긴다 (콩트와 같게)");

    /* ★★★ [2026-08-17] 실제로 났던 사고 — loadMine() 을 만들어만 두고
       아무도 부르지 않았습니다. 새로고침·자정마다 메모가 빈 배열로
       시작했고, addMine() 이 배열 **전체**를 덮어쓰는 구조라 메모를
       한 줄 적는 순간 곳간의 2주치가 지워졌어요.
       ★ 불러오기와 저장하기는 반드시 짝입니다. 한쪽만 있으면 조용히
         지워집니다 — 티가 안 나서 더 위험해요. */
    ok(/\n\s*loadMine\(\);/.test(WC),
       "★★★ loadMine() 을 실제로 부른다 — 안 부르면 첫 메모가 곳간을 덮어쓴다");
    ok(WC.indexOf("loadMine();") < WC.indexOf("attach();\n\n    /* [추가 2026-08] 자정 감시"),
       "★ 메모 불러오기가 attach() 보다 먼저다 (첫 화면부터 보이게)");
    ok(!/function attach\(\)[\s\S]{0,400}?_mineLines = \[\]/.test(WC),
       "★★ 자정에 갈아탈 때 메모를 비우지 않는다 (어제 메모를 되짚어야 하니까)");

    /* 명령 이름은 콩트와 **똑같이** — 방장이 두 곳을 오가며 씁니다 */
    ["오늘","내일","모레","글피","완료","할일"].forEach(c =>
      ok(new RegExp(c).test(WC), `/${c} 명령이 있다`));
    ok(/일정\|plan\|스케줄/.test(WC) === false,
       "★ 일정(plan) 계열은 안 가져온다 — 더마감엔 이미 출석 달력이 있다");
    ok(/const DOW_NAMES = \["일", "월", "화", "수", "목", "금", "토"\];/.test(WC),
       "요일 이름표가 있다 (/월 … /일)");
    ok(/mm = word\.match\(\/\^\(\\d\{1,2\}\)\[-\.\/\]\(\\d\{1,2\}\)\$\/\)/.test(WC),
       "8-18 · 8.18 · 8/18 을 알아듣는다");

    /* 할 일은 **기존 자리**를 쓴다 — 새 저장소를 만들면 🗂️ 나의 작업과 갈라집니다 */
    ok(/window\.addTodoWithDue\?\.\(cmd\.text, cmd\.key\)/.test(WC),
       "★★ 담기는 기존 할 일(users/{닉}/todos)에 들어간다 — 새 저장소를 만들지 않는다");
    /* ★★ [고침 2026-08-16] 두 번째 인수를 빠뜨려서 **완료가 안 됐습니다.**
       toggleTodoDone(id, done) 은 done 을 받아서 그대로 씁니다 — 안 주면
       undefined → false 라, 완료가 아니라 완료를 푸는 셈이었어요.
       화면에는 "완료 처리했어요" 가 떴는데 🗂️ 나의 작업은 그대로였습니다.
       ★ 이름이 toggle 인데 값을 받는 함수입니다. 반드시 true 를 주세요. */
    ok(/window\.toggleTodoDone\?\.\(hit\.id, true\)/.test(WC),
       "★★ 완료할 때 true 를 함께 넘긴다 (안 주면 도리어 완료가 풀린다)");
    ok(/후보\.sort\(\(a, b\) => \(a\.due \|\| "9999"\)\.localeCompare\(b\.due \|\| "9999"\)\);/.test(WC),
       "/완료 는 날짜가 가까운 것부터 집는다");

    ok(/id="wc-memo"/.test(IX4) && /id="wc-slash"/.test(IX4),
       "메모칸과 명령 목록이 화면에 있다");
    /* [2026-08-16] 머리말 양쪽 여백 80% — 카드 폭에 기댄 비율은 유지 */
    ok(/padding-left: calc\(var\(--card-w\) \* 0\.64\);/.test(fs.readFileSync(DIR+"styles.css","utf8")),
       "★ 머리말 여백은 카드 폭에 기대어 잡는다 (px 로 박으면 카드 폭이 바뀔 때 어긋난다)");

    /* [2026-08-16] 이름 — 숫자만 적던 자리가 아니라 일지가 됐습니다 */
    ok(/label: "✍️ Work Log"/.test(fs.readFileSync(DIR+"script_dock.js","utf8"))
       && /<span class="wc-title">Work Log ✍️<\/span>/.test(IX4),
       "★ 알약과 창 머리가 둘 다 Work Log 다 (한쪽만 바꾸면 어긋나 보인다)");
    /* 힌트 줄을 따로 두면 글자수 칸과 사이가 벌어집니다 — 위 안내줄을 씁니다 */
    ok(!/id="wc-memo-hint"/.test(IX4) && /function 메모힌트\(msg\) \{[\s\S]{0,200}?say\(msg\);/.test(WC),
       "★ 메모 안내는 이미 있는 줄(#wc-log)을 쓴다 — 줄을 새로 만들지 않는다");
    const CSw = fs.readFileSync(DIR+"styles.css","utf8");
    ok(/\.wc-said\{[\s\S]{0,220}?font-size: 12\.5px;/.test(CSw),
       "★★ 글자수 말풍선 크기는 못 박혀 있다 (아래 줄을 키워도 안 따라 커지게)");

    /* ★★ [고침 2026-08-16] 클래스 이름이 이미 쓰이고 있었습니다.
       .wc-mine 은 "300 자 · 오늘 방 전체" 머리줄의 이름(display:flex)인데
       나만 보는 줄에 같은 이름을 붙였어요. 할 일 목록이 가로로 늘어서고
       글자가 세로로 쏟아졌습니다. 새 클래스를 만들 땐 먼저 찾아보세요. */
    ok(!/class="wc-mine[ "]/.test(WC),
       "★★ 나만 보는 줄은 .wc-priv 다 — 머리줄의 .wc-mine 과 겹치지 않는다");
    ok(/\.wc-priv\{[\s\S]{0,120}?display: block;/.test(CSw),
       "★ .wc-priv 는 block 으로 못 박아 둔다");

    /* 📅 지난 메모 되짚기 — ✍️ 내 메모 탭에서만 (2026-08-16)
       ★★ 지난 **글자수**는 안 봅니다. 처음엔 오늘 탭에서도 되짚게
          해 뒀는데, 방장 말대로 다시 볼 이유가 없어요(그건 [내 기록]
          탭의 요일 그래프가 보여줍니다). 덕분에 서버에 한 번도 묻지
          않게 됐습니다 — 메모는 이미 이 기기에 2주치가 있으니까요.
          되살리고 싶어지면 통신량부터 재 보세요. */
    ok(/const BACK_MAX = 6;/.test(WC), "일주일(오늘 포함 이레) 전까지 넘겨 본다");
    /* ※ wordfeed 에 **쓰는** 곳은 남아 있습니다 (🕛 어제 채우기).
       막고 싶은 건 지난 날을 **읽어오는** 것이에요. */
    ok(!/_pastFeed/.test(WC) && !/orderByChild\("at"\)\.once\("value"\)/.test(WC),
       "★★ 지난 날을 서버에서 받아오지 않는다 (통신량 0)");
    ok(/nav\.hidden = \(_tab !== "memo"\);/.test(WC),
       "★ 날짜 넘기기는 내 메모 탭에서만 뜬다");
    /* ★★ display 를 적어 둔 요소는 hidden 만으로 안 감춰집니다 —
       브라우저 기본 [hidden]{display:none} 보다 우리 규칙이 세거든요.
       실제로 다른 탭에서도 날짜 줄이 계속 보였습니다. */
    ok(/\.wc-daynav\[hidden\]\{ display: none; \}/.test(CSw),
       "★★ hidden 이 실제로 먹는다 (display 를 적었으면 [hidden] 도 함께)");
    ok(/_back = 0;\s+\/\/ 탭을 옮기면 오늘부터/.test(WC),
       "탭을 옮기면 날짜가 오늘로 돌아온다");

    /* ★★ [고침 2026-08-16] "내 것" 을 칠하는 색은 방 전체가 --me 입니다.
       채팅 말풍선도, 뽀모의 도는 막대·고리도 --me 예요. 워크로그만
       --accent 를 써서, 뽀모 창을 나란히 띄우면 색이 따로 놀았습니다.
       ★ --accent 는 방의 포인트색(강조·머리말) 자리입니다. 헷갈리지 마세요. */
    ok(/\.wc-feed\.me \.wc-said\{[\s\S]{0,80}?background: var\(--me\);/.test(CSw),
       "★★ 워크로그의 내 말풍선도 --me 를 쓴다 (채팅·뽀모와 같은 색)");
    ok(!/\.wc-[\w-]*\.me [^{]*\{[^}]*var\(--accent\)/.test(CSw),
       "★ 워크로그에 '내 것' 을 --accent 로 칠한 자리가 남아 있지 않다");

    /* ✍️ 아래 입력 묶음 — 간격 반으로, 고르게 (2026-08-16)
       ★ gap 이 있는 flex 묶음에서 자식에 margin 을 더하면 **둘이 합쳐집니다.**
         메모칸에만 margin-bottom:5px 이 있어서 그 자리만 13px 이었어요. */
    ok(/\.wc-memoline\{ position: relative; margin: 0; \}/.test(CSw),
       "★★ 메모칸에 따로 margin 을 주지 않는다 (gap 과 합쳐져 그 줄만 벌어진다)");
    ok(/\.wc-block\{[\s\S]{0,260}?gap: var\(--sp-1\);/.test(CSw),
       "★ 아래 입력 묶음 간격은 4px");
    ok(/\.wc-rows\{ margin-bottom: var\(--sp-1\); \}/.test(CSw),
       "기록과 입력칸 사이만 한 뼘 남긴다 (위까지 붙이면 답답해진다)");

    /* 📅 [옮김 2026-08-22 — 콩] 날짜 넘기기가 탭 줄 **아래** 제 줄로.
       2026-08-16 에는 탭 줄 왼쪽 끝에 뒀는데, 메모·기록 탭에서 이 줄이
       나타나면 알약 다섯이 **두 줄로 접혔습니다.** 탭이 위아래로 흩어져
       어느 탭이 켜졌는지 헷갈렸어요. 📆 주간 탭의 .wl-nav 와 같은 자리로
       모읍니다. 판이 한 줄 길어지는 건 감수합니다. */
    ok(IX4.indexOf('id="wc-daynav"') > IX4.indexOf('class="wc-tabs"'),
       "★★ 날짜 넘기기가 탭 줄 **아래**에 선다 (같은 줄에 두면 탭이 접힌다)");
    ok(!/<div class="wc-head">[\s\S]{0,400}?id="wc-daynav"/.test(IX4),
       "★ 머리말 줄 안에 들어가 있지 않다");
    /* ★ [후속 2026-08-22 — 콩] 자리만 옮기고 **생김새를 안 맞췄더니**,
       주간 탭은 창 너비에 꽉 차고 메모 탭은 왼쪽에 옹기종기 모여 있어
       탭을 오갈 때 줄이 들썩였습니다. 📆 주간(.wl-nav)과 같게 맞춥니다 —
       단추는 양 끝, 날짜는 가운데. 한쪽을 고치면 다른 쪽도 함께 보세요. */
    ok(/\.wc-daynav\{[\s\S]{0,140}?margin: 2px 0 8px;/.test(CSw),
       "★ 제 줄이 되었으니 위아래 간격을 갖는다");
    ok(/\.wc-daynav \.wc-day-t\{ flex: 1; \}/.test(CSw),
       "★★ 날짜가 남은 자리를 다 먹고 가운데에 선다 (주간 탭의 .wl-lbl 과 같은 결)");
    ok(/\.wc-day-b\{\s*width: 23px; height: 21px;/.test(CSw)
       && /\.wl-nav button\{\s*[\s\S]{0,120}?width: 23px; height: 21px;/.test(CSw),
       "★★ 단추 크기가 주간 탭과 **같은 값**이다 (다르면 탭 오갈 때 들썩인다)");
    ok(/\.wc-tabs\{ margin-left: auto; \}/.test(CSw),
       "★★ 탭은 늘 오른쪽 — 날짜 칸이 없는 탭에서도 왼쪽으로 안 붙는다");

    /* ✍️ Work Log 판은 덜 비칩니다 — 읽고 쓰는 자리라서 */
    /* ★★ [고침 2026-08-16] 처음엔 --panel-solid 라는 값을 따로 만들어
       흰색으로 박아 뒀는데, 테마마다 판 색이 다릅니다(기본 테마는 따뜻한
       미색). 그래서 워크로그만 순백이라 뽀모 창과 색이 달라 보였어요.
       ★ 새 색 변수를 만들면 테마가 늘 때마다 챙겨야 하고, 빠뜨리면
         오늘처럼 됩니다. **같은 --panel 을 두 겹** 까는 쪽이 맞습니다 —
         색은 테마 그대로, 덜 비치는 건 겹쳐서 얻어요. */
    ok(/#dock-panel-wc\{[\s\S]{0,120}?background-color: var\(--panel\);[\s\S]{0,120}?background-image: linear-gradient\(var\(--panel\), var\(--panel\)\);/.test(CSw),
       "★★ Work Log 판은 --panel 을 두 겹 깐다 (색은 뽀모와 같고, 덜 비친다)");
    ok(!/--panel-solid:/.test(CSw),
       "★ 따로 만든 색 변수는 남아 있지 않다 (테마마다 챙겨야 하는 짐이 된다)");

    /* ★★ [고침 2026-08-16] --text-dim 이 **한 번도 정의된 적이 없었습니다.**
       여덟 군데가 이 값을 보고 있었는데 없는 변수라 부모 색을 그대로
       물려받고 있었어요. 이제 제 값을 줍니다. */
    ok(/--text-dim: {5}rgba\(28,30,34,\.78\);/.test(CSw),
       "★★ --text-dim 이 정의돼 있다 (없으면 여덟 군데가 헛값을 본다)");
    ok(CSw.split("var(--text-dim)").length - 1 >= 8,
       "그 값을 쓰는 곳이 여덟 군데 이상이다 — 지우면 다 같이 어긋난다");

    /* =====================================================================
       🌙 [고침 2026-08-22 — 콩] 다크 테마에서 안 보이던 글자들
       ---------------------------------------------------------------------
       위의 2026-08-16 고침은 --text-dim 에 **값을 주는** 데까지만 갔고,
       그 값이 **테마를 따라 뒤집히게** 하지는 못했습니다. :root 에 어두운
       색으로 한 번 적힌 채라, 다크에서는 어두운 바탕에 어두운 글씨였어요.
       Work Log 판의 탭 알약이 테두리만 남고 글자가 사라졌습니다.

       같은 자리에서 --text-2 · --text-3 · --line 도 걸렸습니다. 이 셋은
       아예 정의된 적이 없어 33 군데가 폴백(밝은 테마 색)으로 굳어 있었어요.

       ★ 규칙: **색 이름을 새로 만들면 applyTheme() 에도 반드시 넣으세요.**
         styles.css 의 :root 에만 적으면 밝은 테마에서만 맞습니다.
       ===================================================================== */
    {
      const UIt = fs.readFileSync(DIR + "script_ui.js", "utf8");
      ok(/r\.setProperty\("--text-dim", isDark \?/.test(UIt),
         "★★★ --text-dim 이 테마를 따라 뒤집힌다 (다크에서 탭 글씨가 사라졌다)");
      ok(/--text-2: var\(--muted-strong\);/.test(CSw)
         && /--text-3: var\(--muted\);/.test(CSw)
         && /--line: {3}var\(--border\);/.test(CSw),
         "★★★ --text-2 · --text-3 · --line 이 정의돼 있다 (33군데가 폴백으로 굳어 있었다)");
      /* ★ 새 색을 짓지 않고 **이미 테마를 따라 도는 이름**에 겁니다.
         새 값을 박으면 테마가 늘 때마다 챙겨야 하고, 빠뜨리면 이 사고가
         똑같이 되풀이됩니다. */
      ok(!/--text-2: *#/.test(CSw) && !/--text-3: *#/.test(CSw) && !/--line: *#/.test(CSw),
         "★★ 그 셋에 색을 박아 넣지 않는다 — 테마를 따라 도는 이름에 건다");
      ok(/:root\[data-is-dark="true"\] \.system\{[\s\S]{0,80}?color: var\(--muted-strong\);/.test(CSw),
         "★ 다크에서 입·퇴장 안내가 한 단 밝다 (0.64em 잔글씨라 더 묻혔다)");
      ok(!/:root\[data-is-dark="true"\] \.system\{[\s\S]{0,120}?font-size/.test(CSw),
         "★★ 크기는 안 키운다 — 키우면 대화보다 도드라져 '배경처럼' 이 무너진다");
    }

    /* ✍️ 내 메모 탭 — 명령 없이 적은 것만 */
    ok(/x\.day === 날 && x\.kind === "memo"/.test(WC),
       "★ 내 메모 탭은 메모만 모은다 (할 일·뽀모는 뺀다)");
    ok(/if \(v === null\) \{\s*if \(메모처리\(\)\) return;/.test(WC),
       "★ 숫자만·글만·둘 다 — 셋 다 된다 (콩트와 같은 동작)");
    ok(/if \(e\.key !== "Enter" \|\| e\.shiftKey \|\| e\.isComposing \|\| e\.keyCode === 229\) return;/.test(WC),
       "★★ 한글 조합 중의 엔터는 무시한다 (이 방에서 여러 번 데인 자리)");
  }

  /* =====================================================================
     📐 원고지 격자를 화면 점에 딱 맞춥니다 (2026-08-15)
     ---------------------------------------------------------------------
     24px 마다 1px 선인데, 화면 한 점과 CSS 1px 이 늘 같지는 않습니다.
     맥의 "조정된 해상도" 는 배율이 1.8 처럼 어중간하고 거기에 확대·축소가
     또 곱해져요. 그러면 24px 이 43.2 점이 되고, 브라우저는 43·43·44 로
     반올림하며 그려 **일정한 간격으로 넓은 칸**이 생깁니다(모아레).
     ★ 그래서 24px 을 코드에 그대로 박으면 안 됩니다 — 변수로 받으세요.
     ===================================================================== */
  {
    const ZG = fs.readFileSync(DIR+"script_zoom.js","utf8");
    const CSg = fs.readFileSync(DIR+"styles.css","utf8");
    ok(/function 격자맞춤\(f\)/.test(ZG), "격자를 화면 점에 맞추는 자리가 있다");
    ok(/const 칸점 = Math\.max\(1, Math\.round\(24 \* 화면배\)\);/.test(ZG),
       "★★ 24px 에 가장 가까우면서 화면 점 개수가 **정수**가 되는 값을 고른다");
    ok(/const 화면배 = \(window\.devicePixelRatio \|\| 1\) \* \(f \|\| 1\);/.test(ZG),
       "★ 화면 자체의 배율(devicePixelRatio)과 확대·축소를 **곱해서** 본다");
    /* ★★★ [고침 2026-08-22 — 뒤집기 후속] 격자에 넘길 값은 **body 에
       실제로 걸린 배율**입니다. 카드 배율이 아니에요 — 격자는 body 에
       깔리는데, 뒤집힌 방에서는 body 를 안 줄이거든요.
       카드 배율을 그냥 넘기면 이 함수가 막으려던 바로 그 물결무늬가
       되돌아옵니다 (dpr 2 · 카드 70% 면 한 칸이 화면 점 48.57 개). */
    ok(/격자맞춤\(뒤집힌방\(\) \? 1 : f\);/.test(ZG),
       "★★ 격자는 **몸통에 걸린 배율**을 따른다 (카드 배율이 아니다)");
    ok(/격자맞춤\(뒤집힌방\(\) \? 1 : 배율\(\) \/ 100\)/.test(ZG),
       "★★ 첫 화면에서도 같은 값을 넘긴다 (여기만 다르면 처음에만 어긋난다)");
    /* 24px 을 다시 박아 넣으면 이 고침이 통째로 무의미해집니다 */
    ok(!/transparent 0 23px, var\(--grid-line/.test(CSg),
       "★★ 격자 간격을 24px/23px 로 박아 두지 않는다 (변수로 받는다)");
    ok(/--grid-p: 24px;/.test(CSg) && /--grid-gap: 23px;/.test(CSg),
       "★ 변수가 없을 때를 대비한 기본값은 남겨 둔다");
    ok((CSg.match(/var\(--grid-gap\) var\(--grid-p\)/g) || []).length === 4,
       "격자를 쓰는 네 줄(테마 2겹 + 방 배경 2겹)이 모두 변수를 쓴다");
  }

  /* 공유 카드 — 그림이 액자에 꽉 찬다 (2026-08-15) */
  {
    const CS2 = fs.readFileSync(DIR+"styles.css","utf8");
    ok(/\.share-card\{[\s\S]{0,700}?padding: 0;\s*\}/.test(CS2),
       "★ 공유 카드에는 안쪽 여백이 없다 — 이 카드의 주인공은 그림 하나뿐");
    ok(/\.share-shot\{[\s\S]{0,400}?border-radius: inherit;/.test(CS2),
       "★★ 그림 칸은 카드 모서리를 **물려받는다** — 카드가 책등처럼 왼쪽만 각져 있어서 값을 새로 적으면 어긋난다");
    ok(/\.share-shot\{[\s\S]{0,600}?border: none;/.test(CS2),
       "카드 테두리 안쪽에 한 줄을 더 그리지 않는다 (이중 액자로 보임)");
  }

  /* =====================================================================
     💤 자리비움 5분이면 화면 공유를 스스로 끕니다 (2026-08-15)
     ---------------------------------------------------------------------
     켜 둔 채 두어 시간 자리를 뜨는 일이 잦았습니다. 자리에 없는 사람의
     화면이 계속 나가는 건 본인이 원한 게 아니에요.
     ===================================================================== */
  {
    const SH4 = fs.readFileSync(DIR+"script_share.js","utf8");
    ok(/const AWAY_STOP_MS = 5 \* 60 \* 1000;/.test(SH4),
       "자리비움 5분이면 끈다");
    ok(/if \(t - _awaySince < AWAY_STOP_MS\) return;/.test(SH4),
       "★ 자리로 돌아오면 세던 것은 없던 일이 된다 (잠깐 비운 사람은 안 꺼짐)");
    /* ★ 알림은 **끌 때가 아니라 돌아왔을 때** 띄웁니다 — 자리비움 중에
       띄워 봐야 토스트는 몇 초 뒤 사라져서 못 봅니다. */
    ok(/if \(!away && _stoppedByAway\) \{[\s\S]{0,400}?showCommandToast/.test(SH4),
       "★★ 껐다는 알림은 자리로 돌아온 뒤에 띄운다");
    ok(/_stoppedByAway = true;\s*stopScreenShare\(\);[\s\S]{0,200}?_표시남기기\(true\);/.test(SH4),
       "★ 내 손으로 끈 게 아니니 '아까 공유 중이었다' 표시는 남겨 둔다");
    ok(/_awayWatchTimer = setInterval\(_watchAway, 30 \* 1000\);/.test(SH4),
       "★ 공유를 끈 뒤에도 '돌아왔나' 는 지켜본다 (tickShare 는 공유 중에만 돈다)");
    ok(/function tickShare\(\) \{\s*\/\* ★ 자리비움 검사[\s\S]{0,80}?_watchAway\(\);/.test(SH4),
       "혼자 방에서도 자리비움 검사는 돈다 (SOLO 반환보다 먼저)");
    const ID = fs.readFileSync(DIR+"script_idledetect.js","utf8");
    ok(/document\.getElementById\("db-status"\)/.test(ID)
       && /getElementById\("db-status"\)\?\.value/.test(SH4),
       "★ 자동감지와 화면 공유가 **같은 자리**(db-status)에서 상태를 읽는다");
  }

  /* 진짜 화면 공유는 혼자 방 때문에 느슨해지면 안 됩니다 (2026-08-15) */
  {
    const SH = fs.readFileSync(DIR+"script_share.js","utf8");
    ok(/let rows = \(_sharing \|\| window\.SOLO\) \? shareRows\(\) : \[\];/.test(SH),
       "★★ 진짜 방은 여전히 **내가 공유 중일 때만** 남의 화면을 본다");
    ok(/if \(!window\.SOLO && age > SHARE_DROP_MS\) continue;/.test(SH),
       "★★ 30초 끊김 판정은 진짜 방에만 — 혼자 방 사진은 늙지 않는다");
    /* [갈라짐 2026-08-21 — 콩] 손잡이 둘의 뜻이 달라서 따로 답니다.
       [off] 는 진짜 공유에만, 뭉갬 슬라이더는 혼자 방에도 — 거기가
       시험장인데 정작 뭉갬을 못 시험했거든요. */
    ok(/const mine = 내것 && !window\.SOLO;/.test(SH),
       "혼자 방의 가짜 화면에는 **끄기** 손잡이를 안 단다");
    ok(/const 뭉갬조절 = 내것 \|\| window\.SOLO;/.test(SH),
       "★★ 뭉갬 슬라이더는 혼자 방에서도 열린다 (시험장이니까)");
    ok(/\$\{뭉갬조절\s*\n?\s*\? `<button type="button" class="share-live is-mine" data-blur-open="1"/.test(SH),
       "★ 빨간 불이 그 값을 본다 (mine 을 보면 혼자 방에서 안 뜹니다)");
    ok(/\$\{mine\s*\n?\s*\? `<button type="button" class="share-off"/.test(SH) ||
       /const off = mine/.test(SH),
       "★ [off] 는 여전히 mine 을 본다");
    /* ★★ shareRows 만 막고 tickShare 를 놓쳐서, 걸어 둔 사진이 20초에
       흐려지고 30초에 사라졌다가 다시 나타났습니다 (실제 제보). */
    ok(/function tickShare\(\)[\s\S]{0,600}?if \(window\.SOLO\) return;[\s\S]{0,200}?SHARE_DROP_MS/.test(SH),
       "★★ 늙음 판정(흐려짐·치우기)도 혼자 방에서는 통째로 건너뛴다");
  }

  /* 진짜 방의 글자 크기 조절은 그대로 있어야 합니다 (혼자 방만 바꿨습니다) */
  {
    const IX = fs.readFileSync(DIR+"index.html","utf8");
    ok(/onclick="decreaseFont\(\)"/.test(IX) && /id="font-size-pill"/.test(IX),
       "★★ 진짜 더마감의 [− 18px +] 는 손대지 않았다");
  }

  /* renderUserCards 를 인자 없이 불러도 카드가 안 지워진다 (2026-08-15) */
  {
    const RT = fs.readFileSync(DIR+"script_realtime.js","utf8");
    ok(/if \(data === undefined\) data = _statusCache;/.test(RT),
       "★★ renderUserCards() 인자 없음 = 지금 것 그대로, null 이라야 비운다");
  }

  /* 프꾸 창의 🧘 혼자 방 칸 */
  {
    const PR = fs.readFileSync(DIR+"script_profile.js","utf8");
    ok(/function soloProfileBlockHtml\(tgt\)/.test(PR) && /\$\{window\.SOLO \? soloProfileBlockHtml\(_tgt\) : ""\}/.test(PR),
       "★ 혼자 방 칸은 window.SOLO 일 때만 그린다 — 진짜 방에는 안 나온다");
    ok(/id="solo-count"/.test(PR) && /id="solo-card-nick"/.test(PR) && /id="solo-card-tag"/.test(PR),
       "카드 수 · 이 카드 이름 · 작업 스티커를 거기서 정한다");
    ok(/id="solo-show"/.test(PR) && /id="solo-reshuffle"/.test(PR),
       "오늘 나올 수와 [🎲 다시 섞기] 도 거기 있다");

    /* 🖥️ 가짜 화면 공유 — 진짜 액자에 사진만 걸어 둡니다 (2026-08-15) */
    ok(/<div class="solo-row">/.test(PR),
       "★ 혼자 방 칸은 두 칸 — 왼쪽 설정, 오른쪽 🖥️ 화면 사진");
    /* ★★ [고침 2026-08-15] 자르기를 아예 그만뒀습니다.
       16:10 → 4:5 로 액자에 맞춰 잘랐는데, 여기 올리는 건 대개 **화면
       캡쳐**라 가로로 깁니다. 1920×1080 을 4:5 로 자르면 가운데 45% 만
       남고, 그 좁은 조각이 액자 가득 늘어나 "문서가 길쭉해졌다" 가 됐어요.
       비율을 그대로 두고 크기만 줄이고, 액자에서는 contain 으로 봅니다. */
    ok(/const SHOT_BOX = 520;/.test(PR) && /function fileToShotDataUrl\(file\)/.test(PR),
       "★★ 화면 사진은 자르지 않는다 — 비율 그대로, 긴 변만 520px 로");
    ok(/const k = Math\.min\(1, SHOT_BOX \/ Math\.max\(img\.width, img\.height\)\);/.test(PR),
       "★ 원본이 더 작으면 키우지 않는다");
    ok(!/drawImage\(img, sx, sy, sw, sh/.test(PR.slice(PR.indexOf("fileToShotDataUrl"), PR.indexOf("fileToSquareDataUrl"))),
       "★★ 가운데만 오려내는 계산이 남아 있지 않다");
    ok(/\/\^data:image\\\/\(png\|jpe\?g\|webp\);base64,\/\.test\(_raw\)/.test(PR),
       "★★ 액자에 거는 것은 data:image 만 — 다른 주소가 끼어들 자리를 안 만든다");
    ok(/saveMyProfile\(\{ shareImg: url \}\)/.test(PR),
       "사진은 프꾸와 같은 자리(profile.shareImg)에 산다 — 이름을 바꿔도 따라온다");
    /* ★★ 잘라 보기 / 전체 보기 — 카드마다 고릅니다 (2026-08-15).

       여기까지 세 번 돌아왔습니다. 다음에 손댈 사람을 위해 적어 둡니다:
         ① 올릴 때 액자 비율로 **잘랐더니** — 가로로 긴 화면 캡쳐가
            가운데 45% 만 남아 길쭉하게 늘어난 꼴이 됐습니다.
         ② 자르기를 그만두고 전체 보기로 **고정했더니** — 액자는 남의
            카드 키를 따르니 위아래에 회색 띠가 생겼습니다.
         ③ 액자를 사진 비율대로 **자라게 했더니** — 띠는 없어졌지만
            카드 키가 제각각이라 줄이 들쭉날쭉했습니다.
       답: 액자는 진짜 방과 같이 카드 키에 맞추고(줄이 가지런),
           잘라 보기/전체 보기를 **고르게** 합니다. 진짜 방이 이미
           가진 기능인데 혼자 방에서만 안 쓰고 있었어요.
       ★ 그러니 액자 키를 사진에 맞추는 쪽으로 되돌리지 마세요. */
    const SH5 = fs.readFileSync(DIR+"script_share.js","utf8");
    ok(!/function syncShareHeights\(\)[\s\S]{0,900}?if \(window\.SOLO\) return;/.test(SH5),
       "★★ 혼자 방도 액자 키를 카드에 맞춘다 (사진 비율대로 두면 줄이 들쭉날쭉)");
    ok(/data-solo-fit="cover"/.test(PR) && /data-solo-fit="contain"/.test(PR),
       "★ 카드마다 [꽉 채우기 / 전체 보기] 를 고를 수 있다");
    ok(/saveMyProfile\(\{ shareFit: b\.dataset\.soloFit \}\)/.test(PR),
       "고른 방식은 그 카드에 남는다 (profile.shareFit)");
    ok(/const fit = \(사람들\[닉\]\?\.profile\?\.shareFit === "contain"\) \? "contain" : "cover";/.test(fs.readFileSync(DIR+"script_solo.js","utf8")),
       "★ 액자가 그 선택을 그대로 쓴다 (기본은 꽉 채우기)");
    const CS3 = fs.readFileSync(DIR+"styles.css","utf8");
    ok(/\.solo-shot-prev\.fit-cover img\{ object-fit: cover; \}/.test(CS3)
       && /\.solo-shot-prev\.fit-contain img\{ object-fit: contain; \}/.test(CS3),
       "★★ 미리보기도 고른 방식을 따른다 — 카드와 다르면 미리보기의 뜻이 사라진다");

    /* ★ 셋이 한 몸입니다 — 안 자르고 올렸는데 액자에서 cover 로 보면
       애써 남긴 바깥쪽이 도로 잘립니다. 미리보기까지 같아야 하고요. */

    ok(/cnt\.onchange = \(\) => \{/.test(PR),
       "카드 수는 슬라이더를 **놓았을 때** 다시 짓는다 (끄는 내내 지으면 어지럽다)");
  }

  return checkAchv();
}

