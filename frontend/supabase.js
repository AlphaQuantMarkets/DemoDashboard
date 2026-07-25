/* supabase.js — Initialize Supabase client */

const SUPABASE_URL = "https://zexculbaijqtwopzyvgj.supabase.co";
const SUPABASE_KEY = "sb_publishable_vgH3977Kn7bNSGIMNsEbUg_MGbfH2zn";

// Wait for Supabase library to load
if (typeof window.supabase === 'undefined') {
  console.error('❌ Supabase library not loaded. Check HTML script tag.');
  document.body.innerHTML = '<h1>Error: Supabase library failed to load</h1>';
} else {
  try {
    window.supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );
    console.log('✅ Supabase client initialized');
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
  }
}

// Test connection
async function testConnection() {
  if (!window.supabaseClient) {
    console.error('❌ Supabase client not initialized');
    return;
  }

  try {
    console.log('🔍 Testing Supabase connection...');
    
    const { data, error } = await window.supabaseClient
      .from("stock_prices")
      .select("*")
      .limit(5);

    if (error) {
      console.error('❌ Query error:', error);
      return;
    }

    console.log('✅ Connection test passed');
    console.log(`📊 Sample data (${data?.length || 0} rows):`, data);
    
    if (!data || data.length === 0) {
      console.warn('⚠️ WARNING: Table stock_prices is empty!');
      console.warn('Run Python script to populate data first:');
      console.warn('  python backend/fetch_stock_data.py');
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

// Run test after small delay to ensure library loaded
setTimeout(testConnection, 500);    