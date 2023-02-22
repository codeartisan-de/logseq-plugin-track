import "@logseq/libs";

import "./index.css";

import { pluginId } from "./util";
import * as lst from "./logseqtrack";


function main() {
  console.info(`#${pluginId}: MAIN`);
  
  lst.settings()

  lst.register()

  lst.test()

  console.info(`#${pluginId}: MAIN Done`);
}

logseq.ready(main).catch(console.error);
