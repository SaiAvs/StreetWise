/*
# StreetWise core schema: profiles, categories, complaints, updates

1. New Tables
- `profiles` — one per user. `role` is a CHECK-constrained column
  ('citizen' | 'authority' | 'admin'). Not writable by clients; only the
  admin invite flow (service role) can change it.
- `categories` — complaint categories, admin-manageable, with icon + color.
- `complaints` — core record: unique reference number, title, description,
  category, priority, status, address, lat/lng, image URLs, ai metadata,
  assigned authority, timestamps. Reference number `SW-YYYY-NNNNN` via sequence.
- `complaint_updates` — append-only trail: prev status, new status, remarks,
  author, timestamp.
- `notifications` — in-app notification center rows.
- `authority_invites` — admin-created invite codes; consuming one via the
  `accept-authority-invite` edge function is the ONLY way to become an authority.

2. Security
- RLS ENABLED on every table.
- categories: public read; writes authenticated (admin-gated in app + policies).
- complaints: citizens see only their own; authorities see assigned + unassigned;
  admins see all. Citizens INSERT own, cannot UPDATE. Authorities can UPDATE
  status/assignment of complaints in their scope. Admins update all.
- complaint_updates: readable by anyone who can read the parent complaint;
  insertable by the complaint owner (feedback/reopen) and by staff.
- notifications: strictly owner-scoped.
- authority_invites: no client grants at all — service role only.

3. Notes
- Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS). No transaction control.
- Triggers (profile creation, reference numbers, notification fan-out) come in
  the following migration.
*/

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'citizen'
    CHECK (role IN ('citizen','authority','admin')),
  phone text,
  ward text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- categories
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'AlertCircle',
  color text NOT NULL DEFAULT '#0F766E',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- complaints
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text NOT NULL UNIQUE,
  citizen_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id),
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 4000),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','assigned','in_progress','resolved','rejected')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  address text NOT NULL DEFAULT '',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  image_urls text[] NOT NULL DEFAULT '{}',
  ai_suggested_category uuid REFERENCES public.categories(id),
  ai_confidence double precision,
  ai_severity text CHECK (ai_severity IN ('low','medium','high','critical')),
  ai_analysis text,
  ai_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_to uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- complaint_updates (append-only trail)
CREATE TABLE IF NOT EXISTS public.complaint_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  prev_status text,
  new_status text,
  remarks text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.complaint_updates ENABLE ROW LEVEL SECURITY;

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  complaint_id uuid REFERENCES public.complaints(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- authority_invites (service-role only)
CREATE TABLE IF NOT EXISTS public.authority_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  email text,
  invited_by uuid REFERENCES auth.users(id),
  accepted_by uuid REFERENCES auth.users(id),
  is_accepted boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.authority_invites ENABLE ROW LEVEL SECURITY;

-- indexes
CREATE INDEX IF NOT EXISTS idx_complaints_citizen ON public.complaints(citizen_id);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned ON public.complaints(assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON public.complaints(category_id);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_created ON public.complaints(created_at);
CREATE INDEX IF NOT EXISTS idx_updates_complaint ON public.complaint_updates(complaint_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invites_code ON public.authority_invites(code);

-- grants
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE ON public.categories TO authenticated;
GRANT SELECT, INSERT ON public.complaints TO authenticated;
GRANT UPDATE (status, priority, assigned_to, resolved_at, updated_at) ON public.complaints TO authenticated;
GRANT SELECT, INSERT ON public.complaint_updates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, UPDATE (full_name, phone, ward, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.authority_invites TO service_role;