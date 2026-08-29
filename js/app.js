import { showToast, sendRequest, getActiveOutletId, setActiveOutletId } from './api.js';
import { renderReadyToSellPage, setupReadyHandlers } from './modules/readytosell.js';
import { renderDashboard } from './modules/dashboard.js';
import { setupInwardHandlers, renderInwardTable } from './modules/inward.js';
import { setupGreyHandlers, renderGreyTable } from './modules/greyRoll.js';
import { setupChallanHandlers, renderChallanInterface } from './modules/challan.js';
import { setupSpareHandlers, renderSparesTable } from './modules/spares.js';
import {
    ensureUsersSeeded,
    loginUser,
    getCurrentUser,
    logoutUser,
    isSuperAdmin,
    addUser,
    getUsers,
    refreshUsersCache,
} from './auth.js';

const appShell = () => document.getElementById('appShell');
const loginScreen = () => document.getElementById('loginScreen');
let currentPage = 'dashboard';

async function loadOutlets() {
    const outletSelect = document.getElementById('activeOutletSelect');
    const outletRows = document.getElementById('outletTableBody');
    if (!outletSelect && !outletRows) return;

    try {
        const outlets = await sendRequest('outlets');
        if (outletSelect) {
            let activeOutletId = getActiveOutletId();
            if (!activeOutletId && outlets.length) {
                activeOutletId = outlets[0]._id;
                setActiveOutletId(activeOutletId);
            }
            outletSelect.innerHTML = '<option value="">All outlets</option>' + outlets.map((outlet) => `
                <option value="${outlet._id}" ${outlet._id === activeOutletId ? 'selected' : ''}>${outlet.name}${outlet.location ? ` — ${outlet.location}` : ''}</option>
            `).join('');
            outletSelect.value = activeOutletId || '';
        }

        if (outletRows) {
            outletRows.innerHTML = outlets.length
                ? outlets.map(outlet => `
                    <tr>
                        <td>${outlet.name}</td>
                        <td>${outlet.location || '-'}</td>
                        <td>${outlet.code || '-'}</td>
                    </tr>
                `).join('')
                : '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:12px">No outlets created yet.</td></tr>';
        }
    } catch (error) {
        console.error('Unable to load outlets:', error);
        if (outletSelect) outletSelect.innerHTML = '<option value="">All outlets</option>';
    }
}

window.showPage = async function showPage(page) {
    currentPage = page;
    const navButtons = document.querySelectorAll('#mainNav .nav-btn');
    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.page === page));

    document.querySelectorAll('main .page').forEach(panel => {
        panel.classList.toggle('active', panel.id === `page-${page}`);
    });

    if (page === 'dashboard') await renderDashboard();
    if (page === 'inward') await renderInwardTable();
    if (page === 'grey') await renderGreyTable();
    if (page === 'ready') await renderReadyToSellPage();
    if (page === 'challan') await renderChallanInterface();
    if (page === 'spares') await renderSparesTable();
};

document.addEventListener('DOMContentLoaded', async () => {
    ensureUsersSeeded();

    setupRouter();
    setupLogin();
    setupUserManagement();

    setupInwardHandlers();
    setupGreyHandlers();
    setupReadyHandlers();
    setupChallanHandlers();
    setupSpareHandlers();

    document.getElementById('activeOutletSelect')?.addEventListener('change', async (event) => {
        const selectedValue = event.target.value;
        setActiveOutletId(selectedValue);
        await loadOutlets();
        await window.showPage(currentPage || 'dashboard');
    });

    document.getElementById('createOutletBtn')?.addEventListener('click', async () => {
        const nameInput = document.getElementById('newOutletName');
        const locationInput = document.getElementById('newOutletLocation');
        const codeInput = document.getElementById('newOutletCode');

        const name = nameInput?.value.trim();
        if (!name) {
            showToast('Outlet name is required.');
            return;
        }

        const outlet = await sendRequest('outlets', 'POST', {
            name,
            location: locationInput?.value.trim() || '',
            code: codeInput?.value.trim() || ''
        });

        setActiveOutletId(outlet._id);
        if (nameInput) nameInput.value = '';
        if (locationInput) locationInput.value = '';
        if (codeInput) codeInput.value = '';

        await loadOutlets();
        await window.showPage(currentPage || 'dashboard');
        showToast(`Outlet ${outlet.name} selected.`);
    });

    await loadOutlets();
    await renderDashboard();
    renderAuthUI();
});

function setupLogin() {
    const loginForm = document.getElementById('loginForm');
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');

    loginForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const loginError = document.getElementById('loginError');

        const user = await loginUser(loginUsername.value, loginPassword.value);

        if (!user) {
            loginError.textContent = 'Invalid username or password.';
            return;
        }

        loginError.textContent = '';
        await renderAuthUI();
        await window.showPage('dashboard');
    });
}

function setupUserManagement() {
    document.getElementById('createUserBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('adminName').value.trim();
        const username = document.getElementById('adminUsername').value.trim();
        const password = document.getElementById('adminPassword').value.trim();
        const role = document.getElementById('adminRole').value;

        try {
            await addUser({ name, username, password, role });
            showToast('User added successfully.');
            document.getElementById('adminName').value = '';
            document.getElementById('adminUsername').value = '';
            document.getElementById('adminPassword').value = '';
            await renderUserList();
        } catch (error) {
            showToast(error.message || 'Unable to add user.', 'error');
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        logoutUser();
        renderAuthUI();
    });
}

async function renderUserList() {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;

    try {
        const users = await refreshUsersCache();
        const currentUsers = users.length ? users : getUsers();
        tableBody.innerHTML = currentUsers.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.username}</td>
                <td>${user.role === 'super_admin' ? 'Super Admin' : 'User'}</td>
            </tr>
        `).join('') || '<tr><td colspan="3" style="text-align:center; color:var(--muted);">No users found.</td></tr>';
    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--muted);">Unable to load users.</td></tr>';
    }
}

async function renderAuthUI() {
    const currentUser = getCurrentUser();
    const adminCard = document.getElementById('adminUserCard');
    const loginScreenEl = loginScreen();
    const appShellEl = appShell();

    if (!currentUser) {
        loginScreenEl?.classList.remove('hidden');
        appShellEl?.classList.add('hidden');
        if (loginScreenEl) loginScreenEl.style.display = 'flex';
        return;
    }

    loginScreenEl?.classList.add('hidden');
    appShellEl?.classList.remove('hidden');

    const isAdmin = isSuperAdmin(currentUser);
    adminCard?.classList.toggle('hidden', !isAdmin);
    const outletCard = document.querySelector('.outlet-card');
    outletCard?.classList.toggle('hidden', !isAdmin);
    const outletAddBtn = document.getElementById('createOutletBtn');
    outletAddBtn?.classList.toggle('hidden', !isAdmin);
    if (isAdmin) await renderUserList();

}

function setupRouter() {
    document.querySelectorAll('#mainNav .nav-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const navButton = e.target.closest('[data-page]');
            if (!navButton) return;

            const page = navButton.dataset.page;
            await window.showPage(page);
        });
    });

    document.getElementById('closeModalBtn')?.addEventListener('click', () => {
        document.getElementById('challanModal')?.classList.remove('open');
    });
}
