import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import QualifyForm from "./QualifyForm";

export default async function QualifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/?expired=true");
  }

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    const zip = (payload.zip as string | undefined) ?? "";
    const tier = (payload.tier as string | undefined) ?? "";

    return <QualifyForm token={token} zip={zip} tier={tier} />;
  } catch {
    redirect("/?expired=true");
  }
}
