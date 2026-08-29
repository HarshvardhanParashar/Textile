import { sendRequest } from '../api.js';

let cachedReadyItems = [];

export function setupReadyHandlers() {
  const typeFilter = document.getElementById('ready-filter');
  const gradeFilter = document.getElementById('ready-grade-filter');
  const searchInput = document.getElementById('ready-search');

  window.refreshReadyGrid = () => renderReadyGridUI(cachedReadyItems);

  if (typeFilter) typeFilter.addEventListener('change', window.refreshReadyGrid);
  if (gradeFilter) gradeFilter.addEventListener('change', window.refreshReadyGrid);
  if (searchInput) searchInput.addEventListener('input', window.refreshReadyGrid);
}

export async function renderReadyToSellPage() {
  const grid = document.getElementById('ready-grid');
  try {
    // 1. Fetch from readytosell collection
    const dedicatedReady = await sendRequest('readytosell').catch(() => []);

    // 2. Fetch Grey Rolls where status === 'Ready'
    const allGreyRolls = await sendRequest('greyrolls').catch(() => []);
    const readyGreyRolls = allGreyRolls
      .filter(roll => (roll.status || '').toLowerCase() === 'ready')
      .map(roll => ({
        _id: roll._id,
        itemCode: roll.no ? `Roll #${roll.no}` : 'Grey Roll',
        itemType: 'grey',
        fabricType: `${roll.construction || 'Finished Fabric'}`,
        quantityMeters: roll.meters || 0,
        pricePerMeter: 0,
        qualityGrade: roll.quality || 'Sell',
        width: roll.width || ''
      }));

    // Combine both sets of ready items
    cachedReadyItems = [...readyGreyRolls, ...(Array.isArray(dedicatedReady) ? dedicatedReady : [])];

    renderReadyGridUI(cachedReadyItems);
  } catch (err) {
    console.error('Error fetching ready stock:', err);
    if (grid) {
      grid.innerHTML = `<div style="color:#ef4444; padding:20px; text-align:center; width:100%;">⚠️ Failed to load Ready to Sell inventory.</div>`;
    }
  }
}

