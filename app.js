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

// Exchange Rate Configuration
const USD_TO_ETB_RATE = 135; // Update this as needed

const dom = {};
let allData = { clients: [], news: [] };

// Robust Header Mapping
const KEYS = {
    NAME: ['Buyers Name', 'NAME', 'Customer Name', 'Client Name', 'Home Buyer Name', 'Full Name'],
    ID: ['No.', 'ITEM No.', 'ID', 'Item Number', 'Customer ID', 'Item#'],
    PHONE: ['Phone No.', 'PHONE No.', 'Phone', 'Contact Number', 'Mobile', 'Tel'],
    STATUS: ['Contract status', 'Customer status', 'Customer Status', 'Satus', 'Status', 'Client Status', 'State'],
    CODE: ['Sold Stock', 'CODE', 'Project Code', 'Unit Code', 'Ref Code'],
    URGENCY: ['Urgency', 'Priority', 'Level'],
    TOTAL: ['Total Contract Amount', 'TOTAL CONTRACT AMOUNT', 'Total Contract Value', 'Total Amount', 'Total'],
    PAID: ['Amount paid', 'COLLECTED AMOUNT/DP', 'Collected', 'Paid Amount', 'Paid', 'DP'],
    CONTRACT_DATE: ['Date', 'Contract date', 'CONTRACT DATE', 'Date of Contract'],
    CANCEL_DATE: ['Cancellation Date', 'Cancellation', 'CANCELLATION', 'Cancelation date', 'CANCELATION DATE'],
    ELAPSE_DATE: ['Elapse date', 'ELAPSE DATE', 'Deadline'],
    SITE: ['Site', 'Project Site', 'Location']
};

/**
 * Ethiopian Calendar to Gregorian conversion (Resilient Logic)
 * Ethiopian year 1900+ range.
 */
function ethiopianToGregorian(year, month, day) {
    /**
     * Accurate for 1900-2099.
     * Meskerem 1 is Sep 11, or Sep 12 if the previous year was leap (year % 4 == 0).
     */
    const startDay = (year % 4 === 0) ? 12 : 11;
    const startMonth = 8; // September (0-indexed)
    const startYear = year + 7;

    // Create a base date for Meskerem 1
    const date = new Date(startYear, startMonth, startDay);

    // Add (month - 1) * 30 days + (day - 1) days
    const daysToAdd = (month - 1) * 30 + (day - 1);
    date.setDate(date.getDate() + daysToAdd);

    return date;
}

function parseAndNormalizeDate(dateStr) {
    if (!dateStr || dateStr === '—') return null;

    let y, m, d;

    // Handle Date objects (GAS might return these)
    if (dateStr instanceof Date || (typeof dateStr === 'object' && dateStr.getTime)) {
        y = dateStr.getFullYear();
        m = dateStr.getMonth() + 1;
        d = dateStr.getDate();
    } else if (typeof dateStr === 'string') {
        // Support YYYY-MM-DD, YYYY/MM/DD, and ISO strings
        const parts = dateStr.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
        if (!parts) return null;
        y = parseInt(parts[1]);
        m = parseInt(parts[2]);
        d = parseInt(parts[3]);
    } else {
        console.warn("Unsupported date format:", dateStr);
        return null;
    }

    // Heuristic: If year < 2023, assume Ethiopian
    if (y < 2023) {
        return ethiopianToGregorian(y, m, d);
    }
    return new Date(y, m - 1, d);
}

function calculateElapsed(startDateStr) {
    try {
        const start = parseAndNormalizeDate(startDateStr);
        if (!start) return '—';

        const now = new Date();
        const diffTime = now - start;

        // Use Math.ceil or a small buffer to avoid -1 due to timezone millisecond shifts
        if (diffTime < -1000 * 60 * 60 * 2) { // More than 2 hours in the future
            return 'Future Date';
        }

        const totalDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        if (totalDays < 30) {
            return `${totalDays} days`;
        } else {
            const months = Math.floor(totalDays / 30);
            const days = totalDays % 30;
            if (days === 0) return `${months} month${months > 1 ? 's' : ''}`;
            return `${months} month${months > 1 ? 's' : ''} + ${days} day${days > 1 ? 's' : ''}`;
        }
    } catch (e) {
        console.error("Error calculating elapsed date:", e, startDateStr);
        return '—';
    }
}

