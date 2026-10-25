"use client";

import { Plus } from "lucide-react";
import { FormDialog } from "@/components/admin/form-dialog";
import { CustomerForm } from "@/components/admin/customer-form";
import { createCustomer } from "@/app/admin/actions";

export function AddCustomerButton() {
  return (
    <FormDialog
      title="Add customer"
      description="They earn a point at every check-in from now on."
      trigger={
        <>
          <Plus aria-hidden="true" />
          Add customer
        </>
      }
    >
      {(close) => <CustomerForm action={createCustomer} submitLabel="Add customer" onDone={close} />}
    </FormDialog>
  );
}
