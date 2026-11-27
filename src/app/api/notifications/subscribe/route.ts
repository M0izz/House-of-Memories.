import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subscription, userId, userAgent } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Invalid subscription payload" },
        { status: 400 }
      );
    }

    // In production with Supabase or Cloudflare D1, save subscription:
    // await db.insert(pushSubscriptions).values({ ... })

    return NextResponse.json({
      success: true,
      message: "Push subscription registered successfully",
      endpoint: subscription.endpoint,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save subscription" },
      { status: 500 }
    );
  }
}
