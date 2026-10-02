const form = document.getElementById('article-form');
const fields = ['title', 'category', 'date', 'summary', 'collection', 'body'];
const controls = Object.fromEntries(fields.map(name => [name, document.getElementById(name)]));
const list = document.getElementById('article-list');
const status = document.getElementById('draft-status');
const message = document.getElementById('editor-message');
const draftKey = 'cw.pang-blog.article-drafts.v1';
const selectionKey = 'cw.pang-blog.editor-selection.v1';
let articles = [];
let selected = null;
let drafts = {};
let timer;
let storageAvailable = true;
let ready = false;
let dirty = false;
let openedVersion = null;
let basePublished = '';
let readingPublished = false;
let connection = {configured:false, authenticated:false};
let baseCommit = '';
let publishing = false;
let deploymentTimer;
let selectionRequest = 0;

async function draftTransaction(action) {
  if (!navigator.locks) throw new Error('Safe draft storage is unavailable');
  return navigator.locks.request(draftKey, () => {
    const latest = readDrafts();
    const result = action(latest);
    localStorage.setItem(draftKey, JSON.stringify(latest));
    drafts = latest;
    return result;
  });
}

function readDrafts() {
  const saved = JSON.parse(localStorage.getItem(draftKey) || '{}');
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid draft storage');
  return saved;
}

function validDraft(draft) {
  return draft && typeof draft.slug === 'string' && fields.every(name => typeof draft[name] === 'string');
}

function fingerprint(article) {
  return JSON.stringify(fields.map(name => article[name] || ''));
}

function version(draft) {
  return draft?.version || draft?.updated || null;
}

try {
  drafts = readDrafts();
} catch {
  storageAvailable = false;
}

function today() {
  return new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Shanghai'}).format(new Date());
}

function values() {
  const article = Object.fromEntries(fields.map(name => [name, controls[name].value]));
  if (article.category !== '学习笔记') article.collection = '';
  return {...article, slug: selected};
}

async function saveDraft() {
  clearTimeout(timer);
  if (!ready || !selected || !dirty) return true;
  const slug = selected;
  const current = {...values(), updated: Date.now(), version: crypto.randomUUID(), basePublished};
  const originalVersion = openedVersion;
  const wasReadingPublished = readingPublished;
  try {
    const conflict = await draftTransaction(latest => {
      const previous = latest[slug];
      const conflict = validDraft(previous) && version(previous) !== originalVersion && fingerprint(previous) !== fingerprint(current);
      const backups = Array.isArray(previous?.backups) ? previous.backups.filter(validDraft) : [];
      if (conflict) {
        const ownBackup = backups.findIndex(backup => version(backup) === originalVersion);
        if (ownBackup >= 0) backups[ownBackup] = current;
        else backups.push(current);
        latest[slug] = {...previous, backups};
      } else {
        // Keep the old draft when explicitly continuing from the published version.
        if (wasReadingPublished && validDraft(previous) && fingerprint(previous) !== fingerprint(current)) backups.push({...previous, backups: undefined});
        latest[slug] = {...current, backups};
      }
      return conflict;
    });
    if (selected !== slug) return true;
    openedVersion = current.version;
    dirty = fingerprint(values()) !== fingerprint(current);
    readingPublished = false;
    storageAvailable = true;
    status.textContent = dirty ? '正在保存草稿…' : conflict ? '另一个页面有更新，已保留两份草稿' : '草稿已保存到本机';
    renderList();
    if (dirty) timer = setTimeout(saveDraft, 500);
    return true;
  } catch {
    storageAvailable = false;
    status.textContent = navigator.locks ? '本机保存失败，请保留此页面' : '此浏览器无法安全保存草稿，请更新浏览器并复制正文备份';
    return false;
  }
}

async function flushDraft() {
  while (dirty && ready && selected) if (!await saveDraft()) return false;
  return true;
}

function refreshFields() {
  document.getElementById('topic-field').hidden = controls.category.value !== '学习笔记';
  document.getElementById('word-count').textContent = `${Array.from(controls.body.value).length} 字`;
}

