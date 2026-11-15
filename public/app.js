const $ = (id) => document.getElementById(id);
const form = $('form');
const input = $('url');
const go = $('go');
const notice = $('notice');
const result = $('result');
const list = $('items');
let post = null;

function say(text, bad = false) {
  notice.hidden = !text;
  notice.textContent = text || '';
  notice.classList.toggle('bad', bad);
}

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

const clock = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');
const megabytes = (n) => (n ? `${(n / 1048576).toFixed(1)} MB` : '');

function render() {
  $('author').textContent = post.author ? `@${post.author}` : 'Instagram post';
  $('caption').textContent = post.caption || '';
  list.replaceChildren();
  for (const item of post.items) {
    const node = $('item-tpl').content.firstElementChild.cloneNode(true);
    const img = node.querySelector('img');
    if (item.thumbnail) {
      img.src = item.thumbnail;
      img.addEventListener('error', () => img.remove());
    } else img.remove();
    const facts = [post.items.length > 1 ? `Video ${item.index}` : 'Video', clock(item.duration), item.width && item.height ? `${item.width}x${item.height}` : ''];
    node.querySelector('.facts').textContent = facts.filter(Boolean).join(' · ');
    if (!item.hasAudio) {
      const mp3 = node.querySelector('[data-format="mp3"]');
      mp3.disabled = true;
      mp3.dataset.off = '1';
      mp3.textContent = 'No sound';
      mp3.title = 'Instagram reports this video has no sound.';
    }
    for (const button of node.querySelectorAll('button')) {
      button.addEventListener('click', () => download(node, item, button.dataset.format));
    }
    list.append(node);
  }
  result.hidden = false;
}

async function download(node, item, format) {
  const buttons = node.querySelectorAll('button');
  const box = node.querySelector('.progress');
  const bar = node.querySelector('.bar span');
  const label = box.querySelector('small');
  buttons.forEach((b) => (b.disabled = true));
  box.hidden = false;
  box.classList.remove('bad');
  bar.style.width = '2%';
  label.textContent = 'Starting';
  try {
    const { id } = await api('/api/prepare', {
      url: post.link, item: item.index, format, author: post.author, code: post.code, items: post.items.length,
    });
    for (;;) {
      await new Promise((r) => setTimeout(r, 600));
      const job = await api(`/api/job/${id}`);
      bar.style.width = `${Math.max(2, job.percent)}%`;
      label.textContent = `${job.message} ${job.percent}%`;
      if (job.state === 'error') throw new Error(job.message);
      if (job.state === 'done') {
        const a = document.createElement('a');
        a.href = `/api/file/${id}`;
        a.download = job.name;
        document.body.append(a);
        a.click();
        a.remove();
        label.textContent = `Saved ${job.name} ${megabytes(job.size)}`.trim();
        break;
      }
    }
  } catch (err) {
    box.classList.add('bad');
    bar.style.width = '0';
    label.textContent = err.message;
  } finally {
    buttons.forEach((b) => (b.disabled = Boolean(b.dataset.off)));
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  result.hidden = true;
  go.disabled = true;
  go.textContent = 'Looking';
  say('Asking Instagram for this post.');
  try {
    post = await api('/api/info', { url: input.value });
    say('');
    render();
  } catch (err) {
    say(err.message, true);
  } finally {
    go.disabled = false;
    go.textContent = 'Find video';
  }
});

$('paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      input.value = text.trim();
      form.requestSubmit();
    }
  } catch {
    input.focus();
    say('Your browser blocked clipboard access. Press Ctrl+V or Cmd+V in the box.');
  }
});

api('/api/health')
  .then((h) => {
    if (!h.engine) say('yt-dlp is missing. Run "node scripts/setup.mjs" in the ReelSave folder.', true);
    else if (!h.ffmpeg) say('ffmpeg is missing. Some videos will fail. Run "node scripts/setup.mjs" for install steps.', true);
    $('engine').textContent = h.engine ? `Engine: yt-dlp ${h.engine}` : '';
  })
  .catch(() => {});
