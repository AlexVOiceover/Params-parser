import { SkeletonBlock, SkeletonRows } from "@/components/ui/busy";

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <SkeletonBlock className="h-3 w-28 mb-6" />
      <SkeletonRows lines={3} />
    </div>
  );
}
