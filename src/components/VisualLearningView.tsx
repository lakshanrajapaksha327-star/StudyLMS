import React, { useCallback, useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import {
  Network,
  Sparkles,
  Plus,
  Save,
  Trash2,
  Download,
  Edit3,
  Link2,
} from 'lucide-react';
import {
  deleteDiagramApi,
  fetchDiagramsApi,
  generateDiagramApi,
  saveDiagramApi,
} from '../services/api';
import { DiagramEdge, DiagramNode, SourceDocument, VisualDiagram } from '../types';
import {
  exportDiagramMmdFile,
  exportDiagramPngFile,
  exportDiagramSvgFile,
  exportToJson,
} from '../utils/exportImport';
import { sanitizeSvg } from '../utils/sanitizeSvg';

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' });

interface VisualLearningViewProps {
  sources: SourceDocument[];
  activeNotebookId?: string;
}

const DIAGRAM_TYPES = [
  { id: 'concept_map', label: 'Concept Map' },
  { id: 'mind_map', label: 'Mind Map' },
  { id: 'topic_relationships', label: 'Topic Relationships' },
  { id: 'process', label: 'Process Flow' },
  { id: 'flowchart', label: 'Flowchart' },
  { id: 'architecture', label: 'System Architecture' },
  { id: 'comparison', label: 'Comparison Diagram' },
  { id: 'step_by_step', label: 'Step-by-Step Breakdown' },
];

export const VisualLearningView: React.FC<VisualLearningViewProps> = ({
  sources,
  activeNotebookId,
}) => {
  const [diagrams, setDiagrams] = useState<VisualDiagram[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Generation controls
  const [topic, setTopic] = useState('');
  const [diagramType, setDiagramType] = useState('concept_map');

  // Editor state
  const [viewMode, setViewMode] = useState<'interactive' | 'mermaid'>('interactive');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [newEdgeLabel, setNewEdgeLabel] = useState('');
  const [mermaidSvg, setMermaidSvg] = useState('');
  const svgCanvasRef = useRef<SVGSVGElement>(null);
  const mermaidSeqRef = useRef(0);

  const loadDiagrams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchDiagramsApi(activeNotebookId);
      setDiagrams(list);
      if (list.length > 0) {
        setActiveId((prev) => (prev && list.some((d) => d.id === prev) ? prev : list[0].id));
      } else {
        setActiveId(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load diagrams.');
    } finally {
      setLoading(false);
    }
  }, [activeNotebookId]);

  useEffect(() => {
    loadDiagrams();
  }, [loadDiagrams]);

  const activeDiagram = diagrams.find((d) => d.id === activeId) || diagrams[0] || null;
  const selectedNode = activeDiagram?.nodes.find((n) => n.id === selectedNodeId) || null;

  useEffect(() => {
    const syntax = activeDiagram?.mermaidSyntax;
    if (!syntax) {
      setMermaidSvg('');
      return;
    }
    let cancelled = false;
    mermaidSeqRef.current += 1;
    mermaid
      .render(`vis-studio-${mermaidSeqRef.current}`, syntax)
      .then(({ svg }) => {
        if (!cancelled) setMermaidSvg(sanitizeSvg(svg));
      })
      .catch(() => {
        if (!cancelled) setMermaidSvg('');
      });
    return () => {
      cancelled = true;
    };
  }, [activeDiagram?.id, activeDiagram?.mermaidSyntax]);

  const updateActiveDiagramLocal = (updater: (d: VisualDiagram) => VisualDiagram) => {
    if (!activeDiagram) return;
    setDiagrams((prev) => prev.map((d) => (d.id === activeDiagram.id ? updater(d) : d)));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const diag = await generateDiagramApi({
        notebookId: activeNotebookId,
        topic: topic.trim(),
        diagramType,
        selectedDocumentIds: sources.slice(0, 4).map((s) => s.id),
      });
      setDiagrams((prev) => [diag, ...prev]);
      setActiveId(diag.id);
      setTopic('');
      setSelectedNodeId(diag.nodes[0]?.id || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate diagram.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateBlank = async () => {
    setError('');
    try {
      const diag = await saveDiagramApi({
        notebookId: activeNotebookId,
        title: 'Untitled Concept Map',
        diagramType: 'concept_map',
        description: 'Interactive editable concept map',
        nodes: [
          { id: 'n1', label: 'Core Concept', x: 260, y: 120, category: 'core' },
          { id: 'n2', label: 'Supporting Idea', x: 520, y: 240, category: 'detail' },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'relates to' }],
        mermaidSyntax: 'flowchart LR\n  n1["Core Concept"] -->|relates to| n2["Supporting Idea"]',
      });
      setDiagrams((prev) => [diag, ...prev]);
      setActiveId(diag.id);
      setSelectedNodeId('n1');
    } catch (err: any) {
      setError(err?.message || 'Failed to create blank diagram.');
    }
  };

  const handleSave = async () => {
    if (!activeDiagram) return;
    setSaving(true);
    setError('');
    try {
      // Keep mermaid syntax synced with node/edge graph if edited interactively
      const mmdLines = ['flowchart LR'];
      for (const n of activeDiagram.nodes) {
        const cleanLabel = n.label.replace(/"/g, "'");
        mmdLines.push(`  ${n.id.replace(/[^a-zA-Z0-9_]/g, '_')}["${cleanLabel}"]`);
      }
      for (const edge of activeDiagram.edges) {
        const s = edge.source.replace(/[^a-zA-Z0-9_]/g, '_');
        const t = edge.target.replace(/[^a-zA-Z0-9_]/g, '_');
        if (edge.label) {
          mmdLines.push(`  ${s} -->|${edge.label.replace(/\|/g, '')}| ${t}`);
        } else {
          mmdLines.push(`  ${s} --> ${t}`);
        }
      }
      const saved = await saveDiagramApi({
        ...activeDiagram,
        mermaidSyntax:
          viewMode === 'mermaid' ? activeDiagram.mermaidSyntax : mmdLines.join('\n'),
      });
      setDiagrams((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
    } catch (err: any) {
      setError(err?.message || 'Failed to save diagram.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDiagramApi(id);
      const rest = diagrams.filter((d) => d.id !== id);
      setDiagrams(rest);
      setActiveId(rest[0]?.id || null);
    } catch (err: any) {
      setError(err?.message || 'Could not delete diagram.');
    }
  };

  const handleAddNode = () => {
    if (!activeDiagram) return;
    const id = `n${Date.now().toString(36).slice(-4)}`;
    const node: DiagramNode = {
      id,
      label: 'New Concept',
      x: 120 + (activeDiagram.nodes.length % 4) * 180,
      y: 90 + Math.floor(activeDiagram.nodes.length / 4) * 110,
      category: 'concept',
    };
    updateActiveDiagramLocal((d) => ({ ...d, nodes: [...d.nodes, node] }));
    setSelectedNodeId(id);
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingNodeId || !svgCanvasRef.current || !activeDiagram) return;
    const rect = svgCanvasRef.current.getBoundingClientRect();
    const scaleX = 900 / rect.width;
    const scaleY = 520 / rect.height;
    const nextX = Math.max(80, Math.min(820, (e.clientX - rect.left) * scaleX));
    const nextY = Math.max(40, Math.min(480, (e.clientY - rect.top) * scaleY));
    updateActiveDiagramLocal((d) => ({
      ...d,
      nodes: d.nodes.map((n) =>
        n.id === draggingNodeId ? { ...n, x: Math.round(nextX), y: Math.round(nextY) } : n
      ),
    }));
  };

  const handleNodeClick = (nodeId: string) => {
    if (connectSourceId && connectSourceId !== nodeId && activeDiagram) {
      const edge: DiagramEdge = {
        id: `e-${Date.now()}`,
        source: connectSourceId,
        target: nodeId,
        label: newEdgeLabel.trim() || 'connects',
      };
      updateActiveDiagramLocal((d) => ({ ...d, edges: [...d.edges, edge] }));
      setConnectSourceId(null);
      setNewEdgeLabel('');
    }
    setSelectedNodeId(nodeId);
  };

  const getExportableSvgString = (): string => {
    if (viewMode === 'mermaid' && mermaidSvg) return mermaidSvg;
    if (svgCanvasRef.current) {
      return new XMLSerializer().serializeToString(svgCanvasRef.current);
    }
    return '';
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-500" /> Concept Maps & Visual Learning Studio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generate or interactively build editable concept maps, flowcharts, mind maps, and export them as SVG, PNG, JSON, or Mermaid.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateBlank}
          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Plus className="w-4 h-4 text-indigo-500" /> Blank Canvas
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Generator Bar */}
      <form
        onSubmit={handleGenerate}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3"
      >
        <input
          type="text"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic to visualize (e.g. Neural Network Backpropagation or Cellular Respiration)..."
          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
        />
        <select
          value={diagramType}
          onChange={(e) => setDiagramType(e.target.value)}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
        >
          {DIAGRAM_TYPES.map((dt) => (
            <option key={dt.id} value={dt.id}>
              {dt.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={generating}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          <span>{generating ? 'Building Graph...' : 'Generate Visual'}</span>
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Saved Diagrams List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Notebook Diagrams ({diagrams.length})
          </h2>
          {loading ? (
            <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ) : diagrams.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              Generate a concept map or start from a blank canvas.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {diagrams.map((d) => (
                <div
                  key={d.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                    d.id === activeDiagram?.id
                      ? 'bg-indigo-500/10 border-indigo-500/40'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(d.id);
                      setSelectedNodeId(d.nodes[0]?.id || null);
                    }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {d.title}
                    </div>
                    <div className="text-[10px] text-slate-400 capitalize">
                      {d.diagramType.replace(/_/g, ' ')} • {d.nodes.length} nodes
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(d.id)}
                    aria-label={`Delete diagram ${d.title}`}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Canvas / Mermaid Studio */}
        <div className="lg:col-span-3 space-y-4">
          {activeDiagram ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  type="text"
                  value={activeDiagram.title}
                  onChange={(e) =>
                    updateActiveDiagramLocal((d) => ({ ...d, title: e.target.value }))
                  }
                  className="text-base font-extrabold bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                />

                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-bold mr-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('interactive')}
                      className={`px-2.5 py-1 rounded-md ${
                        viewMode === 'interactive'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      Interactive Graph
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('mermaid')}
                      className={`px-2.5 py-1 rounded-md ${
                        viewMode === 'mermaid'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      Mermaid View
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddNode}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-500" /> Node
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                  </button>

                  <button
                    type="button"
                    onClick={() => exportDiagramSvgFile(activeDiagram.title, getExportableSvgString())}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> SVG
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportDiagramPngFile(activeDiagram.title, getExportableSvgString()).catch((e) =>
                        setError(e.message)
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold"
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => exportToJson(activeDiagram.title, activeDiagram)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold"
                  >
                    JSON
                  </button>
                  {activeDiagram.mermaidSyntax && (
                    <button
                      type="button"
                      onClick={() =>
                        exportDiagramMmdFile(activeDiagram.title, activeDiagram.mermaidSyntax || '')
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold"
                    >
                      .MMD
                    </button>
                  )}
                </div>
              </div>

              {viewMode === 'interactive' ? (
                <div className="space-y-4">
                  <div className="text-[11px] text-slate-400">
                    Drag nodes to rearrange • Click a node to edit label & notes • Click &ldquo;Connect from Node&rdquo; then click another node to link them.
                  </div>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-950 overflow-hidden">
                    <svg
                      ref={svgCanvasRef}
                      viewBox="0 0 900 520"
                      className="w-full h-[420px] select-none touch-none"
                      onPointerMove={handleSvgPointerMove}
                      onPointerUp={() => setDraggingNodeId(null)}
                      onPointerLeave={() => setDraggingNodeId(null)}
                    >
                      <defs>
                        <marker
                          id="studylms-arrow"
                          viewBox="0 0 10 10"
                          refX="9"
                          refY="5"
                          markerWidth="6"
                          markerHeight="6"
                          orient="auto-start-reverse"
                        >
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#818cf8" />
                        </marker>
                      </defs>

                      {/* Edges */}
                      {activeDiagram.edges.map((edge) => {
                        const s = activeDiagram.nodes.find((n) => n.id === edge.source);
                        const t = activeDiagram.nodes.find((n) => n.id === edge.target);
                        if (!s || !t) return null;
                        const mx = (s.x + t.x) / 2;
                        const my = (s.y + t.y) / 2;
                        return (
                          <g key={edge.id}>
                            <line
                              x1={s.x}
                              y1={s.y}
                              x2={t.x}
                              y2={t.y}
                              stroke="#6366f1"
                              strokeWidth="2"
                              strokeOpacity="0.7"
                              markerEnd="url(#studylms-arrow)"
                            />
                            {edge.label && (
                              <text
                                x={mx}
                                y={my - 6}
                                textAnchor="middle"
                                fill="#94a3b8"
                                fontSize="10"
                                fontFamily="system-ui, sans-serif"
                              >
                                {edge.label}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Nodes */}
                      {activeDiagram.nodes.map((node) => {
                        const isSelected = node.id === selectedNodeId;
                        const isConnectSource = node.id === connectSourceId;
                        const width = Math.max(120, Math.min(200, node.label.length * 7.5 + 32));
                        return (
                          <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            className="cursor-grab active:cursor-grabbing"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setDraggingNodeId(node.id);
                              handleNodeClick(node.id);
                            }}
                          >
                            <rect
                              x={-width / 2}
                              y={-22}
                              width={width}
                              height={44}
                              rx={12}
                              fill={isSelected ? '#312e81' : '#1e293b'}
                              stroke={
                                isConnectSource
                                  ? '#10b981'
                                  : isSelected
                                  ? '#818cf8'
                                  : '#475569'
                              }
                              strokeWidth={isSelected || isConnectSource ? 2.5 : 1.5}
                            />
                            <text
                              x={0}
                              y={4}
                              textAnchor="middle"
                              fill="#f8fafc"
                              fontSize="12"
                              fontWeight="600"
                              fontFamily="system-ui, sans-serif"
                            >
                              {node.label.slice(0, 24)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Selected Node Inspector */}
                  {selectedNode && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Selected Node Label
                        </label>
                        <input
                          type="text"
                          value={selectedNode.label}
                          onChange={(e) =>
                            updateActiveDiagramLocal((d) => ({
                              ...d,
                              nodes: d.nodes.map((n) =>
                                n.id === selectedNode.id ? { ...n, label: e.target.value } : n
                              ),
                            }))
                          }
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Node Study Notes
                        </label>
                        <input
                          type="text"
                          value={selectedNode.notes || ''}
                          placeholder="Add quick annotation..."
                          onChange={(e) =>
                            updateActiveDiagramLocal((d) => ({
                              ...d,
                              nodes: d.nodes.map((n) =>
                                n.id === selectedNode.id ? { ...n, notes: e.target.value } : n
                              ),
                            }))
                          }
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newEdgeLabel}
                          onChange={(e) => setNewEdgeLabel(e.target.value)}
                          placeholder="Edge label"
                          className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setConnectSourceId((prev) =>
                              prev === selectedNode.id ? null : selectedNode.id
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                            connectSourceId === selectedNode.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 text-white'
                          }`}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>
                            {connectSourceId === selectedNode.id ? 'Pick Target...' : 'Connect'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateActiveDiagramLocal((d) => ({
                              ...d,
                              nodes: d.nodes.filter((n) => n.id !== selectedNode.id),
                              edges: d.edges.filter(
                                (ed) => ed.source !== selectedNode.id && ed.target !== selectedNode.id
                              ),
                            }));
                            setSelectedNodeId(null);
                          }}
                          aria-label="Delete selected node"
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {mermaidSvg ? (
                    <div
                      className="p-4 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto flex justify-center"
                      dangerouslySetInnerHTML={{ __html: sanitizeSvg(mermaidSvg) }}
                    />
                  ) : (
                    <p className="text-xs text-amber-400">
                      Edit Mermaid syntax below to preview rendered diagram.
                    </p>
                  )}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Mermaid Syntax
                    </label>
                    <textarea
                      rows={6}
                      value={activeDiagram.mermaidSyntax || ''}
                      onChange={(e) =>
                        updateActiveDiagramLocal((d) => ({
                          ...d,
                          mermaidSyntax: e.target.value,
                        }))
                      }
                      className="w-full font-mono text-xs bg-slate-950 text-emerald-300 border border-slate-800 rounded-xl p-3"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Network className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No visual diagrams in this notebook yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Enter any study topic above to build an interactive concept map or flowchart grounded in your notebook sources.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
