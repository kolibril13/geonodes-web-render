// Node header colors sourced directly from Blender's default dark theme in
// release/datafiles/userdef/userdef_default_theme.c.
//
// The mapping from bl_idname to color goes:
//   bl_idname prefix → NODE_CLASS_* (node_draw.cc: node_get_colorid)
//                    → ts->nodeclass_* field (resources.cc: TH_NODE_*)
//                    → RGBA hex in userdef_default_theme.c
//
// NODE_CLASS assignments per node type:
//   NodeGroupInput / NodeGroupOutput → NODE_CLASS_INTERFACE  (node_common.cc)
//   GeometryNode*                    → NODE_CLASS_GEOMETRY   (most geo nodes)
//   "Input" nodes                    → NODE_CLASS_INPUT
//   "Attribute" nodes                → NODE_CLASS_ATTRIBUTE
//   "Converter" nodes                → NODE_CLASS_CONVERTER
//   ShaderNode*                      → NODE_CLASS_SHADER
//   FunctionNode*                    → NODE_CLASS_CONVERTER

// All colors are the default Blender dark theme values (sRGB hex, as stored).
const NODE_CLASS_COLORS: Record<string, string> = {
  GEOMETRY:  '#1d725e', // ts->nodeclass_geometry
  INPUT:     '#82354c', // ts->syntaxn
  OUTPUT:    '#3e232a', // ts->nodeclass_output
  ATTRIBUTE: '#1d2546', // ts->nodeclass_attribute
  CONVERTER: '#246283', // ts->syntaxv
  GROUP:     '#374725', // ts->syntaxc
  INTERFACE: '#1d1d1d', // ts->console_output  (Group Input/Output)
  SHADER:    '#2b652b', // ts->nodeclass_shader
  TEXTURE:   '#79461d', // ts->nodeclass_texture
  FILTER:    '#412b51', // ts->nodeclass_filter
  VECTOR:    '#3c3c83', // ts->nodeclass_vector
  MATTE:     '#5a3838', // ts->syntaxs
  DISTORT:   '#3e5a5b', // ts->syntaxd
  SCRIPT:    '#203c3c', // ts->nodeclass_script
  DEFAULT:   '#303030', // ts->syntaxl  (TH_NODE fallback)
}

// Derive node class from bl_idname. Blender's bl_idnames for GN follow these
// prefixes reliably. For anything unrecognised we fall back to DEFAULT.
function nodeClassFromIdname(blIdname: string): string {
  if (blIdname === 'NodeGroupInput' || blIdname === 'NodeGroupOutput') {
    return 'INTERFACE'
  }
  if (blIdname.startsWith('NodeGroup')) return 'GROUP'
  if (blIdname.startsWith('GeometryNodeSet') ||
      blIdname.startsWith('GeometryNodeTransform') ||
      blIdname.startsWith('GeometryNodeMerge') ||
      blIdname.startsWith('GeometryNodeJoin') ||
      blIdname.startsWith('GeometryNodeDelete') ||
      blIdname.startsWith('GeometryNodeSeparate') ||
      blIdname.startsWith('GeometryNodeDuplicate') ||
      blIdname.startsWith('GeometryNodeExtrude') ||
      blIdname.startsWith('GeometryNodeFlip') ||
      blIdname.startsWith('GeometryNodeSubdivide') ||
      blIdname.startsWith('GeometryNodeTriangulate') ||
      blIdname.startsWith('GeometryNodeMesh') ||
      blIdname.startsWith('GeometryNodeCurve') ||
      blIdname.startsWith('GeometryNodePoints') ||
      blIdname.startsWith('GeometryNodeVolume') ||
      blIdname.startsWith('GeometryNodeInstance') ||
      blIdname.startsWith('GeometryNodeRealize') ||
      blIdname.startsWith('GeometryNodeConvex') ||
      blIdname.startsWith('GeometryNodeFill') ||
      blIdname.startsWith('GeometryNodeSDF') ||
      blIdname.startsWith('GeometryNode')) {
    return 'GEOMETRY'
  }
  if (blIdname.startsWith('ShaderNode')) return 'SHADER'
  if (blIdname.startsWith('FunctionNode')) return 'CONVERTER'
  return 'DEFAULT'
}

