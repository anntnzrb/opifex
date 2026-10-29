import { Schema } from "effect";
export class RequestError extends Schema.TaggedError<
  RequestError,
  { readonly brand: unique symbol }
>()("RequestError", {
  message: Schema.String,
  retryable: Schema.Boolean,
  cause: Schema.Defect(),
}) {}
