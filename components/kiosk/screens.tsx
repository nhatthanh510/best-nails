"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Cake, Check, Clock, Gift, LoaderCircle, RotateCw, TriangleAlert, WifiOff } from "lucide-react";
import type { CheckInResult, KioskBirthday, KioskCustomer, RedeemResult, RedeemTarget, SignupInput } from "@/app/kiosk/actions";
import type { KioskContent, KioskReward } from "@/lib/kiosk-content";
import { birthdayWindowLabel } from "@/lib/rewards";
import { fillPhoneMask, looksStandard } from "@/lib/phone-mask";
import { KioskBrand } from "./brand";
import { Numpad } from "./numpad";

const primaryButton =
  "flex items-center justify-center gap-3 rounded-3xl bg-kiosk-accent bg-gold-sheen font-extrabold text-kiosk-bg transition-transform active:scale-[0.98] disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-kiosk-ink";
const outlineButton =
  "flex min-h-14 items-center gap-2.5 rounded-2xl border-2 border-kiosk-line px-6 text-lg font-bold text-kiosk-muted active:bg-kiosk-surface focus-visible:outline-3 focus-visible:outline-kiosk-accent";

function Shell({ children, centered = false }: { children: React.ReactNode; centered?: boolean }) {
  return (
    <main
      className={`flex min-h-dvh w-full bg-kiosk-bg text-kiosk-ink ${
        centered
          ? "flex-col items-center justify-center gap-7 p-16 text-center short:gap-5 short:p-10"
          : "flex-col gap-8 px-16 py-12 short:gap-6 short:py-8"
      }`}
    >
      {children}
    </main>
  );
}

function Header({ action }: { action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <KioskBrand />
      {action}
    </div>
  );
}

