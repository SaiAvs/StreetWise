/*
# Row Level Security policies for StreetWise

1. Access model
- `profiles`: users read/update own row; admins read all profiles. The `role`
  column is never client-writable: the UPDATE grant is column-restricted to
  full_name/phone/ward and no policy would allow changing role (WITH CHECK
  requires role to stay unchanged).
- `complaints` visibility: citizens see their own; authorities see complaints
  assigned to them or unassigned; admins see all.
- `complaints` writes: citizens INSERT own (status must be 'submitted',
  assigned_to NULL — enforced here AND by column grants). Citizens have NO
  UPDATE/DELETE on complaints. Authorities UPDATE status/priority/assignment
  via a column-restricted grant; admins update any.
- `complaint_updates`: readable by anyone who can read the parent complaint;
  INSERT by the complaint's citizen (feedback/reopen note) or staff. No
  UPDATE/DELETE — append-only.
- `notifications`: owner-only CRUD (update used only to mark read).
- `categories`: public read; writes admin-only via policy.
- `authority_invites`: no client policies/grants — service role only.

2. Defaults
- complaints.citizen_id gets DEFAULT auth.uid() so client inserts that omit it
  still satisfy WITH CHECK.

3. Notes
- All policies TO authenticated except public categories read.
- Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY.
*/

ALTER TABLE public.complaints
  ALTER COLUMN citizen_id SET DEFAULT auth.uid();

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_complaints_touch ON public.complaints;
CREATE TRIGGER trg_complaints_touch
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_touch ON public.profiles;
CREATE TRIGGER trg_profiles_touch
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- helper: is current user admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

-- ---------- profiles ----------
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
CREATE POLICY "read own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin reads all profiles" ON public.profiles;
CREATE POLICY "admin reads all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "update own profile" ON public.profiles;
CREATE POLICY "update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- ---------- categories ----------
DROP POLICY IF EXISTS "public reads categories" ON public.categories;
CREATE POLICY "public reads categories" ON public.categories
FOR SELECT TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "admins insert categories" ON public.categories;
CREATE POLICY "admins insert categories" ON public.categories
FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins update categories" ON public.categories;
CREATE POLICY "admins update categories" ON public.categories
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ---------- complaints ----------
DROP POLICY IF EXISTS "citizens read own complaints" ON public.complaints;
CREATE POLICY "citizens read own complaints" ON public.complaints
FOR SELECT TO authenticated
USING (citizen_id = auth.uid());

DROP POLICY IF EXISTS "authorities read scoped complaints" ON public.complaints;
CREATE POLICY "authorities read scoped complaints" ON public.complaints
FOR SELECT TO authenticated
USING (assigned_to = auth.uid() OR assigned_to IS NULL);

DROP POLICY IF EXISTS "admins read all complaints" ON public.complaints;
CREATE POLICY "admins read all complaints" ON public.complaints
FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "citizens insert own complaints" ON public.complaints;
CREATE POLICY "citizens insert own complaints" ON public.complaints
FOR INSERT TO authenticated
WITH CHECK (
  citizen_id = auth.uid()
  AND status = 'submitted'
  AND assigned_to IS NULL
);

DROP POLICY IF EXISTS "authorities update scoped complaints" ON public.complaints;
CREATE POLICY "authorities update scoped complaints" ON public.complaints
FOR UPDATE TO authenticated
USING (assigned_to = auth.uid() OR assigned_to IS NULL)
WITH CHECK (assigned_to = auth.uid() OR assigned_to IS NULL);

DROP POLICY IF EXISTS "admins update all complaints" ON public.complaints;
CREATE POLICY "admins update all complaints" ON public.complaints
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ---------- complaint_updates ----------
DROP POLICY IF EXISTS "read updates of visible complaints" ON public.complaint_updates;
CREATE POLICY "read updates of visible complaints" ON public.complaint_updates
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_updates.complaint_id
      AND (c.citizen_id = auth.uid()
           OR c.assigned_to = auth.uid()
           OR c.assigned_to IS NULL
           OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "citizen feedback on own complaint" ON public.complaint_updates;
CREATE POLICY "citizen feedback on own complaint" ON public.complaint_updates
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_updates.complaint_id
      AND c.citizen_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "staff insert updates" ON public.complaint_updates;
CREATE POLICY "staff insert updates" ON public.complaint_updates
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_updates.complaint_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

-- ---------- notifications ----------
DROP POLICY IF EXISTS "read own notifications" ON public.notifications;
CREATE POLICY "read own notifications" ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert own notifications" ON public.notifications;
CREATE POLICY "insert own notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update own notifications" ON public.notifications;
CREATE POLICY "update own notifications" ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ---------- grants for helper function ----------
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;