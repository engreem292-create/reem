import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { error } = await supabase.auth.getSession();

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Supabase connection is working!",
  });
}