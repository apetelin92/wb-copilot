import { redirect } from "next/navigation";

import { LandingPage } from "@/components/landing-page";
import { getCurrentSessionUser } from "@/server/modules/auth/session";
import { getOnboardingState } from "@/server/modules/onboarding/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return <LandingPage />;
  }

  const onboarding = await getOnboardingState();

  if (!onboarding.connection || onboarding.dailyMetricCount === 0) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
