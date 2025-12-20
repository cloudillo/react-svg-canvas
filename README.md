# react-svg-canvas

A React library for building interactive SVG canvas applications with pan, zoom, selection, drag-and-drop, resize, and Figma-style snapping.

## Features

- **Pan & Zoom** - Middle mouse/touch panning, mouse wheel/pinch-to-zoom
- **Touch Support** - Full touch event handling for mobile devices
- **Selection System** - Multi-select, rectangle selection, selection bounds
- **Drag & Drop** - Smooth dragging with window-level event handling
- **Resize Handles** - 8-point resize with min/max constraints
- **Snapping** - Figma-style snapping to edges, centers, grid, and matching sizes
- **Geometry Utilities** - Bounds operations, transforms, coordinate conversion
- **Spatial Queries** - Hit testing, rectangle selection, culling
- **TypeScript** - Full type definitions included

## Installation

```bash
npm install react-svg-canvas
# or
pnpm add react-svg-canvas
# or
yarn add react-svg-canvas
```

**Peer Dependencies:** React 18+

## Quick Start

```tsx
import { SvgCanvas, useSvgCanvas } from 'react-svg-canvas'

function MyCanvas() {
  return (
    <SvgCanvas
      className="my-canvas"
      style={{ width: '100%', height: '100%' }}
    >
      <rect x={100} y={100} width={200} height={150} fill="#3b82f6" />
      <circle cx={400} cy={200} r={50} fill="#ef4444" />
    </SvgCanvas>
  )
}
```

## API Reference

### SvgCanvas

The main canvas component that provides pan, zoom, and coordinate transformation.

```tsx
import { SvgCanvas, SvgCanvasHandle } from 'react-svg-canvas'

function App() {
  const canvasRef = useRef<SvgCanvasHandle>(null)

  return (
    <SvgCanvas
      ref={canvasRef}
      className="canvas"
      style={{ width: '100vw', height: '100vh' }}
      fixed={<MyToolbar />}  // Renders in screen space (not transformed)
      onToolStart={(e) => console.log('Tool start:', e.x, e.y)}
      onToolMove={(e) => console.log('Tool move:', e.x, e.y)}
      onToolEnd={() => console.log('Tool end')}
      onContextReady={(ctx) => console.log('Scale:', ctx.scale)}
    >
      {/* Children render in canvas space (transformed) */}
      <MyShapes />
    </SvgCanvas>
  )
}
```

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string` | CSS class for the SVG element |
| `style` | `CSSProperties` | Inline styles for the SVG element |
| `children` | `ReactNode` | Content rendered in canvas space (pan/zoom applied) |
| `fixed` | `ReactNode` | Content rendered in screen space (UI overlays) |
| `onToolStart` | `(e: ToolEvent) => void` | Called on left mouse/touch start |
| `onToolMove` | `(e: ToolEvent) => void` | Called during drag |
| `onToolEnd` | `() => void` | Called on mouse/touch end |
| `onContextReady` | `(ctx: SvgCanvasContext) => void` | Called when context changes (zoom, pan) |

#### Imperative Handle

```tsx
const canvasRef = useRef<SvgCanvasHandle>(null)

// Center viewport on a point
canvasRef.current?.centerOn(100, 100, 1.5)  // x, y, optional zoom

// Fit a rectangle in view
canvasRef.current?.centerOnRect(0, 0, 500, 400, 50)  // x, y, w, h, padding

// Get/set transform matrix
const matrix = canvasRef.current?.getMatrix()
canvasRef.current?.setMatrix([1, 0, 0, 1, 0, 0])
```

#### Interaction Controls

| Input | Action |
|-------|--------|
| Left mouse | Tool events (onToolStart/Move/End) |
| Middle mouse | Pan canvas |
| Mouse wheel | Zoom in/out |
| Single touch | Tool events or pan |
| Two-finger pinch | Zoom |

---

### useSvgCanvas

Hook to access canvas context from child components.

```tsx
function MyShape() {
  const { svg, matrix, scale, translateTo, translateFrom } = useSvgCanvas()

  // Convert screen coords to canvas coords
  const [canvasX, canvasY] = translateTo(screenX, screenY)

  // Convert canvas coords to screen coords
  const [screenX, screenY] = translateFrom(canvasX, canvasY)

  return <rect x={100} y={100} width={100 / scale} height={100 / scale} />
}
```

---

### Selection System

#### useSelection

Manages selection state for canvas objects.

```tsx
import { useSelection, SpatialObject } from 'react-svg-canvas'

interface MyObject extends SpatialObject {
  id: string
  bounds: Bounds
  color: string
}

