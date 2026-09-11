import { SkeletonBlock, SkeletonRows } from "@/components/ui/busy";

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <SkeletonBlock className="h-3 w-48 mb-6" />
      <SkeletonBlock className="h-6 w-44 mb-8" />
      <SkeletonRows lines={3} />
    </div>
  );
}
