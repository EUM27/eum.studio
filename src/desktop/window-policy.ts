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

export type RendererIpcSenderBoundary = {
  readonly senderWebContentsId: number;
  readonly trustedWebContentsId: number;
  readonly senderFrameUrl: string;
  readonly senderMainFrameUrl: string;
  readonly configuredRendererTarget: string;
};

export function isTrustedRendererIpcSender(
  input: RendererIpcSenderBoundary,
): boolean {
  if (
    input.senderWebContentsId !==
      input.trustedWebContentsId ||
    input.senderFrameUrl !==
      input.configuredRendererTarget ||
    input.senderMainFrameUrl !==
      input.configuredRendererTarget
  ) {
    return false;
  }
  try {
    const configuredTarget = new URL(
      input.configuredRendererTarget,
    );
    return (
      new URL(input.senderFrameUrl).origin ===
        configuredTarget.origin &&
      new URL(
        input.senderMainFrameUrl,
      ).origin === configuredTarget.origin
    );
  } catch {
    return false;
  }
}

export function shouldShowMainWindow(
  configuredVisibility: string | undefined,
): boolean {
  return configuredVisibility !== "hidden";
}
