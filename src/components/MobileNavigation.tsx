"use client";

import { Armchair, Ruler } from "lucide-react";
import { FurnitureCatalog } from "@/components/FurnitureCatalog";
import { RoomBasket } from "@/components/RoomBasket";
import { RoomConfiguration } from "@/components/RoomConfiguration";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const triggerClassName = "flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700";

export function MobileNavigation() {
  return (
    <nav
      aria-label="Room planner tools"
      className="flex lg:hidden fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-xl border-t border-slate-200 z-50 p-4 justify-around"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <Sheet>
        <SheetTrigger className={triggerClassName}>
          <Ruler size={18} aria-hidden="true" /> Room Setup
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-4 pb-8 overflow-y-auto" style={{ height: "80vh", backgroundColor: "white" }}>
          <SheetTitle className="shrink-0 pr-8 pt-6">Room Setup</SheetTitle>
          <SheetDescription className="sr-only">Set room dimensions, wall colour and flooring, and review your furniture estimate.</SheetDescription>
          <div className="shrink-0">
            <RoomConfiguration />
            <RoomBasket />
          </div>
        </SheetContent>
      </Sheet>
      <Sheet>
        <SheetTrigger className={triggerClassName}>
          <Armchair size={18} aria-hidden="true" /> Add Furniture
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-4 pb-8 overflow-y-auto" style={{ height: "80vh", backgroundColor: "white" }}>
          <SheetTitle className="shrink-0 pr-8 pt-6">Add Furniture</SheetTitle>
          <SheetDescription className="sr-only">Search the furniture catalog and choose pieces for your room.</SheetDescription>
          <div className="min-h-0 flex-1">
            <FurnitureCatalog />
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
