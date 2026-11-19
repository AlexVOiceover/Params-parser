import { SkeletonBlock } from "@/components/ui/busy";
import { cardClass } from "@/components/ui/styles";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6" role="status">
      <span className="sr-only">Loading proposals…</span>
      <div>
        <SkeletonBlock className="mb-2 h-7 w-28" />
        <SkeletonBlock className="h-3.5 w-full max-w-xl" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cardClass} aria-hidden="true">
            <div className="px-4 pb-3.5 pt-4 sm:px-5">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="mt-2.5 h-3.5 w-72 max-w-full" />
              <SkeletonBlock className="mt-3.5 h-3.5 w-96 max-w-full" />
            </div>
            <div className="flex items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
              <SkeletonBlock className="h-8 w-24 rounded-lg" />
              <SkeletonBlock className="h-8 w-36 rounded-lg" />
              <SkeletonBlock className="ml-auto h-8 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
