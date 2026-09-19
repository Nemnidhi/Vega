import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/constants";

// Kept so existing links and redirects still resolve; there is one sign-in page now.
export default function LegacyPortalLoginPage() {
  redirect(LOGIN_PATH);
}
