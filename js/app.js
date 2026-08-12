import { showToast } from './api.js';
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

window.showPage = async function showPage(page) {
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

    document.getElementById('headerDate').textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });

    setupRouter();
    setupLogin();
    setupUserManagement();

    setupInwardHandlers();
    setupGreyHandlers();
    setupReadyHandlers();
    setupChallanHandlers();
    setupSpareHandlers();

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
    if (isAdmin) await renderUserList();

    const label = document.getElementById('headerDate');
    if (label) label.textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
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
