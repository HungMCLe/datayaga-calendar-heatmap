const fs = require("fs");

// Generate comprehensive sample data for Calendar Heatmap v2.0.0.0
// Covers 2023-2024, every single day, with multiple columns + annotations

const rows = ["Date,Sales,Orders,AvgOrderValue,Returns,Annotation"];

function seededRandom(seed) {
    let s = seed;
    return function() {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

const rand = seededRandom(42);

// Holidays and events for annotations
const annotations = {
    "2023-01-01": "New Year's Day",
    "2023-01-16": "MLK Day",
    "2023-02-14": "Valentine's Day",
    "2023-02-20": "Presidents' Day",
    "2023-03-17": "St. Patrick's Day",
    "2023-04-09": "Easter",
    "2023-05-14": "Mother's Day",
    "2023-05-29": "Memorial Day",
    "2023-06-18": "Father's Day",
    "2023-07-04": "Independence Day",
    "2023-09-04": "Labor Day",
    "2023-10-31": "Halloween",
    "2023-11-23": "Thanksgiving",
    "2023-11-24": "Black Friday",
    "2023-11-27": "Cyber Monday",
    "2023-12-24": "Christmas Eve",
    "2023-12-25": "Christmas Day",
    "2023-12-31": "New Year's Eve",
    "2024-01-01": "New Year's Day",
    "2024-01-15": "MLK Day",
    "2024-02-14": "Valentine's Day",
    "2024-02-19": "Presidents' Day",
    "2024-03-17": "St. Patrick's Day",
    "2024-03-31": "Easter",
    "2024-05-12": "Mother's Day",
    "2024-05-27": "Memorial Day",
    "2024-06-16": "Father's Day",
    "2024-07-04": "Independence Day",
    "2024-09-02": "Labor Day",
    "2024-10-31": "Halloween",
    "2024-11-28": "Thanksgiving",
    "2024-11-29": "Black Friday",
    "2024-12-02": "Cyber Monday",
    "2024-12-24": "Christmas Eve",
    "2024-12-25": "Christmas Day",
    "2024-12-31": "New Year's Eve",
    // Product launches / company events
    "2023-03-01": "Spring Sale Launch",
    "2023-06-01": "Summer Campaign",
    "2023-09-15": "Fall Collection",
    "2023-10-15": "Early Holiday Promo",
    "2024-02-01": "New Product Line",
    "2024-04-15": "Spring Clearance",
    "2024-06-01": "Summer Campaign",
    "2024-08-15": "Back to School",
    "2024-09-15": "Fall Collection",
    "2024-10-15": "Early Holiday Promo",
};

// Major spike days (anomalies)
const spikeDays = new Set([
    "2023-11-24", // Black Friday
    "2023-11-27", // Cyber Monday
    "2023-12-15", // Holiday rush
    "2024-11-29", // Black Friday
    "2024-12-02", // Cyber Monday
    "2024-12-13", // Holiday rush
]);

// Zero-sales days (store closures - showcases F7)
const closedDays = new Set([
    "2023-01-01", "2023-12-25",
    "2024-01-01", "2024-12-25",
]);

for (let year = 2023; year <= 2024; year++) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInYear = isLeap ? 366 : 365;
    
    // YoY growth: 2024 is ~15% higher than 2023
    const yearMultiplier = year === 2024 ? 1.15 : 1.0;
    
    for (let d = 0; d < daysInYear; d++) {
        const date = new Date(year, 0, 1 + d);
        const month = date.getMonth();
        const dow = date.getDay(); // 0=Sun
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        
        // Closed days = zero sales (F7: distinguishes zero from no-data)
        if (closedDays.has(dateStr)) {
            const anno = annotations[dateStr] || "";
            rows.push(`${dateStr},0,0,0,0,${anno}`);
            continue;
        }
        
        // Base sales with seasonality
        let baseSales = 5000 * yearMultiplier;
        
        // Monthly seasonality
        const monthFactors = [0.7, 0.65, 0.8, 0.85, 0.9, 0.95, 0.85, 0.9, 1.0, 1.05, 1.3, 1.5];
        baseSales *= monthFactors[month];
        
        // Day of week pattern: weekdays stronger, weekends dip
        if (dow === 0) baseSales *= 0.5;
        else if (dow === 6) baseSales *= 0.65;
        else if (dow === 1) baseSales *= 0.9;
        else if (dow === 5) baseSales *= 0.85;
        
        // Gradual growth within year
        baseSales *= (1 + d / daysInYear * 0.15);
        
        // Random variation
        baseSales *= (0.75 + rand() * 0.5);
        
        // Spike days (anomalies for F11)
        if (spikeDays.has(dateStr)) {
            baseSales *= (3.5 + rand() * 2.0);
        }
        
        // Valentine's / Mother's Day / Father's Day bumps
        if (dateStr.endsWith("-02-13") || dateStr.endsWith("-02-14")) baseSales *= 1.8;
        if (dateStr.endsWith("-05-13") || dateStr.endsWith("-05-14") || dateStr.endsWith("-05-12")) baseSales *= 1.6;
        
        // Holiday dip (Thanksgiving day itself, Christmas Eve)
        if (annotations[dateStr] === "Thanksgiving") baseSales *= 0.3;
        if (annotations[dateStr] === "Christmas Eve") baseSales *= 0.4;
        
        const sales = Math.round(baseSales);
        
        // Orders correlate with sales
        const avgOrderBase = 130 + rand() * 40 + (month >= 10 ? 20 : 0);
        const orders = Math.max(1, Math.round(sales / avgOrderBase));
        const avgOrderValue = orders > 0 ? Math.round(sales / orders) : 0;
        
        // Returns: ~3-8% of orders, higher during holidays
        const returnRate = month >= 11 ? 0.06 + rand() * 0.04 : 0.02 + rand() * 0.04;
        const returns = Math.round(orders * returnRate);
        
        const anno = annotations[dateStr] || "";
        rows.push(`${dateStr},${sales},${orders},${avgOrderValue},${returns},${anno}`);
    }
}

fs.writeFileSync("sample-data.csv", rows.join("\n") + "\n");
console.log(`Generated ${rows.length - 1} rows`);
