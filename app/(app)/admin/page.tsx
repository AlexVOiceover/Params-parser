import { redirect } from "next/navigation";

/** Users now live on the Staff & clients page. */
export default function UsersPage() {
  redirect("/admin/clients");
}
