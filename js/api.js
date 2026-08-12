const hostname = window.location.hostname || 'localhost';
const protocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol;
const BASE = `${protocol}//${hostname}:5000/api`;

export async function sendRequest(endpoint, method = 'GET', data = null) {
    const config = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (data) config.body = JSON.stringify(data);
    
    try {
        const res = await fetch(`${BASE}/${endpoint}`, config);
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