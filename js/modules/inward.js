import { sendRequest, showToast } from '../api.js';
import { isSuperAdmin } from '../auth.js';

let activeType = 'yarn';
let editingId = null;
let cachedRecords = [];
let inwardDatePage = 0;

export function setupInwardHandlers() {
    const form = document.getElementById('inwardForm');
    if (!form) return;

    // Interactive Dropdown Visibility Toggles
    const yrSelect = document.getElementById('yr-type');
    const yrCustomInput = document.getElementById('yr-type-custom');
    yrSelect?.addEventListener('change', (e) => {
        yrCustomInput.style.display = e.target.value === 'Other' ? 'block' : 'none';
    });

    const wbSelect = document.getElementById('wb-yarntype');
    const wbCustomInput = document.getElementById('wb-type-custom');
    wbSelect?.addEventListener('change', (e) => {
        wbCustomInput.style.display = e.target.value === 'Other' ? 'block' : 'none';
    });

    // Form Section Layout Alternation
    document.querySelectorAll('.type-toggle .type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            activeType = e.target.dataset.type;
            document.querySelectorAll('.type-toggle .type-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('yarnFields').style.display = activeType === 'yarn' ? 'grid' : 'none';
            document.getElementById('beamFields').style.display = activeType === 'beam' ? 'grid' : 'none';
        });
    });

    // Form Submit Handler (CREATE and UPDATE)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        let verifiedYarnType = '';
        if (activeType === 'yarn') {
            verifiedYarnType = yrSelect.value === 'Other' ? yrCustomInput.value.trim() : yrSelect.value;
        } else {
            verifiedYarnType = wbSelect.value === 'Other' ? wbCustomInput.value.trim() : wbSelect.value;
        }

        const primaryId = activeType === 'yarn' ? document.getElementById('in-id').value.trim() : document.getElementById('wb-beamno').value.trim();
        if (!primaryId || !verifiedYarnType) {
            showToast('⚠️ Please fulfill all mandatory marked fields.');
            return;
        }

        const payload = {
            id: primaryId,
            type: activeType,
            status: 'In Stock',
            yrType: verifiedYarnType,
            
            date: activeType === 'yarn' ? document.getElementById('in-date').value : document.getElementById('wb-date').value,
            lot: activeType === 'yarn' ? document.getElementById('in-lot').value.trim() : document.getElementById('wb-lot').value.trim(),
            remarks: activeType === 'yarn' ? document.getElementById('yr-remarks').value.trim() : document.getElementById('wb-remarks').value.trim(),
            
            yrCount: activeType === 'yarn' ? document.getElementById('yr-count').value.trim() : document.getElementById('wb-count').value.trim(),
            yrPly: activeType === 'yarn' ? document.getElementById('yr-ply').value : undefined,
            yrColor: activeType === 'yarn' ? document.getElementById('yr-color').value.trim() : undefined,
            yrWeight: activeType === 'yarn' ? (parseFloat(document.getElementById('yr-weight').value) || 0) : undefined,
            yrQty: activeType === 'yarn' ? (parseInt(document.getElementById('yr-qty').value) || 1) : 1,

            wbEnds: activeType === 'beam' ? (parseInt(document.getElementById('wb-ends').value) || 0) : undefined,
            wbReed: activeType === 'beam' ? (parseInt(document.getElementById('wb-reed').value) || 0) : undefined,
            wbLength: activeType === 'beam' ? (parseFloat(document.getElementById('wb-length').value) || 0) : undefined,
            wbWeight: activeType === 'beam' ? (parseFloat(document.getElementById('wb-weight').value) || 0) : undefined,
            wbNetYarn: activeType === 'beam' ? (parseFloat(document.getElementById('wb-netyarn').value) || 0) : undefined,
            wbEpi: activeType === 'beam' ? (parseInt(document.getElementById('wb-epi').value) || 0) : undefined,
            wbLoom: activeType === 'beam' ? document.getElementById('wb-loom').value.trim() : undefined,
            construction: activeType === 'beam' ? document.getElementById('wb-construction').value.trim() : undefined
        };

        try {
            if (editingId) {
                await sendRequest(`inward/${editingId}`, 'PUT', payload);
                showToast(`✏️ Updated record ${primaryId}`);
            } else {
                await sendRequest('inward', 'POST', payload);
                showToast(`✅ Saved new entry ${primaryId} to database.`);
            }
            
            resetFormState(form);
            await renderInwardTable();
        } catch (err) {
            showToast(`❌ Request Failed: ${err.message || 'Database execution error'}`);
        }
    });
}

