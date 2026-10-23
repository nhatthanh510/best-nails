"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { pairThisDevice } from "@/lib/kiosk-device";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  signOut: z.literal("on").optional(),
});

export async function pairKiosk(formData: FormData) {
  const staff = await requireStaff();
  const { name, signOut } = schema.parse({
    name: formData.get("name"),
    signOut: formData.get("signOut") ?? undefined,
  });

  await pairThisDevice(name, staff.id);
  if (signOut) await (await createClient()).auth.signOut();
  redirect("/kiosk");
}
