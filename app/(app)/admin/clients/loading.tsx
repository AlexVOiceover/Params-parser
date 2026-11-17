import { SkeletonBlock } from "@/components/ui/busy";
import { cardClass } from "@/components/ui/styles";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6" role="status">
      <span className="sr-only">Loading clients…</span>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="mb-2 h-7 w-28" />
          <SkeletonBlock className="h-3.5 w-full max-w-xl" />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <SkeletonBlock className="h-9 flex-1 rounded-lg sm:w-60 sm:flex-none" />
          <SkeletonBlock className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="ml-4 hidden h-3 w-12 sm:block" />
        <div className={`${cardClass} divide-y divide-border`} aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 sm:py-2.5">
              <SkeletonBlock className="h-8 w-8 shrink-0 rounded-lg" />
              <SkeletonBlock className="h-3.5 w-40" />
              <SkeletonBlock className="ml-auto h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
