import type {
  PocResumeCheckpointPublicationCodec,
  PocResumeCheckpointPublicationPayload,
} from "./poc-resume-checkpoint-publication";

export function createJsonPocResumeCheckpointPublicationCodec(
  codecId: string,
): PocResumeCheckpointPublicationCodec {
  if (codecId.length === 0) {
    throw new Error(
      "POC ResumeCheckpoint publication codec ID must not be empty",
    );
  }
  return Object.freeze({
    id: codecId,
    async encode(payload) {
      return new TextEncoder().encode(
        JSON.stringify(payload),
      );
    },
    async decode(bytes) {
      return JSON.parse(
        new TextDecoder("utf-8", {
          fatal: true,
        }).decode(bytes),
      ) as PocResumeCheckpointPublicationPayload;
    },
  });
}
