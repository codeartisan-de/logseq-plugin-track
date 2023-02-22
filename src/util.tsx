import { logseq as PL } from "../package.json";

export const pluginId = PL.id;

export function log_value(name: string, value: any) {
    log(`${name} = `)
    console.info(value);
}
export function log(text: string) {
    console.info(`#${pluginId}: ${text}`);
}


