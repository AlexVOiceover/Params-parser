import { SkeletonBlock } from "@/components/ui/busy";
import { cardClass } from "@/components/ui/styles";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6" role="status">
      <span className="sr-only">Loading users…</span>
      <div>
        <SkeletonBlock className="mb-4 h-3 w-28" />
        <SkeletonBlock className="mb-2 h-7 w-24" />
        <SkeletonBlock className="h-3.5 w-80 max-w-full" />
      </div>
      <div className={`${cardClass} grid gap-x-8 gap-y-5 p-5 lg:grid-cols-2`} aria-hidden="true">
        <div className="flex flex-col gap-4">
          <SkeletonBlock className="h-5 w-28" />
          <div className="flex gap-4">
            <SkeletonBlock className="h-9 flex-1 rounded-lg" />
            <SkeletonBlock className="h-9 w-40 rounded-lg" />
          </div>
          <SkeletonBlock className="h-8 w-44 rounded-lg" />
        </div>
        <SkeletonBlock className="h-36 rounded-lg" />
      </div>
      <div className={`${cardClass} divide-y divide-border`} aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <SkeletonBlock className="h-3.5 w-52 max-w-full" />
            <SkeletonBlock className="ml-auto hidden h-9 w-36 rounded-lg sm:block" />
            <SkeletonBlock className="h-8 w-8 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
