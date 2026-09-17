import {
  parseCreateManuscriptAnnotationCommand,
  parseListManuscriptAnnotationsCommand,
  parseManuscriptAnnotationListProjection,
  parseManuscriptAnnotationProjection,
  parseRetireManuscriptAnnotationCommand,
  parseUpdateManuscriptAnnotationCommand,
  type CreateManuscriptAnnotationCommand,
  type ListManuscriptAnnotationsCommand,
  type ManuscriptAnnotationListProjection,
  type ManuscriptAnnotationProjection,
  type RetireManuscriptAnnotationCommand,
  type UpdateManuscriptAnnotationCommand,
} from "../../review/manuscript-annotation-contract";

export const MANUSCRIPT_ANNOTATION_CREATE_CHANNEL =
  "studio:manuscript-annotations:create";
export const MANUSCRIPT_ANNOTATION_LIST_CHANNEL =
  "studio:manuscript-annotations:list";
export const MANUSCRIPT_ANNOTATION_UPDATE_CHANNEL =
  "studio:manuscript-annotations:update";
export const MANUSCRIPT_ANNOTATION_RETIRE_CHANNEL =
  "studio:manuscript-annotations:retire";

export type ManuscriptAnnotationsBridgeChannel =
  | typeof MANUSCRIPT_ANNOTATION_CREATE_CHANNEL
  | typeof MANUSCRIPT_ANNOTATION_LIST_CHANNEL
  | typeof MANUSCRIPT_ANNOTATION_UPDATE_CHANNEL
  | typeof MANUSCRIPT_ANNOTATION_RETIRE_CHANNEL;

export type ManuscriptAnnotationsBridgePayload =
  | CreateManuscriptAnnotationCommand
  | ListManuscriptAnnotationsCommand
  | UpdateManuscriptAnnotationCommand
  | RetireManuscriptAnnotationCommand;

export type ManuscriptAnnotationsBridge = Readonly<{
  create: (
    command: CreateManuscriptAnnotationCommand,
  ) => Promise<ManuscriptAnnotationProjection>;
  list: (
    command: ListManuscriptAnnotationsCommand,
  ) => Promise<ManuscriptAnnotationListProjection>;
  update: (
    command: UpdateManuscriptAnnotationCommand,
  ) => Promise<ManuscriptAnnotationProjection>;
  retire: (
    command: RetireManuscriptAnnotationCommand,
  ) => Promise<ManuscriptAnnotationProjection>;
}>;

export type ManuscriptAnnotationsBridgeInvoke = (
  channel: ManuscriptAnnotationsBridgeChannel,
  payload: ManuscriptAnnotationsBridgePayload,
) => Promise<unknown>;

export function createManuscriptAnnotationsBridge(
  invoke: ManuscriptAnnotationsBridgeInvoke,
): ManuscriptAnnotationsBridge {
  return Object.freeze({
    create: async (input) => {
      const command = parseCreateManuscriptAnnotationCommand(input);
      const result = await invoke(MANUSCRIPT_ANNOTATION_CREATE_CHANNEL, command);
      return parseManuscriptAnnotationProjection(result);
    },
    list: async (input) => {
      const command = parseListManuscriptAnnotationsCommand(input);
      const result = await invoke(MANUSCRIPT_ANNOTATION_LIST_CHANNEL, command);
      return parseManuscriptAnnotationListProjection(result);
    },
    update: async (input) => {
      const command = parseUpdateManuscriptAnnotationCommand(input);
      const result = await invoke(MANUSCRIPT_ANNOTATION_UPDATE_CHANNEL, command);
      return parseManuscriptAnnotationProjection(result);
    },
    retire: async (input) => {
      const command = parseRetireManuscriptAnnotationCommand(input);
      const result = await invoke(MANUSCRIPT_ANNOTATION_RETIRE_CHANNEL, command);
      return parseManuscriptAnnotationProjection(result);
    },
  });
}
