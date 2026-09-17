import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { StudioRoot } from "./StudioRoot";
import "./styles/shell-foundation.css";
import "./styles/library.css";
import "./styles/shared-controls.css";
import "./styles/library-cards.css";
import "./styles/workspace-editor-shell.css";
import "./styles/document-controls.css";
import "./styles/workspace-layout.css";
import "./styles/document-rail-compat.css";
import "./styles/workspace-ia-compat.css";
import "./styles/manuscript-annotations.css";
import "./styles/canon-workspace.css";
import "./styles/dialogs.css";
import "./styles/schedule.css";
import "./styles/activity-records.css";
import "./styles/manuscript-review.css";
import "./styles/manager-surfaces-compat.css";
import "./styles/publishing-revision-music-plot-compat.css";
import "./styles/quick-tools.css";
import "./styles/late-dialog-surfaces-compat.css";
import "./styles/responsive-manuscript-compat.css";
import "./styles/characters-inspiration.css";
import "./styles/plot-manager-compat.css";
import "./styles/plot-scene-music.css";
import "./styles/planning-import-dark-compat.css";
import "./styles/theme-compat.css";
import "./styles/music-assistant-surfaces.css";
import "./shell/studio-app-shell.css";
import "./styles/tool-discovery.css";
import "./styles/workspace-surfaces.css";
import "./styles/feature-dialogs.css";
import "./early-access-surface.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Renderer root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <StudioRoot />
  </StrictMode>,
);
