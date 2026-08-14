import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Check,
  Loader2,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { useSetupStatus } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FirebaseConfigError } from "@/components/auth/firebase-config-error";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type Role,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

type LoginValues = z.infer<typeof loginSchema>;
type ForgotValues = z.infer<typeof forgotSchema>;

const ROLE_ICONS: Record<Role, typeof ShieldCheck> = {
  admin: ShieldCheck,
  manager: UsersRound,
  employee: UserRound,
};

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3",
        compact ? "mb-6" : "mb-8",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-lg font-bold text-white shadow-md shadow-brand-600/30">
        P
      </div>
      <span className="text-lg font-semibold text-foreground">PeopleCore</span>
    </div>
  );
}

function RoleSelector({
  selectedRole,
  onSelect,
  bootstrapped,
  loading,
}: {
  selectedRole: Role | null;
  onSelect: (role: Role) => void;
  bootstrapped: boolean;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-foreground">
          {bootstrapped ? "How will you be signing in?" : "Welcome to PeopleCore"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {bootstrapped
            ? "Choose the role that matches your account, then sign in."
            : "Create your workspace, then add your team."}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10" role="status" aria-label="Loading">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !bootstrapped ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Set up your workspace
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You're the first here. Create the HR Admin account for your
                organisation, then invite your team.
              </p>
              <Button asChild className="mt-4 w-full">
                <Link to="/setup">Set up your workspace</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3" role="radiogroup" aria-label="Sign in role">
          {(Object.keys(ROLE_LABELS) as Role[]).map((role) => {
            const Icon = ROLE_ICONS[role];
            const active = selectedRole === role;
            return (
              <button
                key={role}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(role)}
                className={cn(
                  "group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-fast hover:-translate-y-0.5",
                  active
                    ? "border-primary bg-gradient-to-br from-brand-50/80 to-card shadow-card-hover ring-1 ring-primary/25"
                    : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-card-hover",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm transition-all duration-fast",
                    active
                      ? "bg-brand-gradient text-white shadow-md shadow-brand-600/30"
                      : "bg-brand-50 text-brand-700 group-hover:bg-brand-100 group-hover:text-brand-700",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {ROLE_LABELS[role]}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {ROLE_DESCRIPTIONS[role]}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition",
                    active
                      ? "border-primary bg-primary text-white"
                      : "border-muted-foreground/30 text-transparent",
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signOut, sendPasswordReset, configError } = useAuth();
  const { data: setup, isLoading: setupLoading } = useSetupStatus();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const bootstrapped = setup?.bootstrapped ?? false;

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const forgotForm = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
    mode: "onBlur",
  });

  const onLogin = async (values: LoginValues) => {
    setError(null);
    try {
      const actualRole = await signIn(values.email, values.password);
      if (actualRole && actualRole !== selectedRole) {
        await signOut();
        setError(
          `This account is registered as ${ROLE_LABELS[actualRole]}. Please sign in using that role.`,
        );
        return;
      }
      // Successful sign-in (role matched, or the claim couldn't be read and the
      // shell falls back to the employee view). Navigate to the dashboard; the
      // auth-state listener in AuthProvider hydrates the session as the shell
      // loads. NOTE: without this navigation the user would be stuck on the
      // login form — the listener does NOT navigate on its own.
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found" ||
        code === "auth/invalid-email"
      ) {
        setError("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  const onForgot = async (values: ForgotValues) => {
    setError(null);
    try {
      await sendPasswordReset(values.email);
      setResetSent(true);
    } catch {
      setError("Unable to send a reset link. Check the email and try again.");
    }
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      {/* Brand panel (desktop) — deep gradient field with decorative shapes */}
      <aside className="relative hidden w-[460px] shrink-0 flex-col justify-between overflow-hidden bg-brand-gradient-strong p-10 text-white lg:flex">
        {/* Atmosphere: soft glowing orbs */}
        <div
          className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-violet-500/30 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-sky-500/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-24 top-1/2 h-40 w-40 rounded-full bg-teal-400/20 blur-3xl"
          aria-hidden="true"
        />
        {/* Decorative rings */}
        <div
          className="pointer-events-none absolute -left-28 bottom-1/4 h-[420px] w-[420px] rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-16 bottom-[38%] h-[300px] w-[300px] rounded-full border border-white/10"
          aria-hidden="true"
        />
        {/* Fine dot grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:24px_24px] opacity-60"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-sm font-bold backdrop-blur">
            P
          </div>
          <span className="text-lg font-semibold">PeopleCore</span>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-semibold leading-tight">
            People operations,
            <br />
            without the paperwork.
          </h1>
          <p className="mt-4 max-w-xs text-sm text-white/80">
            Manage employees, leave, payroll, and approvals in one secure
            workspace — built for teams that move fast.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/85">
            {[
              "Role-based access for admins, managers, and staff",
              "Self-service leave requests and approvals",
              "Audit-ready activity logs",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
                  <Check className="h-3 w-3" />
                </span>
                {feature}
              </li>
            ))}
          </ul>

          {/* Floating pseudo-metric chip — pure CSS, no imagery. Hidden on
              short viewports so it never collides with the headline. */}
          <div
            className="pointer-events-none absolute -right-6 bottom-2 hidden w-52 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-md [@media(min-width:1280px)_and_(min-height:800px)]:block"
            aria-hidden="true"
          >
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-500 text-white">
                <Check className="h-3 w-3" />
              </span>
              Leave approved
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">12</p>
            <p className="mt-0.5 text-xs text-white/60">
              requests this month
            </p>
            <div className="mt-3 flex -space-x-2">
              {["bg-violet-400", "bg-sky-400", "bg-teal-400"].map((c) => (
                <span
                  key={c}
                  className={`h-6 w-6 rounded-full border-2 border-white/20 ${c}`}
                />
              ))}
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white/20 bg-white/20 text-[9px] font-semibold">
                +8
              </span>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-white/60">
          © {new Date().getFullYear()} PeopleCore
        </p>
      </aside>

      {/* Form panel — elevated card over the atmospheric canvas */}
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] rounded-2xl border border-border/80 bg-card p-8 shadow-xl shadow-brand-900/5">
          <div className="lg:hidden -mt-2">
            <BrandMark compact />
          </div>

          {configError && <FirebaseConfigError />}

          {!selectedRole ? (
            <RoleSelector
              selectedRole={selectedRole}
              onSelect={setSelectedRole}
              bootstrapped={bootstrapped}
              loading={setupLoading}
            />
          ) : mode === "login" ? (
            <>
              <div className="mb-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(null);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Change role
                </button>
                <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {ROLE_LABELS[selectedRole]}
                </span>
              </div>

              <Form {...loginForm}>
                <form
                  onSubmit={loginForm.handleSubmit(onLogin)}
                  className="space-y-4"
                  noValidate
                >
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="you@company.com"
                            type="email"
                            autoComplete="email"
                            autoFocus
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your password"
                            type="password"
                            autoComplete="current-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {error && (
                    <Alert variant="destructive" className="p-3 text-sm">
                      <AlertDescription className="text-sm">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loginForm.formState.isSubmitting}
                  >
                    {loginForm.formState.isSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Sign in as {ROLE_LABELS[selectedRole]}
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                      setResetSent(false);
                    }}
                    className="mx-auto block text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </form>
              </Form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setResetSent(false);
                  }}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </button>
              </div>

              <Form {...forgotForm}>
                <form
                  onSubmit={forgotForm.handleSubmit(onForgot)}
                  className="space-y-4"
                  noValidate
                >
                  <FormField
                    control={forgotForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="you@company.com"
                            type="email"
                            autoComplete="email"
                            autoFocus
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {resetSent && (
                    <Alert
                      variant="success"
                      role="status"
                      className="p-3 text-sm"
                    >
                      <AlertDescription className="text-sm">
                        If an account exists for that email, a reset link has
                        been sent.
                      </AlertDescription>
                    </Alert>
                  )}

                  {error && (
                    <Alert variant="destructive" className="p-3 text-sm">
                      <AlertDescription className="text-sm">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={forgotForm.formState.isSubmitting}
                  >
                    {forgotForm.formState.isSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Send Reset Link
                  </Button>
                </form>
              </Form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
