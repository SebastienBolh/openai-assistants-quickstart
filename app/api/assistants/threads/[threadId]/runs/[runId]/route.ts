import { NextResponse } from "next/server";
import OpenAI from "openai";
import { NextRequest } from "next/server";

interface Params {
  params: {
    threadId: string;
    runId: string;
  };
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const { threadId, runId } = params;

    const run = await openai.beta.threads.runs.retrieve(threadId, runId);

    return NextResponse.json(run);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
