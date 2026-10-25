"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  checkIn,
  lookupPhone,
  redeemAtKiosk,
  type CheckInResult,
  type KioskCustomer,
  type RedeemResult,
  type RedeemTarget,
  type SignupInput,
} from "@/app/kiosk/actions";
import type { KioskContent } from "@/lib/kiosk-content";
import { SignOutConfirm } from "./sign-out-confirm";
import { GiftVoucherMenu } from "./gift-voucher-menu";
import { AlreadyScreen, EnterScreen, ErrorScreen, FoundScreen, KioskHeader, RedeemedScreen, SignupScreen, SuccessScreen } from "./screens";
import { cn } from "@/lib/utils";
import { isCompleteNumber, MAX_KIOSK_DIGITS } from "@/lib/phone-mask";


export type Screen =
  | { name: "enter" }
  | { name: "found"; customer: KioskCustomer }
  | { name: "signup"; formattedPhone: string; nonStandard: boolean }
  | { name: "success"; result: Extract<CheckInResult, { status: "checked_in" }> }
  | { name: "already"; result: Extract<CheckInResult, { status: "already_checked_in" }> }
  | { name: "redeemed"; result: Extract<RedeemResult, { status: "redeemed" }> }
  | { name: "error"; message: string };

const SUCCESS_SECONDS = 8;

export function KioskApp({ content, isAdmin }: { content: KioskContent; isAdmin: boolean }) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ name: "enter" });
  const [signingOut, setSigningOut] = useState(false);
  // While the Gift voucher dialog is open, the idle reset and screen countdowns wait.
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [digits, setDigitsRaw] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const setDigits = useCallback((next: string | ((d: string) => string)) => {
    setPhoneError(null);
    setDigitsRaw(next);
  }, []);
  const [pending, startTransition] = useTransition();

  const reset = useCallback(() => {
    setDigits("");
    setRedeemError(null);
    setVoucherOpen(false);
    setScreen({ name: "enter" });
    // Pick up promotions or settings changed in the admin since the last visit.
    router.refresh();
  }, [router, setDigits]);

  // Idle timeout: any screen returns to the start and the number is cleared.
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const atRest = screen.name === "enter" && digits === "";
    const arm = () => {
      clearTimeout(idleTimer.current);
      if (!atRest && !voucherOpen) idleTimer.current = setTimeout(reset, content.idleSeconds * 1000);
    };
    arm();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, [screen.name, digits, content.idleSeconds, reset, voucherOpen]);

  const handleResult = (result: CheckInResult) => {
    if (result.status === "checked_in") setScreen({ name: "success", result });
    else if (result.status === "already_checked_in") setScreen({ name: "already", result });
    else if (result.status === "error") setScreen({ name: "error", message: result.message });
    else setScreen({ name: "error", message: "We couldn't find that number. Please try again." });
  };

  const submitPhone = () => {
    if (!isCompleteNumber(digits) || pending) return;
    startTransition(async () => {
      try {
        const result = await lookupPhone(digits);
        if (result.status === "found") setScreen({ name: "found", customer: result.customer });
        else if (result.status === "not_found")
          setScreen({ name: "signup", formattedPhone: result.formattedPhone, nonStandard: result.nonStandard });
        else if (result.status === "invalid_phone") setPhoneError(result.message);
        else setScreen({ name: "error", message: result.message });
      } catch {
        setScreen({ name: "error", message: "We can't reach rewards right now." });
      }
    });
  };

  const submitCheckIn = (signup?: SignupInput) => {
    if (pending) return;
    startTransition(async () => {
      try {
        handleResult(await checkIn(digits, signup));
      } catch {
        setScreen({ name: "error", message: "We can't reach rewards right now." });
      }
    });
  };

  const redeem = (target: RedeemTarget) => {
    if (pending) return;
    setRedeemError(null);
    startTransition(async () => {
      try {
        const result = await redeemAtKiosk(digits, target);
        if (result.status === "redeemed") setScreen({ name: "redeemed", result });
        else setRedeemError(result.message);
      } catch {
        setRedeemError("We can't reach rewards right now. Please ask the front desk.");
      }
    });
  };

  // A physical or Bluetooth keyboard works on the number screen too, except while typing into
  // a field or a dialog (e.g. a gift voucher code from the header).
  useEffect(() => {
    if (screen.name !== "enter") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable], [role=dialog], [role=alertdialog]")) return;
      if (/^[0-9]$/.test(e.key)) setDigits((d) => (d.length < MAX_KIOSK_DIGITS ? d + e.key : d));
      else if (e.key === "Backspace") setDigits((d) => d.slice(0, -1));
      else if (e.key === "Escape") setDigits("");
      else if (e.key === "Enter") submitPhone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const redeemProps = {
    rewards: content.rewards,
    birthdayPercent: content.birthday?.percent,
    pending,
    error: redeemError,
    onRedeem: redeem,
  };

  // Once the customer has typed their number (and they exist), a voucher sold or used here is
  // linked to them. Before that, and on sign-up, it opens without a customer.
  const customerName =
    screen.name === "found"
      ? screen.customer.firstName
      : screen.name === "success" || screen.name === "already"
        ? screen.result.firstName
        : undefined;
  const linked = screen.name === "found" || screen.name === "success" || screen.name === "already" || screen.name === "redeemed";

  return (
    // The number screen fits the screen exactly in landscape, so its keypad can fill the height.
    <div className={cn("flex min-h-dvh w-full flex-col bg-kiosk-bg", screen.name === "enter" && "lg:h-dvh lg:min-h-[600px]")}>
      <KioskHeader
        isAdmin={isAdmin}
        onSignOut={() => setSigningOut(true)}
        voucher={
          <GiftVoucherMenu
            phone={linked ? digits : ""}
            name={customerName}
            onOpenChange={setVoucherOpen}
          />
        }
      />
      {renderScreen()}
      {signingOut && <SignOutConfirm onClose={() => setSigningOut(false)} />}
    </div>
  );

  function renderScreen() {
    switch (screen.name) {
      case "enter":
        return (
          <EnterScreen
            digits={digits}
            error={phoneError}
            content={content}
            pending={pending}
            onDigit={(d) => setDigits((cur) => (cur.length < MAX_KIOSK_DIGITS ? cur + d : cur))}
            onClear={() => setDigits("")}
            onBackspace={() => setDigits((cur) => cur.slice(0, -1))}
            onContinue={submitPhone}
          />
        );
      case "found":
        return (
<FoundScreen
            customer={screen.customer}
            content={content}
            pending={pending}
            onCheckIn={() => submitCheckIn()}
            onStartOver={reset}
            onDone={reset}
            redeem={redeemProps}
          />
        );
      case "signup":
        return (
          <SignupScreen
            formattedPhone={screen.formattedPhone}
            nonStandard={screen.nonStandard}
            content={content}
            pending={pending}
            onSubmit={submitCheckIn}
            onBack={reset}
          />
        );
      case "success":
        return <SuccessScreen result={screen.result} seconds={SUCCESS_SECONDS} onDone={reset} paused={voucherOpen} {...redeemProps} />;
      case "already":
        return <AlreadyScreen result={screen.result} timezone={content.timezone} onDone={reset} {...redeemProps} />;
      case "redeemed":
        return <RedeemedScreen result={screen.result} timezone={content.timezone} onDone={reset} paused={voucherOpen} />;
      case "error":
        return <ErrorScreen message={screen.message} onDone={reset} />;
    }
  }
}
