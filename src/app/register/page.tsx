"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { safeCallbackUrl } from "@/lib/safe-redirect";
import styles from "../auth-forms.module.css";

function RegisterForm() {
  const router = useRouter();
  // Where to continue after signing up, e.g. back to a booking in progress.
  const callbackUrl = safeCallbackUrl(useSearchParams().get("callbackUrl"));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        setIsSubmitting(false);
        return;
      }

      // Registration succeeded — sign in immediately so the user lands
      // straight in their dashboard instead of having to log in again.
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      setIsSubmitting(false);

      if (signInResult?.error) {
        // Account was created but auto sign-in failed for some reason —
        // send them to log in manually rather than showing a false error.
        router.push(callbackUrl === "/dashboard" ? "/login" : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Create your account</h1>

        <label className={styles.label}>
          Full name
          <input
            className={styles.input}
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className={styles.label}>
          Email
          <input
            className={styles.input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className={styles.label}>
          Password
          <input
            className={styles.input}
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className={styles.hint}>
            At least 10 characters, with an uppercase letter, a lowercase letter, and a number.
          </span>
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.button} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>

        <p className={styles.footerText}>
          Already have an account? <Link href={callbackUrl === "/dashboard" ? "/login" : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Sign in</Link>
        </p>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
