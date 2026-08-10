import { Toaster as Sonner } from "sonner";

// spec §3.8: bottom-right, max 3 visible, stacked upward, 12px gaps,
// error toasts don't auto-dismiss, close button always visible

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      richColors
      closeButton
      visibleToasts={3}
      toastOptions={{
        duration: 4000,
        className: "group toast group-[.toaster]:bg-white group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md",
      }}
      style={
        {
          "--normal-bg": "white",
          "--normal-border": "var(--color-border)",
          "--normal-text": "var(--color-foreground)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
