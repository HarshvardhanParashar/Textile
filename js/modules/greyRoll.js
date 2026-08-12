import { sendRequest, showToast } from '../api.js';
import { isSuperAdmin } from '../auth.js';

let cachedGreyRolls = [];
let editingRollNo = null; // Tracks whether we are adding (null) or editing (roll number string)

export function setupGreyHandlers() {
    // Visibility toggles for "Other" dropdown options
    ['gr-weave', 'gr-quality', 'gr-defect'].forEach(id => {
        const selectEl = document.getElementById(id);
        const customEl = document.getElementById(`${id}-custom`);
        selectEl?.addEventListener('change', (e) => {
            if (customEl) {
                customEl.style.display = e.target.value === 'Other' ? 'block' : 'none';
            }
        });
    });

    // Unified Add / Update Grey Roll Handler
    window.addGreyRoll = async () => {
        const rollNo = document.getElementById('gr-no').value.trim();
        const mtrs = parseFloat(document.getElementById('gr-meters').value) || 0;

        if (!rollNo || !mtrs) {
            showToast('⚠️ Roll Number and Meters are required.');
            return;
        }

        const weaveSelect = document.getElementById('gr-weave').value;
        const finalWeave = weaveSelect === 'Other' ? document.getElementById('gr-weave-custom').value.trim() : weaveSelect;

        const qualitySelect = document.getElementById('gr-quality').value;
        const finalQuality = qualitySelect === 'Other' ? document.getElementById('gr-quality-custom').value.trim() : qualitySelect;

        const defectSelect = document.getElementById('gr-defect').value;
        const finalDefect = defectSelect === 'Other' ? document.getElementById('gr-defect-custom').value.trim() : (defectSelect || 'None');

        const payload = {
            no: rollNo,
            date: document.getElementById('gr-date').value || new Date().toISOString().split('T')[0],
            beam: document.getElementById('gr-beam').value.trim(),
            loom: document.getElementById('gr-loom').value.trim(),
            weaver: document.getElementById('gr-weaver').value.trim(),
            construction: document.getElementById('gr-construction').value.trim(),
            weave: finalWeave,
            width: parseFloat(document.getElementById('gr-width').value) || 0,
            meters: mtrs,
            weight: parseFloat(document.getElementById('gr-weight').value) || 0,
            epi: parseInt(document.getElementById('gr-epi').value) || 0,
            ppi: parseInt(document.getElementById('gr-ppi').value) || 0,
            warpCount: document.getElementById('gr-warp-count').value.trim(),
            weftCount: document.getElementById('gr-weft-count').value.trim(),
            warpYarn: document.getElementById('gr-warp-yarn').value.trim(),
            weftYarn: document.getElementById('gr-weft-yarn').value.trim(),
            rate: parseFloat(document.getElementById('gr-rate').value) || 0,
            quality: finalQuality || 'Pending',
            defect: finalDefect,
            shrink: parseFloat(document.getElementById('gr-shrink').value) || 0,
            crimp: parseFloat(document.getElementById('gr-crimp').value) || 0,
            remarks: document.getElementById('gr-remarks').value.trim(),
            status: finalQuality === 'Standard' ? 'Ready' : 'In Stock'
        };

        try {
            if (editingRollNo) {
                // EDIT MODE -> PUT request
                await sendRequest(`greyrolls/${editingRollNo}`, 'PUT', payload);
                showToast(`💾 Grey Roll ${rollNo} updated successfully!`);
            } else {
                // ADD MODE -> POST request
                await sendRequest('greyrolls', 'POST', payload);
                showToast(`🩶 Grey Roll ${rollNo} added successfully!`);
            }

            resetSingleForm();
            await renderGreyTable();
        } catch (err) {
            showToast(`❌ Failed to ${editingRollNo ? 'update' : 'add'} Grey Roll.`);
        }
    };

    window.filterGrey = () => renderGreyTableUI(cachedGreyRolls);
}

