import { Response } from "express";
import logger from "../logger";
import { DataOrError, ErrorType } from "./dataorerror";

const errorTypeToHttpStatus = (dataOrError: DataOrError<unknown>) => {
  switch (dataOrError[0].errorType) {
    case ErrorType.STATE_ERROR: return 400;
    case ErrorType.FORBIDDEN_ACCESS: return 401;
    case ErrorType.INVALID_PARAMETER: return 403;
    case ErrorType.TOO_MANY_REQUESTS: return 429;
    case ErrorType.SERVER_ERROR: return 500;
    default: return 500;
  }
}

export const apiError = (res: Response, dataOrError: DataOrError<unknown>) => {
  logger.error("API Error", dataOrError);
  res.status(errorTypeToHttpStatus(dataOrError)).send(dataOrError[0].error);
}