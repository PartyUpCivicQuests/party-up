// Picks the live Supabase backend when configured, otherwise the demo backend.
// Both expose the same functions, so the rest of the app doesn't care which it gets.
import { CONFIG } from './config.js';

export async function getApi() {
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY) {
    const m = await import('./backend-supabase.js');
    return m.createApi(CONFIG);
  }
  const m = await import('./backend-demo.js');
  return m.createApi();
}