export async function renderGreyTable() {
    try {
        cachedGreyRolls = await sendRequest('greyrolls') || [];
        renderGreyTableUI(cachedGreyRolls);
    } catch (err) {
        const tbody = document.getElementById('grey-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="15" style="color:red;text-align:center;">Failed to sync stock list.</td></tr>';
    }
}

function renderGreyTableUI(rolls) {
    const tbody = document.getElementById('grey-body');
    if (!tbody) return;

    const canManage = isSuperAdmin();
    const filterGrade = document.getElementById('grey-filter-grade')?.value || '';
    const filterStatus = document.getElementById('grey-filter-status')?.value || '';
    const searchVal = document.getElementById('grey-search')?.value.toLowerCase() || '';

    let filtered = rolls.filter(r => {
        const matchGrade = !filterGrade || r.quality === filterGrade;
        const matchStatus = !filterStatus || r.status === filterStatus;
        const matchSearch = !searchVal || r.no.toLowerCase().includes(searchVal) || (r.weave && r.weave.toLowerCase().includes(searchVal));
        return matchGrade && matchStatus && matchSearch;
    });

    tbody.innerHTML = filtered.map(r => {
        const actions = canManage ? `
            <div style="display:flex;gap:4px">
                <button class="btn btn-outline btn-sm edit-grey-btn" data-no="${r.no}">✏️</button>
                <button class="btn btn-danger btn-sm purge-grey-btn" data-no="${r.no}">🗑</button>
            </div>
        ` : '<span style="color: var(--muted); font-size:12px;">Read only</span>';

        return `
            <tr>
                <td><strong style="font-family:var(--mono)">${r.no}</strong></td>
                <td>${r.date || '—'}</td>
                <td>${r.beam || '—'}</td>
                <td>${r.loom || '—'}</td>
                <td>${r.weave || '—'}</td>
                <td>${r.construction || '—'}</td>
                <td>${r.width ? r.width + '"' : '—'}</td>
                <td><strong>${r.meters}</strong> m</td>
                <td>${r.weight ? r.weight + ' kg' : '—'}</td>
                <td>${r.epi || '0'}/${r.ppi || '0'}</td>
                <td><span class="q-badge q-${r.quality || 'Pending'}">${r.quality || 'Pending'}</span></td>
                <td>${r.defect || 'None'}</td>
                <td>${r.rate ? '₹' + r.rate : '—'}</td>
                <td><span class="status-badge ${r.status === 'Ready' ? 's-ready' : r.status === 'Sold' ? 's-sold' : 's-in'}">${r.status}</span></td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="15" style="text-align:center;color:var(--muted);padding:22px">No matching grey rolls found.</td></tr>';

    if (!canManage) return;

    // Edit Button Handlers
    tbody.querySelectorAll('.edit-grey-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            const rollNo = e.currentTarget.dataset.no;
            editGreyRoll(rollNo);
        });
    });

    // Delete Button Handlers
    tbody.querySelectorAll('.purge-grey-btn').forEach(b => {
        b.addEventListener('click', async (e) => {
            const rollNo = e.currentTarget.dataset.no;
            if (confirm(`Scrub Grey Roll ${rollNo} permanently from database?`)) {
                await sendRequest(`greyrolls/${rollNo}`, 'DELETE');
                if (editingRollNo === rollNo) resetSingleForm();
                await renderGreyTable();
            }
        });
    });

    // Update Bottom Summary Cards
    const totalRolls = filtered.length;
    const totalMeters = filtered.reduce((acc, r) => acc + (parseFloat(r.meters) || 0), 0);
    const readyRolls = filtered.filter(r => r.status === 'Ready').length;
    const soldRolls = filtered.filter(r => r.status === 'Sold').length;

    if (document.getElementById('gs-total')) document.getElementById('gs-total').textContent = totalRolls;
    if (document.getElementById('gs-meters')) document.getElementById('gs-meters').textContent = totalMeters.toFixed(1) + 'm';
    if (document.getElementById('gs-ready')) document.getElementById('gs-ready').textContent = readyRolls;
    if (document.getElementById('gs-sold')) document.getElementById('gs-sold').textContent = soldRolls;
}

// Populate form fields for Edit Mode
function editGreyRoll(rollNo) {
    const roll = cachedGreyRolls.find(r => r.no === rollNo);
    if (!roll) return;

    editingRollNo = rollNo;

    // Fill Form Inputs
    const rollNoInput = document.getElementById('gr-no');
    if (rollNoInput) {
        rollNoInput.value = roll.no;
        rollNoInput.disabled = true; // Primary Key disabled during edit
    }

    if (document.getElementById('gr-date')) document.getElementById('gr-date').value = roll.date || '';
    if (document.getElementById('gr-beam')) document.getElementById('gr-beam').value = roll.beam || '';
    if (document.getElementById('gr-loom')) document.getElementById('gr-loom').value = roll.loom || '';
    if (document.getElementById('gr-weaver')) document.getElementById('gr-weaver').value = roll.weaver || '';
    if (document.getElementById('gr-construction')) document.getElementById('gr-construction').value = roll.construction || '';
    if (document.getElementById('gr-width')) document.getElementById('gr-width').value = roll.width || '';
    if (document.getElementById('gr-meters')) document.getElementById('gr-meters').value = roll.meters || '';
    if (document.getElementById('gr-weight')) document.getElementById('gr-weight').value = roll.weight || '';
    if (document.getElementById('gr-epi')) document.getElementById('gr-epi').value = roll.epi || '';
    if (document.getElementById('gr-ppi')) document.getElementById('gr-ppi').value = roll.ppi || '';
    if (document.getElementById('gr-warp-count')) document.getElementById('gr-warp-count').value = roll.warpCount || '';
    if (document.getElementById('gr-weft-count')) document.getElementById('gr-weft-count').value = roll.weftCount || '';
    if (document.getElementById('gr-warp-yarn')) document.getElementById('gr-warp-yarn').value = roll.warpYarn || '';
    if (document.getElementById('gr-weft-yarn')) document.getElementById('gr-weft-yarn').value = roll.weftYarn || '';
    if (document.getElementById('gr-rate')) document.getElementById('gr-rate').value = roll.rate || '';
    if (document.getElementById('gr-shrink')) document.getElementById('gr-shrink').value = roll.shrink || '';
    if (document.getElementById('gr-crimp')) document.getElementById('gr-crimp').value = roll.crimp || '';
    if (document.getElementById('gr-remarks')) document.getElementById('gr-remarks').value = roll.remarks || '';

    // Handle Dropdowns & Custom Select Inputs
    setSelectOrCustom('gr-weave', roll.weave);
    setSelectOrCustom('gr-quality', roll.quality);
    setSelectOrCustom('gr-defect', roll.defect);

    // Dynamic UI State Updates
    const submitBtn = document.querySelector('.btn-grey');
    if (submitBtn) {
        submitBtn.innerHTML = '💾 Save Changes';
    }

    // Append Cancel Edit Button dynamically if missing
    let cancelBtn = document.getElementById('btn-cancel-edit');
    if (!cancelBtn && submitBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'btn-cancel-edit';
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-outline';
        cancelBtn.style.marginLeft = '8px';
        cancelBtn.innerHTML = 'Cancel';
        cancelBtn.onclick = resetSingleForm;
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }

    // Smooth scroll to top of form
    document.getElementById('page-grey')?.scrollIntoView({ behavior: 'smooth' });
}

// Helper to handle Select vs Custom Input
function setSelectOrCustom(id, value) {
    const select = document.getElementById(id);
    const custom = document.getElementById(`${id}-custom`);
    if (!select) return;

    const options = Array.from(select.options).map(o => o.value);
    if (options.includes(value)) {
        select.value = value;
        if (custom) {
            custom.style.display = 'none';
            custom.value = '';
        }
    } else if (value) {
        select.value = 'Other';
        if (custom) {
            custom.style.display = 'block';
            custom.value = value;
        }
    } else {
        select.value = '';
        if (custom) {
            custom.style.display = 'none';
            custom.value = '';
        }
    }
}

// Reset form and return to Add Mode
function resetSingleForm() {
    editingRollNo = null;

    ['gr-no', 'gr-beam', 'gr-loom', 'gr-weaver', 'gr-construction', 'gr-width', 'gr-meters', 'gr-weight', 'gr-epi', 'gr-ppi', 'gr-warp-count', 'gr-weft-count', 'gr-warp-yarn', 'gr-weft-yarn', 'gr-rate', 'gr-shrink', 'gr-crimp', 'gr-remarks', 'gr-weave-custom', 'gr-quality-custom', 'gr-defect-custom'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const rollNoInput = document.getElementById('gr-no');
    if (rollNoInput) rollNoInput.disabled = false;

    if (document.getElementById('gr-weave')) document.getElementById('gr-weave').value = '';
    if (document.getElementById('gr-quality')) document.getElementById('gr-quality').value = '';
    if (document.getElementById('gr-defect')) document.getElementById('gr-defect').value = '';

    ['gr-weave-custom', 'gr-quality-custom', 'gr-defect-custom'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const submitBtn = document.querySelector('.btn-grey');
    if (submitBtn) {
        submitBtn.innerHTML = '🩶 Add Grey Roll to Stock';
    }

    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) cancelBtn.remove();
}