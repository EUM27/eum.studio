import {
  createManuscriptAnnotationsBridge,
  type BridgeInvoke,
  type ManuscriptAnnotationsBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadManuscriptAnnotationsBridge(
  invoke: BridgeInvoke,
): ManuscriptAnnotationsBridge {
  return createManuscriptAnnotationsBridge((channel, payload) =>
    invoke(channel, payload)
  );
}
