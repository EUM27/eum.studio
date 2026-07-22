import { contextBridge, ipcRenderer } from "electron";

import {
  createStudioBridge,
  MANUSCRIPT_INPUT_PROFILE_CHANNEL,
  RUNTIME_INFO_CHANNEL,
} from "../application/contracts/studio-bridge";

const studioBridge = createStudioBridge((channel) => {
  if (
    channel !== RUNTIME_INFO_CHANNEL &&
    channel !== MANUSCRIPT_INPUT_PROFILE_CHANNEL
  ) {
    return Promise.reject(new Error("Unsupported bridge channel"));
  }
  return ipcRenderer.invoke(channel);
});

contextBridge.exposeInMainWorld("eumStudio", studioBridge);
