import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const sitePassword = process.env.SITE_PASSWORD;

    if (!sitePassword) {
      // No password configured — allow access
      return NextResponse.json({ authenticated: true });
    }

    if (password === sitePassword) {
      return NextResponse.json({ authenticated: true });
    }

    return NextResponse.json({ authenticated: false, error: "Invalid password" }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ authenticated: false, error: "Invalid request" }, { status: 400 });
  }
}
