import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

/**
 * Modèle d'une pièce imprimable (devis, facture, reçu, avoir). Les textes
 * arrivent déjà formatés (montants, dates) : le rendu ne fait aucun calcul.
 */
export type PdfDocumentModel = {
  /** Titre en tête de page, ex. « DEVIS ». */
  title: string;
  /** Numéro de la pièce, ex. « DEV-2026-0001 ». */
  reference?: string;
  /** Mention en diagonale sur chaque page (brouillon). */
  watermark?: string;
  seller: { name: string; lines: string[] };
  buyer?: { label: string; name: string; lines: string[] };
  meta: { label: string; value: string }[];
  items?: { name: string; detail: string; amount: string }[];
  totals: { label: string; value: string; strong?: boolean }[];
  sections?: { title: string; text: string }[];
  /** Avertissements en bas de pièce (nature du document, limites). */
  notices: string[];
  /** Métadonnées PDF. */
  author?: string;
};

// Caractères hors Latin-1 encodables en WinAnsi (polices standard PDF).
const WIN_ANSI_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split(""));

/** Texte compatible avec les polices standard (WinAnsi). */
export function toWinAnsi(text: string): string {
  return Array.from(text.replace(/[    - ]/g, " "), (char) => {
    const code = char.codePointAt(0)!;
    if (char === "\n" || char === "\t") return " ";
    if ((code >= 0x20 && code < 0x7f) || (code >= 0xa0 && code <= 0xff))
      return char;
    return WIN_ANSI_EXTRAS.has(char) ? char : "?";
  }).join("");
}

/** Découpe un texte en lignes tenant dans `maxWidth`. */
export function wrapText(
  text: string,
  font: Pick<PDFFont, "widthOfTextAtSize">,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = toWinAnsi(paragraph).split(" ").filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      // Mot plus long que la ligne : coupé au caractère.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (
          cut > 1 &&
          font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth
        )
          cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    lines.push(current);
  }
  return lines;
}

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const INK = rgb(0.12, 0.12, 0.14);
const MUTED = rgb(0.4, 0.4, 0.44);
const RULE = rgb(0.85, 0.85, 0.87);

