import type { WebContents } from "electron";
import {
  MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  type ManuscriptCloseRequest,
} from "../../application/contracts/studio-bridge";

export function sendManuscriptCloseRequest(
  target: Pick<WebContents, "send">,
  request: ManuscriptCloseRequest,
): void {
  target.send(MANUSCRIPT_CLOSE_REQUEST_CHANNEL, request);
}
