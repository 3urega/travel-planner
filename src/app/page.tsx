import { ATOView } from "./_components/ATOView";

export default function HomePage(): React.ReactElement {
  return (
    <main className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <ATOView />
    </main>
  );
}
