# The Law Student's Lexicon — Build 43

[Open Build 43](https://illteachyoutoo00-collab.github.io/Law-Student-s-Lexicon-43/)

Version 1.4.25+43 preserves all 652 entries and the existing English/Mongolian search, speech, translation, saved-entry and Spider-Web features. The prominent bilingual Report a Problem button opens the anonymous Student Error Reporting Box. The form shows the application version and selected term where applicable. English and Mongolian help explain submission and private author review.

![Website QR — not APK download](Build43-WEBSITE-QR.png)

The QR points only to this new website. The [original website](https://illteachyoutoo00-collab.github.io/Law-Student-s-Lexicon/) and [existing Android download page and QR](https://illteachyoutoo00-collab.github.io/Law-Student-s-Lexicon/download.html) are unchanged. [Existing Build 43 Android APK](https://github.com/illteachyoutoo00-collab/Law-Student-s-Lexicon/releases/download/v1.4.25-build43/LawStudentsLexicon-Build43.apk).

Compiled public files only. No private Flutter source, signing credentials, or GitHub token is included. The reporting API stores credentials server-side. Students need no GitHub account or email address.

Verification on 2026-11-04: 75 Flutter regression tests, static analysis, cache upgrade/isolation test, all 71 asset URL checks, exact entrypoint/dictionary bytes, independently decoded QR, and live production API reports in English and Mongolian. Browser automation was unavailable; a submission through this newly published website and physical iPhone/Android checks remain unverified. API tests are not browser tests.

Future releases must build with `--base-href=/Law-Student-s-Lexicon-43/` and run the existing `tools/build_web_cache.py` packager to fingerprint entrypoints. Cache names are isolated by site path. `.gitattributes` preserves exact compiled bytes and manifest hashes when publishing from Windows.
