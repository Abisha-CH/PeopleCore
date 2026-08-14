import { Suspense, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

import { useMediaQuery } from "@/hooks/use-media-query";
import { PageLoader } from "@/components/feedback/page-loader";
import { SkipLink } from "./skip-link";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

/*
 * AppShell — sidebar + header + routed content.
 *
 * Route transitions: the content area is keyed by pathname and fades/slides
 * in on each navigation. With MotionConfig reducedMotion="user", transform
 * animations are disabled for users who prefer reduced motion.
 */

function AnimatedOutlet() {
  const { pathname } = useLocation();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="h-full"
    >
      <Outlet />
    </motion.div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 1023px)");

  return (
    <div className="min-h-screen bg-transparent">
      <SkipLink />
      <div className="flex min-h-screen">
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            onMenuToggle={() => setMobileOpen((o) => !o)}
            showMenuButton={isMobile}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto"
          >
            <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              {/* Route pages are code-split (React.lazy); show a skeleton in
                  the content area while a chunk loads instead of blanking the
                  whole shell. */}
              <Suspense fallback={<PageLoader />}>
                <AnimatedOutlet />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
