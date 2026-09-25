import { redirect } from "next/navigation";
import { loadHostProperty } from "./load";

/** /dashboard/host/properties/[id] opens the listing's overview step. */
export default async function PropertyIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await loadHostProperty(id);
  redirect(`/dashboard/host/properties/${id}/review`);
}
