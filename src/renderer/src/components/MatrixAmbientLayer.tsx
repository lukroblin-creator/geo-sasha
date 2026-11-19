import { useSkin } from '../data/skin'

const codeLines = [
  ['01011001', 'MAP::WGS84', 'lat = 48.8566', 'lon = 2.3522', 'render(globe)', 'scale: 1:110m'],
  [
    '0x4D4150',
    'const atlas = world()',
    'projection: sphere',
    'tile.cache += 1',
    'border = true',
    'sync.position()'
  ],
  [
    '1010 0101',
    'vector.layer[10m]',
    'query.features()',
    'lngLat → [x, y]',
    'zoom.level = 4.2',
    'draw(country)'
  ],
  [
    '> SYSTEM READY',
    'coords.stream()',
    'geo.index: 195',
    'flags.load(CN)',
    'mesh.update()',
    'frame: 60fps'
  ],
  ['0110 1101', 'if (visible) {', '  map.refresh()', '}', 'dataset: offline', 'signal: stable'],
  [
    '0x57 0x41',
    'country.bounds()',
    'north / south',
    'east / west',
    'overlay.active',
    'viewport.sync()'
  ]
]

export function MatrixAmbientLayer(): React.JSX.Element | null {
  const { skin } = useSkin()
  if (skin !== 'matrix') return null

  return (
    <div className="matrix-ambient-layer" aria-hidden="true">
      {codeLines.map((lines, index) => (
        <div className="matrix-code-stream" key={index}>
          {[0, 1, 2].map((copy) => (
            <pre className="matrix-code-block" key={copy}>
              {Array.from({ length: 18 }, (_, line) => lines[line % lines.length]).join('\n')}
            </pre>
          ))}
        </div>
      ))}
    </div>
  )
}
