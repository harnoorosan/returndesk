"use client";

import { useState, type FormEvent } from "react";
import { REASONS, type ReturnReason } from "@/domain/lifecycle";
import { reasonLabel } from "@/domain/labels";
import { ClientApiError } from "@/lib/client-api";
import { FieldError, inputClass, labelClass, primaryButton, secondaryButton } from "@/components/ui";

export type RequestFormValues = {
  customerName: string;
  contact: string;
  orderNumber: string;
  itemName: string;
  quantity: number;
  reason: string;
};

type Props = {
  initial?: Partial<RequestFormValues>;
  submitLabel: string;
  onSubmit: (values: RequestFormValues) => Promise<void>;
  onCancel?: () => void;
};

export function RequestForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [orderNumber, setOrderNumber] = useState(initial?.orderNumber ?? "");
  const [itemName, setItemName] = useState(initial?.itemName ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [reason, setReason] = useState<string>(initial?.reason ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setPending(true);
    try {
      await onSubmit({
        customerName,
        contact,
        orderNumber,
        itemName,
        quantity: Number(quantity),
        reason,
      });
    } catch (error) {
      if (error instanceof ClientApiError) {
        setFormError(error.message);
        setFieldErrors(error.fields);
      } else {
        setFormError("Could not save the request.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {initial?.customerName ? null : (
        <p className="text-sm text-muted">
          The reference is assigned when you save. You never type it.
        </p>
      )}
      {formError ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
          {formError}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={labelClass}>Customer</span>
          <input
            className={inputClass}
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            autoComplete="name"
            required
          />
          <FieldError message={fieldErrors.customerName} />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Email or phone</span>
          <input
            className={inputClass}
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            autoComplete="email"
            required
          />
          <FieldError message={fieldErrors.contact} />
        </label>
        <label>
          <span className={labelClass}>Order</span>
          <input
            className={inputClass}
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            required
          />
          <FieldError message={fieldErrors.orderNumber} />
        </label>
        <label>
          <span className={labelClass}>Quantity</span>
          <input
            className={inputClass}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            inputMode="numeric"
            min={1}
            required
          />
          <FieldError message={fieldErrors.quantity} />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Item</span>
          <input
            className={inputClass}
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            required
          />
          <FieldError message={fieldErrors.itemName} />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Reason</span>
          <select
            className={inputClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          >
            <option value="">Choose a reason</option>
            {REASONS.map((value) => (
              <option key={value} value={value}>
                {reasonLabel(value as ReturnReason)}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.reason} />
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" className={`${primaryButton} w-full sm:w-auto`} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className={`${secondaryButton} w-full sm:w-auto`} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
