import { sendRequest, showToast } from '../api.js';

let readyRollsList = [];
let selectedRollIds = new Set();

export function setupChallanHandlers() {
  // Set default date input
  const dateInput = document.getElementById('ch-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Generate Challan Button Listener
  document.getElementById('btn-generate-challan')?.addEventListener('click', generateChallan);

  // Global print function attachment
  window.printChallan = printChallan;
}

export async function renderChallanPage() {
  await Promise.all([
    loadReadyItems(),
    loadIssuedChallans()
  ]);
}

export async function renderChallanInterface() {
  await renderChallanPage();
}

async function loadReadyItems() {
  try {
    const [readySellResponse, greyRollResponse] = await Promise.all([
      sendRequest('readytosell').catch(() => []),
      sendRequest('greyrolls').catch(() => [])
    ]);

    const readyToSellItems = Array.isArray(readySellResponse)
      ? readySellResponse.map(item => ({
          ...item,
          id: item._id,
          _id: item._id,
          rollNo: item.itemCode || `RTS-${item._id?.slice(-4) || 'item'}`,
          meters: Number(item.quantityMeters ?? item.meters ?? 0),
          quality: item.qualityGrade || item.quality || 'Standard'
        }))
      : [];

    const readyGreyRolls = Array.isArray(greyRollResponse)
      ? greyRollResponse
          .filter(roll => (roll.status || '').toLowerCase() === 'ready')
          .map(roll => ({
            ...roll,
            id: roll._id,
            _id: roll._id,
            rollNo: roll.no ? `Roll #${roll.no}` : `Roll-${roll._id?.slice(-4) || 'new'}`,
            meters: Number(roll.meters ?? 0),
            quality: roll.grade || roll.quality || 'Standard'
          }))
      : [];

    readyRollsList = [...readyGreyRolls, ...readyToSellItems];
  } catch (err) {
    console.error('Failed to load challan-ready items:', err);
    readyRollsList = [];
  }
  renderReadyItemsSelector();
}

function renderReadyItemsSelector() {
  const container = document.getElementById('ch-items-list');
  const pendingItemId = window.pendingChallanItemId;
  selectedRollIds.clear();

  if (!readyRollsList.length) {
    container.innerHTML = `<div class="challan-empty-state">No ready items available.</div>`;
    return;
  }

  const groupedItems = new Map();
  readyRollsList.forEach(roll => {
    const groupLabel = getGroupLabel(roll);
    if (!groupedItems.has(groupLabel)) groupedItems.set(groupLabel, []);
    groupedItems.get(groupLabel).push(roll);
  });

  container.innerHTML = [...groupedItems.entries()].map(([groupLabel, groupItems]) => `
    <section class="challan-item-group collapsed">
      <div class="challan-item-group-header" role="button" tabindex="0" onclick="toggleChallanGroup(this.closest('.challan-item-group'))" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleChallanGroup(this.closest('.challan-item-group')); }">
        <strong>${groupLabel}</strong>
        <div class="challan-group-meta">
          <span>${groupItems.length} roll${groupItems.length === 1 ? '' : 's'} · ${groupItems.reduce((total, roll) => total + (Number(roll.meters) || 0), 0).toFixed(1)} m</span>
          <span class="challan-toggle-icon">▾</span>
        </div>
      </div>
      <div class="challan-items-grid">
        ${groupItems.map((roll, idx) => {
          const id = roll.id || roll._id;
          const isSelected = pendingItemId && String(id) === String(pendingItemId);
          if (isSelected) selectedRollIds.add(id);
          return `
            <label class="challan-item-card ${isSelected ? 'selected' : ''}">
              <input type="checkbox" value="${id}" onchange="toggleRollSelection('${id}')" ${isSelected ? 'checked' : ''}>
              <div class="challan-item-header">
                <div class="challan-item-badge">${roll.quality || 'Standard'}</div>
                <span class="challan-item-number">${roll.rollNo || `Roll #${idx + 1}`}</span>
              </div>
              <div class="challan-item-meta">
                <span>${Number(roll.meters || 0).toFixed(1)} m</span>
                <span>${roll.quality || 'Standard'}</span>
              </div>
              <div class="challan-item-footer">
                <span>${roll.remarks || 'Ready stock'}</span>
                <strong>₹${Number(roll.rate || 0).toFixed(2)}/m</strong>
              </div>
            </label>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');
  window.pendingChallanItemId = null;
  updateSelectedSummary();
}

function getGroupLabel(item) {
  const construction = String(item.construction || item.fabricType || item.pattern || '').trim();
  const widthValue = Number(item.width || item.wide || item.weaveWidth || 0);

  if (construction && widthValue) {
    return `${construction}=${widthValue}''`;
  }

  if (construction) return construction;
  if (widthValue) return `${widthValue}''`;
  return 'Finished Fabric';
}

window.toggleChallanGroup = (group) => {
  if (!group) return;
  group.classList.toggle('collapsed');
};

window.toggleRollSelection = (rollId) => {
  if (selectedRollIds.has(rollId)) {
    selectedRollIds.delete(rollId);
  } else {
    selectedRollIds.add(rollId);
  }

  document.querySelectorAll('.challan-item-card').forEach((card) => {
    const input = card.querySelector('input[type="checkbox"]');
    if (!input) return;
    const checked = selectedRollIds.has(input.value);
    card.classList.toggle('selected', checked);
    input.checked = checked;
  });

  updateSelectedSummary();
};

function updateSelectedSummary() {
  let count = 0;
  let meters = 0;

  readyRollsList.forEach(r => {
    const id = r.id || r._id;
    if (selectedRollIds.has(id)) {
      count++;
      meters += (Number(r.meters) || 0);
    }
  });

  const countEl = document.getElementById('ch-selected-count');
  const metersEl = document.getElementById('ch-selected-meters');

  if (countEl) countEl.textContent = count;
  if (metersEl) metersEl.textContent = meters.toFixed(1);
}

async function generateChallan() {
  const partyName = document.getElementById('ch-party').value.trim();
  if (!partyName) {
    return showToast('Customer / Party Name is required', 'error');
  }

  if (selectedRollIds.size === 0) {
    return showToast('Please select at least 1 ready item for the challan', 'error');
  }

  const selectedItems = readyRollsList
    .filter(r => selectedRollIds.has(r.id || r._id))
    .map(r => ({
      _id: r._id || r.id,
      source: r.itemCode ? 'readytosell' : 'greyrolls',
      rollNo: r.rollNo,
      quality: r.quality || '',
      remarks: r.remarks || '',
      meters: Number(r.meters || 0),
      weight: Number(r.weight || 0)
    }));

  const payload = {
    partyName,
    address: document.getElementById('ch-address').value.trim(),
    gstOrMobile: document.getElementById('ch-gst').value.trim(),
    transport: document.getElementById('ch-transport').value.trim(),
    deliveryDate: document.getElementById('ch-date').value || new Date().toISOString(),
    remarks: document.getElementById('ch-remarks').value.trim(),
    items: selectedItems
  };

  try {
    // 1. Create the Challan
    await sendRequest('challans', 'POST', payload);

    // 2. Delete/Remove used items from their respective endpoints so they disappear from stock
    await Promise.allSettled(
      selectedItems.map(item => {
        if (item.source === 'readytosell') {
          return sendRequest(`readytosell/${item._id}`, 'DELETE');
        } else {
          // Soft-delete by setting status to 'Dispatched', or call DELETE endpoint
          return sendRequest(`greyrolls/${item._id}`, 'PUT', { status: 'Dispatched' })
            .catch(() => sendRequest(`greyrolls/${item._id}`, 'DELETE'));
        }
      })
    );

    showToast('Challan Generated & Items Removed from Stock!');
    clearChallanForm();
    await renderChallanPage(); // Reload list to reflect changes
  } catch (err) {
    showToast(err.message || 'Failed to generate challan', 'error');
  }
}
async function loadIssuedChallans() {
  const tbody = document.getElementById('issued-challans-body');
  try {
    const challans = await sendRequest('challans');
    if (!challans || !challans.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 22px;">No issued challans found</td></tr>`;
      return;
    }

    tbody.innerHTML = challans.map(c => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px; font-weight: 700; color: #0f172a;">${c.challanNo}</td>
        <td style="padding: 12px;">${c.partyName}</td>
        <td style="padding: 12px;">${c.address || '—'}</td>
        <td style="padding: 12px;">${c.totalItems || c.items.length} items</td>
        <td style="padding: 12px;">${(c.totalMeters || 0).toFixed(1)} m</td>
        <td style="padding: 12px;">${new Date(c.deliveryDate).toISOString().split('T')[0]}</td>
        <td style="padding: 12px;">
          <button onclick="printChallan('${c._id}')" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; color: #334155;">
            🖨️ Print
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 22px;">Failed to load challans</td></tr>`;
  }
}

function clearChallanForm() {
  document.getElementById('ch-party').value = '';
  document.getElementById('ch-address').value = '';
  document.getElementById('ch-gst').value = '';
  document.getElementById('ch-transport').value = '';
  document.getElementById('ch-remarks').value = '';
  selectedRollIds.clear();
  updateSelectedSummary();
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function printChallan(id) {
  sendRequest(`challans`).then(challans => {
    const c = challans.find(item => item._id === id);
    if (!c) return showToast('Challan record not found', 'error');

    const totalMeters = Number(c.totalMeters || c.items.reduce((sum, item) => sum + Number(item.meters || 0), 0));
    const totalItems = Number(c.totalItems || c.items.length);
    const challanRemarks = c.remarks || '—';

    const printWin = window.open('', '_blank', 'width=900,height=700');
    printWin.document.write(`
      <html>
        <head>
          <title>Delivery Challan - ${escapeHtml(c.challanNo)}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              color: #111827;
              background: #fff;
              font-size: 11px;
              line-height: 1.3;
            }
            .sheet {
              width: 100%;
              min-height: 100%;
              box-sizing: border-box;
              padding: 12px 16px 8px;
            }
            h2 {
              margin: 0 0 8px;
              text-align: center;
              letter-spacing: 0.08em;
              font-size: 18px;
            }
            .header-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              border-bottom: 2px solid #111827;
              padding: 8px 0 10px;
              margin-bottom: 10px;
            }
            .info-block strong { display: inline-block; min-width: 110px; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #111827;
              padding: 5px 6px;
              text-align: left;
              vertical-align: top;
              word-wrap: break-word;
            }
            th {
              background: #f3f4f6;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }
            .totals {
              margin-top: 8px;
              border: 1px solid #111827;
              background: #f9fafb;
              padding: 7px 8px;
              font-weight: 700;
            }
            .remarks-box {
              margin-top: 10px;
              border: 1px solid #111827;
              padding: 6px 8px;
              min-height: 42px;
            }
            .footer {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              margin-top: 14px;
              border-top: 2px solid #111827;
              padding-top: 8px;
              font-weight: 600;
            }
            .signature {
              width: 40%;
              text-align: center;
              border-top: 1px solid #111827;
              padding-top: 6px;
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <h2>DELIVERY CHALLAN</h2>
            <div class="header-info">
              <div class="info-block">
                <div><strong>Challan No:</strong> ${escapeHtml(c.challanNo)}</div>
                <div><strong>Date:</strong> ${new Date(c.deliveryDate).toLocaleDateString('en-IN')}</div>
                <div><strong>Transport:</strong> ${escapeHtml(c.transport || 'N/A')}</div>
              </div>
              <div class="info-block">
                <div><strong>Party:</strong> ${escapeHtml(c.partyName)}</div>
                <div><strong>Address:</strong> ${escapeHtml(c.address || 'N/A')}</div>
                <div><strong>GST/Mobile:</strong> ${escapeHtml(c.gstOrMobile || 'N/A')}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 8%;">S.No</th>
                  <th style="width: 35%;">Roll / Item No</th>
                  <th style="width: 18%;">Meters</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${c.items.map((item, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${escapeHtml(item.rollNo || '—')}</td>
                    <td>${Number(item.meters || 0).toFixed(1)} m</td>
                    <td>${escapeHtml(item.remarks || challanRemarks || '—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="totals">
              Total Items: ${totalItems} &nbsp;&nbsp; | &nbsp;&nbsp; Total Meters: ${Number(totalMeters).toFixed(1)} m
            </div>

            <div class="remarks-box">
              <strong>Remarks:</strong> ${escapeHtml(challanRemarks)}
            </div>

            <div class="footer">
              <div class="signature">Receiver's Signature</div>
              <div class="signature">Authorised Signatory</div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWin.document.close();
  });
}
