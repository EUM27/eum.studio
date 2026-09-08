import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { parseAssistantConnectorManifestProfile } from "../../application/assistant/assistant-connector-manifest";
import { parseAssistantDestinationProfile } from "../../application/assistant/assistant-destination-profile";
import { parseChatGptOAuthProfile } from "../../application/assistant/chatgpt-oauth";
import { parseManuscriptDocumentProfile } from "../../application/editor/manuscript-document-profile";
import { parseManuscriptFormattingProfile } from "../../application/editor/manuscript-formatting";
import { parseManuscriptInputProfile } from "../../application/editor/manuscript-input-profile";
import { parseManuscriptPreflightProfile } from "../../application/editor/manuscript-preflight";
import { parseForeshadowPointProfile } from "../../application/foreshadowing/foreshadow-point-contract";
import { parseFragmentShelfProfile } from "../../application/fragments/fragment-contract";
import { parseMusicSettingsProfile } from "../../application/music/work-music-settings";
import { parseYouTubeMusicProfile } from "../../application/music/youtube-music";
import { parseManuscriptBatchingPolicy } from "../../application/persistence/manuscript-persistence-profile";
import { parsePublishingMailConnectorProfile } from "../../application/publishing/publishing-mail-connection-contract";
import { parseAppSettingsProfile } from "../../application/settings/app-settings";
import { parseLocalWorkspaceBackupProfile } from "../../application/storage/local-workspace-backup-profile";
import { parseManuscriptJournalRuntimeProfile } from "../manuscript-journal-runtime-profile";
import { createPoc2CrashGate, parsePoc2CrashGateProfile } from "../poc-2-crash-gate-profile";
import { parsePocRecoveryApplyRuntimeProfile } from "../poc-recovery-apply-runtime-profile";
import { parsePocResumeCheckpointRuntimeProfile } from "../poc-resume-checkpoint-runtime-profile";
import { readRuntimeProfileValue } from "../runtime-profile-source";

