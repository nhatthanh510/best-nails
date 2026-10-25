"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { KeyRound, LogOut, MoreHorizontal, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, Pill } from "@/components/admin/ui";
import { FormDialog } from "@/components/admin/form-dialog";
import { useActionToast } from "@/components/admin/action-button";
import { createAccount, deleteAccount, removeAccount, resetAccountPassword, restoreAccount, updateAccount } from "@/app/admin/account-actions";
import type { ActionState } from "@/app/admin/actions";
import { generatePassword, MIN_PASSWORD } from "@/lib/accounts";
import { cn } from "@/lib/utils";
import { useFormSubmit } from "@/lib/use-form-submit";

export type AccountRow = {
  id: string;
  name: string;
  role: "admin" | "staff";
  email: string;
  tempPassword: boolean;
  /** Dates already formatted on the server, in the shop's timezone. */
  lastSignIn: string | null;
  /** Set when the account is removed. */
  removedOn: string | null;
};

const selectClass = "h-11 w-full rounded-[10px] border border-input bg-card px-3 text-[15px]";

function report(result: ActionState) {
  if (result?.ok) toast.success(result.message ?? "Done");
  else if (result) toast.error(result.message ?? "Something went wrong.");
}

/**
 * Settings → Accounts: who can sign in, and as what. Each row keeps to its name, a role badge
 * and one ⋯ menu, so a list of accounts doesn't turn into a wall of buttons.
 */
