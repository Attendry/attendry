import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userText } = body as { userText: string };

    if (!userText || typeof userText !== "string") {
      return NextResponse.json({ error: "Missing userText" }, { status: 400 });
    }

    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(userText);
    const text = result.response.text();

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Model call failed" }, { status: 500 });
  }
}