export function loadApplicationProfiles(input: Readonly<{
  environment: Readonly<NodeJS.ProcessEnv>;
  getAppPath: () => string;
  onYouTubePlayerReferer: (referer: ReturnType<typeof parseYouTubeMusicProfile>["playerReferer"]) => void;
}>) {
  const ephemeralWorkId = randomUUID();
  const ephemeralDocumentId = randomUUID();
  const ephemeralRevisionId = randomUUID();
  const ephemeralDocumentProfile = parseManuscriptDocumentProfile({
    schemaVersion: 1,
    initialDocumentId: ephemeralDocumentId,
    documents: [
      {
        workId: ephemeralWorkId,
        documentId: ephemeralDocumentId,
        documentRevisionId: ephemeralRevisionId,
        label: "새 원고",
        initialText: "",
      },
    ],
  });
  const documentProfileValue = readRuntimeProfileValue({
    inlineJson:
      input.environment.EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE,
    filePath:
      input.environment.EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const documentProfile =
    documentProfileValue === null
      ? ephemeralDocumentProfile
      : parseManuscriptDocumentProfile(documentProfileValue);
  const manuscriptInputProfileValue = readRuntimeProfileValue({
    inlineJson: input.environment.EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE,
    filePath: input.environment.EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const manuscriptInputProfile = parseManuscriptInputProfile(
    manuscriptInputProfileValue ??
    JSON.parse(
      readFileSync(
        path.join(input.getAppPath(), "config", "manuscript-input.json"),
        "utf8",
      ),
    ),
  );
  const formattingProfileValue = readRuntimeProfileValue({
    inlineJson:
      input.environment.EUM_STUDIO_MANUSCRIPT_FORMATTING_PROFILE,
    filePath:
      input.environment.EUM_STUDIO_MANUSCRIPT_FORMATTING_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const formattingProfile = parseManuscriptFormattingProfile(
    formattingProfileValue ??
    JSON.parse(
      readFileSync(
        path.join(
          input.getAppPath(),
          "config",
          "manuscript-formatting.json",
        ),
        "utf8",
      ),
    ),
  );
  const appSettingsProfileValue = readRuntimeProfileValue({
    inlineJson: input.environment.EUM_STUDIO_APP_SETTINGS_PROFILE,
    filePath: input.environment.EUM_STUDIO_APP_SETTINGS_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const appSettingsProfile = parseAppSettingsProfile(
    appSettingsProfileValue ??
    JSON.parse(
      readFileSync(
        path.join(input.getAppPath(), "config", "app-settings.json"),
        "utf8",
      ),
    ),
  );
  const musicSettingsProfileValue = readRuntimeProfileValue({
    inlineJson: input.environment.EUM_STUDIO_MUSIC_SETTINGS_PROFILE,
    filePath: input.environment.EUM_STUDIO_MUSIC_SETTINGS_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const musicSettingsProfile = parseMusicSettingsProfile(
    musicSettingsProfileValue ??
    JSON.parse(
      readFileSync(
        path.join(input.getAppPath(), "config", "music-settings.json"),
        "utf8",
      ),
    ),
  );
  const assistantDestinationProfileValue = readRuntimeProfileValue({
    inlineJson: input.environment.EUM_STUDIO_ASSISTANT_DESTINATION_PROFILE,
    filePath: input.environment.EUM_STUDIO_ASSISTANT_DESTINATION_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const assistantDestinationProfile = parseAssistantDestinationProfile(
    assistantDestinationProfileValue ??
    JSON.parse(
      readFileSync(
        path.join(input.getAppPath(), "config", "assistant-destinations.json"),
        "utf8",
      ),
    ),
  );
  const assistantConnectorProfileValue = readRuntimeProfileValue({
    inlineJson: input.environment.EUM_STUDIO_ASSISTANT_CONNECTOR_PROFILE,
    filePath: input.environment.EUM_STUDIO_ASSISTANT_CONNECTOR_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const assistantConnectorProfile = parseAssistantConnectorManifestProfile(
    assistantConnectorProfileValue ??
    JSON.parse(
      readFileSync(
        path.join(input.getAppPath(), "config", "assistant-connectors.json"),
        "utf8",
      ),
    ),
  );
  const chatGptOAuthProfileValue = readRuntimeProfileValue({
    inlineJson: input.environment.EUM_STUDIO_CHATGPT_OAUTH_PROFILE,
    filePath: input.environment.EUM_STUDIO_CHATGPT_OAUTH_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const chatGptOAuthProfile = parseChatGptOAuthProfile(
    chatGptOAuthProfileValue ??
    JSON.parse(
      readFileSync(
        path.join(input.getAppPath(), "config", "chatgpt-oauth.json"),
        "utf8",
      ),
    ),
  );
  const youtubeMusicProfileValue = readRuntimeProfileValue({
    inlineJson: input.environment.EUM_STUDIO_YOUTUBE_MUSIC_PROFILE,
    filePath: input.environment.EUM_STUDIO_YOUTUBE_MUSIC_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const youtubeMusicProfile = parseYouTubeMusicProfile(
    youtubeMusicProfileValue ??
    JSON.parse(
      readFileSync(
        path.join(input.getAppPath(), "config", "youtube-music.json"),
        "utf8",
      ),
    ),
  );
  input.onYouTubePlayerReferer(youtubeMusicProfile.playerReferer);
  const publishingMailConnectorProfileValue = readRuntimeProfileValue({
    inlineJson: input.environment.EUM_STUDIO_PUBLISHING_MAIL_CONNECTOR_PROFILE,
    filePath: input.environment.EUM_STUDIO_PUBLISHING_MAIL_CONNECTOR_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const publishingMailConnectorProfile = parsePublishingMailConnectorProfile(
    publishingMailConnectorProfileValue ??
    JSON.parse(
      readFileSync(
        path.join(input.getAppPath(), "config", "publishing-mail-connectors.json"),
        "utf8",
      ),
    ),
  );
  const preflightProfileValue = readRuntimeProfileValue({
    inlineJson:
      input.environment.EUM_STUDIO_MANUSCRIPT_PREFLIGHT_PROFILE,
    filePath:
      input.environment.EUM_STUDIO_MANUSCRIPT_PREFLIGHT_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const preflightProfile = parseManuscriptPreflightProfile(
    preflightProfileValue ??
    JSON.parse(
      readFileSync(
        path.join(
          input.getAppPath(),
          "config",
          "manuscript-preflight.json",
        ),
        "utf8",
      ),
    ),
  );
  const fragmentProfileValue = readRuntimeProfileValue({
    inlineJson: input.environment.EUM_STUDIO_FRAGMENT_SHELF_PROFILE,
    filePath: input.environment.EUM_STUDIO_FRAGMENT_SHELF_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const fragmentProfile = parseFragmentShelfProfile(
    fragmentProfileValue ?? JSON.parse(readFileSync(
      path.join(input.getAppPath(), "config", "fragment-shelf.json"),
      "utf8",
    )),
  );
  const foreshadowPointProfileValue = readRuntimeProfileValue({
    inlineJson: input.environment.EUM_STUDIO_FORESHADOW_POINT_PROFILE,
    filePath: input.environment.EUM_STUDIO_FORESHADOW_POINT_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const foreshadowPointProfile = parseForeshadowPointProfile(
    foreshadowPointProfileValue ?? JSON.parse(readFileSync(
      path.join(input.getAppPath(), "config", "foreshadowing.json"),
      "utf8",
    )),
  );
  const journalProfileValue = readRuntimeProfileValue({
    inlineJson:
      input.environment.EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE,
    filePath:
      input.environment.EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const journalProfile =
    journalProfileValue === null
      ? null
      : parseManuscriptJournalRuntimeProfile(
        journalProfileValue,
      );
  const batchingProfileValue = readRuntimeProfileValue({
    inlineJson:
      input.environment.EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE,
    filePath:
      input.environment.EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const batchingPolicy =
    batchingProfileValue === null
      ? null
      : parseManuscriptBatchingPolicy(
        batchingProfileValue,
      );
  const crashGateProfileValue = readRuntimeProfileValue({
    inlineJson:
      input.environment.EUM_STUDIO_POC_2_CRASH_GATE_PROFILE,
    filePath:
      input.environment.EUM_STUDIO_POC_2_CRASH_GATE_PROFILE_PATH,
    readTextFile: (filePath) =>
      readFileSync(filePath, "utf8"),
  });
  const crashGate =
    crashGateProfileValue === null
      ? null
      : createPoc2CrashGate({
        profile: parsePoc2CrashGateProfile(
          crashGateProfileValue,
        ),
        enterPending: () =>
          new Promise<void>(() => undefined),
      });
  const recoveryApplyProfileValue =
    readRuntimeProfileValue({
      inlineJson:
        input.environment
          .EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE,
      filePath:
        input.environment
          .EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE_PATH,
      readTextFile: (filePath) =>
        readFileSync(filePath, "utf8"),
    });
  const recoveryApplyProfile =
    recoveryApplyProfileValue === null
      ? null
      : parsePocRecoveryApplyRuntimeProfile(
        recoveryApplyProfileValue,
      );
  const resumeCheckpointProfileValue =
    readRuntimeProfileValue({
      inlineJson:
        input.environment
          .EUM_STUDIO_POC_RESUME_CHECKPOINT_PROFILE,
      filePath:
        input.environment
          .EUM_STUDIO_POC_RESUME_CHECKPOINT_PROFILE_PATH,
      readTextFile: (filePath) =>
        readFileSync(filePath, "utf8"),
    });
  const resumeCheckpointProfile =
    resumeCheckpointProfileValue === null
      ? null
      : parsePocResumeCheckpointRuntimeProfile(
        resumeCheckpointProfileValue,
      );
  const useEphemeralTestWorkspace =
    input.environment.EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE === "1";
  const hasConfiguredManuscriptRuntime =
    documentProfileValue !== null ||
    journalProfileValue !== null ||
    batchingProfileValue !== null ||
    recoveryApplyProfileValue !== null ||
    resumeCheckpointProfileValue !== null ||
    crashGateProfileValue !== null;
  const configuredLocalWorkspaceRoot =
    input.environment.EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH;
  if (
    configuredLocalWorkspaceRoot !== undefined &&
    !path.isAbsolute(configuredLocalWorkspaceRoot)
  ) {
    throw new Error(
      "EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH must be absolute",
    );
  }
  const localWorkspaceBackupProfile = parseLocalWorkspaceBackupProfile(
    JSON.parse(
      readFileSync(
        input.environment.EUM_STUDIO_LOCAL_WORKSPACE_BACKUP_PROFILE_PATH ??
        path.join(
          input.getAppPath(),
          "config",
          "local-workspace-backup.json",
        ),
        "utf8",
      ),
    ),
  );
  return { ephemeralDocumentProfile, documentProfile, manuscriptInputProfile, formattingProfile, appSettingsProfile, musicSettingsProfile, assistantDestinationProfile, assistantConnectorProfile, chatGptOAuthProfile, youtubeMusicProfile, publishingMailConnectorProfile, preflightProfile, fragmentProfile, foreshadowPointProfile, journalProfile, batchingPolicy, crashGate, recoveryApplyProfile, resumeCheckpointProfile, useEphemeralTestWorkspace, hasConfiguredManuscriptRuntime, configuredLocalWorkspaceRoot, localWorkspaceBackupProfile };
}

export type ApplicationProfiles = ReturnType<typeof loadApplicationProfiles>;
