import { SkeletonBlock, SkeletonRows } from "@/components/ui/busy";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <SkeletonBlock className="mb-3 h-3 w-24" />
        <SkeletonBlock className="mb-2 h-7 w-56" />
        <SkeletonBlock className="h-3.5 w-80 max-w-full" />
      </div>
      <SkeletonBlock className="h-20 w-full rounded-xl" />
      <SkeletonRows lines={4} />
    </div>
  );
}
