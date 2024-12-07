import { NextResponse } from "next/server";
import OpenAI from "openai";
import { NextRequest } from "next/server";

interface Params {
  params: {
    threadId: string;
  };
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { threadId } = params;
    const { instructions } = await request.json();

    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID!,
      instructions: instructions || "",
    });

    return NextResponse.json({ runId: run.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
