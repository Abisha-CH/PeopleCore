import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

/*
 * ConfirmDialog — accessible destructive/action confirmation with
 * focus trapped to the dialog, Escape to dismiss, and aria-describedby
 * pointing at the description.
 */

const ConfirmDialog = AlertDialogPrimitive.Root;
const ConfirmDialogTrigger = AlertDialogPrimitive.Trigger;

interface ConfirmDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
}

const ConfirmDialogContent = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Content>,
  ConfirmDialogContentProps
>(
  (
    {
      className,
      title,
      description,
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      destructive = true,
      onConfirm,
      children,
      ...props
    },
    ref,
  ) => (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 bg-card p-6 shadow-lg duration-normal data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg",
          className,
        )}
        {...props}
      >
        <AlertDialogPrimitive.Title className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </AlertDialogPrimitive.Title>
        <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
          {description}
        </AlertDialogPrimitive.Description>
        {children}
        <div className="flex justify-end gap-3 pt-5 border-t border-border mt-5">
          <AlertDialogPrimitive.Cancel asChild>
            <Button variant="secondary">{cancelLabel}</Button>
          </AlertDialogPrimitive.Cancel>
          <AlertDialogPrimitive.Action
            className={buttonVariants({
              variant: destructive ? "destructive" : "default",
            })}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogPrimitive.Action>
        </div>
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  ),
);
ConfirmDialogContent.displayName = "ConfirmDialogContent";

export { ConfirmDialog, ConfirmDialogTrigger, ConfirmDialogContent };
