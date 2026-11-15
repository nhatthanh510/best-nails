"use client";

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useTransition } from "react";
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
import { GiftCardMenu } from "./gift-card-menu";
import { StillThere } from "./still-there";
import { StaffPinDialog } from "./staff-pin";
import { StaffMenu } from "./staff-menu";
import { lockKiosk } from "@/app/kiosk/pin-actions";
import {
  AlreadyScreen,
  EnterScreen,
  FoundScreen,
  KioskHeader,
  PaymentScreen,
  RedeemedScreen,
  ServicesScreen,
  SignedOutScreen,
  SignupScreen,
  StaffScreen,
  SuccessScreen,
  type VisitSummary,
} from "./screens";
import { cn } from "@/lib/utils";
import { isCompleteNumber, MAX_KIOSK_DIGITS } from "@/lib/phone-mask";
import { hasCashBonus } from "@/lib/rewards";


/**
 * A check-in on its way: after Check in (or Join) the customer picks services, then (optionally) a
 * technician, then taps Cash or Card (when a reward gives more for cash), which sends it. `from` is the screen Back returns to; `signup` is what a new customer typed.
 */
type Visit = { from: Extract<Screen, { name: "found" | "signup" }>; signup?: SignupInput } & VisitPicks;

export type Screen =
  | { name: "enter" }
  | { name: "found"; customer: KioskCustomer }
  | { name: "signup"; formattedPhone: string; nonStandard: boolean; initial?: SignupInput; picks?: VisitPicks }
  | { name: "services"; visit: Visit }
  | { name: "staff"; visit: Visit }
  | { name: "payment"; visit: Visit }
  | { name: "success"; result: Extract<CheckInResult, { status: "checked_in" }>; summary: VisitSummary }
  | { name: "already"; result: Extract<CheckInResult, { status: "already_checked_in" }> }
  | { name: "redeemed"; result: Extract<RedeemResult, { status: "redeemed" }> }
  /** Only when the kiosk has been signed out: anything else is shown on the step it happened on. */
  | { name: "signed_out" };

const OFFLINE = "We can't reach rewards right now. Please try again.";

/** How long "Still there?" counts down before the idle reset (at most half the idle time). */
const WARNING_SECONDS = 15;
/** How long the Staff menu or Gift card dialog may sit untouched before it closes and locks. */
const STAFF_IDLE_SECONDS = 180;

