"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { RequestForm, type RequestFormValues } from "@/components/request-form";
import { StatusBadge } from "@/components/status-badge";
import {
  ErrorBanner,
  dangerButton,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "@/components/ui";
import {
  formatMoney,
  formatWhenWithTime,
  reasonLabel,
  resolutionLabel,
  statusLabel,
} from "@/domain/labels";
import {
  RESOLUTIONS,
  canEditDetails,
  canRemove,
  legalTransitions,
  type Resolution,
} from "@/domain/lifecycle";
import type { NoteDto, RequestDto } from "@/domain/types";
import { ClientApiError, clientApi } from "@/lib/client-api";

type Panel = "none" | "approve" | "reject" | "complete" | "remove" | "edit";

function subscribeAuthor() {
  return () => {};
}

function readAuthor() {
  try {
    return localStorage.getItem("returndesk.agentName") || "Agent";
  } catch {
    return "Agent";
  }
}

export function RequestDetail({ id }: { id: string }) {
  const router = useRouter();
  const [request, setRequest] = useState<RequestDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${id}:${reloadToken}`;
  const loading = loadedKey !== requestKey;
  const [panel, setPanel] = useState<Panel>("none");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("REFUND");
  const [refundAmount, setRefundAmount] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const storedAuthor = useSyncExternalStore(subscribeAuthor, readAuthor, () => "Agent");
  const [authorDraft, setAuthorDraft] = useState<string | null>(null);
  const author = authorDraft ?? storedAuthor;

  useEffect(() => {
    let ignore = false;
    const key = requestKey;
    clientApi<RequestDto>(`/api/requests/${id}`)
      .then((next) => {
        if (ignore) return;
        setRequest(next);
        setError(null);
        setLoadedKey(key);
      })
      .catch((caught: unknown) => {
        if (ignore) return;
        setRequest(null);
        setError(caught instanceof Error ? caught.message : "Could not load this request.");
        setLoadedKey(key);
      });
    return () => {
      ignore = true;
    };
  }, [id, requestKey]);

  async function run(action: () => Promise<void>) {
    setActionError(null);
    setPending(true);
    try {
      await action();
      setPanel("none");
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "The server refused that action.",
      );
    } finally {
      setPending(false);
    }
  }

  async function transition(body: Record<string, unknown>) {
    await run(async () => {
      const next = await clientApi<RequestDto>(`/api/requests/${id}/transitions`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setRequest(next);
    });
  }

  if (loading && !request) {
    return <p className="text-muted">Loading request…</p>;
  }

  if (error && !request) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error} onRetry={() => setReloadToken((value) => value + 1)} />
        <Link href="/" className="text-sm font-semibold text-stamp">
          Back to the desk
        </Link>
      </div>
    );
  }

  if (!request) return null;

  const allowed = legalTransitions(request.status);
  const editable = canEditDetails(request.status);
  const removable = canRemove(request.status);
  const notes = request.notes ?? [];

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm font-semibold text-stamp">
        Back to the desk
      </Link>

      <div className="rounded-2xl border border-line bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-sm text-muted">{request.reference}</p>
            <h1 className="mt-1 break-words font-serif text-4xl tracking-tight">
              {request.customerName}
            </h1>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Detail label="Contact">
            {request.contact.includes("@") ? (
              <a className="break-all underline decoration-line underline-offset-2" href={`mailto:${request.contact}`}>
                {request.contact}
              </a>
            ) : (
              <span className="break-words">{request.contact}</span>
            )}
          </Detail>
          <Detail label="Order">{request.orderNumber}</Detail>
          <Detail label="Item">{request.itemName}</Detail>
          <Detail label="Quantity">
            {request.quantity} {request.quantity === 1 ? "unit" : "units"}
          </Detail>
          <Detail label="Reason">{reasonLabel(request.reason)}</Detail>
          <Detail label="Opened">{formatWhenWithTime(request.createdAt)}</Detail>
          {request.resolution ? (
            <Detail label="Resolution">
              {resolutionLabel(request.resolution)}
              {request.refundAmount ? ` · ${formatMoney(request.refundAmount)}` : ""}
            </Detail>
          ) : null}
        </dl>

        {!editable ? (
          <p className="mt-5 text-sm text-muted">
            Customer and item details are locked. Notes can still be added.
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Actions</h2>
        {actionError ? <ErrorBanner message={actionError} /> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {allowed.includes("IN_REVIEW") ? (
            <button
              type="button"
              className={`${primaryButton} w-full sm:w-auto`}
              disabled={pending}
              onClick={() => void transition({ to: "IN_REVIEW" })}
            >
              Start review
            </button>
          ) : null}
          {allowed.includes("APPROVED") ? (
            <button
              type="button"
              className={`${primaryButton} w-full sm:w-auto`}
              disabled={pending}
              onClick={() => {
                setActionError(null);
                setPanel("approve");
              }}
            >
              Approve
            </button>
          ) : null}
          {allowed.includes("REJECTED") ? (
            <button
              type="button"
              className={`${dangerButton} w-full sm:w-auto`}
              disabled={pending}
              onClick={() => {
                setActionError(null);
                setPanel("reject");
              }}
            >
              Reject
            </button>
          ) : null}
          {allowed.includes("COMPLETED") ? (
            <button
              type="button"
              className={`${primaryButton} w-full sm:w-auto`}
              disabled={pending}
              onClick={() => {
                setActionError(null);
                setPanel("complete");
              }}
            >
              Mark completed
            </button>
          ) : null}
          {editable ? (
            <button
              type="button"
              className={`${secondaryButton} w-full sm:w-auto`}
              disabled={pending}
              onClick={() => {
                setActionError(null);
                setPanel("edit");
              }}
            >
              Edit details
            </button>
          ) : null}
          {removable ? (
            <button
              type="button"
              className={`${secondaryButton} w-full sm:w-auto`}
              disabled={pending}
              onClick={() => {
                setActionError(null);
                setPanel("remove");
              }}
            >
              Remove from desk
            </button>
          ) : null}
        </div>

        {panel === "approve" ? (
          <form
            className="space-y-4 rounded-2xl border border-line bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const body: Record<string, unknown> = { to: "APPROVED", resolution };
              if (resolution === "REFUND") body.refundAmount = refundAmount.trim();
              void transition(body);
            }}
          >
            <fieldset>
              <legend className={labelClass}>Resolution</legend>
              <div className="space-y-2">
                {RESOLUTIONS.map((value) => (
                  <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="resolution"
                      value={value}
                      checked={resolution === value}
                      onChange={() => setResolution(value)}
                    />
                    {resolutionLabel(value)}
                  </label>
                ))}
              </div>
            </fieldset>
            {resolution === "REFUND" ? (
              <label>
                <span className={labelClass}>Refund amount</span>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  placeholder="24.00"
                  required
                />
              </label>
            ) : (
              <p className="text-sm text-muted">No refund amount is stored for this resolution.</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" className={`${primaryButton} w-full sm:w-auto`} disabled={pending}>
                {pending ? "Saving…" : "Confirm approval"}
              </button>
              <button type="button" className={`${secondaryButton} w-full sm:w-auto`} onClick={() => setPanel("none")}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {panel === "reject" ? (
          <Confirm
            text={`Reject this request? ${statusLabel("REJECTED")} is final. You can still add a note or take it off the desk.`}
            confirmLabel="Reject request"
            danger
            pending={pending}
            onCancel={() => setPanel("none")}
            onConfirm={() => void transition({ to: "REJECTED" })}
          />
        ) : null}

        {panel === "complete" ? (
          <Confirm
            text="Mark this request completed? Completed is final and the request cannot move again."
            confirmLabel="Mark completed"
            pending={pending}
            onCancel={() => setPanel("none")}
            onConfirm={() => void transition({ to: "COMPLETED" })}
          />
        ) : null}

        {panel === "remove" ? (
          <Confirm
            text="This hides the request from the desk. The row stays in the database."
            confirmLabel="Remove from desk"
            danger
            pending={pending}
            onCancel={() => setPanel("none")}
            onConfirm={() =>
              void run(async () => {
                await clientApi(`/api/requests/${id}`, { method: "DELETE" });
                router.push("/");
              })
            }
          />
        ) : null}

        {panel === "edit" ? (
          <div className="rounded-2xl border border-line bg-card p-4">
            <RequestForm
              initial={{
                customerName: request.customerName,
                contact: request.contact,
                orderNumber: request.orderNumber,
                itemName: request.itemName,
                quantity: request.quantity,
                reason: request.reason,
              }}
              submitLabel="Save details"
              onCancel={() => setPanel("none")}
              onSubmit={async (values: RequestFormValues) => {
                try {
                  const next = await clientApi<RequestDto>(`/api/requests/${id}`, {
                    method: "PATCH",
                    body: JSON.stringify(values),
                  });
                  setRequest(next);
                  setPanel("none");
                  setActionError(null);
                } catch (caught) {
                  if (caught instanceof ClientApiError) throw caught;
                  throw new ClientApiError("Could not save the request.");
                }
              }}
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Notes</h2>
        {notes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-6 text-sm text-muted">
            No notes yet.
          </p>
        ) : (
          <ol className="space-y-4 border-l border-line pl-4">
            {notes.map((note) => (
              <NoteItem key={note.id} note={note} />
            ))}
          </ol>
        )}
        <form
          className="space-y-3 rounded-2xl border border-line bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              try {
                localStorage.setItem("returndesk.agentName", author.trim());
              } catch {
                // Ignore storage failures. The note is still sent.
              }
              await clientApi(`/api/requests/${id}/notes`, {
                method: "POST",
                body: JSON.stringify({ body: noteBody, author: author.trim() || undefined }),
              });
              setNoteBody("");
              const next = await clientApi<RequestDto>(`/api/requests/${id}`);
              setRequest(next);
            });
          }}
        >
          <label>
            <span className={labelClass}>Add a note</span>
            <textarea
              className={`${inputClass} min-h-28 py-2`}
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              required
            />
          </label>
          <label>
            <span className={labelClass}>Your name</span>
            <input
              className={inputClass}
              value={author}
              onChange={(event) => setAuthorDraft(event.target.value)}
            />
          </label>
          <button type="submit" className={`${primaryButton} w-full sm:w-auto`} disabled={pending}>
            {pending ? "Saving…" : "Add note"}
          </button>
        </form>
      </section>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

function NoteItem({ note }: { note: NoteDto }) {
  return (
    <li>
      <p className="text-xs text-muted">
        {note.author} · {formatWhenWithTime(note.createdAt)}
        {note.kind === "SYSTEM" ? " · system" : ""}
      </p>
      <p className={`mt-1 break-words text-sm ${note.kind === "SYSTEM" ? "text-muted" : ""}`}>
        {note.body}
      </p>
    </li>
  );
}

function Confirm({
  text,
  confirmLabel,
  danger = false,
  pending,
  onConfirm,
  onCancel,
}: {
  text: string;
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <p className="text-sm">{text}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className={`${danger ? dangerButton : primaryButton} w-full sm:w-auto`}
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "Saving…" : confirmLabel}
        </button>
        <button type="button" className={`${secondaryButton} w-full sm:w-auto`} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
