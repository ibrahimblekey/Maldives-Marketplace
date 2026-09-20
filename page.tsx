import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
        textAlign: "center",
        fontFamily: "var(--font-geist-sans, sans-serif)",
      }}
    >
      <h1 style={{ fontSize: "2rem", margin: 0 }}>Maldives Travel Marketplace</h1>
      <p style={{ color: "#556b70", maxWidth: 480 }}>
        Foundation milestone: database schema and authentication. Search,
        listings, and booking are coming in later milestones.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link
          href="/login"
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid #d5dde0",
            color: "#0f2a35",
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
        <Link
          href="/register"
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            background: "#0e7c86",
            color: "white",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
