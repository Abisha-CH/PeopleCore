import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, buildQuery } from "@/lib/api";
import { getErrorMessage } from "@/lib/api";
import type {
  EmployeeRecord,
  EmployeesResponse,
} from "@/lib/types";
import { userKeys } from "./use-users";

/* -------------------------------------------------------------------------- */
/* Query keys                                                                 */
/* -------------------------------------------------------------------------- */

export interface EmployeeFilters {
  status?: string;
  department?: string;
}

export const employeeKeys = {
  all: ["employees"] as const,
  list: (filters?: EmployeeFilters) =>
    ["employees", "list", filters] as const,
  detail: (id: string) => ["employees", "detail", id] as const,
};

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

export function useEmployees(filters?: EmployeeFilters) {
  return useQuery({
    queryKey: employeeKeys.list(filters),
    queryFn: () =>
      api.get<EmployeesResponse>(`/employees${buildQuery(filters ?? {})}`),
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: employeeKeys.detail(id!),
    queryFn: () =>
      api.get<{ employee: EmployeeRecord }>(`/employees/${id}`),
    enabled: !!id,
  });
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export interface CreateEmployeePayload {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  department: string;
  jobTitle: string;
  employmentRole: string;
  startDate: string;
  status: string;
  nationalId: string;
  address: string;
  lineManagerId?: string;
  emergencyContact?: { name: string; phone: string; relationship: string };
  role?: "employee" | "manager";
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) =>
      api.post<{ employee: EmployeeRecord }>("/employees", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: employeeKeys.all });
      void qc.invalidateQueries({ queryKey: userKeys.all });
      toast.success("Employee created");
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export type UpdateEmployeePayload = Omit<
  CreateEmployeePayload,
  "password" | "role"
> & { employeeId: string };

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, ...data }: UpdateEmployeePayload) =>
      api.put<{ employee: EmployeeRecord }>(`/employees/${employeeId}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: employeeKeys.all });
      toast.success("Employee updated");
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) =>
      api.del<{ employee: EmployeeRecord }>(`/employees/${employeeId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: employeeKeys.all });
      void qc.invalidateQueries({ queryKey: userKeys.all });
      toast.success("Employee deactivated");
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useUpdateOwnPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, phone }: { employeeId: string; phone: string }) =>
      api.patch<{ employee: EmployeeRecord }>(`/employees/${employeeId}/phone`, {
        phone,
      }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: employeeKeys.detail(variables.employeeId),
      });
      toast.success("Phone updated");
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err));
    },
  });
}
