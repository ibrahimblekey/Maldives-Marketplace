import { Prisma, type HostVerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { HostProfileInput } from "@/lib/validation/host";
import { UserFacingError } from "./errors";
import { samePhone } from "./verification-service";

/**
 * Host onboarding. Every account starts as a TRAVELER (see
 * user-service.ts); a traveler becomes a HOST only by filling in host
 * details here, which creates their HostProfile and changes their role in
 * the same transaction. Admin accounts can't turn themselves into hosts.
 */

export async function getHostProfile(userId: string) {
  return prisma.hostProfile.findUnique({ where: { userId } });
}

export async function becomeHost(userId: string, input: HostProfileInput) {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, hostProfile: { select: { id: true } } },
    });
    if (!user || !user.isActive) throw new UserFacingError("Your account can't be found.");
    if (user.role !== "TRAVELER" && user.role !== "HOST") {
      throw new UserFacingError("Admin accounts can't become hosts. Register a separate account.");
    }
    if (user.hostProfile) throw new UserFacingError("You're already registered as a host.");

    try {
      await tx.hostProfile.create({
        data: {
          userId,
          businessName: input.businessName,
          contactPhone: input.contactPhone,
          businessRegistrationNumber: input.businessRegistrationNumber ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new UserFacingError("You're already registered as a host.");
      }
      throw err;
    }
    await tx.user.update({ where: { id: userId }, data: { role: "HOST" } });
  });
}

/**
 * While a host's verification is waiting for review or approved, the
 * business name (shown to travelers) and contact phone (confirmed by our
 * team) are what the admin checked, so the host can't change them.
 */
export function hostDetailsLocked(host: { verificationStatus: HostVerificationStatus }) {
  return host.verificationStatus === "UNDER_REVIEW" || host.verificationStatus === "APPROVED";
}

export async function updateHostProfile(userId: string, input: HostProfileInput) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "HostProfile" WHERE "userId" = ${userId} FOR UPDATE`;
    const host = await tx.hostProfile.findUnique({ where: { userId } });
    if (!host) throw new UserFacingError("Fill in your host details first.");
    if (hostDetailsLocked(host) && (host.businessName !== input.businessName || !samePhone(host.contactPhone, input.contactPhone))) {
      throw new UserFacingError(
        host.verificationStatus === "APPROVED"
          ? "Your business name and phone number were checked when you were verified, so they can't be changed here. Contact support to change them."
          : "Your verification is waiting for review. Withdraw it on the Verification page before changing your business name or phone number."
      );
    }
    await tx.hostProfile.update({
      where: { id: host.id },
      data: {
        businessName: input.businessName,
        contactPhone: input.contactPhone,
        businessRegistrationNumber: input.businessRegistrationNumber ?? null,
      },
    });
  });
}
