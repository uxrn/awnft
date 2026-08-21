const TOTAL = 1138;
const STORAGE_BASE = 'https://storage.artwarsnft.com';

// The 6 tokens whose original high-res images were removed
const REMOVED_TOKENS = new Set([475, 558, 823, 859, 866, 1076]);
const REPLACEMENT_CID = 'QmNuKoQdRtASNfuir3G96uRqrMAZoV64KSJfo3hCoEhmPS';

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
const artistFilter   = document.getElementById('artist-filter');

let metadata = {};

// ── Load local metadata.json once ──
async function loadMetadata() {
  try {
    const res = await fetch('metadata.json');
    if (!res.ok) throw new Error('Failed to load metadata.json');
    metadata = await res.json();
    console.log(`Loaded metadata for ${Object.keys(metadata).length} tokens`);

    // Build unique artist list
    const artists = new Set();
    Object.values(metadata).forEach(m => {
      if (m.attributes) {
        m.attributes.forEach(a => {
          if (a.trait_type === 'Artist' && a.value) {
            artists.add(a.value);
          }
        });
      }
    });

    // Populate the dropdown (sorted alphabetically)
    const sortedArtists = Array.from(artists).sort((a, b) => a.localeCompare(b));
    sortedArtists.forEach(artist => {
      const opt = document.createElement('option');
      opt.value = artist;
      opt.textContent = artist;
      artistFilter.appendChild(opt);
    });

    // Add "Removed" option at the bottom
    const removedOpt = document.createElement('option');
    removedOpt.value = '__removed__';
    removedOpt.textContent = 'Removed';
    artistFilter.appendChild(removedOpt);

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

    if (REMOVED_TOKENS.has(id)) {
      card.classList.add('removed');
    }

    const label = document.createElement('div');
    label.className = 'label';

    if (REMOVED_TOKENS.has(id)) {
      label.innerHTML = `<span>#${id}</span><span class="removed-tag">REMOVED</span>`;
    } else {
      label.textContent = `#${id}`;
    }

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
      img.src = `${STORAGE_BASE}/nft/${id}.png`;
      img.onload  = () => card.classList.remove('loading');
      img.onerror = () => card.classList.remove('loading');
      card.insertBefore(img, card.querySelector('.label'));
    });
  }, { rootMargin: '400px' });

  document.querySelectorAll('.nft-card.loading').forEach(c => observer.observe(c));
}

// ── Combined filter (search + artist) ──
function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  const selectedArtist = artistFilter.value;

  let tokens = allTokens;

  // Artist / Removed filter
  if (selectedArtist === '__removed__') {
    tokens = tokens.filter(id => REMOVED_TOKENS.has(id));
  } else if (selectedArtist !== 'all') {
    tokens = tokens.filter(id => {
      const meta = metadata[String(id)] || metadata[id];
      if (!meta || !meta.attributes) return false;
      return meta.attributes.some(a => a.trait_type === 'Artist' && a.value === selectedArtist);
    });
  }

  // Token number search
  if (q !== '') {
    tokens = tokens.filter(id => String(id).includes(q));
  }

  renderGrid(tokens);
}

// Wire up both controls
searchInput.addEventListener('input', applyFilters);
artistFilter.addEventListener('change', applyFilters);

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

  const isRemoved = REMOVED_TOKENS.has(id);
  const cid = extractCid(meta.image);

  // ── Image pane ──
  if (isRemoved) {
    // Show both low-res (original) and replacement high-res side by side
    detailImgPane.innerHTML = `
      <div class="detail-removed-images">
        <img src="${STORAGE_BASE}/cid/${REPLACEMENT_CID}.png" alt="Replacement image">
        <img src="${STORAGE_BASE}/nft/${id}.png" alt="Art Wars #${id} (low-res)">
      </div>
    `;
  } else if (cid) {
    const img = document.createElement('img');
    img.alt = `Art Wars #${id}`;
    img.className = 'img-fluid';
    img.src = `${STORAGE_BASE}/cid/${cid}.png`;
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

  // ── Info pane ──
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

  const imgUrl = isRemoved
    ? `${STORAGE_BASE}/cid/${REPLACEMENT_CID}.png`
    : (cid ? `${STORAGE_BASE}/cid/${cid}.png` : null);

  html += `<p class="text-uppercase text-muted mb-1" style="font-size:.7rem;letter-spacing:.08em">Links</p>
    <ul class="list-unstyled small mb-4">
      ${imgUrl ? `<li class="mb-1"><span class="text-muted">Image:</span> <a href="${imgUrl}" target="_blank" rel="noopener" class="text-break">${imgUrl}</a></li>` : ''}
      ${meta.external_url ? `<li class="mb-1"><span class="text-muted">External URL:</span> <a href="${meta.external_url}" target="_blank" rel="noopener">${meta.external_url}</a></li>` : ''}
    </ul>`;

  // Normal metadata JSON block
  html += `<p class="text-uppercase text-muted mb-1" style="font-size:.7rem;letter-spacing:.08em">Metadata JSON</p>
    <pre class="json-block">${syntaxHighlight(JSON.stringify(meta, null, 2))}</pre>`;

  // Special red warning for the 6 removed tokens
  if (isRemoved) {
    html += `
      <div class="removed-warning">
        <strong>Image Removed</strong>
        The original high resolution image of this NFT was removed from the project and replaced.
        You are viewing the original low resolution image and the replacement image.
        If you have access to the original high resolution image, please send it to
        <a href="mailto:info@artwarsnft.com">info@artwarsnft.com</a>.
      </div>
    `;
  }

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
  applyFilters();          // ← changed from renderGrid(allTokens)
})();