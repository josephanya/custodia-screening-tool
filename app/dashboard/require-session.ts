import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { readNurseSession } from "@/lib/nurse-auth";
import { readRequestContext, type RequestContext } from "@/lib/request-context";

export type NurseDashboardContext = {
  sessionId: string;
  request: RequestContext;
};

export async function requireNurseSession(): Promise<NurseDashboardContext> {
  const session = await readNurseSession();

  if (!session) {
    redirect("/dashboard/login");
  }

  return {
    sessionId: session.id,
    request: readRequestContext(await headers()),
  };
}