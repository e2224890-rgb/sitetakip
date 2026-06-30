import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client = null;
function client() {
  if (!_client) {
    if (!url || !key) {
      throw new Error(
        "Supabase env eksik: .env.local içine NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY ekleyin."
      );
    }
    _client = createClient(url, key);
  }
  return _client;
}

// Lazy proxy: istemci yalnızca ilk erişimde (tarayıcıda, useEffect vb.) oluşturulur.
// Böylece build/prerender sırasında env okunmaz ve derleme çökmez.
export const supabase = new Proxy(
  {},
  {
    get(_t, prop) {
      const c = client();
      const v = c[prop];
      return typeof v === "function" ? v.bind(c) : v;
    },
  }
);
