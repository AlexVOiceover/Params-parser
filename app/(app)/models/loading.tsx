import { SkeletonBlock } from "@/components/ui/busy";
import { cardClass } from "@/components/ui/styles";

const VARIANTS_PER_CARD = [1, 1, 2, 1];

// A block straight on the grey page needs to be a touch darker than one on a white card to show.
const ON_PAGE = "brightness-95";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div>
        <SkeletonBlock className={`h-8 w-32 ${ON_PAGE}`} />
        <SkeletonBlock className={`mt-2.5 h-3.5 w-full max-w-2xl ${ON_PAGE}`} />
      </div>
      <div className="flex flex-col gap-3 md:pt-6" aria-hidden="true">
        {VARIANTS_PER_CARD.map((variants, card) => (
          <div key={card} className={`${cardClass} overflow-hidden`}>
            <div className="flex items-center gap-3 px-4 py-3">
              <SkeletonBlock className="h-8 w-8 shrink-0 rounded-lg" />
              <div className="flex flex-col gap-2">
                <SkeletonBlock className="h-3.5 w-36" />
                <SkeletonBlock className="h-2.5 w-28 opacity-70" />
              </div>
            </div>
            {Array.from({ length: variants }).map((_, row) => (
              <div key={row} className="ml-15 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_6rem_4.5rem] items-center gap-4 border-t border-border py-4 pr-4">
                <SkeletonBlock className="h-3.5 w-28" />
                <SkeletonBlock className="h-3.5 w-16" />
                <SkeletonBlock className="h-3.5 w-14" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