function renderList() {
  const category = document.getElementById('article-filter').value;
  const filtered = articles.filter(article => !category || article.category === category);
  list.replaceChildren();
  document.getElementById('library-count').textContent = `${filtered.length} 篇已发布文章`;
  for (const article of filtered) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'article-choice';
    button.setAttribute('aria-current', String(article.slug === selected));
    const title = document.createElement('strong');
    title.textContent = article.title;
    const detail = document.createElement('span');
    detail.textContent = `${article.category} · ${article.date}${article.example ? ' · 示例' : ''}`;
    button.append(title, detail);
    button.addEventListener('click', () => selectArticle(article));
    list.append(button);
  }
  for (const [slug, draft] of Object.entries(drafts)) {
    if (!validDraft(draft)) continue;
    const article = articles.find(item => item.slug === slug) || {slug, title:'', category:'生活随笔', date:today(), summary:'', collection:'', body:''};
    for (const backup of Array.isArray(draft.backups) ? draft.backups.filter(validDraft) : []) {
      if (category && backup.category !== category) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'article-choice draft-backup';
      const title = document.createElement('strong');
      title.textContent = `${backup.title || '未命名文章'}（草稿备份）`;
      const detail = document.createElement('span');
      detail.textContent = '仅保存在本机 · 点击恢复';
      button.append(title, detail);
      button.addEventListener('click', () => {
        const target = backup.publishedSlug ? articles.find(item => item.slug === backup.publishedSlug) || {...backup,slug:backup.publishedSlug} : article;
        selectArticle(target, {draft:backup});
      });
      list.append(button);
    }
  }
}

async function selectArticle(article, options = {}) {
  if (publishing && !options.published) return;
  const request = ++selectionRequest;
  if (ready && !await flushDraft()) {
    message.textContent = '草稿尚未保存，请保留当前文章并复制正文备份后再切换。';
    return;
  }
  if (request !== selectionRequest) return;
  selected = article.slug;
  try { drafts = readDrafts(); } catch { storageAvailable = false; }
  const storedDraft = validDraft(drafts[selected]) ? drafts[selected] : null;
  const draft = storedDraft?.publishedSlug ? null : storedDraft;
  basePublished = fingerprint(article);
  openedVersion = version(storedDraft);
  if (options.draft) openedVersion = version(options.draft);
  const stale = draft?.basePublished && draft.basePublished !== basePublished && articles.some(item => item.slug === selected);
  const data = options.draft || (options.published || stale ? article : draft || article);
  for (const name of fields) controls[name].value = data[name] || '';
  ready = true;
  dirty = false;
  readingPublished = Boolean(options.published || stale);
  document.getElementById('article-fields').disabled = false;
  document.getElementById('save-draft').disabled = false;
  document.getElementById('article-state').textContent = articles.some(item => item.slug === selected) ? '修改已发布文章' : '新文章';
  status.textContent = data === draft || options.draft ? '已恢复本机草稿' : '已读取发布版本';
  message.textContent = stale ? '博客已有新版本，当前显示最新发布内容；原本的本机草稿仍保留。' : '';
  const draftVersionButton = document.getElementById('draft-version');
  draftVersionButton.hidden = !draft || !articles.some(item => item.slug === selected);
  draftVersionButton.textContent = data === article ? '恢复本机草稿' : '读取发布版本';
  try { localStorage.setItem(selectionKey, selected); } catch { /* Selection is optional; content is saved separately. */ }
  refreshFields();
  renderList();
  setView(false);
}

function escapeHTML(text) {
  return text.replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#x27;'}[character]));
}

