// SECURITY & SESSION
const DEVICE_ID_KEY = 'ore_device_id';
const USER_NAME_KEY = 'ore_user_name';

// GET or CREATE Device ID
function getDeviceId() {
    try {
        let id = localStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
            id = 'DEV-' + Math.random().toString(36).substring(2, 9).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
            localStorage.setItem(DEVICE_ID_KEY, id);
        }
        return id;
    } catch (e) {
        console.warn("localStorage blocked, using session ID");
        return 'SES-' + Date.now();
    }
}

const DEVICE_ID = getDeviceId();
function getUserName() {
    try { return localStorage.getItem(USER_NAME_KEY) || "Unknown User"; } catch (e) { return "Unknown User"; }
}
const USER_NAME = getUserName();

// PASTE YOUR GOOGLE SCRIPT URL HERE AFTER DEPLOYING
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxahv-0UjHWai2VWBdv6eR8Jl6T9UrmIH9R9REoz6jbru0s3zaiNHEXQbwSaluR2rm_/exec';

const dom = {};
let allData = { clients: [], news: [] };

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Populate DOM object
    dom.input = document.getElementById('searchInput');
    dom.results = document.getElementById('searchResults');
    dom.loading = document.getElementById('loadingIndicator');
    dom.error = document.getElementById('errorMessage');
    dom.modal = document.getElementById('detailsModal');
    dom.modalContent = document.getElementById('modalContent');
    dom.backdrop = document.getElementById('modalBackdrop');
    dom.closeBtn = document.getElementById('closeModal');
    dom.newsSection = document.getElementById('newsSection');
    dom.newsFeed = document.getElementById('newsFeed');
    dom.pullIndicator = document.getElementById('pullIndicator');

    // Access UI
    dom.accessOverlay = document.getElementById('accessOverlay');
    dom.requestForm = document.getElementById('requestForm');
    dom.pendingStatus = document.getElementById('pendingStatus');
    dom.mgrNameInput = document.getElementById('mgrName');
    dom.btnRequest = document.getElementById('btnRequest');
    dom.displayDeviceId = document.getElementById('displayDeviceId');

    fetchData();
    setupEventListeners();
    setupPullToRefresh();
});

function setupEventListeners() {
    if (dom.input) dom.input.addEventListener('input', handleSearch);
    if (dom.closeBtn) dom.closeBtn.addEventListener('click', closeModal);
    if (dom.backdrop) dom.backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Access Request
    if (dom.btnRequest) {
        dom.btnRequest.addEventListener('click', handleRequestAccess);
    }
}

function handleRequestAccess() {
    const name = dom.mgrNameInput.value.trim();
    if (!name) return alert("Please enter your name");

    console.log("Requesting access for:", name, "Device:", DEVICE_ID);

    dom.btnRequest.disabled = true;
    dom.btnRequest.textContent = "Sending...";

    // Cache-buster added with &v=
    const url = `${SCRIPT_URL}?action=requestAccess&deviceId=${DEVICE_ID}&userName=${encodeURIComponent(name)}&v=${Date.now()}`;

    // Using no-cors to ensure it hits GAS regardless of preflight/browsers
    fetch(url, { mode: 'no-cors' })
        .then(() => {
            console.log("Access request sent successfully");
            alert("Access request sent! Please wait for Admin approval.");
            try { localStorage.setItem(USER_NAME_KEY, name); } catch (e) { }
            showAccessPending();
        })
        .catch(err => {
            console.error("Request Access Error:", err);
            alert("Failed to send request. Please check connection.");
            dom.btnRequest.disabled = false;
            dom.btnRequest.textContent = "Request Access";
        });
}

function showAccessPending() {
    if (dom.accessOverlay) dom.accessOverlay.classList.remove('hidden');
    if (dom.requestForm) dom.requestForm.classList.add('hidden');
    if (dom.pendingStatus) dom.pendingStatus.classList.remove('hidden');
    if (dom.displayDeviceId) dom.displayDeviceId.textContent = DEVICE_ID;
}

function showAccessDenied() {
    if (dom.accessOverlay) dom.accessOverlay.classList.remove('hidden');
    if (dom.requestForm) dom.requestForm.classList.remove('hidden');
    if (dom.pendingStatus) dom.pendingStatus.classList.add('hidden');
}

