export type AdditionalMapFlagRegion = {
  sourceFeatureId: number
  alpha2: string
}

// Natural Earth includes these territories and special areas outside the
// 195-country quiz catalog. IDs use Natural Earth's numeric country codes.
export const additionalMapFlagRegions: AdditionalMapFlagRegion[] = [
  { sourceFeatureId: 732, alpha2: 'EH' }, // Western Sahara
  { sourceFeatureId: 663, alpha2: 'MF' }, // Saint Martin
  { sourceFeatureId: 534, alpha2: 'SX' }, // Sint Maarten
  { sourceFeatureId: 292, alpha2: 'GI' }, // Gibraltar
  { sourceFeatureId: 344, alpha2: 'HK' }, // Hong Kong
  { sourceFeatureId: 304, alpha2: 'GL' }, // Greenland
  { sourceFeatureId: 540, alpha2: 'NC' }, // New Caledonia
  { sourceFeatureId: 531, alpha2: 'CW' }, // Curaçao
  { sourceFeatureId: 533, alpha2: 'AW' }, // Aruba
  { sourceFeatureId: 796, alpha2: 'TC' }, // Turks and Caicos Islands
  { sourceFeatureId: 158, alpha2: 'TW' }, // Taiwan
  { sourceFeatureId: 666, alpha2: 'PM' }, // Saint Pierre and Miquelon
  { sourceFeatureId: 612, alpha2: 'PN' }, // Pitcairn Islands
  { sourceFeatureId: 258, alpha2: 'PF' }, // French Polynesia
  { sourceFeatureId: 260, alpha2: 'TF' }, // French Southern Territories
  { sourceFeatureId: 581, alpha2: 'UM' }, // U.S. Minor Outlying Islands
  { sourceFeatureId: 500, alpha2: 'MS' }, // Montserrat
  { sourceFeatureId: 850, alpha2: 'VI' }, // U.S. Virgin Islands
  { sourceFeatureId: 652, alpha2: 'BL' }, // Saint Barthélemy
  { sourceFeatureId: 630, alpha2: 'PR' }, // Puerto Rico
  { sourceFeatureId: 660, alpha2: 'AI' }, // Anguilla
  { sourceFeatureId: 92, alpha2: 'VG' }, // British Virgin Islands
  { sourceFeatureId: 136, alpha2: 'KY' }, // Cayman Islands
  { sourceFeatureId: 60, alpha2: 'BM' }, // Bermuda
  { sourceFeatureId: 334, alpha2: 'HM' }, // Heard Island and McDonald Islands
  { sourceFeatureId: 654, alpha2: 'SH' }, // Saint Helena
  { sourceFeatureId: 832, alpha2: 'JE' }, // Jersey
  { sourceFeatureId: 831, alpha2: 'GG' }, // Guernsey
  { sourceFeatureId: 833, alpha2: 'IM' }, // Isle of Man
  { sourceFeatureId: 248, alpha2: 'AX' }, // Åland Islands
  { sourceFeatureId: 234, alpha2: 'FO' }, // Faroe Islands
  { sourceFeatureId: 86, alpha2: 'IO' }, // British Indian Ocean Territory
  { sourceFeatureId: 574, alpha2: 'NF' }, // Norfolk Island
  { sourceFeatureId: 184, alpha2: 'CK' }, // Cook Islands
  { sourceFeatureId: 876, alpha2: 'WF' }, // Wallis and Futuna
  { sourceFeatureId: 239, alpha2: 'GS' }, // South Georgia and the South Sandwich Islands
  { sourceFeatureId: 238, alpha2: 'FK' }, // Falkland Islands
  { sourceFeatureId: 570, alpha2: 'NU' }, // Niue
  { sourceFeatureId: 16, alpha2: 'AS' }, // American Samoa
  { sourceFeatureId: 316, alpha2: 'GU' }, // Guam
  { sourceFeatureId: 580, alpha2: 'MP' }, // Northern Mariana Islands
  { sourceFeatureId: 446, alpha2: 'MO' } // Macao
]
