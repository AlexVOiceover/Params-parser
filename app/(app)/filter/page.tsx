import { redirect } from "next/navigation";

/** Retired: drones, uploads and shareable downloads all live on the Drones list and drone pages now. */
export default function RetiredPage() {
  redirect("/");
}
