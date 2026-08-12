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
  selectedRollIds.clear();
  updateSelectedSummary();

  if (!readyRollsList.length) {
    container.innerHTML = `<div class="challan-empty-state">No ready items available.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="challan-items-grid">
      ${readyRollsList.map((roll, idx) => {
        const id = roll.id || roll._id;
        const isSelected = selectedRollIds.has(id);
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
              <span>Ready stock</span>
              <strong>₹${Number(roll.rate || 0).toFixed(2)}/m</strong>
            </div>
          </label>
        `;
      }).join('')}
    </div>
  `;
}

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
      rollNo: r.rollNo,
      quality: r.quality || '',
      meters: r.meters || 0,
      weight: r.weight || 0
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
    await sendRequest('challans', 'POST', payload);
    showToast('Challan Generated Successfully!');
    clearChallanForm();
    await renderChallanPage();
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

function printChallan(id) {
  sendRequest(`challans`).then(challans => {
    const c = challans.find(item => item._id === id);
    if (!c) return showToast('Challan record not found', 'error');

    const printWin = window.open('', '_blank', 'width=800,height=600');
    printWin.document.write(`
      <html>
        <head>
          <title>Delivery Challan - ${c.challanNo}</title>
          <style>
            body { font-family: sans-serif; padding: 24px; color: #000; }
            h2 { text-align: center; margin-bottom: 4px; }
            .header-info { display: flex; justify-content: space-between; margin-top: 20px; border-bottom: 2px solid #000; padding-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background: #f2f2f2; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <h2>DELIVERY CHALLAN</h2>
          <div class="header-info">
            <div>
              <strong>Challan No:</strong> ${c.challanNo}<br>
              <strong>Date:</strong> ${new Date(c.deliveryDate).toLocaleDateString('en-IN')}<br>
              <strong>Transport:</strong> ${c.transport || 'N/A'}
            </div>
            <div>
              <strong>Party Name:</strong> ${c.partyName}<br>
              <strong>Address:</strong> ${c.address || 'N/A'}<br>
              <strong>GST/Mobile:</strong> ${c.gstOrMobile || 'N/A'}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Roll / Item No</th>
                <th>Quality</th>
                <th>Meters</th>
              </tr>
            </thead>
            <tbody>
              ${c.items.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.rollNo}</td>
                  <td>${item.quality || '—'}</td>
                  <td>${item.meters} m</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <th colspan="3" style="text-align:right">Total Items: ${c.totalItems}</th>
                <th>Total: ${c.totalMeters.toFixed(1)} m</th>
              </tr>
            </tfoot>
          </table>

          <div class="footer">
            <div>Receiver's Signature</div>
            <div>Authorised Signatory</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWin.document.close();
  });
}