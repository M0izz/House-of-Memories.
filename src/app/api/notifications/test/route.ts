import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { recipientName = "Maya" } = body;

    const notificationPayload = {
      title: "It's your special day! ♡",
      body: `Another year, another chapter, and countless more memories waiting to be made. Happy Birthday, ${recipientName}! ✨`,
      url: "/birthday",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: "Test notification payload prepared",
      payload: notificationPayload,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to trigger test notification" },
      { status: 500 }
    );
  }
}
