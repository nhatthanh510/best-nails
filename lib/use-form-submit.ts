"use client";

import { startTransition, useEffect, useRef } from "react";

/**
 * Submits a form to a `useActionState` action without React's automatic form reset.
 *
 * React 19 clears a `<form action={…}>` after every submission, even when the action returns an
 * error, so staff would retype everything after "That email and password don't match" or "A
 * customer with this phone number already exists". Spread the result onto the form instead:
 * `<form {...useFormSubmit(state, formAction)}>`. Typed values stay after an error; after a
 * success the form is cleared as before, unless `resetOnSuccess` is false (forms that keep
 * showing what was saved, like Settings).
 */
export function useFormSubmit(
  state: { ok: boolean } | null,
  formAction: (formData: FormData) => void,
  { resetOnSuccess = true, ref }: { resetOnSuccess?: boolean; ref?: React.RefObject<HTMLFormElement | null> } = {},
) {
  const ownRef = useRef<HTMLFormElement>(null);
  const formRef = ref ?? ownRef;

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess, formRef]);

  return {
    ref: formRef,
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
      startTransition(() => formAction(formData));
    },
  };
}
