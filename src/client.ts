import {z} from 'zod/v4';
import {
    ApiClient, ApiRequestParams, CreateClientConfig, InferApiResponse, InferResponseType, ResponseType
} from './types';
import {appendQueryString, getAbsoluteRequestURL} from './utils';
import {ConnectionError, HttpError, UnexpectedError, ValidationError} from './errors';

export function createClient<C extends CreateClientConfig>(config: C): ApiClient<C>{
    //region Utils

    const appendQs = (path: string, query?: any) => appendQueryString({
        path: path,
        query: query,
        qsArrayFormat: config.qsArrayFormat,
        qsDateSerializer: config.qsDateSerializer
    });

    const getAbsURL = getAbsoluteRequestURL.bind(null, config.baseURL) as (path_n_rest: string) => string;

    const provideAuthorization = (params: ApiRequestParams<any, any, any>) => {
        if(!config.authorizationProvider || typeof config.authorizationProvider !== 'function')
            return;

        return config.authorizationProvider(params);
    };

    const getResponseData = <T extends ResponseType>(response: Response, responseType: ResponseType): Promise<InferResponseType<T>> => {
        switch(responseType){
            case 'raw': return Promise.resolve(undefined) as Promise<InferResponseType<T>>;
            case 'text': return response.text() as Promise<InferResponseType<T>>;
            case 'json': return response.json() as Promise<InferResponseType<T>>;
            case 'blob': return response.blob() as Promise<InferResponseType<T>>;
            case 'arraybuffer': return response.arrayBuffer() as Promise<InferResponseType<T>>;
            default: return Promise.reject(new Error(`Unsupported response type: ${responseType}`));
        }
    }

    //endregion

    return async function<T extends ApiRequestParams<any, any, any>>(params: T): Promise<InferApiResponse<C, T>>{
        const responseType = config.responseType ?? params.responseType ?? 'raw',
            previewEndpointURI = appendQs(params.path, params.query),
            previewRequestURL = getAbsURL(previewEndpointURI);

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
        await provideAuthorization(params);

        const endpointURI = appendQs(params.path, params.query),
            requestURL = getAbsURL(endpointURI);

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
        for(const [k, v] of Object.entries(config?.headers ?? {}))
            headers[k.toLowerCase()] = v;

        for(const [k, v] of Object.entries(params?.headers ?? {}))
            headers[k.toLowerCase()] = v;

        // Make a request
        try{
            response = await fetch(requestURL, {
                method: params.method,
                mode: params.mode ?? config.mode ?? 'cors',
                credentials: params.credentials ?? config.credentials ?? 'include',
                headers: headers,
                body: params.data,
                signal: params.signal
            });
        }catch(e){
            if(e?.message?.toLowerCase?.()?.includes('failed to fetch'))
                throw new ConnectionError({method: params.method, url: requestURL});

            throw new UnexpectedError({method: params.method, url: requestURL, original: e});
        }

        let responseData = getResponseData(response, responseType);
        if(!!params.$output){
            try{
                responseData = params.$output.parse(responseData);
            }catch(e){
                throw new ValidationError({
                    method: params.method,
                    url: requestURL,
                    target: 'response',
                    validation_error_message: z.prettifyError(e)
                });
            }
        }

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
    };
}
