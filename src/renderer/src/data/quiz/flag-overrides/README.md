# Local flag overrides

The upstream `svg-country-flags` package represents several French overseas
territories with the French tricolour. World Atlas uses the local or regional
emblems below instead so a territory never silently inherits the visual flag
of metropolitan France when a stable territorial design is available.

- `gf.svg`: commonly used local flag of French Guiana.
- `gp.svg`: commonly used local flag of Guadeloupe.
- `mf.svg`: cultural Unity Flag of Saint Martin island.
- `mq.svg`: flag adopted by the Assembly of Martinique.
- `pm.svg`: commonly used local flag of Saint-Pierre and Miquelon.
- `re.svg`: Lo Mavéli, the widely used regional flag of Réunion.
- `sh.svg`: territorial flag of Saint Helena.
- `yt.svg`: commonly used local flag of Mayotte.

These overrides are intentionally keyed by ISO territory code. The resolver
in `flagAssets.ts` loads them after the package assets, so they replace only
the corresponding territorial images and do not change France's `FR` flag.

The Assembly of Martinique adopted the red-green-black flag on 2 February 2023. The Tribunal administratif's 2024 decision annulled the hymn article
of that decision, not the flag article. The flag's layout is drawn from the
description published by the Société française de vexillologie.

- [Tribunal administratif de la Martinique, decision of 14 May 2024](https://martinique.tribunal-administratif.fr/Media/mediatheque-ta-martinique/documents/2024/2024-documents/extraits-du-jugement-n-2300199-du-14-mai-2024)
- [Société française de vexillologie, Martinique flag description](https://drapeaux-sfv.org/IMG/pdf/sfv_communique_drapeau_martinique.pdf)
- [Wikimedia Commons, local flag of French Guiana](https://commons.wikimedia.org/wiki/File:Flag_of_French_Guiana.svg)
- [Wikimedia Commons, local flag of Guadeloupe](<https://commons.wikimedia.org/wiki/File:Flag_of_Guadeloupe_(Local).svg>)
- [Wikimedia Commons, Unity Flag of Saint Martin island](<https://commons.wikimedia.org/wiki/File:Flag_of_Saint_Martin_island_(Unification_flag).svg>)
- [Wikimedia Commons, Lo Mavéli flag of Réunion](<https://commons.wikimedia.org/wiki/File:Proposed_flag_of_R%C3%A9union_(VAR).svg>)
- [Wikimedia Commons, local flag of Mayotte](<https://commons.wikimedia.org/wiki/File:Flag_of_Mayotte_(Local).svg>)
- [Wikimedia Commons, local flag of Saint-Pierre and Miquelon](https://commons.wikimedia.org/wiki/File:Flag_of_Saint-Pierre_and_Miquelon.svg)
- [Wikimedia Commons, flag of Saint Helena](https://commons.wikimedia.org/wiki/File:Flag_of_Saint_Helena.svg)

`mf.svg` is a simplified adaptation of the Unity Flag vector by DeVos Max,
licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
