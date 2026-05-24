"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Stock = {
  id: string;
  warehouseId: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
  warehouse: { id: string; name: string };
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stocks: Stock[];
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load products");
        setLoading(false);
      });
  }, []);

  const handleReserve = async (productId: string, warehouseId: string) => {
    setReservingId(productId);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });

      if (!res.ok) {
        if (res.status === 409) {
          toast.error("Not enough stock available. Someone might have just taken it!");
        } else {
          toast.error("Failed to reserve the item.");
        }
        return;
      }

      const reservation = await res.json();
      toast.success("Item reserved! Redirecting to checkout...");
      router.push(`/checkout/${reservation.id}`);
    } catch (error) {
      toast.error("An unexpected error occurred.");
    } finally {
      setReservingId(null);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-7xl">
      <div className="flex flex-col space-y-4 mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Latest Arrivals
        </h1>
        <p className="text-muted-foreground text-lg max-w-[700px]">
          Discover our exclusive collection. Items are limited and high in demand.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[400px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => {
            const totalAvailable = product.stocks.reduce((acc, s) => acc + s.availableUnits, 0);

            return (
              <Card key={product.id} className="flex flex-col overflow-hidden border-border/50 glass hover:border-primary/30 transition-all duration-300">
                <div className="aspect-video w-full relative bg-muted overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="object-cover w-full h-full hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-tr from-primary/20 to-secondary/20">
                      <span className="text-primary/50 font-medium">No Image</span>
                    </div>
                  )}
                  {totalAvailable === 0 && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                      <Badge variant="destructive" className="text-lg py-1 px-4">Out of Stock</Badge>
                    </div>
                  )}
                </div>
                
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl">{product.name}</CardTitle>
                      <CardDescription className="mt-2 line-clamp-2">{product.description}</CardDescription>
                    </div>
                    <span className="text-xl font-bold">${product.price.toFixed(2)}</span>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Availability</h4>
                    {product.stocks.map((stock) => (
                      <div key={stock.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40">
                        <span className="font-medium">{stock.warehouse.name}</span>
                        <div className="flex items-center gap-3">
                          <Badge variant={stock.availableUnits > 0 ? "secondary" : "outline"} className="font-mono">
                            {stock.availableUnits} left
                          </Badge>
                          <Button 
                            size="sm" 
                            disabled={stock.availableUnits === 0 || reservingId === product.id}
                            onClick={() => handleReserve(product.id, stock.warehouseId)}
                            className="w-20 transition-all active:scale-95"
                          >
                            {reservingId === product.id ? "..." : "Reserve"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
