const AVATAR_TONES = [
  "bg-sky-600 text-white",
  "bg-violet-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
  "bg-teal-600 text-white",
];

function initials(name: string): string {
  const parts = name.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

/** The signed-in person's initials, in a colour of their own so people sharing a computer can tell at a glance. */
export function Avatar({ name, seed, size = "sm" }: { name: string; seed: string; size?: "sm" | "lg" }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]} ${
        size === "lg" ? "h-9 w-9 text-sm" : "h-6 w-6 text-[11px]"
      }`}
    >
      {initials(name)}
    </span>
  );
}
