# AlCash · Guía de Seguridad

Postura de seguridad de la app y pasos manuales en Supabase / Anthropic Console que complementan los cambios de código.

## 1. Registro abierto

Migración `20260512000000_open_signup.sql` quita el trigger `on_auth_user_email_check`. Cualquier email puede registrarse — RLS sigue garantizando que cada usuario solo ve sus datos.

La tabla `allowed_emails` y la función `enforce_email_whitelist` se conservan: para reactivar la whitelist basta con recrear el trigger:

```sql
create trigger on_auth_user_email_check
    before insert on auth.users
    for each row execute function public.enforce_email_whitelist();
```

Defensas activas contra abuso:

- Email confirmation obligatorio (Supabase Auth → "Confirm email" ON).
- Rate limits en Auth Dashboard (sign-up 5/h, sign-in 30/h, reset 5/h).
- Edge function `parse-expense` con cuota mensual (2 usos/mes/usuario, admin ilimitado).
- RLS deny-by-default en todas las tablas.

## 2. Google OAuth restringido

1. **Supabase Dashboard → Authentication → Providers → Google**: Enabled ON, pegar Client ID + Secret de Google Cloud Console.
2. **Google Cloud Console → APIs & Services → OAuth consent screen**: User Type **External**, añadir test users, mantener app en **Testing**.
3. El trigger `enforce_email_whitelist` rechaza emails fuera de la whitelist incluso si Google deja entrar a otro usuario.

## 3. Row Level Security (RLS)

Activa y deny-by-default en todas las tablas:

- `profiles`, `transactions`, `goals`, `debts` → policy `auth.uid() = user_id` (o `id` en profiles).
- `households`, `expense_groups` → acceso solo a miembros / shared users.
- `ai_usage` → user solo lee suyo, escribe solo service_role.
- `allowed_emails` → deny-all desde cliente.

Verifica en Dashboard → Database → Tables → cada tabla → "RLS enabled" en verde.

## 4. CORS

Supabase REST/Auth usa la `anon key` pública. La defensa real es **RLS + JWT**.

Edge function `parse-expense` sí restringe CORS:

```bash
supabase secrets set ALLOWED_ORIGINS=https://alenpereiradelgado.github.io,http://localhost:5173
```

Orígenes no listados → `Access-Control-Allow-Origin: null`.

Auth (redirects):
- **Dashboard → Authentication → URL Configuration**
- `Site URL` y `Redirect URLs` con tu dominio de producción.

## 5. Rate limiting

### Auth

- **Dashboard → Authentication → Rate Limits**
  - Sign in: 30 / hora
  - Sign up: 5 / hora
  - Password reset: 5 / hora

### Edge function `parse-expense`

- Rate limit in-memory por `user_id`: **60 req / 60s**.
- Cuota mensual: **2 usos / mes / usuario** (admin ilimitado).
- Configurable en `supabase/functions/parse-expense/index.ts` (`RATE_WINDOW_MS`, `RATE_MAX`, `MONTHLY_LIMIT`).

### REST API

Supabase no expone rate limit por usuario para REST. Defensa: RLS + CHECK constraints (longitud máxima en payloads).

## 6. Variables de entorno

### Cliente (`.env`)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Solo claves públicas. La publishable key es pública por diseño; la seguridad es RLS.

### Servidor (Supabase Secrets)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALLOWED_ORIGINS=https://...,http://localhost:5173
supabase secrets set ADMIN_EMAIL=alenpdelgado@gmail.com
```

### Rotar la Anthropic key

1. Anthropic Console → Settings → API Keys → Revoke la actual.
2. Create new key.
3. `supabase secrets set ANTHROPIC_API_KEY=<nueva>`.

## 7. Sanitización de inputs

**Implementado** — `src/utils/sanitize.js`:

- Strip caracteres de control y zero-width.
- Trim + normalización NFC.
- Límites de longitud (notas 500, nombres 80, emails 254).
- Validación numérica y formato fecha YYYY-MM-DD.

Aplicado en `addTransaction`, `updateTransaction`, `addGoal`, `updateGoal`, `addDebt`, `updateDebt`, `addCustomCategory`, `addSubCategory`.

Defensa SQL: `CHECK` constraints en `transactions.note`, `goals.name`, `debts.person/note`.

**SQL injection**: PostgREST usa consultas parametrizadas → no inyectable desde cliente.

## 8. Despliegue de la edge function `parse-expense`

```bash
cd finance-app

supabase login
supabase link --project-ref zsmstebjtervywbtfzbj
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALLOWED_ORIGINS=https://alenpereiradelgado.github.io,http://localhost:5173
supabase secrets set ADMIN_EMAIL=alenpdelgado@gmail.com
supabase functions deploy parse-expense
```

Modelo: Claude Haiku 4.5 con visión. Cuota mensual hard-coded a 2 (`MONTHLY_LIMIT`).

## 9. Checklist final

- [x] RLS activa en todas las tablas
- [x] Registro abierto (whitelist desactivada — `20260512000000_open_signup.sql`)
- [x] Sanitización de inputs en cliente
- [x] CHECK constraints en SQL
- [x] Edge function `parse-expense` desplegada
- [x] Anthropic key solo en Supabase Secrets (nunca en bundle)
- [x] CORS restringido en edge function
- [x] Site URL + Redirect URLs configurados en Auth Dashboard
- [ ] "Confirm email" activado en Auth → Providers → Email
- [ ] Rate limits configurados en Auth → Rate Limits (5 / 30 / 5)
- [ ] (Opcional) Google OAuth provider habilitado
