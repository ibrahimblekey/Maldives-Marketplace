import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation/auth";
import { registerTraveler, EmailAlreadyRegisteredError } from "@/server/services/user-service";
import { assertNotRateLimited, getClientIp, recordLoginAttempt, RateLimitError } from "@/server/auth/rate-limit";

export async function POST(request: Request) {
  const ipAddress = getClientIp(request.headers);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  // Reuses the login-attempt rate limiter, keyed by the submitted email and
  // by IP, to slow down both targeted and bulk automated account creation.
  try {
    await assertNotRateLimited(email, ipAddress);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    throw err;
  }

  try {
    const user = await registerTraveler(parsed.data);
    await recordLoginAttempt({ email, ipAddress, success: true, userId: user.id });

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
      { status: 201 }
    );
  } catch (err) {
    await recordLoginAttempt({ email, ipAddress, success: false });

    if (err instanceof EmailAlreadyRegisteredError) {
      // Deliberately vague: confirms an account exists for this email,
      // which is an acceptable, common trade-off for registration forms
      // (unlike login, where we never confirm/deny account existence).
      return NextResponse.json({ error: err.message }, { status: 409 });
    }

    console.error("Registration failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
