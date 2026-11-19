import { SkeletonBlock, SkeletonRows } from "@/components/ui/busy";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div>
        <SkeletonBlock className="mb-2 h-7 w-32" />
        <SkeletonBlock className="h-3.5 w-48" />
      </div>
      <SkeletonBlock className="h-9 w-full rounded-lg" />
      <SkeletonRows lines={4} />
    </div>
  );
}
