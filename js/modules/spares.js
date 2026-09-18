import { sendRequest, showToast } from '../api.js';

let cachedSpares = [];
let spareDatePage = 0;
let issueHistoryPage = 0;
let machineSummaryPage = 0;

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
      quantity: qty,
      unit: document.getElementById('sp-unit').value,
      supplier: document.getElementById('sp-supplier').value.trim(),
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
  document.getElementById('issue-search')?.addEventListener('input', () => renderIssuanceAndSummary(cachedSpares));
  document.getElementById('issue-month-filter')?.addEventListener('change', () => {
    issueHistoryPage = 0;
    machineSummaryPage = 0;
    renderIssuanceAndSummary(cachedSpares);
  });
  document.getElementById('issue-year-filter')?.addEventListener('change', () => {
    issueHistoryPage = 0;
    machineSummaryPage = 0;
    renderIssuanceAndSummary(cachedSpares);
  });
  window.filterSpares = () => {
    spareDatePage = 0;
    renderInventoryTable(cachedSpares);
    renderIssuanceAndSummary(cachedSpares);
  };

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
    refreshIssueYearFilter();
    renderInventoryTable(cachedSpares);
    renderIssuanceAndSummary(cachedSpares);
  } catch (err) {
    showToast('Failed to load Spare Parts data', 'error');
  }
}

