'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Cake,
  Check,
  ChevronLeft,
  CircleAlert,
  CreditCard,
  Gift,
  LayoutGrid,
  LogOut,
  RotateCw,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import { Spinner as SharedSpinner } from '@/components/ui/spinner';
import type {
  CheckInResult,
  KioskBirthday,
  KioskCustomer,
  PaymentMethod,
  RedeemResult,
  RedeemTarget,
  SignupInput,
} from '@/app/kiosk/actions';
import type {
  KioskContent,
  KioskReward,
  KioskServiceCategory,
  KioskTechnician,
} from '@/lib/kiosk-content';
import { daysInMonth } from '@/lib/birthday';
import { cashBonusLine, hasCashBonus, rewardName } from '@/lib/rewards';
import {
  fillPhoneMask,
  isCompleteNumber,
  looksStandard,
} from '@/lib/phone-mask';
import Link from 'next/link';
import { KioskBrand } from './brand';
import { Numpad } from './numpad';

const primaryButton =
  'flex items-center justify-center gap-3 rounded-3xl bg-kiosk-accent bg-gold-sheen font-extrabold text-kiosk-bg transition active:scale-[0.98] enabled:hover:brightness-110 enabled:hover:shadow-[0_6px_24px_-6px_rgb(216_180_92/0.45)] disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-kiosk-ink';
const outlineButton =
  'flex min-h-14 items-center gap-2.5 rounded-2xl border-2 border-kiosk-line px-6 text-lg font-bold text-kiosk-muted transition-colors hover:border-kiosk-faint hover:bg-kiosk-surface hover:text-kiosk-ink active:bg-kiosk-surface focus-visible:outline-3 focus-visible:outline-kiosk-accent';

function Shell({
  children,
  centered = false,
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <main
      className={`flex min-h-0 w-full flex-1 text-kiosk-ink ${
        centered
          ? 'flex-col items-center justify-center gap-7 px-5 py-10 text-center sm:p-10 lg:p-16 short:gap-5 lg:short:p-10'
          : 'flex-col gap-8 px-5 py-6 sm:px-10 sm:py-8 lg:px-16 lg:py-10 short:gap-6 lg:short:py-6'
      }`}
    >
      {children}
    </main>
  );
}

const headerButton =
  'flex min-h-12 items-center gap-2 rounded-full px-4 text-base sm:px-5';

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
    <header className='flex-none px-5 pt-5 sm:px-10 sm:pt-8 lg:px-16 lg:short:pt-5'>
      <div className='flex items-center justify-between gap-3 border-b border-kiosk-line pb-5 short:pb-3'>
        <KioskBrand compactOnPhone />
        <div className='flex items-center gap-1'>
          {voucher}
          {isAdmin && (
            <Link
              href='/admin'
              className={`${headerButton} border border-kiosk-line font-bold text-kiosk-muted hover:text-kiosk-ink`}
            >
              <LayoutGrid className='size-5' aria-hidden='true' />
              <span className='max-sm:sr-only'>Admin</span>
            </Link>
          )}
          <button
            type='button'
            onClick={onSignOut}
            className={`${headerButton} font-semibold text-kiosk-faint hover:text-kiosk-muted`}
          >
            <LogOut className='size-5' aria-hidden='true' />
            <span className='max-sm:sr-only'>Sign out</span>
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
      type='button'
      onClick={onClick}
      className='flex min-h-12 w-fit items-center gap-1.5 rounded-full border-2 border-kiosk-line pr-5 pl-3 text-base font-bold text-kiosk-muted hover:text-kiosk-ink active:bg-kiosk-surface focus-visible:outline-3 focus-visible:outline-kiosk-accent'
    >
      <ChevronLeft className='size-5' strokeWidth={2.4} aria-hidden='true' />
      {label}
    </button>
  );
}

function Spinner() {
  return <SharedSpinner className='size-7' />;
}

/** The main reward (cheapest active one): what the punch card counts towards. */
function mainReward(rewards: KioskReward[]) {
  return rewards[0] ?? null;
}

function visitsToGo(points: number, reward: KioskReward) {
  const n = reward.cost - points;
  // A cash-bonus reward's amount depends on how they pay, so CashProgress says what it'll be.
  const to = hasCashBonus(reward) ? 'your reward' : reward.title;
  return `${n} more visit${n === 1 ? '' : 's'} to ${to}`;
}

