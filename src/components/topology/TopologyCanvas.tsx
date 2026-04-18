// ============================================================
// TopologyCanvas - Cytoscape.js 拓扑图画布组件
// ============================================================

'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { useTopologyStore } from '@/store/topologyStore';
import type { NetworkNode, TopologyEdge, NodeStatus } from '@/types';

// 节点状态颜色映射
const STATUS_COLORS: Record<NodeStatus, string> = {
  online: '#22c55e',
  offline: '#ef4444',
  'high-latency': '#eab308'
};

// Cytoscape 样式配置
const CY_STYLESHEET = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'font-size': 12,
      color: '#e2e8f0',
      'text-background-color': '#1e293b',
      'text-background-opacity': 0.8,
      'text-background-padding': '3px',
      'text-background-shape': 'roundrectangle',
      width: 40,
      height: 40,
      'background-color': '#475569',
      'border-width': 3,
      'border-color': '#64748b'
    }
  },
  {
    selector: 'node[?isGateway]',
    style: {
      shape: 'round-hexagon',
      width: 50,
      height: 50,
      'font-size': 14,
      'font-weight': 'bold'
    }
  },
  {
    selector: 'node[?isGateway][status = "online"]',
    style: {
      'background-color': '#22c55e',
      'border-color': '#16a34a'
    }
  },
  {
    selector: 'node[status = "online"]',
    style: {
      'background-color': '#22c55e',
      'border-color': '#16a34a'
    }
  },
  {
    selector: 'node[status = "offline"]',
    style: {
      'background-color': '#ef4444',
      'border-color': '#dc2626',
      opacity: 0.7
    }
  },
  {
    selector: 'node[status = "high-latency"]',
    style: {
      'background-color': '#eab308',
      'border-color': '#ca8a04'
    }
  },
  {
    selector: 'node:selected',
    style: {
      'border-width': 5,
      'border-color': '#3b82f6'
    }
  },
  {
    selector: 'edge',
    style: {
      width: 2,
      'line-color': '#64748b',
      'target-arrow-color': '#64748b',
      'curve-style': 'bezier',
      'arrow-scale': 1
    }
  },
  {
    selector: 'edge[directed]',
    style: {
      'target-arrow-shape': 'triangle',
      'line-style': 'solid'
    }
  },
  {
    selector: 'edge:selected',
    style: {
      'line-color': '#3b82f6',
      'target-arrow-color': '#3b82f6'
    }
  },
  {
    selector: '.ghost-node',
    style: {
      'background-color': '#6366f1',
      'border-style': 'dashed',
      'border-width': 2,
      'border-color': '#4f46e5',
      opacity: 0.6,
      label: 'data(label)',
      'font-size': 10,
      'text-rotation': '-30deg'
    }
  }
];

interface TopologyCanvasProps {
  onNodeSelect?: (node: NetworkNode | null) => void;
  onNodeRightClick?: (node: NetworkNode | null, position: { x: number; y: number }) => void;
  onEdgeSelect?: (edge: TopologyEdge | null) => void;
}