function populateFormForEdit(record) {
    editingId = record.id;
    activeType = record.type;

    document.querySelectorAll('.type-toggle .type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === activeType);
    });
    document.getElementById('yarnFields').style.display = activeType === 'yarn' ? 'grid' : 'none';
    document.getElementById('beamFields').style.display = activeType === 'beam' ? 'grid' : 'none';

    const knownYarnTypes = ['Cotton', 'Non-Dyeing', 'Roto'];

    if (activeType === 'yarn') {
        document.getElementById('in-id').value = record.id || '';
        document.getElementById('in-date').value = record.date || '';
        document.getElementById('in-lot').value = record.lot || '';
        document.getElementById('yr-count').value = record.yrCount || '';
        document.getElementById('yr-ply').value = record.yrPly || '1';
        document.getElementById('yr-color').value = record.yrColor || '';
        document.getElementById('yr-weight').value = record.yrWeight || '';
        document.getElementById('yr-qty').value = record.yrQty || 1;
        document.getElementById('yr-remarks').value = record.remarks || '';

        const yrSelect = document.getElementById('yr-type');
        const yrCustomInput = document.getElementById('yr-type-custom');
        if (knownYarnTypes.includes(record.yrType)) {
            yrSelect.value = record.yrType;
            yrCustomInput.style.display = 'none';
        } else {
            yrSelect.value = 'Other';
            yrCustomInput.value = record.yrType || '';
            yrCustomInput.style.display = 'block';
        }
    } else {
        document.getElementById('wb-beamno').value = record.id || '';
        document.getElementById('wb-date').value = record.date || '';
        document.getElementById('wb-count').value = record.yrCount || '';
        document.getElementById('wb-ends').value = record.wbEnds || '';
        document.getElementById('wb-reed').value = record.wbReed || '';
        document.getElementById('wb-length').value = record.wbLength || '';
        document.getElementById('wb-weight').value = record.wbWeight || '';
        document.getElementById('wb-netyarn').value = record.wbNetYarn || '';
        document.getElementById('wb-epi').value = record.wbEpi || '';
        document.getElementById('wb-loom').value = record.wbLoom || '';
        document.getElementById('wb-construction').value = record.construction || '';
        document.getElementById('wb-lot').value = record.lot || '';
        document.getElementById('wb-remarks').value = record.remarks || '';
        if (typeof record.remainingMeters !== 'undefined') {
            document.getElementById('wb-length').value = record.wbLength || record.remainingMeters || '';
        }

        const wbSelect = document.getElementById('wb-yarntype');
        const wbCustomInput = document.getElementById('wb-type-custom');
        if (knownYarnTypes.includes(record.yrType)) {
            wbSelect.value = record.yrType;
            wbCustomInput.style.display = 'none';
        } else {
            wbSelect.value = 'Other';
            wbCustomInput.value = record.yrType || '';
            wbCustomInput.style.display = 'block';
        }
    }

    const submitBtn = document.querySelector('#inwardForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = `✏️ Update Entry (${record.id})`;
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-blue');
    }

    document.getElementById('page-inward').scrollIntoView({ behavior: 'smooth' });
}

function resetFormState(form) {
    editingId = null;
    form.reset();

    document.getElementById('yr-type-custom').style.display = 'none';
    document.getElementById('wb-type-custom').style.display = 'none';

    const submitBtn = document.querySelector('#inwardForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '➕ Add to Inward Stock';
        submitBtn.classList.remove('btn-blue');
        submitBtn.classList.add('btn-primary');
    }
}

export async function renderInwardTable() {
    const tbody = document.getElementById('inwardTableBody');
    if (!tbody) return;

    try {
        cachedRecords = await sendRequest('inward') || [];
        renderInwardTableUI(cachedRecords);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Database Sync Failure</td></tr>';
    }
}

function getRecordDate(record) {
    return record.date || (record.createdAt ? String(record.createdAt).slice(0, 10) : '');
}

