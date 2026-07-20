import type { StudioBridge } from "../application/contracts/studio-bridge";

declare global {
  interface Window {
    eumStudio: StudioBridge;
  }
}

export {};