function getVal(row, keySet) {
    if (!row) return null;
    if (typeof keySet === 'string') keySet = [keySet];

    // 1. Try exact matches from keySet
    for (const k of keySet) {
        if (row[k] !== undefined) return row[k];
    }

    // 2. Try case-insensitive and trimmed matches
    const lowerKeys = Object.keys(row).reduce((acc, k) => {
        acc[k.toLowerCase().trim()] = k;
        return acc;
    }, {});

    for (const k of keySet) {
        const target = k.toLowerCase().trim();
        if (lowerKeys[target]) return row[lowerKeys[target]];
    }

    return null;
}

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
        const nameVal = getVal(row, KEYS.NAME);
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

    const html = matches.map(item => {
        const id = getVal(item, KEYS.ID);
        const name = getVal(item, KEYS.NAME) || 'Unknown Name';
        const phone = getVal(item, KEYS.PHONE) || 'N/A';
        const code = getVal(item, KEYS.CODE) || '#';
        const status = getVal(item, KEYS.STATUS) || 'Status N/A';

        return `
            <div class="search-item p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors flex items-center justify-between group" onclick="openDetails('${id}')">
                <div>
                    <h3 class="text-slate-900 font-bold text-lg group-hover:text-brand-600 transition-colors">${name}</h3>
                    <p class="text-slate-500 text-sm flex items-center gap-2">
                        <i data-lucide="phone" class="w-3 h-3 text-brand-orange"></i> ${phone}
                        <span class="mx-1 text-slate-300">•</span>
                        <span class="text-slate-500">${code}</span>
                    </p>
                </div>
                <div class="text-right">
                    <span class="px-2 py-1 rounded bg-slate-100 text-xs text-slate-600 border border-slate-200 font-medium">${status}</span>
                </div>
            </div>
        `;
    }).join('');

    dom.results.innerHTML = html;
    dom.results.classList.remove('hidden');
    lucide.createIcons();
}

