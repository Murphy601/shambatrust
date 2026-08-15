import { NextResponse } from "next/server";
import { issueViewToken } from "@/lib/secure-docs/tokens";
import { readSession } from "@/lib/auth/session";
import { addAudit } from "@/lib/db/store";
import { resolveSecureDocAccess } from "@/lib/secure-docs/access";

/**
 * Returns a clear HTML viewer (view-only). Renders to canvas — never mounts
 * the raw PDF/image in an <iframe>/<img>, so browser "Save as" is unavailable.
 * Logs document_viewed for every open.
 */
export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return new NextResponse("Sign in required.", { status: 401 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const reviewId = url.searchParams.get("reviewId") || "";
  const vaultId = url.searchParams.get("vaultId") || "";
  const assetId = url.searchParams.get("assetId");
  const documentId = url.searchParams.get("documentId");
  const caseId = url.searchParams.get("caseId");

  let target;
  if (kind === "death_cert") {
    target = { kind: "death_cert" as const, caseId: caseId || "" };
  } else if (kind === "asset" && vaultId && !reviewId && session.role === "admin") {
    target = {
      kind: "asset_admin" as const,
      assetId: assetId || "",
      vaultId,
    };
  } else if (kind === "asset") {
    target = {
      kind: "asset" as const,
      assetId: assetId || "",
      reviewId,
    };
  } else if (kind === "legal") {
    target = {
      kind: "legal" as const,
      documentId: documentId || "",
      reviewId,
    };
  } else {
    return new NextResponse("Invalid request.", { status: 400 });
  }

  const resolved = await resolveSecureDocAccess(session, target);

  if (!resolved.ok) {
    return new NextResponse(resolved.error, { status: resolved.status });
  }

  await addAudit({
    vaultId: resolved.vaultId,
    actorUserId: session.userId,
    action: "document_viewed",
    detail: `${kind || "doc"} view-only · ${resolved.displayName} · ${session.role}`,
  });

  const viewToken = await issueViewToken(session.userId);
  const streamQs = new URLSearchParams({
    kind: kind || "asset",
    v: viewToken,
  });
  if (reviewId) streamQs.set("reviewId", reviewId);
  if (vaultId) streamQs.set("vaultId", vaultId);
  if (assetId) streamQs.set("assetId", assetId);
  if (documentId) streamQs.set("documentId", documentId);
  if (caseId) streamQs.set("caseId", caseId);

  const streamUrl = `/api/secure-docs/stream?${streamQs.toString()}`;
  const title = escapeHtml(resolved.displayName);
  const isPdf = /\.pdf$/i.test(resolved.filename);
  const streamUrlJs = JSON.stringify(streamUrl);
  const isPdfJs = JSON.stringify(isPdf);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>View only · ${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: Georgia, "Times New Roman", serif;
      background: #1a1f1c; color: #f4f1ea;
      min-height: 100vh;
      user-select: none;
      -webkit-user-select: none;
    }
    header {
      position: sticky; top: 0; z-index: 5;
      display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;
      justify-content: space-between;
      padding: 0.85rem 1.1rem;
      background: #0f1411; border-bottom: 1px solid #3d4a40;
    }
    h1 { font-size: 1.05rem; margin: 0; font-weight: 600; }
    .badge {
      font-size: 0.85rem; color: #d4a574; letter-spacing: 0.04em;
      text-transform: uppercase; font-weight: 700;
    }
    .stage {
      position: relative; margin: 1rem auto; max-width: 960px;
      min-height: 70vh; background: #111;
      border: 1px solid #3d4a40; padding: 0.75rem;
    }
    .stage canvas {
      display: block; width: 100%; height: auto; margin: 0 auto 1rem;
      background: #fff;
    }
    .status { padding: 2rem; text-align: center; color: #9aa89c; }
    .status.error { color: #e07a5f; }
    footer {
      padding: 1rem 1.1rem 2rem; color: #9aa89c; font-size: 0.95rem;
      max-width: 960px; margin: 0 auto;
    }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <div class="badge">View only · no download</div>
  </header>
  <div class="stage" id="stage">
    <p class="status" id="status">Loading secure preview…</p>
  </div>
  <footer>
    Access is logged. This preview cannot be saved as a file from the viewer.
    Sharing outside this matter may breach your partner SLA and Kenya’s Data Protection Act.
  </footer>
  <script type="module">
    const STREAM_URL = ${streamUrlJs};
    const IS_PDF = ${isPdfJs};
    const stage = document.getElementById("stage");
    const status = document.getElementById("status");

    function blockEvent(e) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    document.addEventListener("contextmenu", blockEvent, true);
    document.addEventListener("dragstart", blockEvent, true);
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "S", "P"].includes(e.key)) {
        blockEvent(e);
      }
    }, true);

    function clearStatus() {
      if (status) status.remove();
    }

    function showError(msg) {
      stage.innerHTML = '<p class="status error"></p>';
      stage.querySelector(".status").textContent = msg;
    }

    async function loadBytes() {
      const res = await fetch(STREAM_URL, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error("Could not load document (" + res.status + ")");
      return new Uint8Array(await res.arrayBuffer());
    }

    function appendCanvas(sourceCanvas) {
      const canvas = document.createElement("canvas");
      canvas.width = sourceCanvas.width;
      canvas.height = sourceCanvas.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(sourceCanvas, 0, 0);
      canvas.addEventListener("contextmenu", blockEvent);
      stage.appendChild(canvas);
    }

    async function renderImage(bytes) {
      const blob = new Blob([bytes]);
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      clearStatus();
      canvas.addEventListener("contextmenu", blockEvent);
      stage.appendChild(canvas);
    }

    async function renderPdf(bytes) {
      const pdfjsLib = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs");
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs";

      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      clearStatus();
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        const unscaled = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, (900 / unscaled.width));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        canvas.addEventListener("contextmenu", blockEvent);
        stage.appendChild(canvas);
      }
    }

    try {
      const bytes = await loadBytes();
      if (IS_PDF) {
        await renderPdf(bytes);
      } else {
        await renderImage(bytes);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Preview failed");
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; worker-src blob: https://cdn.jsdelivr.net; connect-src 'self' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'",
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
