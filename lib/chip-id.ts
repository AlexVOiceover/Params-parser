// Flight-controller chip ID: the MCU's 12-byte factory unique ID, as sent in
// AUTOPILOT_VERSION.uid2 and stored as 24 uppercase hex chars in uid2 byte order.

export const CHIP_ID_PATTERN = /^[0-9A-F]{24}$/;

/**
 * Accepts either form staff may paste:
 *   • a chip ID as this app shows it — 24 hex chars, uid2 byte order
 *   • the line ArduPilot sends on every GCS connect, shown in Mission
 *     Planner's Messages tab: "CubeOrangePlus 00320021 3438510B 36373832".
 *     Each 4-byte group is printed most-significant byte first
 *     (serialid[3..0]), so every group is byte-reversed back to uid2 order.
 * Three space-separated 8-hex groups are always read as that line.
 */
export function parseChipIdInput(text: string): string | null {
  const trimmed = text.trim();
  const line = /([0-9A-Fa-f]{8})\s+([0-9A-Fa-f]{8})\s+([0-9A-Fa-f]{8})\s*$/.exec(trimmed);
  if (line) {
    const reversed = line.slice(1, 4).map((g) => g.match(/../g)!.reverse().join(""));
    return reversed.join("").toUpperCase();
  }
  const plain = trimmed.toUpperCase();
  return CHIP_ID_PATTERN.test(plain) ? plain : null;
}
