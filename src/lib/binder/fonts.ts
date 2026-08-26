import { readFileSync } from "fs";
import { createRequire } from "module";
import path from "path";
import type PDFDocument from "pdfkit";

/**
 * PDFKit's built-in Helvetica is WinAnsi-encoded, which silently mangles the
 * Latin Extended letters used across Kenyan languages — Gĩkũyũ, Kĩkamba,
 * Kĩmĩrũ. Sealed binders carry elders' own words, so the binder embeds DejaVu
 * Sans instead.
 *
 * If the font cannot be loaded for any reason we fall back to Helvetica rather
 * than failing binder generation; a binder with imperfect diacritics still
 * beats no binder at all.
 */
export type BinderFonts = {
  regular: string;
  bold: string;
  oblique: string;
  /** False when we fell back to the WinAnsi built-ins. */
  unicode: boolean;
};

const HELVETICA: BinderFonts = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
  unicode: false,
};

const EMBEDDED: BinderFonts = {
  regular: "BinderSans",
  bold: "BinderSans-Bold",
  oblique: "BinderSans-Oblique",
  unicode: true,
};

const FILES = {
  regular: "DejaVuSans.ttf",
  bold: "DejaVuSans-Bold.ttf",
  oblique: "DejaVuSans-Oblique.ttf",
} as const;

const PACKAGE_NAME = "dejavu-fonts-ttf";

/**
 * Candidate `ttf/` directories, cheapest first.
 *
 * The specifier is assembled at runtime on purpose: a literal
 * `require.resolve("dejavu-fonts-ttf/package.json")` gets rewritten by the
 * bundler into an internal module id that is not a real filesystem path.
 */
function candidateDirs(): string[] {
  const dirs = [path.join(process.cwd(), "node_modules", PACKAGE_NAME, "ttf")];
  try {
    const require = createRequire(path.join(process.cwd(), "package.json"));
    const manifest = [PACKAGE_NAME, "package.json"].join("/");
    dirs.push(path.join(path.dirname(require.resolve(manifest)), "ttf"));
  } catch {
    // Resolution is best effort; the cwd path above usually wins anyway.
  }
  return dirs;
}

/** Read all three faces from one directory, or nothing at all. */
function loadFaces(dir: string): Record<keyof typeof FILES, Buffer> | null {
  try {
    return {
      regular: readFileSync(path.join(dir, FILES.regular)),
      bold: readFileSync(path.join(dir, FILES.bold)),
      oblique: readFileSync(path.join(dir, FILES.oblique)),
    };
  } catch {
    return null;
  }
}

export function registerBinderFonts(
  doc: typeof PDFDocument.prototype,
): BinderFonts {
  for (const dir of candidateDirs()) {
    // Read the bytes up front. `registerFont` with a path defers the read until
    // the font is first used, which would surface a missing file mid-render —
    // far too late to fall back.
    const faces = loadFaces(dir);
    if (!faces) continue;
    try {
      doc.registerFont(EMBEDDED.regular, faces.regular);
      doc.registerFont(EMBEDDED.bold, faces.bold);
      doc.registerFont(EMBEDDED.oblique, faces.oblique);
      return EMBEDDED;
    } catch {
      return HELVETICA;
    }
  }
  return HELVETICA;
}
