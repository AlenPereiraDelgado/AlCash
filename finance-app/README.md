# AlCash — Finance App

Aplicación de finanzas personales construida con **React + Vite**, **Tailwind CSS**, **Supabase** (auth + base de datos) y **Google Gemini** (parsing de transacciones por lenguaje natural).

## Requisitos

- Node.js ≥ 18
- Cuenta de Supabase y API Key de Google Gemini

## Configuración

1. Clona el repo e instala dependencias:
   ```bash
   cd finance-app
   npm install
   ```

2. Crea tu archivo `.env` a partir de `.env.example` y rellena tus claves:
   ```bash
   cp .env.example .env
   ```

   Variables necesarias:
   - `VITE_SUPABASE_URL` — URL de tu proyecto Supabase
   - `VITE_SUPABASE_ANON_KEY` — Anon/publishable key de Supabase
   - `VITE_GEMINI_API_KEY` — API key de Google Gemini

## Scripts

| Comando            | Descripción                                      |
| ------------------ | ------------------------------------------------ |
| `npm run dev`      | Servidor de desarrollo (Vite)                    |
| `npm run server`   | Backend Express local (opcional, Excel-based)    |
| `npm run start`    | Arranca backend + frontend a la vez              |
| `npm run build`    | Build de producción                              |
| `npm run preview`  | Previsualiza el build                            |
| `npm run lint`     | ESLint                                           |

## Estructura

```
finance-app/
├── src/
│   ├── components/     # UI (views, modals, charts, layout)
│   ├── contexts/       # Auth y Finance contexts
│   ├── services/       # Gemini, PDF, helpers
│   ├── lib/            # Cliente de Supabase
│   └── constants/      # Temas, colores
├── public/             # Assets estáticos y PWA manifest
└── server.js           # Backend Express opcional
```

## Seguridad

- **Nunca** commitees `.env` ni la base de datos local (`finance_db.xlsx`). Ambos están en `.gitignore`.
- La `anon key` de Supabase es pública por diseño; los permisos los controla Row Level Security.
- La clave de Gemini se lee desde `import.meta.env` y solo se usa en el cliente para prototipar — en producción conviene proxyarla desde un backend.
