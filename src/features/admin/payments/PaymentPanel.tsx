import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  useDeleteManualPayment,
  useRecordManualPayment,
  useRequestPayment,
} from "@/features/admin/payments/queries";
import type { Payment } from "@/services/admin/payments.service";
import { formatKES } from "@/utils/currency";
import { todayISO } from "@/utils/dates";
import {
  METHOD_LABELS,
  manualPaymentError,
  sumPaid,
  type PaymentMethod,
} from "@/utils/payments";

const STATUS_STYLES: Record<Payment["status"], string> = {
  pending: "bg-gold-500/15 text-gold-600",
  success: "bg-palm-green text-sand-50",
  failed: "bg-coral-500/15 text-coral-500",
};
const STATUS_LABELS: Record<Payment["status"], string> = {
  pending: "Waiting for PIN",
  success: "Paid",
  failed: "Failed",
};

interface Props {
  bookingId: string;
  guestPhone: string;
  estimatedTotal: number | null;
  payments: Payment[];
  canRequest: boolean;
}

export function PaymentPanel({
  bookingId,
  guestPhone,
  estimatedTotal,
  payments,
  canRequest,
}: Props) {
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(guestPhone);
  const request = useRequestPayment();
  const record = useRecordManualPayment();
  const remove = useDeleteManualPayment();
  const [manualAmount, setManualAmount] = useState("");
  const [manualMethod, setManualMethod] =
    useState<Exclude<PaymentMethod, "mpesa">>("cash");
  const [manualDate, setManualDate] = useState(todayISO());
  const [manualNote, setManualNote] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  const paid = sumPaid(payments);
  const balance =
    estimatedTotal !== null ? Math.max(estimatedTotal - paid, 0) : null;
  const hasPending = payments.some((p) => p.status === "pending");

  function fill(value: number) {
    setAmount(String(Math.round(value)));
  }

  function submitManual() {
    const amountValue = Number(manualAmount);
    const problem = manualPaymentError({
      amount: amountValue,
      date: manualDate,
      today: todayISO(),
    });
    setManualError(problem);
    if (problem) return;
    record.mutate(
      {
        bookingId,
        amount: amountValue,
        method: manualMethod,
        date: manualDate,
        note: manualNote,
      },
      {
        onSuccess: () => {
          setManualAmount("");
          setManualNote("");
        },
        onError: () =>
          setManualError("Could not save that payment. Please try again."),
      },
    );
  }

  function submit() {
    request.mutate({ bookingId, amount: Number(amount), phone });
  }

  return (
    <div className="mt-4 rounded-lg border border-sand-200 bg-sand-50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-teal-900">Payments</h3>
        <p className="font-figures text-xs text-charcoal-500">
          Paid {formatKES(paid)}
          {balance !== null && ` · Balance ${formatKES(balance)}`}
        </p>
      </div>

      {payments.length > 0 && (
        <ul className="mt-3 divide-y divide-sand-200 text-sm">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <span className="font-figures text-charcoal-900">
                {formatKES(p.paid_amount ?? p.amount)}
              </span>
              <span className="text-xs text-charcoal-500">
                {METHOD_LABELS[p.method]} ·{" "}
                {new Date(p.created_at).toLocaleString("en-KE", {
                  dateStyle: "medium",
                  ...(p.method === "mpesa"
                    ? { timeStyle: "short" as const }
                    : {}),
                })}
                {p.mpesa_receipt && ` · ${p.mpesa_receipt}`}
                {p.note && ` · ${p.note}`}
                {p.status === "failed" &&
                  p.result_desc &&
                  ` · ${p.result_desc}`}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`rounded-pill px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide ${STATUS_STYLES[p.status]}`}
                >
                  {STATUS_LABELS[p.status]}
                </span>
                {p.method !== "mpesa" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove this ${formatKES(p.amount)} ${METHOD_LABELS[p.method].toLowerCase()} payment?`,
                        )
                      ) {
                        remove.mutate(p.id);
                      }
                    }}
                    disabled={remove.isPending}
                    className="text-xs text-charcoal-600 hover:text-coral-500"
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canRequest && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {estimatedTotal !== null && (
              <>
                <button
                  type="button"
                  onClick={() => fill(estimatedTotal * 0.3)}
                  className="rounded-pill bg-sand-100 px-3 py-1 text-xs font-medium text-charcoal-600 hover:bg-sand-200"
                >
                  30% deposit
                </button>
                {balance !== null && balance > 0 && (
                  <button
                    type="button"
                    onClick={() => fill(balance)}
                    className="rounded-pill bg-sand-100 px-3 py-1 text-xs font-medium text-charcoal-600 hover:bg-sand-200"
                  >
                    Full balance
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1 text-xs text-charcoal-500">
              Amount (KSh)
              <input
                type="number"
                min={1}
                max={250000}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-36 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-charcoal-500">
              Guest's M-Pesa number
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-48 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
              />
            </label>
            <Button
              type="button"
              onClick={submit}
              loading={request.isPending}
              disabled={!amount || !phone}
            >
              Send M-Pesa prompt
            </Button>
          </div>

          {request.isError && (
            <p role="alert" className="text-sm text-coral-500">
              {request.error instanceof Error
                ? request.error.message
                : "Something went wrong."}
            </p>
          )}
          {request.isSuccess && !hasPending && (
            <p className="text-sm text-charcoal-500">
              Prompt sent. The status updates here automatically.
            </p>
          )}
          {hasPending && (
            <p className="text-sm text-charcoal-500">
              Waiting for the guest to enter their M-Pesa PIN…
            </p>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-sand-200 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal-500">
          Record cash or bank payment
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1 text-xs text-charcoal-500">
            Amount (KSh)
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              className="w-32 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-charcoal-500">
            Method
            <select
              value={manualMethod}
              onChange={(e) =>
                setManualMethod(
                  e.target.value as Exclude<PaymentMethod, "mpesa">,
                )
              }
              className="rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank transfer</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-charcoal-500">
            Received on
            <input
              type="date"
              max={todayISO()}
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-charcoal-500">
            Note / reference (optional)
            <input
              type="text"
              maxLength={200}
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              className="min-w-40 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={submitManual}
            loading={record.isPending}
            disabled={!manualAmount}
          >
            Record payment
          </Button>
        </div>
        {manualError && (
          <p role="alert" className="mt-2 text-sm text-coral-500">
            {manualError}
          </p>
        )}
      </div>
    </div>
  );
}
