import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "school_session";
const PROTECTED_PREFIXES = ["/admin", "/teacher", "/student", "/dashboard"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !request.cookies.has(AUTH_COOKIE_NAME)) {
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*", "/student/:path*", "/dashboard/:path*"],
};
