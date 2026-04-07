import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { hash } from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, phone, password, dateOfBirth, gender, address, city, pincode,
      primaryDistrict, aadhaarNumber, aadhaarFrontUrl, aadhaarBackUrl, panNumber, panCardUrl,
      photoUrl, upiId, bankName, bankAccount, bankIfsc, experience } = body;

    if (!fullName || !email || !phone || !password) {
      return NextResponse.json({ error: "Name, email, phone, password required" }, { status: 400 });
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 400 });

    // Create user
    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name: fullName, passwordHash, role: "REPORTER", phone, active: true },
    });

    // Create journalist profile with KYC
    const hasDocuments = aadhaarFrontUrl || panCardUrl || photoUrl;

    await prisma.journalistProfile.create({
      data: {
        userId: user.id,
        fullName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender, address, city, pincode,
        primaryDistrict: primaryDistrict || null,
        kycStatus: hasDocuments ? "SUBMITTED" : "PENDING",
        aadhaarNumber, aadhaarFrontUrl, aadhaarBackUrl,
        panNumber, panCardUrl, photoUrl,
        upiId, bankName, bankAccount, bankIfsc,
        experience,
        languages: ["Telugu"],
      },
    });

    return NextResponse.json({
      success: true,
      message: "Registration successful. KYC under review.",
      userId: user.id,
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