function Canvas({ objects }: { objects: MyObject[] }) {
  const {
    selectedIds,
    selectedObjects,
    selectionCount,
    selectionBounds,
    hasSelection,
    select,
    selectMultiple,
    deselect,
    toggle,
    clear,
    selectAll,
    selectInRect,
    setSelection,
    isSelected
  } = useSelection({ objects, onChange: (ids) => console.log('Selection:', ids) })

  return (
    <SvgCanvas>
      {objects.map(obj => (
        <rect
          key={obj.id}
          {...obj.bounds}
          fill={isSelected(obj.id) ? 'blue' : obj.color}
          onClick={(e) => select(obj.id, e.shiftKey)}
        />
      ))}
      {selectionBounds && (
        <SelectionBox bounds={selectionBounds} onResizeStart={handleResize} />
      )}
    </SvgCanvas>
  )
}
```

#### SelectionBox

Renders a selection rectangle with resize handles.

```tsx
import { SelectionBox } from 'react-svg-canvas'

<SelectionBox
  bounds={{ x: 100, y: 100, width: 200, height: 150 }}
  rotation={45}
  stroke="#0066ff"
  strokeDasharray="4,4"
  showHandles={true}
  handleSize={8}
  onResizeStart={(handle, e) => console.log('Resize:', handle)}
/>
```

---

### Interaction Hooks

#### useDraggable

Provides smooth drag interaction with window-level events.

```tsx
import { useDraggable, svgTransformCoordinates } from 'react-svg-canvas'

function DraggableRect({ x, y, onMove }) {
  const { isDragging, dragProps } = useDraggable({
    onDragStart: (e) => console.log('Start:', e.x, e.y),
    onDragMove: (e) => onMove(e.deltaX, e.deltaY),
    onDragEnd: (e) => console.log('End'),
    transformCoordinates: svgTransformCoordinates  // For SVG coordinate space
  })

  return (
    <rect
      x={x} y={y}
      width={100} height={80}
      fill={isDragging ? 'orange' : 'blue'}
      style={{ cursor: 'move' }}
      {...dragProps}
    />
  )
}
```

#### useResizable

Provides resize interaction for selected objects.

```tsx
import { useResizable } from 'react-svg-canvas'

function ResizableRect({ bounds, onResize }) {
  const { isResizing, activeHandle, handleResizeStart } = useResizable({
    bounds,
    minWidth: 50,
    minHeight: 50,
    onResize: (e) => onResize(e.bounds),
    onResizeEnd: (e) => console.log('Final bounds:', e.bounds)
  })

  return (
    <SelectionBox
      bounds={bounds}
      onResizeStart={handleResizeStart}
    />
  )
}
```

---

### Snapping System

Figma-style snapping with visual guide lines.

#### useSnapping

```tsx
import { useSnapping, SnapGuides, DEFAULT_SNAP_CONFIG } from 'react-svg-canvas'

function Canvas({ objects }) {
  const { svg, translateFrom } = useSvgCanvas()
  const viewBounds = { x: 0, y: 0, width: 1000, height: 800 }

  const { snapDrag, snapResize, activeSnaps, allCandidates, clearSnaps } = useSnapping({
    objects,
    config: DEFAULT_SNAP_CONFIG,
    viewBounds
  })

  function handleDrag(objectId, bounds, delta, grabPoint) {
    const result = snapDrag({
      bounds: { ...bounds, rotation: 0 },
      objectId,
      delta,
      grabPoint
    })
    // result.position contains snapped coordinates
    // result.activeSnaps contains active snap info
  }

  return (
    <SvgCanvas
      fixed={
        <SnapGuides
          activeSnaps={activeSnaps}
          config={DEFAULT_SNAP_CONFIG.guides}
          viewBounds={viewBounds}
          transformPoint={translateFrom}
        />
      }
    >
      {/* Your objects */}
    </SvgCanvas>
  )
}
```

#### useGrabPoint

Helper hook for calculating the normalized grab point when dragging objects.

```tsx
import { useGrabPoint } from 'react-svg-canvas'

function MyDraggable({ bounds }) {
  const { setGrabPoint, getGrabPoint } = useGrabPoint()

  function handleDragStart(mousePos) {
    setGrabPoint(mousePos, bounds)
  }

  function handleDrag(delta) {
    const grabPoint = getGrabPoint()  // Returns { x: 0-1, y: 0-1 }
    // Use with snapDrag...
  }
}
```

#### Snap Configuration

```tsx
const config: SnapConfiguration = {
  enabled: true,
  snapToGrid: true,
  snapToObjects: true,
  snapToSizes: true,         // Snap to matching widths/heights
  gridSize: 10,
  snapThreshold: 8,          // Pixels within which snapping activates
  weights: {
    distance: 10,            // How much distance affects snap priority
    direction: 3,            // Movement direction influence
    velocity: 2,             // Faster movement = less sticky
    grabProximity: 5,        // Snaps near grab point prioritized
    hierarchy: 4,            // Parent/sibling preference
    edgePriority: 1.2,
    centerPriority: 1.0,
    gridPriority: 0.8,
    sizePriority: 0.9
  },
  guides: {
    color: '#ff3366',
    strokeWidth: 1,
    showDistanceIndicators: true
  },
  debug: {
    enabled: false,
    showTopN: 5,
    showScores: true,
    showScoreBreakdown: false
  }
}
```

---

### Geometry Utilities

#### Bounds Operations

```tsx
import {
  getBoundsCenter,
  expandBounds,
  unionBounds,
  unionAllBounds,
  boundsIntersect,
  boundsContains,
  pointInBounds,
  boundsFromPoints,
  getHandlePositions,
  resizeBounds
} from 'react-svg-canvas'

