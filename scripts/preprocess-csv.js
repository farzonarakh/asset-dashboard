const fs = require("fs");
const path = require("path");

// Convert Excel date number to JavaScript Date
function excelDateToJSDate(excelDate) {
  const excelEpoch = new Date(1900, 0, 1);
  const jsDate = new Date(
    excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000
  );
  return jsDate;
}

// Format date for display
function formatDate(date) {
  return date.toLocaleDateString("en-CA"); // YYYY-MM-DD format
}

// Parse CSV line handling quotes properly
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Parse CSV content
function parseCSV(csvContent) {
  const lines = csvContent.split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;

    const row = {};
    headers.forEach((header, index) => {
      const value = values[index];

      // Convert numeric fields
      if (
        [
          "price_date",
          "value_eur",
          "release_date",
          "issuance_value_eur",
          "number_of_splints",
          "Round indexed_at 100",
        ].includes(header)
      ) {
        row[header] = parseFloat(value) || 0;
      } else {
        row[header] = value;
      }
    });

    data.push(row);
  }

  return data;
}

// Process asset data with pre-calculated values
function processAssetData(rawData) {
  return rawData.map((item) => ({
    ...item,
    price_date_formatted: formatDate(excelDateToJSDate(item.price_date)),
    release_date_formatted: formatDate(excelDateToJSDate(item.release_date)),
    indexed_value: item["Round indexed_at 100"],
  }));
}

// Create efficient indexes for filtering
function createIndexes(processedData) {
  const categories = new Set();
  const subcategories = new Set();
  const experts = new Set();
  const assets = new Set();

  processedData.forEach((item) => {
    categories.add(item.category_en);
    subcategories.add(item.subcategory_en);
    experts.add(item.expert);
    assets.add(item.asset_en);
  });

  return {
    categories: Array.from(categories).sort(),
    subcategories: Array.from(subcategories).sort(),
    experts: Array.from(experts).sort(),
    assets: Array.from(assets).sort(),
  };
}

// Group data by asset for efficient chart rendering
function groupDataByAsset(data) {
  const grouped = {};

  data.forEach((item) => {
    if (!grouped[item.asset_en]) {
      grouped[item.asset_en] = [];
    }
    grouped[item.asset_en].push(item);
  });

  // Sort each group by date
  Object.keys(grouped).forEach((asset) => {
    grouped[asset].sort(
      (a, b) =>
        new Date(a.price_date_formatted).getTime() -
        new Date(b.price_date_formatted).getTime()
    );
  });

  return grouped;
}

// Main preprocessing function
function preprocessCSV() {
  try {
    console.log("Starting CSV preprocessing...");

    const csvPath = path.join(process.cwd(), "public", "data", "assets.csv");
    const outputPath = path.join(
      process.cwd(),
      "public",
      "data",
      "assets.json"
    );

    // Read CSV file
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    console.log(`Read CSV file: ${csvContent.length} characters`);

    // Parse CSV
    const rawData = parseCSV(csvContent);
    console.log(`Parsed ${rawData.length} rows`);

    // Process data
    const processedData = processAssetData(rawData);
    console.log(`Processed ${processedData.length} rows`);

    // Create indexes
    const indexes = createIndexes(processedData);
    console.log(`Created indexes: ${Object.keys(indexes).join(", ")}`);

    // Group data for charts
    const groupedData = groupDataByAsset(processedData);
    console.log(`Grouped data for ${Object.keys(groupedData).length} assets`);

    // Create optimized output
    const optimizedData = {
      data: processedData,
      indexes,
      groupedData,
      metadata: {
        totalRows: processedData.length,
        totalAssets: Object.keys(groupedData).length,
        lastUpdated: new Date().toISOString(),
        version: "1.0",
      },
    };

    // Write JSON file
    fs.writeFileSync(outputPath, JSON.stringify(optimizedData, null, 2));

    const originalSize = fs.statSync(csvPath).size;
    const newSize = fs.statSync(outputPath).size;
    const compressionRatio = (
      ((originalSize - newSize) / originalSize) *
      100
    ).toFixed(1);

    console.log(`✅ Preprocessing complete!`);
    console.log(`📊 Original CSV: ${(originalSize / 1024).toFixed(1)} KB`);
    console.log(`📊 Optimized JSON: ${(newSize / 1024).toFixed(1)} KB`);
    console.log(`📊 Size reduction: ${compressionRatio}%`);
    console.log(`📁 Output: ${outputPath}`);
  } catch (error) {
    console.error("❌ Error during preprocessing:", error);
    process.exit(1);
  }
}

// Run preprocessing
preprocessCSV();
