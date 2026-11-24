export type Role = 'citizen' | 'authority' | 'admin';

export type ComplaintStatus =
  | 'submitted'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone: string | null;
  ward: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  is_active: boolean;
}

export interface Complaint {
  id: string;
  reference_number: string;
  citizen_id: string;
  category_id: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  priority: Priority;
  address: string;
  latitude: number;
  longitude: number;
  image_urls: string[];
  ai_suggested_category: string | null;
  ai_confidence: number | null;
  ai_severity: 'low' | 'medium' | 'high' | 'critical' | null;
  ai_analysis: string | null;
  ai_metadata: Record<string, unknown>;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  reopen_count: number;
  reopen_open: boolean;
  // joined
  profiles?: { full_name: string; email: string } | null;
  categories?: { name: string; slug: string; color: string; icon: string } | null;
}

export interface ComplaintUpdate {
  id: string;
  complaint_id: string;
  created_by: string | null;
  prev_status: string | null;
  new_status: string | null;
  remarks: string;
  created_at: string;
  profiles?: { full_name: string } | null;
}

export interface Notification {
  id: string;
  user_id: string;
  complaint_id: string | null;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface AuthorityInvite {
  id: string;
  code: string;
  email: string | null;
  is_accepted: boolean;
  expires_at: string;
  created_at: string;
}

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

export const STATUS_STYLES: Record<ComplaintStatus, string> = {
  submitted: 'bg-slate-100 text-slate-700',
  under_review: 'bg-amber-100 text-amber-800',
  assigned: 'bg-sky-100 text-sky-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-sky-100 text-sky-700',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-700',
};

export const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low'];

export const STATUS_FLOW: Record<ComplaintStatus, ComplaintStatus[]> = {
  submitted: ['under_review', 'rejected'],
  under_review: ['assigned', 'rejected'],
  assigned: ['in_progress', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved: ['in_progress'],
  rejected: [],
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso);
}
