/**
 * Mini client HTTP au-dessus de `fetch`.
 *
 * Une seule fonction générique `api<T>()` : le `<T>` est le type attendu en retour,
 * fourni par l'appelant (voir streaks.ts). Les erreurs HTTP deviennent des `ApiError`
 * avec le `detail` renvoyé par Django, pour l'afficher tel quel à l'utilisateur.
 */

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `Erreur HTTP ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

interface Options extends Omit<RequestInit, "body"> {
  /** Objet sérialisé en JSON et envoyé comme corps de requête. */
  json?: unknown;
}

export async function api<T>(path: string, { json, ...init }: Options = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(json !== undefined && { "Content-Type": "application/json" }) },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === "object" && "detail" in body ? body.detail : body;
    throw new ApiError(response.status, detail);
  }
  return body as T;
}
