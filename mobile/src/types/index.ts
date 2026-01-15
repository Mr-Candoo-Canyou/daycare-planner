export interface User {
  id: string;
  email: string;
  role: 'parent' | 'daycare_admin' | 'funder' | 'system_admin';
  first_name: string;
  last_name: string;
  phone?: string;
  is_active: boolean;
  email_verified: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Daycare {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  phone: string;
  email: string;
  capacity: number;
  current_enrollment: number;
  age_range_min?: number;
  age_range_max?: number;
  languages: string[];
  has_subsidy_program: boolean;
  description: string;
  is_active: boolean;
}

export interface Child {
  id: string;
  parent_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  special_needs?: string;
}

export interface Application {
  id: string;
  child_id: string;
  parent_id: string;
  application_date: string;
  desired_start_date: string;
  opt_in_parent_network: boolean;
  child_first_name: string;
  child_last_name: string;
  child_date_of_birth: string;
  choices: ApplicationChoice[];
}

export interface ApplicationChoice {
  id: string;
  application_id: string;
  daycare_id: string;
  preference_rank: number;
  status: 'pending' | 'waitlisted' | 'accepted' | 'rejected';
  status_updated_at?: string;
  daycare_name: string;
}

export interface Statistics {
  users: {
    total: number;
    parents: number;
    daycare_admins: number;
    funders: number;
    active: number;
  };
  daycares: {
    total: number;
    total_capacity: number;
    total_enrollment: number;
    active: number;
  };
  applications: {
    total: number;
    pending: number;
    waitlisted: number;
    accepted: number;
  };
  placements: {
    total: number;
    subsidized: number;
    subsidy_total: string;
  };
  auditLogsLastWeek: number;
}