// Finer override for known INPUT/OUTPUT/ATTRIBUTE/CONVERTER geometry nodes.
// These are nodes that explicitly set nclass != NODE_CLASS_GEOMETRY in their cc files.
const IDNAME_CLASS_OVERRIDES: Record<string, string> = {
  // NODE_CLASS_INPUT — nodes that read data but don't transform geometry
  GeometryNodeInputMaterial:            'INPUT',
  GeometryNodeInputMaterialIndex:       'INPUT',
  GeometryNodeInputRadius:              'INPUT',
  GeometryNodeInputPosition:            'INPUT',
  GeometryNodeInputNormal:              'INPUT',
  GeometryNodeInputTangent:             'INPUT',
  GeometryNodeInputCurveHandlePositions:'INPUT',
  GeometryNodeInputCurveTilt:           'INPUT',
  GeometryNodeInputID:                  'INPUT',
  GeometryNodeInputIndex:               'INPUT',
  GeometryNodeInputNamedAttribute:      'INPUT',
  GeometryNodeInputNamedLayerSelection: 'INPUT',
  GeometryNodeInputEdgeSmooth:          'INPUT',
  GeometryNodeInputShadeSmooth:         'INPUT',
  GeometryNodeInputMeshEdgeAngle:       'INPUT',
  GeometryNodeInputMeshEdgeNeighbors:   'INPUT',
  GeometryNodeInputMeshEdgeVertices:    'INPUT',
  GeometryNodeInputMeshFaceArea:        'INPUT',
  GeometryNodeInputMeshFaceNeighbors:   'INPUT',
  GeometryNodeInputMeshFaceIsPlanar:    'INPUT',
  GeometryNodeInputMeshIsland:          'INPUT',
  GeometryNodeInputMeshVertexNeighbors: 'INPUT',
  GeometryNodeInputInstanceTransform:   'INPUT',
  GeometryNodeInputInstanceBounds:      'INPUT',
  GeometryNodeIsViewport:               'INPUT',
  GeometryNodeObjectInfo:               'INPUT',
  GeometryNodeCollectionInfo:           'INPUT',
  GeometryNodeSelfObject:               'INPUT',
  GeometryNodeImageInfo:                'INPUT',
  GeometryNodeCurveSplineType:          'INPUT',
  GeometryNodeSplineResolution:         'INPUT',
  GeometryNodeSplineLength:             'INPUT',
  GeometryNodeSplineParameter:          'INPUT',
  GeometryNodeSplineCyclic:             'INPUT',
  // NODE_CLASS_ATTRIBUTE
  GeometryNodeAttributeStatistic:       'ATTRIBUTE',
  GeometryNodeAttributeDomainSize:      'ATTRIBUTE',
  GeometryNodeBlurAttribute:            'ATTRIBUTE',
  GeometryNodeCaptureAttribute:         'ATTRIBUTE',
  GeometryNodeRemoveAttribute:          'ATTRIBUTE',
  GeometryNodeStoreNamedAttribute:      'ATTRIBUTE',
  GeometryNodeNamedLayerSelection:      'ATTRIBUTE',
  // NODE_CLASS_CONVERTER
  GeometryNodeStringJoin:               'CONVERTER',
  GeometryNodeStringToCurves:           'CONVERTER',
  GeometryNodeFieldAtIndex:             'CONVERTER',
  GeometryNodeFieldOnDomain:            'CONVERTER',
  GeometryNodeEvaluateAtIndex:          'CONVERTER',
  GeometryNodeEvaluateOnDomain:         'CONVERTER',
  GeometryNodeFieldVariance:            'CONVERTER',
  GeometryNodeViewer:                   'OUTPUT',
}

export function nodeHeaderColor(blIdname: string): string {
  const override = IDNAME_CLASS_OVERRIDES[blIdname]
  const cls = override ?? nodeClassFromIdname(blIdname)
  return NODE_CLASS_COLORS[cls] ?? NODE_CLASS_COLORS.DEFAULT
}
