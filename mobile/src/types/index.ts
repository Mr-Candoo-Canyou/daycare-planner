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
  has_special_needs?: boolean;
  special_needs_description?: string;
  languages_spoken_at_home?: string[];
  siblings_in_care?: string[];
  is_inuk?: boolean;
}

export interface Application {
  id: string;
  application_date: string;
  desired_start_date: string;
  notes?: string;
  opt_in_parent_network: boolean;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  choices: ApplicationChoice[];
}

export interface ApplicationChoice {
  daycareId: string;
  daycareName: string;
  preferenceRank: number;
  status: 'pending' | 'waitlisted' | 'accepted' | 'rejected';
  statusUpdatedAt?: string;
  position?: number;
  totalWaitlisted?: number;
  aheadEnrolledElsewhere?: number;
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
