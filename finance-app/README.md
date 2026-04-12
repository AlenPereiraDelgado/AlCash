# AlCash — Finance App

Aplicación de finanzas personales construida con **React 19 + Vite**, **Tailwind CSS**, **Supabase** (auth + base de datos con RLS) y **Google Gemini** (parseo de transacciones por lenguaje natural).

## Requisitos

- Node.js ≥ 18
- Cuenta de Supabase
- API Key de Google Gemini (https://aistudio.google.com/app/apikey)

## Puesta en marcha

```bash
cd finance-app
npm install
cp .env.example .env   # rellena tus credenciales
npm run dev
```

### Variables de entorno

| Variable                 | Descripción                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `VITE_SUPABASE_URL`      | URL del proyecto Supabase                                    |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima pública                                        |
| `VITE_GEMINI_API_KEY`    | API Key de Google Gemini                                     |

## Setup de Supabase (una sola vez)

1. Crea un proyecto en https://supabase.com
2. En **SQL Editor** pega y ejecuta el contenido de [`supabase/migrations/20260412000000_initial_schema.sql`](supabase/migrations/20260412000000_initial_schema.sql). Esto crea:
   - Tablas `profiles`, `transactions`, `goals`, `debts` con sus FKs a `auth.users`
   - Índices optimizados por `user_id`, `date`, `type`, `category`
   - Triggers de `updated_at` y de auto-creación de perfil al registrarse
   - **Row Level Security** habilitada con políticas `auth.uid() = user_id` en todas las tablas → un usuario solo puede leer/escribir sus propios datos
3. En **Authentication → Providers** activa:
   - **Email**: marca "Confirm email" para obligar a confirmar antes de loguearse
4. En **Authentication → URL Configuration** añade el dominio de producción a "Redirect URLs" y "Site URL"
5. (Opcional) Activa Google en Providers si quieres login social
6. Copia `Project URL` y `anon public key` desde **Settings → API** a tu `.env`

## Estructura

```
finance-app/
├── src/
│   ├── components/     # UI (views, modals, charts, layout)
│   ├── contexts/       # AuthContext, FinanceContext (CRUD contra Supabase)
│   ├── services/       # Gemini, PDF
│   ├── lib/            # Cliente Supabase
│   └── constants/      # Temas y colores
├── public/             # Assets estáticos y PWA manifest
└── supabase/
    └── migrations/     # Schema SQL versionado
```

## Scripts

| Comando            | Descripción                   |
| ------------------ | ----------------------------- |
| `npm run dev`      | Servidor de desarrollo (Vite) |
| `npm run build`    | Build de producción           |
| `npm run preview`  | Previsualiza el build         |
| `npm run lint`     | ESLint                        |

## Flujos de autenticación

- **Registro** con email + contraseña (mínimo 8 caracteres). Supabase envía un email de confirmación.
- **Login** con email + contraseña.
- **Olvidé mi contraseña**: enlace desde la pantalla de login → email con link de recuperación → vuelta a la app en modo `recovery` para fijar nueva contraseña.
- **Login social** con Google (requiere habilitar el provider en Supabase).

## Seguridad

- `.env` nunca se versiona (está en `.gitignore`).
- La `anon key` de Supabase es pública por diseño. La seguridad la garantiza **Row Level Security**: sin las policies del schema inicial, cualquiera podría leer datos ajenos con esa clave, así que **aplica la migración completa antes de abrir el registro**.
- La Gemini key vive en el bundle del cliente. Para producción con muchos usuarios, proxyala desde un backend para no gastar tu cuota libremente.
- Activa la opción **"Confirm email"** en Supabase Auth para evitar cuentas con emails no verificados.

## Despliegue

Sirve `npm run build` en cualquier host estático (Vercel, Netlify, Cloudflare Pages). Configura las mismas `VITE_*` como env vars en el panel del proveedor. Recuerda añadir la URL del dominio en Supabase → Authentication → URL Configuration.
