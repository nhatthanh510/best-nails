"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Cake, Check, ChevronLeft, Gift, LayoutGrid, LogOut, RotateCw, TriangleAlert, WifiOff } from "lucide-react";
import { Spinner as SharedSpinner } from "@/components/ui/spinner";
import type { CheckInResult, KioskBirthday, KioskCustomer, RedeemResult, RedeemTarget, SignupInput } from "@/app/kiosk/actions";
import type { KioskContent, KioskReward, KioskServiceCategory, KioskTechnician } from "@/lib/kiosk-content";
import { birthdayWindowLabel } from "@/lib/rewards";
import { daysInMonth } from "@/lib/birthday";
import { fillPhoneMask, isCompleteNumber, looksStandard } from "@/lib/phone-mask";
import Link from "next/link";
import { KioskBrand } from "./brand";
import { Numpad } from "./numpad";

const primaryButton =
  "flex items-center justify-center gap-3 rounded-3xl bg-kiosk-accent bg-gold-sheen font-extrabold text-kiosk-bg transition active:scale-[0.98] enabled:hover:brightness-110 enabled:hover:shadow-[0_6px_24px_-6px_rgb(216_180_92/0.45)] disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-kiosk-ink";
const outlineButton =
  "flex min-h-14 items-center gap-2.5 rounded-2xl border-2 border-kiosk-line px-6 text-lg font-bold text-kiosk-muted transition-colors hover:border-kiosk-faint hover:bg-kiosk-surface hover:text-kiosk-ink active:bg-kiosk-surface focus-visible:outline-3 focus-visible:outline-kiosk-accent";

function Shell({ children, centered = false }: { children: React.ReactNode; centered?: boolean }) {
  return (
    <main
      className={`flex min-h-0 w-full flex-1 text-kiosk-ink ${
        centered
          ? "flex-col items-center justify-center gap-7 px-5 py-10 text-center sm:p-10 lg:p-16 short:gap-5 lg:short:p-10"
          : "flex-col gap-8 px-5 py-6 sm:px-10 sm:py-8 lg:px-16 lg:py-10 short:gap-6 lg:short:py-6"
      }`}
    >
      {children}
    </main>
  );
}

const headerButton = "flex min-h-12 items-center gap-2 rounded-full px-4 text-base sm:px-5";

/**
 * One header above every kiosk step, so the shop's frame never changes: the brand on the left;
 * Gift voucher, Admin (admin accounts) and Sign out (asks first) on the right. Staff controls
 * stay quiet so customers read them as the shop's. A step's own way back lives in the step
 * (StepBack), not here. On phones the controls are icons and only the logo shows.
 */
