import "@logseq/libs";

import React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { pluginId } from "./util";
import * as lst from "./logseqtrack";

// @ts-expect-error
const css = (t, ...args) => String.raw(t, ...args);

function main() {
  console.info(`#${pluginId}: MAIN`);
  
  // templateMainUI();

  lst.settings()

  lst.register()

  lst.test()

  console.info(`#${pluginId}: MAIN Done`);

  // Main UI Template not used atm - also App.tsx, utils.ts
  function templateMainUI() {
    const root = ReactDOM.createRoot(document.getElementById("app")!);

    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    function createModel() {
      return {
        show() {
          logseq.showMainUI();
        },
      };
    }

    logseq.provideModel(createModel());
    logseq.setMainUIInlineStyle({
      zIndex: 11,
    });

    const openIconName = "template-plugin-open";

    logseq.provideStyle(css`
    .${openIconName} {
      opacity: 0.55;
      font-size: 20px;
      margin-top: 4px;
    }

    .${openIconName}:hover {
      opacity: 0.9;
    }
  `);

    logseq.App.registerUIItem("toolbar", {
      key: openIconName,
      template: `
      <div data-on-click="show" class="${openIconName}">⚙️</div>
    `,
    });
  }
}

logseq.ready(main).catch(console.error);
