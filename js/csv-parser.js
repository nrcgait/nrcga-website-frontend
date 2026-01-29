// CSV Parser Utility
// Shared utility for parsing CSV files into JavaScript objects

/**
 * Parse CSV text into an array of objects
 * @param {string} csvText - The CSV file content as text
 * @param {boolean} hasHeaders - Whether the first row contains headers (default: true)
 * @returns {Array<Object>} Array of objects with keys from headers
 */
function parseCSV(csvText, hasHeaders = true) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];
    
    // Parse headers
    const headers = hasHeaders ? parseCSVLine(lines[0]) : null;
    
    // Parse data rows
    const startIndex = hasHeaders ? 1 : 0;
    const data = [];
    
    for (let i = startIndex; i < lines.length; i++) {
        if (lines[i].trim() === '') continue; // Skip empty lines
        
        const values = parseCSVLine(lines[i]);
        if (hasHeaders && headers) {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] || '';
            });
            data.push(obj);
        } else {
            data.push(values);
        }
    }
    
    return data;
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

