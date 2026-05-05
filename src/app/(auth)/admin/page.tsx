import { StaffRoleLoginPage } from "@/components/auth/staff-role-login-page";

export default async function AdminLoginPage() {
  return (
    <StaffRoleLoginPage
      role="admin"
      title="Admin Portal Login"
      description="Admin control access with secure email and password authentication."
    />
  );
}
