const categories = ['生活随笔', '科研笔记', '学习笔记'];
const category = new URLSearchParams(window.location.search).get('category');
if (categories.includes(category)) {
  const rows = Array.from(document.querySelectorAll('.post-row'));
  const learning = category === '学习笔记';
  rows.forEach(row => {
    row.hidden = row.dataset.category !== category || (learning && row.dataset.collection === 'leetcode-hot-100');
  });
  document.getElementById('learning-folders').hidden = !learning;
  document.getElementById('other-learning-title').hidden = !learning;
  document.getElementById('list-title').textContent = category;
  const count = rows.filter(row => !row.hidden).length;
  document.getElementById('post-count').textContent = learning
    ? `1 个专题 · ${count} 篇其他笔记`
    : `${String(count).padStart(2, '0')} 篇记录`;
  document.querySelectorAll('.header nav a').forEach(link => {
    link.removeAttribute('aria-current');
    if (new URL(link.href).searchParams.get('category') === category) link.setAttribute('aria-current', 'page');
  });
  document.title = `${category} · cw.pang-blog`;
}
