import {
    ApiErrorParams, HttpErrorParams, HttpMethod, UnexpectedErrorParams, ValidationErrorParams,
    ValidationTargetType
} from './types';

export class ApiError extends Error{

    public readonly url: string;
    public readonly method: HttpMethod;

    /**
     * @param {ApiErrorParams} params
     * @param {string} message
     */
    public constructor(params: ApiErrorParams, message?: string) {
        super(message);

        this.name = 'ApiError';
        this.url = params.url;
        this.method = params.method;
    }

}

export class UnexpectedError extends ApiError{

    public readonly original: unknown;

    /**
     * @param {UnexpectedErrorParams} params
     */
    public constructor(params: UnexpectedErrorParams) {
        super(params);

        this.name = 'UnexpectedError';
        this.original = params.original;
    }

}

export class ConnectionError extends ApiError{

    public constructor(params: ApiErrorParams, message?: string) {
        super(params, message);

        this.name = 'ConnectionError';
    }

}

export class HttpError extends ApiError{

    public readonly statusCode: number;
    public readonly statusText: string;
    public readonly responseData?: any;

    /**
     * @param {HttpErrorParams} params
     */
    public constructor(params: HttpErrorParams) {
        super(params);

        this.name = 'HttpError';
        this.statusCode = params.statusCode;
        this.statusText = params.statusText;
        this.responseData = params.responseData;
    }

}

export class ValidationError extends ApiError{

    public readonly target: ValidationTargetType;

    /**
     * @param {ValidationErrorParams} params
     */
    public constructor(params: ValidationErrorParams) {
        super(params, params.validation_error_message);

        this.name = 'ValidationError';
        this.target = params.target;
    }

}
