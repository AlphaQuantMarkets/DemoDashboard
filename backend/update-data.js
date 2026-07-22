/* backend/update-data.js — Auto-update stock prices every 6 hours */

const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");
const cron = require("node-cron");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SYMBOLS = ["FPT", "HPG", "VNM"];

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Fetch today's stock data từ vnstock API
 * Format: { symbol, date, open, high, low, close, volume }
 */
async function fetchTodaysPrices() {
  const records = [];
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  for (const symbol of SYMBOLS) {
    try {
      // Using vnstock API (free, no auth needed)
      const url = `https://api.vnstock.bio/api/v1/stock/${symbol}/historical?limit=1`;
      const response = await axios.get(url, { timeout: 10000 });

      if (response.data?.data && response.data.data.length > 0) {
        const data = response.data.data[0];
        records.push({
          symbol,
          trading_date: today,
          open: parseFloat(data.o) || 0,
          high: parseFloat(data.h) || 0,
          low: parseFloat(data.l) || 0,
          close: parseFloat(data.c) || 0,
          volume: parseInt(data.v) || 0,
        });
        console.log(`✓ Fetched ${symbol} for ${today}`);
      }
    } catch (error) {
      console.error(`✗ Failed to fetch ${symbol}:`, error.message);
    }
  }

  return records;
}

/**
 * Upsert records vào Supabase
 */
async function upsertRecords(records) {
  if (records.length === 0) {
    console.log("No new records to upsert");
    return;
  }

  try {
    const { data, error } = await supabase
      .from("stock_prices")
      .upsert(records, { onConflict: "symbol,trading_date" })
      .select();

    if (error) throw error;

    console.log(`✅ Upserted ${data?.length || records.length} records`);
  } catch (error) {
    console.error("❌ Upsert failed:", error.message);
  }
}

/**
 * Main update flow
 */
async function updateData() {
  console.log(`\n📊 [${new Date().toISOString()}] Starting data update...`);
  try {
    const records = await fetchTodaysPrices();
    await upsertRecords(records);
  } catch (error) {
    console.error("❌ Update failed:", error.message);
  }
}

/**
 * Schedule: Mỗi 6 giờ (lúc 0h, 6h, 12h, 18h)
 */
cron.schedule("0 0,6,12,18 * * *", updateData, {
  timezone: "Asia/Ho_Chi_Minh",
});

console.log("🚀 Cron job started. Update scheduled every 6 hours.");
console.log("Timezone: Asia/Ho_Chi_Minh");

// Chạy lần đầu ngay khi start
updateData();