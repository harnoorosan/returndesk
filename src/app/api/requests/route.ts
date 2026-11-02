import { NextResponse, type NextRequest } from "next/server";
import { createRequestSchema, listQuerySchema } from "@/domain/validation";
import { errorResponse, readJson } from "@/server/http";
import { createRequest, listRequests } from "@/server/requests";

export async function GET(request: NextRequest) {
  try {
    const query = listQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    return NextResponse.json(await listRequests(query));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createRequestSchema.parse(await readJson(request));
    return NextResponse.json(await createRequest(input), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
