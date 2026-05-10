-- =====================================================================
--  AlCash · Open signup
--  Quita whitelist de emails para permitir registro abierto.
--  RLS sigue protegiendo todos los datos (cada usuario solo ve los suyos).
-- =====================================================================

-- Quitar trigger que bloqueaba signups fuera de allowed_emails.
drop trigger if exists on_auth_user_email_check on auth.users;

-- La función y la tabla allowed_emails se conservan por si quieres
-- volver a activar la whitelist en el futuro (sin migración nueva,
-- recreando solo el trigger).
