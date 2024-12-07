import { NextResponse } from "next/server";
import { openai } from "@/app/openai";

export const runtime = "nodejs";

// Send a new message to a thread
export async function POST(request, { params: { threadId } }) {
  try {
    const { role, content } = await request.json();

    const message = await openai.beta.threads.messages.create(threadId, {
      role: role || "user",
      content: content,
    });

    console.log("Added message:", message);

    return NextResponse.json({ messageId: message.id });
  } catch (error: any) {
    console.error("Error adding message:", error);
    const errorMessage = error?.message || "An unknown error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(request, { params: { threadId } }) {
  try {
    const threadMessages = await openai.beta.threads.messages.list(threadId);

    console.log(threadMessages.data);

    return NextResponse.json(threadMessages.data);
  } catch (error: any) {
    return NextResponse.json(
      { error: "An unknown error occurred." },
      { status: 500 }
    );
  }
}
