import type {
  EmployeeDirectoryRole,
  EmployeeDirectoryStatus,
} from "./access";

export type EmployeeSkill = {
  id: string;
  skill_name: string;
  is_active: boolean;
};

export type DirectoryEmployee = {
  id: string;
  employee_name: string;
  email: string | null;
  contact_number: string | null;
  employee_role: EmployeeDirectoryRole;
  notes: string | null;
  employee_status: EmployeeDirectoryStatus;
  source_type: "manual" | "system";
  system_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  skills: EmployeeSkill[];
};

export type EmployeeListResponse = {
  employees: DirectoryEmployee[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
