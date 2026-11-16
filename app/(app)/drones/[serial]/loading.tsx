import { SkeletonBlock, SkeletonRows } from "@/components/ui/busy";

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <SkeletonBlock className="h-6 w-48 mb-2" />
      <SkeletonBlock className="h-3 w-72 mb-8" />
      <SkeletonRows lines={4} />
    </div>
  );
}
