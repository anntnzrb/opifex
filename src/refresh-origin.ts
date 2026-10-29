// Request is a host object whose headers are read only here.
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
export function allowRefresh(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return (
    request.headers.get("origin") === new URL(request.url).origin &&
    (site === null || site === "same-origin")
  );
}
