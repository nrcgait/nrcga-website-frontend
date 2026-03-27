// CSV Parser Utility
// Shared utility for parsing CSV files into JavaScript objects

/**
 * Parse CSV text into an array of objects
 * @param {string} csvText - The CSV file content as text
 * @param {boolean} hasHeaders - Whether the first row contains headers (default: true)
 * @returns {Array<Object>} Array of objects with keys from headers
 */
function parseCSV(csvText, hasHeaders = true) {
    // BOM (common when Excel saves UTF-8) makes the first header "\ufefftype" so obj.type is always undefined
    let text = String(csvText).replace(/^\uFEFF/, '').trim();
    // Normalize newlines so CRLF / old Mac CR don't merge rows or leave stray \r in fields
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length === 0) return [];
    
    // Parse headers (trim each key so spaces around names don't break lookups)
    const headers = hasHeaders ? parseCSVLine(lines[0]).map(h => String(h || '').trim().replace(/^\uFEFF/, '')) : null;
    
    // Parse data rows
    const startIndex = hasHeaders ? 1 : 0;
    const data = [];
    
    for (let i = startIndex; i < lines.length; i++) {
        if (lines[i].trim() === '') continue; // Skip empty lines
        
        const values = parseCSVLine(lines[i]);
        if (hasHeaders && headers) {
            const obj = {};
            headers.forEach((header, index) => {
                const key = header || `column_${index}`;
                obj[key] = values[index] !== undefined ? values[index] : '';
            });
            data.push(obj);
        } else {
            data.push(values);
        }
    }
    
    return data;
}

/**
 * Read one column by header name; matching is case-insensitive and ignores non-breaking spaces.
 * Use with rows from loadCSV() when Excel changes "Type" vs "type" or "Company Name" vs "company name".
 * @returns {string} trimmed cell text, or '' if missing
 */
function pickCsvField(obj, name) {
    if (!obj || typeof obj !== 'object') return '';
    const target = String(name).trim().toLowerCase().replace(/\u00a0/g, ' ');
    for (const k of Object.keys(obj)) {
        const kn = String(k).trim().toLowerCase().replace(/\u00a0/g, ' ').replace(/^\uFEFF/, '');
        if (kn === target) {
            const v = obj[k];
            if (v == null) return '';
            return String(v).trim();
        }
    }
    return '';
}

/**
 * Parse a single CSV line, handling quoted fields and escaped quotes
 * @param {string} line - A single line from the CSV
 * @returns {Array<string>} Array of field values
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // Field separator
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add last field
    values.push(current.trim());
    
    return values;
}

/**
 * Load and parse a CSV file
 * @param {string} csvPath - Path to the CSV file
 * @returns {Promise<Array<Object>>} Promise that resolves to parsed data
 */
async function loadCSV(csvPath) {
    try {
        const response = await fetch(csvPath);
        if (!response.ok) {
            throw new Error(`Failed to load CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        return parseCSV(csvText, true);
    } catch (error) {
        console.error(`Error loading CSV from ${csvPath}:`, error);
        throw error;
    }
}

