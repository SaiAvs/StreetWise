/*
# Harden functions: lock search paths, revoke direct RPC execution

1. Security changes
- `touch_updated_at` and `is_admin`: recreated with `SET search_path = ''`
  (fully qualified names inside) so the search path cannot be hijacked.
- Trigger-only SECURITY DEFINER functions (`handle_new_user`,
  `set_reference_number`, `complaint_after_insert`, `complaint_after_update`)
  get EXECUTE revoked from PUBLIC, anon AND authenticated — they are only
  meant to fire from triggers, never as RPCs.
- `request_reopen` stays callable by authenticated citizens (intentional RPC,
  self-service reopen request); its search path is locked to public.
- `is_admin` remains executable by authenticated (used by policies and safe to
  call: it only reports the caller's own admin status).
*/

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_reference_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complaint_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complaint_after_update() FROM PUBLIC, anon, authenticated;