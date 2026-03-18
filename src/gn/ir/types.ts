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
