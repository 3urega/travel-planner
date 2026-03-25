import { ATOWorkspacePage } from "./_components/ato-workspace/ATOWorkspacePage";

export default function HomePage(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <ATOWorkspacePage />
    </main>
  );
}
