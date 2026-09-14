# Recovery separation receipt

The original `recovery/` inventory contained 17 files (4 scripts and 13 data files), totaling 1,105,362,438 bytes. Before separation, all 17 files were copied without overwrite into `D:\Eum-Studio-Recovery-Archive\review-f8215a5-20260904T231057Z-8ff9ef1b`. Each source hash before/after the copy and the copied hash matched. The sealed `archive-manifest.json` SHA-256 is `0BC59096EBD6B4DFC6066C6E376353F0CD74CDE7D860F97A6EF40F0BE6C74F1D`.

Fresh readback confirmed all 17 primary archived copies still match the sealed manifest. Each copy grants access only to the current user SID and SYSTEM. The detailed local receipt is `artifacts/review-f8215a5/recovery-archive-receipt.json`.

An attempted recursive source deletion was rejected before execution by automatic approval review with a generic policy-blocked reason. A subsequent preservation-only move succeeded for two files and was refused by Windows on the dump because the user's original ACL grants read access. No source ownership/permission escalation was performed. `git rm --cached` then removed exactly the 13 data paths from the index. The new `recovery/.gitignore` covers all 13; scripts and README remain source. This is source-control separation; it is not a claim that every local original was physically removed. Git history was not rewritten.

The text file was moved back with its original hash verified. The moved readable `.bin` was found with a different hash during move-back preflight, so it was not substituted for the original or deleted. It remains separately preserved under `preserved-originals`, with restricted current-user/SYSTEM ACL. Its original primary archive copy and the corresponding local `.dmp` both retain the original hash. The cause of the variant's checksum difference was not established; no content overwrite was attempted to hide it. The receipt records both hashes:

- Original/primary archive: `A357A907A443F0F5A7D97E273BBD4327469B0A776141B0A1BD2862900072B167`.
- Separately retained variant: `084D3F93A1F595F007AEC0D9B98A38AD58F81BE3DC628941385D3BB7E70BE46E`.

At final inventory for this step, 12 ignored local data originals match the manifest, all 17 primary archived copies match, and the one moved variant is preserved separately. Staged changes are limited to the 13 source-control deletions. No commit, push, history rewrite or original permanent deletion occurred.
