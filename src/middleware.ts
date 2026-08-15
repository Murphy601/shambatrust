import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth/constants";

function getSecret() {
  const secret =
    process.env.AUTH_SECRET || "shambatrust-dev-secret-change-me-in-production";
  return new TextEncoder().encode(secret);
}

async function readToken(request: NextRequest): Promise<{
  ok: boolean;
  role?: string;
}> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return { ok: false };
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { ok: true, role: String(payload.role || "") };
  } catch {
    return { ok: false };
  }
}

function homeForRole(role?: string) {
  if (role === "advocate") return "/advocate";
  if (role === "admin") return "/ops";
  return "/vault";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readToken(request);

  if (pathname.startsWith("/ops/login")) {
    if (session.ok && session.role === "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/ops";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/ops")) {
    if (!session.ok) {
      const url = request.nextUrl.clone();
      url.pathname = "/ops/login";
      return NextResponse.redirect(url);
    }
    if (session.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = homeForRole(session.role);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Separate advocate portal login (public)
  if (pathname.startsWith("/advocate/login")) {
    if (session.ok && session.role === "advocate") {
      const url = request.nextUrl.clone();
      url.pathname = "/advocate";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/vault") && !session.ok) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/advocate") && !session.ok) {
    const url = request.nextUrl.clone();
    url.pathname = "/advocate/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/advocate") && session.ok && session.role !== "advocate") {
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(session.role);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/vault") && session.ok) {
    if (session.role === "advocate" || session.role === "admin") {
      const url = request.nextUrl.clone();
      url.pathname = homeForRole(session.role);
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/login" && session.ok) {
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(session.role);
    return NextResponse.redirect(url);
  }

  if (pathname === "/signup" && session.ok) {
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(session.role);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/vault/:path*",
    "/advocate/:path*",
    "/ops",
    "/ops/:path*",
    "/login",
    "/signup",
  ],
};
