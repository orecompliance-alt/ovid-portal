const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
let content = fs.readFileSync(filePath, 'utf8');

// Define the sections to extract
// We'll use marker comments or specific HTML blocks as delimiters

const datesStartMarker = '<!-- Order: Cancellation, Elapse, Contract -->';
const datesEndMarker = '</div>\r\n\r\n            <!-- Title & Status Section -->';
// Wait, the markers might not match exactly. Let me use more robust regex.

const getSection = (startRegex, endRegex) => {
    const startMatch = content.match(startRegex);
    if (!startMatch) return null;
    const startIndex = startMatch.index;
    const rest = content.substring(startIndex + startMatch[0].length);
    const endMatch = rest.match(endRegex);
    if (!endMatch) return null;
    const endIndex = startIndex + startMatch[0].length + endMatch.index + endMatch[0].length;
    return {
        full: content.substring(startIndex, endIndex),
        start: startIndex,
        end: endIndex
    };
};

// 1. Get Date Header
const datesSection = getSection(/<!-- Order: Cancellation, Elapse, Contract -->/, /<\/div>\s*<\/div>/);
if (!datesSection) { console.error("Could not find Dates Section"); process.exit(1); }

// 2. Get Name/Status
const nameSection = getSection(/<!-- Title & Status Section -->/, /<\/div>\s*<\/div>/);
if (!nameSection) { console.error("Could not find Name Section"); process.exit(1); }

// 3. Get Financial Board
const financialSection = getSection(/\${hasFinancials \? `/, /` : ''}/);
if (!financialSection) { console.error("Could not find Financial Section"); process.exit(1); }

// 4. Get Info Sections
const infoSection = getSection(/<!-- Information Sections -->/, /<\/div>\s*<\/div>\s*`;/);
if (!infoSection) { console.error("Could not find Info Section"); process.exit(1); }

// Reconstruct the template body
// New Order: Name -> Financial -> Dates -> Info

const templateStart = content.indexOf('<div class="p-6 sm:p-8">');
const templateEnd = content.indexOf('</div>\r\n    `;', templateStart) + 8; // Adjust based on file

// Actually, let's just replace the blocks in-place but that's messy.
// Let's replace the whole body of <div class="p-6 sm:p-8"> ... </div>

const bodyStart = templateStart + '<div class="p-6 sm:p-8">'.length;
const bodyEnd = templateEnd - '</div>\r\n    `;'.length;

const newBody = `
            <!-- Section 1: Title, Status & Financial Board -->
            <div class="mb-10">
                ${nameSection.full}
                ${financialSection.full}
            </div>

            <!-- Section 2: Integrated Key Dates -->
            <div class="mb-10 pb-8 border-b border-slate-100">
                ${datesSection.full}
            </div>

            <!-- Section 3: Information Sections -->
            ${infoSection.full}
        `;

const finalContent = content.substring(0, bodyStart) + newBody + content.substring(bodyEnd);

fs.writeFileSync(filePath, finalContent);
console.log("Successfully reorganized app.js");
