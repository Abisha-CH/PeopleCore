import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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
import { LoginPage } from "@/components/auth/login-page";

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// The accessible name of each radio includes the description, so match by the
// label prefix to avoid ambiguity (the Admin card's description contains "employees").
async function selectRole(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("radio", { name: /HR Admin\s/ }),
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    authMocks.__setUser(null);
  });

  it("shows role selection cards first, then email/password after selecting a role", async () => {
    const user = userEvent.setup();
    renderLogin();

    // Step 1 — role selector visible (3 radios)
    expect(
      await screen.findAllByRole("radio"),
    ).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /HR Admin\s/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Line Manager\s/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Employee\s+Request/ })).toBeInTheDocument();

    // Step 2 — select a role → credentials form appears
    await selectRole(user);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign in as/i })).toBeInTheDocument();
  });

  it("shows validation errors when submitting empty fields", async () => {
    const user = userEvent.setup();
    renderLogin();
    await selectRole(user);

    await user.click(screen.getByRole("button", { name: /Sign in as/i }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });

  it("shows an inline error for invalid credentials", async () => {
    const user = userEvent.setup();

    const auth = await import("firebase/auth");
    vi.mocked(auth.signInWithEmailAndPassword).mockRejectedValueOnce({
      code: "auth/invalid-credential",
      message: "invalid credential",
    });

    renderLogin();
    await selectRole(user);

    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /Sign in as/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it("switches to the forgot-password form and back", async () => {
    const user = userEvent.setup();
    renderLogin();
    await selectRole(user);

    await user.click(screen.getByRole("button", { name: /forgot password/i }));

    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to login/i }));

    expect(screen.getByRole("button", { name: /Sign in as/i })).toBeInTheDocument();
  });
});
