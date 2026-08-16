import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { useSetupStatus, useSetupWorkspace } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const setupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name."),
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type SetupValues = z.infer<typeof setupSchema>;

export function SetupPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { data: setup, isLoading: setupLoading } = useSetupStatus();
  const setupWorkspace = useSetupWorkspace();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onBlur",
  });

  const onSubmit = async (values: SetupValues) => {
    setSubmitError(null);
    try {
      await setupWorkspace.mutateAsync({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });
      await signIn(values.email, values.password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-exists") {
        setSubmitError("That email is already in use. Try a different one.");
      } else {
        setSubmitError(
          (err as { message?: string }).message ??
            "Unable to set up the workspace. Please try again.",
        );
      }
    }
  };

  // Already bootstrapped → nothing to set up.
  if (!setupLoading && setup?.bootstrapped) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-lg font-bold text-white shadow-md shadow-brand-600/30">
            P
          </div>
          <span className="text-lg font-semibold text-foreground">
            PeopleCore
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-7 shadow-card">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-md shadow-teal-600/30">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-semibold text-foreground">
              Set up your workspace
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create the HR Admin account. You'll be able to invite your team
              and manage the workspace right away.
            </p>
          </div>

          {setupLoading ? (
            <div
              className="flex justify-center py-8"
              role="status"
              aria-label="Loading"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your full name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Sarah Okafor"
                          autoComplete="name"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="you@company.com"
                          type="email"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="At least 6 characters"
                          type="password"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Re-enter your password"
                          type="password"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {submitError && (
                  <p
                    className="rounded-md border border-destructive-200 bg-destructive-50 px-3 py-2 text-sm text-destructive-800"
                    role="alert"
                  >
                    {submitError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={form.formState.isSubmitting || setupWorkspace.isPending}
                >
                  {(form.formState.isSubmitting || setupWorkspace.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Create workspace
                </Button>
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
