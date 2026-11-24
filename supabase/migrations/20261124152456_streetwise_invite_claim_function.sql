/*
# Atomic invite claim function for the accept-authority-invite edge function

1. New functions
- `claim_authority_invite(p_code text, p_email text)`: SECURITY DEFINER,
  service-role callable. Atomically marks an invite accepted (single use):
  - code must exist, be unaccepted and unexpired;
  - if the invite was created for a specific email, it must match;
  - returns true exactly once per invite (a concurrent second call loses the
    row-level race and sees is_accepted already true).

2. Security
- EXECUTE revoked from PUBLIC, anon and authenticated; granted to service_role
  only (the edge function uses the service role key).

3. Notes
- Race safety relies on UPDATE ... WHERE NOT is_accepted plus ROW_COUNT check.
*/

CREATE OR REPLACE FUNCTION public.claim_authority_invite(p_code text, p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite public.authority_invites;
  updated integer := 0;
BEGIN
  SELECT * INTO invite FROM public.authority_invites
  WHERE code = upper(btrim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF invite.is_accepted OR invite.expires_at < now() THEN
    RETURN false;
  END IF;
  IF invite.email IS NOT NULL AND lower(btrim(p_email)) <> lower(invite.email) THEN
    RETURN false;
  END IF;

  UPDATE public.authority_invites
  SET is_accepted = true, accepted_by = auth.uid()
  WHERE id = invite.id AND NOT is_accepted;

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_authority_invite(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_authority_invite(text, text) TO service_role;