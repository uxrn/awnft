const TOTAL = 1138;

// Your Cloudflare R2 custom domain
const STORAGE_BASE = 'https://storage.artwarsnft.com';

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

let metadata = {};          // will hold the entire metadata.json
const metaCache = {};       // just in case

// ── Load local metadata.json once ──
async function loadMetadata() {
  try {
    const res = await fetch('metadata.json');
    if (!res.ok) throw new Error('Failed to load metadata.json');
    metadata = await res.json();
    console.log(`Loaded metadata for ${Object.keys(metadata).length} tokens`);
  } catch (err) {
    console.error(err);
    alert('Could not load metadata.json. Make sure the file is in the same folder as the page.');
  }
}

// ── Extract raw CID from any /ipfs/CID or gateway URL ──
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
    const col = document.createElement('div');
    col.className = 'col';

    const card = document.createElement('div');
    card.className  = 'nft-card loading';
    card.dataset.id = id;

    const label = document.createElement('div');
    label.className   = 'label';
    label.textContent = `#${id}`;
    card.appendChild(label);

    card.addEventListener('click', () => openDetail(id));
    col.appendChild(card);
    gridEl.appendChild(col);
  });

  observeCards();
}

// ── Lazy-load thumbnails ──
let observer;
function observeCards() {
  if (observer) observer.disconnect();

  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      observer.unobserve(card);

      const id = parseInt(card.dataset.id, 10);
      const img = document.createElement('img');
      img.alt = `Art Wars #${id}`;
      img.src = `${STORAGE_BASE}/nft/${id}.png`;   // ← low-res from R2
      img.onload  = () => card.classList.remove('loading');
      img.onerror = () => card.classList.remove('loading');
      card.insertBefore(img, card.querySelector('.label'));
    });
  }, { rootMargin: '400px' });

  document.querySelectorAll('.nft-card.loading').forEach(c => observer.observe(c));
}

// ── Search ──
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  const tokens = q === ''
    ? allTokens
    : allTokens.filter(id => String(id).includes(q));
  renderGrid(tokens);
});

// ── Open detail view ──
async function openDetail(id) {
  detail.classList.add('active');
  document.body.style.overflow = 'hidden';
  detailTitle.textContent = `Art Wars #${id}`;
  detailImgPane.innerHTML  = '<div class="spinner-border text-secondary" role="status"></div>';
  detailInfoPane.innerHTML = '<div class="spinner-border text-secondary" role="status"></div>';

  const meta = metadata[String(id)] || metadata[id];
  if (!meta) {
    detailImgPane.innerHTML  = '<p class="text-muted">Metadata not found.</p>';
    detailInfoPane.innerHTML = '';
    return;
  }

  const cid = extractCid(meta.image);

  // High-res image from R2
  if (cid) {
    const img = document.createElement('img');
    img.alt = `Art Wars #${id}`;
    img.className = 'img-fluid';
    img.src = `${STORAGE_BASE}/cid/${cid}.png`;   // ← high-res from R2
    img.onload  = () => {
      detailImgPane.innerHTML = '';
      detailImgPane.appendChild(img);
    };
    img.onerror = () => {
      detailImgPane.innerHTML = '<p class="text-muted">High-res image unavailable.</p>';
    };
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

  const imgUrl = cid ? `${STORAGE_BASE}/cid/${cid}.png` : null;

  html += `<p class="text-uppercase text-muted mb-1" style="font-size:.7rem;letter-spacing:.08em">Links</p>
    <ul class="list-unstyled small mb-4">
      ${imgUrl ? `<li class="mb-1"><span class="text-muted">Full Image:</span> <a href="${imgUrl}" target="_blank" rel="noopener" class="text-break">${imgUrl}</a></li>` : ''}
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
(async () => {
  await loadMetadata();
  renderGrid(allTokens);
})();
