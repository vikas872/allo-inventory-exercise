import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        stock: {
          include: {
            product: true,
            warehouse: true,
          }
        }
      }
    });

    if (!reservation) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error("[GET_RESERVATION_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
