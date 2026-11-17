import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminPasswordConfigured, isAdminCookie } from "@/lib/server/auth";
import { LoginForm } from "./login-form";
import { Studio } from "./studio";

export const dynamic = "force-dynamic";

export default async function Home() {
  const jar = await cookies();
  if (await isAdminCookie(jar.get(ADMIN_COOKIE)?.value)) return <Studio />;
  return <LoginForm configured={adminPasswordConfigured()} />;
}