export async function renderPdf(model: PdfDocumentModel): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(
    toWinAnsi(`${model.title}${model.reference ? ` ${model.reference}` : ""}`),
  );
  pdf.setProducer("Céleste Biz");
  pdf.setCreator("Céleste Biz");
  if (model.author) pdf.setAuthor(toWinAnsi(model.author));

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = PAGE.width - 2 * MARGIN;

  let page: PDFPage = addPage();
  let y = PAGE.height - MARGIN;

  function addPage(): PDFPage {
    const next = pdf.addPage([PAGE.width, PAGE.height]);
    if (model.watermark) {
      const text = toWinAnsi(model.watermark);
      const size = 44;
      const width = bold.widthOfTextAtSize(text, size);
      // Diagonale centrée, tenant dans 80 % de la largeur de la page.
      const diagonal = Math.SQRT1_2;
      const scale = Math.min(1, (PAGE.width * 0.8) / (width * diagonal));
      const length = width * scale;
      const height = size * scale;
      next.drawText(text, {
        x: PAGE.width / 2 - (length / 2) * diagonal + (height / 2) * diagonal,
        y: PAGE.height / 2 - (length / 2) * diagonal - (height / 2) * diagonal,
        size: height,
        font: bold,
        color: rgb(0.85, 0.2, 0.2),
        opacity: 0.18,
        rotate: degrees(45),
      });
    }
    return next;
  }

  function ensure(height: number) {
    if (y - height < MARGIN + 20) {
      page = addPage();
      y = PAGE.height - MARGIN;
    }
  }

  function text(
    value: string,
    options: {
      x?: number;
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
      align?: "left" | "right";
    } = {},
  ) {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const x = options.x ?? MARGIN;
    const maxWidth = options.maxWidth ?? contentWidth;
    for (const line of wrapText(value, font, size, maxWidth)) {
      ensure(size + 4);
      const lineX =
        options.align === "right"
          ? x + maxWidth - font.widthOfTextAtSize(line, size)
          : x;
      page.drawText(line, {
        x: lineX,
        y: y - size,
        size,
        font,
        color: options.color ?? INK,
      });
      y -= size + 4;
    }
  }

  function rule() {
    ensure(10);
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE.width - MARGIN, y },
      thickness: 0.7,
      color: RULE,
    });
    y -= 8;
  }

  // En-tête : vendeur à gauche, titre et numéro à droite.
  const top = y;
  const half = contentWidth / 2 - 8;
  text(model.seller.name, { size: 14, font: bold, maxWidth: half });
  for (const line of model.seller.lines)
    text(line, { color: MUTED, maxWidth: half });
  const leftBottom = y;
  y = top;
  text(model.title, {
    x: MARGIN + contentWidth / 2 + 8,
    maxWidth: half,
    size: 16,
    font: bold,
    align: "right",
  });
  if (model.reference) {
    text(model.reference, {
      x: MARGIN + contentWidth / 2 + 8,
      maxWidth: half,
      size: 11,
      align: "right",
    });
  }
  y = Math.min(y, leftBottom) - 8;
  rule();

  if (model.buyer) {
    text(model.buyer.label, { size: 9, color: MUTED });
    text(model.buyer.name, { size: 11, font: bold });
    for (const line of model.buyer.lines) text(line);
    y -= 6;
  }

  for (const entry of model.meta) {
    ensure(14);
    const rowTop = y;
    text(entry.label, { size: 9, color: MUTED, maxWidth: 140 });
    const labelBottom = y;
    y = rowTop;
    text(entry.value, { x: MARGIN + 150, maxWidth: contentWidth - 150 });
    y = Math.min(y, labelBottom);
  }

  if (model.items?.length) {
    y -= 6;
    rule();
    const amountWidth = 110;
    const nameWidth = contentWidth - amountWidth - 12;
    text("Désignation", {
      size: 9,
      font: bold,
      color: MUTED,
      maxWidth: nameWidth,
    });
    y += 13;
    text("Montant", {
      x: MARGIN + nameWidth + 12,
      size: 9,
      font: bold,
      color: MUTED,
      maxWidth: amountWidth,
      align: "right",
    });
    rule();
    for (const item of model.items) {
      ensure(30);
      const rowTop = y;
      text(item.name, { font: bold, maxWidth: nameWidth });
      if (item.detail)
        text(item.detail, { size: 9, color: MUTED, maxWidth: nameWidth });
      const nameBottom = y;
      y = rowTop;
      text(item.amount, {
        x: MARGIN + nameWidth + 12,
        maxWidth: amountWidth,
        align: "right",
      });
      y = Math.min(y, nameBottom) - 4;
    }
    rule();
  }

  if (model.totals.length) {
    if (!model.items?.length) y -= 10;
    const labelX = MARGIN + contentWidth - 300;
    for (const total of model.totals) {
      ensure(16);
      const rowTop = y;
      const font = total.strong ? bold : regular;
      const size = total.strong ? 12 : 10;
      text(total.label, { x: labelX, maxWidth: 170, font, size });
      const labelBottom = y;
      y = rowTop;
      text(total.value, {
        x: labelX + 170,
        maxWidth: 130,
        font,
        size,
        align: "right",
      });
      y = Math.min(y, labelBottom);
    }
    y -= 6;
  }

  for (const section of model.sections ?? []) {
    y -= 4;
    text(section.title, { size: 10, font: bold });
    text(section.text, { size: 9 });
  }

  if (model.notices.length) {
    y -= 10;
    rule();
    for (const notice of model.notices)
      text(notice, { size: 8.5, color: MUTED });
  }

  return pdf.save();
}
