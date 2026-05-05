import { StaffRoleLoginPage } from "@/components/auth/staff-role-login-page";

export default async function DeveloperLoginPage() {
  return (
    <StaffRoleLoginPage
      role="developer"
      title="Developer Portal Login"
      description="Developer workspace access with secure email and password authentication."
    />
  );
}
