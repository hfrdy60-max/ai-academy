/** An error whose code is safe to send to the browser (never contains secrets or upstream details). */
export class HttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
