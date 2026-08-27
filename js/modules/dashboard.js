import { sendRequest } from '../api.js';

export async function renderDashboard() {
    try {
        const [inward, greyRolls, challans, spares] = await Promise.all([
            sendRequest('inward').catch(() => []),
            sendRequest('greyrolls').catch(() => []),
            sendRequest('challans').catch(() => []),
            sendRequest('spares').catch(() => [])
        ]);

        // Stats calculations
        const totalYarnRolls = inward.filter(item => item.type === 'yarn').length;
        const totalWarpBeams = inward.filter(item => item.type === 'beam').length;
        const activeGreyRolls = greyRolls.filter(roll => roll.status !== 'Sold').length;
        const readyToSell = greyRolls.filter(roll => roll.status === 'Ready').length;
        const totalSpares = spares.length;
        const totalChallans = challans.length;

        // Populate Counter DOM nodes
        if (document.getElementById('stat-yarn')) document.getElementById('stat-yarn').textContent = totalYarnRolls;
        if (document.getElementById('stat-beam')) document.getElementById('stat-beam').textContent = totalWarpBeams;
        if (document.getElementById('stat-grey')) document.getElementById('stat-grey').textContent = activeGreyRolls;
        if (document.getElementById('stat-ready')) document.getElementById('stat-ready').textContent = readyToSell;
        if (document.getElementById('stat-spare')) document.getElementById('stat-spare').textContent = totalSpares;
        if (document.getElementById('stat-challan')) document.getElementById('stat-challan').textContent = totalChallans;

        // Recent Inward
        const inwardTbody = document.getElementById('dash-inward-body');
        if (inwardTbody) {
            const recentInward = inward.slice(0, 5);
            inwardTbody.innerHTML = recentInward.length 
                ? recentInward.map(r => `
                    <tr>
                        <td><strong style="font-family:var(--mono)">${r.id}</strong></td>
                        <td><span class="type-tag ${r.type}">${r.type === 'yarn' ? '🧶 Yarn' : '🪡 Beam'}</span></td>
                        <td>${r.yrType || 'Standard'}</td>
                        <td><span class="status-badge s-in">${r.status}</span></td>
                    </tr>
                `).join('')
                : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px">No inward records found</td></tr>`;
        }

        // Recent Grey Rolls
        const greyTbody = document.getElementById('dash-grey-body');
        if (greyTbody) {
            const recentGrey = greyRolls.slice(0, 5);
            greyTbody.innerHTML = recentGrey.length 
                ? recentGrey.map(r => `
                    <tr>
                        <td><strong style="font-family:var(--mono)">${r.no}</strong></td>
<<<<<<< HEAD
                        <td>${r.construction || 'Finished Fabric'}</td>
=======
                        <td>${r.weave || 'Plain'}</td>
>>>>>>> d6aab64ac6f5814b2604a2078992b1890cc0f34c
                        <td><strong>${r.meters}</strong> m</td>
                        <td><span class="q-badge q-${r.quality || 'Pending'}">${r.quality || 'Pending'}</span></td>
                    </tr>
                `).join('')
                : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px">No grey rolls produced yet</td></tr>`;
        }

        // Recent Challans
        const challanTbody = document.getElementById('dash-challan-body');
        if (challanTbody) {
            const recentChallans = challans.slice(0, 5);
            challanTbody.innerHTML = recentChallans.length 
                ? recentChallans.map(c => `
                    <tr>
                        <td><strong style="font-family:var(--mono)">${c.no}</strong></td>
                        <td>${c.party}</td>
                        <td><strong>${c.items ? c.items.length : 0}</strong> Rolls</td>
                        <td>${c.date}</td>
                    </tr>
                `).join('')
                : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px">No challans issued</td></tr>`;
        }

    } catch (error) {
        console.error('❌ Error rendering dashboard metrics:', error);
    }
}