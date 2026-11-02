import { NextResponse } from "next/server";
import { transitionSchema } from "@/domain/validation";
import { errorResponse, readJson } from "@/server/http";
import { transitionRequest } from "@/server/requests";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const input = transitionSchema.parse(await readJson(request));
    return NextResponse.json(await transitionRequest(id, input));
  } catch (error) {
    return errorResponse(error);
  }
}
