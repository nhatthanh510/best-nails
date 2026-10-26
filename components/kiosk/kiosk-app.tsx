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
  type VisitPicks,
} from "@/app/kiosk/actions";
import type { KioskContent } from "@/lib/kiosk-content";
import { SignOutConfirm } from "./sign-out-confirm";
import { GiftVoucherMenu } from "./gift-voucher-menu";
import {
  AlreadyScreen,
  EnterScreen,
  ErrorScreen,
  FoundScreen,
  KioskHeader,
  RedeemedScreen,
  ServicesScreen,
  SignupScreen,
  StaffScreen,
  SuccessScreen,
} from "./screens";
import { cn } from "@/lib/utils";
import { isCompleteNumber, MAX_KIOSK_DIGITS } from "@/lib/phone-mask";


/**
 * A check-in on its way: after Check in (or Join) the customer picks services, then a technician,
 * before it's sent. `from` is the screen Back returns to; `signup` is what a new customer typed.
 */
type Visit = { from: Extract<Screen, { name: "found" | "signup" }>; signup?: SignupInput } & VisitPicks;

export type Screen =
  | { name: "enter" }
  | { name: "found"; customer: KioskCustomer }
  | { name: "signup"; formattedPhone: string; nonStandard: boolean; initial?: SignupInput }
  | { name: "services"; visit: Visit }
  | { name: "staff"; visit: Visit }
  | { name: "success"; result: Extract<CheckInResult, { status: "checked_in" }>; technician?: string }
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

  const handleResult = (result: CheckInResult, technician?: string) => {
    if (result.status === "checked_in") setScreen({ name: "success", result, technician });
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

  const submitCheckIn = (visit: Visit) => {
    if (pending) return;
    const technician = content.technicians.find((t) => t.id === visit.technicianId)?.name;
    startTransition(async () => {
      try {
        handleResult(await checkIn(digits, visit.signup, { serviceIds: visit.serviceIds, technicianId: visit.technicianId }), technician);
      } catch {
        setScreen({ name: "error", message: "We can't reach rewards right now." });
      }
    });
  };

  // Check in → services → staff → checked in. A step with nothing turned on in the admin is left
  // out, and Skip moves on without a choice.
  const hasServices = content.services.length > 0;
  const hasStaff = content.technicians.length > 0;
  const startVisit = (from: Visit["from"], signup?: SignupInput) => {
    const visit: Visit = { from, signup, serviceIds: [], technicianId: null };
    if (hasServices) setScreen({ name: "services", visit });
    else if (hasStaff) setScreen({ name: "staff", visit });
    else submitCheckIn(visit);
  };
  const afterServices = (visit: Visit) => {
    if (hasStaff) setScreen({ name: "staff", visit });
    else submitCheckIn(visit);
  };
  const backFrom = (step: "services" | "staff", visit: Visit) => {
    if (step === "staff" && hasServices) setScreen({ name: "services", visit });
    else if (visit.from.name === "signup") setScreen({ ...visit.from, initial: visit.signup });
    else setScreen(visit.from);
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
  const picking = (screen.name === "services" || screen.name === "staff") && screen.visit.from.name === "found" ? screen.visit.from : null;
  const customerName =
    screen.name === "found"
      ? screen.customer.firstName
      : picking
        ? picking.customer.firstName
        : screen.name === "success" || screen.name === "already"
          ? screen.result.firstName
          : undefined;
  const linked =
    screen.name === "found" || picking !== null || screen.name === "success" || screen.name === "already" || screen.name === "redeemed";

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
            onCheckIn={() => startVisit(screen)}
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
            initial={screen.initial}
            onSubmit={(signup) => startVisit({ ...screen, initial: undefined }, signup)}
            onBack={reset}
          />
        );
      case "services": {
        const { visit } = screen;
        return (
          <ServicesScreen
            categories={content.services}
            selected={visit.serviceIds}
            isLast={!hasStaff}
            pending={pending}
            onToggle={(id) =>
              setScreen({
                name: "services",
                visit: {
                  ...visit,
                  serviceIds: visit.serviceIds.includes(id) ? visit.serviceIds.filter((s) => s !== id) : [...visit.serviceIds, id],
                },
              })
            }
            onBack={() => backFrom("services", visit)}
            onSkip={() => afterServices({ ...visit, serviceIds: [] })}
            onNext={() => afterServices(visit)}
          />
        );
      }
      case "staff": {
        const { visit } = screen;
        return (
          <StaffScreen
            technicians={content.technicians}
            selected={visit.technicianId}
            pending={pending}
            onSelect={(id) => setScreen({ name: "staff", visit: { ...visit, technicianId: id } })}
            onBack={() => backFrom("staff", visit)}
            onSkip={() => submitCheckIn({ ...visit, technicianId: null })}
            onNext={() => submitCheckIn(visit)}
          />
        );
      }
      case "success":
        return (
          <SuccessScreen
            result={screen.result}
            technician={screen.technician}
            seconds={SUCCESS_SECONDS}
            onDone={reset}
            paused={voucherOpen}
            {...redeemProps}
          />
        );
      case "already":
        return <AlreadyScreen result={screen.result} timezone={content.timezone} onDone={reset} {...redeemProps} />;
      case "redeemed":
        return <RedeemedScreen result={screen.result} timezone={content.timezone} onDone={reset} paused={voucherOpen} />;
      case "error":
        return <ErrorScreen message={screen.message} onDone={reset} />;
    }
  }
}
