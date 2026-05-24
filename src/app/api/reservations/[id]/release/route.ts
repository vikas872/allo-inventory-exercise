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

    const performRelease = async () => {
      const reservation = await prisma.reservation.findUnique({
        where: { id },
      });

      if (!reservation) {
        return new NextResponse("Reservation not found", { status: 404 });
      }

      if (reservation.status !== "PENDING") {
        return new NextResponse("Only pending reservations can be released", { status: 400 });
      }

      const releasedReservation = await prisma.$transaction(async (tx) => {
        await tx.stock.update({
          where: { id: reservation.stockId },
          data: {
            reservedUnits: { decrement: reservation.quantity },
          },
        });

        return await tx.reservation.update({
          where: { id },
          data: { status: "RELEASED" },
        });
      });

      return NextResponse.json(releasedReservation);
    };

    if (idempotencyKey) {
      return await withIdempotency(idempotencyKey, performRelease);
    }

    return performRelease();
  } catch (error) {
    console.error("[RELEASE_RESERVATION_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
