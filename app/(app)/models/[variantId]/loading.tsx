import { SkeletonBlock, SkeletonRows } from "@/components/ui/busy";
import { cardClass } from "@/components/ui/styles";

// A block straight on the grey page needs to be a touch darker than one on a white card to show.
const ON_PAGE = "brightness-95";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div>
        <SkeletonBlock className={`mb-5 h-3.5 w-24 ${ON_PAGE}`} />
        <SkeletonBlock className={`h-8 w-72 max-w-full ${ON_PAGE}`} />
        <SkeletonBlock className={`mt-2.5 h-3.5 w-full max-w-xl ${ON_PAGE}`} />
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <SkeletonBlock className={`h-5 w-24 ${ON_PAGE}`} />
          <SkeletonBlock className={`mt-2 h-3 w-72 max-w-full ${ON_PAGE}`} />
        </div>
        <SkeletonRows lines={2} className="pl-11" />
      </div>
      <div className="flex flex-col gap-4" aria-hidden="true">
        <SkeletonBlock className={`h-5 w-52 ${ON_PAGE}`} />
        <div className={`${cardClass} divide-y divide-border`}>
          {Array.from({ length: 4 }).map((_, row) => (
            <div key={row} className="flex items-center gap-4 px-4 py-3.5">
              <SkeletonBlock className="h-3.5 w-32" />
              <SkeletonBlock className="hidden h-3.5 w-28 sm:block" />
              <SkeletonBlock className="ml-auto h-5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
