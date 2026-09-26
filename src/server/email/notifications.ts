import { prisma } from "@/lib/db";
import { MEAL_PLAN_LABELS } from "@/lib/validation/property";
import { todayInMaldives } from "@/lib/stay-pricing";
import { paymentInstructions } from "@/server/services/commission-service";
import { REPORT_REASON_LABELS } from "@/server/services/moderation-service";
import { bookingPriceLines, guestMixLabel } from "@/lib/booking-breakdown";
import { renderEmail, type EmailContent } from "./layout";
import { sendEmail } from "./mailer";

/**
 * Every notification email the platform sends, one function per event.
 *
 * Callers fire these with Next.js `after()` once the change has been saved,
 * so the traveler/host/admin gets their page back immediately and a slow or
 * failing email service can never break the action itself. Each function
 * loads what it needs from the database, so it always describes the saved
 * state. None of them throw.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const d = (date: Date) => dateFmt.format(date);
const money = (amount: { toString(): string }, currency: string) =>
  `${currency} ${Number(amount.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function safely(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.error(`[email] notification "${name}" failed:`, err);
  }
}

function send(to: string, subject: string, template: string, content: EmailContent, extra: { replyTo?: string; dedupeKey?: string; related?: { type: string; id: string } } = {}) {
  return sendEmail({ to, subject, template, ...renderEmail(content), ...extra });
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

async function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      guest: { select: { name: true, email: true } },
      guests: { where: { isPrimary: true }, select: { fullName: true } },
      room: { select: { name: true, mealPlan: true } },
      property: {
        select: {
          id: true,
          name: true,
          address: true,
          checkInTime: true,
          checkOutTime: true,
          island: { select: { name: true, atoll: { select: { name: true } } } },
          cancellationPolicy: { select: { freeCancellationDays: true } },
          hostProfile: { select: { businessName: true, contactPhone: true, user: { select: { email: true, name: true } } } },
        },
      },
    },
  });
}
type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

function stayRows(b: LoadedBooking): [string, string][] {
  const nights = Math.round((b.checkOutDate.getTime() - b.checkInDate.getTime()) / DAY_MS);
  return [
    ["Booking reference", b.bookingReference],
    ["Property", `${b.property.name}, ${b.property.island.name} (${b.property.island.atoll.name})`],
    ["Room", `${b.numRooms} × ${b.room.name} · ${MEAL_PLAN_LABELS[b.room.mealPlan]}`],
    ["Check-in", `${d(b.checkInDate)}${b.property.checkInTime ? `, from ${b.property.checkInTime}` : ""}`],
    ["Check-out", `${d(b.checkOutDate)}${b.property.checkOutTime ? `, by ${b.property.checkOutTime}` : ""} (${nights} night${nights === 1 ? "" : "s"})`],
    ["Guests", `${guestMixLabel(b)} · lead guest ${b.guests[0]?.fullName ?? b.guest.name}`],
    ...bookingPriceLines(b),
    ["Payment", "paid to the property on arrival"],
  ];
}

export function notifyBookingCreated(bookingId: string) {
  return safely("booking-created", async () => {
    const b = await loadBooking(bookingId);
    if (!b) return;
    const host = b.property.hostProfile;
    const related = { type: "Booking", id: b.id };
    const freeDays = b.property.cancellationPolicy?.freeCancellationDays;
    const freeUntil = freeDays !== null && freeDays !== undefined ? new Date(b.checkInDate.getTime() - freeDays * DAY_MS) : null;

    await send(
      b.guest.email,
      `Booking confirmed: ${b.property.name}, ${d(b.checkInDate)}`,
      "booking-confirmed-guest",
      {
        heading: "Your stay is booked",
        intro: [`Hi ${b.guest.name}, your booking at ${b.property.name} is confirmed. You'll pay the property directly when you arrive.`],
        rows: [
          ...stayRows(b),
          ["Host", `${host.businessName} · ${host.contactPhone}`],
          ...(b.property.address ? ([["Address", b.property.address]] as [string, string][]) : []),
          [
            "Free cancellation",
            !freeUntil
              ? "not offered for this booking"
              : freeUntil > b.createdAt
                ? `until ${d(freeUntil)}`
                : "not available (you booked after the free cancellation period ended)",
          ],
        ],
        button: { label: "View your booking", path: `/dashboard/traveler/trips/${b.id}` },
        outro: [
          "Questions about your stay? Reply to this email to reach the host.",
          "Stay safe: you pay the property only when you arrive. Never send a deposit or bank transfer before your stay, even if someone asks by message, WhatsApp or email. If anyone does, please report the listing on our website.",
        ],
      },
      { replyTo: host.user.email, related }
    );

    await send(
      host.user.email,
      `New booking ${b.bookingReference}: ${b.guests[0]?.fullName ?? b.guest.name}, ${d(b.checkInDate)}`,
      "booking-new-host",
      {
        heading: "You have a new booking",
        intro: [`${b.guests[0]?.fullName ?? b.guest.name} booked ${b.property.name}. The guest pays you on arrival.`],
        rows: [
          ...stayRows(b),
          ["Guest contact", `${b.contactPhone ?? "—"} · ${b.guest.email}`],
          ...(b.specialRequests ? ([["Special requests", b.specialRequests]] as [string, string][]) : []),
          ["Your share", `${money(b.hostPayoutAmount, b.currency)} (room + service charge, after ${Number(b.commissionRateSnapshot.toString())}% commission on the room price)`],
        ],
        button: { label: "Open the booking", path: `/dashboard/host/bookings/${b.id}` },
        outro: ["Reply to this email to contact the guest."],
      },
      { replyTo: b.guest.email, related }
    );
  });
}

export function notifyBookingCancelled(bookingId: string, by: "guest" | "host") {
  return safely("booking-cancelled", async () => {
    const b = await loadBooking(bookingId);
    if (!b || b.status !== "CANCELLED") return;
    const host = b.property.hostProfile;
    const related = { type: "Booking", id: b.id };
    const reasonRow: [string, string][] = b.cancellationReason ? [["Reason", b.cancellationReason]] : [];

    if (by === "guest") {
      await send(host.user.email, `Booking cancelled: ${b.bookingReference}, ${d(b.checkInDate)}`, "booking-cancelled-host", {
        heading: "A guest cancelled their booking",
        intro: [`${b.guests[0]?.fullName ?? b.guest.name} cancelled their stay at ${b.property.name}. The room is bookable again for those dates.`],
        rows: [...stayRows(b), ...reasonRow],
        button: { label: "View your bookings", path: "/dashboard/host/bookings" },
      }, { related });
      await send(b.guest.email, `Cancellation confirmed: ${b.property.name}`, "booking-cancelled-guest", {
        heading: "Your booking is cancelled",
        intro: [`Hi ${b.guest.name}, as you asked, your booking ${b.bookingReference} at ${b.property.name} is cancelled. Nothing more to do.`],
        rows: stayRows(b),
        button: { label: "Find another stay", path: "/search" },
      }, { related });
    } else {
      await send(b.guest.email, `Your booking at ${b.property.name} was cancelled`, "booking-cancelled-by-host-guest", {
        heading: "The property cancelled your booking",
        intro: [
          `Hi ${b.guest.name}, we're sorry: ${b.property.name} had to cancel your booking ${b.bookingReference}. You haven't been charged anything.`,
        ],
        rows: [...stayRows(b), ...reasonRow],
        button: { label: "Find another stay", path: "/search" },
      }, { replyTo: host.user.email, related });
    }
  });
}

// ---------------------------------------------------------------------------
// Listing review
// ---------------------------------------------------------------------------

async function loadListing(propertyId: string) {
  return prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      rejectionReason: true,
      changesRejectionReason: true,
      hostProfile: { select: { businessName: true, user: { select: { name: true, email: true } } } },
    },
  });
}

export function notifyListingSubmitted(propertyId: string) {
  return safely("listing-submitted", async () => {
    const p = await loadListing(propertyId);
    if (!p) return;
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
      select: { email: true },
    });
    for (const admin of admins) {
      await send(admin.email, `New listing to review: ${p.name}`, "listing-submitted-admin", {
        heading: "A listing is waiting for review",
        intro: [`${p.hostProfile.businessName} submitted "${p.name}" for review.`],
        button: { label: "Review it", path: `/dashboard/admin/properties/${p.id}` },
      }, { related: { type: "Property", id: p.id } });
    }
  });
}

export function notifyListingReviewed(propertyId: string, approved: boolean) {
  return safely("listing-reviewed", async () => {
    const p = await loadListing(propertyId);
    if (!p) return;
    const to = p.hostProfile.user.email;
    const related = { type: "Property", id: p.id };
    if (approved) {
      await send(to, `Your listing "${p.name}" is live`, "listing-approved-host", {
        heading: "Your listing is live 🎉",
        intro: [`Good news, ${p.hostProfile.user.name}: our team approved "${p.name}". Travelers can now find and book it.`],
        button: { label: "See your listing", path: `/stays/${p.slug}` },
        outro: ["Keep your prices and availability up to date from your host dashboard."],
      }, { related });
    } else {
      await send(to, `Changes needed on "${p.name}"`, "listing-rejected-host", {
        heading: "Your listing needs a few changes",
        intro: [`Our team reviewed "${p.name}" and asked for the following before it can go live:`],
        rows: [["Our note", p.rejectionReason ?? "—"]],
        button: { label: "Update your listing", path: `/dashboard/host/properties/${p.id}` },
        outro: ["Make the changes, then submit it again from the last step of the listing."],
      }, { related });
    }
  });
}

export function notifyChangesReviewed(propertyId: string, approved: boolean) {
  return safely("changes-reviewed", async () => {
    const p = await loadListing(propertyId);
    if (!p) return;
    const related = { type: "Property", id: p.id };
    await send(
      p.hostProfile.user.email,
      approved ? `Your edits to "${p.name}" are live` : `Your edits to "${p.name}" weren't approved`,
      approved ? "changes-approved-host" : "changes-rejected-host",
      approved
        ? {
            heading: "Your edits are live",
            intro: [`Our team approved your changes to "${p.name}". Travelers now see the updated name, description and photos.`],
            button: { label: "See your listing", path: `/stays/${p.slug}` },
          }
        : {
            heading: "Your edits weren't approved",
            intro: [`Our team didn't approve your latest changes to "${p.name}", so the listing stays as it was.`],
            rows: [["Our note", p.changesRejectionReason ?? "—"]],
            button: { label: "Open your listing", path: `/dashboard/host/properties/${p.id}` },
          },
      { related }
    );
  });
}

// ---------------------------------------------------------------------------
// Commission statements
// ---------------------------------------------------------------------------

async function loadStatement(id: string) {
  return prisma.commissionStatement.findUnique({
    where: { id },
    include: { hostProfile: { select: { businessName: true, user: { select: { email: true, name: true } } } } },
  });
}

export function notifyStatementsCreated(statementIds: string[]) {
  return safely("statements-created", async () => {
    for (const id of statementIds) {
      const s = await loadStatement(id);
      if (!s) continue;
      await send(s.hostProfile.user.email, `Your ${monthFmt.format(s.periodStart)} commission statement: ${money(s.commissionAmount, s.currency)}`, "statement-created-host", {
        heading: `Your ${monthFmt.format(s.periodStart)} statement`,
        intro: [`Hi ${s.hostProfile.user.name}, here is the platform commission for the stays completed at your properties.`],
        rows: [
          ["Stays", String(s.bookingCount)],
          ["Paid by guests", money(s.bookingsTotal, s.currency)],
          ["Commission due", money(s.commissionAmount, s.currency)],
          ["Due by", d(s.dueDate)],
          ["How to pay", paymentInstructions()],
        ],
        button: { label: "See the details", path: "/dashboard/host/statements" },
        outro: ["If a statement becomes overdue, your listings are hidden from search until it's paid."],
      }, { related: { type: "CommissionStatement", id: s.id } });
    }
  });
}

export function notifyStatementPaid(id: string) {
  return safely("statement-paid", async () => {
    const s = await loadStatement(id);
    if (!s || s.status !== "PAID") return;
    await send(s.hostProfile.user.email, `Payment received: ${monthFmt.format(s.periodStart)} statement`, "statement-paid-host", {
      heading: "Thank you, payment received",
      intro: [`We've received ${money(s.commissionAmount, s.currency)} for your ${monthFmt.format(s.periodStart)} statement.`],
      button: { label: "Your statements", path: "/dashboard/host/statements" },
    }, { related: { type: "CommissionStatement", id: s.id } });
  });
}

// ---------------------------------------------------------------------------
// Daily reminders (run by /api/cron/daily). Each is sent at most once.
// ---------------------------------------------------------------------------

export async function sendDailyReminders(now = new Date()) {
  const today = todayInMaldives(now);
  const inDays = (n: number) => new Date(today.getTime() + n * DAY_MS);
  const counts = { arrival: 0, stayOutcome: 0, statementDueSoon: 0, statementOverdue: 0 };

  // Guests arriving in the next 2 days.
  await safely("arrival-reminders", async () => {
    const arriving = await prisma.booking.findMany({
      where: { status: "CONFIRMED", checkInDate: { gt: today, lte: inDays(2) } },
      select: { id: true },
    });
    for (const { id } of arriving) {
      const b = await loadBooking(id);
      if (!b) continue;
      const host = b.property.hostProfile;
      const result = await send(b.guest.email, `See you soon at ${b.property.name}`, "arrival-reminder-guest", {
        heading: "Your stay is coming up",
        intro: [`Hi ${b.guest.name}, just a reminder that your stay at ${b.property.name} starts on ${d(b.checkInDate)}.`],
        rows: [...stayRows(b), ["Host", `${host.businessName} · ${host.contactPhone}`], ...(b.property.address ? ([["Address", b.property.address]] as [string, string][]) : [])],
        button: { label: "View your booking", path: `/dashboard/traveler/trips/${b.id}` },
        outro: ["Let the host know your arrival time. Reply to this email to reach them."],
      }, { replyTo: host.user.email, dedupeKey: `arrival-reminder:${b.id}`, related: { type: "Booking", id: b.id } });
      if (result === "SENT" || result === "SKIPPED") counts.arrival += 1;
    }
  });

  // Hosts: guests who checked out in the last 3 days and haven't been marked yet.
  await safely("stay-outcome-reminders", async () => {
    const departed = await prisma.booking.findMany({
      where: { status: "CONFIRMED", checkOutDate: { gte: inDays(-3), lte: today } },
      select: { id: true },
    });
    for (const { id } of departed) {
      const b = await loadBooking(id);
      if (!b) continue;
      const result = await send(b.property.hostProfile.user.email, `Did ${b.guests[0]?.fullName ?? b.guest.name} stay? (${b.bookingReference})`, "stay-outcome-host", {
        heading: "Please confirm this stay",
        intro: [
          `${b.guests[0]?.fullName ?? b.guest.name} was due to check out of ${b.property.name} on ${d(b.checkOutDate)}. Tell us whether they stayed. If you don't answer within 7 days of check-out, the stay is counted as completed.`,
        ],
        rows: stayRows(b),
        button: { label: "Confirm the stay", path: `/dashboard/host/bookings/${b.id}` },
      }, { dedupeKey: `stay-outcome:${b.id}`, related: { type: "Booking", id: b.id } });
      if (result === "SENT" || result === "SKIPPED") counts.stayOutcome += 1;
    }
  });

  // Hosts: statements due within 3 days, and statements that have just become overdue.
  await safely("statement-reminders", async () => {
    const due = await prisma.commissionStatement.findMany({
      where: { status: "DUE", dueDate: { lte: inDays(3) } },
      select: { id: true, dueDate: true },
    });
    for (const { id, dueDate } of due) {
      const s = await loadStatement(id);
      if (!s) continue;
      const overdue = dueDate < today;
      const result = await send(
        s.hostProfile.user.email,
        overdue
          ? `Overdue: your ${monthFmt.format(s.periodStart)} statement. Listings hidden until paid`
          : `Reminder: ${monthFmt.format(s.periodStart)} statement due ${d(s.dueDate)}`,
        overdue ? "statement-overdue-host" : "statement-due-soon-host",
        {
          heading: overdue ? "Your statement is overdue" : "Your statement is due soon",
          intro: [
            overdue
              ? `Your ${monthFmt.format(s.periodStart)} commission statement was due on ${d(s.dueDate)}. Your listings are hidden from search until it's paid.`
              : `A friendly reminder that your ${monthFmt.format(s.periodStart)} commission statement is due on ${d(s.dueDate)}.`,
          ],
          rows: [
            ["Amount", money(s.commissionAmount, s.currency)],
            ["How to pay", paymentInstructions()],
          ],
          button: { label: "See your statements", path: "/dashboard/host/statements" },
        },
        { dedupeKey: `${overdue ? "statement-overdue" : "statement-due-soon"}:${s.id}`, related: { type: "CommissionStatement", id: s.id } }
      );
      if (result === "SENT" || result === "SKIPPED") counts[overdue ? "statementOverdue" : "statementDueSoon"] += 1;
    }
  });

  return counts;
}

// ---------------------------------------------------------------------------
// Anti-scam
// ---------------------------------------------------------------------------

export function notifyReportCreated(reportId: string) {
  return safely("report-created", async () => {
    const r = await prisma.listingReport.findUnique({
      where: { id: reportId },
      include: { property: { select: { name: true, hostProfile: { select: { businessName: true } } } } },
    });
    if (!r) return;
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
      select: { email: true },
    });
    const urgent = r.reason === "ASKED_TO_PAY_OUTSIDE" || r.reason === "SCAM_OR_FRAUD";
    for (const admin of admins) {
      await send(admin.email, `${urgent ? "URGENT: " : ""}Listing reported: ${r.property.name}`, "report-created-admin", {
        heading: urgent ? "Possible scam reported" : "A listing was reported",
        intro: [`Someone reported "${r.property.name}" (host: ${r.property.hostProfile.businessName}).`],
        rows: [
          ["Reason", REPORT_REASON_LABELS[r.reason]],
          ["Details", r.details],
          ["Reporter", r.reporterEmail ?? (r.reporterUserId ? "Signed-in traveler" : "Anonymous")],
        ],
        button: { label: "Review the report", path: "/dashboard/admin/reports" },
        outro: urgent ? ["If this looks real, suspend the host right away from the Hosts page. Their listings disappear immediately."] : [],
      }, { related: { type: "ListingReport", id: r.id } });
    }
  });
}

export function notifyHostSuspension(hostProfileId: string, suspended: boolean) {
  return safely("host-suspension", async () => {
    const h = await prisma.hostProfile.findUnique({
      where: { id: hostProfileId },
      select: { suspensionReason: true, user: { select: { name: true, email: true } } },
    });
    if (!h) return;
    await send(
      h.user.email,
      suspended ? "Your host account has been suspended" : "Your host account is active again",
      suspended ? "host-suspended" : "host-unsuspended",
      suspended
        ? {
            heading: "Your host account has been suspended",
            intro: [
              `Hi ${h.user.name}, our team has suspended your host account. Your listings are hidden and can't be booked while the suspension is in place.`,
            ],
            rows: h.suspensionReason ? [["Reason", h.suspensionReason]] : [],
            outro: ["Existing bookings are not cancelled automatically. Reply to this email if you think this is a mistake."],
          }
        : {
            heading: "Your host account is active again",
            intro: [`Hi ${h.user.name}, your suspension has been lifted. Your approved listings are visible and bookable again.`],
            button: { label: "Open your host dashboard", path: "/dashboard/host" },
          },
      { related: { type: "HostProfile", id: hostProfileId } }
    );
  });
}

// ---------------------------------------------------------------------------
// Admin: test the email setup
// ---------------------------------------------------------------------------

export function sendTestEmail(to: string) {
  return send(to, "Test email from Maldives Marketplace", "test", {
    heading: "Email is working",
    intro: ["If you're reading this, your site can send emails. Booking confirmations and alerts will be delivered like this one."],
    button: { label: "Open the site", path: "/" },
  });
}