export default function TopologyCanvas({
  onNodeSelect,
  onNodeRightClick,
  onEdgeSelect
}: TopologyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const {
    nodes,
    edges,
    setSelectedNode,
    updateNodePosition,
    removeNode,
    removeEdge
  } = useTopologyStore();

  // 将节点转换为 Cytoscape 格式
  const nodeToCyData = useCallback(
    (node: NetworkNode) => ({
      id: node.id,
      label: node.hostname || node.ip,
      ip: node.ip,
      status: node.status,
      latency: node.latency,
      hostname: node.hostname,
      description: node.description,
      isGateway: node.isGateway
    }),
    []
  );

  // 将边转换为 Cytoscape 格式
  const edgeToCyData = useCallback(
    (edge: TopologyEdge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      directed: edge.directed,
      label: edge.label
    }),
    []
  );

  // 初始化 Cytoscape
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    // 先导入并注册 fcose 布局
    import('cytoscape-fcose').then((module) => {
      // @ts-expect-error - Cytoscape 扩展 API 类型不兼容
      cytoscape.use(module.default);

      const cy = cytoscape({
        container: containerRef.current,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style: CY_STYLESHEET as any,
        minZoom: 0.2,
        maxZoom: 3,
        wheelSensitivity: 0.3,
        boxSelectionEnabled: true
      });

      cyRef.current = cy;

      // 布局配置
      const layoutOptions = {
        name: 'fcose',
        randomize: true,
        fit: true,
        padding: 50,
        nodeDimensionsIncludeLabels: true,
        uniformNodeDimensions: false,
        packComponents: true,
        nodeRepulsion: () => 4500,
        idealEdgeLength: () => 100,
        edgeElasticity: () => 0.45,
        nestingFactor: 0.1,
        gravity: 0.25,
        gravityRange: 3.8,
        gravityCompound: 1.0,
        gravityRangeCompound: 1.5,
        numIter: 2500,
        initialEnergyOnIncremental: 0.5
      };

      // 设置初始布局
      cy.layout(layoutOptions).run();

      // 节点点击事件
      cy.on('tap', 'node', (evt: { target: { id: () => string } }) => {
        const nodeId = evt.target.id();
        setSelectedNode(nodeId);
        const nodeData = nodes.find((n: NetworkNode) => n.id === nodeId);
        onNodeSelect?.(nodeData || null);
      });

      // 空白区域点击
      cy.on('tap', (evt: { target: unknown }) => {
        if (evt.target === cy) {
          setSelectedNode(null);
          onNodeSelect?.(null);
        }
      });

      // 边点击事件
      cy.on('tap', 'edge', (evt: { target: { id: () => string } }) => {
        const edgeId = evt.target.id();
        const edgeData = edges.find((e: TopologyEdge) => e.id === edgeId);
        onEdgeSelect?.(edgeData || null);
      });

      // 节点拖拽结束 - 保存位置
      cy.on('dragfree', 'node', (evt: { target: { id: () => string; position: () => { x: number; y: number } } }) => {
        const target = evt.target;
        const id = target.id();
        const position = target.position();
        updateNodePosition(id, position.x, position.y);
      });

      // 右键菜单
      cy.on('cxttap', 'node', (evt: { target: { id: () => string; renderedPosition: () => { x: number; y: number } } }) => {
        const nodeId = evt.target.id();
        const nodeData = nodes.find((n: NetworkNode) => n.id === nodeId);
        if (nodeData) {
          const renderedPosition = evt.target.renderedPosition();
          onNodeRightClick?.(nodeData, { x: renderedPosition.x, y: renderedPosition.y });
        }
      });

      // 空白区域右键
      cy.on('cxttap', () => {
        const pos = cy.container()?.getBoundingClientRect();
        if (pos) {
          onNodeRightClick?.(null, { x: pos.width / 2, y: pos.height / 2 });
        }
      });

      // 键盘事件
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const selected = cy.elements(':selected');
          if (selected.length > 0) {
            selected.forEach((ele: { isNode: () => boolean; isEdge: () => boolean; id: () => string }) => {
              if (ele.isNode()) {
                removeNode(ele.id());
              } else if (ele.isEdge()) {
                removeEdge(ele.id());
              }
            });
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      // 清理函数
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        cy.destroy();
      };
    });
  }, []);

  // 更新节点和边数据
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // 更新节点
    const existingNodeIds = new Set(cy.nodes().map((n: { id: () => string }) => n.id()));
    const newNodeIds = new Set(nodes.map((n: NetworkNode) => n.id));

    // 添加新节点
    nodes.forEach((node: NetworkNode) => {
      if (!existingNodeIds.has(node.id)) {
        const cyData = nodeToCyData(node);
        const ele = cy.add({
          group: 'nodes',
          data: cyData
        });

        if (node.position) {
          ele.position(node.position);
        }
      } else {
        const cyNode = cy.getElementById(node.id);
        const cyData = nodeToCyData(node);
        cyNode.data(cyData);

        if (node.position) {
          cyNode.position(node.position);
        }
      }
    });

    // 移除不存在的节点
    cy.nodes().forEach((cyNode: { id: () => string; remove: () => void }) => {
      if (!newNodeIds.has(cyNode.id())) {
        cyNode.remove();
      }
    });

    // 更新边
    const existingEdgeIds = new Set(cy.edges().map((e: { id: () => string }) => e.id()));
    const newEdgeIds = new Set(edges.map((e: TopologyEdge) => e.id));

    edges.forEach((edge: TopologyEdge) => {
      if (!existingEdgeIds.has(edge.id)) {
        cy.add({
          group: 'edges',
          data: edgeToCyData(edge)
        });
      } else {
        const cyEdge = cy.getElementById(edge.id);
        cyEdge.data(edgeToCyData(edge));
      }
    });

    cy.edges().forEach((cyEdge: { id: () => string; remove: () => void }) => {
      if (!newEdgeIds.has(cyEdge.id())) {
        cyEdge.remove();
      }
    });

    // 如果有节点变化，重新运行布局
    if (nodes.length > 0 && nodes.some((n: NetworkNode) => !n.position)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cy.layout as any)({
        name: 'fcose',
        padding: 50,
        nodeDimensionsIncludeLabels: true,
        randomize: false,
        nodeRepulsion: () => 4500,
        idealEdgeLength: () => 100,
        edgeElasticity: () => 0.45,
        gravity: 0.25,
        numIter: 1000,
        initialEnergyOnIncremental: 0.5
      }).run();
    }
  }, [nodes, edges, nodeToCyData, edgeToCyData]);

  // 更新节点状态
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    nodes.forEach((node: NetworkNode) => {
      const cyNode = cy.getElementById(node.id);
      if (cyNode.length > 0) {
        const newColor = STATUS_COLORS[node.status];
        cyNode.style('background-color', newColor);
        cyNode.style('border-color', newColor);

        const label = node.isGateway
          ? `${node.hostname || node.ip}\n${node.latency >= 0 ? `${node.latency}ms` : 'OFF'}`
          : `${node.ip}\n${node.latency >= 0 ? `${node.latency}ms` : 'OFF'}`;
        cyNode.data('label', label);
      }
    });
  }, [nodes]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] bg-slate-900 rounded-lg overflow-hidden"
      style={{ cursor: 'grab' }}
    />
  );
}
