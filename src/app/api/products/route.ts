import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    const data = products.map((p) => ({
      ...p,
      stocks: p.stocks.map((s) => ({
        ...s,
        availableUnits: Math.max(0, s.totalUnits - s.reservedUnits),
      })),
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET_PRODUCTS_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
