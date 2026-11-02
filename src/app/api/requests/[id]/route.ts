import { NextResponse } from "next/server";
import { updateRequestSchema } from "@/domain/validation";
import { errorResponse, readJson } from "@/server/http";
import { getRequest, removeRequest, updateRequest } from "@/server/requests";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await getRequest(id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const input = updateRequestSchema.parse(await readJson(request));
    return NextResponse.json(await updateRequest(id, input));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await removeRequest(id));
  } catch (error) {
    return errorResponse(error);
  }
}