export function KioskHeader({
  isAdmin,
  onSignOut,
  voucher,
}: {
  isAdmin: boolean;
  onSignOut: () => void;
  voucher: React.ReactNode;
}) {
  return (
    <header className="flex-none px-5 pt-5 sm:px-10 sm:pt-8 lg:px-16 lg:short:pt-5">
      <div className="flex items-center justify-between gap-3 border-b border-kiosk-line pb-5 short:pb-3">
        <KioskBrand compactOnPhone />
        <div className="flex items-center gap-1">
          {voucher}
          {isAdmin && (
            <Link href="/admin" className={`${headerButton} border border-kiosk-line font-bold text-kiosk-muted hover:text-kiosk-ink`}>
              <LayoutGrid className="size-5" aria-hidden="true" />
              <span className="max-sm:sr-only">Admin</span>
            </Link>
          )}
          <button type="button" onClick={onSignOut} className={`${headerButton} font-semibold text-kiosk-faint hover:text-kiosk-muted`}>
            <LogOut className="size-5" aria-hidden="true" />
            <span className="max-sm:sr-only">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * A step's way back, at the top-left of its content above the heading (where the start screen
 * has its "Rewards check-in" line): a labelled pill in the kiosk's outline style.
 */
function StepBack({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-fit items-center gap-1.5 rounded-full border-2 border-kiosk-line pr-5 pl-3 text-base font-bold text-kiosk-muted hover:text-kiosk-ink active:bg-kiosk-surface focus-visible:outline-3 focus-visible:outline-kiosk-accent"
    >
      <ChevronLeft className="size-5" strokeWidth={2.4} aria-hidden="true" />
      {label}
    </button>
  );
}

function Spinner() {
  return <SharedSpinner className="size-7" />;
}

/** The main reward (cheapest active one): what the punch card counts towards. */
function mainReward(rewards: KioskReward[]) {
  return rewards[0] ?? null;
}

function visitsToGo(points: number, reward: KioskReward) {
  const n = reward.cost - points;
  return `${n} more visit${n === 1 ? "" : "s"} to ${reward.title}`;
}

/** One stamp per point towards the reward, e.g. 7 of 10 filled. */
function PunchCard({ points, cost, size = "lg" }: { points: number; cost: number; size?: "lg" | "md" }) {
  const filled = Math.min(points, cost);
  const dot = size === "lg" ? "size-12" : "size-10";
  return (
    <div role="img" aria-label={`${filled} of ${cost} stamps`} className="flex flex-wrap gap-2.5">
      {Array.from({ length: cost }, (_, i) => {
        const on = i < filled;
        const last = i === cost - 1;
        return (
          <span
            key={i}
            className={`flex ${dot} items-center justify-center rounded-full ${
              on ? "bg-kiosk-accent text-kiosk-bg" : "border-2 border-dashed border-kiosk-line text-kiosk-placeholder"
            }`}
          >
            {on ? (
              <Check className="size-6" strokeWidth={3} aria-hidden="true" />
            ) : last ? (
              <Gift className="size-5" aria-hidden="true" />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function ProgramCard({ content }: { content: KioskContent }) {
  const reward = mainReward(content.rewards);
  // A shop with no reward yet and the birthday discount off has nothing to advertise.
  if (!reward && !content.birthday) return null;
  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] bg-kiosk-surface px-6 py-5">
      {reward && (
        <div className="flex items-center gap-4">
          <div className="flex size-12 flex-none items-center justify-center rounded-2xl bg-kiosk-line">
            <Gift className="size-6 text-kiosk-accent" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-0.5">
            {/* The reward's own name leads, whatever the shop calls it ("10% off", "Free nail art"). */}
            <p className="text-[19px] font-bold">{reward.title}</p>
            <p className="text-base text-kiosk-muted">
              After {reward.cost} visit{reward.cost === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      )}
      {content.birthday && (
        <div className="flex items-center gap-4">
          <div className="flex size-12 flex-none items-center justify-center rounded-2xl bg-kiosk-line">
            <Cake className="size-6 text-kiosk-accent" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[19px] font-bold">Birthday {content.birthday.percent}% off</p>
            <p className="text-base text-kiosk-muted">Once a year, {birthdayWindowLabel(content.birthday.windowDays)}.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function EnterScreen(props: {
  digits: string;
  error: string | null;
  content: KioskContent;
  pending: boolean;
  onDigit: (d: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  onContinue: () => void;
}) {
  const { typed, rest } = fillPhoneMask(props.digits);
  // A 0… number needs all 10 digits; overseas numbers 8 or more (see isCompleteNumber).
  const ready = isCompleteNumber(props.digits);
  // Unusual numbers are allowed; this just nudges people to double-check. Don't flag a "04…"
  // number that's simply still being typed (the sign-up screen warns if they stop short).
  const unusual =
    ready && !looksStandard(props.digits) && (props.digits.length >= 10 || !props.digits.startsWith("0"));

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-6 px-5 pt-6 pb-8 text-kiosk-ink sm:px-10 lg:gap-8 lg:px-16 lg:pt-8 lg:pb-10 lg:short:pt-4 lg:short:pb-6">
      {/* Landscape (lg and up): welcome on the left, keypad on the right. Narrower screens stack
          welcome, keypad, then the program card (the left column's children join the stack). */}
      <div className="flex min-h-0 flex-1 flex-col gap-8 lg:flex-row lg:gap-14">
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 max-lg:contents">
          <div className="flex flex-col gap-3 max-lg:order-1 max-lg:items-center max-lg:text-center lg:gap-5 lg:pt-4 lg:short:pt-0">
            <p className="text-[15px] font-bold tracking-[0.14em] text-kiosk-accent uppercase">Rewards check-in</p>
            <h1 className="text-[36px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[48px] lg:text-[60px] lg:short:text-[52px]">
              Welcome in.
              <br />
              Earn a point every visit.
            </h1>
            <p className="max-w-[440px] text-lg leading-normal text-kiosk-muted max-sm:hidden sm:text-[22px]">
              Type your phone number to check in and see your rewards.
            </p>
          </div>

          <div className="flex flex-col gap-4 max-lg:order-3 max-lg:mx-auto max-lg:w-full max-lg:max-w-[500px]">
            <ProgramCard content={props.content} />
            <p className="text-sm text-kiosk-faint">We only use your number for Best Nails rewards.</p>
          </div>
        </div>

        <div className="flex w-full max-w-[500px] flex-none flex-col gap-4 max-lg:order-2 max-lg:self-center lg:w-[500px]">
          {/* The instruction sits right above the box the number goes into. */}
          <label htmlFor="phone" className="text-center text-[22px] font-bold short:text-xl">
            Enter your phone number
          </label>
          <div className="flex flex-none flex-col items-center gap-2 rounded-3xl bg-kiosk-surface px-7 py-5 text-center short:py-3.5">
            <output
              id="phone"
              aria-live="polite"
              aria-label={props.digits ? `Phone number ${props.digits.split("").join(" ")}` : "Phone number, empty"}
              className="text-[34px] font-bold tracking-[0.02em] whitespace-pre tabular-nums sm:text-[46px] lg:short:text-[40px]"
            >
              <span>{typed}</span>
              <span className="text-kiosk-placeholder">{rest}</span>
            </output>
            {/* One line is always kept for a message, so the keypad below never moves under a finger. */}
            <div className="flex min-h-6 items-center justify-center">
              {props.error ? (
                <p role="alert" className="text-base font-bold text-kiosk-notice">
                  {props.error}
                </p>
              ) : (
                unusual && (
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-kiosk-notice">
                    <TriangleAlert className="size-4 flex-none" aria-hidden="true" />
                    Not a standard Australian number. You can still continue.
                  </p>
                )
              )}
            </div>
          </div>

          <Numpad onDigit={props.onDigit} onClear={props.onClear} onBackspace={props.onBackspace} />

          <button
            type="button"
            onClick={props.onContinue}
            disabled={!ready || props.pending}
            className={`${primaryButton} h-16 flex-none text-[24px] sm:h-23 sm:text-[26px] lg:short:h-18 disabled:bg-kiosk-line disabled:bg-none disabled:text-kiosk-faint disabled:opacity-100`}
          >
            {props.pending ? <Spinner /> : null}
            Continue
            {!props.pending && <ArrowRight className="size-7" strokeWidth={2.5} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

function BirthdayNote({ birthday, percent }: { birthday: KioskBirthday; percent: number | undefined }) {
  if (!percent || (!birthday.eligible && !birthday.used)) return null;
  return (
    <div className="flex items-center gap-4 rounded-3xl border-2 border-kiosk-accent/60 px-6 py-5">
      <Cake className="size-9 flex-none text-kiosk-accent" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        {birthday.eligible ? (
          <>
            <p className="text-xl font-extrabold">Happy birthday! {percent}% off is waiting.</p>
            <p className="text-base text-kiosk-muted">Check in, then redeem it on the next screen.</p>
          </>
        ) : (
          <>
            <p className="text-xl font-extrabold">Happy birthday!</p>
            <p className="text-base text-kiosk-muted">Your birthday discount has been used this year.</p>
          </>
        )}
      </div>
    </div>
  );
}

export function FoundScreen({
  customer,
  content,
  pending,
  onCheckIn,
  onStartOver,
  onDone,
  redeem,
}: {
  customer: KioskCustomer;
  content: KioskContent;
  pending: boolean;
  onCheckIn: () => void;
  onStartOver: () => void;
  onDone: () => void;
  redeem: RedeemProps;
}) {
  const reward = mainReward(content.rewards);
  const ready = reward && customer.points >= reward.cost;
  // Already checked in today: they've come back (usually at the till) to redeem, so skip the
  // check-in and go straight to what they can use, or say they're all set.
  const returning = customer.checkedInAt !== null;
  const options = returning ? redeemOptions(customer.points, customer.birthday, redeem, customer.discountUsedToday) : [];
  const checkedInTime =
    customer.checkedInAt && new Date(customer.checkedInAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: content.timezone });

  if (returning) {
    return (
      <Shell>
        {/* One decision, one column: redeem or not, or "all set". */}
        <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-7">
          <StepBack label="Not you? Start over" onClick={onStartOver} />
          <div className="flex flex-1 flex-col items-center justify-center gap-7 pb-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg text-kiosk-muted tabular-nums">{customer.maskedPhone}</p>
              <h1 className="text-[36px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[48px] lg:text-[56px]">
                Welcome back, {customer.firstName}!
              </h1>
              <p className="flex flex-wrap items-center justify-center gap-x-2 text-lg text-kiosk-muted">
                <span className="flex items-center gap-1.5 font-semibold text-kiosk-ready">
                  <Check className="size-5" strokeWidth={2.6} aria-hidden="true" />
                  Checked in today at {checkedInTime}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <span className="font-bold text-kiosk-ink tabular-nums">{customer.points}</span> point{customer.points === 1 ? "" : "s"}
                </span>
              </p>
            </div>

            {options.length > 0 ? (
              <>
                <RedeemList options={options} pending={redeem.pending} error={redeem.error} onRedeem={redeem.onRedeem} />
                <button type="button" onClick={onDone} className={`${outlineButton} min-h-16 justify-center px-9 text-xl text-kiosk-ink`}>
                  No thanks, I&apos;m done
                </button>
              </>
            ) : customer.discountUsedToday ? (
              <>
                <div className="flex flex-col items-center gap-3 rounded-3xl bg-kiosk-surface px-8 py-7">
                  <div className="flex size-16 items-center justify-center rounded-full bg-kiosk-accent">
                    <Gift className="size-8 text-kiosk-bg" strokeWidth={2.2} aria-hidden="true" />
                  </div>
                  <p className="text-2xl font-extrabold">You&apos;ve had today&apos;s discount</p>
                  <p className="text-lg text-kiosk-muted">
                    {customer.points > 0
                      ? `${customer.points} point${customer.points === 1 ? "" : "s"} saved for your next visit · one discount per visit`
                      : "One discount per visit. See you next time!"}
                  </p>
                </div>
                <button type="button" onClick={onDone} className={`${primaryButton} min-h-16 min-w-64 px-11 text-2xl`}>
                  Done
                </button>
              </>
            ) : (
              <>
                {reward && (
                  <div className="flex flex-col items-center gap-3 rounded-3xl bg-kiosk-surface px-8 py-7">
                    <PunchCard points={customer.points} cost={reward.cost} size="md" />
                    <p className="text-lg text-kiosk-muted">{visitsToGo(customer.points, reward)}</p>
                  </div>
                )}
                <p className="text-xl text-kiosk-muted">You&apos;re all checked in for today. See you next time!</p>
                <button type="button" onClick={onDone} className={`${primaryButton} min-h-16 min-w-64 px-11 text-2xl`}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <StepBack label="Not you? Start over" onClick={onStartOver} />
            <div className="flex flex-col gap-1">
              <p className="text-lg text-kiosk-muted tabular-nums">{customer.maskedPhone}</p>
              <h1 className="text-[36px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[48px] lg:text-[56px]">Welcome back, {customer.firstName}!</h1>
            </div>
          </div>

          <section className="flex flex-col gap-5 rounded-3xl bg-kiosk-surface px-5 py-5 sm:px-8 sm:py-7">
            <div className="flex items-end gap-8 sm:gap-12">
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-kiosk-muted">Your points</p>
                <p className="text-[56px] leading-none font-extrabold tracking-[-0.03em] text-kiosk-accent tabular-nums sm:text-[72px]">
                  {customer.points}
                </p>
              </div>
              <div className="flex flex-col gap-1 pb-1.5">
                <p className="text-base font-semibold text-kiosk-muted">Visits</p>
                <p className="text-[40px] leading-none font-extrabold tabular-nums">{customer.visits}</p>
              </div>
            </div>
            {reward && (
              <div className="flex flex-col gap-3">
                <PunchCard points={customer.points} cost={reward.cost} />
                {ready && !customer.discountUsedToday ? (
                  <p className="text-lg font-bold text-kiosk-ready">{reward.title} is ready. Check in, then redeem it.</p>
                ) : ready ? (
                  <p className="text-lg text-kiosk-muted">
                    {customer.points} point{customer.points === 1 ? "" : "s"} saved for your next visit.
                  </p>
                ) : (
                  <p className="text-lg text-kiosk-muted">{visitsToGo(customer.points, reward)}</p>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="flex w-full flex-none flex-col justify-end gap-5 lg:w-[380px]">
          <BirthdayNote birthday={customer.birthday} percent={content.birthday?.percent} />
          <button type="button" onClick={onCheckIn} disabled={pending} className={`${primaryButton} h-26 flex-none text-3xl`}>
            {pending ? <Spinner /> : <Check className="size-8" strokeWidth={2.6} aria-hidden="true" />}
            Check in
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const fieldClass =
  "h-18 rounded-[18px] border-2 border-kiosk-line bg-kiosk-surface px-5.5 text-[26px] font-semibold text-kiosk-ink outline-none placeholder:text-kiosk-placeholder focus:border-kiosk-accent";

/** What joining gets you: the reward and the birthday discount. Hidden when the shop offers neither. */
function ProgramLines({ content }: { content: KioskContent }) {
  const reward = mainReward(content.rewards);
  if (!reward && !content.birthday) return null;
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-kiosk-surface p-6.5">
      <p className="text-[15px] font-bold tracking-[0.12em] text-kiosk-muted uppercase">How it works</p>
      <ul className="flex flex-col gap-2 text-lg leading-snug">
        {reward && (
          <li>
            <span className="font-bold text-kiosk-accent">{reward.title}</span> after {reward.cost} visit{reward.cost === 1 ? "" : "s"}
          </li>
        )}
        {content.birthday && (
          <li>
            <span className="font-bold text-kiosk-accent">{content.birthday.percent}% off</span>{" "}
            {birthdayWindowLabel(content.birthday.windowDays)}
          </li>
        )}
      </ul>
    </div>
  );
}

export function SignupScreen({
  formattedPhone,
  nonStandard,
  content,
  pending,
  initial,
  onSubmit,
  onBack,
}: {
  formattedPhone: string;
  nonStandard: boolean;
  content: KioskContent;
  pending: boolean;
  /** What they typed before going on to the services step and coming back. */
  initial?: SignupInput;
  onSubmit: (input: SignupInput) => void;
  onBack: () => void;
}) {
  // Each problem shows under the field it's about, so customers see what to fix.
  const [error, setError] = useState<{ field: "firstName" | "birthday"; message: string } | null>(null);
  // The day list only offers days the chosen month has (29 Feb included), so an impossible date
  // like 31 February can't be picked; changing to a shorter month clears a day it doesn't have.
  const [bdayDay, setBdayDay] = useState(initial?.birthdayDay ? String(initial.birthdayDay) : "");
  const [bdayMonth, setBdayMonth] = useState(initial?.birthdayMonth ? String(initial.birthdayMonth) : "");
  const maxDay = bdayMonth ? daysInMonth(Number(bdayMonth)) : 31;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const firstName = String(form.get("firstName") ?? "").trim();
    if (!firstName) {
      setError({ field: "firstName", message: "Please enter your first name." });
      return;
    }
    const month = bdayMonth;
    const day = bdayDay;
    if (Boolean(month) !== Boolean(day)) {
      setError({ field: "birthday", message: "Please pick both the day and the month of your birthday, or leave both blank." });
      return;
    }
    onSubmit({
      firstName,
      lastName: String(form.get("lastName") ?? "").trim() || undefined,
      birthdayMonth: month && day ? Number(month) : undefined,
      birthdayDay: month && day ? Number(day) : undefined,
    });
  };

  return (
    <Shell>
      {/* The form sits at the top so the on-screen keyboard never covers it. */}
      <form onSubmit={submit} className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <StepBack label="Wrong number? Go back" onClick={onBack} />
            <h1 className="text-[36px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px] lg:text-[52px]">Nice to meet you!</h1>
            <p className="text-xl text-kiosk-muted">{formattedPhone} isn&apos;t in our rewards yet. Join in a few seconds.</p>
            {nonStandard && (
              <p className="flex items-center gap-2.5 text-lg font-semibold text-kiosk-notice">
                <TriangleAlert className="size-5.5 flex-none" aria-hidden="true" />
                This isn&apos;t a standard Australian number. Please check it, or go back to fix it.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="firstName" className="text-base font-bold">
                First name <span className="text-kiosk-accent">*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                autoFocus
                maxLength={50}
                defaultValue={initial?.firstName}
                aria-invalid={error?.field === "firstName" || undefined}
                aria-describedby={error?.field === "firstName" ? "firstName-error" : undefined}
                onChange={() => error?.field === "firstName" && setError(null)}
                className={`${fieldClass} ${error?.field === "firstName" ? "border-kiosk-notice" : ""}`}
              />
              {error?.field === "firstName" && (
                <p id="firstName-error" role="alert" className="text-lg font-bold text-kiosk-notice">
                  {error.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="lastName" className="text-base font-bold">
                Last name <span className="font-medium text-kiosk-muted">(optional)</span>
              </label>
              <input id="lastName" name="lastName" autoComplete="family-name" maxLength={50} defaultValue={initial?.lastName} className={fieldClass} />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-base font-bold">
              Birthday{" "}
              <span className="font-medium text-kiosk-muted">
                {content.birthday ? `(optional, for ${content.birthday.percent}% off on your birthday)` : "(optional)"}
              </span>
            </legend>
            <div className="flex gap-3.5">
              <select
                name="birthdayDay"
                aria-label="Birthday day"
                value={bdayDay}
                onChange={(e) => {
                  setBdayDay(e.target.value);
                  if (error?.field === "birthday") setError(null);
                }}
                className={`${fieldClass} w-32 text-2xl sm:w-40`}
              >
                <option value="">Day</option>
                {Array.from({ length: maxDay }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select
                name="birthdayMonth"
                aria-label="Birthday month"
                value={bdayMonth}
                onChange={(e) => {
                  const month = e.target.value;
                  setBdayMonth(month);
                  if (error?.field === "birthday") setError(null);
                  if (month && Number(bdayDay) > daysInMonth(Number(month))) setBdayDay("");
                }}
                className={`${fieldClass} min-w-0 flex-1 text-2xl sm:w-60 sm:flex-none`}
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {error?.field === "birthday" && (
              <p role="alert" className="text-lg font-bold text-kiosk-notice">
                {error.message}
              </p>
            )}
          </fieldset>
        </div>

        <div className="flex w-full flex-none flex-col gap-4.5 lg:w-[360px] lg:pt-1.5">
          <ProgramLines content={content} />
          <button type="submit" disabled={pending} className={`${primaryButton} h-26 text-[28px]`}>
            {pending && <Spinner />}
            Join &amp; check in
          </button>
          <p className="text-sm leading-normal text-kiosk-faint">By joining you agree to the Best Nails rewards terms.</p>
        </div>
      </form>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

/**
 * The frame both visit steps share: back pill and heading at the top, the choices in the middle
 * (the page scrolls), and Skip / the main button pinned to the bottom so they're always in reach.
 */
function PickStep({
  title,
  subtitle,
  onBack,
  children,
  skipLabel,
  nextLabel,
  canNext,
  pending,
  onSkip,
  onNext,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
  skipLabel: string;
  nextLabel: React.ReactNode;
  canNext: boolean;
  pending: boolean;
  onSkip: () => void;
  onNext: () => void;
}) {
  return (
    <main className="flex w-full flex-1 flex-col text-kiosk-ink">
      <div className="flex flex-1 flex-col gap-7 px-5 pt-6 pb-8 sm:px-10 sm:pt-8 lg:px-16 lg:pt-10 short:gap-5 lg:short:pt-6">
        <div className="flex flex-col gap-3">
          <StepBack label="Back" onClick={onBack} />
          <h1 className="text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px] lg:text-[52px] lg:short:text-[44px]">{title}</h1>
          <p className="text-lg text-kiosk-muted sm:text-xl">{subtitle}</p>
        </div>
        <div className="mt-5 short:mt-2">{children}</div>
      </div>
      <div className="sticky bottom-0 bg-linear-to-t from-kiosk-bg from-70% to-transparent px-5 pt-8 pb-6 sm:px-10 lg:px-16 lg:short:pb-4">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
          <button
            type="button"
            onClick={onSkip}
            disabled={pending}
            className={`${outlineButton} h-18 justify-center bg-kiosk-bg text-xl disabled:opacity-60 lg:short:h-16`}
          >
            {skipLabel}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext || pending}
            className={`${primaryButton} h-18 text-2xl disabled:bg-kiosk-line disabled:bg-none disabled:text-kiosk-faint disabled:opacity-100 lg:short:h-16`}
          >
            {pending && <Spinner />}
            {nextLabel}
            {!pending && <ArrowRight className="size-6.5" strokeWidth={2.5} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </main>
  );
}

/**
 * A tappable choice as wide as its text, so a row of them reads like a menu. A picked one gets a
 * gold edge on a soft gold wash; nothing is added inside it, so picking never changes its width or
 * moves the chips around it.
 */
function ChoiceChip({
  selected,
  onClick,
  children,
  role = "checkbox",
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  role?: "checkbox" | "radio";
  className?: string;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={`group flex min-h-16 max-w-full items-center gap-3 rounded-2xl border-2 px-6 text-left text-xl font-semibold transition-colors active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kiosk-ink ${
        selected
          ? "border-kiosk-accent bg-kiosk-accent/12 text-kiosk-ink"
          : "border-transparent bg-kiosk-surface text-kiosk-ink hover:border-kiosk-line"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function ServicesScreen({
  categories,
  selected,
  isLast,
  pending,
  onToggle,
  onBack,
  onSkip,
  onNext,
}: {
  categories: KioskServiceCategory[];
  selected: string[];
  /** No staff step follows, so the main button checks in. */
  isLast: boolean;
  pending: boolean;
  onToggle: (id: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
}) {
  const count = selected.length;
  return (
    <PickStep
      title="What are you in for today?"
      subtitle="Pick as many as you like."
      onBack={onBack}
      skipLabel={isLast ? "Skip & check in" : "Skip"}
      nextLabel={
        <>
          {isLast ? "Check in" : "Next"}
          {count > 0 && (
            <>
              <span aria-hidden="true" className="font-bold opacity-75">
                · {count}
              </span>
              <span className="sr-only">({count} selected)</span>
            </>
          )}
        </>
      }
      canNext={count > 0}
      pending={pending}
      onSkip={onSkip}
      onNext={onNext}
    >
      <div className="flex flex-col gap-10 short:gap-8">
        {categories.map((c) => (
          <section key={c.id} aria-labelledby={`cat-${c.id}`} className="flex flex-col gap-4">
            <h2 id={`cat-${c.id}`} className="font-heading text-[32px] leading-none font-bold text-kiosk-accent">
              {c.name}
            </h2>
            <div className="flex flex-wrap gap-3.5">
              {c.services.map((s) => (
                <ChoiceChip key={s.id} selected={selected.includes(s.id)} onClick={() => onToggle(s.id)}>
                  {s.name}
                </ChoiceChip>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PickStep>
  );
}

export function StaffScreen({
  technicians,
  selected,
  pending,
  onSelect,
  onBack,
  onSkip,
  onNext,
}: {
  technicians: KioskTechnician[];
  selected: string | null;
  pending: boolean;
  onSelect: (id: string | null) => void;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
}) {
  return (
    <PickStep
      title="Who's looking after you?"
      subtitle="Pick your nail technician, or skip if you don't mind."
      onBack={onBack}
      skipLabel="Skip & check in"
      nextLabel="Check in"
      canNext={selected !== null}
      pending={pending}
      onSkip={onSkip}
      onNext={onNext}
    >
      <div role="radiogroup" aria-label="Nail technician" className="flex flex-wrap gap-3.5">
        {technicians.map((t) => (
          <ChoiceChip
            key={t.id}
            role="radio"
            selected={selected === t.id}
            onClick={() => onSelect(selected === t.id ? null : t.id)}
            className="min-h-20 gap-4 pr-8 pl-4"
          >
            <span
              aria-hidden="true"
              className="flex size-12 flex-none items-center justify-center rounded-full bg-kiosk-line font-heading text-2xl font-bold text-kiosk-accent group-aria-checked:bg-kiosk-accent/25"
            >
              {t.name.trim().charAt(0).toUpperCase()}
            </span>
            {t.name}
          </ChoiceChip>
        ))}
      </div>
    </PickStep>
  );
}

// ---------------------------------------------------------------------------

/** Counts down and calls onDone at zero. Pass null to pause (e.g. while something can be redeemed). */
function useCountdown(seconds: number | null, onDone: () => void) {
  const [left, setLeft] = useState(seconds ?? 0);
  useEffect(() => {
    if (seconds === null) return;
    if (left <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, seconds, onDone]);
  return left;
}

export type RedeemProps = {
  rewards: KioskReward[];
  birthdayPercent: number | undefined;
  pending: boolean;
  error: string | null;
  onRedeem: (target: RedeemTarget) => void;
};

type Option = { key: string; title: string; detail: string; target: RedeemTarget; birthday: boolean };

function redeemOptions(points: number, birthday: KioskBirthday, { rewards, birthdayPercent }: RedeemProps, discountUsedToday = false): Option[] {
  const options: Option[] = [];
  // One discount per visit: nothing more to offer once today's has been used.
  if (discountUsedToday) return options;
  if (birthday.eligible && birthdayPercent) {
    options.push({
      key: "birthday",
      title: `Birthday ${birthdayPercent}% off`,
      detail: "Our gift to you. No points needed",
      target: { kind: "birthday" },
      birthday: true,
    });
  }
  for (const r of rewards.filter((r) => r.cost <= points)) {
    options.push({
      key: r.id,
      title: r.title,
      detail: `Uses ${r.cost} of your ${points} points`,
      target: { kind: "reward", rewardId: r.id },
      birthday: false,
    });
  }
  return options;
}

/** What the customer can redeem right now, each with a two-step "Redeem → Yes" confirm. */
function RedeemList({ options, pending, error, onRedeem }: { options: Option[] } & Pick<RedeemProps, "pending" | "error" | "onRedeem">) {
  const [confirming, setConfirming] = useState<string | null>(null);
  if (options.length === 0) return null;

  return (
    <section
      aria-label="Rewards you can redeem"
      className="flex w-full max-w-[720px] flex-col gap-3 rounded-3xl bg-kiosk-surface p-5 text-left"
    >
      <h2 className="text-xl font-extrabold">Ready to redeem today</h2>
      <ul className="flex flex-col gap-2.5">
        {options.map((o) => (
          <li key={o.key} className="flex min-h-18 flex-wrap items-center justify-between gap-4 rounded-2xl bg-kiosk-bg px-5 py-3">
            <div className="flex items-center gap-4">
              {o.birthday ? (
                <Cake className="size-7 flex-none text-kiosk-accent" aria-hidden="true" />
              ) : (
                <Gift className="size-7 flex-none text-kiosk-accent" aria-hidden="true" />
              )}
              <div className="flex flex-col">
                <span className="text-xl font-bold">{o.title}</span>
                <span className="text-[15px] text-kiosk-muted">{o.detail}</span>
              </div>
            </div>
            {confirming === o.key ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirming(null)} className={`${outlineButton} min-h-14 px-5`}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRedeem(o.target)}
                  className={`${primaryButton} min-h-14 rounded-2xl px-6 text-lg`}
                >
                  {pending && <Spinner />}
                  Yes, redeem
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(o.key)}
                className={`${primaryButton} min-h-14 rounded-2xl px-7 text-lg`}
              >
                Redeem
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-base font-bold text-kiosk-notice">
          {error}
        </p>
      )}
    </section>
  );
}

export function SuccessScreen({
  result,
  seconds,
  onDone,
  technician,
  paused = false,
  ...redeem
}: RedeemProps & {
  result: Extract<CheckInResult, { status: "checked_in" }>;
  seconds: number;
  onDone: () => void;
  /** The technician they picked, if any. */
  technician?: string;
  /** Hold the countdown, e.g. while staff use the Gift voucher dialog. */
  paused?: boolean;
}) {
  const options = redeemOptions(result.points, result.birthday, redeem, result.discountUsedToday);
  const canRedeem = options.length > 0;
  // Don't rush someone who is about to redeem; the idle timeout still applies.
  const left = useCountdown(canRedeem || paused ? null : seconds, onDone);
  const reward = mainReward(redeem.rewards);
  const earned = result.pointsAwarded;

  return (
    <Shell centered>
      <div className={`flex items-center justify-center rounded-full bg-kiosk-accent ${canRedeem ? "size-20" : "size-30"}`}>
        <Check className={`text-kiosk-bg ${canRedeem ? "size-10" : "size-15"}`} strokeWidth={2.6} aria-hidden="true" />
      </div>
      <div className="flex flex-col items-center gap-3">
        <h1
          className={`leading-[1.05] font-extrabold tracking-[-0.03em] ${canRedeem ? "text-[34px] sm:text-[48px]" : "text-[38px] sm:text-[48px] lg:text-[60px]"}`}
          role="status"
        >
          You&apos;re checked in, {result.firstName}!
        </h1>
        {!canRedeem && (
          <p className="text-xl text-kiosk-muted sm:text-2xl">
            Have a seat. {technician ? `${technician} will` : "We'll"} be with you shortly.
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 rounded-3xl bg-kiosk-surface px-6 py-6 sm:px-10">
        <p className="text-xl">
          <span className="font-extrabold text-kiosk-accent">
            +{earned} point{earned === 1 ? "" : "s"}
          </span>
          <span className="text-kiosk-muted"> · you now have </span>
          <span className="font-extrabold tabular-nums">{result.points}</span>
        </p>
        {reward && result.points < reward.cost && (
          <>
            <PunchCard points={result.points} cost={reward.cost} size="md" />
            <p className="text-lg text-kiosk-muted">{visitsToGo(result.points, reward)}</p>
          </>
        )}
      </div>

      <RedeemList options={options} pending={redeem.pending} error={redeem.error} onRedeem={redeem.onRedeem} />

      <button type="button" onClick={onDone} className={`${outlineButton} min-h-16 px-9 text-xl text-kiosk-ink`}>
        {canRedeem ? "No thanks, I'm done" : "Done"}
        {!canRedeem && <span className="font-medium text-kiosk-muted">· closing in {left}s</span>}
      </button>
    </Shell>
  );
}

export function AlreadyScreen({
  result,
  timezone,
  onDone,
  ...redeem
}: RedeemProps & {
  result: Extract<CheckInResult, { status: "already_checked_in" }>;
  timezone: string;
  onDone: () => void;
}) {
  const time = new Date(result.lastCheckInAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: timezone });
  const options = redeemOptions(result.points, result.birthday, redeem, result.discountUsedToday);
  const canRedeem = options.length > 0;
  return (
    <Shell centered>
      {/* Not an error: they're simply checked in already. A calm tick, not a warning. */}
      {!canRedeem && (
        <div className="flex size-28 items-center justify-center rounded-full border-3 border-kiosk-accent">
          <Check className="size-14 text-kiosk-accent" strokeWidth={2.4} aria-hidden="true" />
        </div>
      )}
      <div className="flex max-w-[760px] flex-col items-center gap-3.5">
        <h1
          className={`leading-[1.08] font-extrabold tracking-[-0.03em] ${canRedeem ? "text-[32px] sm:text-[44px]" : "text-[36px] sm:text-[48px] lg:text-[56px]"}`}
        >
          {canRedeem ? `Welcome back, ${result.firstName}!` : `You're all checked in for today, ${result.firstName}`}
        </h1>
        <p className="text-lg leading-normal text-kiosk-muted sm:text-[22px]">
          You checked in at {time} and have{" "}
          <span className="font-bold text-kiosk-ink">
            {result.points} point{result.points === 1 ? "" : "s"}
          </span>
          .{result.discountUsedToday && " You've had today's discount, one per visit."}
        </p>
      </div>
      <RedeemList options={options} pending={redeem.pending} error={redeem.error} onRedeem={redeem.onRedeem} />
      <button type="button" onClick={onDone} className={`${canRedeem ? outlineButton : primaryButton} min-h-18 px-11 text-2xl`}>
        {canRedeem ? "No thanks, I'm done" : "OK, got it"}
      </button>
      {!canRedeem && <p className="text-base text-kiosk-faint">Something wrong? Ask the front desk.</p>}
    </Shell>
  );
}

export function RedeemedScreen({
  result,
  timezone,
  onDone,
  paused = false,
}: {
  result: Extract<RedeemResult, { status: "redeemed" }>;
  timezone: string;
  onDone: () => void;
  paused?: boolean;
}) {
  // Long enough to walk the iPad over or call someone to the desk.
  const left = useCountdown(paused ? null : 60, onDone);
  const at = new Date(result.redeemedAt).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  const birthday = result.pointsSpent === 0;

  return (
    <Shell centered>
      <div className="flex size-30 items-center justify-center rounded-full bg-kiosk-ready">
        {birthday ? (
          <Cake className="size-15 text-kiosk-bg" strokeWidth={2.2} aria-hidden="true" />
        ) : (
          <Gift className="size-15 text-kiosk-bg" strokeWidth={2.2} aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="text-[15px] font-bold tracking-[0.14em] text-kiosk-ready uppercase">Redeemed</p>
        <h1 className="text-[38px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[48px] lg:text-[60px]" role="status">
          {result.title}
        </h1>
        <p className="text-xl text-kiosk-muted sm:text-2xl">Show this screen to the front desk when you pay.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-4 sm:gap-5">
        {!birthday && (
          <div className="flex min-w-40 flex-col gap-1.5 rounded-3xl bg-kiosk-surface px-6 py-5 sm:min-w-56 sm:px-10">
            <p className="text-base font-semibold text-kiosk-muted">Points used</p>
            <p className="text-[48px] leading-none font-extrabold tabular-nums">−{result.pointsSpent}</p>
          </div>
        )}
        <div className="flex min-w-40 flex-col gap-1.5 rounded-3xl bg-kiosk-surface px-6 py-5 sm:min-w-56 sm:px-10">
          <p className="text-base font-semibold text-kiosk-muted">Points left</p>
          <p className="text-[48px] leading-none font-extrabold tabular-nums">{result.points}</p>
        </div>
      </div>
      <p className="text-lg text-kiosk-muted tabular-nums">{at}</p>
      <button type="button" onClick={onDone} className={`${outlineButton} min-h-16 px-9 text-xl text-kiosk-ink`}>
        Done
        <span className="font-medium text-kiosk-muted">· closing in {left}s</span>
      </button>
    </Shell>
  );
}

export function ErrorScreen({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <Shell centered>
      <div className="flex size-32 items-center justify-center rounded-full bg-kiosk-surface">
        <WifiOff className="size-15 text-kiosk-muted" strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="flex max-w-[720px] flex-col items-center gap-3.5">
        <h1 className="text-[36px] leading-[1.08] font-extrabold tracking-[-0.03em] sm:text-[52px]" role="alert">
          Something went wrong
        </h1>
        <p className="text-lg leading-normal text-kiosk-muted sm:text-[22px]">
          {message} Please let the front desk know you&apos;re here. Your visit can still be added from the admin page.
        </p>
      </div>
      <button type="button" onClick={onDone} className={`${primaryButton} min-h-20 px-11 text-2xl`}>
        <RotateCw className="size-6.5" strokeWidth={2.4} aria-hidden="true" />
        Try again
      </button>
    </Shell>
  );
}
