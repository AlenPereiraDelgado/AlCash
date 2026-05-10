# AlCash · Guía de Seguridad

Este documento recoge la postura de seguridad de la app y los pasos manuales que deben aplicarse en el panel de Supabase / Google Cloud para complementar los cambios de código.

## 1. Whitelist de emails permitidos

**Implementado en código** — migración `20260509000000_security_hardening.sql`:

- Tabla `public.allowed_emails` (RLS deny-all desde el cliente).
- Trigger `on_auth_user_email_check` que rechaza cualquier `INSERT` en `auth.users` con un email que no esté en la tabla.
- Email inicial cargado: `alenpdelgado@gmail.com`.

### Aplicar la migración

```bash
# Desde finance-app/
supabase db push
```

### Añadir más emails (cuando haga falta)

En el SQL editor de Supabase Dashboard:

```sql
insert into public.allowed_emails (email, note)
values ('otra@persona.com', 'colaborador')
on conflict (email) do nothing;
```

## 2. Google OAuth restringido

El whitelist anterior funciona para email/password. Para activar Google OAuth y restringirlo al mismo email:

1. **Supabase Dashboard → Authentication → Providers → Google**
   - `Enabled: ON`
   - Pegar Client ID y Client Secret de Google Cloud Console
2. **Google Cloud Console → APIs & Services → OAuth consent screen**
   - User Type: **External** (o Internal si tienes Workspace).
   - **Test users**: añadir `alenpdelgado@gmail.com`.
   - Mantener la app en estado **Testing** → solo los test users pueden autenticar.
3. El trigger `enforce_email_whitelist` ya rechaza cualquier email distinto incluso si la pantalla de Google deja entrar a otro usuario por error.

## 3. Row Level Security (RLS)

**Implementado** en la migración (idempotente, deny-by-default):

- `profiles`, `transactions`, `goals`, `debts` tienen RLS activado.
- Cada policy filtra por `auth.uid() = user_id` (o `id` en profiles).
- `allowed_emails` rechaza todo acceso desde el cliente.

Verificación en Dashboard → Database → Tables → cada tabla → "RLS enabled" en verde.

## 4. CORS

Supabase REST/Auth/Realtime acepta cualquier origen por defecto cuando se usa la `anon key` (porque la `anon key` es pública). La defensa real es **RLS + JWT**, no CORS.

Sin embargo, sí se puede restringir CORS de la edge function `gemini-proxy`:

```bash
# Lista blanca de orígenes (separados por coma)
supabase secrets set ALLOWED_ORIGINS=https://alcash.tu-dominio.app,http://localhost:5173
```

La función rechaza orígenes no listados con `Access-Control-Allow-Origin: null`.

Para Auth (URLs de redirect tras login):

- **Dashboard → Authentication → URL Configuration**
- `Site URL`: `https://alcash.tu-dominio.app`
- `Redirect URLs`: `https://alcash.tu-dominio.app/**, http://localhost:5173/**`

## 5. Rate limiting

### Auth (signin / signup / password reset)

- **Dashboard → Authentication → Rate Limits**
- Recomendado para uso personal:
  - Sign in: 30 / hora
  - Sign up: 5 / hora
  - Password reset: 5 / hora
  - Token refresh: 1800 / hora

### Edge function `gemini-proxy`

- Rate limit in-memory por `user_id`: **60 requests / 60s**.
- Configurable en `supabase/functions/gemini-proxy/index.ts` (constantes `RATE_WINDOW_MS` y `RATE_MAX`).

### REST API (PostgREST)

Supabase no expone configuración de rate limit por usuario para REST. La defensa real es:

1. RLS: incluso con muchas requests, sólo ven sus datos.
2. Constraints `CHECK` (longitud máxima de texto) — payloads basura rechazados.

## 6. Variables de entorno (credenciales)

### Cliente (frontend, `.env`)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

La `anon key` está diseñada para ser pública; queda bundleada y se ve en DevTools. La seguridad es RLS.

**Eliminar del .env del cliente:**

```
# VITE_GEMINI_API_KEY=...   ← BORRAR tras desplegar la edge function
```

### Servidor (Supabase Secrets)

```bash
supabase secrets set GEMINI_API_KEY=AIzaSy...
supabase secrets set ALLOWED_ORIGINS=https://...,http://localhost:5173
```

### Rotar la Gemini key

Si la key actual ha estado expuesta en el bundle del frontend, **rotarla**:

1. Google Cloud Console → APIs & Services → Credentials → revocar la antigua.
2. Crear una nueva, restringida a la API "Generative Language API" y al referer `tu-dominio.app/*` (defensa adicional).
3. `supabase secrets set GEMINI_API_KEY=<nueva>`.

## 7. Sanitización de inputs

**Implementado** — `src/utils/sanitize.js`:

- Strip de caracteres de control y zero-width.
- Trim + normalización NFC.
- Límites de longitud (notas 500, nombres 80, emails 254).
- Validación numérica y de formato fecha YYYY-MM-DD.

Aplicado en todos los `addTransaction`, `updateTransaction`, `addGoal`, `updateGoal`, `addDebt`, `updateDebt`, `addCustomCategory`, `addSubCategory`.

Defensa adicional en SQL: `CHECK` constraints en `transactions.note`, `goals.name`, `debts.person/note`.

**SQL injection**: PostgREST usa consultas parametrizadas — no es posible inyectar SQL desde el cliente.

## 8. Despliegue de la edge function Gemini

```bash
cd finance-app

# 1. Login (sólo la primera vez)
supabase login

# 2. Link del proyecto
supabase link --project-ref zsmstebjtervywbtfzbj

# 3. Configurar secretos
supabase secrets set GEMINI_API_KEY=AIzaSy... \
                    ALLOWED_ORIGINS=http://localhost:5173,https://alcash.tu-dominio.app

# 4. Desplegar
supabase functions deploy gemini-proxy
```

Después borrar `VITE_GEMINI_API_KEY` del `.env` y rebuild.

## 9. Checklist final

- [x] RLS activa en todas las tablas
- [x] Whitelist de emails operativa (trigger SQL)
- [x] Sanitización de inputs en cliente
- [x] CHECK constraints en SQL
- [x] Edge function proxy para Gemini (código)
- [ ] Migración aplicada en producción (`supabase db push`)
- [ ] Edge function desplegada (`supabase functions deploy gemini-proxy`)
- [ ] `VITE_GEMINI_API_KEY` borrada del `.env`
- [ ] Gemini API key antigua rotada en Google Cloud
- [ ] Google OAuth provider habilitado y restringido a test users
- [ ] Rate limits configurados en Auth Dashboard
- [ ] Site URL + Redirect URLs configurados en Auth Dashboard
