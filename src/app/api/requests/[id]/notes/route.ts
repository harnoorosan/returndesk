import { NextResponse } from "next/server";
import { noteSchema } from "@/domain/validation";
import { errorResponse, readJson } from "@/server/http";
import { addNote } from "@/server/requests";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const input = noteSchema.parse(await readJson(request));
    return NextResponse.json(await addNote(id, input), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
