import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/constants";

// Clients sign in through the same form as everyone else now.
export default function ClientLoginPage() {
  redirect(LOGIN_PATH);
}