export function KioskApp({ content, isAdmin }: { content: KioskContent; isAdmin: boolean }) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ name: "enter" });
  const [signingOut, setSigningOut] = useState(false);
  // While the Gift card dialog is open, the idle reset waits longer (STAFF_IDLE_SECONDS).
  const [giftCardOpen, setGiftCardOpen] = useState(false);
  const [digits, setDigitsRaw] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  // A check-in that didn't go through: shown on the payment step, which keeps everything picked.
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const setDigits = useCallback((next: string | ((d: string) => string)) => {
    setPhoneError(null);
    setDigitsRaw(next);
  }, []);
  const [pending, startTransition] = useTransition();
  // The staff PIN, asked before Gift card, Admin and Sign out when the shop has set one: what was
  // tapped, and what to do once the PIN is right.
  // The quiet Staff button: the shop PIN first (when one is set), then the Staff menu (Gift card,
  // Admin, Sign out). The PIN unlocks the gift card actions until the menu or the Gift card
  // dialog closes.
  const [askingPin, setAskingPin] = useState(false);
  const [staffMenu, setStaffMenu] = useState(false);
  const [adminPending, startAdminNav] = useTransition();
  const staffPin = content.staffPin;
  const relock = () => {
    if (staffPin) lockKiosk().catch(() => {});
  };
  const openStaff = () => (staffPin ? setAskingPin(true) : setStaffMenu(true));
  // Seconds left on the "Still there?" warning, while it shows.
  const [warningLeft, setWarningLeft] = useState<number | null>(null);

  const reset = useCallback(() => {
    setWarningLeft(null);
    setDigits("");
    setRedeemError(null);
    setCheckInError(null);
    setGiftCardOpen(false);
    setSigningOut(false);
    setAskingPin(false);
    setStaffMenu(false);
    // In case staff walked away with the Staff menu open: lock the gift card actions again.
    if (content.staffPin) lockKiosk().catch(() => {});
    setScreen({ name: "enter" });
    // Pick up promotions or settings changed in the admin since the last visit.
    router.refresh();
  }, [router, setDigits, content.staffPin]);

  // Next keeps a page it leaves hidden (React <Activity>) with its state, so going to the admin and
  // back would reopen the last customer's step. Clear everything as the kiosk is hidden, so it
  // always comes back to an empty keypad (the cleanup runs before it's hidden: no flash of the old
  // step), and fetch fresh content as it's shown again, to pick up what was changed in the admin.
  const shownBefore = useRef(false);
  useLayoutEffect(() => {
    if (shownBefore.current) router.refresh();
    shownBefore.current = true;
    return () => {
      setDigitsRaw("");
      setPhoneError(null);
      setRedeemError(null);
      setCheckInError(null);
      setGiftCardOpen(false);
      setSigningOut(false);
      setAskingPin(false);
      setStaffMenu(false);
      setWarningLeft(null);
      setScreen({ name: "enter" });
    };
  }, [router]);

  // Idle timeout: any screen returns to the start and the number is cleared. Before that, "Still
  // there?" counts down, so a customer holding the iPad (or waiting for staff) isn't sent back
  // without warning; any tap or key press starts the wait again. While the warning shows, only its
  // buttons close it (a stray tap doesn't), and dismissing it starts a fresh wait. It's the only
  // automatic return: no screen has a countdown of its own.
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const warningShown = warningLeft !== null;
  // Sign out's confirm and the PIN prompt count too: left open, they'd wait for the next customer.
  const staffOpen = giftCardOpen || staffMenu || signingOut || askingPin;
  useEffect(() => {
    if (warningShown) return;
    const atRest = screen.name === "enter" && digits === "";
    const warning = Math.min(WARNING_SECONDS, Math.floor(content.idleSeconds / 2));
    const arm = () => {
      clearTimeout(idleTimer.current);
      // Staff tools open (the Staff menu or the Gift card dialog, both past the PIN): a longer wait
      // with no warning (it couldn't be tapped through the dialog), then everything closes and
      // locks, so staff who walk away don't leave them open for the next customer.
      if (staffOpen) {
        idleTimer.current = setTimeout(reset, Math.max(content.idleSeconds, STAFF_IDLE_SECONDS) * 1000);
        return;
      }
      if (atRest) return;
      idleTimer.current = setTimeout(
        () => (warning > 0 ? setWarningLeft(warning) : reset()),
        (content.idleSeconds - warning) * 1000,
      );
    };
    arm();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, [screen.name, digits, content.idleSeconds, reset, staffOpen, warningShown]);

  // The warning's countdown, a second at a time, then the reset.
  useEffect(() => {
    if (warningLeft === null) return;
    const t = setTimeout(() => (warningLeft <= 1 ? reset() : setWarningLeft(warningLeft - 1)), 1000);
    return () => clearTimeout(t);
  }, [warningLeft, reset]);

  const handleResult = (result: CheckInResult, summary: VisitSummary) => {
    if (result.status === "checked_in") setScreen({ name: "success", result, summary });
    else if (result.status === "already_checked_in") setScreen({ name: "already", result });
    else if (result.status === "error" && result.signedOut) setScreen({ name: "signed_out" });
    // Anything else stays on the payment step with what was picked, so trying again is one tap.
    else setCheckInError(result.status === "error" ? result.message : "We couldn't find that number. Please start over.");
  };


  const submitPhone = () => {
    if (!isCompleteNumber(digits) || pending) return;
    startTransition(async () => {
      try {
        const result = await lookupPhone(digits);
        // Checked in today already: the redeem screen. Otherwise straight into the visit steps
        // (the first one greets them by name, with "Not you? Start over").
        if (result.status === "found") {
          const found = { name: "found", customer: result.customer } as const;
          if (result.customer.checkedInAt) setScreen(found);
          else startVisit(found);
        }
        else if (result.status === "not_found")
          setScreen({ name: "signup", formattedPhone: result.formattedPhone, nonStandard: result.nonStandard });
        else if (result.status === "error" && result.signedOut) setScreen({ name: "signed_out" });
        // The number stays on the keypad, so Continue tries again.
        else setPhoneError(result.message);
      } catch {
        setPhoneError(OFFLINE);
      }
    });
  };

  const submitCheckIn = (visit: Visit) => {
    if (pending) return;
    setCheckInError(null);
    const summary: VisitSummary = {
      services: content.services.flatMap((c) => c.services).filter((sv) => visit.serviceIds.includes(sv.id)).map((sv) => sv.name),
      technician: content.technicians.find((t) => t.id === visit.technicianId)?.name,
      payment: visit.paymentMethod,
    };
    startTransition(async () => {
      try {
        handleResult(
          await checkIn(digits, visit.signup, {
            serviceIds: visit.serviceIds,
            technicianId: visit.technicianId,
            paymentMethod: visit.paymentMethod,
          }),
          summary,
        );
      } catch {
        setCheckInError(OFFLINE);
      }
    });
  };

  // Check in → services → staff → Cash or Card (the tap checks in) → checked in. Services need at
  // least one pick; staff can be skipped; payment is always asked (the shop records how every visit
  // was paid, and a reward may give more for cash). Services or staff with nothing turned on in the
  // admin are left out.
  const hasServices = content.services.length > 0;
  const hasStaff = content.technicians.length > 0;
  const cashReward = content.rewards.find(hasCashBonus) ?? null;
  const startVisit = (from: Visit["from"], signup?: SignupInput, picks?: VisitPicks) => {
    // `picks`: what a new customer had chosen before going back to the sign-up form.
    const visit: Visit = { from, signup, serviceIds: [], technicianId: null, ...picks, paymentMethod: null };
    if (hasServices) setScreen({ name: "services", visit });
    else afterServices(visit);
  };
  const afterServices = (visit: Visit) => {
    if (hasStaff) setScreen({ name: "staff", visit });
    else afterStaff(visit);
  };
  const afterStaff = (visit: Visit) => {
    setScreen({ name: "payment", visit });
  };
  const backFrom = (step: "services" | "staff" | "payment", visit: Visit) => {
    setCheckInError(null);
    if (step === "payment" && hasStaff) setScreen({ name: "staff", visit });
    else if (step !== "services" && hasServices) setScreen({ name: "services", visit });
    else if (visit.from.name === "signup")
      setScreen({
        ...visit.from,
        initial: visit.signup,
        picks: { serviceIds: visit.serviceIds, technicianId: visit.technicianId, paymentMethod: null },
      });
    else reset();
  };

  // The first step of a returning customer's visit says who they are, with "Not you? Start over".
  const introFor = (step: "services" | "staff" | "payment", visit: Visit) => {
    if (visit.from.name !== "found") return {};
    const c = visit.from.customer;
    const first = step === "services" || (step === "staff" && !hasServices) || (step === "payment" && !hasServices && !hasStaff);
    return {
      greeting: (
        <>
          Welcome back, <span className="font-bold text-kiosk-ink">{c.firstName}</span> ·{" "}
          <span className="tabular-nums">{c.maskedPhone}</span>
          {c.birthday.eligible && c.birthday.label && ` · Happy birthday! ${c.birthday.label} is waiting.`}
        </>
      ),
      backLabel: first ? "Not you? Start over" : "Back",
    };
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
        setRedeemError(OFFLINE);
      }
    });
  };

  // A physical or Bluetooth keyboard works on the number screen too, except while typing into
  // a field or a dialog (e.g. a gift card code from the header).
  // An Effect Event sees the latest digits (for Enter) without re-subscribing on every keypress.
  const onKeyboard = useEffectEvent((e: KeyboardEvent) => {
    // "Still there?" is up: only its buttons do anything.
    if (warningLeft !== null || askingPin || staffMenu || signingOut) return;
    if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable], [role=dialog], [role=alertdialog]")) return;
    if (/^[0-9]$/.test(e.key)) setDigits((d) => (d.length < MAX_KIOSK_DIGITS ? d + e.key : d));
    else if (e.key === "Backspace") setDigits((d) => d.slice(0, -1));
    else if (e.key === "Escape") setDigits("");
    else if (e.key === "Enter") submitPhone();
  });
  useEffect(() => {
    if (screen.name !== "enter") return;
    const onKey = (e: KeyboardEvent) => onKeyboard(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen.name]);

  const redeemProps = {
    rewards: content.rewards,
    pending,
    error: redeemError,
    onRedeem: redeem,
  };

  // Once the customer has typed their number (and they exist), a gift card sold or used here is
  // linked to them. Before that, and on sign-up, it opens without a customer.
  const picking =
    (screen.name === "services" || screen.name === "staff" || screen.name === "payment") && screen.visit.from.name === "found"
      ? screen.visit.from
      : null;
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
    <div data-kiosk className={cn("flex min-h-dvh w-full flex-col bg-kiosk-bg", screen.name === "enter" && "lg:h-dvh lg:min-h-[600px]")}>
      <KioskHeader onStaff={openStaff} pending={adminPending} />
      {renderScreen()}
      {askingPin && (
        <StaffPinDialog
          purpose="gift_card"
          onClose={() => setAskingPin(false)}
          onUnlocked={() => {
            setAskingPin(false);
            setStaffMenu(true);
          }}
        />
      )}
      {staffMenu && (
        <StaffMenu
          isAdmin={isAdmin}
          onClose={() => {
            setStaffMenu(false);
            relock();
          }}
          onGiftCard={() => {
            setStaffMenu(false);
            setGiftCardOpen(true);
          }}
          onAdmin={() => {
            setStaffMenu(false);
            relock();
            startAdminNav(() => router.push("/admin"));
          }}
          onSignOut={() => {
            setStaffMenu(false);
            relock();
            setSigningOut(true);
          }}
        />
      )}
      <GiftCardMenu
        open={giftCardOpen}
        onOpenChange={setGiftCardOpen}
        phone={linked ? digits : ""}
        name={customerName}
        relock={content.staffPin}
      />
      {signingOut && <SignOutConfirm onClose={() => setSigningOut(false)} />}
      {warningLeft !== null && <StillThere secondsLeft={warningLeft} onStillHere={() => setWarningLeft(null)} onStartOver={reset} />}
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
            birthday={content.birthday}
            pending={pending}
            initial={screen.initial}
            onSubmit={(signup) => startVisit({ ...screen, initial: undefined, picks: undefined }, signup, screen.picks)}
            onBack={reset}
          />
        );
      case "services": {
        const { visit } = screen;
        return (
          <ServicesScreen
            categories={content.services}
            selected={visit.serviceIds}
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
            {...introFor("services", visit)}
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
            {...introFor("staff", visit)}
            onSkip={() => afterStaff({ ...visit, technicianId: null })}
            onNext={() => afterStaff(visit)}
          />
        );
      }
      case "payment": {
        const { visit } = screen;
        return (
          <PaymentScreen
            reward={cashReward}
            pending={pending}
            error={checkInError}
            onPick={(method) => {
              const next = { ...visit, paymentMethod: method };
              setScreen({ name: "payment", visit: next });
              submitCheckIn(next);
            }}
            onBack={() => backFrom("payment", visit)}
            {...introFor("payment", visit)}
          />
        );
      }
      case "success":
        return (
          <SuccessScreen
            result={screen.result}
            summary={screen.summary}
            onDone={reset}
            {...redeemProps}
          />
        );
      case "already":
        return <AlreadyScreen result={screen.result} timezone={content.timezone} onDone={reset} {...redeemProps} />;
      case "redeemed":
        return <RedeemedScreen result={screen.result} timezone={content.timezone} onDone={reset} />;
      case "signed_out":
        return <SignedOutScreen />;
    }
  }
}
