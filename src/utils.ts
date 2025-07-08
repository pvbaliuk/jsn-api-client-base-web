import * as QueryString from 'qs';
import {AppendQueryStringOptions} from './types';

/**
 * @param {AppendQueryStringOptions} options
 * @returns {string}
 */
export function appendQueryString({path, query, qsArrayFormat, qsDateSerializer}: AppendQueryStringOptions): string{
    if(!query)
        return path;

    const qIndex = path.indexOf('?');
    if(qIndex === -1){
        path += '?';
    }else if(qIndex < path.length - 1){
        path += '&';
    }

    path += QueryString.stringify(query, {
        arrayFormat: qsArrayFormat ?? 'brackets',
        serializeDate: qsDateSerializer
    });

    return path;
}


/**
 * @param {string} baseURL
 * @param {string} path_and_rest
 * @returns {string}
 */
export function getAbsoluteRequestURL(baseURL: string, path_and_rest: string): string{
    return (baseURL.replace(/\/+$/, '')
        + '/' + path_and_rest.replace(/^\/+/, '')
    ).replaceAll(/\/{2,}/g, '/');
}
