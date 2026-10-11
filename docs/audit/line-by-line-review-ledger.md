# Coverage and review ledger

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

Baseline files: 95. Full-read files: 78. Explicitly excluded/limited files: 17. Pending/blocking files:0. Full-read text lines:37,146. All full-read files have range1–EOF recorded. “REVIEWED” means source inspected; none is upgraded wholesale to VERIFIED merely because a subset of tests passed.

Every-line coverage of the declared full-read set is100%; that is **not100% repository behavior, assets or dependency coverage**. The95-file baseline includes binary/generated files, environment-value exclusions and generated SVG geometry. Model caches, private user data, dependencies, .git, build products and installed skills are outside first-party source scope. All95 files have an explicit disposition. SVG structure was inspected; individual generated path coordinates were not reviewed. Environment comments/names were reviewed with values withheld, so environment files retain the explicit exclusion status. package-lock.json was dependency-scanned rather than line-reviewed.

The original source review proceeded in sequential chunks, including all12,274 CSS lines and both test files; truncated reads were filled with narrower ranges. Final ledger normalizes contiguous coverage to1–EOF. This ledger records the outcome rather than pretending every range was one tool call. Hashes identify the exact pre-existing dirty content, including untracked CommandPalette and OnboardingTour.

| File | Lines | Reviewed ranges | Status | Baseline SHA-256 | Justification |
|---|---:|---|---|---|---|
|`.claude/launch.json`|27|1–27|REVIEWED|`3aa38da346ce96a67d5589b38640504e5f06005df2f655b8a94f7b566622e522`|Complete source read in sequential chunks; runtime verification tracked separately|
|`.dockerignore`|9|1–9|REVIEWED|`fbfaa0031d9d2cb55cbbf1ee70f41b4a5ab3acf3f8879b78898d9b339b924df4`|Complete source review; runtime coverage reported separately|
|`.env.example`|80|—|EXCLUDED WITH JUSTIFICATION|`4c995f71dd712a1aec84fe34ba1989cecfd293bbe16d1acf5b4250b8225bbcc7`|Environment values withheld; variable names and consumers only|
|`.env.production`|1|—|EXCLUDED WITH JUSTIFICATION|`02d1e39632038ff3cda12a7091a224c2f236ddb051bc7af64f84a12373d16531`|Environment values withheld; variable names and consumers only|
|`.github/workflows/supabase-keepalive.yml`|43|1–43|REVIEWED|`bfef26daa41d7a6a1d6a3af32ae08301394f0aca3964c9d811bc498c167d2e24`|Complete source review; runtime coverage reported separately|
|`.gitignore`|33|1–33|REVIEWED|`d2b1a6477b11771f1ffecd3e7a95d082f57defea16d12b1045708e9d153b7ab1`|Complete source review; runtime coverage reported separately|
|`CHANGELOG.md`|415|1–415|REVIEWED|`4c96a80b941ff5aae7c47e29ee7fb41e323dbfb332b83a9c44cd4cc1d46d634f`|Complete source read in sequential chunks; runtime verification tracked separately|
|`DESIGN.md`|323|1–323|REVIEWED|`b05b93d27e7509d513e0a235c75256f9e655fe514b209bb697c18cdee277cdc8`|Complete source read in sequential chunks; runtime verification tracked separately|
|`Dockerfile`|45|1–45|REVIEWED|`b6ca6830bd2310d6df28893e7da0152f32bfb3b2b80d024572cb0c16a7c08832`|Complete source review; runtime coverage reported separately|
|`README.md`|128|1–128|REVIEWED|`a65766898c077969e04f203b8ce7d436fc46594ba6f4d84bf18143fab63a17d7`|Complete source review; runtime coverage reported separately|
|`app.py`|129|1–129|REVIEWED|`9d0a7e7f81c1c93b8c2a1de49d5a4adf7afd8e397ee0ee8c14793f90683b3cca`|Complete source review; runtime coverage reported separately|
|`docs/RESEARCH.md`|146|1–146|REVIEWED|`98a380d541e1babee422237aa188e7444eacae6f1ae17e20bd5642a860baf7fa`|Complete source read in sequential chunks; runtime verification tracked separately|
|`index.html`|49|1–49|REVIEWED|`d4b6f18dbc79fcc4839a6c1f1781345fde7c2e0d94f4020e375acb09b1872d86`|Complete source read in sequential chunks; runtime verification tracked separately|
|`package-lock.json`|5554|—|EXCLUDED WITH JUSTIFICATION|`8cfd8e118ea3d3deaf0522262609ffb13a4e2540d1e169bb8a6ec3757d64dcf0`|Dependency lock: version-aware review|
|`package.json`|46|1–46|REVIEWED|`3bd803d8deb78147d0a66886b7cffe2058f43a83aa8ea388958d2ffff75f5bcf`|Complete source review; runtime coverage reported separately|
|`packages.txt`|3|1–3|REVIEWED|`925d23ad6a200b5716e3193a7f5041ae6d2ffda75757821e3cdbe94bb173c440`|Complete source review; runtime coverage reported separately|
|`public/apple-touch-icon.png`|90|—|EXCLUDED WITH JUSTIFICATION|`e595084759e3347a6ea48d287816f058e5f9509c9b74a4883e49f7ae002475eb`|Binary asset; inspect references and rendered use|
|`public/bol.studio-white.svg`|26|—|EXCLUDED WITH JUSTIFICATION|`693d6c89741de0c7232804f43f7544e974325e5a227caa51c408388fbd087571`|Generated vector path geometry; SVG structure inspected, not every path coordinate. Static brand assets.|
|`public/bol.studio.png`|44|—|EXCLUDED WITH JUSTIFICATION|`1c074b3557a4fb0fc830ab1ddbfb3743a375b426cb889af73986a3b369fdb046`|Binary asset; inspect references and rendered use|
|`public/bol.studio.svg`|26|—|EXCLUDED WITH JUSTIFICATION|`feb06f0852f8ba919ffb987f16915ed2db93c09c212fc2c602229db3a66a252c`|Generated vector path geometry; SVG structure inspected, not every path coordinate. Static brand assets.|
|`public/bol.svg`|25|—|EXCLUDED WITH JUSTIFICATION|`7db5cae550c13b6ee2652607abb9201f75f1509bcfddc69f9c4da70856b66a31`|Generated vector path geometry; SVG structure inspected, not every path coordinate. Static brand assets.|
|`public/favicon-16x16.png`|10|—|EXCLUDED WITH JUSTIFICATION|`7d665c05b2c5b83cc0145dda44ac677639c26792b4c4a8659f0e48f9d0bb2502`|Binary asset; inspect references and rendered use|
|`public/favicon-32x32.png`|12|—|EXCLUDED WITH JUSTIFICATION|`2c60beaffae610b1bcd429955e24a637e50b8f9709d26b530fbecaeb34a160fa`|Binary asset; inspect references and rendered use|
|`public/favicon-48x48.png`|30|—|EXCLUDED WITH JUSTIFICATION|`ed600bbceec176356b173a1964a7dea4db1d81b251ed6895d336712c77ac69a0`|Binary asset; inspect references and rendered use|
|`public/favicon.ico`|52|—|EXCLUDED WITH JUSTIFICATION|`a7068d365100e39cc8978b84b63af67cb343b6ba396678577bef4085eba52333`|Binary asset; inspect references and rendered use|
|`public/favicon.png`|12|—|EXCLUDED WITH JUSTIFICATION|`2c60beaffae610b1bcd429955e24a637e50b8f9709d26b530fbecaeb34a160fa`|Binary asset; inspect references and rendered use|
|`public/favicon.svg`|19|—|EXCLUDED WITH JUSTIFICATION|`a9b017e3730a72e3b2606a1d1fd0c8206cc0e1e9edaf249b27c16b9a567c5f47`|Generated vector path geometry; SVG structure inspected, not every path coordinate. Static brand assets.|
|`public/icon-192.png`|65|—|EXCLUDED WITH JUSTIFICATION|`3144514135b45373442920522fcd899d526367708274f690bee4f2a70bfbfcfb`|Binary asset; inspect references and rendered use|
|`public/icon-512.png`|183|—|EXCLUDED WITH JUSTIFICATION|`907bf7f6265ff31b243cba192963599712cb042dd37cd8ea890386d7b2e17481`|Binary asset; inspect references and rendered use|
|`public/safari-pinned-tab.svg`|10|—|EXCLUDED WITH JUSTIFICATION|`4a4f62680df41a51c663a0987082894736a147d4a162fa9f1be7c234bd5f42cf`|Generated vector path geometry; SVG structure inspected, not every path coordinate. Static brand assets.|
|`public/site.webmanifest`|19|1–19|REVIEWED|`ba1e28acd9856811e4ca9f715fba76b763961492f49bde9f4521b021693ac904`|Complete source read in sequential chunks; runtime verification tracked separately|
|`requirements.txt`|21|1–21|REVIEWED|`e3d3fde907e23f2261f64e607fc632f155805927e807f6c4df921bd4a81138ee`|Complete source review; runtime coverage reported separately|
|`scripts/backfill-owner.py`|73|1–73|REVIEWED|`2acdecf5822b46942d5a5fe0e2202fbe7df3c613ba16d0f29ba23895a3aa674c`|Complete source read in sequential chunks; runtime verification tracked separately|
|`scripts/compare-models.py`|451|1–451|REVIEWED|`63939f74631d9eb20317f893d024813e5f9c1b1dcdc5d850b2e0005b5cc224c9`|Complete source read in sequential chunks; runtime verification tracked separately|
|`scripts/dev.mjs`|47|1–47|REVIEWED|`c61cc1376a55cb525d89ca7d905abca4dea9a9dabdffe38e6eb3c31c2b0b77eb`|Complete source review; runtime coverage reported separately|
|`scripts/make-test-media.py`|76|1–76|REVIEWED|`a7da56261d8402e690df7e9a53f74af92755984353a036352f45b8583d008903`|Complete source read in sequential chunks; runtime verification tracked separately|
|`scripts/prepare-hinglish-model.py`|50|1–50|REVIEWED|`c2b8074c5feed48efb557b7fef6c40dac3683d037cd86ed5ed8d8a0c392c6043`|Complete source review; runtime coverage reported separately|
|`scripts/prepare-model.py`|44|1–44|REVIEWED|`1dde35ec22983586654b52db36be377fd24d4f50a2e14485799b513729a7ec02`|Complete source review; runtime coverage reported separately|
|`scripts/smoke-test.py`|187|1–187|REVIEWED|`aec56632bcf241013fae89073bcbcbd4e676409d939f9458f8372ef35c645a0a`|Complete source read in sequential chunks; runtime verification tracked separately|
|`server/app.py`|1568|1–1568|REVIEWED|`2bb96f87a1e5070455ad224a15e25fd2ed9f60dacc8648869d53e5ef2f632586`|Complete source review; runtime coverage reported separately|
|`server/auth.py`|252|1–252|REVIEWED|`bbf8e4045d44c2de798b0e461e764040cd6d19fce22bcb2f2a7a64d2610dc65c`|Complete source review; runtime coverage reported separately|
|`server/denoise.py`|161|1–161|REVIEWED|`b1499a756e1461b6a336c4e0948889f04c8192390bacecd85ba147e2a9c4c855`|Complete source review; runtime coverage reported separately|
|`server/emoji.py`|268|1–268|REVIEWED|`59b8c0f5b4c08b257b3ecbb512b648e98cb15459cadfda39f006e3bb690fca02`|Complete source review; runtime coverage reported separately|
|`server/glossary.py`|150|1–150|REVIEWED|`1688b0a5c081b990af1ac3358c64dd669722136deccc1e0724c04dfa25052c96`|Complete source review; runtime coverage reported separately|
|`server/remotion-captions.ts`|141|1–141|REVIEWED|`986b523c8742d38d9cad69a289dc496271a84935513d8a2e7fd506c25fd76231`|Complete source review; runtime coverage reported separately|
|`server/render.ts`|292|1–292|REVIEWED|`c7be4454289a8091774465d08394ce6d8cd0debdbb02cf25be4577cbce593b0f`|Complete source review; runtime coverage reported separately|
|`server/requirements-cpu.txt`|2|1–2|REVIEWED|`b9a2bf9419643a955a0c5a4b4002ecfc54f9762f4e7d2acc60c0ef15395eef41`|Complete source review; runtime coverage reported separately|
|`server/requirements.txt`|33|1–33|REVIEWED|`840675107b7f45a0f67978cde360cd01fd468f6ba9661ed03dda8420ad539d54`|Complete source review; runtime coverage reported separately|
|`server/transcription.py`|812|1–812|REVIEWED|`0fcaf8f87c26d7ec72113ca88c423c194247c0a457a416d14462873f1cd2bfe5`|Complete source review; runtime coverage reported separately|
|`skills-lock.json`|83|1–83|REVIEWED|`592af9de31bdb3840854c87214fcac2568e4d16b0f96b4b89df7d7eb3875dfb5`|Complete source read in sequential chunks; runtime verification tracked separately|
|`src/components/AuthScreen.tsx`|527|1–527|REVIEWED|`c52b18c239766e5ab43ddeaf68746edaa8d3518655ded2f98c8767172754a564`|Complete source review; runtime coverage reported separately|
|`src/components/CaptionsPanel.tsx`|2218|1–2218|REVIEWED|`d09249c966f19de9b95273ea8649204f35289f83d452049d0754f41660811d70`|Complete sequential source review; runtime coverage separate|
|`src/components/CommandPalette.tsx`|458|1–458|REVIEWED|`f4c05aaeb379995a6f14a4ca7667b757ea6fb5e05714dbcd0d7226742843d128`|Complete source review; runtime coverage reported separately|
|`src/components/LiveAnnouncer.tsx`|68|1–68|REVIEWED|`566815b45d8bcbff713d20a258056acf9a6e6cebd3820b3a120455d0e9a552c1`|Complete source review; runtime coverage reported separately|
|`src/components/MediaPanel.tsx`|1549|1–1549|REVIEWED|`67aabfd9a4d5a46da848c501effcb6887124f082d5bf3291c556469a6f03f191`|Complete sequential source review; runtime coverage separate|
|`src/components/Modal.tsx`|23|1–23|REVIEWED|`30ecc99f17e09ef028522f6f3328b2d70580cff9393279fe957df17200f478b6`|Complete source review; runtime coverage reported separately|
|`src/components/OnboardingTour.tsx`|147|1–147|REVIEWED|`0fd2fa8452bdff14264f245167c8a6f48c554e49a20dc7482247c2297a663254`|Complete source review; runtime coverage reported separately|
|`src/components/SettingsPanel.tsx`|439|1–439|REVIEWED|`4550b29a31dc710ed20f8725a511b35932c6b065c06b7501ba5e77c6e65135eb`|Complete source review; runtime coverage reported separately|
|`src/components/ShortcutModal.tsx`|89|1–89|REVIEWED|`b3b89d716d957862d5f20c9bff8f94c5d827c66df7060528d6fe8090031b1307`|Complete source review; runtime coverage reported separately|
|`src/components/StudioModals.tsx`|287|1–287|REVIEWED|`915ae5b3a7df042a43c7acee65b0377cec8b4464fe5325a5f72a3fd8f3e6034e`|Complete source review; runtime coverage reported separately|
|`src/components/StudioNavbar.tsx`|166|1–166|REVIEWED|`c356241b51fd7ca8ee312f829d711a549ec2824b24fe17d4902ddd87606167f4`|Complete source review; runtime coverage reported separately|
|`src/components/StylePanel.tsx`|153|1–153|REVIEWED|`3e4f10cc5acd4778dd84c004596ddca9729881c5769b8c7910e5904057d76dea`|Complete source review; runtime coverage reported separately|
|`src/components/TemplateCard.tsx`|121|1–121|REVIEWED|`1814cddd08c51207ad96bc8c09288978ed07309a9f32e0f47b5eeb05caf3ccd4`|Complete source review; runtime coverage reported separately|
|`src/components/TextPanel.tsx`|631|1–631|REVIEWED|`df3cd3d38d1e99499ec8a0328fff7e3b094dd01fadbeaf8fced606c88de78f04`|Complete sequential source review; runtime coverage separate|
|`src/components/TimelineRuler.tsx`|33|1–33|REVIEWED|`cde70da284f7d2d65305c9ce9af40637b915d6c930f8fd5878caa640c8b3abb6`|Complete source review; runtime coverage reported separately|
|`src/components/WordInspector.tsx`|159|1–159|REVIEWED|`9cdffd597efe49c4b8b8d39dcbd14384137fef071c5ac22c033ca81b945b8648`|Complete source review; runtime coverage reported separately|
|`src/fonts/local-faces.ts`|59|1–59|REVIEWED|`08cf9e09a9411c80331d25b4ee8eef68f4cb1674e0a20bdc3406dcebbaa07f39`|Complete source review; runtime coverage reported separately|
|`src/lib/api.ts`|328|1–328|REVIEWED|`9ff2b0e4e3bd58b8a15cea9f384c68f89894e97c95de284f20bdfe53e4af8f13`|Complete source review; runtime coverage reported separately|
|`src/lib/auth.ts`|96|1–96|REVIEWED|`8175779032e845fc801239426d4d3216f5c234414cc840c6d67f9eaec5e476a5`|Complete source review; runtime coverage reported separately|
|`src/lib/caption-defaults.json`|10|1–10|REVIEWED|`51ecdafd4c704a357e849e73fb5199345c947b5375bd4e5b48648ea94e97b883`|Complete source review; runtime coverage reported separately|
|`src/lib/caption-fonts.json`|13|1–13|REVIEWED|`dd34baca11cf3bd0324fb9a921be6c369528bae412bde8757043269a09ccbb3d`|Complete source review; runtime coverage reported separately|
|`src/lib/caption-fonts.ts`|66|1–66|REVIEWED|`c627488fbc5ab2f7d2e3840975e97bea554bb805897b503bdc81b0c1d0d25d57`|Complete source review; runtime coverage reported separately|
|`src/lib/caption-templates.json`|170|1–170|REVIEWED|`b2777f03cc87ad3d5a15240dad5d6c2d254cf256aaa718c3ea7a0fec8bc9eed2`|Complete source read in sequential chunks; runtime verification tracked separately|
|`src/lib/captions.ts`|601|1–601|REVIEWED|`65b8e7b537838cb28887a4694090ea96f99c262c21cb73e4408bd4feacb6e623`|Complete source review; runtime coverage reported separately|
|`src/lib/chromakey.ts`|169|1–169|REVIEWED|`67d97b926b3472267e5604cb281eb406968aea847bbc494f4060fba0600a77df`|Complete source review; runtime coverage reported separately|
|`src/lib/pages.ts`|433|1–433|REVIEWED|`5c5bed8b5b0b5064b6539f66abc7427e61d556f1bb35744318c901b8d122f4da`|Complete source review; runtime coverage reported separately|
|`src/lib/safe-area.ts`|77|1–77|REVIEWED|`375a050b12fea3709bd55f2fb4e993c8b010c5d7b1c5d5e208080e5ccd5176ec`|Complete source review; runtime coverage reported separately|
|`src/lib/shell.ts`|28|1–28|REVIEWED|`030f09b9cec930daf57fb1a157dc63223058349747c9833b50f2a31e8d34b196`|Complete source review; runtime coverage reported separately|
|`src/lib/types.ts`|200|1–200|REVIEWED|`c830bb058ec1bf0eec935e110e70e4b4f62413dd2a454a5064c754faef9065fa`|Complete source review; runtime coverage reported separately|
|`src/lib/utils.ts`|118|1–118|REVIEWED|`97a6bd26df6c3cc831a1f97b428ab04380d40245359a12371cf4e559c3c121a5`|Complete source review; runtime coverage reported separately|
|`src/main.tsx`|4436|1–4436|REVIEWED|`57617714795639954579ec52451b27d09bc8d18b83a85236b9e45f3a113d7495`|Complete source review; runtime coverage reported separately|
|`src/registry/magicui/animated-theme-toggler.tsx`|357|1–357|REVIEWED|`8c080997868b5d1ca018688f36930e9af674a01260109bcf143fab34db44e40f`|Complete source review; runtime coverage reported separately|
|`src/remotion/CaptionPage.tsx`|354|1–354|REVIEWED|`9ca567251a7d787c2f8cec78219ba5c206b4358d5dd07578d49b9b61f37be9e5`|Complete source review; runtime coverage reported separately|
|`src/remotion/CaptionTrack.tsx`|88|1–88|REVIEWED|`11633d746c36780eb7aaa3fcd94ae158e00b57a3666d6cd80f2787915cabb8cd`|Complete source review; runtime coverage reported separately|
|`src/remotion/CaptionWord.tsx`|338|1–338|REVIEWED|`8941cd7b5c72c4fcc41b64d1d57bfe984c02a16e0e47c24175b32e2ad9fbf2ed`|Complete source review; runtime coverage reported separately|
|`src/remotion/Root.tsx`|55|1–55|REVIEWED|`a5fe4adb53c52c0cb8a304cccc5d9654832e9264ae08713dfa1e672a100b734a`|Complete source review; runtime coverage reported separately|
|`src/remotion/index.ts`|4|1–4|REVIEWED|`8ad7cfb50e32546485a1a2ef5e468e5b6bdee2bc5c9b92d08882f96e3750b4a3`|Complete source review; runtime coverage reported separately|
|`src/remotion/theme.ts`|80|1–80|REVIEWED|`13ac06dcd8ec1c1276e799bd645d815924c534544d805a8f3da2296783d89fc1`|Complete source review; runtime coverage reported separately|
|`src/remotion/treatments.ts`|181|1–181|REVIEWED|`4de739db3d294cf49876c56cced05843aaa04d04a1d35bb964727779331d97b6`|Complete source review; runtime coverage reported separately|
|`src/styles.css`|12274|1–12274|REVIEWED|`db01932db2b3b10a6754e7d1e02fe90d6f552f2bbe7eb425332dd22b00c3aebb`|Complete source read in sequential chunks; runtime verification tracked separately|
|`tests/captions.test.ts`|1708|1–1708|REVIEWED|`f889e0bc3f48c795e45708929880eb41beb78478a9b73eb7addf1abc3d16dff5`|Complete source read in sequential chunks; runtime verification tracked separately|
|`tests/test_backend.py`|1615|1–1615|REVIEWED|`d8f565a5a766b97ec7a89ad3de9236b3b7282a8f58041f5997fe0a88ed34c095`|Complete source read in sequential chunks; runtime verification tracked separately|
|`tsconfig.json`|14|1–14|REVIEWED|`482071d971fc62ecf2ead84d4b73a2a84e6a61d6e27ec17f1fb9d5065251b7c9`|Complete source review; runtime coverage reported separately|
|`vercel.json`|16|1–16|REVIEWED|`e7c0c4d1f68999a73f90a9e8a6aa8b0e37e88e4d6c47ff8f8068d2659491cb7e`|Complete source review; runtime coverage reported separately|
|`vite.config.ts`|64|1–64|REVIEWED|`e51d15cb3484e7a49e0a843ad5fa412b763fb557fe070cd295b7b076cae935d0`|Complete source review; runtime coverage reported separately|
