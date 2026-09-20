import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * /dashboard sends the signed-in user to their role-specific area. It does
 * no other work, so it can't be the thing that "authorizes" access to
 * anything — each destination page independently re-checks the role.
 */
export default async function DashboardIndexPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  switch (session.user.role) {
    case "TRAVELER":
      redirect("/dashboard/traveler");
    case "HOST":
      redirect("/dashboard/host");
    case "ADMIN":
    case "SUPER_ADMIN":
      redirect("/dashboard/admin");
    default:
      redirect("/login");
  }
}
