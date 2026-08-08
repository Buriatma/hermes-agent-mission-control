import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for everything except the main API that needs it
  // Dashboard is personal — no auth wall needed
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/login' ||
    pathname === '/api/auth/signin' ||
    pathname === '/api/auth/signout'
  ) {
    return NextResponse.next();
  }

  // All dashboard pages + hermes APIs — no auth required
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