function fetchData() {
    if (dom.loading) dom.loading.classList.remove('hidden');

    // Cache-buster added with &v=
    const url = `${SCRIPT_URL}?action=getData&deviceId=${DEVICE_ID}&userName=${encodeURIComponent(USER_NAME)}&v=${Date.now()}`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`Network response was not ok (Status: ${response.status})`);
            return response.json();
        })
        .then(data => {
            if (dom.loading) dom.loading.classList.add('hidden');

            if (data.result === "restricted") {
                if (data.status === "Pending") {
                    showAccessPending();
                } else {
                    showAccessDenied();
                }
                return;
            }

            allData = data || { clients: [], news: [] };
            renderNews(allData.news || []);
            if (dom.accessOverlay) dom.accessOverlay.classList.add('hidden');
        })
        .catch(error => {
            if (dom.loading) dom.loading.classList.add('hidden');
            console.error("Fetch Error:", error);
            showError(`
                <strong>Connection Failed</strong><br>
                We could not reach the data source.<br>
                <span class="text-xs opacity-75">Detail: ${error.message}</span>
            `);
        });
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();

    if (query.length < 1) {
        dom.results.classList.add('hidden');
        return;
    }

    const matches = (allData.clients || []).filter(row => {
        const nameVal = row['NAME'];
        const name = nameVal ? String(nameVal).toLowerCase() : '';
        return name.includes(query);
    });

    renderResults(matches);
}

