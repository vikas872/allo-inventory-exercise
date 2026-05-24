import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany();
    return NextResponse.json(warehouses);
  } catch (error) {
    console.error("[GET_WAREHOUSES_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
