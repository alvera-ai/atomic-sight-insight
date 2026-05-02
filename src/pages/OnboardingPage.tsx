import { PlaceholderScreen } from "@/components/placeholder-screen";
export default function OnboardingPage() {
  return <PlaceholderScreen title="Onboarding queue" intent="Approve / hold AccountHolders, update KYC gates, attach documents. Wires to PUT /api/account-holders/{id}, PUT /api/kyc-requirements/{id}, POST /api/documents." />;
}
