import { StaffRoleLoginPage } from "@/components/auth/staff-role-login-page";

export default async function DigitalMarketingLoginPage() {
  return (
    <StaffRoleLoginPage
      role="digital_marketing"
      title="Digital Marketing Portal Login"
      description="Digital marketing dashboard access with secure email and password authentication."
    />
  );
}
