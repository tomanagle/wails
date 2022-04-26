/*
 _       __      _ __
| |     / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/

/* jshint esversion: 6 */

import {EventsEmit} from './events';

class CacheEntry {
    constructor(data, mimetype) {
        this.data = data || new ArrayBuffer(0);
        this.mimetype = mimetype;
    }

    toString() {
        const arr = new Uint8Array(this.data);
        return new TextDecoder().decode(arr);
    }

    tojSON() {
        const str = this.toString();
        return JSON.parse(str);
    }

    toObjectURL() {
        return URL.createObjectURL(new Blob([this.data]));
    }
}

export function CacheGet(key) {
    return new Promise(function (resolve, reject) {
        fetch("/cache/" + key)
            .then((res) => {
                if (!res.ok) {
                    return resolve(null);
                }
                let mimetype = res.headers.get("content-type");
                res.arrayBuffer()
                    .then((buffer) => {
                        EventsEmit("wails:cache:get", key);
                        return resolve(new CacheEntry(buffer, mimetype));
                    })
                    .catch((err) => {
                        return reject(err);
                    });
            })
            .catch((err) => {
                return reject(err);
            });
    });
}

export function CacheSet(key, data) {
    return new Promise(function (resolve, reject) {
        let convertedData = data;
        if (typeof data === 'object') {
            try {
                convertedData = JSON.stringify(data);
            } catch (e) {
            }
        }
        fetch("/cache/" + key, {
            method: 'PUT',
            body: convertedData
        }).then((res) => {
            if (!res.ok) {
                return reject();
            }
            EventsEmit("wails:cache:set", key);
            return resolve();
        }).catch((err) => {
            return reject(err);
        });
    });
}

export function CacheDelete(key) {
    return new Promise(function (resolve, reject) {
        fetch("/cache/" + key, {
            method: 'DELETE'
        }).then((res) => {
            if (!res.ok) {
                return reject();
            }
            EventsEmit("wails:cache:delete", key);
            return resolve();
        }).catch((err) => {
            return reject(err);
        });
    });
}

