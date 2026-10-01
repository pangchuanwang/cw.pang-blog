const categories = ['生活随笔', '科研笔记', '学习笔记'];
const category = new URLSearchParams(window.location.search).get('category');
if (categories.includes(category)) {
  const rows = Array.from(document.querySelectorAll('.post-row'));
  rows.forEach(row => { row.hidden = row.dataset.category !== category; });
  document.getElementById('list-title').textContent = category;
  document.getElementById('post-count').textContent = `${String(rows.filter(row => !row.hidden).length).padStart(2, '0')} 篇记录`;
  document.querySelectorAll('.header nav a').forEach(link => {
    link.removeAttribute('aria-current');
    if (new URL(link.href).searchParams.get('category') === category) link.setAttribute('aria-current', 'page');
  });
  document.title = `${category} · cw.pang-blog`;
}
