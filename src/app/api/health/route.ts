import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";

export async function GET() {
  try {
    await connectToDatabase();

    return NextResponse.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        database: "disconnected",
        error:
          error instanceof Error
            ? error.message
            : "Unknown startup configuration error",
      },
      { status: 500 },
    );
  }
}
