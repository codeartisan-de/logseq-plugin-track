import { DateTime } from "luxon";
import axios from 'axios';

import { log_value } from './util';


export interface TrackData {
    id: string;
    start: DateTime;
    description: string;
    project?: number;
    stop?: DateTime;
    duration?: number;
}

const trackprojects = new Map()

let toggl_apiKey: string
let toggl_workspaceid: string


export async function init(apiKey: string, workspaceid: string) {
    toggl_apiKey = apiKey
    toggl_workspaceid = workspaceid
    loadProjectsFromTrack()
}

export async function loadProjectsFromTrack() {
    const togglprojects = await toggl_getprojects()
    // log_value("togglprojects", togglprojects) //debug
    togglprojects.forEach((project: { name: string; id: number; }) => {
        trackprojects.set(project.name, project.id)
    });
    // log_value("trackprojects", trackprojects) //debug
}

export function getTrackProject(link: any) {
    return trackprojects.get(link)
}

export async function push2track(data?: TrackData) {
    let result = undefined
    if (data) {
        result = await toggl_timeentry_request(`time_entries/${data.id}`, 'put', data)
    }
    else {
        result = await toggl_timeentry_request('time_entries/start', 'post')
    }

    if (!result) {
        throw new Error("TimeEntry missing?!");
    }
    return result
}

export async function getCurrentTrack() {
    return toggl_timeentry_request(`time_entries/current`, 'get')
}

export async function stopTrack(data: TrackData) {
    return toggl_timeentry_request(`time_entries/${data.id}/stop`, 'put')
}


async function toggl_timeentry_request(func: string, meth: string, trackdata?: TrackData) {
    let data = {}
    if (meth !== "get") {
        data = {
            "time_entry": {
                "description": trackdata?.description,
                "start": trackdata?.start,
                "stop": trackdata?.stop,
                // "tags": tags,
                "pid": trackdata?.project,
                "created_with": "logseq-plugin-track"
            }
        }
    }
    // log_value("data", data) //debug

    const response = await toggl_request(func, meth, data)
    log_value("response", response) //debug

    if (!response) {
        throw new Error("No response!");
    }

    if (!response.data.data) {
        return null
    }

    const result: TrackData = {
        id: response.data.data.id,
        start: DateTime.fromISO(response.data.data.start),
        stop: DateTime.fromISO(response.data.data.stop),
        duration: response.data.data.duration,
        description: response.data.data.description,
    }

    // log_value("result", result) //debug
    return result
}

async function toggl_getprojects() {
    const response = await toggl_request(`workspaces/${toggl_workspaceid}/projects`, 'get')
    log_value("response", response) //debug

    if (!response) {
        throw new Error("No response!");
    }
    return response.data
}


async function toggl_request(func: string, meth: string, data = {}) {
    const toggl_url = 'https://api.track.toggl.com/api/v8/' + func
    let url = toggl_url;

    try {
        const response = await axios.request({
            url: url,
            method: meth,
            data: data,
            auth: {
                username: toggl_apiKey,
                password: 'api_token'
            }
        });
        // console.log(response) //debug
        return response
    } catch (error) {
        console.error(error);
    }
}

