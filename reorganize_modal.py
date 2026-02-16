import os
import re
import sys

file_path = sys.argv[1]
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Get Date Header Section
# Matches from <!-- Order: ... --> to </div>
dates_pattern = r'(            <!-- Order: Cancellation, Elapse, Contract -->\s*<div class="flex flex-wrap gap-3 mb-8 pb-8 border-b border-slate-100">.*?</div>\s*' + re.escape('    `') + r'\s*: \'\')\s*</div>'
# That's too complex. Let's use simple find/replace with known strings.

dates_start = '<!-- Order: Cancellation, Elapse, Contract -->'
dates_end = '</div>\n            </div>' # This is tricky due to nested divs

# Let's use a simpler approach: get indices based on UNIQUE markers
i_dates_start = content.find('<!-- Order: Cancellation, Elapse, Contract -->')
i_dates_div_start = content.find('<div class="flex flex-wrap gap-3 mb-8 pb-8 border-b border-slate-100">', i_dates_start)
# Find the matching </div> for i_dates_div_start
def find_matching_div(s, start_idx):
    depth = 0
    i = start_idx
    while i < len(s):
        if s[i:i+4] == '<div':
            depth += 1
            i += 4
        elif s[i:i+6] == '</div>':
            depth -= 1
            i += 6
            if depth == 0:
                return i
        else:
            i += 1
    return -1

i_dates_end = find_matching_div(content, i_dates_div_start)
dates_block = content[i_dates_start:i_dates_end]

# 2. Get Name/Status Section
i_name_start = content.find('<!-- Title & Status Section -->')
i_name_div_start = content.find('<div class="mb-8">', i_name_start)
i_name_end = find_matching_div(content, i_name_div_start)
name_block = content[i_name_start:i_name_end]

# 3. Get Financial Section
i_fin_start = content.find('${hasFinancials ? `')
i_fin_end = content.find('` : \'\'}', i_fin_start) + 7
fin_block = content[i_fin_start:i_fin_end]

# 4. Get Info Sections
i_info_start = content.find('<!-- Information Sections -->')
i_info_div_start = content.find('<div class="space-y-2">', i_info_start)
i_info_end = find_matching_div(content, i_info_div_start)
info_block = content[i_info_start:i_info_end]

# Reconstruct
# We want: Name -> Financial -> Dates -> Info
# The container is <div class="p-6 sm:p-8">

container_start = content.find('<div class="p-6 sm:p-8">') + len('<div class="p-6 sm:p-8">')
container_end = content.rfind('</div>', 0, content.find('`;', container_start))

new_body = f"""
            <!-- Section 1: Title, Status & Financial Board -->
            <div class="mb-10">
                {name_block}
                {fin_block}
            </div>

            <!-- Section 2: Integrated Key Dates -->
            <div class="mb-10 pb-8 border-b border-slate-100">
                {dates_block}
            </div>

            <!-- Section 3: Information Sections -->
            <div class="space-y-4">
                ${{renderSection(sections.profile)}}
                ${{renderSection(sections.admin)}}
                ${{renderSection(sections.property)}}
            </div>
"""

final_content = content[:container_start] + new_body + content[container_end:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(final_content)

print("Successfully reorganized app.js with Python")
