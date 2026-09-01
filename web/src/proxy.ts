import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "liberia360_session";

export async function proxy(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  if (!request.cookies.has(SESSION_COOKIE))
    return NextResponse.redirect(loginUrl);

  try {
    // Validate the signed cookie with the API before any protected route is
    // rendered. Admin routes additionally require a current server-side role.
    const response = await fetch(new URL("/api/v1/auth/me", request.url), {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.redirect(loginUrl);
    if (request.nextUrl.pathname.startsWith("/admin")) {
      const user = (await response.json()) as {
        isAdmin?: boolean;
        isSuperAdmin?: boolean;
      };
      if (!user.isAdmin && !user.isSuperAdmin)
        return NextResponse.redirect(new URL("/account", request.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
