import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signInNurse } from "../actions";
import { PasswordField } from "./password-field";
import { readNurseSession } from "@/lib/nurse-auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid_password: "That password isn't right. Try again.",
  missing_password: "Enter your password.",
  not_configured: "Nurse dashboard access is not configured for this environment.",
  too_many_attempts: "Too many attempts. Try again in 15 minutes.",
};

export default async function NurseDashboardLoginPage({ searchParams }: LoginPageProps) {
  if (await readNurseSession()) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] : null;
  const locked = error === "too_many_attempts";

  return (
    <main className="pageShell dashboardShell authShell">
      <div className="authFrame">
        <span className="authWordmark">
          <Image alt="Custodia" className="brandLogo" height={26} src="/custodia-logo.svg" width={132} />
        </span>
        <section className="authPanel">
          <div className="panelHeader">
            <p className="eyebrow">Nurse access</p>
            <h1>Diabetes dashboard</h1>
          </div>

          <form action={signInNurse} className="authForm">
            <PasswordField errorMessage={errorMessage} locked={locked} />
            <button className="submitButton" type="submit" disabled={locked}>
              Sign in
            </button>
          </form>

          <p className="disclaimer">
            This dashboard shows all submitted assessments to authenticated nurses. It does not
            assign, claim, or filter cases by nurse.
          </p>
        </section>
        <Link className="dashboardBackLink" href="/">
          ← Return to screening
        </Link>
      </div>
    </main>
  );
}