function Spinner() {
  return <LoaderCircle className="size-7 animate-spin" aria-hidden="true" />;
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
  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] bg-kiosk-surface px-6 py-5">
      {reward && (
        <div className="flex items-center gap-4">
          <div className="flex size-12 flex-none items-center justify-center rounded-2xl bg-kiosk-line">
            <Gift className="size-6 text-kiosk-accent" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[19px] font-bold">
              {reward.cost} points = {reward.title}
            </p>
            <p className="text-base text-kiosk-muted">
              Every check-in earns {content.pointsPerVisit} point{content.pointsPerVisit === 1 ? "" : "s"}.
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
  minDigits: number;
  error: string | null;
  content: KioskContent;
  pending: boolean;
  onDigit: (d: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  onContinue: () => void;
}) {
  const { typed, rest } = fillPhoneMask(props.digits);
  const ready = props.digits.length >= props.minDigits;
  // Unusual numbers are allowed; this just nudges people to double-check. Don't flag a "04…"
  // number that's simply still being typed (the sign-up screen warns if they stop short).
  const unusual =
    ready && !looksStandard(props.digits) && (props.digits.length >= 10 || !props.digits.startsWith("0"));

  return (
    <main className="flex h-dvh min-h-[600px] w-full gap-14 bg-kiosk-bg px-16 py-14 text-kiosk-ink short:py-8">
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-6">
        <KioskBrand />

        <div className="flex flex-col gap-5">
          <p className="text-[15px] font-bold tracking-[0.14em] text-kiosk-accent uppercase">Rewards check-in</p>
          <h1 className="text-[60px] leading-[1.05] font-extrabold tracking-[-0.03em] short:text-[52px]">
            Welcome in.
            <br />
            Earn a point every visit.
          </h1>
          <p className="max-w-[440px] text-[22px] leading-normal text-kiosk-muted">
            Type your phone number to check in and see your rewards.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <ProgramCard content={props.content} />
          <p className="text-sm text-kiosk-faint">We only use your number for Best Nails rewards.</p>
        </div>
      </div>

      <div className="flex w-[500px] flex-none flex-col gap-5">
        <div className="flex flex-none flex-col gap-2 rounded-3xl bg-kiosk-surface px-7 py-6.5 short:py-4">
          <label htmlFor="phone" className="text-[15px] font-semibold text-kiosk-muted">
            Phone number
          </label>
          <output
            id="phone"
            aria-live="polite"
            aria-label={props.digits ? `Phone number ${props.digits.split("").join(" ")}` : "Phone number, empty"}
            className="text-[46px] font-bold tracking-[0.02em] whitespace-pre tabular-nums short:text-[40px]"
          >
            <span>{typed}</span>
            <span className="text-kiosk-placeholder">{rest}</span>
          </output>
          {props.error ? (
            <p role="alert" className="text-base font-bold text-kiosk-notice">
              {props.error}
            </p>
          ) : (
            unusual && (
              <p className="flex items-center gap-2 text-base font-semibold text-kiosk-notice">
                <TriangleAlert className="size-5 flex-none" aria-hidden="true" />
                Not a standard Australian number. You can still continue.
              </p>
            )
          )}
        </div>

        <Numpad onDigit={props.onDigit} onClear={props.onClear} onBackspace={props.onBackspace} />

        <button
          type="button"
          onClick={props.onContinue}
          disabled={!ready || props.pending}
          className={`${primaryButton} h-23 flex-none text-[26px] short:h-18 disabled:bg-kiosk-line disabled:bg-none disabled:text-kiosk-faint disabled:opacity-100`}
        >
          {props.pending ? <Spinner /> : null}
          Continue
          {!props.pending && <ArrowRight className="size-7" strokeWidth={2.5} aria-hidden="true" />}
        </button>
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
}: {
  customer: KioskCustomer;
  content: KioskContent;
  pending: boolean;
  onCheckIn: () => void;
  onStartOver: () => void;
}) {
  const reward = mainReward(content.rewards);
  const ready = reward && customer.points >= reward.cost;

  return (
    <Shell>
      <Header
        action={
          <button type="button" onClick={onStartOver} className={outlineButton}>
            <ArrowLeft className="size-5" strokeWidth={2.2} aria-hidden="true" />
            Not you? Start over
          </button>
        }
      />

      <div className="flex min-h-0 flex-1 gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-lg text-kiosk-muted tabular-nums">{customer.maskedPhone}</p>
            <h1 className="text-[56px] leading-[1.05] font-extrabold tracking-[-0.03em]">Welcome back, {customer.firstName}!</h1>
          </div>

          <section className="flex flex-col gap-5 rounded-3xl bg-kiosk-surface px-8 py-7">
            <div className="flex items-end gap-12">
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-kiosk-muted">Your points</p>
                <p className="text-[72px] leading-none font-extrabold tracking-[-0.03em] text-kiosk-accent tabular-nums">
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
                {ready ? (
                  <p className="text-lg font-bold text-kiosk-ready">{reward.title} is ready. Check in, then redeem it.</p>
                ) : (
                  <p className="text-lg text-kiosk-muted">{visitsToGo(customer.points, reward)}</p>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="flex w-[380px] flex-none flex-col justify-end gap-5">
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

function ProgramLines({ content }: { content: KioskContent }) {
  const reward = mainReward(content.rewards);
  return (
    <ul className="flex flex-col gap-2 text-lg leading-snug">
      <li>
        <span className="font-bold text-kiosk-accent">
          {content.pointsPerVisit} point{content.pointsPerVisit === 1 ? "" : "s"}
        </span>{" "}
        every visit
      </li>
      {reward && (
        <li>
          <span className="font-bold text-kiosk-accent">{reward.cost} points</span> = {reward.title}
        </li>
      )}
      {content.birthday && (
        <li>
          <span className="font-bold text-kiosk-accent">{content.birthday.percent}% off</span>{" "}
          {birthdayWindowLabel(content.birthday.windowDays)}
        </li>
      )}
    </ul>
  );
}

export function SignupScreen({
  formattedPhone,
  nonStandard,
  content,
  pending,
  onSubmit,
  onBack,
}: {
  formattedPhone: string;
  nonStandard: boolean;
  content: KioskContent;
  pending: boolean;
  onSubmit: (input: SignupInput) => void;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const firstName = String(form.get("firstName") ?? "").trim();
    if (!firstName) {
      setError("Please enter your first name.");
      return;
    }
    const month = String(form.get("birthdayMonth") ?? "");
    const day = String(form.get("birthdayDay") ?? "");
    onSubmit({
      firstName,
      lastName: String(form.get("lastName") ?? "").trim() || undefined,
      birthdayMonth: month && day ? Number(month) : undefined,
      birthdayDay: month && day ? Number(day) : undefined,
    });
  };

  return (
    <Shell>
      <Header
        action={
          <button type="button" onClick={onBack} className={outlineButton}>
            <ArrowLeft className="size-5" strokeWidth={2.2} aria-hidden="true" />
            Wrong number? Go back
          </button>
        }
      />

      {/* The form sits at the top so the on-screen keyboard never covers it. */}
      <form onSubmit={submit} className="flex items-start gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <h1 className="text-[52px] leading-[1.05] font-extrabold tracking-[-0.03em]">Nice to meet you!</h1>
            <p className="text-xl text-kiosk-muted">{formattedPhone} isn&apos;t in our rewards yet. Join in a few seconds.</p>
            {nonStandard && (
              <p className="flex items-center gap-2.5 text-lg font-semibold text-kiosk-notice">
                <TriangleAlert className="size-5.5 flex-none" aria-hidden="true" />
                This isn&apos;t a standard Australian number. Please check it, or go back to fix it.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4.5">
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
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "signup-error" : undefined}
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="lastName" className="text-base font-bold">
                Last name <span className="font-medium text-kiosk-muted">(optional)</span>
              </label>
              <input id="lastName" name="lastName" autoComplete="family-name" maxLength={50} className={fieldClass} />
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
              <select name="birthdayDay" aria-label="Birthday day" defaultValue="" className={`${fieldClass} w-40 text-2xl`}>
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select name="birthdayMonth" aria-label="Birthday month" defaultValue="" className={`${fieldClass} w-60 text-2xl`}>
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          {error && (
            <p id="signup-error" role="alert" className="text-lg font-bold text-kiosk-notice">
              {error}
            </p>
          )}
        </div>

        <div className="flex w-[360px] flex-none flex-col gap-4.5 pt-1.5">
          <div className="flex flex-col gap-3 rounded-3xl bg-kiosk-surface p-6.5">
            <p className="text-[15px] font-bold tracking-[0.12em] text-kiosk-muted uppercase">How it works</p>
            <ProgramLines content={content} />
          </div>
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

function redeemOptions(points: number, birthday: KioskBirthday, { rewards, birthdayPercent }: RedeemProps): Option[] {
  const options: Option[] = [];
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
          <li key={o.key} className="flex min-h-18 items-center justify-between gap-4 rounded-2xl bg-kiosk-bg px-5 py-3">
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
  ...redeem
}: RedeemProps & {
  result: Extract<CheckInResult, { status: "checked_in" }>;
  seconds: number;
  onDone: () => void;
}) {
  const options = redeemOptions(result.points, result.birthday, redeem);
  const canRedeem = options.length > 0;
  // Don't rush someone who is about to redeem; the idle timeout still applies.
  const left = useCountdown(canRedeem ? null : seconds, onDone);
  const reward = mainReward(redeem.rewards);
  const earned = result.pointsAwarded;

  return (
    <Shell centered>
      <div className={`flex items-center justify-center rounded-full bg-kiosk-accent ${canRedeem ? "size-20" : "size-30"}`}>
        <Check className={`text-kiosk-bg ${canRedeem ? "size-10" : "size-15"}`} strokeWidth={2.6} aria-hidden="true" />
      </div>
      <div className="flex flex-col items-center gap-3">
        <h1 className={`leading-[1.05] font-extrabold tracking-[-0.03em] ${canRedeem ? "text-[48px]" : "text-[60px]"}`} role="status">
          You&apos;re checked in, {result.firstName}!
        </h1>
        {!canRedeem && <p className="text-2xl text-kiosk-muted">Have a seat. We&apos;ll be with you shortly.</p>}
      </div>

      <div className="flex flex-col items-center gap-4 rounded-3xl bg-kiosk-surface px-10 py-6">
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
  const options = redeemOptions(result.points, result.birthday, redeem);
  const canRedeem = options.length > 0;
  return (
    <Shell centered>
      {!canRedeem && (
        <div className="flex size-32 items-center justify-center rounded-full border-3 border-kiosk-notice">
          <Clock className="size-15 text-kiosk-notice" strokeWidth={2.2} aria-hidden="true" />
        </div>
      )}
      <div className="flex max-w-[760px] flex-col items-center gap-3.5">
        <h1 className={`leading-[1.08] font-extrabold tracking-[-0.03em] ${canRedeem ? "text-[44px]" : "text-[56px]"}`}>
          You&apos;re already checked in, {result.firstName}
        </h1>
        <p className="text-[22px] leading-normal text-kiosk-muted">
          Points are added once per visit. You checked in at {time}, and you have{" "}
          <span className="font-bold text-kiosk-ink">
            {result.points} point{result.points === 1 ? "" : "s"}
          </span>
          .
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
}: {
  result: Extract<RedeemResult, { status: "redeemed" }>;
  timezone: string;
  onDone: () => void;
}) {
  // Long enough to walk the iPad over or call someone to the desk.
  const left = useCountdown(60, onDone);
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
        <h1 className="text-[60px] leading-[1.05] font-extrabold tracking-[-0.03em]" role="status">
          {result.title}
        </h1>
        <p className="text-2xl text-kiosk-muted">Show this screen to the front desk when you pay.</p>
      </div>
      <div className="flex gap-5">
        {!birthday && (
          <div className="flex min-w-56 flex-col gap-1.5 rounded-3xl bg-kiosk-surface px-10 py-5">
            <p className="text-base font-semibold text-kiosk-muted">Points used</p>
            <p className="text-[48px] leading-none font-extrabold tabular-nums">−{result.pointsSpent}</p>
          </div>
        )}
        <div className="flex min-w-56 flex-col gap-1.5 rounded-3xl bg-kiosk-surface px-10 py-5">
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
        <h1 className="text-[52px] leading-[1.08] font-extrabold tracking-[-0.03em]" role="alert">
          Something went wrong
        </h1>
        <p className="text-[22px] leading-normal text-kiosk-muted">
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
