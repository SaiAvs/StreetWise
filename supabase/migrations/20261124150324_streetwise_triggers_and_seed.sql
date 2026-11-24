/*
# Triggers: profiles on signup, reference numbers, history, notifications + seed categories

1. Triggers
- `handle_new_user`: on every new auth.users row, create a matching profiles row
  (role always starts as 'citizen'; NEVER trusts client metadata for role).
- `set_reference_number`: before insert on complaints, generate a unique
  human-readable reference `SW-YYYY-NNNNN` from a dedicated sequence.
- `complaint_after_insert`: when a complaint is created, write the opening
  complaint_updates row (status submitted).
- `complaint_after_status_change`: when status or assignment changes, append a
  complaint_updates row (prev status, new status, remarks if provided via the
  session-local `sw_remarks` GUC) and notify the citizen; when a new authority
  is assigned, notify them too. When a complaint is resolved, stamp resolved_at.

2. Seed data
- The 11 complaint categories from the product spec, with stable slugs.

3. Security
- All functions SECURITY DEFINER but locked: fixed search_path, EXECUTE revoked
  from PUBLIC/anon. Triggers run as the table owner so notifications/history are
  written even though the acting citizen cannot insert rows for other users.
- `sw_remarks` is a local GUC (set via set_config(..., true) within the
  transaction) so remarks travel with the UPDATE without being a writable
  complaint column for citizens.

4. Notes
- Idempotent: IF NOT EXISTS / DROP IF EXISTS throughout.
*/

-- sequence for reference numbers
CREATE SEQUENCE IF NOT EXISTS complaint_ref_seq START 1;

-- profile creation on signup (role is ALWAYS citizen at creation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- reference numbers
CREATE OR REPLACE FUNCTION public.set_reference_number()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number := 'SW-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('complaint_ref_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_complaint_ref ON public.complaints;
CREATE TRIGGER trg_complaint_ref
BEFORE INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.set_reference_number();

-- opening trail row on complaint creation
CREATE OR REPLACE FUNCTION public.complaint_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.complaint_updates (complaint_id, created_by, prev_status, new_status, remarks)
  VALUES (NEW.id, NEW.citizen_id, NULL, 'submitted', 'Complaint submitted.');

  -- notify the citizen their complaint was received
  INSERT INTO public.notifications (user_id, complaint_id, title, body)
  VALUES (
    NEW.citizen_id,
    NEW.id,
    'Complaint ' || NEW.reference_number || ' received',
    'Your report "' || NEW.title || '" has been submitted and is awaiting review.'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_complaint_created ON public.complaints;
CREATE TRIGGER trg_complaint_created
AFTER INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.complaint_after_insert();

-- history + notifications on status/assignment changes
CREATE OR REPLACE FUNCTION public.complaint_after_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  remarks text := NULLIF(current_setting('sw_remarks', true), '');
  actor uuid := auth.uid();
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'resolved' THEN
      NEW.resolved_at := now();
    END IF;

    INSERT INTO public.complaint_updates
      (complaint_id, created_by, prev_status, new_status, remarks)
    VALUES
      (NEW.id, COALESCE(actor, NEW.citizen_id), OLD.status, NEW.status,
       COALESCE(remarks, 'Status changed from ' || OLD.status || ' to ' || NEW.status || '.'));

    INSERT INTO public.notifications (user_id, complaint_id, title, body)
    VALUES (
      NEW.citizen_id,
      NEW.id,
      'Complaint ' || NEW.reference_number || ' is now ' || replace(NEW.status, '_', ' '),
      CASE
        WHEN NEW.status = 'resolved' THEN 'Your report "' || NEW.title || '" has been marked resolved.'
        WHEN NEW.status = 'rejected' THEN 'Your report "' || NEW.title || '" was rejected. Check the complaint history for details.'
        ELSE 'The status of "' || NEW.title || '" changed from ' || replace(OLD.status, '_', ' ') || ' to ' || replace(NEW.status, '_', ' ') || '.'
      END
    );
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.complaint_updates
      (complaint_id, created_by, prev_status, new_status, remarks)
    VALUES
      (NEW.id, COALESCE(actor, NEW.citizen_id),
       CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN NULL ELSE OLD.status END,
       CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN NULL ELSE NEW.status END,
       COALESCE(remarks, 'Complaint assigned to a responding authority.'));

    INSERT INTO public.notifications (user_id, complaint_id, title, body)
    VALUES (
      NEW.assigned_to,
      NEW.id,
      'Complaint ' || NEW.reference_number || ' assigned to you',
      'You have been assigned: "' || NEW.title || '".'
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_complaint_updated ON public.complaints;
CREATE TRIGGER trg_complaint_updated
AFTER UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.complaint_after_update();

-- seed categories
INSERT INTO public.categories (name, slug, description, icon, color) VALUES
  ('Road Damage / Potholes', 'road-damage', 'Potholes, cracks, damaged road surfaces', 'Route', '#DC2626'),
  ('Garbage / Waste Management', 'garbage', 'Overflowing bins, litter, uncollected waste', 'Trash2', '#D97706'),
  ('Water Supply', 'water-supply', 'Leaks, low pressure, contaminated or no water', 'Droplets', '#0284C7'),
  ('Drainage / Sewerage', 'drainage', 'Blocked drains, overflowing sewers', 'Waves', '#0F766E'),
  ('Streetlight Issues', 'streetlights', 'Broken, flickering or dark streetlights', 'Lightbulb', '#CA8A04'),
  ('Electricity', 'electricity', 'Exposed wires, outages, hazardous poles', 'Zap', '#B45309'),
  ('Public Safety', 'public-safety', 'Hazards endangering the public', 'ShieldAlert', '#B91C1C'),
  ('Sanitation', 'sanitation', 'Public hygiene, waste water, unclean areas', 'SprayCan', '#15803D'),
  ('Traffic / Road Obstruction', 'traffic', 'Blocked roads, broken signals, illegal parking', 'TrafficCone', '#7C2D12'),
  ('Public Infrastructure', 'infrastructure', 'Damaged benches, signage, bus stops, footpaths', 'Building2', '#334155'),
  ('Other', 'other', 'Anything that does not fit another category', 'CircleHelp', '#475569')
ON CONFLICT (slug) DO NOTHING;

-- lock trigger functions from direct client execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_reference_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complaint_after_insert() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complaint_after_update() FROM PUBLIC, anon;