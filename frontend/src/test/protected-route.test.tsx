import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type MockUser = {
  uid: string;
  email: string;
  displayName: string | null;
  claims: Record<string, unknown>;
} | null;

const authMocks = vi.hoisted(() => {
  let currentUser: MockUser = null;
  return {
    __setUser(u: MockUser) {
      currentUser = u;
    },
    __currentUser: () => currentUser,
  };
});

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({ name: "[DEFAULT]" })),
}));

vi.mock("firebase/auth", () => {
  return {
    getAuth: vi.fn(() => ({})),
    onAuthStateChanged: vi.fn((_auth, cb) => {
      const u = authMocks.__currentUser();
      cb(
        u
          ? {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              getIdToken: async () => "test-id-token",
              getIdTokenResult: async () => ({ claims: u.claims }),
            }
          : null,
      );
      return () => {};
    }),
    signInWithEmailAndPassword: vi.fn(async () => ({ user: {} })),
    sendPasswordResetEmail: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  };
});

// Isolate the gate logic — AppShell is exercised elsewhere.
vi.mock("@/components/layout/app-shell", () => ({
  AppShell: () => <div data-testid="app-shell">shell</div>,
}));

// Mock the auth hook so the login page never calls the real API during tests.
vi.mock("@/hooks/use-auth", () => ({
  useSetupStatus: () => ({
    data: { bootstrapped: true },
    isLoading: false,
  }),
  useSetupWorkspace: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

import { AuthProvider } from "@/providers/auth-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoginPage } from "@/components/auth/login-page";

function renderProtected() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<div>dashboard-content</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    authMocks.__setUser(null);
  });

  it("redirects unauthenticated users to /login", async () => {
    renderProtected();

    // The login page renders role-selector cards — dashboard content must not appear.
    expect(await screen.findByRole("radio", { name: /HR Admin/i })).toBeInTheDocument();
    expect(screen.queryByText("dashboard-content")).not.toBeInTheDocument();
  });

  it("renders the shell for authenticated users", async () => {
    authMocks.__setUser({
      uid: "u1",
      email: "a@b.com",
      displayName: null,
      claims: { role: "admin" },
    });

    renderProtected();

    expect(await screen.findByTestId("app-shell")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /HR Admin/i })).not.toBeInTheDocument();
  });
});
