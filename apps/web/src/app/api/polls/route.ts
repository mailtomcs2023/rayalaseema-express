import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

// GET active poll
export async function GET() {
  try {
  const poll = await prisma.poll.findFirst({
    where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: { options: { orderBy: { id: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  if (!poll) return NextResponse.json(null);

  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
  return NextResponse.json({
    id: poll.id,
    question: poll.question,
    totalVotes,
    options: poll.options.map((o) => ({
      id: o.id,
      text: o.text,
      votes: o.votes,
      percentage: totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0,
    })),
  });
  } catch {
    return NextResponse.json(null);
  }
}

// POST vote
export async function POST(req: NextRequest) {
  const { optionId } = await req.json();
  if (!optionId) return NextResponse.json({ error: "Option required" }, { status: 400 });

  await prisma.pollOption.update({
    where: { id: optionId },
    data: { votes: { increment: 1 } },
  });

  return NextResponse.json({ success: true });
}
