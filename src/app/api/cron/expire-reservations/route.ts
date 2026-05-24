import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (expiredReservations.length === 0) {
      return NextResponse.json({ message: "No expired reservations to process." });
    }

    let count = 0;
    for (const reservation of expiredReservations) {
      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "RELEASED" },
        });

        await tx.stock.update({
          where: { id: reservation.stockId },
          data: {
            reservedUnits: { decrement: reservation.quantity },
          },
        });
      });
      count++;
    }

    return NextResponse.json({ message: `Successfully expired ${count} reservations.` });
  } catch (error) {
    console.error("[CRON_EXPIRE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
