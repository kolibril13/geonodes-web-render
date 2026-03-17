export function CanvasPane() {
  return (
    <div className="panel canvas-panel">
      <div className="panel-header">
        <div className="panel-title">Canvas</div>
      </div>
      <div className="panel-body canvas-body">
        <canvas className="render-canvas" />
        <div className="canvas-overlay">Render output goes here.</div>
      </div>
    </div>
  )
}

