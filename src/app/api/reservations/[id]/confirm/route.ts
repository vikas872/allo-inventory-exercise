import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withIdempotency } from "@/lib/redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idempotencyKey = req.headers.get("Idempotency-Key");

    const performConfirm = async () => {
      const reservation = await prisma.reservation.findUnique({
        where: { id },
        include: { stock: true },
      });

      if (!reservation) {
        return new NextResponse("Reservation not found", { status: 404 });
      }

      if (reservation.status === "CONFIRMED") {
        return NextResponse.json(reservation); // Already confirmed, return as success
      }

      if (reservation.status === "RELEASED") {
        return new NextResponse("Reservation already released", { status: 400 });
      }

      if (new Date() > new Date(reservation.expiresAt)) {
        return new NextResponse("Reservation has expired", { status: 410 });
      }

      const confirmedReservation = await prisma.$transaction(async (tx) => {
        await tx.stock.update({
          where: { id: reservation.stockId },
          data: {
            totalUnits: { decrement: reservation.quantity },
            reservedUnits: { decrement: reservation.quantity },
          },
        });

        return await tx.reservation.update({
          where: { id },
          data: { status: "CONFIRMED" },
        });
      });

      return NextResponse.json(confirmedReservation);
    };

    if (idempotencyKey) {
      return await withIdempotency(idempotencyKey, performConfirm);
    }

    return performConfirm();
  } catch (error) {
    console.error("[CONFIRM_RESERVATION_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