function renderReadyGridUI(items = []) {
  const grid = document.getElementById('ready-grid');
  if (!grid) return;

  const typeVal = document.getElementById('ready-filter')?.value || '';
  const gradeVal = document.getElementById('ready-grade-filter')?.value || '';
  const query = document.getElementById('ready-search')?.value.toLowerCase().trim() || '';

  const filtered = items.filter(item => {
    const itemType = (item.itemType || item.type || 'grey').toLowerCase();
    const matchType = !typeVal || itemType === typeVal.toLowerCase();
  const itemGrade = item.qualityGrade || item.quality || item.grade || 'Sell';
    const matchGrade = !gradeVal || itemGrade.toLowerCase() === gradeVal.toLowerCase();
    
    const searchTarget = `${item.itemCode || item.no || ''} ${item.fabricType || item.weave || ''} ${item.construction || ''}`.toLowerCase();
    const matchSearch = !query || searchTarget.includes(query);

    return matchType && matchGrade && matchSearch;
  });

  // Calculate Metrics
  const totalCount = filtered.length;
  const totalMeters = filtered.reduce((acc, i) => acc + (parseFloat(i.quantityMeters || i.meters) || 0), 0);
  const totalValue = filtered.reduce((acc, i) => {
    const m = parseFloat(i.quantityMeters || i.meters) || 0;
    const r = parseFloat(i.pricePerMeter || i.rate) || 0;
    return acc + (m * r);
  }, 0);
  const avgRate = totalMeters > 0 ? (totalValue / totalMeters) : 0;

  // Update Summary Cards
  if (document.getElementById('rts-total-count')) document.getElementById('rts-total-count').textContent = totalCount;
  if (document.getElementById('rts-total-meters')) document.getElementById('rts-total-meters').textContent = `${totalMeters.toFixed(0)} m`;
  if (document.getElementById('rts-avg-rate')) document.getElementById('rts-avg-rate').textContent = `₹${avgRate.toFixed(2)}`;
  if (document.getElementById('rts-total-value')) document.getElementById('rts-total-value').textContent = `₹${totalValue.toFixed(2)}`;

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="color:#64748b; padding:30px; text-align:center; width:100%;">No ready-to-sell items matching your selection.</div>`;
    return;
  }

  const groupedItems = new Map();
  filtered.forEach(item => {
    const groupLabel = getGroupLabel(item);
    if (!groupedItems.has(groupLabel)) groupedItems.set(groupLabel, []);
    groupedItems.get(groupLabel).push(item);
  });

  grid.innerHTML = [...groupedItems.entries()].map(([groupLabel, groupItems]) => {
    const groupMeters = groupItems.reduce((total, item) => total + (parseFloat(item.quantityMeters || item.meters) || 0), 0);
    const cards = groupItems.map(item => {
      const meters = parseFloat(item.quantityMeters || item.meters) || 0;
      const rate = parseFloat(item.pricePerMeter || item.rate) || 0;
      const totalItemValue = meters * rate;
      const quality = item.qualityGrade || item.quality || item.grade || 'Sell';
      const code = item.itemCode || (item.no ? `Roll #${item.no}` : 'RTS Item');
      const typeLabel = item.itemType === 'yarn' ? '🧶 Yarn' : item.itemType === 'beam' ? '🪡 Beam' : '🩶 Grey Roll';

      return `
        <div class="ready-card" data-ready-item-id="${item._id || item.id || ''}" style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:16px; width:250px; box-shadow:0 1px 3px rgba(0,0,0,0.05); cursor:pointer;">
          <div style="display:inline-flex; align-items:center; gap:4px; background:#f1f5f9; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600; color:#475569; margin-bottom:10px;">
            ${typeLabel}
          </div>
          <div style="font-size:16px; font-weight:700; color:#0f172a; margin-bottom:4px;">${code}</div>
          <div style="font-size:12px; color:#64748b; margin-bottom:6px;">${item.fabricType || 'Finished Fabric'}</div>
          <div style="font-size:12px; font-weight:600; color:#334155; margin-bottom:8px;">
            ${item.width ? item.width + ' · ' : ''}<strong>${meters} m</strong>
          </div>
          <div style="margin-bottom:12px;">
            <span style="background:${quality === 'Standard' ? '#e0f2fe' : '#fef3c7'}; color:${quality === 'Standard' ? '#0369a1' : '#d97706'}; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600;">
              ${quality}
            </span>
          </div>
          <div style="font-size:12px; color:#475569; border-top:1px dashed #e2e8f0; padding-top:8px;">
            ₹${rate}/m · <strong>Total ₹${totalItemValue.toFixed(0)}</strong>
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="ready-group collapsed" style="width:100%; margin-bottom:12px;">
        <div class="ready-group-header" role="button" tabindex="0" onclick="toggleReadyGroup(this.closest('.ready-group'))" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleReadyGroup(this.closest('.ready-group')); }" style="display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid #cbd5e1; padding:4px 2px 8px; margin-bottom:12px; cursor:pointer;">
          <strong style="font-size:15px; color:#0f172a;">${groupLabel}</strong>
          <div style="display:flex; align-items:center; gap:10px; color:#64748b; font-size:12px; font-weight:700;">
            <span><strong>${groupItems.length}</strong> roll${groupItems.length === 1 ? '' : 's'} · <strong>${groupMeters.toFixed(0)} m</strong></span>
            <span class="ready-toggle-icon" style="display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background:#f1f5f9; transition:transform 0.2s ease; transform:rotate(-90deg);">▾</span>
          </div>
        </div>
        <div class="ready-group-body" style="display:none; flex-wrap:wrap; gap:16px;">${cards}</div>
      </section>
    `;
  }).join('');

  grid.querySelectorAll('.ready-card[data-ready-item-id]').forEach(card => {
    card.addEventListener('click', async () => {
      window.pendingChallanItemId = card.dataset.readyItemId;
      await window.showPage('challan');
    });
  });
}

window.toggleReadyGroup = (group) => {
  if (!group) return;
  group.classList.toggle('collapsed');
  const body = group.querySelector('.ready-group-body');
  const icon = group.querySelector('.ready-toggle-icon');
  if (!body || !icon) return;
  body.style.display = group.classList.contains('collapsed') ? 'none' : 'flex';
  icon.style.transform = group.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)';
};

function getGroupLabel(item) {
  const fabricType = String(item.fabricType || item.construction || 'Finished Fabric').trim();
  const width = String(item.width || '').trim();
  if (!width || fabricType.includes('=')) return fabricType;
  return `${fabricType}=${width}''`;
}