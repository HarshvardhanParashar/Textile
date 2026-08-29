const BASE = window.location.protocol === 'file:' ? 'http://localhost:5000/api' : '/api';
const ACTIVE_OUTLET_KEY = 'textile_active_outlet';

export function getActiveOutletId() {
    return localStorage.getItem(ACTIVE_OUTLET_KEY) || '';
}

export function setActiveOutletId(id) {
    if (!id) {
        localStorage.removeItem(ACTIVE_OUTLET_KEY);
        return;
    }
    localStorage.setItem(ACTIVE_OUTLET_KEY, String(id));
}

export async function sendRequest(endpoint, method = 'GET', data = null) {
    const config = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };

    const activeOutletId = getActiveOutletId();
    const payload = data && typeof data === 'object' && !Array.isArray(data) ? { ...data } : data;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        if (!payload.outletId && activeOutletId) payload.outletId = activeOutletId;
        config.body = JSON.stringify(payload);
    } else if (data) {
        config.body = JSON.stringify(data);
    }

    const target = `${BASE}/${endpoint}`;
    const url = new URL(target, window.location.origin);
    if (activeOutletId && method.toUpperCase() !== 'POST') {
        url.searchParams.set('outletId', activeOutletId);
    }

    try {
        const res = await fetch(url.toString(), config);
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(parsed.message || parsed.error || 'Server Transaction Rejected');
        return parsed;
    } catch (err) {
        console.error(`🚨 Global database network interface error:`, err.message);
        throw err;
    }
}

export function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

export async function convertGreyToReadyToSell(greyRollId, qualityGrade, quantityMeters, price) {
    return await sendRequest('readytosell/convert-from-grey', 'POST', {
        greyRollId,
        qualityGrade,
        quantityMeters,
        pricePerMeter: price
    });
}