export type UserRole = 'worker' | 'sst_manager' | 'hr_observer' | 'super_admin';

export type ReportType = 'unsafe_act' | 'unsafe_condition';

export type ReportStatus = 'reported' | 'assigned' | 'in_review' | 'evidence_rejected' | 'closed';

export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';

export type PlanType = 'free' | 'basic' | 'premium';

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  monthly_limit: number;
  monthly_price: number;
  ai_enabled: boolean;
  ai_monthly_limit: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyPlan {
  company_id: string;
  plan_id: string;
  assigned_at: string;
  plan?: Plan;
}

export interface Company {
  id: string;
  name: string;
  plan_type: PlanType;
  max_users: number;
  active: boolean;
  razon_social?: string | null;
  ruc?: string | null;
  num_trabajadores?: number | null;
  direccion?: string | null;
  distrito?: string | null;
  provincia?: string | null;
  departamento?: string | null;
  actividad_economica?: string | null;
  logo_url?: string | null;
  created_at: string;
  updated_at: string;
  current_plan?: CompanyPlan | null;
}

export interface User {
  id: string;
  auth_user_id: string;
  email: string | null;
  dni: string;
  full_name: string;
  role: UserRole;
  company_id: string;
  active: boolean;
  area?: string | null;
  proyecto?: string | null;
  can_close_reports?: boolean;
  is_multi_company_manager?: boolean;
  created_at: string;
  updated_at: string;
  company?: Company;
}

export interface Category {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  company_id: string;
  reporter_id: string;
  assigned_to_id: string | null;
  type: ReportType;
  category_id: string | null;
  description: string;
  voice_note_url: string | null;
  transcription: string | null;
  proposed_closure: string | null;
  proposed_closure_date: string | null;
  status: ReportStatus;
  priority: ReportPriority;
  latitude: number | null;
  longitude: number | null;
  location_address: string | null;
  area: string | null;
  proyecto: string | null;
  rejection_reason: string | null;
  closed_at: string | null;
  ai_analysis: AIAnalysisResult | null;
  ai_confidence_score: number | null;
  manual_override: boolean;
  created_at: string;
  updated_at: string;
  reporter?: User;
  assigned_to?: User;
  category?: Category;
  photos?: ReportPhoto[];
  history?: ReportHistory[];
}

export interface ReportPhoto {
  id: string;
  report_id: string;
  photo_url: string;
  is_main: boolean;
  is_evidence: boolean;
  uploaded_by: string;
  description?: string | null;
  created_at: string;
  uploader?: User;
}

export interface ReportHistory {
  id: string;
  report_id: string;
  changed_by: string;
  previous_status: ReportStatus | null;
  new_status: ReportStatus;
  notes: string | null;
  created_at: string;
  changer?: User;
}

export interface CreateReportData {
  type: ReportType;
  category_id: string;
  description: string;
  proposed_closure: string;
  area?: string;
  proyecto?: string;
  latitude?: number;
  longitude?: number;
  location_address?: string;
  photos: File[];
  voice_note?: File;
}

export interface UpdateReportData {
  assigned_to_id?: string;
  priority?: ReportPriority;
  status?: ReportStatus;
  rejection_reason?: string;
}

export interface AIAnalysisResult {
  type: ReportType;
  suggestedCategory: string;
  description: string;
  proposedSolution: string;
  priority: ReportPriority;
  confidence: number;
  detectedElements: string[];
  cached?: boolean;
}

export interface CompanyAISettings {
  id: string;
  company_id: string;
  ai_enabled: boolean;
  monthly_analysis_limit: number;
  created_at: string;
  updated_at: string;
}

export interface AIUsageTracking {
  id: string;
  company_id: string;
  month: string;
  analysis_count: number;
  total_cost: number;
  created_at: string;
}

export type RequestType = 'ai_analysis' | 'user_limit' | 'storage';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export type NotificationType =
  | 'ai_limit_50'
  | 'ai_limit_80'
  | 'ai_limit_100'
  | 'ai_limit_renewed'
  | 'limit_request_approved'
  | 'limit_request_rejected'
  | 'plan_upgraded'
  | 'plan_limit_reached';

export type AIUsageStatus = 'disabled' | 'exceeded' | 'warning' | 'caution' | 'ok';

export interface PlanFeature {
  id: string;
  plan_type: PlanType;
  feature_name: string;
  feature_value: any;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsageLimitRequest {
  id: string;
  company_id: string;
  requested_by: string;
  request_type: RequestType;
  current_limit: number;
  requested_limit: number;
  reason: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  requester?: User;
  reviewer?: User;
  company?: Company;
}

export interface Notification {
  id: string;
  user_id: string;
  company_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: any | null;
  read: boolean;
  created_at: string;
}

export interface AIUsageDetails {
  enabled: boolean;
  current_usage: number;
  limit: number;
  remaining: number;
  percentage: number;
  days_left_in_month: number;
  estimated_daily_usage: number;
  will_exceed_at_current_rate: boolean;
  status: AIUsageStatus;
}

export interface Guide {
  id: string;
  parent_id: string | null;
  title: string;
  role: string;
  icon: string;
  description: string | null;
  order_index: number;
  created_at: string;
}
