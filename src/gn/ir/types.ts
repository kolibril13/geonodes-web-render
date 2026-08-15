export type SocketDirection = 'input' | 'output'

export type FloatCurvePoint = {
  location: [number, number]
  handleType: string
}

export type FloatCurveData = {
  clipMinX: number
  clipMinY: number
  clipMaxX: number
  clipMaxY: number
  extend: string
  points: FloatCurvePoint[]
}

export type ColorRampStop = {
  position: number
  /** Scene-linear RGBA, as stored by Blender. */
  color: [number, number, number, number]
}

export type ColorRampData = {
  /** LINEAR | EASE | CONSTANT | B_SPLINE | CARDINAL */
  interpolation: string
  /** RGB | HSV | HSL */
  colorMode: string
  /** NEAR | FAR | CW | CCW */
  hueInterpolation: string
  stops: ColorRampStop[]
}
export type SocketDisplayShape = 'CIRCLE' | 'DIAMOND' | 'LINE' | 'LIST' | 'VOLUME_GRID'

export type SocketDefaultValue =
  | { kind: 'scalar'; value: number | boolean | string }
  | { kind: 'vec'; values: number[] }

export type SocketIR = {
  id: string
  nodeId: string
  name: string
  direction: SocketDirection
  dataType: string
  displayShape: SocketDisplayShape
  color: string
  defaultValue: SocketDefaultValue | null
  /** Blender's socket.hide: socket is hidden unless it has a link. */
  hide: boolean
  hideValue: boolean
  enabled: boolean
  index: number
}

export type NodeIR = {
  id: string
  type: string
  label: string
  position: {
    x: number
    y: number
  }
  width: number
  headerColor: string
  inputs: SocketIR[]
  outputs: SocketIR[]
  floatCurve?: FloatCurveData
  colorRamp?: ColorRampData
  /** Node-type-specific enum properties (e.g. operation, data_type for Compare) */
  properties?: Record<string, string>
  /** For group nodes: id/name of the referenced node tree within the export */
  groupTreeId?: string
  groupTreeName?: string
  /** Id of the NodeFrame this node is parented to (Blender "parent"), if any. */
  parentFrameId?: string
  /** For zone input nodes (Simulation/Repeat/…): id of the paired output node. */
  pairedOutputId?: string
  /** Blender's node.hide: node is collapsed to its header row. */
  hide: boolean
}

export type EdgeIR = {
  id: string
  sourceNodeId: string
  sourceSocketId: string
  targetNodeId: string
  targetSocketId: string
  color: string
}

export type GraphIR = {
  id: string
  label: string
  nodes: NodeIR[]
  edges: EdgeIR[]
}
