import { StaffRoleLoginPage } from "@/components/auth/staff-role-login-page";

export default async function SalesLoginPage() {
  return (
    <StaffRoleLoginPage
      role="sales"
      title="Sales Portal Login"
      description="Sales dashboard access with secure email and password authentication."
    />
  );
}
