import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { sessionToken } from "@/lib/auth";

export default async function HomePage() {
  const jar = await cookies();
  const token = jar.get("pd_session")?.value;
  if (token && token === (await sessionToken())) redirect("/dashboard");
  return <LoginForm />;
}
