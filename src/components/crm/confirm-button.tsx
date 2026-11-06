"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** A delete button that asks first, then runs a server action. */
export function ConfirmDelete({
  onConfirm,
  title,
  description,
  label = "Delete",
  compact = false,
}: {
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  label?: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          compact ? (
            <Button variant="ghost" size="icon-sm" aria-label={label} title={label} />
          ) : (
            <Button variant="destructive" />
          )
        }
      >
        <Trash2 />
        {!compact && label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={() => start(() => onConfirm())}>
            {pending ? "Deleting…" : label}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
