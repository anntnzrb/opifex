function requiredElement<ElementType extends Element>(
  selector: string,
  constructor: new (...args: never[]) => ElementType,
): ElementType {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor))
    throw new Error(`Missing or incorrectly typed ${selector}`);
  return element;
}

export function createElements() {
  return {
    title: requiredElement("#title", HTMLSpanElement),
    yinfo: requiredElement("#yinfo", HTMLSpanElement),
    subtitle: requiredElement("#subtitle", HTMLParagraphElement),
    pbtn: requiredElement("#pbtn", HTMLButtonElement),
    plabel: requiredElement("#plabel", HTMLSpanElement),
    pop: requiredElement("#pop", HTMLDivElement),
    q: requiredElement("#q", HTMLInputElement),
    all: requiredElement("#all", HTMLButtonElement),
    none: requiredElement("#none", HTMLButtonElement),
    frontier: requiredElement("#frontier", HTMLButtonElement),
    openw: requiredElement("#openw", HTMLButtonElement),
    effchips: requiredElement("#effchips", HTMLSpanElement),
    plist: requiredElement("#plist", HTMLDivElement),
    yseg: requiredElement("#yseg", HTMLSpanElement),
    xseg: requiredElement("#xseg", HTMLSpanElement),
    mode: requiredElement("#mode", HTMLSelectElement),
    minS: requiredElement("#minS", HTMLInputElement),
    minN: requiredElement("#minN", HTMLInputElement),
    floorV: requiredElement("#floorV", HTMLSpanElement),
    dom: requiredElement("#dom", HTMLInputElement),
    bseg: requiredElement("#bseg", HTMLSpanElement),
    z: requiredElement("#z", HTMLSelectElement),
    ghost: requiredElement("#ghost", HTMLInputElement),
    eff: requiredElement("#eff", HTMLInputElement),
    par: requiredElement("#par", HTMLInputElement),
    lab: requiredElement("#lab", HTMLInputElement),
    quad: requiredElement("#quad", HTMLInputElement),
    legend: requiredElement("#legend", HTMLDivElement),
    chart: requiredElement("#chart", SVGSVGElement),
    tip: requiredElement("#tip", HTMLDivElement),
    stat: requiredElement("#stat", HTMLSpanElement),
    tbl: requiredElement("#tbl", HTMLTableElement),
    elbowAll: requiredElement("#elbowAll", HTMLDivElement),
    elbows: requiredElement("#elbows", HTMLDivElement),
    ranking: requiredElement("#ranking", HTMLDetailsElement),
    tpd: requiredElement("#tpd", HTMLInputElement),
    dpm: requiredElement("#dpm", HTMLInputElement),
    tpm: requiredElement("#tpm", HTMLSpanElement),
    rank: requiredElement("#rank", HTMLTableElement),
  };
}

export type UiElements = ReturnType<typeof createElements>;

export function escapeHtml(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return text.replaceAll(/[&<>"']/gu, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

export function safeColor(value: string): string {
  return CSS.supports("color", value) ? value : "#6b7280";
}
