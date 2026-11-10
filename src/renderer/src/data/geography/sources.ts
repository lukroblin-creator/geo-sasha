import type { GeographicDataSource } from './types'

// Registre central des sources de données géographiques.
export const geographicDataSources: GeographicDataSource[] = [
  {
    id: 'natural-earth-110m',
    name: 'Natural Earth 1:110m',
    provider: 'Natural Earth',
    license: 'Public domain',
    scale: '1:110,000,000'
  },
  {
    id: 'natural-earth-50m',
    name: 'Natural Earth 1:50m',
    provider: 'Natural Earth',
    license: 'Public domain',
    scale: '1:50,000,000'
  },
  {
    id: 'natural-earth-10m',
    name: 'Natural Earth 1:10m',
    provider: 'Natural Earth',
    license: 'Public domain',
    scale: '1:10,000,000'
  },
  {
    id: 'geonames-islands',
    name: 'GeoNames island gazetteer',
    provider: 'GeoNames',
    license: 'Creative Commons Attribution 4.0 (CC BY 4.0)',
    resolution: 'Curated island name and point subset for French overseas territories'
  }
]
