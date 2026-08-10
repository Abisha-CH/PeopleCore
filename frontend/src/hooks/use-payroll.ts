import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, buildQuery } from "@/lib/api";
import { getErrorMessage } from "@/lib/api";
import type {
  PayrollProfile,
  Payslip,
  PayslipsResponse,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Query keys                                                                 */
/* -------------------------------------------------------------------------- */

export const payrollKeys = {
  profiles: ["payroll-profiles"] as const,
  profile: (employeeId: string) => ["payroll-profiles", employeeId] as const,
  payslips: ["payslips"] as const,
  payslipsList: (filters?: object) =>
    ["payslips", "list", filters ?? {}] as const,
  payslipDetail: (id: string) => ["payslips", id] as const,
};

/* -------------------------------------------------------------------------- */
/* Payroll Profiles                                                           */
/* -------------------------------------------------------------------------- */

export function usePayrollProfile(employeeId: string | null) {
  return useQuery({
    queryKey: payrollKeys.profile(employeeId!),
    queryFn: () =>
      api.get<{ profile: PayrollProfile }>(
        `/payroll-profiles/${employeeId}`,
      ),
    enabled: !!employeeId,
  });
}

export function useCreatePayrollProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      employeeId: string;
      bankAccountNumber: string;
      bankName: string;
      baseSalary: number;
    }) =>
      api.post<{ profile: PayrollProfile }>("/payroll-profiles", payload),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: payrollKeys.profile(variables.employeeId),
      });
      toast.success("Payroll profile created");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdatePayrollProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      ...data
    }: {
      employeeId: string;
      bankAccountNumber: string;
      bankName: string;
      baseSalary: number;
    }) =>
      api.put<{ profile: PayrollProfile }>(
        `/payroll-profiles/${employeeId}`,
        data,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: payrollKeys.profile(variables.employeeId),
      });
      toast.success("Payroll profile updated");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

/* -------------------------------------------------------------------------- */
/* Payslips                                                                   */
/* -------------------------------------------------------------------------- */

export interface PayslipFilters {
  employeeId?: string;
  status?: string;
}

export function usePayslips(filters?: PayslipFilters) {
  return useQuery({
    queryKey: payrollKeys.payslipsList(filters),
    queryFn: () =>
      api.get<PayslipsResponse>(`/payslips${buildQuery(filters ?? {})}`),
  });
}

export function usePayslip(id: string | null) {
  return useQuery({
    queryKey: payrollKeys.payslipDetail(id!),
    queryFn: () => api.get<{ payslip: Payslip }>(`/payslips/${id}`),
    enabled: !!id,
  });
}

export function useGeneratePayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      employeeId: string;
      month: number;
      year: number;
    }) => api.post<{ payslip: Payslip }>("/payslips", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: payrollKeys.payslips });
      toast.success("Payslip generated");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdatePayslipDeductions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      payslipId,
      deductions,
    }: {
      payslipId: string;
      deductions: { label: string; amount: number }[];
    }) =>
      api.put<{ payslip: Payslip }>(`/payslips/${payslipId}`, { deductions }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: payrollKeys.payslips });
      toast.success("Deductions updated");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function usePublishPayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payslipId: string) =>
      api.patch<{ payslip: Payslip }>(`/payslips/${payslipId}/publish`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: payrollKeys.payslips });
      toast.success("Payslip published");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function useDeletePayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payslipId: string) =>
      api.del<{ payslip: Payslip }>(`/payslips/${payslipId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: payrollKeys.payslips });
      toast.success("Payslip deleted");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}
