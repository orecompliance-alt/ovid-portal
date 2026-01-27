// PASTE YOUR GOOGLE SCRIPT URL HERE AFTER DEPLOYING
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxahv-0UjHWai2VWBdv6eR8Jl6T9UrmIH9R9REoz6jbru0s3zaiNHEXQbwSaluR2rm_/exec';
const SHEET_URL = SCRIPT_URL + '?action=getData';

const dom = {
    input: document.getElementById('searchInput'),
    results: document.getElementById('searchResults'),
    loading: document.getElementById('loadingIndicator'),
    error: document.getElementById('errorMessage'),
    modal: document.getElementById('detailsModal'),
    modalContent: document.getElementById('modalContent'),
    backdrop: document.getElementById('modalBackdrop'),
    closeBtn: document.getElementById('closeModal'),
    newsSection: document.getElementById('newsSection'),
    newsFeed: document.getElementById('newsFeed'),
};

let allData = { clients: [], news: [] };

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setupEventListeners();
});

function setupEventListeners() {
    dom.input.addEventListener('input', handleSearch);
    dom.closeBtn.addEventListener('click', closeModal);
    dom.backdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function fetchData() {
    dom.loading.classList.remove('hidden');

    fetch(SHEET_URL)
        .then(response => {
            if (!response.ok) throw new Error(`Network response was not ok (Status: ${response.status})`);
            return response.json();
        })
        .then(data => {
            dom.loading.classList.add('hidden');
            allData = data || { clients: [], news: [] };

            console.log("Loaded clients:", allData.clients?.length || 0);
            console.log("Loaded news:", allData.news?.length || 0);

            if (allData.clients?.length > 0) {
                console.log("Client Data structure (Keys):", Object.keys(allData.clients[0]));
            }
            if (allData.news?.length > 0) {
                console.log("News Data structure (Keys):", Object.keys(allData.news[0]));
            }

            renderNews(allData.news || []);
        })
        .catch(error => {
            dom.loading.classList.add('hidden');
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
        // Also search phone or code if needed
        return name.includes(query);
    });

    renderResults(matches);
}

function renderNews(newsItems) {
    if (!newsItems || newsItems.length === 0) {
        dom.newsSection.classList.add('hidden');
        return;
    }

    // Helper to convert Google Drive links to direct image links
    const formatImageUrl = (url) => {
        if (!url || typeof url !== 'string') return '';
        const trimmedUrl = url.trim();
        if (trimmedUrl.includes('drive.google.com')) {
            // Updated regex to catch more drive formats
            const match = trimmedUrl.match(/\/d\/(.+?)\/(view|edit|\?|#|$)/) ||
                trimmedUrl.match(/id=(.+?)(&|$)/) ||
                trimmedUrl.match(/\/file\/d\/(.+?)\//);
            if (match && match[1]) {
                const id = match[1];
                // Using the thumbnail endpoint is much more reliable for public embedding
                return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
            }
        }
        return trimmedUrl;
    };

    const html = newsItems.map(item => {
        // Case-insensitive lookups for News headers
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
                    <img src="${img}" class="w-full h-full object-cover" 
                        onload="console.log('Image loaded:', this.src)"
                        onerror="console.error('Image failed to load:', this.src); this.style.display='none'; this.parentElement.innerHTML='<div class=\'text-[10px] text-slate-400\'>Image restricted</div>'">
                </div>` : ''}
                <div class="flex items-center gap-2 mb-2">
                    <span class="px-2 py-0.5 rounded-full bg-orange-100 text-brand-orange text-[10px] font-bold uppercase tracking-wider">${date}</span>
                    <div class="h-1 w-1 rounded-full bg-slate-300"></div>
                </div>
                <h4 class="text-brand-500 font-bold text-sm mb-1 line-clamp-1">${headline}</h4>
                <p class="text-slate-500 text-xs line-clamp-2 leading-relaxed">${text}</p>
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

    // Add click listeners to items (already done inline with onclick for simplicity, or add generic delegation)
    // Note: The inline `onclick="openDetails(...)"` requires `openDetails` to be global.
}

// Make global for inline onclick
window.openDetails = function (id) {
    if (!id || id === 'undefined') {
        console.error("Invalid ID passed to openDetails:", id);
        return;
    }

    // Robust ID matching
    const item = (allData.clients || []).find(r => {
        // Try exact match first
        if (r['ITEM No.'] == id) return true;

        // Try case-insensitive and trimmed match for the ID key
        const idKey = Object.keys(r).find(k => k.trim().toLowerCase() === 'item no.');
        return idKey && r[idKey] == id;
    });

    if (!item) {
        console.warn("Item not found for ID:", id, "Available IDs:", (allData.clients || []).slice(0, 5).map(r => r['ITEM No.']));
        return;
    }

    try {
        renderDetails(item);
        dom.modal.classList.remove('hidden');
    } catch (err) {
        console.error("Error in renderDetails:", err);
        showError("Failed to render item details. Check console for details.");
    }
}

function closeModal() {
    dom.modal.classList.add('hidden');
}



function renderDetails(item) {
    console.log("Rendering details for:", item['NAME']);
    console.table(item); // Debugging: Show all received data in console table

    // Helper: Case-insensitive value lookup
    const getValue = (keyName) => {
        if (!item) return null;
        const key = Object.keys(item).find(k => k.trim().toLowerCase() === keyName.toLowerCase().trim());
        return key ? item[key] : null;
    };

    // 1. Prepare Data for Chart
    const cleanNumber = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const str = String(val);
        return parseFloat(str.replace(/,/g, '').replace(/[^0-9.-]+/g, "")) || 0;
    };

    // Helper to find first non-zero financial value from a list of potential keys
    const getFinancialValue = (possibleKeys) => {
        for (const key of possibleKeys) {
            const val = getValue(key);
            const num = cleanNumber(val);
            if (num > 0) return { num, str: val };
        }
        return { num: 0, str: '0' };
    };

    // Robust access using fuzzy key matching
    const totalObj = getFinancialValue(['TOTAL CONTRACT AMOUNT', 'Total Contract Amount', 'Target Amount']);
    const paidObj = getFinancialValue(['COLLECTED AMOUNT/DP', 'Collected', 'Amount Paid', 'Paid']);
    const remainingObj = getFinancialValue(['REMAINING AMOUNT', 'Remaining', 'Balance']);

    const total = totalObj.num;
    let paid = paidObj.num;
    let remaining = remainingObj.num;

    const totalStr = totalObj.str !== '0' ? getValue('TOTAL CONTRACT AMOUNT') || totalObj.str : (getValue('TOTAL CONTRACT AMOUNT') || '0');

    // Fix: If Remaining is missing but we have Total and Paid, calculate it.
    if (remaining === 0 && total > 0) {
        remaining = total - paid;
    }
    // Fix: If Paid is missing, calculate from Total - Remaining
    if (paid === 0 && total > 0 && remaining > 0) {
        paid = total - remaining;
    }

    const hasFinancials = total > 0;

    // 2. Build Dynamic Grid Logic
    // Explicitly defining keys to ignore. 
    // REMOVED Financial keys ('TOTAL CONTRACT AMOUNT' etc) from here so they show up in the grid as a failsafe.
    const ignoredKeys = ['NAME', 'Satus', 'Status', 'Code', 'CODE', 'Case', 'id', 'ITEM No.', 'Urgency'];

    let dynamicFieldsHtml = '';
    const itemKeys = Object.keys(item);
    console.log("Found " + itemKeys.length + " keys in item");

    itemKeys.forEach(key => {
        let val = item[key];
        // Skip only if key is truly empty or in ignored list
        if (!key || key.trim() === '' || ignoredKeys.some(k => k.toLowerCase() === key.toLowerCase())) return;

        // Use placeholder for empty/null values instead of skipping
        let displayVal = (val === null || val === undefined || String(val).trim() === '') ? '—' : String(val);

        dynamicFieldsHtml += `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:bg-white hover:shadow-md hover:border-brand-500/30 transition-all group/item">
                <p class="text-slate-400 text-[10px] uppercase tracking-wider mb-1 font-semibold group-hover/item:text-brand-500 transition-colors">${key}</p>
                <p class="text-slate-800 font-medium text-sm md:text-base break-words">${displayVal}</p>
            </div>
        `;
    });

    // Urgency Logic
    const urgencyVal = getValue('Urgency');
    let urgencyBadge = '';

    if (urgencyVal !== null && urgencyVal !== undefined && String(urgencyVal).trim() !== '') {
        const u = String(urgencyVal).toLowerCase();
        let uColor = 'border-slate-600 bg-slate-800 text-slate-300';

        if (u.includes('red') || u.includes('high')) uColor = 'border-red-200 bg-red-50 text-red-700';
        else if (u.includes('yellow') || u.includes('med')) uColor = 'border-yellow-200 bg-yellow-50 text-yellow-700';
        else if (u.includes('green') || u.includes('low')) uColor = 'border-emerald-200 bg-emerald-50 text-emerald-700';

        urgencyBadge = `
            <div class="mt-4 sm:mt-0 px-4 py-2 rounded-xl border ${uColor} flex items-center gap-2 self-start sm:self-auto">
                <i data-lucide="alert-circle" class="w-4 h-4"></i>
                <div>
                    <p class="text-[10px] uppercase tracking-wide opacity-75">Urgency</p>
                    <p class="font-bold capitalize">${urgencyVal}</p>
                </div>
            </div>
        `;
    }

    // Status Styling
    const rawStatus = getValue('Satus') || getValue('Status') || 'Active';
    const statusVal = String(rawStatus);
    const statusColor = statusVal.toLowerCase().includes('sold')
        ? 'text-green-700 bg-green-100 border-green-200'
        : 'text-brand-600 bg-blue-50 border-blue-200';

    const codeVal = getValue('CODE') || getValue('Code') || 'No Code';

    const content = `
        <!-- Header -->
        <div class="relative bg-white p-6 sm:p-8 flex flex-col gap-6 border-b border-slate-100 shadow-sm z-10">
            
            <!-- Back Navigation for Mobile/Mobile-first -->
            <button onclick="closeModal()" class="flex items-center gap-2 text-brand-500 hover:text-brand-600 font-medium transition-colors w-fit group">
                <i data-lucide="arrow-left" class="w-5 h-5 group-hover:-translate-x-1 transition-transform"></i>
                <span>Back to Search</span>
            </button>

            <div class="flex flex-col md:flex-row justify-between items-start gap-4">
                <div class="flex-1">
                    <h2 class="text-2xl md:text-3xl font-bold text-brand-500 mb-2">${getValue('NAME')}</h2>
                    <div class="flex flex-wrap items-center gap-2 mb-2">
                        <span class="px-3 py-1 rounded-full text-sm border ${statusColor} font-bold shadow-sm">${statusVal}</span>
                        <span class="px-3 py-1 rounded-full text-sm border border-slate-200 text-slate-600 bg-slate-50 font-mono">${codeVal}</span>
                        
                        <!-- Need Update Button -->
                        <button onclick="requestUpdate('${item['ITEM No.']}')" id="btn-update-${item['ITEM No.']}" class="ml-2 px-3 py-1 bg-brand-orange hover:bg-orange-600 text-white text-xs rounded-full transition-colors flex items-center gap-1 shadow-md shadow-orange-200">
                            <i data-lucide="refresh-cw" class="w-3 h-3"></i> Need Update
                        </button>
                    </div>
                </div>
                
                ${urgencyBadge}

                 <!-- Financial Summary Chart (Compact) -->
                 ${hasFinancials ? `
                    <div class="w-full md:w-48 h-32 flex items-center justify-center bg-slate-50 rounded-xl p-2 border border-slate-200 shrink-0">
                        <canvas id="financeChart"></canvas>
                    </div>
                 ` : ''}
            </div>
        </div>

        <!-- Scrollable Body -->
        <div class="p-6 sm:p-8 max-h-[60vh] overflow-y-auto">
            
            <!-- Financial Check -->
            ${hasFinancials ? `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="bg-brand-500 text-white p-4 rounded-2xl relative overflow-hidden shadow-lg shadow-blue-200">
                    <div class="absolute inset-0 bg-white/10"></div>
                    <p class="text-blue-100 text-xs uppercase mb-1 relative z-10 font-medium">Total Contract</p>
                    <p class="text-xl md:text-2xl font-bold relative z-10">${totalStr}</p>
                </div>
                <div class="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                    <p class="text-emerald-600 text-xs uppercase mb-1 font-bold">Paid / DP</p>
                    <p class="text-xl md:text-2xl font-bold text-emerald-700">${Number(paid).toLocaleString()}</p>
                </div>
                <div class="bg-rose-50 border border-rose-200 p-4 rounded-2xl">
                    <p class="text-rose-600 text-xs uppercase mb-1 font-bold">Remaining</p>
                    <p class="text-xl md:text-2xl font-bold text-rose-700">${Number(remaining).toLocaleString()}</p>
                </div>
            </div>
            ` : ''}

            <h3 class="text-lg font-semibold text-brand-500 mb-4 flex items-center gap-2">
                <i data-lucide="layout-grid" class="w-5 h-5 text-brand-orange"></i> Customer Details
            </h3>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                ${dynamicFieldsHtml}
            </div>
        </div>
    `;

    dom.modalContent.innerHTML = content;
    lucide.createIcons();

    // Render Chart if elements exist
    try {
        if (hasFinancials) {
            const ctx = document.getElementById('financeChart');
            if (ctx) {
                // ... (Chart initialization remains the same)
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Paid', 'Remaining'],
                        datasets: [{
                            data: [paid, remaining],
                            backgroundColor: ['#10b981', '#f43f5e'], // Emerald-500, Rose-500
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        let label = context.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
                                        if (context.parsed !== null) {
                                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB' }).format(context.parsed).replace('ETB', '');
                                        }
                                        return label;
                                    }
                                }
                            }
                        },
                        cutout: '65%',
                    }
                });
            }
        }
    } catch (chartError) {
        console.error("Chart.js failed to initialize:", chartError);
    }
}

// Make global
window.requestUpdate = function (id) {
    const btn = document.getElementById(`btn-update-${id}`);

    // UI Loading State
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Sending...`;
    btn.disabled = true;
    lucide.createIcons();

    // Send GET Request (Easier to debug)
    const targetUrl = `${SCRIPT_URL}?id=${encodeURIComponent(id)}&action=request_update`;

    fetch(targetUrl, {
        method: 'GET',
        mode: 'no-cors'
        // no-cors is still needed because GAS doesn't send CORS headers for anonymous simple GETs either usually, 
        // but GET is safer and easier to test manually.
    }).then(() => {
        // Assume success if no network error
        btn.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> Requested`;
        btn.classList.remove('bg-slate-700', 'hover:bg-slate-600');
        btn.classList.add('bg-green-600', 'text-white');
        lucide.createIcons();
    }).catch(err => {
        console.error(err);
        btn.innerHTML = `<i data-lucide="x" class="w-3 h-3"></i> Error`;
        btn.classList.add('bg-red-600');
        btn.disabled = false;
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('bg-red-600');
            lucide.createIcons();
        }, 3000);
    });
};

function showError(msg) {
    dom.error.textContent = msg;
    dom.error.classList.remove('hidden');
}
