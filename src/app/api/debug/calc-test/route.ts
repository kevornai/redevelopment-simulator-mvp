import { NextRequest, NextResponse } from "next/server";
import { calculateAnalysis } from "@/app/actions/calculate";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await calculateAnalysis(body);
  return NextResponse.json(result);
}
