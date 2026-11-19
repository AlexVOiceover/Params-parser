import { redirect } from "next/navigation";

/** Old catalog URL: product lines now live on the Models page. */
export default function OldFamilyPage() {
  redirect("/models");
}
