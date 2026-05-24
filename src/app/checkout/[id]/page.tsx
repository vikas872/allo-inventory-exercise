"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  
  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    fetch(`/api/reservations/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setReservation(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Reservation not found");
        router.push("/");
      });
  }, [id, router]);

  useEffect(() => {
    if (!reservation || reservation.status !== "PENDING") return;

    const expiry = new Date(reservation.expiresAt).getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = expiry - now;
      
      if (difference <= 0) {
        clearInterval(interval);
        setTimeLeft(0);
        setReservation((prev: any) => ({ ...prev, status: "EXPIRED" }));
        toast.error("Reservation has expired");
      } else {
        setTimeLeft(Math.floor(difference / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation]);

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": `confirm-${id}` }
      });
      
      if (!res.ok) {
        if (res.status === 410) {
          toast.error("Reservation expired. You were too late.");
          setReservation((prev: any) => ({ ...prev, status: "EXPIRED" }));
        } else {
          toast.error("Failed to confirm purchase.");
        }
        return;
      }
      
      toast.success("Purchase confirmed successfully!");
      setReservation((prev: any) => ({ ...prev, status: "CONFIRMED" }));
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
        headers: { "Idempotency-Key": `release-${id}` }
      });
      
      if (res.ok) {
        toast.success("Reservation released.");
        setReservation((prev: any) => ({ ...prev, status: "RELEASED" }));
      } else {
        toast.error("Failed to release reservation.");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setProcessing(false);
      router.push("/");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-20 flex justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          <p className="text-muted-foreground">Loading checkout...</p>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="container mx-auto py-20 px-4 max-w-2xl flex justify-center">
      <Card className="w-full glass border-border/50 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl font-bold tracking-tight">Checkout</CardTitle>
          <CardDescription className="text-lg">Complete your purchase to secure your item.</CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6">
          <div className="bg-secondary/30 rounded-xl p-6 border border-border/40 space-y-6">
            <div className="flex justify-between items-center pb-6 border-b border-border/50">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Product</p>
                <p className="font-semibold text-xl">{reservation.stock?.product?.name || "Premium Item"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Quantity</p>
                <p className="font-semibold text-xl">{reservation.quantity}</p>
              </div>
            </div>

            {reservation.status === "PENDING" && (
              <div className="flex flex-col items-center justify-center py-6 bg-background/50 rounded-lg border border-primary/20 shadow-inner">
                <p className="text-sm text-muted-foreground mb-2">Reservation expires in</p>
                <div className="text-5xl font-mono font-bold text-primary tracking-tighter">
                  {formatTime(timeLeft)}
                </div>
              </div>
            )}

            {reservation.status === "CONFIRMED" && (
              <div className="flex flex-col items-center py-8 text-green-500">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Order Confirmed!</h3>
                <p className="text-muted-foreground mt-2">Your item is secured.</p>
              </div>
            )}

            {(reservation.status === "RELEASED" || reservation.status === "EXPIRED") && (
              <div className="flex flex-col items-center py-8 text-destructive">
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Reservation Ended</h3>
                <p className="text-muted-foreground mt-2">This reservation is no longer valid.</p>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex gap-4 pt-4 pb-8 px-8">
          {reservation.status === "PENDING" ? (
            <>
              <Button 
                variant="outline" 
                className="w-full text-base h-12" 
                onClick={handleCancel}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button 
                className="w-full text-base h-12 font-semibold" 
                onClick={handleConfirm}
                disabled={processing || timeLeft === 0}
              >
                {processing ? "Processing..." : "Confirm Purchase"}
              </Button>
            </>
          ) : (
            <Button 
              className="w-full text-base h-12" 
              onClick={() => router.push("/")}
            >
              Back to Products
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
