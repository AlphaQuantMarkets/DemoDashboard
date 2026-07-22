const SUPABASE_URL = "https://zexculbaijqtwopzyvgj.supabase.co";
const SUPABASE_KEY = "sb_publishable_vgH3977Kn7bNSGIMNsEbUg_MGbfH2zn";

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

async function testConnection() {
    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*");

    console.log("Data:", data);
    console.log("Error:", error);
}

testConnection();