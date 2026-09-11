import { SkeletonBlock, SkeletonRows } from "@/components/ui/busy";

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <SkeletonBlock className="h-3 w-64 mb-6" />
      <SkeletonBlock className="h-6 w-52 mb-2" />
      <SkeletonBlock className="h-3.5 w-80 mb-8" />
      <SkeletonBlock className="h-3 w-40 mb-3" />
      <SkeletonRows lines={4} />
    </div>
  );
}
