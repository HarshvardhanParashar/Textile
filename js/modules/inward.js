import { sendRequest, showToast, getActiveOutletId } from '../api.js';
import { isSuperAdmin } from '../auth.js';

let activeType = 'yarn';
let editingId = null;
let cachedRecords = [];
let cachedGreyRolls = [];
let cachedLoomRange = null;
let selectedLoom = null;
let inwardDatePage = 0;

export function setupInwardHandlers() {
    const form = document.getElementById('inwardForm');
    if (!form) return;

    const loomRangeForm = document.getElementById('loomRangeForm');
    const addLoomSlotsBtn = document.getElementById('addLoomSlotsBtn');
    addLoomSlotsBtn?.addEventListener('click', () => loomRangeForm?.classList.toggle('hidden'));
    loomRangeForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const start = Number(document.getElementById('loom-range-start').value);
        const end = Number(document.getElementById('loom-range-end').value);
        try {
            cachedLoomRange = await sendRequest('inward/loom-range', 'PUT', { start, end });
            selectedLoom = null;
            loomRangeForm.classList.add('hidden');
            renderLoomBoard();
            showToast('Loom slots saved for this outlet.');
        } catch (error) {
            showToast(error.message || 'Unable to save loom range.');
        }
    });

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
        cachedGreyRolls = await sendRequest('greyrolls').catch(() => []);
        await loadLoomRange();
        renderInwardTableUI(cachedRecords);
        renderLoomBoard();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Database Sync Failure</td></tr>';
    }
}

async function loadLoomRange() {
    const rangeForm = document.getElementById('loomRangeForm');
    const addSlotsBtn = document.getElementById('addLoomSlotsBtn');
    const hasOutlet = Boolean(getActiveOutletId());
    addSlotsBtn?.classList.toggle('hidden', !isSuperAdmin());
    if (addSlotsBtn) addSlotsBtn.disabled = !hasOutlet;
    rangeForm?.classList.add('hidden');
    cachedLoomRange = null;
    const outletId = getActiveOutletId();
    if (!outletId) return;
    try {
        cachedLoomRange = await sendRequest('inward/loom-range');
        const startInput = document.getElementById('loom-range-start');
        const endInput = document.getElementById('loom-range-end');
        if (startInput) startInput.value = cachedLoomRange.start ?? '';
        if (endInput) endInput.value = cachedLoomRange.end ?? '';
    } catch (error) {
        cachedLoomRange = null;
    }
}

function normalizeLoomValue(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(loom|machine|mc)/, '');
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function renderLoomBoard() {
    const slots = document.getElementById('loomSlots');
    const details = document.getElementById('loomDetails');
    if (!slots || !details) return;

    if (!cachedLoomRange || cachedLoomRange.start == null || cachedLoomRange.end == null) {
        slots.innerHTML = `<div class="loom-empty">${getActiveOutletId() ? 'No loom range configured for this outlet.' : 'Select an outlet to view its loom slots.'}</div>`;
        details.classList.add('hidden');
        return;
    }

    const start = Number(cachedLoomRange.start);
    const end = Number(cachedLoomRange.end);
    const looms = Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
    slots.innerHTML = looms.map(loom => {
        const beam = cachedRecords.find(record => record.type === 'beam' && normalizeLoomValue(record.wbLoom) === normalizeLoomValue(loom));
        const selected = selectedLoom === loom ? ' selected' : '';
        return `<button type="button" class="loom-slot${beam ? ' occupied' : ''}${selected}" data-loom="${loom}">
            <strong>Loom ${loom}</strong><span>${beam ? `Beam ${escapeHtml(beam.id)}` : 'Empty'}</span>
        </button>`;
    }).join('');

    slots.querySelectorAll('.loom-slot').forEach(button => button.addEventListener('click', () => {
        selectedLoom = button.dataset.loom;
        renderLoomBoard();
        renderLoomDetails(selectedLoom);
    }));

    if (selectedLoom !== null) renderLoomDetails(selectedLoom);
    else details.classList.add('hidden');
}

function renderLoomDetails(loom) {
    const details = document.getElementById('loomDetails');
    if (!details) return;
    const beam = cachedRecords.find(record => record.type === 'beam' && normalizeLoomValue(record.wbLoom) === normalizeLoomValue(loom));
    const readyRolls = cachedGreyRolls.filter(roll => roll.status === 'Ready' && (
        normalizeLoomValue(roll.loom) === normalizeLoomValue(loom)
        || (beam && normalizeLoomValue(roll.beam) === normalizeLoomValue(beam.id))
    ));
    const totalMeters = readyRolls.reduce((total, roll) => total + (Number(roll.meters) || 0), 0);
    details.classList.remove('hidden');
    details.innerHTML = `
        <div class="loom-details-header">
            <div class="loom-popover-title">
                <strong>Loom ${escapeHtml(loom)}</strong>
                <span class="loom-popover-status${beam ? ' occupied' : ''}">${beam ? `Beam ${escapeHtml(beam.id)} assigned` : 'Slot empty'}</span>
            </div>
            <div class="loom-detail-actions">
                ${beam ? '<button type="button" class="btn btn-primary btn-sm" id="finishLoomBtn">Finish</button>' : ''}
                <button type="button" class="loom-popover-close" id="closeLoomDetails" aria-label="Close loom details" title="Close">×</button>
            </div>
        </div>
        <div class="loom-stock-summary">
            <div><strong>${readyRolls.length}</strong><span>Ready rolls</span></div>
            <div><strong>${totalMeters}</strong><span>Total meters</span></div>
        </div>
        <div class="loom-roll-heading">Ready grey stock</div>
        ${readyRolls.length ? `<ul class="loom-roll-list">${readyRolls.map(roll => `<li><span>${escapeHtml(roll.no)}</span><strong>${Number(roll.meters) || 0} m</strong></li>`).join('')}</ul>` : '<div class="loom-empty">No Ready grey rolls for this loom.</div>'}
    `;
    details.querySelector('#finishLoomBtn')?.addEventListener('click', async () => {
        const estimatedWastage = Math.max(0, Number(beam.wbLength || 0) - Number(beam.usedMeters || 0));
        if (!confirm(`Finish loom ${loom}? The remaining ${estimatedWastage} m will be recorded as wastage. Grey roll records will be kept.`)) return;
        try {
            const result = await sendRequest(`inward/loom/${encodeURIComponent(loom)}/finish`, 'POST', {});
            await renderInwardTable();
            showToast(`Loom ${loom} finished. ${result.wastageMeters} m recorded as wastage.`);
        } catch (error) {
            showToast(error.message || 'Unable to finish this loom.');
        }
    });
    details.querySelector('#closeLoomDetails')?.addEventListener('click', () => {
        selectedLoom = null;
        renderLoomBoard();
    });
}

function getRecordDate(record) {
    return record.date || (record.createdAt ? String(record.createdAt).slice(0, 10) : '');
}

function renderInwardTableUI(records) {
    const tbody = document.getElementById('inwardTableBody');
    if (!tbody) return;

    const canManage = true;
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
