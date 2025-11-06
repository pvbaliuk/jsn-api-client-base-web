import {ApiRequestParams, ApiClientConfig, InferApiResponse, InferResponseType, ResponseType} from './types';
import {appendQueryString, getAbsoluteRequestURL} from './utils';
import {ConnectionError, HttpError, UnexpectedError, UnexpectedResponseFormatError, ValidationError} from './errors';
import {z} from 'zod/v4';

/**
 * @template {ApiClientConfig} C
 */
export class ApiClient<C extends ApiClientConfig>{

    protected readonly config: C;

    /**
     * @param {C} config
     */
    public constructor(config: C) {
        this.config = config;
    }

    /**
     * @template {ApiRequestParams<any, any, any>} T
     * @param {T} params
     * @returns {Promise<InferApiResponse<C, T>>}
     */
    public async send<T extends ApiRequestParams<any, any, any>>(params: T): Promise<InferApiResponse<C, T>>{
        const responseType =  params.responseType ?? this.config.responseType ?? 'raw',
            previewEndpointURI = this.appendQs(params.path, params.query),
            previewRequestURL = this.getAbsURL(previewEndpointURI);

        let response: Response|undefined = undefined;

        // Validate request query params
        if(!!params.$query){
            try{
                params.query = params.$query.parse(params.query);
            }catch(e){
                throw new ValidationError({
                    method: params.method,
                    url: previewRequestURL,
                    target: 'query',
                    validation_error_message: z.prettifyError(e)
                });
            }
        }

        // Provide auth
        await this.provideAuthorization(params);

        const endpointURI = this.appendQs(params.path, params.query),
            requestURL = this.getAbsURL(endpointURI);

        // Validate request body
        if(!!params.$input){
            try{
                params.data = params.$input.parse(params.data);
            }catch(e){
                throw new ValidationError({
                    method: params.method,
                    url: requestURL,
                    target: 'request',
                    validation_error_message: z.prettifyError(e)
                });
            }
        }

        // Join headers
        const headers: Record<string, string> = {};
        for(const [k, v] of Object.entries(this.config?.headers ?? {}))
            headers[k.toLowerCase()] = v;

        for(const [k, v] of Object.entries(params?.headers ?? {}))
            headers[k.toLowerCase()] = v;

        // Prepare request data
        let requestData: any|undefined = undefined;
        if(!(params.data instanceof Blob)
            && !(params.data instanceof ArrayBuffer)
            && !(params.data instanceof FormData)
            && !(params.data instanceof URLSearchParams)
            && !(params.data instanceof ReadableStream)
        ){
            if(typeof params.data === 'string' || typeof params.data === 'number' || typeof params.data === 'boolean' || typeof params.data === 'bigint'){
                requestData = params.data.toString();
            }else if(typeof params.data === 'object'){
                requestData = JSON.stringify(params.data);
            }
        }

        // Make a request
        try{
            response = await fetch(requestURL, {
                method: params.method,
                mode: params.mode ?? this.config.mode ?? 'cors',
                credentials: params.credentials ?? this.config.credentials ?? 'include',
                headers: headers,
                body: requestData,
                signal: params.signal
            });
        }catch(e){
            if(e?.message?.toLowerCase?.()?.includes('failed to fetch'))
                throw new ConnectionError({method: params.method, url: requestURL});

            throw new UnexpectedError({method: params.method, url: requestURL, original: e});
        }

        let responseData: any|undefined = undefined,
            throwErr: Error|null = null;

        try{
            responseData = await this.getResponseData(response, responseType);
        }catch(e){
            throwErr = new UnexpectedResponseFormatError({
                method: params.method,
                url: requestURL,
                expected: responseType,
                original: e
            });
        }

        if(!!params.$output && !throwErr){
            try{
                responseData = params.$output.parse(responseData);
            }catch(e){
                throwErr = new ValidationError({
                    method: params.method,
                    url: requestURL,
                    target: 'response',
                    validation_error_message: z.prettifyError(e)
                });
            }
        }

        if(response.ok && throwErr)
            throw throwErr;

        if(!response.ok)
            throw new HttpError({
                method: params.method,
                url: requestURL,
                statusCode: response.status,
                statusText: response.statusText,
                responseData: responseData
            });

        if(responseType === 'raw')
            return response as InferApiResponse<C, T>;

        return responseData as InferApiResponse<C, T>;
    }

    /**
     * @param {ApiRequestParams<any, any, any>} params
     * @returns {void | Promise<void>}
     */
    protected provideAuthorization = (params: ApiRequestParams<any, any, any>): void|Promise<void> => {
        if(!this.config.authorizationProvider || typeof this.config.authorizationProvider !== 'function')
            return;

        return this.config.authorizationProvider(params);
    }

    /**
     * @param {string} path
     * @param {*} [query]
     * @returns {string}
     * @private
     */
    private appendQs(path: string, query?: any): string {
        return appendQueryString({
            path: path,
            query: query,
            qsArrayFormat: this.config.qsArrayFormat ?? 'brackets',
            qsDateSerializer: this.config.qsDateSerializer
        });
    }

    /**
     * @param {string} path_n_rest
     * @returns {string}
     * @private
     */
    private getAbsURL(path_n_rest: string): string {
        return getAbsoluteRequestURL(this.config.baseURL, path_n_rest);
    }

    /**
     * @template {ResponseType} T
     * @param {Response} response
     * @param {T} responseType
     * @returns {Promise<InferResponseType<T>>}
     * @private
     */
    private getResponseData<T extends ResponseType>(response: Response, responseType: T): Promise<InferResponseType<T>>{
        switch(responseType){
            case 'raw': return Promise.resolve(undefined) as Promise<InferResponseType<T>>;
            case 'text': return response.text() as Promise<InferResponseType<T>>;
            case 'json': return response.json() as Promise<InferResponseType<T>>;
            case 'blob': return response.blob() as Promise<InferResponseType<T>>;
            case 'arraybuffer': return response.arrayBuffer() as Promise<InferResponseType<T>>;
            default: return Promise.reject(new Error(`Unsupported response type: ${responseType}`));
        }
    }

}
