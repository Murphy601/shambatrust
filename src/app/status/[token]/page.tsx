"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type Status = {
  status: string;
  packageTier: string;
  vaultStatus: string;
  message: string;
  advocateName: string | null;
  ownerFirstName: string;
  submittedAt: string;
};

export default function PublicStatusPage() {
  const params = useParams();
  const token = String(params.token || "");
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/status/${token}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Not found");
        return;
      }
      setData(json);
    })();
  }, [token]);

  return (
    <>
      <SiteHeader />
      <main className="section py-12">
        <div className="mx-auto max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-brass">
            Status tracker
          </p>
          <h1 className="brand-font mt-2 text-4xl font-semibold text-forest-deep">
            Your legal review
          </h1>
          {error && <p className="mt-6 text-[var(--danger)]">{error}</p>}
          {data && (
            <div className="mt-8 rounded-[0.45rem] border-2 border-border bg-surface p-6">
              <p className="text-lg text-ink">{data.message}</p>
              <p className="mt-4 text-base text-muted">
                Package: <span className="capitalize font-semibold">{data.packageTier}</span>
                {" · "}
                Case: <span className="capitalize">{data.status.replace("_", " ")}</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                Submitted {new Date(data.submittedAt).toLocaleString()}
              </p>
              <Link href="/login" className="btn btn-primary mt-6">
                Open vault
              </Link>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