function renderNews(newsItems) {
    if (!newsItems || newsItems.length === 0) {
        dom.newsSection.classList.add('hidden');
        return;
    }

    const formatImageUrl = (url) => {
        if (!url || typeof url !== 'string') return '';
        const trimmedUrl = url.trim();
        if (trimmedUrl.includes('drive.google.com')) {
            const match = trimmedUrl.match(/\/d\/(.+?)\/(view|edit|\?|#|$)/) ||
                trimmedUrl.match(/id=(.+?)(&|$)/) ||
                trimmedUrl.match(/\/file\/d\/(.+?)\//);
            if (match && match[1]) {
                const id = match[1];
                return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
            }
        }
        return trimmedUrl;
    };

    const html = newsItems.map(item => {
        const getNewsVal = (keyName) => {
            const k = Object.keys(item).find(k => k.trim().toLowerCase() === keyName.toLowerCase());
            return k ? item[k] : null;
        };

        const date = getNewsVal('Date') ? String(getNewsVal('Date')).split('T')[0] : 'Today';
        const headline = getNewsVal('Headline') || 'Progress Update';
        const text = getNewsVal('Update') || '';
        const rawImg = getNewsVal('Image URL') || '';
        const img = formatImageUrl(rawImg);

        return `
            <div class="flex-shrink-0 w-72 bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50 p-4 transition-all hover:shadow-xl hover:-translate-y-1">
                ${img ? `<div class="w-full h-32 rounded-xl mb-3 overflow-hidden bg-slate-100 flex items-center justify-center">
                    <img src="${img}" class="w-full h-full object-cover">
                </div>` : ''}
                <div class="flex items-center gap-2 mb-2">
                    <span class="px-2 py-0.5 rounded-full bg-orange-100 text-brand-orange text-[10px] font-bold uppercase tracking-wider">${date}</span>
                    <div class="h-1 w-1 rounded-full bg-slate-300"></div>
                </div>
                <h4 class="text-brand-500 font-bold text-sm mb-1">${headline}</h4>
                <p class="text-slate-500 text-xs leading-relaxed">${text}</p>
            </div>
        `;
    }).join('');

    dom.newsFeed.innerHTML = html;
    dom.newsSection.classList.remove('hidden');
}

function renderResults(matches) {
    if (matches.length === 0) {
        dom.results.innerHTML = `
            <div class="p-6 text-center text-slate-500">
                <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2 opacity-50 text-brand-orange"></i>
                <p>No customers found matching that name.</p>
            </div>
        `;
        dom.results.classList.remove('hidden');
        lucide.createIcons();
        return;
    }

    const html = matches.map(item => `
        <div class="search-item p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors flex items-center justify-between group" onclick="openDetails('${item['ITEM No.']}')">
            <div>
                <h3 class="text-slate-900 font-bold text-lg group-hover:text-brand-600 transition-colors">${item['NAME'] || 'Unknown Name'}</h3>
                <p class="text-slate-500 text-sm flex items-center gap-2">
                    <i data-lucide="phone" class="w-3 h-3 text-brand-orange"></i> ${item['PHONE No.'] || 'N/A'}
                    <span class="mx-1 text-slate-300">•</span>
                    <span class="text-slate-500">${item['CODE'] || '#'}</span>
                </p>
            </div>
            <div class="text-right">
                <span class="px-2 py-1 rounded bg-slate-100 text-xs text-slate-600 border border-slate-200 font-medium">${item['Satus'] || item['Customer Status'] || 'Status N/A'}</span>
            </div>
        </div>
    `).join('');

    dom.results.innerHTML = html;
    dom.results.classList.remove('hidden');
    lucide.createIcons();
}

// Global openDetails
window.openDetails = function (id) {
    if (!id || id === 'undefined') {
        console.warn("Invalid ID passed to openDetails:", id);
        return;
    }

    console.log("Opening details for ID:", id);
    const item = (allData.clients || []).find(r => String(r['ITEM No.']) === String(id));

    if (!item) {
        console.error("Could not find client with ID:", id, "Available IDs:", allData.clients.map(c => c['ITEM No.']));
        return;
    }

    renderDetails(item);
    if (dom.modal) dom.modal.classList.remove('hidden');
}

function closeModal() {
    dom.modal.classList.add('hidden');
}

function renderDetails(item) {
    const getValue = (key) => {
        const k = Object.keys(item).find(i => i.trim().toLowerCase() === key.toLowerCase());
        return k ? item[k] : null;
    };

    const cleanNumber = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(String(val).replace(/,/g, '').replace(/[^0-9.-]+/g, "")) || 0;
    };

    const formatCurrency = (val) => cleanNumber(val).toLocaleString();

    const total = cleanNumber(getValue('TOTAL CONTRACT AMOUNT'));
    const paid = cleanNumber(getValue('COLLECTED AMOUNT/DP'));
    const remaining = total - paid;
    const hasFinancials = total > 0;

    const urgencyVal = String(getValue('Urgency') || 'Normal');
    let urgencyColor = 'bg-slate-100 text-slate-600';
    const lowUrg = urgencyVal.toLowerCase();
    if (lowUrg.includes('red') || lowUrg.includes('high')) urgencyColor = 'bg-rose-500 text-white shadow-lg shadow-rose-200';
    else if (lowUrg.includes('orange') || lowUrg.includes('med')) urgencyColor = 'bg-orange-500 text-white shadow-lg shadow-orange-200';
    else if (lowUrg.includes('yellow')) urgencyColor = 'bg-amber-400 text-amber-950 shadow-lg shadow-amber-100';
    else if (lowUrg.includes('green')) urgencyColor = 'bg-emerald-500 text-white shadow-lg shadow-emerald-200';
    else if (lowUrg.includes('blue')) urgencyColor = 'bg-blue-500 text-white shadow-lg shadow-blue-200';

    const ignoredKeys = ['NAME', 'Satus', 'Status', 'Code', 'CODE', 'Case', 'id', 'ITEM No.', 'Urgency'];
    let dynamicFieldsHtml = '';
    Object.keys(item).forEach(key => {
        if (ignoredKeys.some(k => k.toLowerCase() === key.toLowerCase())) return;
        let val = item[key];
        let displayVal = (val === null || val === undefined || String(val).trim() === '') ? '—' : String(val);

        if (displayVal !== '—' && !isNaN(cleanNumber(displayVal)) && cleanNumber(displayVal) > 1000) {
            if (/amount|paid|total|remaining|balance|price|contract/i.test(key)) {
                displayVal = formatCurrency(displayVal);
            }
        }

        dynamicFieldsHtml += `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 transition-all hover:bg-white hover:shadow-md">
                <p class="text-slate-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">${key}</p>
                <p class="text-slate-800 font-medium text-sm md:text-base break-words">${displayVal}</p>
            </div>
        `;
    });

    const statusVal = String(getValue('Satus') || getValue('Status') || 'Active');
    const statusColor = statusVal.toLowerCase().includes('sold') ? 'text-green-700 bg-green-100' : 'text-brand-600 bg-blue-50';

    const content = `
        <div class="relative bg-white p-6 sm:p-8 flex flex-col gap-6 border-b border-slate-100">
            <button onclick="closeModal()" class="flex items-center gap-2 text-brand-500 font-medium group">
                <i data-lucide="arrow-left" class="w-5 h-5 group-hover:-translate-x-1 transition-transform"></i>
                <span>Back</span>
            </button>
            <div class="flex flex-col md:flex-row justify-between items-start gap-4">
                <div class="flex-1">
                    <h2 class="text-2xl md:text-3xl font-bold text-brand-500 mb-2">${getValue('NAME')}</h2>
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="px-3 py-1 rounded-full text-sm font-bold ${statusColor}">${statusVal}</span>
                        <span class="px-3 py-1 rounded-full text-sm font-bold ${urgencyColor}">${urgencyVal}</span>
                        <span class="px-3 py-1 rounded-full text-sm border bg-slate-50 font-mono">${getValue('CODE') || '#'}</span>
                        <button onclick="requestUpdate('${item['ITEM No.']}')" id="btn-update-${item['ITEM No.']}" class="ml-2 px-3 py-1 bg-brand-orange text-white text-xs rounded-full flex items-center gap-1">
                            <i data-lucide="refresh-cw" class="w-3 h-3"></i> Need Update
                        </button>
                    </div>
                </div>
                ${hasFinancials ? `<div class="w-full md:w-48 h-32 flex items-center justify-center bg-slate-50 rounded-xl p-2 border shrink-0">
                    <canvas id="financeChart"></canvas>
                </div>` : ''}
            </div>
        </div>
        <div class="p-6 sm:p-8 max-h-[60vh] overflow-y-auto">
            ${hasFinancials ? `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="bg-brand-500 text-white p-4 rounded-2xl">
                    <p class="text-blue-100 text-xs uppercase mb-1">Total Contract</p>
                    <p class="text-xl md:text-2xl font-bold">${formatCurrency(total)}</p>
                </div>
                <div class="bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-200">
                    <p class="text-emerald-600 text-xs uppercase mb-1 font-bold">Paid / DP</p>
                    <p class="text-xl md:text-2xl font-bold">${formatCurrency(paid)}</p>
                </div>
                <div class="bg-rose-50 text-rose-700 p-4 rounded-2xl border border-rose-200">
                    <p class="text-rose-600 text-xs uppercase mb-1 font-bold">Remaining</p>
                    <p class="text-xl md:text-2xl font-bold">${formatCurrency(remaining)}</p>
                </div>
            </div>
            ` : ''}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                ${dynamicFieldsHtml}
            </div>
        </div>
    `;

    dom.modalContent.innerHTML = content;
    lucide.createIcons();

    if (hasFinancials) {
        const ctx = document.getElementById('financeChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Paid', 'Remaining'],
                    datasets: [{
                        data: [paid, remaining],
                        backgroundColor: ['#10b981', '#f43f5e'],
                        borderWidth: 0
                    }]
                },
                options: { cutout: '65%', plugins: { legend: { display: false } } }
            });
        }
    }
}

