"""Build the blog with Python's standard library: python3 build.py."""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
POSTS = sorted(json.loads((ROOT / "content/posts.json").read_text()), key=lambda p: p["date"], reverse=True)
CATEGORIES = ("生活随笔", "科研笔记", "学习笔记")
e = html.escape


def page(title, description, content, prefix="./", category="", home=False):
    nav = ''.join(f'<a href="{prefix}index.html?category={e(c)}" {"aria-current=page" if c == category else ""}>{c}</a>' for c in CATEGORIES)
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{e(title)} · cw.pang-blog</title><meta name="description" content="{e(description)}"><link rel="stylesheet" href="{prefix}style.css"><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23c9402a'/%3E%3Cpath d='M9 9h14M9 16h10M9 23h14' stroke='white' stroke-width='3'/%3E%3C/svg%3E"></head>
<body><a class="skip" href="#main">跳到正文</a><header class="header"><a class="brand" href="{prefix}index.html"><span class="mark">P</span>cw.pang-blog<span class="brand-note">一份个人记录</span></a><nav aria-label="主要导航"><a href="{prefix}index.html" {"aria-current=page" if home else ""}>全部文章</a>{nav}</nav></header>
<main id="main">{content}</main><footer><span>cw.pang-blog <span class="muted">/ 生活 · 科研 · 学习</span></span><span class="muted">把走过的路，写成自己的文字。</span></footer>{'<script src="./script.js"></script>' if home else ''}</body></html>'''


def build():
    DIST.mkdir(exist_ok=True)
    cards = []
    for i, post in enumerate(POSTS):
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", post["slug"]):
            raise ValueError("Use a lowercase, hyphen-separated slug")
        if post["category"] not in CATEGORIES:
            raise ValueError("Unknown category")
        cards.append(f'''<article class="post-row" data-category="{e(post['category'])}"><span class="number">{i + 1:02d}</span><div><div class="post-meta"><span class="category">{e(post['category'])}</span><time datetime="{e(post['date'])}">{e(post['date'].replace('-', '.'))}</time><span>示例</span></div><h2><a href="./posts/{e(post['slug'])}.html">{e(post['title'])}</a></h2><p>{e(post['summary'])}</p></div><span class="read-label" aria-hidden="true">阅读全文</span></article>''')
        body = ''.join(f'<section><h2>{e(s["heading"])}</h2>' + ''.join(f'<p>{e(p)}</p>' for p in s['paragraphs']) + '</section>' for s in post['sections'])
        article = f'''<div class="article-wrap"><a class="back" href="../index.html?category={e(post['category'])}">返回{e(post['category'])}</a><article class="article"><div class="post-meta"><span class="category">{e(post['category'])}</span><time datetime="{e(post['date'])}">{e(post['date'])}</time><span>示例文章</span></div><h1>{e(post['title'])}</h1><p class="article-intro">{e(post['summary'])}</p><div class="article-body">{body}</div></article><a class="back bottom-back" href="../index.html">浏览全部文章</a></div>'''
        (DIST / "posts").mkdir(exist_ok=True)
        (DIST / "posts" / f"{post['slug']}.html").write_text(page(post['title'], post['summary'], article, prefix="../", category=post['category']))
    index = f'''<section class="intro"><div class="eyebrow"><span class="line"></span> NOTES ON AN ORDINARY LIFE</div><h1>生活有迹，<br>思考有<span class="accent">回声。</span></h1><div class="intro-bottom"><p>记下一些日常，也整理研究与学习中的思考。<br>在文字之间，慢慢看清自己的路。</p><div class="edition">个人博客<span>生活 / 科研 / 学习</span></div></div></section><section class="listing" aria-labelledby="list-title"><div class="list-heading"><h2 id="list-title">全部文章</h2><span id="post-count">{len(POSTS):02d} 篇记录</span></div><p class="demo-note">以下为示例文章，展示三个栏目与阅读效果。</p>{''.join(cards)}</section>'''
    (DIST / "index.html").write_text(page("生活、科研与学习笔记", "记录生活随笔、科研思考与学习笔记的中文个人博客。", index, home=True))
    (DIST / ".nojekyll").touch()
    print(f"Built homepage and {len(POSTS)} articles in {DIST}")


if __name__ == "__main__":
    build()
