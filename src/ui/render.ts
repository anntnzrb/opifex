export function renderPage(template: string, app: string, data: unknown, date: string): string {
  for (const placeholder of ["__APP__", "__DATA__", "__DATE__"]) {
    if (template.split(placeholder).length !== 2)
      throw new Error(`Template must contain exactly one ${placeholder}`);
  }
  return template
    .replace("__APP__", () => app)
    .replace("__DATA__", () => JSON.stringify(data).replaceAll("<", "\\u003c"))
    .replace("__DATE__", () => date);
}
