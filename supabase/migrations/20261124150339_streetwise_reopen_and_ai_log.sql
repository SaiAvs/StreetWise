/*
# Complaint reopen flow + AI analysis log

1. New columns
- `complaints.reopen_count` (int, default 0) — number of controlled reopens.
- `complaints.reopen_open` (boolean, default false) — true when the citizen has
  requested a reopen of a resolved complaint and staff have not responded yet.
- `ai_analysis_log` — stores each image-analysis prediction (predicted category,
  confidence, severity, model version, whether the citizen accepted it) so
  predictions can be evaluated later. No client INSERT policy: rows are written
  by the `ai-image-analysis` edge function with the service role key.

2. New functions
- `request_reopen(complaint_id uuid, reason text)`: SECURITY DEFINER, callable by
  the complaint's citizen only, only when status is 'resolved' and
  reopen_count < 2 and no reopen is pending. Creates a complaint_updates row
  and notifies assigned staff. The actual status flip back to 'in_progress' is
  done by staff, keeping the workflow human-controlled.

3. Security
- RLS enabled on ai_analysis_log; no policies (deny-all for client roles);
  service_role granted explicitly.
- request_reopen: EXECUTE to authenticated only; input validated; raises on
  violation.

4. Notes
- Idempotent throughout; no destructive changes.
*/

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reopen_open boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ai_analysis_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
  predicted_category text NOT NULL DEFAULT 'other',
  confidence double precision,
  severity text,
  description text,
  model_version text NOT NULL DEFAULT 'baseline-heuristic-v1',
  accepted_by_user boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_analysis_log ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ai_analysis_log TO service_role;

CREATE OR REPLACE FUNCTION public.request_reopen(p_complaint_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.complaints;
BEGIN
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Please provide a reason of at least 10 characters';
  END IF;

  SELECT * INTO c FROM public.complaints WHERE id = p_complaint_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complaint not found';
  END IF;
  IF c.citizen_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only reopen your own complaints';
  END IF;
  IF c.status <> 'resolved' THEN
    RAISE EXCEPTION 'Only resolved complaints can be reopened';
  END IF;
  IF c.reopen_open THEN
    RAISE EXCEPTION 'A reopen request is already pending';
  END IF;
  IF c.reopen_count >= 2 THEN
    RAISE EXCEPTION 'This complaint has reached the reopen limit';
  END IF;

  UPDATE public.complaints
  SET reopen_open = true
  WHERE id = p_complaint_id;

  INSERT INTO public.complaint_updates (complaint_id, created_by, prev_status, new_status, remarks)
  VALUES (p_complaint_id, auth.uid(), 'resolved', 'resolved',
          'Reopen requested by citizen: ' || btrim(p_reason));

  INSERT INTO public.notifications (user_id, complaint_id, title, body)
  VALUES (
    COALESCE(c.assigned_to, c.citizen_id),
    p_complaint_id,
    'Reopen requested for ' || c.reference_number,
    'The citizen requested a reopen: "' || btrim(p_reason) || '"'
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.request_reopen(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_reopen(uuid, text) TO authenticated;