// Get center point
const center = getBoundsCenter({ x: 0, y: 0, width: 100, height: 100 })
// { x: 50, y: 50 }

// Expand bounds by margin
const expanded = expandBounds(bounds, 10)

// Union of two bounds
const combined = unionBounds(boundsA, boundsB)

// Check intersection
if (boundsIntersect(selection, object.bounds)) {
  // Object is selected
}

// Create bounds from drag rectangle
const selectionRect = boundsFromPoints(startPoint, endPoint)

// Resize bounds from handle drag
const newBounds = resizeBounds(originalBounds, 'se', deltaX, deltaY, minW, minH)
```

#### Transforms

```tsx
import {
  transformPoint,
  invertTransform,
  composeTransforms,
  matrixToTransform,
  transformToMatrix,
  getAbsolutePosition
} from 'react-svg-canvas'

// Apply transform to point
const worldPoint = transformPoint({ x: 10, y: 10 }, transform)

// Convert SVG matrix to transform object
const transform = matrixToTransform([1, 0, 0, 1, 100, 50])

// Get absolute position walking up hierarchy
const absPos = getAbsolutePosition(item, (item) => itemsById[item.parentId])
```

#### Math Utilities

```tsx
import {
  rotatePoint,
  scalePoint,
  distance,
  snapToGrid,
  snapPointToGrid,
  lerp,
  clamp,
  normalizeAngle,
  degToRad,
  radToDeg
} from 'react-svg-canvas'

// Rotate point around center
const rotated = rotatePoint({ x: 100, y: 0 }, { x: 0, y: 0 }, 90)

// Snap to grid
const snapped = snapPointToGrid({ x: 123, y: 456 }, 10)
// { x: 120, y: 460 }
```

---

### Spatial Queries

```tsx
import {
  getObjectsAtPoint,
  getTopmostAtPoint,
  getObjectsIntersectingRect,
  getObjectsContainedInRect,
  getSelectionBounds,
  getObjectsInView,
  findNearestObject,
  getObjectsInRadius
} from 'react-svg-canvas'

// Hit testing
const clicked = getTopmostAtPoint(objects, { x: mouseX, y: mouseY })

// Rectangle selection
const selected = getObjectsIntersectingRect(objects, selectionRect)

// Viewport culling (render only visible objects)
const visible = getObjectsInView(objects, viewBounds)

// Find nearest object
const nearest = findNearestObject(objects, cursorPos, maxDistance)
```

---

## Types

```tsx
interface Point {
  x: number
  y: number
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

interface Transform {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

interface SpatialObject {
  id: string
  bounds: Bounds
}

interface ToolEvent {
  startX: number
  startY: number
  x: number
  y: number
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
```

---

## Example: Complete Editor

```tsx
import {
  SvgCanvas,
  SvgCanvasHandle,
  useSelection,
  useDraggable,
  useSnapping,
  SelectionBox,
  SnapGuides,
  DEFAULT_SNAP_CONFIG
} from 'react-svg-canvas'

function Editor() {
  const canvasRef = useRef<SvgCanvasHandle>(null)
  const [objects, setObjects] = useState<MyObject[]>(initialObjects)

  const selection = useSelection({
    objects,
    onChange: (ids) => console.log('Selected:', ids)
  })

  const snapping = useSnapping({
    objects,
    config: DEFAULT_SNAP_CONFIG,
    viewBounds: { x: 0, y: 0, width: 1920, height: 1080 }
  })

  return (
    <SvgCanvas
      ref={canvasRef}
      style={{ width: '100%', height: '100vh' }}
      onToolStart={(e) => {
        const hit = getTopmostAtPoint(objects, e)
        if (hit) selection.select(hit.id, false)
        else selection.clear()
      }}
      fixed={
        <SnapGuides
          activeSnaps={snapping.activeSnaps}
          config={DEFAULT_SNAP_CONFIG.guides}
          viewBounds={viewBounds}
        />
      }
    >
      {objects.map(obj => (
        <DraggableShape
          key={obj.id}
          object={obj}
          isSelected={selection.isSelected(obj.id)}
          onMove={(delta) => {
            const result = snapping.snapDrag({
              bounds: obj.bounds,
              objectId: obj.id,
              delta,
              grabPoint: { x: 0.5, y: 0.5 }
            })
            updateObject(obj.id, result.position)
          }}
        />
      ))}

      {selection.selectionBounds && (
        <SelectionBox
          bounds={selection.selectionBounds}
          onResizeStart={handleResize}
        />
      )}
    </SvgCanvas>
  )
}
```

## Browser Support

- Modern browsers with ES2021 support
- Touch devices (iOS Safari, Android Chrome)

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Author

Szilard Hajba <szilard@cloudillo.org>
