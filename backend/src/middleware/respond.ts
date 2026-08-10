import type { RequestHandler, Response } from "express";

export const sendResult: RequestHandler = (_req, res) => {
  const { statusCode = 200, body = {} } = (res.locals.result ?? {}) as {
    statusCode?: number;
    body?: unknown;
  };
  res.status(statusCode).json(body);
};

export function setResult(
  res: Response,
  statusCode: number,
  body: unknown,
): void {
  res.locals.result = { statusCode, body };
}
