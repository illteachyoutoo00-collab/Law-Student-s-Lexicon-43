# The Law Student's Lexicon — Build 43

[Open Build 43](https://illteachyoutoo00-collab.github.io/Law-Student-s-Lexicon-43/)

Version 1.4.25+43 preserves all 652 entries and the existing English/Mongolian search, speech, translation, saved-entry and Spider-Web features. The prominent bilingual Report a Problem button opens the anonymous Student Error Reporting Box. The form shows the application version and selected term where applicable. English and Mongolian help explain submission and private author review.

![Website QR — not APK download](Build43-WEBSITE-QR.png)

The QR points only to this new website. The [original website](https://illteachyoutoo00-collab.github.io/Law-Student-s-Lexicon/) and [existing Android download page and QR](https://illteachyoutoo00-collab.github.io/Law-Student-s-Lexicon/download.html) are unchanged. [Existing Build 43 Android APK](https://github.com/illteachyoutoo00-collab/Law-Student-s-Lexicon/releases/download/v1.4.25-build43/LawStudentsLexicon-Build43.apk).

Compiled public files only. No private Flutter source, signing credentials, or GitHub token is included. The reporting API stores credentials server-side. Students need no GitHub account or email address.

Latest verification on 2026-11-04: 58 Flutter regression tests, 27 virtual audio lifecycle checks, static analysis, cache upgrade/isolation tests, all 73 current manifest asset URLs, exact entrypoint/dictionary bytes, and an independently decoded website QR. A clearly identified Mongolian report submitted through the actual published website created private Issue #19 and displayed the bilingual success message. Physical iPhone/Android verification of the latest web voice changes remains outstanding.

The voice update applies the existing Android-style model preparation/reuse to the browser: warm up on selecting Mongolian, retain one successful decoder for up to 60 idle seconds, and match the native 0.8-second trailing pause. More sensitive capture, bounded quiet-audio gain, and live microphone-level feedback are included. The Android APK is unchanged. The real browser benchmark removed roughly four seconds of repeated model preparation; it does not establish a 1.5-2 second response time or classroom whisper accuracy.

Future releases must build with `--base-href=/Law-Student-s-Lexicon-43/` and run the existing `tools/build_web_cache.py` packager to fingerprint entrypoints. Cache names are isolated by site path. `.gitattributes` preserves exact compiled bytes and manifest hashes when publishing from Windows.
