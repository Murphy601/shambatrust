import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import { createAdvocateApplication } from "@/lib/db/store";

const schema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(9),
  email: z.string().email(),
  lskNumber: z.string().min(3),
  idFrontName: z.string().min(1),
  idFrontPath: z.string().min(1),
  idBackName: z.string().min(1),
  idBackPath: z.string().min(1),
  lskCertName: z.string().min(1),
  lskCertPath: z.string().min(1),
  officeAddress: z.string().optional().default(""),
  lawFirm: z.string().optional().default(""),
  organization: z.string().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Complete all required fields: name, phone, email, LSK number, ID front/back, and LSK certificate.",
        },
        { status: 400 },
      );
    }

    const phone = normalizeKenyanPhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "Use a valid Kenyan phone (+2547… / 07…)." },
        { status: 400 },
      );
    }

    const application = await createAdvocateApplication({
      ...parsed.data,
      phone,
    });

    return NextResponse.json({ application: { id: application.id, status: application.status } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not submit application." },
      { status: 400 },
    );
  }
}
