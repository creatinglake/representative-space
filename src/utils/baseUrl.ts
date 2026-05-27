function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

export function baseUrl(): string {
  const raw = process.env.BASE_URL ?? "http://localhost:3001";
  return stripTrailingSlash(raw);
}

export function uiBaseUrl(): string {
  const raw =
    process.env.RS_UI_BASE_URL ??
    process.env.BASE_URL ??
    "http://localhost:3001";
  return stripTrailingSlash(raw);
}
