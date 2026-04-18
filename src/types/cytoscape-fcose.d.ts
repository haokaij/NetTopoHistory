// Cytoscape-fcose 类型声明
declare module 'cytoscape-fcose' {
  import { Core, LayoutOptions } from 'cytoscape';

  interface FcoseLayoutOptions extends LayoutOptions {
    name: 'fcose';
    quality?: 'default' | 'draft' | 'proof';
    randomize?: boolean;
    animate?: boolean | 'end';
    animationDuration?: number;
    animationEasing?: string;
    fit?: boolean;
    padding?: number;
    nodeDimensionsIncludeLabels?: boolean;
    uniformNodeDimensions?: boolean;
    packComponents?: boolean;
    nodeRepulsion?: number | ((node: unknown) => number);
    idealEdgeLength?: number | ((edge: unknown) => number);
    edgeElasticity?: number | ((edge: unknown) => number);
    nestingFactor?: number;
    gravity?: number;
    gravityRange?: number;
    gravityCompound?: number;
    gravityRangeCompound?: number;
    numIter?: number;
    tile?: boolean;
    tilingPaddingVertical?: number;
    tilingPaddingHorizontal?: number;
    initialEnergyOnIncremental?: number;
  }

  function fcose(cytoscape: (cy: Core) => void): void;

  export default fcose;
  export { FcoseLayoutOptions };
}
