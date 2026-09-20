"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      style={{
        background: "transparent",
        border: "1px solid #d5dde0",
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: "0.875rem",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
