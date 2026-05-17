'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { api, type ReActExecution } from '@/lib/api';
import { useEngagementStore } from '@/lib/store';
import { ReActResultsPanel } from '../react-results-panel';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './nodes';
import { NodePalette } from './node-palette';
import { NodeConfigPanel } from './node-config-panel';
import {
  makeNode,
  INITIAL_NODES,
  INITIAL_EDGES,
  type FlowNodeType,
} from './flow-utils';

interface VisualBuilderProps {
  agentName?: string;
  templateId?: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
}

export function VisualBuilder({ agentName = 'Untitled Agent', templateId, initialNodes, initialEdges }: VisualBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes ?? INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges ?? INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [name, setName] = useState(agentName);
  const [currentTemplateId, setCurrentTemplateId] = useState(templateId);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [runState, setRunState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [runMessage, setRunMessage] = useState('');
  const [completedExecution, setCompletedExecution] = useState<ReActExecution | null>(null);
  const [showResults, setShowResults] = useState(false);
  const currentEngagement = useEngagementStore((s) => s.currentEngagement);

  useEffect(() => { setName(agentName); }, [agentName]);

  useEffect(() => {
    if (initialNodes) setNodes(initialNodes);
    if (initialEdges) setEdges(initialEdges);
    if (templateId) setCurrentTemplateId(templateId);
  }, [initialNodes, initialEdges, templateId, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep', animated: false }, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleUpdateNode = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data } : n)),
    );
    setSelectedNode((prev) => (prev?.id === nodeId ? { ...prev, data } : prev));
  }, [setNodes]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  const handleAddNode = useCallback((type: FlowNodeType) => {
    const position = { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 };
    setNodes((nds) => [...nds, makeNode(type, position)]);
  }, [setNodes]);

  // Drag-and-drop from palette onto canvas
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/merris-node-type') as FlowNodeType;
      if (!type || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: e.clientX - bounds.left - 95,
        y: e.clientY - bounds.top - 40,
      };
      setNodes((nds) => [...nds, makeNode(type, position)]);
    },
    [setNodes],
  );

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaveState('saving');
    try {
      // Convert visual nodes to workflow steps
      const steps = nodes
        .filter((n) => n.type !== 'trigger' && n.type !== 'output')
        .map((n) => {
          const d = n.data as Record<string, unknown>;
          const toolMap: Record<string, string> = {
            'kb-search':  'search_knowledge',
            'llm-reason': 'generate_text',
            'tool-call':  'generate_text',
            condition:    'verify_compliance',
            transform:    'perceive_document',
          };
          return {
            id: n.id,
            name: String(d.label ?? n.type),
            description: String(d.prompt ?? d.operation ?? d.tool ?? ''),
            tool: toolMap[n.type ?? ''] ?? 'generate_text',
            inputs: {},
          };
        });
      const saved = await api.saveWorkflowTemplate({
        ...(currentTemplateId ? { id: currentTemplateId } : {}),
        name: name.trim(),
        description: `Visual workflow with ${nodes.length} nodes`,
        category: 'Custom',
        steps,
        graph: { nodes, edges },
      });
      setCurrentTemplateId(saved.id);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  const handleRun = async () => {
    if (!currentEngagement) {
      setRunMessage('Select an engagement from the top bar first.');
      setRunState('error');
      return;
    }
    setRunState('running');
    setRunMessage('Saving and launching ReAct agent…');
    try {
      const steps = nodes
        .filter((n) => n.type !== 'trigger' && n.type !== 'output')
        .map((n) => {
          const d = n.data as Record<string, unknown>;
          const toolMap: Record<string, string> = {
            'kb-search':  'search_knowledge',
            'llm-reason': 'generate_text',
            'tool-call':  'generate_text',
            condition:    'verify_compliance',
            transform:    'perceive_document',
          };
          return {
            id: n.id,
            name: String(d.label ?? n.type),
            description: String(d.prompt ?? d.operation ?? d.tool ?? ''),
            tool: toolMap[n.type ?? ''] ?? 'generate_text',
            inputs: {},
          };
        });
      const saved = await api.saveWorkflowTemplate({ ...(currentTemplateId ? { id: currentTemplateId } : {}), name: name.trim(), description: `Visual workflow — ${nodes.length} nodes`, category: 'Custom', steps, graph: { nodes, edges } });
      const execution = await api.runReActAgent(saved.id, currentEngagement.id, {});
      setRunState('done');
      setRunMessage(`Completed · ${execution.iterations} iteration${execution.iterations !== 1 ? 's' : ''} · ${execution.steps.length} steps`);
      setCompletedExecution(execution);
      setShowResults(true);
    } catch (err) {
      setRunState('error');
      setRunMessage(err instanceof Error ? err.message : 'ReAct execution failed');
    }
  };

  const handleClearCanvas = () => {
    if (window.confirm('Clear all nodes? This cannot be undone.')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
    }
  };

  return (
    <>
    {showResults && completedExecution && (
      <ReActResultsPanel execution={completedExecution} onClose={() => setShowResults(false)} />
    )}
    <div className="flex h-[calc(100vh-200px)] min-h-[560px] overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      {/* Left palette */}
      <NodePalette onAddNode={handleAddNode} />

      {/* Canvas */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-48 rounded-lg border border-transparent bg-gray-50 px-2.5 py-1 font-display text-[13px] font-semibold text-gray-700 outline-none focus:border-gray-300"
            placeholder="Agent name…"
          />
          <div className="ml-auto flex items-center gap-2">
            <span className="font-body text-[10px] text-gray-400">
              {nodes.length} nodes · {edges.length} edges
            </span>
            {(runState === 'done' || runState === 'error') && (
              <span className={`font-body text-[10px] max-w-[180px] truncate ${runState === 'done' ? 'text-green-600' : 'text-red-500'}`}>
                {runMessage}
              </span>
            )}
            {runState === 'done' && completedExecution && (
              <button
                type="button"
                onClick={() => setShowResults(true)}
                className="rounded-lg border border-green-500 px-3 py-1.5 font-body text-[11px] font-semibold text-green-600 hover:bg-green-50"
              >
                View Results →
              </button>
            )}
            <button
              type="button"
              onClick={handleClearCanvas}
              className="rounded-lg border border-gray-200 px-3 py-1.5 font-body text-[11px] text-gray-500 transition-colors hover:bg-gray-100"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === 'saving'}
              className={`rounded-lg px-4 py-1.5 font-body text-[11px] font-semibold transition-all ${
                saveState === 'saved'
                  ? 'bg-green-600 text-white'
                  : saveState === 'error'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60'
              }`}
            >
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : saveState === 'error' ? '✗ Error' : '💾 Save Agent'}
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={runState === 'running'}
              className="rounded-lg bg-merris-primary px-4 py-1.5 font-body text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {runState === 'running' ? '⏳ Running…' : '▶ Run'}
            </button>
          </div>
        </div>

        {/* ReactFlow canvas */}
        <div ref={reactFlowWrapper} className="flex-1 bg-[#f9f9f9]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#d1d5db', strokeWidth: 1.5 } }}
            snapToGrid
            snapGrid={[16, 16]}
            minZoom={0.3}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#e5e7eb"
            />
            <Controls
              className="!shadow-sm !rounded-xl !border !border-gray-200 !bg-white"
              showInteractive={false}
            />
            <MiniMap
              className="!rounded-xl !border !border-gray-200 !bg-white !shadow-sm"
              nodeColor={(n) => {
                const colors: Record<string, string> = {
                  trigger: '#16a34a', 'kb-search': '#0369a1',
                  'llm-reason': '#7c3aed', 'tool-call': '#b45309',
                  condition: '#be185d', transform: '#0e7490', output: '#374151',
                };
                return colors[n.type ?? ''] ?? '#9ca3af';
              }}
              maskColor="rgba(249,249,249,0.7)"
            />

            {/* Empty state overlay */}
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-16 rounded-2xl border border-dashed border-gray-300 bg-white/80 px-10 py-8 text-center backdrop-blur-sm">
                  <div className="mb-3 text-[32px]">🔲</div>
                  <p className="font-display text-[14px] font-semibold text-gray-600">Canvas is empty</p>
                  <p className="mt-1 font-body text-[12px] text-gray-400">
                    Drag nodes from the left panel or click + to add
                  </p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Right config panel */}
      <NodeConfigPanel
        node={selectedNode}
        onUpdate={handleUpdateNode}
        onDelete={handleDeleteNode}
      />
    </div>
    </>
  );
}
