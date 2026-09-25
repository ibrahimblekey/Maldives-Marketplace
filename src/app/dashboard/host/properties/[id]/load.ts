import { cache } from "react";
import { notFound } from "next/navigation";
import { requireHost } from "@/server/auth/page-guards";
import { NotFoundError } from "@/server/services/errors";
import { canEdit, getHostProperty } from "@/server/services/property-service";

/**
 * Loads a property for any page of the listing wizard: re-checks the HOST
 * role and that the property belongs to this host (someone else's property
 * id is a plain 404). Wrapped in React's cache() so the layout and the page
 * of one request share a single database read. Every page calls this
 * itself — a layout's check alone doesn't protect the page under it.
 */
export const loadHostProperty = cache(async (propertyId: string) => {
  const session = await requireHost(`/dashboard/host/properties/${propertyId}`);
  try {
    const property = await getHostProperty(session.user.id, propertyId);
    return {
      session,
      property,
      editable: canEdit(property.status),
      isLive: property.status === "APPROVED",
    };
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
});
