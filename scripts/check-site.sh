#!/usr/bin/env bash
# Drift guard for the hand-synced landing pages. No build step and no npm, so this
# is the only thing that notices when the five copies of the chrome disagree.
#
#   scripts/check-site.sh [SITE_DIR]
#
# SITE_DIR (arg or $SITE_DIR) defaults to the repo root. $BLOG_DIR defaults to the
# michaellambgelo.github.io checkout next to this repo; when it is missing, the
# checks that need it warn and skip instead of failing.
#
# Checks:
#   10a  <head>, primary <nav>, <footer> and the nav IIFE match privacy.html on
#        every page, after dropping the per-page lines CLAUDE.md allows.
#   10b  the primary nav (href + label, in order) matches the blog's navbar.html.
#   11   every og:image / twitter:image is an https://michaellamb.dev/ URL for a
#        1200x630 PNG/JPEG in the repo that is not a copied blog seo/ card.
#
# Exits 0 when clean, 1 when any check fails.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
site="${1:-${SITE_DIR:-$(dirname "$here")}}"
blog="${BLOG_DIR:-$(dirname "$(dirname "$here")")/michaellambgelo.github.io}"

if [[ ! -f "$site/privacy.html" ]]; then
  echo "check-site: $site has no privacy.html — not a landing checkout" >&2
  exit 1
fi

exec python3 -I - "$site" "$blog" <<'PY'
import difflib, hashlib, os, re, struct, sys
from urllib.parse import urljoin, urlsplit, urlunsplit

site, blog = sys.argv[1], sys.argv[2]
REF = "privacy.html"
PAGES = ["index.html", "book.html", "privacy.html", "terms.html", "404.html"]
ORIGIN = "https://michaellamb.dev"
# The 2023 "Leadership Greater Jackson" card: the old assets/og.png, a copy of the
# blog's pre-2026-08-18 seo/default.png (removed in a47fbdd).
STALE_MD5 = {"287cb18a1b4a374a1e42f277a6c737f6"}

