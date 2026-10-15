import { AdminShell } from "../AdminShell";
import { getPaymentMethods } from "@/lib/db";
import PaymentsClient from "./PaymentsClient";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const methods = await getPaymentMethods();
  return (
    <AdminShell active="/admin/payments">
      <h1>Payment Methods</h1>
      <p className="page-sub">
        Control which payment methods appear at checkout.
      </p>
      <PaymentsClient initialMethods={methods} />
    </AdminShell>
  );
}
