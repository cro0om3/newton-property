import { NextResponse, type NextRequest } from "next/server";
import { sessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname === "/" ||
    pathname === "/api/auth/login" ||
    pathname === "/newton-logo.png" ||
    pathname === "/api/meta/callback" ||
    pathname === "/api/meta/webhook" ||
    /^\/api\/official\/[^/]+\/callback$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("pd_session")?.value;
  const expected = await sessionToken();
  if (token && token === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