errors, warnings = [], []
def fail(msg): errors.append(msg)
def warn(msg): warnings.append(msg)

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def block(text, start, end, name, page):
    """Lines from the first line matching `start` through the next matching `end`."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.search(start, line):
            for j in range(i, len(lines)):
                if re.search(end, lines[j]):
                    return lines[i:j + 1], j
            break
    fail(f"{page}: could not find the {name} block ({start!r} .. {end!r})")
    return None, None

# ---------------------------------------------------------------- 10a chrome
# Lines each page owns. Every page must carry its own title, description and
# og:title/description; indexable pages also carry canonical + og:url, and the
# 404 swaps those for robots noindex (it is served at arbitrary paths).
PER_PAGE = {
    "title": r"^\s*<title>.*</title>\s*$",
    "description": r'^\s*<meta name="description" content="[^"]*">\s*$',
    "canonical": r'^\s*<link rel="canonical" href="[^"]*">\s*$',
    "og:title": r'^\s*<meta property="og:title" content="[^"]*">\s*$',
    "og:description": r'^\s*<meta property="og:description" content="[^"]*">\s*$',
    "og:url": r'^\s*<meta property="og:url" content="[^"]*">\s*$',
    "robots": r'^\s*<meta name="robots" content="noindex">\s*$',
}
REQUIRED = {"title", "description", "og:title", "og:description"}
INDEXABLE = {"canonical", "og:url"}
# Multi-line or single-line extras only one page may have (see CLAUDE.md).
EXTRAS = {
    "index.html": [("vhs.js", r'^\s*<script src="/js/vhs\.js" defer></script>\s*$', None),
                   ("JSON-LD", r'<script type="application/ld\+json">', r"</script>")],
    "book.html": [("noscript", r"^\s*<noscript>\s*$", r"^\s*</noscript>\s*$")],
}

def chrome(page):
    text = read(os.path.join(site, page))
    head, _ = block(text, r"<head>", r"</head>", "<head>", page)
    nav, _ = block(text, r'<a class="sk-skip"', r"</nav>", "nav", page)
    footer, fend = block(text, r"<footer\b", r"</footer>", "footer", page)
    if None in (head, nav, footer):
        return None
    rest = "\n".join(text.splitlines()[fend + 1:])
    iife, _ = block(rest, r"^\s*<script>\s*$", r"^\s*</script>\s*$", "nav IIFE", page)
    if iife is None:
        return None

    # Drop allowed extras from the head, then the per-page lines.
    for name, start, end in EXTRAS.get(page, []):
        for i, line in enumerate(head):
            if re.search(start, line):
                j = i if end is None else next(
                    (k for k in range(i, len(head)) if re.search(end, head[k])), None)
                if j is None:
                    fail(f"{page}: unterminated {name} block in <head>")
                else:
                    del head[i:j + 1]
                break
        else:
            fail(f"{page}: expected its {name} in <head> (CLAUDE.md lists it) but it is missing")
    seen = {}
    kept = []
    for line in head:
        key = next((k for k, rx in PER_PAGE.items() if re.match(rx, line)), None)
        if key:
            seen[key] = seen.get(key, 0) + 1
        else:
            kept.append(line)
    want = REQUIRED | ({"robots"} if page == "404.html" else INDEXABLE)
    for key in sorted(want):
        if seen.get(key) != 1:
            fail(f"{page}: needs exactly one {key} line in <head>, found {seen.get(key, 0)}")
    for key in sorted(set(seen) - want):
        fail(f"{page}: has a {key} line in <head> it should not have")

    nav = [l.replace(' aria-current="page"', "") for l in nav]
    return {"<head>": kept, "nav": nav, "footer": footer, "nav IIFE": iife}

ref = chrome(REF)
if ref:
    for page in PAGES:
        if page == REF:
            continue
        if not os.path.exists(os.path.join(site, page)):
            fail(f"{page}: missing")
            continue
        got = chrome(page)
        if not got:
            continue
        for part, lines in ref.items():
            if got[part] != lines:
                diff = difflib.unified_diff(lines, got[part], f"{REF} {part}", f"{page} {part}",
                                            n=1, lineterm="")
                fail(f"{page}: {part} drifted from {REF}:\n    " + "\n    ".join(diff))

# ------------------------------------------------------------- 10b blog nav
def norm(url):
    s = urlsplit(url)
    return urlunsplit((s.scheme, s.netloc.lower(), s.path or "/", s.query, s.fragment))

def nav_links(html, base):
    m = re.search(r'<ul class="sk-nav__list"[^>]*>(.*?)</ul>', html, re.S)
    if not m:
        return None
    out = []
    for href, label in re.findall(r'<a\b[^>]*?href="([^"]*)"[^>]*>(.*?)</a>', m.group(1), re.S):
        label = re.sub(r"<[^>]+>", "", label).strip()
        out.append((norm(urljoin(base + "/", href)), label))
    return out

navbar = os.path.join(blog, "_includes/body/sections/navbar.html")
config = os.path.join(blog, "_config.yml")
if not (os.path.isfile(navbar) and os.path.isfile(config)):
    warn(f"blog repo not found at {blog}; skipped the blog nav comparison (10b)")
else:
    cfg = {}
    for line in read(config).splitlines():
        m = re.match(r"^(\w+):\s*['\"]?([^'\"#]*?)['\"]?\s*(#.*)?$", line)
        if m:
            cfg[m.group(1)] = m.group(2)
    def liquid(m):
        var = re.match(r"\s*site\.(\w+)", m.group(1))
        if not var or var.group(1) not in cfg:
            fail(f"navbar.html: cannot resolve {{{{{m.group(1)}}}}} from _config.yml")
            return ""
        return cfg[var.group(1)]
    # Only the primary <ul> is resolved; the rest of the include loops over site.pages.
    src = re.search(r'<ul class="sk-nav__list".*?</ul>', read(navbar), re.S)
    src = re.sub(r"\{%.*?%\}", "", src.group(0), flags=re.S) if src else ""
    src = re.sub(r"\{\{(.*?)\}\}", liquid, src)
    theirs = nav_links(src, cfg.get("url", ""))
    ours = nav_links(read(os.path.join(site, REF)), ORIGIN)
    if theirs is None or ours is None:
        fail("could not find <ul class=\"sk-nav__list\"> in "
             + ("the blog navbar.html" if theirs is None else REF))
    elif ours != theirs:
        fmt = lambda links: [f"{label}  {href}" for href, label in links]
        diff = difflib.unified_diff(fmt(theirs), fmt(ours), "blog navbar.html", f"landing {REF}",
                                    lineterm="")
        fail("primary nav differs from the blog's:\n    " + "\n    ".join(diff))

# ------------------------------------------------------------ 11 og images
# A card copied from the blog's seo/ directory carries that post's title and date,
# so every share of michaellamb.dev would advertise an old post (assets/og.png did
# exactly that until a47fbdd). Hashes catch a copy under any filename.
def image_size(path):
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR":
        return "PNG", struct.unpack(">II", data[16:24])
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                i += 2
                continue
            seglen = struct.unpack(">H", data[i + 2:i + 4])[0]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                return "JPEG", (w, h)
            i += 2 + seglen
        return "JPEG", None
    return None, None

blog_hashes = {}
seo = os.path.join(blog, "seo")
if os.path.isdir(seo):
    for name in os.listdir(seo):
        p = os.path.join(seo, name)
        if os.path.isfile(p):
            with open(p, "rb") as f:
                blog_hashes[hashlib.sha256(f.read()).hexdigest()] = name
else:
    warn(f"blog seo/ not found at {seo}; og images were only checked against the known stale card")

checked = {}
for page in PAGES:
    path = os.path.join(site, page)
    if not os.path.exists(path):
        continue
    text = read(path)
    tags = re.findall(r'<meta (?:property|name)="(og:image|twitter:image)" content="([^"]*)"', text)
    for key in ("og:image", "twitter:image"):
        if key not in [k for k, _ in tags]:
            fail(f"{page}: no {key} tag")
    for key, url in tags:
        where = f"{page} {key} {url}"
        if not url.startswith(ORIGIN + "/") or urlsplit(url).query or urlsplit(url).fragment:
            fail(f"{where}: must be an absolute {ORIGIN}/<path> URL")
            continue
        rel = urlsplit(url).path.lstrip("/")
        file = os.path.join(site, rel)
        if rel in checked:
            if checked[rel]:
                fail(f"{where}: {checked[rel]}")
            continue
        problem = ""
        if not os.path.isfile(file):
            problem = f"{rel} does not exist in the repo"
        else:
            kind, size = image_size(file)
            with open(file, "rb") as f:
                data = f.read()
            if kind is None:
                problem = f"{rel} is not a PNG or JPEG"
            elif size != (1200, 630):
                problem = f"{rel} is {kind} {size and 'x'.join(map(str, size))}, need 1200x630"
            elif hashlib.md5(data).hexdigest() in STALE_MD5:
                problem = f"{rel} is the stale 2023 'Leadership Greater Jackson' blog card"
            elif hashlib.sha256(data).hexdigest() in blog_hashes:
                problem = (f"{rel} is a copy of the blog's seo/{blog_hashes[hashlib.sha256(data).hexdigest()]}"
                           " (blog cards carry a post title/date); render a landing card instead")
        checked[rel] = problem
        if problem:
            fail(f"{where}: {problem}")
    for dim, val in (("width", "1200"), ("height", "630")):
        m = re.search(rf'<meta property="og:image:{dim}" content="([^"]*)"', text)
        if m and m.group(1) != val:
            fail(f"{page}: og:image:{dim} is {m.group(1)}, the card is {val}")

for w in warnings:
    print(f"check-site: warning: {w}")
for e in errors:
    print(f"check-site: FAIL: {e}")
if errors:
    print(f"check-site: {len(errors)} problem(s) in {site}")
    sys.exit(1)
print(f"check-site: ok ({len(PAGES)} pages" + (f", {len(warnings)} check(s) skipped)" if warnings else ")"))
PY
