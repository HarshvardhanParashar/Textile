import { sendRequest } from './api.js';

const SESSION_KEY = 'textile_current_user';
const USERS_CACHE_KEY = 'textile_users_cache';

function storageAvailable() {
  try {
    const test = '__textile_auth__';
    if (typeof window === 'undefined') return false;
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch (error) {
    return false;
  }
}

function getStorage() {
  return storageAvailable() ? window.localStorage : null;
}

export function ensureUsersSeeded() {
  try {
    const storage = getStorage();
    if (!storage) return true;
    const current = storage.getItem('textile_users_seeded');
    if (!current) {
      storage.setItem('textile_users_seeded', '1');
    }
    return true;
  } catch (error) {
    return true;
  }
}

export function setUsersCache(users) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(USERS_CACHE_KEY, JSON.stringify(users || []));
}

export function getUsers() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const users = JSON.parse(storage.getItem(USERS_CACHE_KEY) || '[]');
    return Array.isArray(users) ? users : [];
  } catch (error) {
    return [];
  }
}

export async function refreshUsersCache() {
  try {
    const users = await sendRequest('users');
    setUsersCache(users || []);
    return users || [];
  } catch (error) {
    return getUsers();
  }
}

export async function loginUser(username, password) {
  const normalizedUsername = String(username || '').trim();
  const normalizedPassword = String(password || '').trim();

  if (!normalizedUsername || !normalizedPassword) return null;

  try {
    const user = await sendRequest('auth/login', 'POST', {
      username: normalizedUsername,
      password: normalizedPassword
    });

    if (!user) return null;

    const storage = getStorage();
    if (!storage) return user;
    storage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  } catch (error) {
    return null;
  }
}

export function getCurrentUser() {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export function logoutUser() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(SESSION_KEY);
}

export function isSuperAdmin(user = getCurrentUser()) {
  return Boolean(user && user.role === 'super_admin');
}

export function canManageRecords() {
  return isSuperAdmin();
}

export async function addUser({ name, username, password, role = 'user' }) {
  const normalizedName = String(name || '').trim();
  const normalizedUsername = String(username || '').trim();
  const normalizedPassword = String(password || '').trim();

  if (!normalizedName || !normalizedUsername || !normalizedPassword) {
    throw new Error('Name, username, and password are required.');
  }

  const payload = {
    name: normalizedName,
    username: normalizedUsername,
    password: normalizedPassword,
    role: role === 'super_admin' ? 'super_admin' : 'user'
  };

  const newUser = await sendRequest('users', 'POST', payload);
  await refreshUsersCache();
  return newUser;
}