function refreshIssueYearFilter() {
  const select = document.getElementById('issue-year-filter');
  if (!select) return;

  const years = [...new Set(
    cachedSpares.flatMap(s => (s.issuances || []).map(i => new Date(i.dateIssued).getFullYear()))
      .filter(year => Number.isFinite(year))
  )].sort((a, b) => b - a);

  const currentValue = select.value;
  select.innerHTML = '<option value="">All Years</option>' + years.map(year => `<option value="${year}">${year}</option>`).join('');
  if (currentValue && years.includes(Number(currentValue))) {
    select.value = String(currentValue);
  } else {
    select.value = '';
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
  const selectedDate = document.getElementById('spare-filter-date')?.value || '';
  const showAllDates = document.getElementById('spare-show-all-dates')?.checked || false;
  const dates = [...new Set(spares.map(s => getDateKey(s.dateAdded)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  spareDatePage = Math.min(spareDatePage, Math.max(dates.length - 1, 0));
  const activeDate = showAllDates ? '' : selectedDate || dates[spareDatePage];

  const canManage = true;
  const filtered = spares.filter(s =>
    (!activeDate || getDateKey(s.dateAdded) === activeDate) &&
    (s.name.toLowerCase().includes(query) ||
      (s.supplier && s.supplier.toLowerCase().includes(query)))
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a3b8; padding:22px;">No matching spare parts found</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(s => {
    const totalIssued = s.issuances ? s.issuances.reduce((acc, i) => acc + i.qtyIssued, 0) : 0;
    const isLow = s.quantity <= s.minStock;
    const statusBadge = isLow
      ? `<span style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:4px; font-weight:600; font-size:11px;">Low Stock</span>`
      : `<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:4px; font-weight:600; font-size:11px;">In Stock</span>`;

    const deleteCell = canManage ? `<td style="padding:10px;"><button onclick="deleteSpareItem('${s._id}')" style="border:none; background:none; cursor:pointer; color:#ef4444; font-size:14px;">🗑️</button></td>` : '<td style="padding:10px; color: var(--muted); font-size:12px;">View only</td>';

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px;"><strong>${s.name}</strong></td>
        <td style="padding:10px;">${s.dateAdded ? new Date(s.dateAdded).toLocaleDateString('en-IN') : '—'}</td>
        <td style="padding:10px;"><strong>${s.quantity}</strong></td>
        <td style="padding:10px;">${totalIssued}</td>
        <td style="padding:10px;">${s.unit}</td>
        <td style="padding:10px;">${s.supplier || '—'}</td>
        <td style="padding:10px;">${statusBadge}</td>
        ${deleteCell}
      </tr>
    `;
    }).join('');
  }

  const dateLabel = activeDate ? new Date(`${activeDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No dates';
  const pagination = document.getElementById('spare-pagination');
  if (pagination) {
    pagination.innerHTML = `
      <button class="btn btn-outline btn-sm" id="spare-prev" ${showAllDates || selectedDate || spareDatePage === 0 ? 'disabled' : ''}>Previous</button>
      <span>${showAllDates ? 'All dates' : selectedDate ? `Date filter &middot; ${dateLabel}` : `Page ${dates.length ? spareDatePage + 1 : 0} of ${dates.length} &middot; ${dateLabel}`}</span>
      <button class="btn btn-outline btn-sm" id="spare-next" ${showAllDates || selectedDate || spareDatePage >= dates.length - 1 ? 'disabled' : ''}>Next</button>
    `;
    pagination.querySelector('#spare-prev')?.addEventListener('click', () => {
      spareDatePage -= 1;
      renderInventoryTable(cachedSpares);
    });
    pagination.querySelector('#spare-next')?.addEventListener('click', () => {
      spareDatePage += 1;
      renderInventoryTable(cachedSpares);
    });
  }
}

function renderIssuanceAndSummary(spares) {
  const issueBody = document.getElementById('issue-body');
  const summaryBody = document.getElementById('machine-summary-body');
  const query = document.getElementById('issue-search')?.value.toLowerCase() || '';
  const selectedMonth = Number(document.getElementById('issue-month-filter')?.value || 0);
  const selectedYear = Number(document.getElementById('issue-year-filter')?.value || 0);
  const pageSize = 8;

  let allIssues = [];
  let summaryMap = {};

  spares.forEach(s => {
    if (s.issuances) {
      s.issuances.forEach(i => {
        const issueDate = new Date(i.dateIssued);
        const issueMonth = issueDate.getMonth() + 1;
        const issueYear = issueDate.getFullYear();

        const matchesMonth = !selectedMonth || issueMonth === selectedMonth;
        const matchesYear = !selectedYear || issueYear === selectedYear;
        const matchesQuery = !query ||
          (i.machineNo && i.machineNo.toLowerCase().includes(query)) ||
          (s.name && s.name.toLowerCase().includes(query)) ||
          (i.issuedTo && i.issuedTo.toLowerCase().includes(query));

        if (!matchesMonth || !matchesYear || !matchesQuery) return;

        allIssues.push({ ...i, partName: s.name, unit: s.unit, partId: s._id, issueId: i._id, dateObj: issueDate });

        if (!summaryMap[i.machineNo]) {
          summaryMap[i.machineNo] = { count: 0, totalQty: 0, breakdown: {} };
        }
        summaryMap[i.machineNo].count += 1;
        summaryMap[i.machineNo].totalQty += i.qtyIssued;
        summaryMap[i.machineNo].breakdown[s.name] = (summaryMap[i.machineNo].breakdown[s.name] || 0) + i.qtyIssued;
      });
    }
  });

  allIssues.sort((a, b) => new Date(b.dateIssued) - new Date(a.dateIssued));
  const totalIssuePages = Math.max(1, Math.ceil(allIssues.length / pageSize));
  issueHistoryPage = Math.min(issueHistoryPage, totalIssuePages - 1);
  const issueSlice = allIssues.slice(issueHistoryPage * pageSize, issueHistoryPage * pageSize + pageSize);

  const issuePagination = document.getElementById('issue-pagination');
  if (issuePagination) {
    issuePagination.innerHTML = `
      <button class="btn btn-outline btn-sm" id="issue-prev" ${issueHistoryPage === 0 ? 'disabled' : ''}>Previous</button>
      <span>Page ${issueHistoryPage + 1} of ${totalIssuePages}</span>
      <button class="btn btn-outline btn-sm" id="issue-next" ${issueHistoryPage >= totalIssuePages - 1 ? 'disabled' : ''}>Next</button>
    `;
    issuePagination.querySelector('#issue-prev')?.addEventListener('click', () => {
      issueHistoryPage = Math.max(0, issueHistoryPage - 1);
      renderIssuanceAndSummary(cachedSpares);
    });
    issuePagination.querySelector('#issue-next')?.addEventListener('click', () => {
      issueHistoryPage = Math.min(totalIssuePages - 1, issueHistoryPage + 1);
      renderIssuanceAndSummary(cachedSpares);
    });
  }

  if (issueSlice.length === 0) {
    issueBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a3b8; padding:22px;">No spare parts issued for the selected month/year</td></tr>`;
  } else {
    issueBody.innerHTML = issueSlice.map(i => `
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

  const machineRows = Object.entries(summaryMap).map(([machineNo, item]) => ({ machineNo, ...item }));
  machineRows.sort((a, b) => b.totalQty - a.totalQty || a.machineNo.localeCompare(b.machineNo));

  if (machineRows.length === 0) {
    summaryBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:22px;">No issuance data for the selected month/year</td></tr>`;
  } else {
    summaryBody.innerHTML = machineRows.map(({ machineNo, count, breakdown, totalQty }) => {
      const breakdownText = Object.entries(breakdown)
        .map(([pName, qty]) => `${pName}: <strong>${qty}</strong>`)
        .join(', ');

      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px;"><strong>${machineNo}</strong></td>
          <td style="padding:10px;">${count} times</td>
          <td style="padding:10px;">${breakdownText || '—'}</td>
          <td style="padding:10px;"><strong>${totalQty}</strong></td>
        </tr>
      `;
    }).join('');
  }
}

function getDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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