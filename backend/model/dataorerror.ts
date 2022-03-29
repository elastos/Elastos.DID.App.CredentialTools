import logger from "../logger";

export enum ErrorType {
    STATE_ERROR, // 400
    FORBIDDEN_ACCESS, // 401
    INVALID_PARAMETER, // 403
    NOT_FOUND, // 404
    TOO_MANY_REQUESTS, // 429
    SERVER_ERROR // 500
}

export type DataOrErrorError = {
    error?: string, // The error message
    errorType?: ErrorType; // Hint to assess the http error code to return
}

export type DataOrError<T> = [DataOrErrorError, T?];

export const error = <T>(errorType: ErrorType, error: string): DataOrError<T> => {
    return [{
        error,
        errorType
    }];
};

export const stateError = <T>(message: string): DataOrError<T> => {
    return error(ErrorType.STATE_ERROR, message);
};

export const invalidParamError = <T>(message: string): DataOrError<T> => {
    return error(ErrorType.INVALID_PARAMETER, message);
};

export const notFoundError = <T>(message: string): DataOrError<T> => {
    return error(ErrorType.NOT_FOUND, message);
};

export const forbiddenAccessError = <T>(message: string): DataOrError<T> => {
    return error(ErrorType.FORBIDDEN_ACCESS, message);
};

export const serverError = <T>(message: string): DataOrError<T> => {
    return error(ErrorType.SERVER_ERROR, message);
};

export const logAndThrowError = (message: string) => {
    logger.error(message);
    throw new Error(message);
}

export const internalServerError = <T>(err: unknown): DataOrError<T> => {
    logger.error(err);
    return [{
        errorType: ErrorType.SERVER_ERROR,
        error: "Internal server error" // Note: don't return internal error details
    }];
}

/**
 * Shortcut to return non-errored data
 */
export const dataOrErrorData = <T>(data?: T): DataOrError<T> => {
    return [null, data];
}

export const convertedError = <T>(otherError: DataOrErrorError): DataOrError<T> => {
    return [{
        errorType: otherError.errorType,
        error: otherError.error
    }];
}

export const hasError = (dataOrError?: DataOrErrorError): boolean => {
    return !!dataOrError;
}