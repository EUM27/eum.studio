export type SecureWebPreferences = {
  preload: string;
  contextIsolation: true;
  nodeIntegration: false;
  sandbox: true;
  webSecurity: true;
};

export function createSecureWebPreferences(
  preloadPath: string,
): SecureWebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
  };
}

export function isAllowedRendererNavigation(
  requestedTarget: string,
  configuredTarget: string,
): boolean {
  return requestedTarget === configuredTarget;
}

export function shouldShowMainWindow(
  configuredVisibility: string | undefined,
): boolean {
  return configuredVisibility !== "hidden";
}
