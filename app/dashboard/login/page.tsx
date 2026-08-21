import Link from "next/link";
import { redirect } from "next/navigation";

import { signInNurse } from "../actions";
import { readNurseSession } from "@/lib/nurse-auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid_password: "That password did not match the nurse dashboard password.",
  missing_password: "Enter the nurse dashboard password.",
  not_configured: "Nurse dashboard access is not configured for this environment.",
  too_many_attempts: "Too many sign-in attempts. Wait a few minutes and try again.",
};

export default async function NurseDashboardLoginPage({ searchParams }: LoginPageProps) {
  if (await readNurseSession()) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] : null;

  return (
    <main className="pageShell dashboardShell authShell">
      <section className="panel authPanel">
        <div className="panelHeader">
          <p className="eyebrow">Nurse access</p>
          <h1>Diabetes dashboard</h1>
        </div>

        {errorMessage ? <div className="errorBox">{errorMessage}</div> : null}

        <form action={signInNurse} className="authForm">
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="submitButton" type="submit">
            Sign in
          </button>
        </form>

        <p className="disclaimer">
          This dashboard shows all submitted assessments to authenticated nurses. It does not assign,
          claim, or filter cases by nurse.
        </p>
        <Link className="dashboardBackLink" href="/">
          Return to screening
        </Link>
      </section>
    </main>
  );
}