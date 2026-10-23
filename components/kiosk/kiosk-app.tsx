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
import { AlreadyScreen, EnterScreen, ErrorScreen, FoundScreen, RedeemedScreen, SignupScreen, SuccessScreen } from "./screens";

// Mirrors MIN_PHONE_DIGITS / MAX_PHONE_DIGITS in lib/phone.ts (kept out of the client bundle).
const MIN_DIGITS = 8;
const MAX_DIGITS = 12;

export type Screen =
  | { name: "enter" }
  | { name: "found"; customer: KioskCustomer }
  | { name: "signup"; formattedPhone: string; nonStandard: boolean }
  | { name: "success"; result: Extract<CheckInResult, { status: "checked_in" }> }
  | { name: "already"; result: Extract<CheckInResult, { status: "already_checked_in" }> }
  | { name: "redeemed"; result: Extract<RedeemResult, { status: "redeemed" }> }
  | { name: "error"; message: string };

const SUCCESS_SECONDS = 8;

export function KioskApp({ content }: { content: KioskContent }) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ name: "enter" });
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
      if (!atRest) idleTimer.current = setTimeout(reset, content.idleSeconds * 1000);
    };
    arm();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, [screen.name, digits, content.idleSeconds, reset]);

  const handleResult = (result: CheckInResult) => {
    if (result.status === "checked_in") setScreen({ name: "success", result });
    else if (result.status === "already_checked_in") setScreen({ name: "already", result });
    else if (result.status === "error") setScreen({ name: "error", message: result.message });
    else setScreen({ name: "error", message: "We couldn't find that number. Please try again." });
  };

  const submitPhone = () => {
    if (digits.length < MIN_DIGITS || pending) return;
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

  // A physical or Bluetooth keyboard works on the number screen too.
  useEffect(() => {
    if (screen.name !== "enter") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) setDigits((d) => (d.length < MAX_DIGITS ? d + e.key : d));
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

  switch (screen.name) {
    case "enter":
      return (
        <EnterScreen
          digits={digits}
          minDigits={MIN_DIGITS}
          error={phoneError}
          content={content}
          pending={pending}
          onDigit={(d) => setDigits((cur) => (cur.length < MAX_DIGITS ? cur + d : cur))}
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
      return <SuccessScreen result={screen.result} seconds={SUCCESS_SECONDS} onDone={reset} {...redeemProps} />;
    case "already":
      return <AlreadyScreen result={screen.result} timezone={content.timezone} onDone={reset} {...redeemProps} />;
    case "redeemed":
      return <RedeemedScreen result={screen.result} timezone={content.timezone} onDone={reset} />;
    case "error":
      return <ErrorScreen message={screen.message} onDone={reset} />;
  }
}