// Global openDetails
window.openDetails = function (id) {
    if (id === undefined || id === null || id === '' || id === 'undefined' || id === 'null') {
        console.warn("Invalid ID passed to openDetails:", id);
        return;
    }

    console.log("Opening details for ID:", id);
    const item = (allData.clients || []).find(r => {
        const itemId = getVal(r, KEYS.ID);
        return String(itemId).trim() === String(id).trim();
    });

    if (!item) {
        console.error("Could not find client with ID:", id, "Available IDs:", allData.clients.map(c => getVal(c, KEYS.ID)));
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
        // Use our robust mapping if it's a known key
        if (KEYS[key]) return getVal(item, KEYS[key]);

        const k = Object.keys(item).find(i => i.trim().toLowerCase() === key.toLowerCase());
        return k ? item[k] : null;
    };

    const cleanNumber = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(String(val).replace(/,/g, '').replace(/[^0-9.-]+/g, "")) || 0;
    };

    const isCurrencyKey = (key) => /amount|paid|total|remaining|balance|price|contract|cost|payment/i.test(key);
    const isProtectedKey = (key) => /phone|code|date|no\.|(\bid\b)|case|item/i.test(key);

    const isUSDClient = (() => {
        const financialKeysToSearch = ['Collection Amount', 'Amount paid', 'Total Contract Amount', 'Paid', 'Total', 'Collected'];
        for (const k of financialKeysToSearch) {
            const rawVal = String(getValue(k) || '');
            if (rawVal.includes('$')) return true;
        }
        return false;
    })();

    const formatCurrency = (val) => {
        const strVal = String(val || '');
        const num = cleanNumber(strVal);

        const formatted = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);

        if (isUSDClient || strVal.includes('$')) {
            const etbEquiv = Math.round(num * USD_TO_ETB_RATE);
            const formattedETB = new Intl.NumberFormat('en-US').format(etbEquiv);
            return `$${formatted} <span class="text-[10px] opacity-60 font-normal ml-1">(${formattedETB} ETB)</span>`;
        }
        return formatted + ' ETB';
    };

    const formatDate = (val) => {
        if (!val || typeof val !== 'string') return val;
        if (val.includes('T') && val.includes('Z')) {
            return val.split('T')[0];
        }
        return val;
    };

    const total = cleanNumber(getValue('TOTAL'));
    const paid = cleanNumber(getValue('PAID'));
    const remaining = total - paid;
    const hasFinancials = total > 0;
    const percentPaid = total > 0 ? Math.round((paid / total) * 100) : 0;

    const urgencyVal = String(getValue('URGENCY') || 'Normal');
    let urgencyColor = 'bg-slate-100 text-slate-600';
    const lowUrg = urgencyVal.toLowerCase();
    if (lowUrg.includes('red') || lowUrg.includes('high')) urgencyColor = 'bg-rose-500 text-white';
    else if (lowUrg.includes('orange') || lowUrg.includes('med')) urgencyColor = 'bg-orange-500 text-white';
    else if (lowUrg.includes('yellow')) urgencyColor = 'bg-amber-400 text-amber-950';
    else if (lowUrg.includes('green')) urgencyColor = 'bg-emerald-500 text-white';
    else if (lowUrg.includes('blue')) urgencyColor = 'bg-blue-500 text-white';

    const statusVal = String(getValue('STATUS') || 'Active');

    // Improved detection: Search absolutely everywhere for these keywords
    const findFeeling = () => {
        const keywords = {
            calm: ['calm', 'relax', 'peace'],
            moderate: ['moderate', 'normal', 'ok', 'neutral'],
            angry: ['angry', 'angery', 'upset', 'complain', 'bad']
        };

        const checkText = (text) => {
            if (!text) return null;
            const t = String(text).toLowerCase();
            if (t.includes('calm')) return 'calm';
            if (t.includes('moderate')) return 'moderate';
            if (t.includes('angry') || t.includes('angery')) return 'angry';
            return null;
        };

        // 1. Check primary status field
        let found = checkText(statusVal);
        if (found) return found;

        // 2. Check all other fields in the customer record
        for (const k in item) {
            found = checkText(item[k]);
            if (found) return found;
        }
        return null;
    };

    const feeling = findFeeling();
    let statusEmoji = '';
    let statusBg = 'bg-blue-50 text-brand-600 border-blue-100';

    if (feeling === 'calm') {
        statusEmoji = '😌';
        statusBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (feeling === 'moderate') {
        statusEmoji = '😐';
        statusBg = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (feeling === 'angry') {
        statusEmoji = '😡';
        statusBg = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (statusVal.toLowerCase().includes('sold')) {
        statusBg = 'bg-green-100 text-green-700 border-green-200';
    }

    const contractDate = formatDate(getValue('CONTRACT_DATE'));
    const cancelDate = formatDate(getValue('CANCEL_DATE'));
    // Calculate Elapse Date based on Cancellation Date
    const rawCancelDate = getValue('CANCEL_DATE');
    const elapseDate = calculateElapsed(rawCancelDate);
    const siteVal = String(getValue('SITE') || 'N/A');

    // Grouping Logic
    const sections = {
        profile: { title: 'Client Profile', icon: 'user', items: [] },
        property: { title: 'Property Details', icon: 'home', items: [] },
        financials: { title: 'Financial Records', icon: 'banknote', items: [] },
        admin: { title: 'Administrative', icon: 'clipboard-list', items: [] }
    };

    const profileKeys = ['Phone No.', 'PHONE No.', 'Email', 'Address', 'Occupation', 'Phone', 'Mobile'];
    const propertyKeys = ['Code', 'CODE', 'Project', 'Floor', 'Type', 'Area', 'Unit No.', 'Unit', 'Sqm', 'Bedroom', 'Site', 'Sold Stock'];
    const financialKeys = ['Amount paid', 'Remaining Amount', 'Total Contract Amount', 'Collection Amount', 'Amendment payment', 'Refund Amount', 'Vat Amount', 'Paid', 'Balance', 'Price'];

    // Only ignore keys explicitly shown in the main header/stats board
    const boardKeys = ['NAME', 'Buyers Name', 'No.', 'ITEM No.', 'Status', 'Contract status', 'Customer status', 'Urgency', 'Date', 'Contract date', 'Cancellation Date', 'Elapse date', 'Site'];
    const ignoredKeys = boardKeys.map(k => k.toLowerCase().trim());

    Object.keys(item).forEach(key => {
        const kLower = key.toLowerCase().trim();
        if (ignoredKeys.includes(kLower)) return;

        let val = item[key];
        if (val === null || val === undefined || String(val).trim() === '' || String(val).trim() === '—') return;

        let displayVal = String(val);
        displayVal = formatDate(displayVal);

        // Auto-format currency for financial-looking keys
        if (displayVal !== '—' && (isCurrencyKey(key) || financialKeys.some(fk => kLower.includes(fk.toLowerCase().trim()))) && !isProtectedKey(key)) {
            displayVal = formatCurrency(displayVal);
        }

        const fieldHtml = `
            <div class="bg-slate-50/50 p-3 rounded-xl border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
                <p class="text-slate-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">${key}</p>
                <p class="text-slate-800 font-medium text-sm break-words">${displayVal}</p>
            </div>
        `;

        if (profileKeys.some(k => kLower.includes(k.toLowerCase().trim()))) {
            sections.profile.items.push(fieldHtml);
        } else if (propertyKeys.some(k => kLower.includes(k.toLowerCase().trim()))) {
            sections.property.items.push(fieldHtml);
        } else if (financialKeys.some(fk => kLower.includes(fk.toLowerCase().trim()))) {
            sections.financials.items.push(fieldHtml);
        } else {
            sections.admin.items.push(fieldHtml);
        }
    });

    const renderSection = (section) => {
        if (section.items.length === 0) return '';
        return `
            <div class="mb-8 last:mb-0">
                <div class="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                    <i data-lucide="${section.icon}" class="w-5 h-5 text-brand-500"></i>
                    <h3 class="text-slate-900 font-bold text-base uppercase tracking-tight">${section.title}</h3>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${section.items.join('')}
                </div>
            </div>
        `;
    };

    const content = `
        <!-- Sticky Header Context -->
        <div class="sticky top-0 z-40 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-slate-100 shadow-sm sm:px-8">
            <button onclick="closeModal()" class="flex items-center gap-2 text-brand-500 font-semibold hover:text-brand-600 transition-colors">
                <i data-lucide="chevron-left" class="w-5 h-5"></i>
                <span>Back</span>
            </button>
            <div class="flex items-center gap-2">
                 <button onclick="requestUpdate('${getVal(item, KEYS.ID)}')" id="btn-update-${getVal(item, KEYS.ID)}" class="px-4 py-1.5 bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold rounded-full flex items-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> 
                    <span class="hidden xs:inline">Request Update</span>
                    <span class="inline xs:hidden">Update</span>
                </button>
            </div>
        </div>

        <div class="p-6 sm:p-8">
            <!-- Section 1: Title, Status & Financial Board -->
            <div class="mb-10">
                <!-- Title & Status Section -->
            <div class="mb-8">
                <div class="flex flex-col md:flex-row justify-between items-start gap-6">
                    <div class="flex-1">
                        <h2 class="text-4xl md:text-6xl font-black text-slate-900 mb-5 tracking-tight leading-[1.1]">${getVal(item, KEYS.NAME)}</h2>
                        <div class="flex flex-wrap items-center gap-3">
                            <span class="inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-sm font-bold border transition-all shadow-sm ${statusBg}">
                                <span class="text-xl">${statusEmoji}</span>
                                <span class="uppercase tracking-widest">${statusVal}</span>
                            </span>
                            <span class="px-5 py-2 rounded-2xl text-sm font-bold uppercase tracking-widest shadow-sm border border-transparent ${urgencyColor}">${urgencyVal} Urgency</span>
                            <span class="px-5 py-2 rounded-2xl text-sm font-bold bg-slate-100 text-slate-600 border border-slate-200 font-mono tracking-widest shadow-sm">${getVal(item, KEYS.CODE) || '#'}</span>
                            <span class="px-5 py-2 rounded-2xl text-sm font-bold bg-slate-100 text-brand-500 border border-slate-200 font-mono tracking-widest shadow-sm">${siteVal}</span>
                        </div>
                    </div>
                </div>
            </div>
                ${hasFinancials ? `
            <div class="bg-slate-900 rounded-3xl p-6 md:p-8 mb-10 text-white shadow-2xl relative overflow-hidden group">
                <!-- Abstract visual element -->
                <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl group-hover:bg-brand-500/20 transition-all duration-700"></div>
                
                <div class="relative z-10">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div>
                            <p class="text-blue-300 text-[10px] uppercase font-bold tracking-[0.2em] mb-2">Total Contract Value</p>
                            <p class="text-3xl md:text-5xl font-black">${formatCurrency(total)}</p>
                        </div>
                        <div class="w-24 h-24 shrink-0">
                            <canvas id="financeChart"></canvas>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/10">
                        <div>
                            <div class="flex justify-between items-end mb-3">
                                <div>
                                    <p class="text-emerald-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Collected Amount (DP)</p>
                                    <p class="text-3xl font-black text-white leading-none">${formatCurrency(paid)}</p>
                                </div>
                            </div>
                            <div class="h-4 w-full bg-white/10 rounded-full overflow-hidden shadow-inner mb-2">
                                <div class="h-full bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-1000" style="width: ${percentPaid}%"></div>
                            </div>
                            <p class="text-emerald-400 text-[10px] font-black uppercase tracking-[0.1em]">${percentPaid}% Collected</p>
                        </div>
                        <div>
                            <div class="flex justify-between items-end mb-3">
                                <div>
                                    <p class="text-rose-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Remaining Balance</p>
                                    <p class="text-3xl font-black text-white leading-none">${formatCurrency(remaining)}</p>
                                </div>
                            </div>
                            <div class="h-4 w-full bg-white/10 rounded-full overflow-hidden shadow-inner mb-2">
                                <div class="h-full bg-rose-500 rounded-full shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all duration-1000" style="width: ${100 - percentPaid}%"></div>
                            </div>
                            <p class="text-rose-400 text-[10px] font-black uppercase tracking-[0.1em]">${100 - percentPaid}% Outstanding</p>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
            ` : ''}
            </div>

            <!-- Section 2: Integrated Key Dates -->
            <div class="mb-10 pb-8 border-b border-slate-100">
                <!-- Order: Cancellation, Elapse, Contract -->
            <div class="flex flex-wrap gap-3 mb-8 pb-8 border-b border-slate-100">
                ${contractDate && contractDate !== '—' ? `
                <div class="flex-1 min-w-[140px] bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm transition-all hover:bg-slate-100/50">
                    <p class="text-slate-400 text-[10px] uppercase font-extrabold tracking-[0.15em] mb-1">Contract Date</p>
                    <p class="text-slate-800 font-bold text-base md:text-lg">${contractDate}</p>
                </div>
                ` : ''}
                ${elapseDate && elapseDate !== '—' ? `
                <div class="flex-1 min-w-[140px] bg-amber-50/50 border border-amber-100 p-4 rounded-2xl shadow-sm transition-all hover:bg-amber-50">
                    <p class="text-amber-600 text-[10px] uppercase font-extrabold tracking-[0.15em] mb-1">Elapse Date</p>
                    <p class="text-amber-800 font-bold text-base md:text-lg">${elapseDate}</p>
                </div>
                ` : ''}
                ${cancelDate && cancelDate !== '—' ? `
                <div class="flex-1 min-w-[140px] bg-rose-50/50 border border-rose-100 p-4 rounded-2xl shadow-sm transition-all hover:bg-rose-50">
                    <p class="text-rose-500 text-[10px] uppercase font-extrabold tracking-[0.15em] mb-1">Cancellation Date</p>
                    <p class="text-rose-700 font-bold text-base md:text-lg">${cancelDate}</p>
                </div>
                ` : ''}
            </div>
            </div>

            <!-- Section 3: Information Sections -->
            <div class="space-y-4">
                ${renderSection(sections.profile)}
                ${renderSection(sections.property)}
                ${renderSection(sections.financials)}
                ${renderSection(sections.admin)}
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
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    cutout: '75%',
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    responsive: true,
                    maintainAspectRatio: false
                }
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

    const url = `${SCRIPT_URL}?id=${encodeURIComponent(id)}&action=request_update&deviceId=${DEVICE_ID}&userName=${encodeURIComponent(USER_NAME)}`;

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
