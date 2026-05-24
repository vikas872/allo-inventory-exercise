import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { withIdempotency } from "@/lib/redis";
import { addMinutes } from "date-fns";


const reserveSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = reserveSchema.safeParse(body);
    
    if (!parsed.success) {
      return new NextResponse("Invalid request data", { status: 400 });
    }

    const { productId, warehouseId, quantity } = parsed.data;
    const idempotencyKey = req.headers.get("Idempotency-Key");

    const performReservation = async () => {

      const stock = await prisma.stock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId,
          },
        },
      });

      if (!stock) {
        return new NextResponse("Stock not found", { status: 404 });
      }

      try {
          const reservation = await prisma.$transaction(async (tx) => {
            await tx.stock.update({
            where: { id: stock.id },
            data: {
              reservedUnits: {
                increment: quantity,
              },
            },
          });

          return await tx.reservation.create({
            data: {
              stockId: stock.id,
              quantity,
              status: "PENDING",
              expiresAt: addMinutes(new Date(), 10), // 10 minute expiry
              idempotencyKey,
            },
          });
        });

        return NextResponse.json(reservation);
      } catch (error: any) {
        if (error.code === 'P2004' || error.message.includes('check constraint')) {
          return new NextResponse("Not enough stock available", { status: 409 });
        }
        
        console.error("[RESERVE_TRANSACTION_ERROR]", error);
        return new NextResponse("Not enough stock available", { status: 409 });
      }
    };

    if (idempotencyKey) {
      return await withIdempotency(idempotencyKey, performReservation);
    }

    return performReservation();
  } catch (error) {
    console.error("[POST_RESERVATIONS_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
