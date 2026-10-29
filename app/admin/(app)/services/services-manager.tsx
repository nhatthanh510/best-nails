"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronRight, GripVertical, Pencil, Plus, Sparkles, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/admin/ui";
import { ConfirmButton, useActionToast } from "@/components/admin/action-button";
import { deleteMenuItem, reorderMenuItems, saveMenuItem, setMenuItemShown, type MenuKind } from "@/app/admin/service-actions";
import type { ServiceCategory, Technician } from "@/lib/admin-data";
import { useFormSubmit } from "@/lib/use-form-submit";
import { cn } from "@/lib/utils";

type Item = { id: string; name: string; is_active: boolean };

// "new" opens a blank editor, `new:<categoryId>` a new service in that category, an id edits it.
type Editing = string | null;

export function ServicesManager({ categories }: { categories: ServiceCategory[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  // Categories start folded, so the page is a short list; open one to see and edit its services.
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const sortable = useSortable("category", categories);
  const total = categories.reduce((n, c) => n + c.services.length, 0);

  return (
    <Card className="flex min-w-0 flex-[2_1_480px] flex-col gap-5 p-5 sm:p-6">
      <CardHeading
        icon={<Sparkles className="size-5 text-primary" aria-hidden="true" />}
        title="Services"
        description={`${total} service${total === 1 ? "" : "s"} in ${categories.length} categor${categories.length === 1 ? "y" : "ies"}. Customers pick at least one (staff can pick for them).`}
        action={
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            Add category
          </Button>
        }
      />

      {categories.length === 0 && editing !== "new" && (
        <p className="text-sm text-muted-foreground">No services yet, so the kiosk skips this step. Add a category to start.</p>
      )}

      {editing === "new" && (
        <div className="overflow-hidden rounded-xl border border-border">
          <NameEditor kind="category" onDone={() => setEditing(null)} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        {sortable.items.map((c, i) => {
          const isOpen = open.has(c.id) || editing === `new:${c.id}`;
          return (
            <section
              key={c.id}
              aria-label={c.name}
              {...sortable.rowProps(c.id, i)}
              className={cn("overflow-hidden rounded-xl border border-border", sortable.dragging === c.id && "opacity-50")}
            >
              <div className={cn("bg-muted/60", isOpen && "border-b border-border")}>
                {editing === c.id ? (
                  <NameEditor kind="category" item={c} count={c.services.length} onDone={() => setEditing(null)} />
                ) : (
                  <ItemRow
                    kind="category"
                    item={c}
                    heading
                    detail={`${c.services.length} service${c.services.length === 1 ? "" : "s"}`}
                    handle={sortable.handleProps(c.id, i)}
                    onEdit={() => setEditing(c.id)}
                    expanded={isOpen}
                    onExpand={() => toggle(c.id)}
                    controls={`services-${c.id}`}
                  />
                )}
              </div>
              {isOpen && <ServiceList id={`services-${c.id}`} category={c} categories={categories} editing={editing} setEditing={setEditing} />}
            </section>
          );
        })}
      </div>
    </Card>
  );
}

function ServiceList({
  id,
  category,
  categories,
  editing,
  setEditing,
}: {
  id: string;
  category: ServiceCategory;
  categories: ServiceCategory[];
  editing: Editing;
  setEditing: (e: Editing) => void;
}) {
  const sortable = useSortable("service", category.services);
  return (
    <ul id={id} className={cn("divide-y divide-border/70", !category.is_active && "opacity-55")}>
      {sortable.items.map((s, i) => (
        <li key={s.id} {...sortable.rowProps(s.id, i)} className={cn(sortable.dragging === s.id && "opacity-50")}>
          {editing === s.id ? (
            <NameEditor kind="service" item={s} categoryId={category.id} categories={categories} onDone={() => setEditing(null)} />
          ) : (
            <ItemRow kind="service" item={s} handle={sortable.handleProps(s.id, i)} onEdit={() => setEditing(s.id)} />
          )}
        </li>
      ))}
      <li>
        {editing === `new:${category.id}` ? (
          <NameEditor kind="service" categoryId={category.id} onDone={() => setEditing(null)} />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(`new:${category.id}`)}
            className="flex min-h-11 w-full items-center gap-2 px-4 text-sm font-bold text-primary hover:bg-muted/50"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add service
          </button>
        )}
      </li>
    </ul>
  );
}

export function TechniciansManager({ technicians }: { technicians: Technician[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const sortable = useSortable("technician", technicians);

  return (
    <Card className="flex min-w-0 flex-[1_1_320px] flex-col gap-5 p-5 sm:p-6">
      <CardHeading
        icon={<UserRound className="size-5 text-primary" aria-hidden="true" />}
        title="Staff"
        description="The nail technicians customers can choose. Separate from sign-in accounts."
        action={
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            Add staff
          </Button>
        }
      />

      {technicians.length === 0 && editing !== "new" && (
        <p className="text-sm text-muted-foreground">No staff yet, so the kiosk skips this step.</p>
      )}
      {(technicians.length > 0 || editing === "new") && (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border">
          {sortable.items.map((t, i) => (
            <li key={t.id} {...sortable.rowProps(t.id, i)} className={cn(sortable.dragging === t.id && "opacity-50")}>
              {editing === t.id ? (
                <NameEditor kind="technician" item={t} onDone={() => setEditing(null)} />
              ) : (
                <ItemRow kind="technician" item={t} avatar handle={sortable.handleProps(t.id, i)} onEdit={() => setEditing(t.id)} />
              )}
            </li>
          ))}
          {editing === "new" && (
            <li>
              <NameEditor kind="technician" onDone={() => setEditing(null)} />
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

function CardHeading({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon}
          <h2 className="text-lg font-extrabold">{title}</h2>
        </div>
        {action}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * Drag to reorder by the grip (or focus the grip and use the arrow keys). The list moves while
 * dragging and the new order is saved on drop.
 */
function useSortable<T extends Item>(kind: MenuKind, saved: T[]) {
  const [items, setItems] = useOptimistic(saved);
  const [draft, setDraft] = useState<T[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const list = draft ?? items;

  const save = (next: T[]) => {
    if (next.map((i) => i.id).join() === items.map((i) => i.id).join()) return;
    startTransition(async () => {
      setItems(next);
      const result = await reorderMenuItems(
        kind,
        next.map((i) => i.id),
      );
      if (!result?.ok) toast.error(result?.message ?? "Couldn't save the order.");
    });
  };

  const moveTo = (from: number, to: number, current: T[]) => {
    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  return {
    items: list,
    dragging,
    rowProps: (id: string, index: number) => ({
      draggable: armed === id,
      onDragStart: (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        setDragging(id);
        setDraft(list);
      },
      onDragOver: (e: React.DragEvent) => {
        if (!dragging) return;
        e.preventDefault();
        e.stopPropagation();
        setDraft((cur) => {
          const current = cur ?? list;
          const from = current.findIndex((i) => i.id === dragging);
          return from === -1 || from === index ? cur : moveTo(from, index, current);
        });
      },
      onDragEnd: (e: React.DragEvent) => {
        e.stopPropagation();
        if (draft) save(draft);
        setDraft(null);
        setDragging(null);
        setArmed(null);
      },
    }),
    handleProps: (id: string, index: number) => ({
      onPointerDown: () => setArmed(id),
      onPointerUp: () => setArmed(null),
      onKeyDown: (e: React.KeyboardEvent) => {
        const to = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : null;
        if (to === null || to < 0 || to >= list.length) return;
        e.preventDefault();
        save(moveTo(index, to, list));
      },
    }),
  };
}

function ItemRow({
  kind,
  item,
  heading = false,
  avatar = false,
  detail,
  handle,
  onEdit,
  expanded,
  onExpand,
  controls,
}: {
  kind: MenuKind;
  item: Item;
  heading?: boolean;
  avatar?: boolean;
  detail?: string;
  handle: React.HTMLAttributes<HTMLButtonElement>;
  onEdit: () => void;
  /** A category folds: its name opens and closes its services instead of editing it. */
  expanded?: boolean;
  onExpand?: () => void;
  controls?: string;
}) {
  const [shown, setShown] = useOptimistic(item.is_active);
  const [, startTransition] = useTransition();
  const toggle = (next: boolean) =>
    startTransition(async () => {
      setShown(next);
      const result = await setMenuItemShown(kind, item.id, next);
      if (!result?.ok) toast.error(result?.message ?? "Couldn't save that.");
    });

  return (
    <div className={cn("flex items-center gap-1 pr-2 pl-1", heading ? "min-h-13" : "min-h-12")}>
      <button
        type="button"
        {...handle}
        aria-label={`Reorder ${item.name}. Use the arrow keys to move it.`}
        className="flex h-11 w-8 flex-none cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/45 hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      {avatar && (
        <span
          aria-hidden="true"
          className={cn(
            "mr-2 flex size-8 flex-none items-center justify-center rounded-full bg-accent font-heading text-base font-bold text-accent-foreground transition-opacity",
            !shown && "opacity-40",
          )}
        >
          {item.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <button
        type="button"
        onClick={onExpand ?? onEdit}
        aria-expanded={onExpand ? expanded : undefined}
        aria-controls={onExpand ? controls : undefined}
        // Turned off: faded, so it reads as off the kiosk at a glance; the switch stays clear.
        className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left transition-opacity", !shown && "opacity-40")}
      >
        {onExpand && (
          <ChevronRight
            className={cn("-ml-1 size-4.5 flex-none text-muted-foreground transition-transform", expanded && "rotate-90")}
            aria-hidden="true"
          />
        )}
        <span className={cn("min-w-0 break-words", heading ? "text-base font-extrabold" : "text-[15px] font-medium")}>
          {item.name}
        </span>
        {detail && <span className="flex-none text-[13px] text-muted-foreground">{detail}</span>}
      </button>
      <Switch checked={shown} onCheckedChange={toggle} aria-label={`Show ${item.name} on the kiosk`} className="mx-2" />
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${item.name}`} className="flex-none text-muted-foreground">
        <Pencil aria-hidden="true" />
      </Button>
    </div>
  );
}

const LABELS: Record<MenuKind, { field: string; placeholder: string }> = {
  category: { field: "Category name", placeholder: "e.g. Pedicure" },
  service: { field: "Service name", placeholder: "e.g. Deluxe pedicure" },
  technician: { field: "Staff name", placeholder: "e.g. Linh" },
};

function NameEditor({
  kind,
  item,
  categoryId,
  categories,
  count,
  onDone,
}: {
  kind: MenuKind;
  item?: Item;
  categoryId?: string;
  /** Editing a service: it can move to another category. */
  categories?: ServiceCategory[];
  /** A category's services, which go with it when it's deleted. */
  count?: number;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveMenuItem.bind(null, kind), null);
  useActionToast(state, { errors: false, onSuccess: onDone });
  const formSubmit = useFormSubmit(state, formAction);
  const label = LABELS[kind];
  const nameId = `name-${item?.id ?? `new-${kind}-${categoryId ?? ""}`}`;

  return (
    // One row in place of the item: the name, the category (when editing a service), then the
    // buttons. Escape cancels, as Cancel does.
    <form
      {...formSubmit}
      onKeyDown={(e) => e.key === "Escape" && onDone()}
      className="flex flex-col gap-2 bg-accent/45 px-3 py-2.5"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      {!categories && categoryId && <input type="hidden" name="category_id" value={categoryId} />}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={nameId}
          name="name"
          required
          autoFocus
          maxLength={80}
          defaultValue={item?.name}
          placeholder={label.placeholder}
          aria-label={label.field}
          aria-invalid={state?.ok === false || undefined}
          className="min-w-0 flex-[1_1_120px] bg-card"
        />
        {categories && (
          <select
            name="category_id"
            aria-label="Category"
            defaultValue={categoryId}
            className="h-11 min-w-0 flex-[0_1_170px] rounded-[10px] border border-input bg-card px-3 text-[15px]"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-1">
          {item && (
            <ConfirmButton
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Delete ${item.name}`}
              className="text-destructive hover:text-destructive"
              title={`Delete “${item.name}”?`}
              description={
                kind === "category"
                  ? `${count === 1 ? "Its 1 service is" : `Its ${count ?? 0} services are`} deleted too. Past check-ins keep their names. To hide it for now, turn it off instead.`
                  : "Past check-ins keep the name. To hide it for now, turn it off instead."
              }
              confirmLabel="Delete"
              action={deleteMenuItem.bind(null, kind, item.id)}
            >
              <Trash2 aria-hidden="true" />
            </ConfirmButton>
          )}
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" pending={pending}>
            {!pending && (item ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />)}
            {item ? "Save" : "Add"}
          </Button>
        </div>
      </div>
      {state && !state.ok && (
        <p role="alert" className="px-1 text-sm font-semibold text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
