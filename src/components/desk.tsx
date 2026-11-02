"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatMoney, formatWhen, reasonLabel, resolutionLabel, statusLabel } from "@/domain/labels";
import { REASONS, SORTS, STATUSES, type RequestSort, type ReturnReason } from "@/domain/lifecycle";
import type { RequestListDto } from "@/domain/types";
import { clientApi } from "@/lib/client-api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { StatusBadge } from "@/components/status-badge";
import { ErrorBanner, inputClass, labelClass, secondaryButton } from "@/components/ui";

const SORT_LABELS: Record<RequestSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  customer: "Customer A–Z",
  customer_desc: "Customer Z–A",
  updated: "Recently updated",
  reference: "Reference",
};

export function Desk() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const status = searchParams.get("status") ?? "";
  const reason = searchParams.get("reason") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const pageParam = searchParams.get("page");
  const query = searchParams.get("q") ?? "";

  const [search, setSearch] = useState(query);
  const debouncedSearch = useDebouncedValue(search, 350);
  const [data, setData] = useState<RequestListDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${query}|${status}|${reason}|${sort}|${pageParam ?? ""}|${reloadToken}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    if (debouncedSearch === query) return;
    const next = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) next.set("q", debouncedSearch);
    else next.delete("q");
    next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedSearch, pathname, query, router, searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (reason) params.set("reason", reason);
    if (sort) params.set("sort", sort);
    params.set("page", pageParam && pageParam !== "" ? pageParam : "1");
    params.set("pageSize", "10");

    const key = requestKey;
    clientApi<RequestListDto>(`/api/requests?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setData(result);
        setError(null);
        setLoadedKey(key);
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Could not load requests.");
        setLoadedKey(key);
      });

    return () => controller.abort();
  }, [pageParam, query, reason, reloadToken, requestKey, sort, status]);

  function writeParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    let resetPage = true;
    for (const [key, value] of Object.entries(updates)) {
      if (key === "page") resetPage = false;
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const filtered = Boolean(query || status || reason);
  const page = data?.page ?? (Number(pageParam) || 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">The desk</h1>
        <p className="mt-2 max-w-xl text-muted">
          Find a return, then review it, decide the outcome, and close it out.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <label>
          <span className={labelClass}>Search customer, order, or reference</span>
          <input
            id="desk-search"
            className={inputClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Mira, ORD-24018, RD-1001"
            type="search"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label>
            <span className={labelClass}>Status</span>
            <select
              className={inputClass}
              value={status}
              onChange={(event) => writeParams({ status: event.target.value || null })}
            >
              <option value="">Any status</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Reason</span>
            <select
              className={inputClass}
              value={reason}
              onChange={(event) => writeParams({ reason: event.target.value || null })}
            >
              <option value="">Any reason</option>
              {REASONS.map((value) => (
                <option key={value} value={value}>
                  {reasonLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Sort</span>
            <select
              className={inputClass}
              value={sort}
              onChange={(event) => writeParams({ sort: event.target.value })}
            >
              {SORTS.map((value) => (
                <option key={value} value={value}>
                  {SORT_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-sm text-muted">
          {loading && data ? "Updating…" : null}
          {!loading && data ? `${data.total} ${data.total === 1 ? "request" : "requests"}` : null}
          {loading && !data ? "Loading requests…" : null}
        </p>
        {filtered ? (
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              setSearch("");
              const next = new URLSearchParams();
              const currentSort = searchParams.get("sort");
              if (currentSort) next.set("sort", currentSort);
              const qs = next.toString();
              router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => setReloadToken((value) => value + 1)} /> : null}

      {loading && !data ? (
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : null}

      {data && data.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card px-4 py-10 text-center">
          <p className="font-serif text-2xl">Nothing on the desk</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            {filtered
              ? "No requests match this search. Clear a filter or try another name, order, or reference."
              : "No open work yet. Raise a request to start."}
          </p>
        </div>
      ) : null}

      {data && data.total > 0 && data.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card px-4 py-10 text-center">
          <p className="font-serif text-2xl">This page is empty</p>
          <button
            type="button"
            className={`${secondaryButton} mt-4`}
            onClick={() => writeParams({ page: null })}
          >
            Back to the first page
          </button>
        </div>
      ) : null}

      {data && data.data.length > 0 ? (
        <ul className="space-y-3">
          {data.data.map((request) => (
            <li key={request.id}>
              <Link
                href={`/requests/${request.id}`}
                className="block rounded-2xl border border-line bg-card p-4 shadow-sm hover:border-stamp"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-mono text-sm">{request.reference}</p>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-2 font-serif text-2xl leading-tight">{request.customerName}</p>
                <p className="mt-1 break-words text-sm text-muted">
                  {request.orderNumber} · {request.itemName} · {request.quantity}{" "}
                  {request.quantity === 1 ? "unit" : "units"}
                </p>
                <p className="mt-2 text-sm">
                  {reasonLabel(request.reason as ReturnReason)}
                  {request.resolution ? ` · ${resolutionLabel(request.resolution)}` : ""}
                  {request.refundAmount ? ` · ${formatMoney(request.refundAmount)}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatWhen(request.createdAt)}
                  {request.noteCount > 0
                    ? ` · ${request.noteCount} ${request.noteCount === 1 ? "note" : "notes"}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {data && data.total > 0 ? (
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className={`${secondaryButton} w-full sm:w-auto`}
            disabled={page <= 1}
            onClick={() => writeParams({ page: String(page - 1) })}
          >
            Previous
          </button>
          <p className="text-center text-sm text-muted">
            Page {data.page} of {Math.max(data.totalPages, 1)}
          </p>
          <button
            type="button"
            className={`${secondaryButton} w-full sm:w-auto`}
            disabled={data.totalPages === 0 || page >= data.totalPages}
            onClick={() => writeParams({ page: String(page + 1) })}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
