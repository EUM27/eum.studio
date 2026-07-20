import { contextBridge, ipcRenderer } from "electron";

import {
  createStudioBridge,
  RUNTIME_INFO_CHANNEL,
} from "../application/contracts/studio-bridge";

const studioBridge = createStudioBridge((channel) => {
  if (channel !== RUNTIME_INFO_CHANNEL) {
    return Promise.reject(new Error("Unsupported bridge channel"));
  }
  return ipcRenderer.invoke(channel);
});

contextBridge.exposeInMainWorld("eumStudio", studioBridge);
