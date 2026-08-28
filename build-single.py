#!/usr/bin/env python3
# TheMagam © 그링링 · 무단 복제·재배포 금지
"""
index.html + styles.css + JS → index-단일파일.html 로 합칩니다.

부수 작업으로 index.html의 styles.css / script_*.js 링크에 ?v=... 를 붙입니다.
GitHub Pages는 CSS·JS를 오래 캐시해서, 파일을 올려도 브라우저가 예전 것을
계속 쓰는 일이 생깁니다. 이 스크립트를 실행할 때마다 버전이 갱신되므로
배포 전에 한 번 돌려주면 캐시 문제가 사라집니다.

파일을 수정한 뒤 이 스크립트를 다시 실행하면 단일 파일 버전이 갱신됩니다.
    python3 build-single.py

각 JS는 원본과 동일한 스코프를 유지하려고 개별 <script> 블록으로 넣습니다.
(하나로 합치면 파일별 최상위 let/const가 서로 충돌해 전부 죽습니다.)
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = [
    # 🧪 시험 모드는 맨 앞 — database() 를 갈아 끼우는 일이라 순서가 곧 전부입니다
    "script_demo.js", "script_solo.js",
    "fortune_data.js", "script_core.js", "script_auth.js", "script_ui.js",
    "script_chat.js", "script_chatty.js", "script_data.js", "script_realtime.js",
    # 배치 파일 — 여기 이름은 아래 main() 이 index.html 을 보고 바꿔 끼웁니다.
    #   · 지금 배치(알약 줄)  → script_dock.js
    #   · 예전 배치(세 칸)    → script_layout.js
    # ★ 되돌리기를 쉽게 하려는 것입니다. index-classic.html 을 index.html 로
    #   이름만 바꾸면 이 스크립트가 알아서 따라갑니다 — 목록까지 손대야
    #   한다면 "되돌릴 수 있다" 는 말이 반쪽이 되니까요.
    "script_dock.js", "script_music.js", "script_wordcount.js",
    "script_worklog.js", "script_timelog.js", "script_idledetect.js", "script_alive.js", "script_profile.js", "script_mywork.js", "script_forest.js", "script_pubreview.js",
    # 빠뜨렸던 것 (2026-08-11) — 📢 공지판과 🏅 업적. index.html 에는 진작
    # ※ 이 안에 대괄호를 쓰지 마세요. checks.js 가 ORDER 를 대괄호로
    #   잘라 읽어서, 주석 속 대괄호 하나에 목록이 중간에서 끊깁니다.
    # 실려 있었는데 이 목록에만 없었습니다. 두 파일의 script 태그가 아래
    # "지워지는 구간" 안에 있다 보니, 태그는 지워지고 알맹이는 안 들어가
    # **단일파일에서만 공지판과 업적이 통째로 없었어요.** 남은 외부 참조
    # 검사도 못 잡습니다 — 태그가 사라져 버려서 찾을 게 없거든요.
    # 그래서 아래에 목록과 index.html 을 맞춰보는 문지기를 뒀습니다.
    "script_notice.js", "script_achv.js",
    "script_reactions.js", "script_note.js", "script_worktag.js", "script_sticker.js", "script_share.js", "script_help.js", "script_qna.js", "script_files.js", "script_zoom.js", "script_manual.js", "script_guard.js",
]
OUT = "index-단일파일.html"


def read(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return f.read()


def stamp_versions():
    """index.html의 에셋 링크에 ?v=<타임스탬프>를 붙이거나 갱신합니다."""
    import time
    ver = time.strftime("%Y%m%d%H%M")
    path = os.path.join(HERE, "index.html")
    with open(path, encoding="utf-8") as f:
        html = f.read()

    def bump(m):
        return '%s="%s?v=%s"' % (m.group(1), m.group(2), ver)

    # 아이콘과 manifest 에도 버전을 찍습니다.
    #
    # 파비콘은 브라우저가 가장 끈질기게 캐시하는 파일입니다. 강제
    # 새로고침으로도 잘 안 바뀌어서, 그림을 갈아도 옛 아이콘이 계속
    # 보입니다. 주소 뒤에 버전을 붙이면 "다른 파일"로 보고 새로 받아
    # 갑니다. manifest 도 같은 이유로 함께 찍습니다.
    new = re.sub(
        r'(href|src)="(styles\.css|fortune_data\.js|script_[\w]+\.js'
        r'|manifest\.json|icons/[\w.-]+\.png)(?:\?v=[\w]+)?"',
        bump, html
    )
    if new != html:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new)

    # 관리 페이지에도 같은 도장을 찍습니다 (고침 2026-08-13).
    #
    # admin.html 은 script_admin.js 를 맨몸으로 불러와서, 파일을 올려도
    # 브라우저가 옛것을 재활용했습니다. 돋보기를 고쳐 올렸는데 관리자
    # 화면은 그대로였던 것이 이것 때문이에요. 본채만 도장을 찍고 별채를
    # 잊었던 셈입니다.
    apath = os.path.join(HERE, "admin.html")
    if os.path.exists(apath):
        with open(apath, encoding="utf-8") as f:
            ahtml = f.read()
        anew = re.sub(
            r'(src)="(script_admin\.js)(?:\?v=[\w]+)?"',
            bump, ahtml
        )
        if anew != ahtml:
            with open(apath, "w", encoding="utf-8") as f:
                f.write(anew)
        print("admin.html 에도 도장: ?v=%s" % ver)

    print("에셋 버전 스탬프: ?v=%s" % ver)
    return new


def 배치파일_맞추기(html):
    """index.html 이 어느 배치를 쓰는지 보고 ORDER 를 맞춥니다."""
    쓰는것 = "script_dock.js" if 'src="script_dock.js' in html else "script_layout.js"
    반대 = "script_layout.js" if 쓰는것 == "script_dock.js" else "script_dock.js"
    if 반대 in ORDER:
        ORDER[ORDER.index(반대)] = 쓰는것
    return 쓰는것


def main():
    html = stamp_versions()
    print("배치: %s" % 배치파일_맞추기(html))

    # 1) CSS 인라인 (?v= 가 붙어 있어도 잡히도록)
    link = re.search(r'<link rel="stylesheet" href="styles\.css[^"]*" />', html)
    link = link.group(0) if link else '<link rel="stylesheet" href="styles.css" />'
    if link not in html:
        sys.exit("❌ 중단 — %s 를 만들지 않았습니다.\n"
                 "   index.html 에서 styles.css link 태그를 찾지 못했어요." % OUT)
    html = html.replace(link, "<style>\n" + read("styles.css") + "\n</style>")

    # 2) JS 인라인 — 문자열 슬라이싱으로 교체.
    #    re.sub를 쓰면 JS 안의 \p 같은 이스케이프가 치환 템플릿으로 해석돼 깨집니다.
    m_first = re.search(r'<script src="%s[^"]*"></script>' % re.escape(ORDER[0]), html)
    m_last = re.search(r'<script src="%s[^"]*"></script>' % re.escape(ORDER[-1]), html)
    if not m_first or not m_last:
        sys.exit("❌ 중단 — %s 를 만들지 않았습니다.\n"
                 "   index.html 에서 script 태그 블록을 찾지 못했어요." % OUT)

    start = m_first.start()
    end = m_last.end()

    #    ★ 문지기 — 지워질 구간 안의 script 태그와 ORDER 가 **똑같아야** 합니다.
    #      순서까지 봅니다. 실리는 차례가 달라지면 뒤엣것이 앞엣것을 감싸는
    #      구조(script_profile.js·script_sticker.js)가 조용히 깨집니다.
    태그 = [os.path.basename(u.split("?")[0])
            for u in re.findall(r'<script src="([^"]+)"></script>', html[start:end])]
    if 태그 != ORDER:
        빠짐 = [n for n in 태그 if n not in ORDER]
        군더더기 = [n for n in ORDER if n not in 태그]
        sys.exit(
            "❌ 중단 — ORDER 가 index.html 과 어긋났어요.\n"
            "  목록에 빠진 파일: %s\n"
            "  index.html 에 없는 파일: %s\n"
            "  (둘 다 비었으면 **순서**가 다른 것입니다)\n"
            "  ※ 빠진 파일은 단일파일에서 통째로 사라집니다.\n"
            "  ※ 이 자리에서 멈추면 %s 는 **안 만들어집니다.**"
            % (빠짐 or "없음", 군더더기 or "없음", OUT))

    block = "\n".join(
        "<script>\n/* ===== %s ===== */\n%s\n</script>" % (n, read(n))
        for n in ORDER
    )
    html = html[:start] + block + html[end:]

    # 3) 외부 참조가 남았는지 확인 (firebase CDN과 data: URI는 정상)
    #    JS 템플릿 문자열 안의 src="${...}" 는 런타임 값이므로 제외합니다.
    #    아이콘과 manifest 는 일부러 밖에 둡니다. 단일파일은 미리보기용이고,
    #    실제 설치(PWA)는 폴더 버전으로 배포하니까요.
    #
    # ★★★ [사고 2026-08-22] findpw-k7f3a92x.html 은 2026-08-20 에 대문에
    #   달린 **일부러 바깥에 둔 페이지**입니다. 그런데 이 문지기가 그걸
    #   모르고 걸러내면서, 그 뒤로 **열 시간 넘게 단일파일이 안 만들어졌어요.**
    #   sys.exit 이라 파일을 쓰기 **직전에** 멈춥니다. 그런데 화면에 뜬 글이
    #   "…남았어요" 라 경고처럼 보여서, 저도 매번 그냥 넘겼습니다.
    #     → 허용 목록에 넣고,
    #     → 멈출 때는 ❌ 로 시작해 **안 만들었다**고 못 박습니다.
    #   ※ 이사가 끝나 index.html 의 .join-moved 덩어리를 지울 때, 이 줄도
    #     같이 지우세요.
    ALLOW_EXTERNAL = ("icons/", "manifest.json", "findpw-")
    leftover = [
        u for u in re.findall(r'(?:src|href)="([^"]+)"', html)
        if not u.startswith(("https://", "data:")) and "${" not in u
        and not u.startswith(ALLOW_EXTERNAL)
    ]
    if leftover:
        sys.exit("❌ 중단 — %s 를 만들지 않았습니다.\n"
                 "   인라인되지 않은 외부 참조가 남았어요: %s\n"
                 "   (일부러 밖에 두는 파일이면 ALLOW_EXTERNAL 에 넣으세요)"
                 % (OUT, leftover))

    with open(os.path.join(HERE, OUT), "w", encoding="utf-8") as f:
        f.write(html)

    print("%s 생성 완료 (%s bytes, script 블록 %d개)"
          % (OUT, format(len(html), ","), html.count("<script>")))


if __name__ == "__main__":
    main()
