import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { HostProfileInput } from "@/lib/validation/host";
import { UserFacingError } from "./errors";

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

export async function updateHostProfile(userId: string, input: HostProfileInput) {
  const result = await prisma.hostProfile.updateMany({
    where: { userId },
    data: {
      businessName: input.businessName,
      contactPhone: input.contactPhone,
      businessRegistrationNumber: input.businessRegistrationNumber ?? null,
    },
  });
  if (result.count === 0) throw new UserFacingError("Fill in your host details first.");
}
