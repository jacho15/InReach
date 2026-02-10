import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/login") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Extension API routes: validate via API key (handled in route handlers)
  if (pathname.startsWith("/api/ext")) {
    return NextResponse.next();
  }

  // Dashboard API routes and pages: require session
  const token = await getToken({ req });
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/campaigns/:path*",
    "/templates/:path*",
    "/contacts/:path*",
    "/activity/:path*",
    "/api/settings/:path*",
    "/api/keys/:path*",
    "/api/templates/:path*",
    "/api/campaigns/:path*",
    "/api/contacts/:path*",
    "/api/activity/:path*",
    "/api/dashboard/:path*",
    "/api/ext/:path*",
  ],
};