window.requestUpdate = function (id) {
    const btn = document.getElementById(`btn-update-${id}`);
    const original = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Sending...`;
    btn.disabled = true;
    lucide.createIcons();

    const url = `${SCRIPT_URL}?id=${id}&action=request_update&deviceId=${DEVICE_ID}&userName=${encodeURIComponent(USER_NAME)}`;

    fetch(url, { mode: 'no-cors' }).then(() => {
        btn.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> Requested`;
        btn.className = "ml-2 px-3 py-1 bg-green-600 text-white text-xs rounded-full flex items-center gap-1";
        lucide.createIcons();
    }).catch(() => {
        btn.innerHTML = original;
        btn.disabled = false;
        lucide.createIcons();
    });
};

function setupPullToRefresh() {
    let startY = 0;
    const threshold = 150;
    document.addEventListener('touchstart', (e) => { if (window.scrollY === 0) startY = e.touches[0].pageY; }, { passive: true });
    document.addEventListener('touchmove', (e) => {
        if (startY === 0 || window.scrollY > 0) return;
        const diff = e.touches[0].pageY - startY;
        if (diff > 50) {
            dom.pullIndicator.style.opacity = Math.min((diff - 50) / 100, 1);
            dom.pullIndicator.style.transform = `translateY(${Math.min(diff / 3, 50)}px)`;
        }
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
        if (window.scrollY === 0 && e.changedTouches[0].pageY - startY > threshold) fetchData();
        startY = 0;
        dom.pullIndicator.style.opacity = '0';
        dom.pullIndicator.style.transform = 'translateY(0)';
    });
}

function showError(msg) {
    dom.error.innerHTML = msg;
    dom.error.classList.remove('hidden');
}
