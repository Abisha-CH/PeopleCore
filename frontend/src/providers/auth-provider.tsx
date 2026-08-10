import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { getFirebase } from "@/lib/firebase";
import { setTokenProvider, setUnauthorizedHandler } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { isValidRole, type Role } from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  displayName: string | null;
  email: string | null;
  initializing: boolean;
  configError: boolean;
  /** Signs in and resolves with the account's actual claim role (null if unknown). */
  signIn: (email: string, password: string) => Promise<Role | null>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const firebase = useMemo(() => getFirebase(), []);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [initializing, setInitializing] = useState(true);

  const configError = !firebase;

  /**
   * Cached role from the previous auth resolution. When it changes — a new
   * session signs in as a different role, or the user signs out — the React
   * Query cache is cleared so role-scoped data (e.g. a manager's scoped
   * employee list) never leaks into the next session.
   */
  const prevRoleRef = useRef<Role | null>(null);
  const firstResolveRef = useRef(true);

  useEffect(() => {
    if (!firebase) {
      setInitializing(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebase.auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const result = await u.getIdTokenResult();
          const r = result.claims.role;
          const nextRole: Role = isValidRole(r) ? r : "employee";
          if (!firstResolveRef.current && prevRoleRef.current !== nextRole) {
            queryClient.clear();
          }
          firstResolveRef.current = false;
          prevRoleRef.current = nextRole;
          setRole(nextRole);
        } catch {
          setRole("employee");
        }
      } else {
        if (!firstResolveRef.current && prevRoleRef.current !== null) {
          queryClient.clear();
        }
        firstResolveRef.current = false;
        prevRoleRef.current = null;
        setRole(null);
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  }, [firebase]);

  // Provide the token getter to the API client
  useEffect(() => {
    setTokenProvider(async () => {
      if (!user) return null;
      try {
        return await user.getIdToken();
      } catch {
        return null;
      }
    });
  }, [user]);

  // Session expiry (401 from the API) signs the user out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!firebase) return;
      void fbSignOut(firebase.auth).catch(() => {
        /* already signed out */
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [firebase]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<Role | null> => {
      if (!firebase) throw new Error("Firebase not configured");
      const cred = await signInWithEmailAndPassword(
        firebase.auth,
        email,
        password,
      );
      // The freshly issued token carries current claims — read the role so the
      // caller can validate its selected role against the actual account.
      try {
        const result = await cred.user.getIdTokenResult();
        const r = result.claims.role;
        return isValidRole(r) ? r : "employee";
      } catch {
        return null;
      }
    },
    [firebase],
  );

  const sendPasswordReset = useCallback(
    async (email: string) => {
      if (!firebase) throw new Error("Firebase not configured");
      await sendPasswordResetEmail(firebase.auth, email);
    },
    [firebase],
  );

  const signOut = useCallback(async () => {
    if (!firebase) return;
    await fbSignOut(firebase.auth);
    // The auth-state listener also clears the cache; doing it here keeps the
    // effect ordering explicit (listener may not have fired yet).
    queryClient.clear();
  }, [firebase]);

  const getAccessToken = useCallback(async () => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  }, [user]);

  const value: AuthContextValue = {
    user,
    role,
    displayName: user?.displayName ?? null,
    email: user?.email ?? null,
    initializing,
    configError,
    signIn,
    sendPasswordReset,
    signOut,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
