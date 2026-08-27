import { sendRequest, showToast } from '../api.js';
import { isSuperAdmin } from '../auth.js';

let cachedSpares = [];

export function setupSpareHandlers() {
  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  const dateAdd = document.getElementById('sp-date');
  const dateIssue = document.getElementById('is-date');
  if (dateAdd) dateAdd.value = today;
  if (dateIssue) dateIssue.value = today;

  // Add Spare Part Handler
  document.getElementById('btn-add-spare')?.addEventListener('click', async () => {
    const name = document.getElementById('sp-name').value.trim();
    const qty = parseFloat(document.getElementById('sp-qty').value);

    if (!name || isNaN(qty)) {
      return showToast('Please enter Part Name and Quantity', 'error');
    }

    const payload = {
      name,
      code: document.getElementById('sp-code').value.trim(),
      machineType: document.getElementById('sp-machine').value,
      quantity: qty,
      unit: document.getElementById('sp-unit').value,
      supplier: document.getElementById('sp-supplier').value.trim(),
      cost: parseFloat(document.getElementById('sp-cost').value) || 0,
      minStock: parseFloat(document.getElementById('sp-min').value) || 0,
      dateAdded: document.getElementById('sp-date').value || new Date().toISOString(),
      remarks: document.getElementById('sp-remarks').value.trim()
    };

    try {
      await sendRequest('spares', 'POST', payload);
      showToast('Spare Part Added Successfully!');
      clearForm('add');
      await renderSparesTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Issue Part Handler
  document.getElementById('btn-issue-spare')?.addEventListener('click', async () => {
    const partId = document.getElementById('is-part').value;
    const machineNo = document.getElementById('is-machineno').value.trim();
    const qty = parseFloat(document.getElementById('is-qty').value);

    if (!partId || !machineNo || isNaN(qty) || qty <= 0) {
      return showToast('Please select a Part, Machine No, and valid Quantity', 'error');
    }

    const payload = {
      machineNo,
      qtyIssued: qty,
      dateIssued: document.getElementById('is-date').value || new Date().toISOString(),
      issuedTo: document.getElementById('is-person').value.trim(),
      remarks: document.getElementById('is-remarks').value.trim()
    };

    try {
      await sendRequest(`spares/${partId}/issue`, 'POST', payload);
      showToast('Issued to Machine Successfully!');
      clearForm('issue');
      await renderSparesTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Dropdown Change Listener to Display Available Stock
  document.getElementById('is-part')?.addEventListener('change', (e) => {
    const partId = e.target.value;
    const availInput = document.getElementById('is-available');
    const selected = cachedSpares.find(s => s._id === partId);
    availInput.value = selected ? `${selected.quantity} ${selected.unit}` : '—';
  });

  // Filter Event Listeners
  document.getElementById('spare-search')?.addEventListener('input', () => renderInventoryTable(cachedSpares));
  document.getElementById('issue-search')?.addEventListener('input', () => renderIssuanceAndSummary(cachedSpares));

  // Global Scope Attachments for Table Action Buttons
  window.deleteSpareItem = async (id) => {
    if (!confirm('Are you sure you want to delete this spare part?')) return;
    try {
      await sendRequest(`spares/${id}`, 'DELETE');
      showToast('Spare Part Deleted');
      await renderSparesTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.deleteIssuanceItem = async (partId, issueId) => {
    if (!confirm('Cancel this issuance and return stock back to inventory?')) return;
    try {
      await sendRequest(`spares/${partId}/issue/${issueId}`, 'DELETE');
      showToast('Issuance cancelled and stock restored');
      await renderSparesTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

export async function renderSparesTable() {
  try {
    cachedSpares = await sendRequest('spares');
    populatePartSelect(cachedSpares);
    renderInventoryTable(cachedSpares);
    renderIssuanceAndSummary(cachedSpares);
  } catch (err) {
    showToast('Failed to load Spare Parts data', 'error');
  }
}

function populatePartSelect(spares) {
  const select = document.getElementById('is-part');
  if (!select) return;
  select.innerHTML = '<option value="">-- Select Part --</option>' +
    spares.map(s => `<option value="${s._id}">${s.name} (${s.code || 'No Code'}) - Stock: ${s.quantity}</option>`).join('');
}

function renderInventoryTable(spares) {
  const tbody = document.getElementById('spare-body');
  const query = document.getElementById('spare-search')?.value.toLowerCase() || '';

  const canManage = isSuperAdmin();
  const filtered = spares.filter(s =>
    s.name.toLowerCase().includes(query) ||
    (s.code && s.code.toLowerCase().includes(query)) ||
    (s.machineType && s.machineType.toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; color:#94a3b8; padding:22px;">No matching spare parts found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const totalIssued = s.issuances ? s.issuances.reduce((acc, i) => acc + i.qtyIssued, 0) : 0;
    const totalValue = (s.quantity * s.cost).toFixed(2);
    const isLow = s.quantity <= s.minStock;
    const statusBadge = isLow
      ? `<span style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:4px; font-weight:600; font-size:11px;">Low Stock</span>`
      : `<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:4px; font-weight:600; font-size:11px;">In Stock</span>`;

    const deleteCell = canManage ? `<td style="padding:10px;"><button onclick="deleteSpareItem('${s._id}')" style="border:none; background:none; cursor:pointer; color:#ef4444; font-size:14px;">🗑️</button></td>` : '<td style="padding:10px; color: var(--muted); font-size:12px;">View only</td>';

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px;"><strong>${s.name}</strong></td>
        <td style="padding:10px;">${s.code || '—'}</td>
        <td style="padding:10px;">${s.machineType || '—'}</td>
        <td style="padding:10px;"><strong>${s.quantity}</strong></td>
        <td style="padding:10px;">${totalIssued}</td>
        <td style="padding:10px;">${s.unit}</td>
        <td style="padding:10px;">${s.supplier || '—'}</td>
        <td style="padding:10px;">₹${s.cost.toFixed(2)}</td>
        <td style="padding:10px;">₹${totalValue}</td>
        <td style="padding:10px;">${statusBadge}</td>
        ${deleteCell}
      </tr>
    `;
  }).join('');
}

function renderIssuanceAndSummary(spares) {
  const issueBody = document.getElementById('issue-body');
  const summaryBody = document.getElementById('machine-summary-body');
  const query = document.getElementById('issue-search')?.value.toLowerCase() || '';

  let allIssues = [];
  let summaryMap = {};

  spares.forEach(s => {
    if (s.issuances) {
      s.issuances.forEach(i => {
        allIssues.push({ ...i, partName: s.name, unit: s.unit, partId: s._id, issueId: i._id });

        // Aggregate for machine summary
        if (!summaryMap[i.machineNo]) {
          summaryMap[i.machineNo] = { count: 0, totalQty: 0, breakdown: {} };
        }
        summaryMap[i.machineNo].count += 1;
        summaryMap[i.machineNo].totalQty += i.qtyIssued;
        summaryMap[i.machineNo].breakdown[s.name] = (summaryMap[i.machineNo].breakdown[s.name] || 0) + i.qtyIssued;
      });
    }
  });

  // Filter Issues
  const filtered = allIssues.filter(i =>
    i.machineNo.toLowerCase().includes(query) ||
    i.partName.toLowerCase().includes(query) ||
    (i.issuedTo && i.issuedTo.toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    issueBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a3b8; padding:22px;">No spare parts issued yet</td></tr>`;
  } else {
    issueBody.innerHTML = filtered.map(i => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px;">${new Date(i.dateIssued).toLocaleDateString('en-IN')}</td>
        <td style="padding:10px;"><strong>${i.partName}</strong></td>
        <td style="padding:10px;"><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:600;">${i.machineNo}</span></td>
        <td style="padding:10px;"><strong>${i.qtyIssued}</strong></td>
        <td style="padding:10px;">${i.unit}</td>
        <td style="padding:10px;">${i.issuedTo || '—'}</td>
        <td style="padding:10px;">${i.remarks || '—'}</td>
        <td style="padding:10px;">
          <button onclick="deleteIssuanceItem('${i.partId}', '${i.issueId}')" style="border:none; background:none; cursor:pointer; color:#ef4444; font-size:14px;">❌</button>
        </td>
      </tr>
    `).join('');
  }

  // Render Summary Table
  const machines = Object.keys(summaryMap);
  if (machines.length === 0) {
    summaryBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:22px;">No issuance data yet</td></tr>`;
  } else {
    summaryBody.innerHTML = machines.map(mNo => {
      const item = summaryMap[mNo];
      const breakdownText = Object.entries(item.breakdown).map(([pName, qty]) => `${pName}: <strong>${qty}</strong>`).join(', ');

      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px;"><strong>${mNo}</strong></td>
          <td style="padding:10px;">${item.count} times</td>
          <td style="padding:10px;">${breakdownText}</td>
          <td style="padding:10px;"><strong>${item.totalQty}</strong></td>
        </tr>
      `;
    }).join('');
  }
}

function clearForm(type) {
  if (type === 'add') {
    document.getElementById('sp-name').value = '';
    document.getElementById('sp-code').value = '';
    document.getElementById('sp-qty').value = '';
    document.getElementById('sp-supplier').value = '';
    document.getElementById('sp-cost').value = '';
    document.getElementById('sp-min').value = '';
    document.getElementById('sp-remarks').value = '';
  } else if (type === 'issue') {
    document.getElementById('is-part').value = '';
    document.getElementById('is-machineno').value = '';
    document.getElementById('is-qty').value = '';
    document.getElementById('is-available').value = '—';
    document.getElementById('is-person').value = '';
    document.getElementById('is-remarks').value = '';
  }
}