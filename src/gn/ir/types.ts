export type SocketDirection = 'input' | 'output'

export type SocketIR = {
  id: string
  nodeId: string
  name: string
  direction: SocketDirection
  dataType: string
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
  inputs: SocketIR[]
  outputs: SocketIR[]
}

export type EdgeIR = {
  id: string
  sourceNodeId: string
  sourceSocketId: string
  targetNodeId: string
  targetSocketId: string
}

export type GraphIR = {
  id: string
  label: string
  nodes: NodeIR[]
  edges: EdgeIR[]
}
