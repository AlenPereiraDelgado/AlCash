# AlCash

Monorepo de AlCash — aplicación de finanzas personales.

La aplicación vive en [`finance-app/`](finance-app/). Consulta su [README](finance-app/README.md) para instrucciones de instalación, variables de entorno y scripts.

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Auth & DB**: Supabase
- **IA**: Google Gemini (parseo de transacciones por lenguaje natural)
- **Gráficos / PDF**: jsPDF + html2canvas

## Puesta en marcha rápida

```bash
cd finance-app
cp .env.example .env   # rellena tus credenciales
npm install
npm run dev
```
