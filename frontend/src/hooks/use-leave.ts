import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, buildQuery, getErrorMessage } from "@/lib/api";
import { ApiError } from "@/lib/api";
import type {
  LeaveType,
  LeaveRequest,
  LeaveTypesResponse,
  LeaveRequestsResponse,
  LeaveEntitlement,
  EmployeeLeaveEntitlement,
  PublicHoliday,
  PublicHolidaysResponse,
  OverridesResponse,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Query keys                                                                 */
/* -------------------------------------------------------------------------- */

export const leaveKeys = {
  // Leave types
  types: ["leave-types"] as const,
  typesList: ["leave-types", "list"] as const,
  typeDetail: (id: string) => ["leave-types", id] as const,
  // Leave entitlements (company-wide)
  entitlements: (leaveTypeId: string) =>
    ["leave-entitlements", leaveTypeId] as const,
  // Employee-specific overrides
  overrides: ["employee-leave-entitlements"] as const,
  overridesList: (filters?: object) =>
    ["employee-leave-entitlements", "list", filters ?? {}] as const,
  // Leave requests
  requests: ["leave-requests"] as const,
  requestsList: (filters?: LeaveRequestFilters) =>
    ["leave-requests", "list", filters] as const,
  requestDetail: (id: string) => ["leave-requests", id] as const,
  // Public holidays
  holidays: ["public-holidays"] as const,
  holidaysList: (year?: number) => ["public-holidays", "list", year] as const,
};

/* -------------------------------------------------------------------------- */
/* Leave Types                                                                */
/* -------------------------------------------------------------------------- */

export function useLeaveTypes() {
  return useQuery({
    queryKey: leaveKeys.typesList,
    queryFn: () => api.get<LeaveTypesResponse>("/leave-types"),
  });
}

export function useCreateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; isCapped: boolean; defaultDaysPerYear: number }) =>
      api.post<{ leaveType: LeaveType }>("/leave-types", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.types });
      toast.success("Leave type created");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leaveTypeId,
      ...data
    }: { leaveTypeId: string; name: string; isCapped: boolean; defaultDaysPerYear: number }) =>
      api.put<{ leaveType: LeaveType }>(`/leave-types/${leaveTypeId}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.types });
      toast.success("Leave type updated");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function useDeleteLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leaveTypeId: string) =>
      api.del<{ leaveType: LeaveType }>(`/leave-types/${leaveTypeId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.types });
      void qc.invalidateQueries({ queryKey: leaveKeys.overrides });
      toast.success("Leave type deleted");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

/* -------------------------------------------------------------------------- */
/* Company-wide Entitlements (per leave type)                                 */
/* -------------------------------------------------------------------------- */

export function useLeaveEntitlement(leaveTypeId: string | null) {
  return useQuery({
    queryKey: leaveKeys.entitlements(leaveTypeId!),
    queryFn: () =>
      api.get<{ entitlement: LeaveEntitlement }>(
        `/leave-entitlements/${leaveTypeId}`,
      ),
    enabled: !!leaveTypeId,
  });
}

export function useSetLeaveEntitlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leaveTypeId,
      daysPerYear,
    }: {
      leaveTypeId: string;
      daysPerYear: number;
    }) =>
      api.put<{ entitlement: LeaveEntitlement }>(
        `/leave-entitlements/${leaveTypeId}`,
        { daysPerYear },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.types });
      toast.success("Entitlement updated");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

/* -------------------------------------------------------------------------- */
/* Per-employee Override Entitlements                                         */
/* -------------------------------------------------------------------------- */

export interface OverrideFilters {
  employeeId?: string;
  leaveTypeId?: string;
}

export function useOverrides(filters?: OverrideFilters) {
  return useQuery({
    queryKey: leaveKeys.overridesList(filters),
    queryFn: () =>
      api.get<OverridesResponse>(
        `/employee-leave-entitlements${buildQuery(filters ?? {})}`,
      ),
  });
}

