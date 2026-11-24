/*
# Staff complaint update function (single guarded entry point for status/assignment)

1. New functions
- `staff_update_complaint(p_complaint_id uuid, p_status text, p_priority text,
  p_assigned_to uuid, p_remarks text)`: SECURITY DEFINER. The single way staff
  (authority/admin) change status, priority or assignment. It:
  - rejects citizens entirely;
  - limits authorities to complaints assigned to them or unassigned, and to
    self-assignment only (an authority can pick up a complaint, but cannot
    reassign it to someone else);
  - sets the `sw_remarks` local GUC so the audit trigger records the remark
    with the change atomically, then performs the UPDATE so history rows and
    notifications are created by the existing triggers;
  - when a pending citizen reopen request is accepted (status moved away from
    'resolved' to 'in_progress'), clears reopen_open and increments reopen_count.

2. Security
- EXECUTE revoked from PUBLIC and anon; granted to authenticated. Role checks
  happen inside the function using auth.uid(), never from client input.

3. Notes
- Idempotent CREATE OR REPLACE; no transaction control.
*/

CREATE OR REPLACE FUNCTION public.staff_update_complaint(
  p_complaint_id uuid,
  p_status text DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_remarks text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.complaints;
  caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  SELECT * INTO c FROM public.complaints WHERE id = p_complaint_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complaint not found';
  END IF;

  IF caller_role = 'admin' THEN
    NULL; -- admins may update anything
  ELSIF caller_role = 'authority' THEN
    IF NOT (c.assigned_to = auth.uid() OR c.assigned_to IS NULL) THEN
      RAISE EXCEPTION 'You do not have access to this complaint';
    END IF;
    -- authorities may only self-assign; they cannot reassign to others
    IF p_assigned_to IS NOT NULL AND p_assigned_to <> auth.uid() THEN
      p_assigned_to := c.assigned_to;
    END IF;
  ELSE
    RAISE EXCEPTION 'Only staff can update complaints this way';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN
    ('submitted','under_review','assigned','in_progress','resolved','rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF p_priority IS NOT NULL AND p_priority NOT IN ('low','medium','high','urgent') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;

  PERFORM set_config('sw_remarks', p_remarks, true);

  UPDATE public.complaints AS c2
  SET
    status = COALESCE(p_status, c2.status),
    priority = COALESCE(p_priority, c2.priority),
    assigned_to = COALESCE(p_assigned_to, c2.assigned_to),
    reopen_open = CASE
      WHEN c.reopen_open AND p_status IS NOT NULL AND p_status <> 'resolved'
        THEN false
      ELSE c2.reopen_open
    END,
    reopen_count = CASE
      WHEN c.reopen_open AND p_status = 'in_progress' THEN c2.reopen_count + 1
      ELSE c2.reopen_count
    END,
    updated_at = now()
  WHERE c2.id = p_complaint_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.staff_update_complaint(uuid, text, text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_update_complaint(uuid, text, text, uuid, text)
  TO authenticated;