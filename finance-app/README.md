# AlCash — Finance App

Aplicación de finanzas personales construida con **React 19 + Vite**, **Tailwind CSS** y **Supabase** (auth + base de datos con RLS). El parseo inteligente de transacciones (texto e imágenes) usa **Anthropic Claude** vía edge function.

## Requisitos

- Node.js ≥ 18
- Cuenta de Supabase
- (Opcional, solo backend) API Key de Anthropic — vive en Supabase Secrets, **no** en el bundle

## Puesta en marcha

```bash
cd finance-app
npm install
cp .env.example .env   # rellena tus credenciales
npm run dev
```

### Variables de entorno (cliente)

| Variable                 | Descripción                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `VITE_SUPABASE_URL`      | URL del proyecto Supabase                                    |
| `VITE_SUPABASE_ANON_KEY` | Clave publishable / anónima pública                          |

> La key de Anthropic **nunca** va en `.env`. Se guarda como Supabase Secret (`ANTHROPIC_API_KEY`) y solo la lee la edge function `parse-expense`.

## Setup de Supabase (una sola vez)

1. Crea un proyecto en https://supabase.com
2. En **SQL Editor** ejecuta en orden las migraciones de [`supabase/migrations/`](supabase/migrations/). Esto crea:
   - Tablas `profiles`, `transactions`, `goals`, `debts`, `households`, `expense_groups`, `ai_usage` con sus FKs a `auth.users`
   - Índices optimizados por `user_id`, `date`, `type`, `category`
   - Triggers de `updated_at` y auto-creación de perfil al registrarse
   - **Row Level Security** habilitada con políticas `auth.uid() = user_id` → un usuario solo puede leer/escribir sus propios datos
3. En **Authentication → Providers** activa **Email** y marca "Confirm email"
4. En **Authentication → URL Configuration** añade el dominio de producción a "Redirect URLs" y "Site URL"
5. (Opcional) Activa Google en Providers para login social
6. Copia `Project URL` y publishable key desde **Settings → API** a tu `.env`

### Edge function `parse-expense` (parseo IA)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALLOWED_ORIGINS=https://tu-dominio.app,http://localhost:5173
supabase secrets set ADMIN_EMAIL=tu@email.com
supabase functions deploy parse-expense
```

Cuota: 2 usos / mes / usuario (admin ilimitado). Modelo: Claude Haiku 4.5 con visión.

## Estructura

```
finance-app/
├── src/
│   ├── components/     # UI (views, modals, charts, layout)
│   ├── contexts/       # AuthContext, FinanceContext (CRUD contra Supabase)
│   ├── services/       # aiService (parse-expense), PDF
│   ├── lib/            # Cliente Supabase
│   └── constants/      # Temas y colores
├── public/             # Assets estáticos y PWA manifest
└── supabase/
    ├── migrations/     # Schema SQL versionado
    └── functions/      # Edge functions (parse-expense)
```

## Scripts

| Comando            | Descripción                   |
| ------------------ | ----------------------------- |
| `npm run dev`      | Servidor de desarrollo (Vite) |
| `npm run build`    | Build de producción           |
| `npm run preview`  | Previsualiza el build         |
| `npm run lint`     | ESLint                        |

## Flujos de autenticación

- **Registro** con email + contraseña (mínimo 8 caracteres). Supabase envía email de confirmación.
- **Login** con email + contraseña.
- **Olvidé mi contraseña**: link desde login → email recuperación → modo `recovery` para fijar nueva contraseña.
- **Login social** con Google (requiere habilitar provider en Supabase).

## Seguridad

- `.env` nunca se versiona (está en `.gitignore`).
- La publishable key de Supabase es pública por diseño. La seguridad la garantiza **Row Level Security**.
- La key de Anthropic vive solo en Supabase Secrets — el bundle del cliente nunca la ve.
- Edge function valida JWT, whitelist `allowed_emails`, rate limit y cuota mensual.
- Activa **"Confirm email"** en Supabase Auth para evitar cuentas con emails no verificados.

## Despliegue

Sirve `npm run build` en cualquier host estático (Vercel, Netlify, Cloudflare Pages, GitHub Pages). Configura las mismas `VITE_*` como env vars en el panel del proveedor. Añade la URL del dominio en Supabase → Authentication → URL Configuration y en `ALLOWED_ORIGINS` de la edge function.