export function useCreateOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      employeeId: string;
      leaveTypeId: string;
      daysPerYear: number;
    }) =>
      api.post<{ override: EmployeeLeaveEntitlement }>(
        "/employee-leave-entitlements",
        payload,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.overrides });
      toast.success("Override created");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      employeeId: string;
      leaveTypeId: string;
      daysPerYear: number;
    }) =>
      api.put<{ override: EmployeeLeaveEntitlement }>(
        "/employee-leave-entitlements",
        payload,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.overrides });
      toast.success("Override updated");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function useDeleteOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (overrideId: string) =>
      api.del<{ override: EmployeeLeaveEntitlement }>(
        `/employee-leave-entitlements/${overrideId}`,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.overrides });
      toast.success("Override removed");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

/* -------------------------------------------------------------------------- */
/* Leave Requests                                                             */
/* -------------------------------------------------------------------------- */

export interface LeaveRequestFilters {
  status?: string;
  leaveTypeId?: string;
}

export function useLeaveRequests(filters?: LeaveRequestFilters) {
  return useQuery({
    queryKey: leaveKeys.requestsList(filters),
    queryFn: () =>
      api.get<LeaveRequestsResponse>(
        `/leave-requests${buildQuery(filters ?? {})}`,
      ),
  });
}

export function useLeaveRequest(id: string | null) {
  return useQuery({
    queryKey: leaveKeys.requestDetail(id!),
    queryFn: () =>
      api.get<{ leaveRequest: LeaveRequest }>(`/leave-requests/${id}`),
    enabled: !!id,
  });
}

export function useCreateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      leaveTypeId: string;
      startDate: string;
      endDate: string;
      reason: string;
      isHalfDay?: boolean;
      halfDayPeriod?: "morning" | "afternoon";
    }) =>
      api.post<{ leaveRequest: LeaveRequest }>("/leave-requests", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.requests });
      toast.success("Leave request submitted");
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.code === "NO_ENTITLEMENT") {
        toast.error(
          "No leave entitlement is configured for this leave type. Ask your HR admin to set one up in Leave Settings, or choose another leave type.",
        );
        return;
      }
      toast.error(getErrorMessage(err));
    },
  });
}

export function useUpdateLeaveRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leaveRequestId,
      status,
      managerRejectionReason,
      rejectionReason,
    }: {
      leaveRequestId: string;
      status: string;
      managerRejectionReason?: string;
      rejectionReason?: string;
    }) =>
      api.patch<{ leaveRequest: LeaveRequest }>(
        `/leave-requests/${leaveRequestId}/status`,
        { status, managerRejectionReason, rejectionReason },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.requests });
      toast.success("Leave request updated");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function useOverrideLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leaveRequestId,
      ...patch
    }: {
      leaveRequestId: string;
      employeeId?: string;
      leaveTypeId?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
      status?: string;
    }) =>
      api.put<{ leaveRequest: LeaveRequest }>(
        `/leave-requests/${leaveRequestId}`,
        patch,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.requests });
      toast.success("Leave request overridden");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function useDeleteLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leaveRequestId: string) =>
      api.del<{ leaveRequest: LeaveRequest }>(`/leave-requests/${leaveRequestId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.requests });
      toast.success("Leave request deleted");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

/* -------------------------------------------------------------------------- */
/* Public Holidays                                                            */
/* -------------------------------------------------------------------------- */

export function usePublicHolidays(year?: number) {
  return useQuery({
    queryKey: leaveKeys.holidaysList(year),
    queryFn: () =>
      api.get<PublicHolidaysResponse>(
        `/public-holidays${year ? `?year=${year}` : ""}`,
      ),
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; date: string }) =>
      api.post<{ publicHoliday: PublicHoliday }>("/public-holidays", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.holidays });
      toast.success("Holiday created");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      publicHolidayId,
      ...data
    }: { publicHolidayId: string; name: string; date: string }) =>
      api.put<{ publicHoliday: PublicHoliday }>(
        `/public-holidays/${publicHolidayId}`,
        data,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.holidays });
      toast.success("Holiday updated");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicHolidayId: string) =>
      api.del<{ publicHoliday: PublicHoliday }>(
        `/public-holidays/${publicHolidayId}`,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.holidays });
      toast.success("Holiday deleted");
    },
    onError: (err: Error) => toast.error(getErrorMessage(err)),
  });
}
