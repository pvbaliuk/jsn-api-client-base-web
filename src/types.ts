import {z} from 'zod/v4';

export type HttpMethod =
    | 'head' | 'HEAD'
    | 'options' | 'OPTIONS'
    | 'get' | 'GET'
    | 'post' | 'POST'
    | 'put' | 'PUT'
    | 'delete' | 'DELETE'
    | 'patch' | 'PATCH';

export type ResponseType = 'text' | 'json' | 'blob' | 'arraybuffer' | 'raw';

export type ValidationTargetType = 'query' | 'request' | 'response';

export type ParamArrayFormat = 'indices' | 'brackets' | 'repeat' | 'comma';
export type ParamDateSerializer = (date: Date) => string;
export type ApiClientConfig = {
    baseURL: string;
    headers?: Record<string, string>;
    mode?: RequestMode;
    credentials?: RequestCredentials;
    responseType?: ResponseType;
    qsArrayFormat?: ParamArrayFormat;
    qsDateSerializer?: ParamDateSerializer;
    authorizationProvider?: (params: ApiRequestParams<any, any, any>) => void|Promise<void>;
}

export type AppendQueryStringOptions = {
    path: string;
    query?: any;
    qsArrayFormat?: ParamArrayFormat;
    qsDateSerializer?: ParamDateSerializer;
}

export type ApiRequestParams<
    I extends z.ZodTypeAny|undefined,
    Q extends z.ZodTypeAny|undefined,
    O extends z.ZodTypeAny|undefined
> = {
    method: HttpMethod;
    path: string;
    headers?: Record<string, string>;
    query?: any;
    data?: any;
    mode?: RequestMode;
    credentials?: RequestCredentials;
    responseType?: ResponseType;
    signal?: AbortSignal;
    $input?: I;
    $query?: Q;
    $output?: O;
}

export type ApiErrorParams = {
    url: string;
    method: HttpMethod;
}

export type UnexpectedErrorParams = ApiErrorParams & {
    original: unknown;
}

export type HttpErrorParams = ApiErrorParams & {
    statusCode: number;
    statusText: string;
    responseData?: any;
    error_message?: string;
}

export type ValidationErrorParams = ApiErrorParams & {
    target: ValidationTargetType;
    validation_error_message: string;
}

//region Inference

type _helperResponseTypeMapping = {
    raw: undefined;
    text: string;
    json: any;
    blob: Blob;
    arraybuffer: ArrayBuffer;
}

export type InferResponseType<T extends ResponseType> = T extends keyof _helperResponseTypeMapping
    ? _helperResponseTypeMapping[T]
    : unknown;

type _helperInferResType<T extends ApiClientConfig|ApiRequestParams<any, any, any>> =
    'responseType' extends keyof T
        ? T['responseType'] extends ResponseType
            ? T['responseType']
            : undefined
        : undefined;

type _helperInferResponseType<C extends ApiClientConfig, T extends ApiRequestParams<any, any, any>> =
    _helperInferResType<T> extends undefined
        ? _helperInferResType<C> extends undefined
            ? undefined
            : _helperInferResType<C>
        : _helperInferResType<T>;

export type InferApiResponse<C extends ApiClientConfig, T extends ApiRequestParams<any, any, any>> =
    _helperInferResponseType<C, T> extends 'raw'
        ? Response
        : '$output' extends keyof T
            ? T['$output'] extends z.ZodTypeAny
                ? z.output<T['$output']>
                : InferResponseType<_helperInferResponseType<C, T>>
            : InferResponseType<_helperInferResponseType<C, T>>;

//endregion
