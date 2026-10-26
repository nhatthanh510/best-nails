"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./actions";

// The service menu and the nail technicians the kiosk offers after Check in. Admin only (RLS
// agrees: is_staff() means "is an admin"). Past check-ins keep the names they were made with, so
// renaming or deleting here never changes history.

export type MenuKind = "category" | "service" | "technician";

const TABLES = { category: "service_categories", service: "services", technician: "technicians" } as const;
const NOUNS = { category: "category", service: "service", technician: "staff member" } as const;

function fail(message: string): ActionState {
  return { ok: false, message };
}

function dbError(error: { code?: string }, kind: MenuKind): ActionState {
  if (error.code === "42501") return fail("You don't have permission to do that.");
  if (error.code === "23505")
    return fail(kind === "service" ? "This category already has a service with that name." : `There's already a ${NOUNS[kind]} with that name.`);
  console.error(error);
  return fail("Something went wrong. Please try again.");
}

const kindSchema = z.enum(["category", "service", "technician"]);
const MAX_NAME = { category: 60, service: 80, technician: 40 } as const;

/** Next position at the end of the list (within the category, for a service). */
async function nextSortOrder(supabase: Awaited<ReturnType<typeof createClient>>, kind: MenuKind, categoryId?: string) {
  const { data } =
    kind === "service" && categoryId
      ? await supabase.from("services").select("sort_order").eq("category_id", categoryId).order("sort_order", { ascending: false }).limit(1)
      : await supabase.from(TABLES[kind]).select("sort_order").order("sort_order", { ascending: false }).limit(1);
  return (data?.[0]?.sort_order ?? 0) + 1;
}

/** Adds or renames a category, service or staff member. A new one is shown on the kiosk, at the end. */
export async function saveMenuItem(kind: MenuKind, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1, "Enter a name.").max(MAX_NAME[kindSchema.parse(kind)]),
      category_id: z.string().uuid().optional(),
    })
    .safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name") ?? "",
      category_id: formData.get("category_id") || undefined,
    });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, name, category_id } = parsed.data;
  if (kind === "service" && !id && !category_id) return fail("Pick a category.");

  const supabase = await createClient();
  const table = TABLES[kind];
  let error;
  if (id) {
    // A service can also move to another category.
    ({ error } =
      kind === "service" && category_id
        ? await supabase.from("services").update({ name, category_id }).eq("id", id)
        : await supabase.from(table).update({ name }).eq("id", id));
  } else {
    const sort_order = await nextSortOrder(supabase, kind, category_id);
    ({ error } =
      kind === "service"
        ? await supabase.from("services").insert({ name, category_id: category_id!, sort_order })
        : await supabase.from(table).insert({ name, sort_order }));
  }
  if (error) return dbError(error, kind);
  refresh();
  const noun = NOUNS[kind].charAt(0).toUpperCase() + NOUNS[kind].slice(1);
  return { ok: true, message: id ? `${noun} saved.` : `${noun} added.` };
}

/** Shows or hides one on the kiosk. */
export async function setMenuItemShown(kind: MenuKind, id: string, shown: boolean): Promise<ActionState> {
  await requireAdmin();
  if (!kindSchema.safeParse(kind).success || !z.string().uuid().safeParse(id).success) return fail("Something went wrong.");
  const supabase = await createClient();
  const { error } = await supabase.from(TABLES[kind]).update({ is_active: shown }).eq("id", id);
  if (error) return dbError(error, kind);
  refresh();
  return { ok: true, message: shown ? "Shown on the kiosk." : "Hidden from the kiosk." };
}

/** Saves a new order: `ids` from first to last (one category's services, for services). */
export async function reorderMenuItems(kind: MenuKind, ids: string[]): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.array(z.string().uuid()).max(200).safeParse(ids);
  if (!kindSchema.safeParse(kind).success || !parsed.success) return fail("Something went wrong.");
  const supabase = await createClient();
  const results = await Promise.all(parsed.data.map((id, i) => supabase.from(TABLES[kind]).update({ sort_order: i + 1 }).eq("id", id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) return dbError(failed.error, kind);
  refresh();
  return { ok: true };
}

/** Deletes one for good (a category takes its services with it). History keeps the names. */
export async function deleteMenuItem(kind: MenuKind, id: string): Promise<ActionState> {
  await requireAdmin();
  if (!kindSchema.safeParse(kind).success) return fail("Something went wrong.");
  const supabase = await createClient();
  const { error } = await supabase.from(TABLES[kind]).delete().eq("id", id);
  if (error) return dbError(error, kind);
  refresh();
  const noun = NOUNS[kind].charAt(0).toUpperCase() + NOUNS[kind].slice(1);
  return { ok: true, message: `${noun} deleted.` };
}
