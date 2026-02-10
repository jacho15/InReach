import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (
    pathname.startsWith("/auth") ||
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
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            req.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
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
