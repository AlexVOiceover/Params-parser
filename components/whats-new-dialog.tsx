"use client";

import { Dialog } from "@/components/ui/dialog";
import { CHANGELOG } from "@/lib/changelog";

interface Props {
  onClose: () => void;
}

export function WhatsNewDialog({ onClose }: Props) {
  return (
    <Dialog title={`What’s new in v${CHANGELOG[0].version}`} onClose={onClose}>
      {CHANGELOG.map((release) => (
        <section key={release.version}>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold text-primary">v{release.version}</span>
            <span className="text-xs text-muted-foreground">{release.date}</span>
          </div>
          <ul className="flex list-outside list-disc flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-foreground">
            {release.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </Dialog>
  );
}
