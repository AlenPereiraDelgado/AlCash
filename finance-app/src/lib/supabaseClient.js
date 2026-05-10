import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        '[Supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
        'Crea un archivo .env en finance-app/ a partir de .env.example o ' +
        'configura las variables en el panel del host (Vercel/Netlify/GitHub Pages secrets).'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
