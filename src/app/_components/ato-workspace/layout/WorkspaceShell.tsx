import * as React from "react";

import { cn } from "@/lib/utils";

export function WorkspaceShell({
  header,
  sidebar,
  center,
  inspector,
  className,
}: {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  center: React.ReactNode;
  inspector: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col overflow-x-hidden bg-background",
        className,
      )}
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute inset-0 bg-background" />
        <div
          className="absolute -left-[18%] top-[-32%] h-[82vh] w-[68vw] rounded-full opacity-100"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in srgb, var(--card) 40%, #faf6ef) 0%, transparent 62%)",
            animation: "ato-breathe 16s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-[-22%] right-[-12%] h-[70vh] w-[58vw] rounded-full opacity-95"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in srgb, var(--primary) 6%, transparent) 0%, transparent 58%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "linear-gradient(color-mix(in srgb, var(--foreground) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--foreground) 6%, transparent) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {header}

      <div className="relative mx-auto grid w-full max-w-[1680px] flex-1 grid-cols-1 gap-8 px-4 pb-16 pt-8 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(240px,280px)] lg:gap-10 lg:px-10">
        <aside className="order-2 flex min-h-0 flex-col gap-5 lg:order-1 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pt-1">
          <p className="ato-kicker hidden px-0.5 lg:block">Tu expediente</p>
          {sidebar}
        </aside>

        <main className="order-1 flex min-h-0 flex-col lg:order-2 lg:pt-0">
          <div className="relative mx-auto w-full max-w-[760px] lg:max-w-[820px]">
            <div
              className="pointer-events-none absolute -left-6 top-4 hidden h-[calc(100%-2rem)] w-px bg-gradient-to-b from-transparent via-primary-border to-transparent lg:block"
              aria-hidden
            />
            {center}
          </div>
        </main>

        <aside className="order-3 flex min-h-0 flex-col gap-5 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pt-1">
          <p className="ato-kicker hidden px-0.5 lg:block">Memoria del sistema</p>
          {inspector}
        </aside>
      </div>
    </div>
  );
}