export function AccountsCard({ accounts, meId }: { accounts: AccountRow[]; meId: string }) {
  const active = accounts.filter((a) => !a.removedOn);
  const removed = accounts.filter((a) => a.removedOn);
  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-extrabold">Accounts</h2>
          <p className="text-[13px] text-muted-foreground">Admins use the admin and the kiosk; staff use the kiosk only.</p>
        </div>
        <FormDialog
          variant="outline"
          title="Add an account"
          description="Set a temporary password and tell them what it is. They choose their own the first time they sign in."
          trigger={
            <>
              <Plus aria-hidden="true" />
              Add account
            </>
          }
        >
          {(close) => <AccountForm onDone={close} />}
        </FormDialog>
      </div>
      <ul className="flex flex-col">
        {active.map((a) => (
          <AccountItem key={a.id} account={a} isMe={a.id === meId} />
        ))}
      </ul>
      {removed.length > 0 && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-muted-foreground hover:text-foreground">
            Removed accounts ({removed.length})
          </summary>
          <ul className="flex flex-col">
            {removed.map((a) => (
              <AccountItem key={a.id} account={a} isMe={false} />
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

type Open = "edit" | "reset" | "remove" | "delete" | null;

function AccountItem({ account: a, isMe }: { account: AccountRow; isMe: boolean }) {
  const [open, setOpen] = useState<Open>(null);
  const [restoring, startRestore] = useTransition();
  const close = () => setOpen(null);

  return (
    <li className="flex items-center gap-3 border-b border-secondary py-2.5 last:border-0">
      <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", a.removedOn && "opacity-70")}>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{a.name}</span>
          {isMe && <span className="text-[13px] font-semibold text-muted-foreground">You</span>}
          {a.tempPassword && !a.removedOn && <Pill className="bg-warning-soft text-warning">Temporary password</Pill>}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">
          {a.email}
          {a.removedOn ? ` · Removed ${a.removedOn} · can't sign in` : ` · ${a.lastSignIn ? `Last signed in ${a.lastSignIn}` : "Not signed in yet"}`}
        </span>
      </div>
      <Pill className={cn("flex-none", a.role === "admin" && "bg-accent text-accent-foreground", a.removedOn && "opacity-70")}>
        {a.role === "admin" ? "Admin" : "Staff"}
      </Pill>

      {/* modal={false}: the menu closes before its dialog opens, so focus and scrolling come back properly. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${a.name}`} pending={restoring} className="size-11 flex-none text-muted-foreground">
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {a.removedOn ? (
            <>
              <DropdownMenuItem onSelect={() => startRestore(async () => report(await restoreAccount(a.id)))}>
                <RotateCcw aria-hidden="true" />
                Restore
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setOpen("delete")}>
                <Trash2 aria-hidden="true" />
                Delete for good
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => setOpen("edit")}>
                <Pencil aria-hidden="true" />
                {isMe ? "Edit name" : "Edit name and role"}
              </DropdownMenuItem>
              {isMe ? (
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <KeyRound aria-hidden="true" />
                    Change password
                  </Link>
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => setOpen("reset")}>
                    <KeyRound aria-hidden="true" />
                    Reset password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setOpen("remove")}>
                    <LogOut aria-hidden="true" />
                    Remove
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <FormModal
        open={open === "edit"}
        onClose={close}
        title={isMe ? "Your account" : `Edit ${a.name}`}
        description={isMe ? "You can't change your own role, so the shop always keeps an admin." : "Change the name staff see, or what the account can use."}
      >
        <AccountForm account={a} isMe={isMe} onDone={close} />
      </FormModal>
      <FormModal
        open={open === "reset"}
        onClose={close}
        title={`Reset ${a.name}'s password`}
        description="Set a temporary password and tell them what it is. They choose their own when they next sign in."
      >
        <ResetPasswordForm id={a.id} onDone={close} />
      </FormModal>
      <ConfirmModal
        open={open === "remove"}
        onClose={close}
        title={`Remove ${a.name}?`}
        description={`${a.name} won't be able to sign in any more, and is signed out of the iPad and the admin. Their name stays on what they did, and you can restore the account later.`}
        confirmLabel="Remove account"
        action={() => removeAccount(a.id)}
      />
      <ConfirmModal
        open={open === "delete"}
        onClose={close}
        title={`Delete ${a.name} for good?`}
        description={`This can't be undone. ${a.name}'s sign-in is deleted, and the check-ins, points and gift vouchers they handled will show "Staff" instead of their name. To stop someone signing in but keep their name on the history, leave the account removed.`}
        confirmLabel="Delete for good"
        action={() => deleteAccount(a.id)}
      />
    </li>
  );
}

/** A dialog opened from the ⋯ menu rather than its own button. */
function FormModal({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description: string; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && children}
      </DialogContent>
    </Dialog>
  );
}

/** Asks before something destructive, with Cancel beside it (the same look as ConfirmButton). */
function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  action,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<ActionState>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="lg"
            variant="destructive"
            pending={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await action();
                report(result);
                if (result?.ok) onClose();
              })
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Add an account, or edit one's name and role (not your own role). */
function AccountForm({ account, isMe = false, onDone }: { account?: AccountRow; isMe?: boolean; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    return account ? await updateAccount(account.id, prev, fd) : await createAccount(prev, fd);
  }, null);
  useActionToast(state, { onSuccess: onDone });

  const formSubmit = useFormSubmit(state, formAction);
  return (
    <form {...formSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="account-name">Name</Label>
        <Input id="account-name" name="name" defaultValue={account?.name} maxLength={60} placeholder="As staff know them, e.g. Thu" required />
      </div>
      {!account && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="account-email">Email</Label>
          <Input id="account-email" name="email" type="email" autoComplete="off" placeholder="they@example.com" required />
          <span className="text-[13px] text-muted-foreground">They sign in with it, and it&apos;s where a forgotten-password link goes.</span>
        </div>
      )}
      {!isMe && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="account-role">Role</Label>
          <select id="account-role" name="role" defaultValue={account?.role ?? "staff"} className={selectClass}>
            <option value="staff">Staff: the kiosk only</option>
            <option value="admin">Admin: the admin and the kiosk</option>
          </select>
        </div>
      )}
      {!account && <PasswordField />}
      <Button type="submit" size="lg" pending={pending}>
        {account ? "Save" : "Add account"}
      </Button>
    </form>
  );
}

function ResetPasswordForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(resetAccountPassword.bind(null, id), null);
  useActionToast(state, { onSuccess: onDone });
  const formSubmit = useFormSubmit(state, formAction);
  return (
    <form {...formSubmit} className="flex flex-col gap-4">
      <PasswordField />
      <Button type="submit" size="lg" pending={pending}>
        Reset password
      </Button>
    </form>
  );
}

/** A temporary password, shown in plain text so it can be read out or written down. */
function PasswordField() {
  const [value, setValue] = useState(() => generatePassword());
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="account-password">Temporary password</Label>
      <div className="flex gap-2">
        <Input
          id="account-password"
          name="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          minLength={MIN_PASSWORD}
          required
          className="font-mono tracking-wider"
        />
        <Button type="button" variant="outline" aria-label="Make a new password" title="Make a new password" onClick={() => setValue(generatePassword())}>
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>
      <span className="text-[13px] text-muted-foreground">At least {MIN_PASSWORD} characters. Type your own or use this one.</span>
    </div>
  );
}
