# cw.pang-blog · 中文个人博客

生活随笔、科研笔记和学习笔记。纯静态页面，支持 GitHub Pages 的仓库子路径，无第三方运行依赖。当前六篇文章均为示例，正式发布前请替换。

## 修改文章

编辑 `content/posts.json`。每篇文章包含 `slug`（小写英文与短横线组成的唯一文件名）、`title`、`category`、`date`（YYYY-MM-DD）、`summary`，以及 `sections`。每个 section 包含 `heading` 和 `paragraphs` 数组。分类使用生活随笔、科研笔记或学习笔记。

运行 `python3 build.py` 生成首页及文章页。页面样式在 `dist/style.css`，分类筛选在 `dist/script.js`；生成器不会覆盖这两个文件。网站名称和首页介绍在 `build.py` 中修改。

本地预览：`python3 -m http.server 4173 --directory dist`，然后访问 http://localhost:4173 。

删去文章后，请手动移除 `dist/posts/` 下对应的旧 HTML 文件，避免旧链接仍可访问。

## 发布到 GitHub Pages

1. 创建一个 GitHub 公开仓库，或使用你希望发布博客的现有仓库。
2. 将本目录的内容上传到仓库根目录，包含 `.github/workflows/pages.yml`。不要只上传 `dist`。
3. 在仓库 Settings → Pages → Build and deployment 中，将 Source 选择为 GitHub Actions。
4. 当前工作流在推送到 `main` 时发布，也支持在 Actions 页面手动运行。如仓库默认分支不同，修改 `pages.yml` 的分支名称。
5. 在 Actions 中等待工作流成功，从 Settings → Pages 获取实际公开网址。

完整博客不需要数据库或服务器。访客可阅读文章；你通过编辑文章文件、提交到仓库来更新内容。

参考：[GitHub Pages 官方部署说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