function inlineMarkdown(text) {
  return text.split(/(`[^`]+`)/).map(part => part.startsWith('`')
    ? `<code>${escapeHTML(part.slice(1, -1))}</code>`
    : escapeHTML(part).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')).join('');
}

function renderMarkdown(source) {
  const blocks = [];
  let paragraph = [], code = [], language = null, inList = false;
  const flush = () => {
    if (paragraph.length) blocks.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushCode = () => {
    const label = language === 'cpp' ? 'C++' : language;
    blocks.push(`<div class="code-block"><span class="code-language">${escapeHTML(label)}</span><pre><code>${escapeHTML(code.join('\n'))}</code></pre></div>`);
    language = null; code = [];
  };
  for (const line of source.split(/\r?\n/)) {
    if (language !== null) {
      if (line.startsWith('```')) flushCode(); else code.push(line);
      continue;
    }
    if (inList && !line.startsWith('- ')) { blocks.push('</ul>'); inList = false; }
    if (line.startsWith('```')) { flush(); language = line.slice(3).trim(); }
    else if (/^#{1,6} /.test(line)) {
      flush();
      const level = line.indexOf(' ');
      if (level > 1) blocks.push(`<h${level}>${inlineMarkdown(line.slice(level + 1))}</h${level}>`);
    } else if (line.startsWith('- ')) {
      flush();
      if (!inList) { blocks.push('<ul>'); inList = true; }
      blocks.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
    } else if (!line.trim()) flush();
    else paragraph.push(line.trim());
  }
  if (language !== null) flushCode();
  flush();
  if (inList) blocks.push('</ul>');
  return blocks.join('');
}

function setView(preview) {
  document.getElementById('writing-pane').hidden = preview;
  document.getElementById('preview-pane').hidden = !preview;
  document.getElementById('write-view').setAttribute('aria-pressed', String(!preview));
  document.getElementById('preview-view').setAttribute('aria-pressed', String(preview));
  if (preview) {
    const article = values();
    document.getElementById('preview-title').textContent = article.title || '未填写标题';
    document.getElementById('preview-category').textContent = article.category;
    document.getElementById('preview-date').textContent = article.date;
    document.getElementById('preview-summary').textContent = article.summary;
    document.getElementById('preview-body').innerHTML = renderMarkdown(article.body);
  }
}

form.addEventListener('input', () => {
  dirty = true;
  refreshFields();
  status.textContent = '正在保存草稿…';
  clearTimeout(timer);
  timer = setTimeout(saveDraft, 500);
  if (!document.getElementById('preview-pane').hidden) setView(true);
});
document.getElementById('article-filter').addEventListener('change', renderList);
document.getElementById('save-draft').addEventListener('click', saveDraft);
document.getElementById('draft-version').addEventListener('click', () => {
  const article = articles.find(item => item.slug === selected);
  if (!article) return;
  if (document.getElementById('draft-version').textContent === '恢复本机草稿') selectArticle(article, {draft:drafts[selected]});
  else selectArticle(article, {published:true});
});
document.getElementById('write-view').addEventListener('click', () => setView(false));
document.getElementById('preview-view').addEventListener('click', () => setView(true));
document.getElementById('new-article').addEventListener('click', async () => {
  if (!ready) return;
  // Reopening the same new-article draft preserves an unfinished article.
  await selectArticle({slug:'new-article', title:'', category:'生活随笔', date:today(), summary:'', collection:'', body:''});
  controls.title.focus();
});

document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => {
  const body = controls.body;
  const start = body.selectionStart, end = body.selectionEnd;
  const selection = body.value.slice(start, end);
  const wrappers = {
    heading: ['\n\n## ', selection || '小标题', '\n\n'],
    bold: ['**', selection || '加粗文字', '**'],
    list: ['\n- ', selection || '列表内容', '\n'],
    code: ['\n\n```cpp\n', selection || '// 在这里写代码', '\n```\n\n'],
  };
  const [before, text, after] = wrappers[button.dataset.format];
  body.setRangeText(before + text + after, start, end, 'end');
  body.focus();
  body.setSelectionRange(start + before.length, start + before.length + text.length);
  body.dispatchEvent(new Event('input', {bubbles:true}));
}));

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (publishing || !connection.authenticated || !baseCommit) return;
  publishing = true;
  if (!await flushDraft()) { publishing = false; message.textContent = '请先复制正文备份，再重试保存。'; return; }
  const submitted = values();
  const originalSlug = selected;
  document.getElementById('article-fields').disabled = true;
  document.getElementById('publish').disabled = true;
  document.getElementById('new-article').disabled = true;
  for (const id of ['login','save-draft','draft-version','reload-articles']) document.getElementById(id).disabled = true;
  list.querySelectorAll('button').forEach(button => button.disabled = true);
  message.textContent = '正在提交文章到 GitHub…';
  try {
    const response = await fetch('/api/publish', {method:'POST', headers:{'Content-Type':'application/json', 'X-CSRF-Token':connection.csrf}, body:JSON.stringify({baseCommit, article:submitted})});
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 409) document.getElementById('reload-articles').hidden = false;
      if (response.status === 401) { connection.authenticated = false; updateConnection(); }
      throw new Error(data.error || '发布失败，草稿已保留。');
    }
    baseCommit = data.commit;
    const index = articles.findIndex(article => article.slug === originalSlug);
    if (index >= 0) articles[index] = data.article; else articles.unshift(data.article);
    try {
      await draftTransaction(latest => {
        const previous = latest[originalSlug];
        const own = version(previous) === openedVersion ? previous : previous?.backups?.find(backup => version(backup) === openedVersion);
        if (!own) return;
        own.basePublished = fingerprint(data.article);
        if (originalSlug === 'new-article') {
          own.publishedSlug = data.article.slug;
          latest[data.article.slug] = {...own, ...data.article};
        }
      });
    } catch { /* The submitted article is safe on GitHub; local storage may be unavailable. */ }
    await selectArticle(data.article, {published:true});
    message.textContent = '文章已提交，正在等待博客更新…';
    watchDeployment(data.commit, data.url);
  } catch (error) {
    message.textContent = error.message || '网络连接失败，草稿已保留，请稍后重试。';
  } finally {
    publishing = false;
    document.getElementById('article-fields').disabled = false;
    document.getElementById('new-article').disabled = false;
    for (const id of ['save-draft','draft-version','reload-articles']) document.getElementById(id).disabled = false;
    document.getElementById('login').disabled = !connection.configured;
    document.getElementById('publish').disabled = !connection.authenticated || !baseCommit;
    renderList();
  }
});
window.addEventListener('pagehide', saveDraft);
window.addEventListener('beforeunload', event => {
  saveDraft();
  if ((!storageAvailable || dirty) && ready) { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('storage', event => {
  if (event.key !== draftKey) return;
  try { drafts = readDrafts(); renderList(); } catch { return; }
  if (version(drafts[selected]) !== openedVersion && dirty) status.textContent = '另一页更新了草稿，保存时会保留两份';
});

async function loadArticles() {
  try {
    const response = await fetch(connection.authenticated ? '/api/articles' : './articles.json', {cache:'no-store'});
    if (!response.ok) {
      if (response.status === 401) { connection.authenticated = false; updateConnection(); }
      throw new Error('Cannot read published articles');
    }
    const data = await response.json();
    if (!Array.isArray(data.articles)) throw new Error('Invalid article index');
    articles = data.articles;
    baseCommit = data.baseCommit || '';
    document.getElementById('publish').disabled = !connection.authenticated || !baseCommit;
    document.getElementById('reload-articles').hidden = true;
    let last;
    try { last = localStorage.getItem(selectionKey); } catch { /* Use the default article when storage is unavailable. */ }
    const first = articles.find(article => article.slug === last) || (last === 'new-article' && validDraft(drafts[last]) ? drafts[last] : null) || articles.find(article => article.slug === 'leetcode-005-container-with-most-water') || articles[0];
    if (first) await selectArticle(first);
    else {
      ready = true;
      await selectArticle({slug:'new-article', title:'', category:'生活随笔', date:today(), summary:'', collection:'', body:''});
    }
  } catch {
    baseCommit = '';
    document.getElementById('publish').disabled = true;
    document.getElementById('library-count').textContent = '暂时无法读取文章';
    const restored = Object.values(drafts).filter(validDraft).sort((a, b) => b.updated - a.updated)[0];
    await selectArticle(restored || {slug:'new-article', title:'', category:'生活随笔', date:today(), summary:'', collection:'', body:''});
    message.textContent = '暂时无法读取博客文章。仍可继续写作和保存本机草稿，联网后刷新重试。';
  }
}

function updateConnection() {
  const login = document.getElementById('login');
  login.disabled = !connection.configured;
  login.textContent = connection.authenticated ? '退出 GitHub' : '登录 GitHub';
  document.querySelector('.connection-note').textContent = connection.authenticated
    ? '已登录 pangchuanwang。草稿保存在当前浏览器；点击发布后，博客会自动更新。'
    : connection.configured ? '登录 GitHub 后可以发布。草稿自动保存在当前浏览器。'
      : 'GitHub 连接尚未配置。可以写作和保存本机草稿，暂时不能发布。';
}
document.getElementById('login').addEventListener('click', async () => {
  if (!await flushDraft()) return;
  if (!connection.authenticated) { window.location.assign('/auth/github/start'); return; }
  try {
    const response = await fetch('/api/logout', {method:'POST', headers:{'X-CSRF-Token':connection.csrf}});
    if (!response.ok) throw new Error();
    connection.authenticated = false;
    baseCommit = '';
    document.getElementById('publish').disabled = true;
    updateConnection();
    message.textContent = '已退出 GitHub，本机草稿仍保留。';
  } catch { message.textContent = '暂时无法退出，请稍后重试。'; }
});
document.getElementById('reload-articles').addEventListener('click', async () => { if (await flushDraft()) await loadArticles(); });
async function watchDeployment(commit, url, attempts = 0) {
  clearTimeout(deploymentTimer);
  if (attempts >= 24) { message.textContent = '文章已提交，博客更新仍在进行。可以稍后查看博客。'; return; }
  try {
    const response = await fetch('/api/deployment?commit=' + commit, {cache:'no-store'});
    const data = await response.json();
    if (!response.ok) throw new Error();
    if (data.status === 'completed') {
      message.replaceChildren(document.createTextNode(data.conclusion === 'success' ? '博客已更新。' : '文章已保存到 GitHub，但博客更新失败。'));
      const link = document.createElement('a');
      link.href = data.conclusion === 'success' ? url : (data.url || 'https://github.com/pangchuanwang/cw.pang-blog/actions');
      link.textContent = data.conclusion === 'success' ? '查看文章 ↗' : '查看更新记录 ↗';
      link.target = '_blank'; link.rel = 'noopener';
      message.append(link);
      return;
    }
  } catch { /* A polling failure must not present an unverified deployment as successful. */ }
  deploymentTimer = setTimeout(() => watchDeployment(commit, url, attempts + 1), 10000);
}
async function initialize() {
  try {
    const response = await fetch('/api/session', {cache:'no-store'});
    if (response.ok) connection = await response.json();
  } catch { /* Static/local preview remains usable without the service. */ }
  updateConnection();
  await loadArticles();
}
initialize();
