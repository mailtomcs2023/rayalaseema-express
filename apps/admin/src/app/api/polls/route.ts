import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

export async function GET() {
  const polls = await prisma.poll.findMany({
    include: { options: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(polls);
}

export async function POST(req: NextRequest) {
  const { question, options } = await req.json();
  if (!question || !options?.length) return NextResponse.json({ error: "Question and options required" }, { status: 400 });

  const poll = await prisma.poll.create({
    data: {
      question,
      options: { create: options.map((text: string) => ({ text })) },
    },
    include: { options: true },
  });
  return NextResponse.json(poll, { status: 201 });
}
