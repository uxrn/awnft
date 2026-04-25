const TOTAL      = 1138;
const META_BASE  = 'https://ipfs.io/ipfs/QmUxQBiUEwBTN5t7ogq44CFn9vtU46pekRr1heavb2qEKp';
const IMG_GATEWAY = 'https://ipfs.io/ipfs';
const THUMB_BASE = 'https://storage.googleapis.com/nftimagebucket/tokens/0x3c76001c4d31c7f25a10235dda4ecddfe5e719f4';

const allTokens = Array.from({ length: TOTAL }, (_, i) => i + 1);

const gridEl         = document.getElementById('grid');
const searchInput    = document.getElementById('search');
const resultCount    = document.getElementById('result-count');
const emptyMsg       = document.getElementById('empty');
const detail         = document.getElementById('detail');
const detailTitle    = document.getElementById('detail-title');
const detailImgPane  = document.getElementById('detail-image-pane');
const detailInfoPane = document.getElementById('detail-info-pane');
const backBtn        = document.getElementById('back-btn');

const metaCache = {};

// ── Fetch metadata JSON from IPFS ──
async function fetchMeta(id) {
  if (metaCache[id]) return metaCache[id];
  try {
    const r    = await fetch(`${META_BASE}/${id}`);
    const json = await r.json();
    metaCache[id] = json;
    return json;
  } catch (e) {
    return null;
  }
}

// ── Extract raw CID from any /ipfs/CID URL ──
function extractCid(url) {
  if (!url) return null;
  const m = url.match(/\/ipfs\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

// ── Render grid ──
function renderGrid(tokens) {
  gridEl.innerHTML = '';
  emptyMsg.style.display = tokens.length === 0 ? 'block' : 'none';
  resultCount.textContent = tokens.length === TOTAL
    ? `${TOTAL.toLocaleString()} NFTs`
    : `${tokens.length.toLocaleString()} of ${TOTAL.toLocaleString()} NFTs`;

  tokens.forEach(id => {
    const col  = document.createElement('div');
    col.className = 'col';

    const card = document.createElement('div');
    card.className   = 'nft-card loading';
    card.dataset.id  = id;

    const label = document.createElement('div');
    label.className  = 'label';
    label.textContent = `#${id}`;
    card.appendChild(label);

    card.addEventListener('click', () => openDetail(id));
    col.appendChild(card);
    gridEl.appendChild(col);
  });

  observeCards();
}

// ── Lazy-load thumbnails via IntersectionObserver ──
let observer;
function observeCards() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      observer.unobserve(card);
      const id  = parseInt(card.dataset.id);
      const img = document.createElement('img');
      img.alt    = `Art Wars #${id}`;
      img.src    = `${THUMB_BASE}/${id}.png`;
      img.onload  = () => card.classList.remove('loading');
      img.onerror = () => card.classList.remove('loading');
      card.insertBefore(img, card.querySelector('.label'));
    });
  }, { rootMargin: '400px' });

  document.querySelectorAll('.nft-card.loading').forEach(c => observer.observe(c));
}

// ── Search ──
searchInput.addEventListener('input', () => {
  const q      = searchInput.value.trim();
  const tokens = q === '' ? allTokens : allTokens.filter(id => String(id).includes(q));
  renderGrid(tokens);
});

// ── Open detail view ──
async function openDetail(id) {
  detail.classList.add('active');
  document.body.style.overflow = 'hidden';
  detailTitle.textContent  = `Art Wars #${id}`;
  detailImgPane.innerHTML  = '<div class="spinner-border text-secondary" role="status"></div>';
  detailInfoPane.innerHTML = '<div class="spinner-border text-secondary" role="status"></div>';

  const meta = await fetchMeta(id);
  if (!meta) {
    detailImgPane.innerHTML  = '<p class="text-muted">Failed to load metadata.</p>';
    detailInfoPane.innerHTML = '';
    return;
  }

  const cid = extractCid(meta.image);

  // Image pane
  if (cid) {
    const img = document.createElement('img');
    img.alt       = `Art Wars #${id}`;
    img.className = 'img-fluid';
    img.src       = `${IMG_GATEWAY}/${cid}`;
    img.onload  = () => { detailImgPane.innerHTML = ''; detailImgPane.appendChild(img); };
    img.onerror = () => { detailImgPane.innerHTML = '<p class="text-muted">Image unavailable.</p>'; };
  } else {
    detailImgPane.innerHTML = '<p class="text-muted">No image found.</p>';
  }

  // Info pane
  let html = `<h5 class="mb-3">Art Wars #${id}</h5>`;

  if (meta.attributes && meta.attributes.length > 0) {
    html += `<p class="text-uppercase text-muted mb-1" style="font-size:.7rem;letter-spacing:.08em">Traits</p>
             <div class="d-flex flex-wrap gap-2 mb-4">`;
    meta.attributes.forEach(a => {
      html += `<div class="border rounded px-3 py-2 bg-light" style="font-size:.8rem">
        <div class="text-muted" style="font-size:.65rem;text-transform:uppercase;letter-spacing:.06em">${a.trait_type}</div>
        <div class="fw-semibold">${a.value}</div>
      </div>`;
    });
    html += `</div>`;
  }

  const metaUrl = `${META_BASE}/${id}`;
  const imgUrl  = cid ? `${IMG_GATEWAY}/${cid}` : null;
  html += `<p class="text-uppercase text-muted mb-1" style="font-size:.7rem;letter-spacing:.08em">Links</p>
    <ul class="list-unstyled small mb-4">
      <li class="mb-1"><span class="text-muted">Metadata (IPFS):</span> <a href="${metaUrl}" target="_blank" rel="noopener" class="text-break">${metaUrl}</a></li>
      ${imgUrl  ? `<li class="mb-1"><span class="text-muted">Full Image (IPFS):</span> <a href="${imgUrl}" target="_blank" rel="noopener" class="text-break">${imgUrl}</a></li>` : ''}
      ${meta.external_url ? `<li class="mb-1"><span class="text-muted">External URL:</span> <a href="${meta.external_url}" target="_blank" rel="noopener">${meta.external_url}</a></li>` : ''}
    </ul>`;

  html += `<p class="text-uppercase text-muted mb-1" style="font-size:.7rem;letter-spacing:.08em">Metadata JSON</p>
    <pre class="json-block">${syntaxHighlight(JSON.stringify(meta, null, 2))}</pre>`;

  detailInfoPane.innerHTML = html;
}

// ── Close detail view ──
backBtn.addEventListener('click', closeDetail);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && detail.classList.contains('active')) closeDetail();
});

function closeDetail() {
  detail.classList.remove('active');
  document.body.style.overflow = '';
}

// ── JSON syntax highlighter ──
function syntaxHighlight(json) {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      m => {
        let cls = 'num';
        if (/^"/.test(m)) cls = /:$/.test(m) ? 'key' : 'str';
        return `<span class="${cls}">${m}</span>`;
      }
    );
}

// ── Init ──
renderGrid(allTokens);
