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
    <div className={cn("flex min-h-screen flex-col", className)}>
      {header}
      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-6 px-4 pb-10 pt-6 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(260px,300px)] lg:gap-8 lg:px-8">
        <aside className="order-2 flex min-h-0 flex-col gap-4 lg:order-1 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto">
          {sidebar}
        </aside>
        <main className="order-1 flex min-h-0 flex-col gap-6 lg:order-2">
          {center}
        </main>
        <aside className="order-3 flex min-h-0 flex-col gap-4 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto">
          {inspector}
        </aside>
      </div>
    </div>
  );
}
