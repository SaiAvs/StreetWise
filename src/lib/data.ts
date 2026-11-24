import { supabase } from './supabase';
import type { Complaint, ComplaintUpdate, Category, Notification } from './types';

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Category[];
}

const COMPLAINT_SELECT = `
  *,
  categories!complaints_category_id_fkey (name, slug, color, icon),
  profiles:assigned_to (full_name, email)
`;

export async function fetchComplaintsForCitizen(citizenId: string): Promise<Complaint[]> {
  const { data, error } = await supabase
    .from('complaints')
    .select(COMPLAINT_SELECT)
    .eq('citizen_id', citizenId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Complaint[];
}

export async function fetchComplaintsForStaff(): Promise<Complaint[]> {
  // RLS scopes this: authorities see assigned + unassigned, admins see all.
  const { data, error } = await supabase
    .from('complaints')
    .select(COMPLAINT_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Complaint[];
}

export async function fetchComplaint(id: string): Promise<Complaint | null> {
  const { data, error } = await supabase
    .from('complaints')
    .select(COMPLAINT_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Complaint) ?? null;
}

export async function fetchComplaintUpdates(complaintId: string): Promise<ComplaintUpdate[]> {
  const { data, error } = await supabase
    .from('complaint_updates')
    .select('*, profiles:created_by (full_name)')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ComplaintUpdate[];
}

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', ids);
  if (error) throw error;
}

export async function uploadEvidence(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('complaint-evidence')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function evidenceUrl(path: string): Promise<string> {
  const { data } = await supabase.storage
    .from('complaint-evidence')
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? '';
}

/**
 * Status/assignment update via the guarded database function: remarks and the
 * audit trail are recorded atomically and permissions are enforced server-side.
 */
export async function updateComplaintStatus(
  complaintId: string,
  changes: { status?: string; priority?: string; assigned_to?: string | null },
  remarks: string
): Promise<void> {
  const { error } = await supabase.rpc('staff_update_complaint', {
    p_complaint_id: complaintId,
    p_status: changes.status ?? null,
    p_priority: changes.priority ?? null,
    p_assigned_to: changes.assigned_to ?? null,
    p_remarks: remarks,
  });
  if (error) throw error;
}