function renderInwardTableUI(records) {
    const tbody = document.getElementById('inwardTableBody');
    if (!tbody) return;

    const canManage = isSuperAdmin();
    const filterType = document.getElementById('inward-filter-type')?.value || '';
    const searchValue = document.getElementById('inward-search')?.value.trim().toLowerCase() || '';
    const selectedDate = document.getElementById('inward-filter-date')?.value || '';
    const showAllDates = document.getElementById('inward-show-all-dates')?.checked || false;
    const dates = [...new Set(records.map(getRecordDate).filter(Boolean))].sort((a, b) => b.localeCompare(a));
    inwardDatePage = Math.min(inwardDatePage, Math.max(dates.length - 1, 0));
    const activeDate = showAllDates ? '' : selectedDate || dates[inwardDatePage];

    const filtered = records.filter(r => {
        const searchable = [r.id, r.yrType, r.yrCount, r.lot, r.wbLoom].map(value => String(value || '').toLowerCase());
        return (!activeDate || getRecordDate(r) === activeDate)
            && (!filterType || r.type === filterType)
            && (!searchValue || searchable.some(value => value.includes(searchValue)));
    });

    tbody.innerHTML = filtered.map(r => {
            const usedMeters = Number(r.usedMeters || 0) || 0;
            const remainingMeters = Number(r.remainingMeters ?? (Number(r.wbLength || 0) - usedMeters)) || 0;
            const specifications = r.type === 'yarn'
                ? `Weight: ${r.yrWeight || 0} kg`
                : `Ends: ${r.wbEnds || 0} | Loom: ${r.wbLoom || '—'} | Remaining: ${remainingMeters} m`;
            const metrics = r.type === 'yarn'
                ? `${r.yrQty || 1} Rolls`
                : `${r.wbLength || 0} m / ${remainingMeters} left`;
            const actions = canManage ? `
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-outline btn-sm action-edit-inward" data-id="${r.id}">✏️ Edit</button>
                    <button class="btn btn-danger btn-sm action-purge-inward" data-id="${r.id}">🗑</button>
                </div>
            ` : '<span style="color: var(--muted); font-size: 12px;">View only</span>';

            return `
                <tr>
                    <td><span class="type-tag ${r.type}">${r.type === 'yarn' ? '🧶 YARN' : '🪡 BEAM'}</span></td>
                    <td><strong style="font-family:var(--mono)">${r.id}</strong></td>
                    <td><strong>${r.yrType}</strong> <small style="color:var(--muted)">(${r.yrCount || '—'})</small></td>
                    <td style="font-size:12px; color:var(--muted)">${specifications}</td>
                    <td><strong>${metrics}</strong></td>
                    <td><span class="status-badge s-in">${r.status}</span></td>
                    <td>${actions}</td>
                </tr>
            `;
    }).join('') || '<tr><td colspan="7" style="text-align:center; color:var(--muted);">No records registered for this date.</td></tr>';

    const dateLabel = activeDate ? new Date(`${activeDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No dates';
    const pagination = document.getElementById('inward-pagination');
    if (pagination) {
        pagination.innerHTML = `
            <button class="btn btn-outline btn-sm" id="inward-prev" ${showAllDates || selectedDate || inwardDatePage === 0 ? 'disabled' : ''}>Previous</button>
            <span>${showAllDates ? 'All dates' : selectedDate ? `Date filter &middot; ${dateLabel}` : `Page ${dates.length ? inwardDatePage + 1 : 0} of ${dates.length} &middot; ${dateLabel}`}</span>
            <button class="btn btn-outline btn-sm" id="inward-next" ${showAllDates || selectedDate || inwardDatePage >= dates.length - 1 ? 'disabled' : ''}>Next</button>
        `;
        pagination.querySelector('#inward-prev')?.addEventListener('click', () => {
            inwardDatePage -= 1;
            renderInwardTableUI(cachedRecords);
        });
        pagination.querySelector('#inward-next')?.addEventListener('click', () => {
            inwardDatePage += 1;
            renderInwardTableUI(cachedRecords);
        });
    }

    if (!canManage) return;

    tbody.querySelectorAll('.action-edit-inward').forEach(b => {
            b.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.id;
                const match = cachedRecords.find(item => item.id === targetId);
                if (match) populateFormForEdit(match);
            });
        });

    tbody.querySelectorAll('.action-purge-inward').forEach(b => {
            b.addEventListener('click', async (e) => {
                const targetId = e.currentTarget.dataset.id;
                if (confirm(`Remove item ${targetId} permanently?`)) {
                    await sendRequest(`inward/${targetId}`, 'DELETE');
                    await renderInwardTable();
                }
            });
    });
}

window.filterInward = () => {
    inwardDatePage = 0;
    renderInwardTableUI(cachedRecords);
};