/** One stamp per point towards the reward, e.g. 7 of 10 filled. */
function PunchCard({
  points,
  cost,
  size = 'lg',
}: {
  points: number;
  cost: number;
  size?: 'lg' | 'md';
}) {
  const filled = Math.min(points, cost);
  const dot = size === 'lg' ? 'size-12' : 'size-10';
  return (
    <div
      role='img'
      aria-label={`${filled} of ${cost} stamps`}
      className='flex flex-wrap gap-2.5'
    >
      {Array.from({ length: cost }, (_, i) => {
        const on = i < filled;
        const last = i === cost - 1;
        return (
          <span
            key={i}
            className={`flex ${dot} items-center justify-center rounded-full ${
              on
                ? 'bg-kiosk-accent text-kiosk-bg'
                : 'border-2 border-dashed border-kiosk-line text-kiosk-placeholder'
            }`}
          >
            {on ? (
              <Check className='size-6' strokeWidth={3} aria-hidden='true' />
            ) : last ? (
              <Gift className='size-5' aria-hidden='true' />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Where they are on a reward that gives more for cash, as plain information (it never tells them
 * how to pay): "4 of 7 visits paid in cash · $30 off at 7", "$30 off unlocked", or, when this
 * round can no longer reach it, "$10 off this round". Nothing for other rewards.
 */
function CashProgress({
  reward,
  cashVisits,
  points,
}: {
  reward: KioskReward;
  cashVisits: number;
  points: number;
}) {
  if (!hasCashBonus(reward)) return null;
  const n = Math.min(cashVisits, reward.cost);
  const done = cashVisits >= reward.cost;
  // Visits left this round (before the points are spent) can't make up the cash visits.
  const reachable =
    cashVisits + Math.max(0, reward.cost - points) >= reward.cost;
  const cash = rewardName(reward, reward.cost);
  const other = rewardName(reward, 0);
  // The amount leads; how they got there is the small line under it.
  const amount = done || reachable ? cash : other;
  const label = done
    ? 'unlocked'
    : reachable
      ? `with ${reward.cost} cash visits`
      : 'this round';
  return (
    <div className='flex w-fit items-center gap-3.5 rounded-2xl bg-kiosk-bg px-4 py-3 text-left'>
      <span className='flex size-11 flex-none items-center justify-center rounded-full bg-kiosk-line'>
        <Banknote className='size-5.5 text-kiosk-accent' aria-hidden='true' />
      </span>
      <div className='flex flex-col'>
        <p className='text-lg leading-tight'>
          <span className='text-2xl font-extrabold text-kiosk-accent tabular-nums'>
            {amount}
          </span>{' '}
          <span className='font-semibold text-kiosk-ink'>{label}</span>
        </p>
        <p className='text-base text-kiosk-muted'>
          <span className='font-bold text-kiosk-ink tabular-nums'>
            {n} of {reward.cost}
          </span>{' '}
          visits paid in cash
        </p>
      </div>
    </div>
  );
}

function ProgramCard({ content }: { content: KioskContent }) {
  const reward = mainReward(content.rewards);
  // A shop with no reward yet and the birthday discount off has nothing to advertise.
  if (!reward && !content.birthday) return null;
  return (
    <div className='flex flex-col gap-3.5 rounded-[20px] bg-kiosk-surface px-6 py-5'>
      {reward && (
        <div className='flex items-start gap-4'>
          <div className='flex size-12 flex-none items-center justify-center rounded-2xl bg-kiosk-line'>
            <Gift className='size-6 text-kiosk-accent' aria-hidden='true' />
          </div>
          <div className='flex min-h-12 flex-col justify-center gap-0.5'>
            {/* The reward's own name leads, whatever the shop calls it ("10% off", "Free nail art"). */}
            <p className='text-[19px] font-bold'>{reward.title}</p>
            <p className='text-base text-kiosk-muted'>
              {cashBonusLine(reward) ??
                `After ${reward.cost} visit${reward.cost === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
      )}
      {content.birthday && (
        <div className='flex items-start gap-4'>
          <div className='flex size-12 flex-none items-center justify-center rounded-2xl bg-kiosk-line'>
            <Cake className='size-6 text-kiosk-accent' aria-hidden='true' />
          </div>
          <div className='flex min-h-12 flex-col justify-center gap-0.5'>
            <p className='text-[19px] font-bold'>
              {content.birthday.pitch.headline}
            </p>
            {content.birthday.pitch.nudge && (
              <p className='text-base text-kiosk-muted'>
                {content.birthday.pitch.nudge}
              </p>
            )}
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
    ready &&
    !looksStandard(props.digits) &&
    (props.digits.length >= 10 || !props.digits.startsWith('0'));

  return (
    <main className='flex min-h-0 w-full flex-1 flex-col gap-6 px-5 pt-6 pb-8 text-kiosk-ink sm:px-10 lg:gap-8 lg:px-16 lg:pt-8 lg:pb-10 lg:short:pt-4 lg:short:pb-6'>
      {/* Landscape (lg and up): welcome on the left, keypad on the right. Narrower screens stack
          welcome, keypad, then the program card (the left column's children join the stack). */}
      {/* On a tall screen (an iPad in portrait is still lg wide) it stays the landscape size,
          centred, rather than stretching the keypad. */}
      <div className='flex min-h-0 flex-1 flex-col gap-8 lg:my-auto lg:max-h-[720px] lg:flex-row lg:gap-14'>
        <div className='flex min-w-0 flex-1 flex-col justify-between gap-6 max-lg:contents'>
          <div className='flex flex-col gap-3 max-lg:order-1 max-lg:items-center max-lg:text-center lg:gap-5 lg:pt-4 lg:short:pt-0'>
            <p className='text-[15px] font-bold tracking-[0.14em] text-kiosk-accent uppercase'>
              Rewards check-in
            </p>
            <h1 className='text-[36px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[48px] lg:text-[60px] lg:short:text-[52px]'>
              Welcome in.
              <br />
              Earn a point every visit.
            </h1>
            <p className='max-w-[440px] text-lg leading-normal text-kiosk-muted max-sm:hidden sm:text-[22px]'>
              Type your phone number to check in and see your rewards.
            </p>
          </div>

          <div className='flex flex-col gap-4 max-lg:order-3 max-lg:mx-auto max-lg:w-full max-lg:max-w-[500px]'>
            <ProgramCard content={props.content} />
            <p className='text-sm text-kiosk-faint'>
              We only use your number for Best Nails rewards.
            </p>
          </div>
        </div>

        <div className='flex w-full max-w-[500px] flex-none flex-col gap-4 max-lg:order-2 max-lg:self-center lg:w-[500px]'>
          {/* The instruction sits right above the box the number goes into. */}
          <label
            htmlFor='phone'
            className='text-center text-[22px] font-bold short:text-xl'
          >
            Enter your phone number
          </label>
          <div className='flex flex-none flex-col items-center gap-2 rounded-3xl bg-kiosk-surface px-7 py-5 text-center short:py-3.5'>
            <output
              id='phone'
              aria-live='polite'
              aria-label={
                props.digits
                  ? `Phone number ${props.digits.split('').join(' ')}`
                  : 'Phone number, empty'
              }
              className='text-[34px] font-bold tracking-[0.02em] whitespace-pre tabular-nums sm:text-[46px] lg:short:text-[40px]'
            >
              <span>{typed}</span>
              <span className='text-kiosk-placeholder'>{rest}</span>
            </output>
            {/* One line is always kept for a message, so the keypad below never moves under a finger. */}
            <div className='flex min-h-6 items-center justify-center'>
              {props.error ? (
                <KioskError className='text-base'>{props.error}</KioskError>
              ) : (
                unusual && (
                  <p className='flex items-center gap-1.5 text-sm font-semibold text-kiosk-notice'>
                    <TriangleAlert
                      className='size-4 flex-none'
                      aria-hidden='true'
                    />
                    Not a standard Australian number. You can still continue.
                  </p>
                )
              )}
            </div>
          </div>

          <Numpad
            onDigit={props.onDigit}
            onClear={props.onClear}
            onBackspace={props.onBackspace}
          />

          <button
            type='button'
            onClick={props.onContinue}
            disabled={!ready || props.pending}
            className={`${primaryButton} h-16 flex-none text-[24px] sm:h-23 sm:text-[26px] lg:short:h-18 disabled:bg-kiosk-line disabled:bg-none disabled:text-kiosk-faint disabled:opacity-100`}
          >
            {props.pending ? <Spinner /> : null}
            Continue
            {!props.pending && (
              <ArrowRight
                className='size-7'
                strokeWidth={2.5}
                aria-hidden='true'
              />
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

/**
 * A customer who has already checked in today and typed their number again (usually at the till):
 * what they can redeem, or that they're all set. Someone not yet checked in today skips this and
 * goes straight to the visit steps.
 */
export function FoundScreen({
  customer,
  content,
  onStartOver,
  onDone,
  redeem,
}: {
  customer: KioskCustomer;
  content: KioskContent;
  onStartOver: () => void;
  onDone: () => void;
  redeem: RedeemProps;
}) {
  const reward = mainReward(content.rewards);
  const options = redeemOptions(
    customer.points,
    customer.cashVisits,
    customer.birthday,
    redeem,
    customer.discountUsedToday,
  );
  const checkedInTime =
    customer.checkedInAt &&
    new Date(customer.checkedInAt).toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: content.timezone,
    });

  return (
    <Shell>
      {/* One decision, one column: redeem or not, or "all set". */}
      <div className='mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-7'>
        <StepBack label='Not you? Start over' onClick={onStartOver} />
        <div className='flex flex-1 flex-col items-center justify-center gap-7 pb-6 text-center'>
          <div className='flex flex-col items-center gap-2'>
            <p className='text-lg text-kiosk-muted tabular-nums'>
              {customer.maskedPhone}
            </p>
            <h1 className='text-[36px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[48px] lg:text-[56px]'>
              Welcome back, {customer.firstName}!
            </h1>
            <p className='flex flex-wrap items-center justify-center gap-x-2 text-lg text-kiosk-muted'>
              <span className='flex items-center gap-1.5 font-semibold text-kiosk-ready'>
                <Check
                  className='size-5'
                  strokeWidth={2.6}
                  aria-hidden='true'
                />
                Checked in today at {checkedInTime}
              </span>
              <span aria-hidden='true'>·</span>
              <span>
                <span className='font-bold text-kiosk-ink tabular-nums'>
                  {customer.points}
                </span>{' '}
                point{customer.points === 1 ? '' : 's'}
              </span>
            </p>
          </div>

          {options.length > 0 ? (
            <>
              <RedeemList
                options={options}
                pending={redeem.pending}
                error={redeem.error}
                onRedeem={redeem.onRedeem}
              />
              <button
                type='button'
                onClick={onDone}
                className={`${outlineButton} min-h-16 justify-center px-9 text-xl text-kiosk-ink`}
              >
                No thanks, I&apos;m done
              </button>
            </>
          ) : customer.discountUsedToday ? (
            <>
              <div className='flex flex-col items-center gap-3 rounded-3xl bg-kiosk-surface px-8 py-7'>
                <div className='flex size-16 items-center justify-center rounded-full bg-kiosk-accent'>
                  <Gift
                    className='size-8 text-kiosk-bg'
                    strokeWidth={2.2}
                    aria-hidden='true'
                  />
                </div>
                <p className='text-2xl font-extrabold'>
                  You&apos;ve had today&apos;s discount
                </p>
                <p className='text-lg text-kiosk-muted'>
                  {customer.points > 0
                    ? `${customer.points} point${customer.points === 1 ? '' : 's'} saved for your next visit · one discount per visit`
                    : 'One discount per visit. See you next time!'}
                </p>
              </div>
              <button
                type='button'
                onClick={onDone}
                className={`${primaryButton} min-h-16 min-w-64 px-11 text-2xl`}
              >
                Done
              </button>
            </>
          ) : (
            <>
              {reward && (
                <div className='flex flex-col items-center gap-3 rounded-3xl bg-kiosk-surface px-8 py-7'>
                  <PunchCard
                    points={customer.points}
                    cost={reward.cost}
                    size='md'
                  />
                  <p className='text-lg text-kiosk-muted'>
                    {visitsToGo(customer.points, reward)}
                  </p>
                  <CashProgress
                    reward={reward}
                    cashVisits={customer.cashVisits}
                    points={customer.points}
                  />
                </div>
              )}
              <p className='text-xl text-kiosk-muted'>
                You&apos;re all checked in for today. See you next time!
              </p>
              <button
                type='button'
                onClick={onDone}
                className={`${primaryButton} min-h-16 min-w-64 px-11 text-2xl`}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * An error on the kiosk: the kiosk's one error colour (the same red the Gift voucher dialog uses)
 * with an icon, so it never relies on colour alone. Warnings ("not a standard number") keep
 * kiosk-notice with a triangle.
 */
function KioskError({
  id,
  className = 'text-lg',
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      id={id}
      role='alert'
      className={`flex items-center gap-2 font-bold text-kiosk-error ${className}`}
    >
      <CircleAlert className='size-[1.1em] flex-none' aria-hidden='true' />
      {children}
    </p>
  );
}

/**
 * Kiosk text fields and dropdowns, in the same three states as the admin's inputs:
 * - resting: a 2px edge at 3:1 against the page (kiosk-field), so the field is findable;
 * - focused: a softened gold edge plus a faint gold halo, clear without a hard bright line
 *   (the name field is focused as the screen opens);
 * - invalid: the error red edge and halo, with the message and icon under the field.
 */
const fieldClass =
  'h-18 rounded-[18px] border-2 border-kiosk-field bg-kiosk-surface px-5.5 text-[26px] font-semibold text-kiosk-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-kiosk-placeholder focus:border-kiosk-accent/70 focus:ring-4 focus:ring-kiosk-accent/15 aria-invalid:border-kiosk-error aria-invalid:ring-4 aria-invalid:ring-kiosk-error/15';

export function SignupScreen({
  formattedPhone,
  nonStandard,
  birthday,
  pending,
  initial,
  onSubmit,
  onBack,
}: {
  formattedPhone: string;
  nonStandard: boolean;
  /** The shop's birthday discount (null when it's off): shows the birthday note (it names no amount). */
  birthday: KioskContent['birthday'];
  pending: boolean;
  /** What they typed before going on to the services step and coming back. */
  initial?: SignupInput;
  onSubmit: (input: SignupInput) => void;
  onBack: () => void;
}) {
  // Each problem shows under the field it's about, so customers see what to fix.
  const [error, setError] = useState<{
    field: 'name' | 'birthday';
    message: string;
  } | null>(null);
  // The day list only offers days the chosen month has (29 Feb included), so an impossible date
  // like 31 February can't be picked; changing to a shorter month clears a day it doesn't have.
  const [bdayDay, setBdayDay] = useState(
    initial?.birthdayDay ? String(initial.birthdayDay) : '',
  );
  const [bdayMonth, setBdayMonth] = useState(
    initial?.birthdayMonth ? String(initial.birthdayMonth) : '',
  );
  const maxDay = bdayMonth ? daysInMonth(Number(bdayMonth)) : 31;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    if (!name) {
      setError({
        field: 'name',
        message: 'Please enter your name.',
      });
      return;
    }
    const month = bdayMonth;
    const day = bdayDay;
    if (Boolean(month) !== Boolean(day)) {
      setError({
        field: 'birthday',
        message:
          'Please pick both the day and the month of your birthday, or leave both blank.',
      });
      return;
    }
    onSubmit({
      name,
      birthdayMonth: month && day ? Number(month) : undefined,
      birthdayDay: month && day ? Number(day) : undefined,
    });
  };

  return (
    <Shell>
      {/* The form sits at the top so the on-screen keyboard never covers it. */}
      <form
        onSubmit={submit}
        className='mx-auto flex w-full max-w-[720px] flex-col gap-6'
      >
        <div className='flex min-w-0 flex-col gap-6'>
          <div className='flex flex-col gap-2.5'>
            <StepBack label='Wrong number? Go back' onClick={onBack} />
            <h1 className='text-[36px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px] lg:text-[52px]'>
              Nice to meet you!
            </h1>
            <p className='text-xl text-kiosk-muted'>
              {formattedPhone} isn&apos;t in our rewards yet.
            </p>
            {nonStandard && (
              <p className='flex items-center gap-2.5 text-lg font-semibold text-kiosk-notice'>
                <TriangleAlert
                  className='size-5.5 flex-none'
                  aria-hidden='true'
                />
                This isn&apos;t a standard Australian number. Please check it,
                or go back to fix it.
              </p>
            )}
          </div>

          {/* One name, as check-in kiosks ask: the first word is what the kiosk greets them by. */}
          <div className='flex flex-col gap-2'>
            <label htmlFor='name' className='text-base font-bold'>
              Your name <span className='text-kiosk-accent'>*</span>
            </label>
            <input
              id='name'
              name='name'
              autoComplete='name'
              autoFocus
              maxLength={100}
              placeholder='What should we call you?'
              defaultValue={initial?.name}
              aria-invalid={error?.field === 'name' || undefined}
              aria-describedby={
                error?.field === 'name' ? 'name-error' : undefined
              }
              onChange={() => error?.field === 'name' && setError(null)}
              className={fieldClass}
            />
            {error?.field === 'name' && (
              <KioskError id='name-error'>{error.message}</KioskError>
            )}
          </div>

          {/* While the shop offers a birthday discount, the birthday gets a gold-edged card saying why
              to add it (Galaxy-style, in our palette); otherwise it's a plain optional field. The
              wording names no amount on purpose: a big number tempts people to give a birthday
              that's coming up rather than their real one. */}
          <fieldset
            className={
              birthday
                ? 'flex flex-col gap-4 rounded-3xl border border-kiosk-accent/40 bg-kiosk-accent/[0.06] p-5'
                : 'flex flex-col gap-2'
            }
            aria-describedby={birthday ? 'birthday-hint' : undefined}
          >
            <legend className='sr-only'>Birthday (optional)</legend>
            {birthday ? (
              <div aria-hidden='true' className='flex flex-col gap-1'>
                <p className='flex items-center gap-2.5 text-xl font-extrabold text-kiosk-accent'>
                  <Cake className='size-6 flex-none' />
                  Add your birthday for a special birthday treat
                </p>
                <p id='birthday-hint' className='text-base text-kiosk-muted'>
                  Optional · a little treat could be waiting for you around your
                  birthday.
                </p>
              </div>
            ) : (
              <p aria-hidden='true' className='text-base font-bold'>
                Birthday{' '}
                <span className='font-medium text-kiosk-muted'>(optional)</span>
              </p>
            )}
            <div className='grid grid-cols-[2fr_3fr] gap-3.5'>
              <select
                name='birthdayDay'
                aria-label='Birthday day'
                value={bdayDay}
                onChange={(e) => {
                  setBdayDay(e.target.value);
                  if (error?.field === 'birthday') setError(null);
                }}
                className={`${fieldClass} w-full text-2xl`}
              >
                <option value=''>Day</option>
                {Array.from({ length: maxDay }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select
                name='birthdayMonth'
                aria-label='Birthday month'
                value={bdayMonth}
                onChange={(e) => {
                  const month = e.target.value;
                  setBdayMonth(month);
                  if (error?.field === 'birthday') setError(null);
                  if (month && Number(bdayDay) > daysInMonth(Number(month)))
                    setBdayDay('');
                }}
                className={`${fieldClass} w-full min-w-0 text-2xl`}
              >
                <option value=''>Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {error?.field === 'birthday' && (
              <KioskError>{error.message}</KioskError>
            )}
          </fieldset>
        </div>

        {/* One centred column: the form, then Join right under it (where the eye is, and above the
            iPad's keyboard). The program is on the keypad screen they've just seen. */}
        <div className='mt-2 flex flex-col gap-3.5'>
          <button
            type='submit'
            disabled={pending}
            className={`${primaryButton} h-22 w-full text-[28px]`}
          >
            {pending && <Spinner />}
            Join &amp; check in
          </button>
          <p className='text-sm leading-normal text-kiosk-faint'>
            By joining you agree to the Best Nails rewards terms.
          </p>
        </div>
      </form>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

/**
 * The frame both visit steps share: back pill and heading at the top, the choices in the middle
 * (the page scrolls), and Skip / the main button pinned to the bottom so they're always in reach.
 * A step that can't be skipped (services) has no Skip, and the main button keeps the same size and
 * place, so it doesn't jump between steps.
 */
/**
 * A returning customer goes from the keypad straight to the first step, so that step says who they
 * are ("Welcome back, Nathan · 04•• ••• 555") and its back pill is "Not you? Start over".
 */
export type StepIntro = { greeting?: React.ReactNode; backLabel?: string };

function Greeting({ children }: { children: React.ReactNode }) {
  return <p className='text-lg text-kiosk-muted sm:text-xl'>{children}</p>;
}

function PickStep({
  title,
  subtitle,
  onBack,
  greeting,
  backLabel = 'Back',
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
  /** Leave out on a step that can't be skipped. */
  skipLabel?: string;
  nextLabel: React.ReactNode;
  canNext: boolean;
  pending: boolean;
  onSkip?: () => void;
  onNext: () => void;
} & StepIntro) {
  return (
    <main className='flex w-full flex-1 flex-col text-kiosk-ink'>
      <div className='flex flex-1 flex-col gap-7 px-5 pt-6 pb-8 sm:px-10 sm:pt-8 lg:px-16 lg:pt-10 short:gap-5 lg:short:pt-6'>
        <div className='flex flex-col gap-3'>
          <StepBack label={backLabel} onClick={onBack} />
          {greeting && <Greeting>{greeting}</Greeting>}
          <h1 className='text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px] lg:text-[52px] lg:short:text-[44px]'>
            {title}
          </h1>
          <p className='text-lg text-kiosk-muted sm:text-xl'>{subtitle}</p>
        </div>
        <div className='mt-5 short:mt-2'>{children}</div>
      </div>
      <div className='sticky bottom-0 bg-linear-to-t from-kiosk-bg from-70% to-transparent px-5 pt-8 pb-6 sm:px-10 lg:px-16 lg:short:pb-4'>
        <div className='grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4'>
          {onSkip && (
            <button
              type='button'
              onClick={onSkip}
              disabled={pending}
              className={`${outlineButton} h-18 justify-center bg-kiosk-bg text-xl disabled:opacity-60 lg:short:h-16`}
            >
              {skipLabel}
            </button>
          )}
          <button
            type='button'
            onClick={onNext}
            disabled={!canNext || pending}
            className={`${primaryButton} col-start-2 h-18 text-2xl disabled:bg-kiosk-line disabled:bg-none disabled:text-kiosk-faint disabled:opacity-100 lg:short:h-16`}
          >
            {pending && <Spinner />}
            {nextLabel}
            {!pending && (
              <ArrowRight
                className='size-6.5'
                strokeWidth={2.5}
                aria-hidden='true'
              />
            )}
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
  role = 'checkbox',
  className = '',
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  role?: 'checkbox' | 'radio';
  className?: string;
}) {
  return (
    <button
      type='button'
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={`group flex min-h-16 max-w-full items-center gap-3 rounded-2xl border-2 px-6 text-left text-xl font-semibold transition-colors active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kiosk-ink ${
        selected
          ? 'border-kiosk-accent bg-kiosk-accent/12 text-kiosk-ink'
          : 'border-transparent bg-kiosk-surface text-kiosk-ink hover:border-kiosk-line'
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** The service menu: categories with their services as chips (pick as many as you like). */
function ServiceMenu({
  categories,
  selected,
  onToggle,
}: {
  categories: KioskServiceCategory[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className='flex flex-col gap-10 short:gap-8'>
      {categories.map((c) => (
        <section
          key={c.id}
          aria-labelledby={`cat-${c.id}`}
          className='flex flex-col gap-4'
        >
          <h2
            id={`cat-${c.id}`}
            className='font-heading text-[32px] leading-none font-bold text-kiosk-accent'
          >
            {c.name}
          </h2>
          <div className='flex flex-wrap gap-3.5'>
            {c.services.map((s) => (
              <ChoiceChip
                key={s.id}
                selected={selected.includes(s.id)}
                onClick={() => onToggle(s.id)}
              >
                {s.name}
              </ChoiceChip>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** At least one service is required: there's no Skip, and Next stays off until one is picked. */
export function ServicesScreen({
  categories,
  selected,
  isLast,
  pending,
  onToggle,
  onBack,
  onNext,
  ...intro
}: StepIntro & {
  categories: KioskServiceCategory[];
  selected: string[];
  /** No staff or payment step follows, so the main button checks in. */
  isLast: boolean;
  pending: boolean;
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const count = selected.length;
  return (
    <PickStep
      title='What are you in for today?'
      subtitle='Pick at least one, as many as you like.'
      onBack={onBack}
      {...intro}
      nextLabel={
        <>
          {isLast ? 'Check in' : 'Next'}
          {count > 0 && (
            <>
              <span aria-hidden='true' className='font-bold opacity-75'>
                · {count}
              </span>
              <span className='sr-only'>({count} selected)</span>
            </>
          )}
        </>
      }
      canNext={count > 0}
      pending={pending}
      onNext={onNext}
    >
      <ServiceMenu
        categories={categories}
        selected={selected}
        onToggle={onToggle}
      />
    </PickStep>
  );
}

export function StaffScreen({
  technicians,
  selected,
  isLast = true,
  pending,
  onSelect,
  onBack,
  onSkip,
  onNext,
  ...intro
}: StepIntro & {
  technicians: KioskTechnician[];
  selected: string | null;
  /** No payment step follows, so the buttons check in. */
  isLast?: boolean;
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
      {...intro}
      skipLabel={isLast ? 'Skip & check in' : 'Skip'}
      nextLabel={isLast ? 'Check in' : 'Next'}
      canNext={selected !== null}
      pending={pending}
      onSkip={onSkip}
      onNext={onNext}
    >
      <div
        role='radiogroup'
        aria-label='Nail technician'
        className='flex flex-wrap gap-3.5'
      >
        {technicians.map((t) => (
          <ChoiceChip
            key={t.id}
            role='radio'
            selected={selected === t.id}
            onClick={() => onSelect(selected === t.id ? null : t.id)}
            className='min-h-20 gap-4 pr-8 pl-4'
          >
            <span
              aria-hidden='true'
              className='flex size-12 flex-none items-center justify-center rounded-full bg-kiosk-line font-heading text-2xl font-bold text-kiosk-accent group-aria-checked:bg-kiosk-accent/25'
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

/** What the done screen lists back: the services, technician and payment they picked. */
export type VisitSummary = {
  services: string[];
  technician?: string;
  payment?: PaymentMethod | null;
};

const PAYMENT_CHOICES: {
  method: PaymentMethod;
  label: string;
  Icon: typeof Banknote;
}[] = [
  { method: 'cash', label: 'Cash', Icon: Banknote },
  { method: 'card', label: 'Card', Icon: CreditCard },
];

// The kiosk tells customers cash visits get the higher discount and leaves the choice to them:
// no "pay cash" prompts, and neither button is highlighted or picked in advance.

/**
 * How they're paying today: the last step, asked when a reward gives more for cash. Tapping Cash or
 * Card checks in (Back keeps everything picked); the done screen lists it back. One line under the
 * heading states the rule. Staff fix a wrong tap with Adjust points ("Count as cash visits").
 */
export function PaymentScreen({
  reward,
  pending,
  onPick,
  onBack,
  greeting,
  backLabel = 'Back',
}: StepIntro & {
  /** The reward that gives more for cash. */
  reward: KioskReward | null;
  pending: boolean;
  onPick: (method: PaymentMethod) => void;
  onBack: () => void;
}) {
  const [picked, setPicked] = useState<PaymentMethod | null>(null);
  return (
    <main className='mx-auto flex w-full max-w-[848px] flex-1 flex-col gap-10 px-5 pt-6 pb-10 text-kiosk-ink sm:px-10 sm:pt-8 lg:px-16 lg:pt-10 short:gap-7 lg:short:pt-6'>
      <div className='flex flex-col gap-3'>
        <StepBack label={backLabel} onClick={onBack} />
        {greeting && <Greeting>{greeting}</Greeting>}
        <h1 className='text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px] lg:text-[52px] lg:short:text-[44px]'>
          How are you paying today?
        </h1>
        {/* The rule, once: the amount stands out, and nothing tells them which to pick. */}
        {reward && (
          <p className='text-xl text-kiosk-muted'>
            After {reward.cost} visits:{' '}
            <span className='font-extrabold text-kiosk-accent'>
              {rewardName(reward, reward.cost)}
            </span>{' '}
            if all are paid in cash, {rewardName(reward, 0)} otherwise.
          </p>
        )}
      </div>

      <div
        role='group'
        aria-label='Payment method'
        className='grid grid-cols-2 gap-5'
      >
        {PAYMENT_CHOICES.map(({ method, label, Icon }) => (
          <button
            key={method}
            type='button'
            disabled={pending}
            onClick={() => {
              setPicked(method);
              onPick(method);
            }}
            className={`flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl border-2 bg-kiosk-surface px-4 py-6 text-center transition active:scale-[0.98] disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kiosk-ink ${
              pending && picked === method
                ? 'border-kiosk-accent bg-kiosk-accent/12'
                : 'border-transparent enabled:hover:border-kiosk-line'
            }`}
          >
            {pending && picked === method ? (
              <Spinner />
            ) : (
              <Icon
                className='size-11 text-kiosk-accent'
                strokeWidth={1.8}
                aria-hidden='true'
              />
            )}
            <span className='text-[30px] leading-none font-extrabold'>
              {label}
            </span>
          </button>
        ))}
      </div>
    </main>
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
  pending: boolean;
  error: string | null;
  onRedeem: (target: RedeemTarget) => void;
};

type Option = {
  key: string;
  title: string;
  detail: string;
  target: RedeemTarget;
  birthday: boolean;
};

function redeemOptions(
  points: number,
  cashVisits: number,
  birthday: KioskBirthday,
  { rewards }: RedeemProps,
  discountUsedToday = false,
): Option[] {
  const options: Option[] = [];
  // One discount per visit: nothing more to offer once today's has been used.
  if (discountUsedToday) return options;
  if (birthday.eligible && birthday.label) {
    options.push({
      key: 'birthday',
      title: `Birthday ${birthday.label}`,
      detail: 'Our gift to you. No points needed',
      target: { kind: 'birthday' },
      birthday: true,
    });
  }
  for (const r of rewards.filter((r) => r.cost <= points)) {
    const uses = `Uses ${r.cost} of your ${points} points`;
    const cash = hasCashBonus(r) && cashVisits >= r.cost;
    options.push({
      key: r.id,
      title: rewardName(r, cashVisits),
      detail: cash ? `For paying cash on ${r.cost} visits · ${uses}` : uses,
      target: { kind: 'reward', rewardId: r.id },
      birthday: false,
    });
  }
  return options;
}

/** What the customer can redeem right now, each with a two-step "Redeem → Yes" confirm. */
function RedeemList({
  options,
  pending,
  error,
  onRedeem,
}: { options: Option[] } & Pick<
  RedeemProps,
  'pending' | 'error' | 'onRedeem'
>) {
  const [confirming, setConfirming] = useState<string | null>(null);
  if (options.length === 0) return null;

  return (
    <section
      aria-label='Rewards you can redeem'
      className='flex w-full max-w-[720px] flex-col gap-3 rounded-3xl bg-kiosk-surface p-5 text-left'
    >
      <h2 className='text-xl font-extrabold'>Ready to redeem today</h2>
      <ul className='flex flex-col gap-2.5'>
        {options.map((o) => (
          <li
            key={o.key}
            className='flex min-h-18 flex-wrap items-center justify-between gap-4 rounded-2xl bg-kiosk-bg px-5 py-3'
          >
            <div className='flex items-center gap-4'>
              {o.birthday ? (
                <Cake
                  className='size-7 flex-none text-kiosk-accent'
                  aria-hidden='true'
                />
              ) : (
                <Gift
                  className='size-7 flex-none text-kiosk-accent'
                  aria-hidden='true'
                />
              )}
              <div className='flex flex-col'>
                <span className='text-xl font-bold'>{o.title}</span>
                <span className='text-[15px] text-kiosk-muted'>{o.detail}</span>
              </div>
            </div>
            {confirming === o.key ? (
              <div className='flex gap-2'>
                <button
                  type='button'
                  onClick={() => setConfirming(null)}
                  className={`${outlineButton} min-h-14 px-5`}
                >
                  Cancel
                </button>
                {/* Green with a tick, not gold like Redeem, so it reads as the confirmation. */}
                <button
                  type='button'
                  disabled={pending}
                  onClick={() => onRedeem(o.target)}
                  className='flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-kiosk-ready px-6 text-lg font-extrabold text-kiosk-bg transition active:scale-[0.98] enabled:hover:brightness-110 disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-kiosk-ink'
                >
                  {pending ? (
                    <Spinner />
                  ) : (
                    <Check
                      className='size-5'
                      strokeWidth={3}
                      aria-hidden='true'
                    />
                  )}
                  Yes, redeem
                </button>
              </div>
            ) : (
              <button
                type='button'
                onClick={() => setConfirming(o.key)}
                className={`${primaryButton} min-h-14 rounded-2xl px-7 text-lg`}
              >
                Redeem
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <KioskError className='text-base'>{error}</KioskError>}
    </section>
  );
}

export function SuccessScreen({
  result,
  seconds,
  onDone,
  summary,
  paused = false,
  ...redeem
}: RedeemProps & {
  result: Extract<CheckInResult, { status: 'checked_in' }>;
  seconds: number;
  onDone: () => void;
  /** What they picked, listed back so they can see what was recorded. */
  summary: VisitSummary;
  /** Hold the countdown, e.g. while staff use the Gift voucher dialog. */
  paused?: boolean;
}) {
  const options = redeemOptions(
    result.points,
    result.cashVisits,
    result.birthday,
    redeem,
    result.discountUsedToday,
  );
  const canRedeem = options.length > 0;
  // Don't rush someone who is about to redeem; the idle timeout still applies.
  const left = useCountdown(canRedeem || paused ? null : seconds, onDone);
  const reward = mainReward(redeem.rewards);
  const earned = result.pointsAwarded;

  return (
    <Shell centered>
      <div
        className={`flex items-center justify-center rounded-full bg-kiosk-accent ${canRedeem ? 'size-20' : 'size-30'}`}
      >
        <Check
          className={`text-kiosk-bg ${canRedeem ? 'size-10' : 'size-15'}`}
          strokeWidth={2.6}
          aria-hidden='true'
        />
      </div>
      <div className='flex flex-col items-center gap-3'>
        <h1
          className={`leading-[1.05] font-extrabold tracking-[-0.03em] ${canRedeem ? 'text-[34px] sm:text-[48px]' : 'text-[38px] sm:text-[48px] lg:text-[60px]'}`}
          role='status'
        >
          You&apos;re checked in, {result.firstName}!
        </h1>
        {!canRedeem && (
          <p className='text-xl text-kiosk-muted sm:text-2xl'>
            Have a seat.{' '}
            {summary.technician ? `${summary.technician} will` : "We'll"} be
            with you shortly.
          </p>
        )}
      </div>

      <div className='flex flex-col items-center gap-4 rounded-3xl bg-kiosk-surface px-6 py-6 sm:px-10'>
        {(summary.services.length > 0 ||
          summary.technician ||
          summary.payment) && (
          <div className='flex w-full flex-col items-center gap-1 border-b-2 border-kiosk-line pb-4 text-center'>
            {summary.services.length > 0 && (
              <p className='text-xl font-bold'>
                {summary.services.join(' · ')}
              </p>
            )}
            {(summary.technician || summary.payment) && (
              <p className='text-lg text-kiosk-muted'>
                {[
                  summary.technician && `With ${summary.technician}`,
                  summary.payment &&
                    `Paying ${summary.payment === 'cash' ? 'cash' : 'by card'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        )}
        <p className='text-xl'>
          <span className='font-extrabold text-kiosk-accent'>
            +{earned} point{earned === 1 ? '' : 's'}
          </span>
          <span className='text-kiosk-muted'> · you now have </span>
          <span className='font-extrabold tabular-nums'>{result.points}</span>
        </p>
        {reward && result.points < reward.cost && (
          <>
            <PunchCard points={result.points} cost={reward.cost} size='md' />
            <p className='text-lg text-kiosk-muted'>
              {visitsToGo(result.points, reward)}
            </p>
            <CashProgress
              reward={reward}
              cashVisits={result.cashVisits}
              points={result.points}
            />
          </>
        )}
      </div>

      <RedeemList
        options={options}
        pending={redeem.pending}
        error={redeem.error}
        onRedeem={redeem.onRedeem}
      />

      <button
        type='button'
        onClick={onDone}
        className={`${outlineButton} min-h-16 px-9 text-xl text-kiosk-ink`}
      >
        {canRedeem ? "No thanks, I'm done" : 'Done'}
        {!canRedeem && (
          <span className='font-medium text-kiosk-muted'>
            · closing in {left}s
          </span>
        )}
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
  result: Extract<CheckInResult, { status: 'already_checked_in' }>;
  timezone: string;
  onDone: () => void;
}) {
  const time = new Date(result.lastCheckInAt).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
  const options = redeemOptions(
    result.points,
    result.cashVisits,
    result.birthday,
    redeem,
    result.discountUsedToday,
  );
  const canRedeem = options.length > 0;
  return (
    <Shell centered>
      {/* Not an error: they're simply checked in already. A calm tick, not a warning. */}
      {!canRedeem && (
        <div className='flex size-28 items-center justify-center rounded-full border-3 border-kiosk-accent'>
          <Check
            className='size-14 text-kiosk-accent'
            strokeWidth={2.4}
            aria-hidden='true'
          />
        </div>
      )}
      <div className='flex max-w-[760px] flex-col items-center gap-3.5'>
        <h1
          className={`leading-[1.08] font-extrabold tracking-[-0.03em] ${canRedeem ? 'text-[32px] sm:text-[44px]' : 'text-[36px] sm:text-[48px] lg:text-[56px]'}`}
        >
          {canRedeem
            ? `Welcome back, ${result.firstName}!`
            : `You're all checked in for today, ${result.firstName}`}
        </h1>
        <p className='text-lg leading-normal text-kiosk-muted sm:text-[22px]'>
          You checked in at {time} and have{' '}
          <span className='font-bold text-kiosk-ink'>
            {result.points} point{result.points === 1 ? '' : 's'}
          </span>
          .
          {result.discountUsedToday &&
            " You've had today's discount, one per visit."}
        </p>
      </div>
      <RedeemList
        options={options}
        pending={redeem.pending}
        error={redeem.error}
        onRedeem={redeem.onRedeem}
      />
      <button
        type='button'
        onClick={onDone}
        className={`${canRedeem ? outlineButton : primaryButton} min-h-18 px-11 text-2xl`}
      >
        {canRedeem ? "No thanks, I'm done" : 'OK, got it'}
      </button>
      {!canRedeem && (
        <p className='text-base text-kiosk-faint'>
          Something wrong? Ask the front desk.
        </p>
      )}
    </Shell>
  );
}

export function RedeemedScreen({
  result,
  timezone,
  onDone,
  paused = false,
}: {
  result: Extract<RedeemResult, { status: 'redeemed' }>;
  timezone: string;
  onDone: () => void;
  paused?: boolean;
}) {
  // Long enough to walk the iPad over or call someone to the desk.
  const left = useCountdown(paused ? null : 60, onDone);
  const at = new Date(result.redeemedAt).toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
  const birthday = result.pointsSpent === 0;

  return (
    <Shell centered>
      <div className='flex size-30 items-center justify-center rounded-full bg-kiosk-ready'>
        {birthday ? (
          <Cake
            className='size-15 text-kiosk-bg'
            strokeWidth={2.2}
            aria-hidden='true'
          />
        ) : (
          <Gift
            className='size-15 text-kiosk-bg'
            strokeWidth={2.2}
            aria-hidden='true'
          />
        )}
      </div>
      <div className='flex flex-col items-center gap-3'>
        <p className='text-[15px] font-bold tracking-[0.14em] text-kiosk-ready uppercase'>
          Redeemed
        </p>
        <h1
          className='text-[38px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[48px] lg:text-[60px]'
          role='status'
        >
          {result.title}
        </h1>
        {result.note && (
          <p className='flex items-center gap-2 text-xl font-bold text-kiosk-ready'>
            <Banknote className='size-6' aria-hidden='true' />
            {result.note}
          </p>
        )}
        <p className='text-xl text-kiosk-muted sm:text-2xl'>
          Show this screen to the front desk when you pay.
        </p>
      </div>
      <div className='flex flex-wrap justify-center gap-4 sm:gap-5'>
        {!birthday && (
          <div className='flex min-w-40 flex-col gap-1.5 rounded-3xl bg-kiosk-surface px-6 py-5 sm:min-w-56 sm:px-10'>
            <p className='text-base font-semibold text-kiosk-muted'>
              Points used
            </p>
            <p className='text-[48px] leading-none font-extrabold tabular-nums'>
              −{result.pointsSpent}
            </p>
          </div>
        )}
        <div className='flex min-w-40 flex-col gap-1.5 rounded-3xl bg-kiosk-surface px-6 py-5 sm:min-w-56 sm:px-10'>
          <p className='text-base font-semibold text-kiosk-muted'>
            Points left
          </p>
          <p className='text-[48px] leading-none font-extrabold tabular-nums'>
            {result.points}
          </p>
        </div>
      </div>
      <p className='text-lg text-kiosk-muted tabular-nums'>{at}</p>
      <button
        type='button'
        onClick={onDone}
        className={`${outlineButton} min-h-16 px-9 text-xl text-kiosk-ink`}
      >
        Done
        <span className='font-medium text-kiosk-muted'>
          · closing in {left}s
        </span>
      </button>
    </Shell>
  );
}

export function ErrorScreen({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  return (
    <Shell centered>
      <div className='flex size-32 items-center justify-center rounded-full bg-kiosk-surface'>
        <WifiOff
          className='size-15 text-kiosk-muted'
          strokeWidth={2}
          aria-hidden='true'
        />
      </div>
      <div className='flex max-w-[720px] flex-col items-center gap-3.5'>
        <h1
          className='text-[36px] leading-[1.08] font-extrabold tracking-[-0.03em] sm:text-[52px]'
          role='alert'
        >
          Something went wrong
        </h1>
        <p className='text-lg leading-normal text-kiosk-muted sm:text-[22px]'>
          {message} Please let the front desk know you&apos;re here. Your visit
          can still be added from the admin page.
        </p>
      </div>
      <button
        type='button'
        onClick={onDone}
        className={`${primaryButton} min-h-20 px-11 text-2xl`}
      >
        <RotateCw className='size-6.5' strokeWidth={2.4} aria-hidden='true' />
        Try again
      </button>
    </Shell>
  );
}
