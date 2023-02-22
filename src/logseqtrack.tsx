import { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin'

import { getDateForPageWithoutBrackets } from "logseq-dateutils";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { DateTime } from "luxon";

import { log_value, pluginId } from "./util";
import * as track from "./toggltrack";

const toolbarKey = "logseqtrack"
const macroPrefix = `:${toolbarKey}`
const icon = "⏲"

interface Settings {
    apiKey: string,
    workspaceid: string,
}

function rendering(slot: string, time: DateTime, block_uuid: string) {

    const template = ReactDOMServer.renderToStaticMarkup(
        <button data-slot-id={slot} data-block-id={block_uuid} data-on-click="onClickTrack">{time.toLocaleString(DateTime.TIME_24_SIMPLE)}</button>
    );

    logseq.provideUI({
        key: pluginId + "__" + slot,
        slot,
        reset: true,
        template: template,
    });
    return true;
}


export function test() { // DEBUG
    logseq.UI.showMsg('Toggl Track in Logseq started.')
}

export function settings() {
    // [Building a settings page for a plugin : logseq](https://www.reddit.com/r/logseq/comments/yu4qlf/comment/iwgchzj/)
    const settingsSchema: SettingSchemaDesc[] = [
        {
            key: 'apiKey',
            type: 'string',
            title: 'Enter your Toggl Api Key',
            description:
                '',
            default: logseq.settings?.['api key'] as string,
        },
        {
            key: 'workspaceid',
            type: 'string',
            title: 'Enter workspaceid to use',
            description:
                '',
            default: logseq.settings?.['workspace id'] as string,
        },
    ]
    logseq.useSettingsSchema(settingsSchema)
}

export function register() {

    const {
        apiKey,
        workspaceid,
    } = logseq.settings as unknown as Settings

    if (!apiKey) {
        logseq.UI.showMsg('Missing Toggl api key', 'warning')
        return
    }

    track.init(apiKey, workspaceid)

    logseq.provideModel({
        async onClickTrackIcon(e: any) {
            // log_value("onClickTrackIcon", e) // DEBUG
            let currentTrack = await track.getCurrentTrack()
            log_value("currentTrack", currentTrack) // DEBUG
            if (currentTrack) {
                currentTrack = await track.stopTrack(currentTrack)
            }
            else {
                appendNewTrack()
            }
        },
        async onClickTrack(e: any) {
            // log_value("onClickTrack", e) // DEBUG
            const { blockId, slotId } = e.dataset

            const block = await logseq.Editor.getBlock(blockId)
            let text = block?.content
            if (text) {
                text = replaceDoubleBraces(text, "")
            }

            appendNewTrack(text)
        }
    })

    logseq.App.onMacroRendererSlotted(async ({ payload, slot }) => {
        log_value("payload", payload) // debug
        log_value("slot", slot) // debug
        const [type, id, starttime, stop] = payload.arguments

        if (type != ":logseqtrack") { // FIX: use Macro
            return
        }

        logseq.provideStyle({
            key: slot,
            style: `
                #${slot} {
                    padding: 0px 4px; 
                    border: 1px solid var(--ls-secondary-border-color); 
                    border-radius: 4px; 
                }
                #${slot}:hover {opacity: .8;}
                #${slot}:active {opacity: .6;}
            `,
        });

        const trackdata: track.TrackData = {
            id: id,
            start: DateTime.fromISO(starttime),
            description: ""
        }
        // ToDo Platzhalter für stop. Will ich stop ändern kopiere ich startzeit auf den stop-Platzhalter. Später mal irgendwie ersetzen sobald der Tasks gestopt ist.
        if (stop != "stop") {
            trackdata.stop = DateTime.fromISO(stop)
        }

        const block_uuid = payload.uuid;
        const text = await extractTextWithoutRendererFromBlock(block_uuid, trackdata);
        trackdata.description = text

        const project = await extractProjectFromLinksInText(text)
        trackdata.project = project

        const result = await track.push2track(trackdata)
        rendering(slot, result.start, block_uuid)
    });

    logseq.Editor.registerSlashCommand(
        `${icon} Track Time`,
        async () => {
            return insertTrackMacro();
        }
    )

    logseq.App.registerUIItem("toolbar", {
        key: toolbarKey,
        // template: `<a class="button" data-on-click="${toolbarKey} height=20px">${icon}</a>`,
        template: `<a class="button" data-on-click="onClickTrackIcon"><i class="ti ti-alarm"></i></a>`,
    })
}


async function extractProjectFromLinksInText(text: string) {
    // Links finden (https://stackoverflow.com/a/24043396) (https://regex101.com/r/Qv8Qnl/5)
    const linksregexp = /(?:^|)(?:(?:(?:\[\[|#\[\[)([^\]]*?)\]\]|(?:#([^\s]*?)(?:\s|$))))(?:$|)/gm;
    const linksarray = [...text.matchAll(linksregexp)];
    let project: number | undefined = undefined
    let links = new Array()
    log_value("linksarray", linksarray) // debug

    for (let index = 0; index < linksarray.length; index++) {
        const entry = linksarray[index];
        let link = entry[1]
        if (!link) {
            link = entry[2]
        }
        links.push(link)
    }
    for (let index = 0; index < links.length; index++) {
        const link = links[index];
        project = await track.getTrackProject(link)
        if (project) {
            links.splice(index, 1);
            break
        }
    }

    log_value("links", links) // debug
    log_value("project", project) // debug
    return project
}

async function extractTextWithoutRendererFromBlock(block_uuid: string, trackdata: track.TrackData) {
    const block = await logseq.Editor.getBlock(block_uuid);
    if (!block) {
        throw new Error("Renderer without Block??");
    }
    const renderertext = constructRendererMacro(trackdata);
    // log_value("renderertext", renderertext); // debug
    const text = block.content.replace(renderertext, "");
    // log_value("text", text); // debug
    return text;
}

function constructRendererMacro(trackdata: track.TrackData) {
    let stop = trackdata.stop?.toISO()
    if (!stop) {
        stop = "stop"
    }
    return `{{renderer ${macroPrefix}, ${trackdata?.id}, ${trackdata?.start.toISO()}, ${stop}}} `;
}

function replaceDoubleBraces(str: string, replace: string) {
    return str.replace(/{{(.+?)}}/, replace).trim()
}

async function insertTrackMacro() {
    const trackdata = await track.push2track();
    const content = constructRendererMacro(trackdata);
    await logseq.Editor.insertAtEditingCursor(content);
}

async function appendNewTrack(text: string = "") {
    // ToDo Add Setting to select Target for new Track (Todays Journal, active Page, clicked Track, ??)

    // Based on todays Journal
    const userConfigs = await logseq.App.getUserConfigs();
    const preferredDateFormat: string = userConfigs.preferredDateFormat;
    // log_value("preferredDateFormat", preferredDateFormat) // DEBUG
    const startingDate = getDateForPageWithoutBrackets(
        new Date(),
        preferredDateFormat
    );
    // log_value("startingDate", startingDate) // DEBUG

    const newBlock = await logseq.Editor.insertBlock(startingDate, "", { isPageBlock: true })

    if (newBlock) {
        logseq.Editor.editBlock(newBlock.uuid, { pos: 0 })
        await insertTrackMacro()
        if (text) {
            await logseq.Editor.insertAtEditingCursor(text)
        }
    }
}

