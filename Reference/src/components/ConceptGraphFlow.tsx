import { useCallback, useMemo, useState, useEffect, memo } from "react";
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
  MarkerType,
  Handle,
  Position,
  NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Loader2, Trash2, User } from "lucide-react";
import { apiPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { cn } from "@/lib/utils";

type ConceptNode = {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
};

type ConceptEdge = {
  source: string;
  target: string;
};

type Props = {
  center: string;
  subjectName: string;
  std: number;
};

const accentBorders = [
  { border: "4px solid #06b6d4", bg: "hsl(187 100% 42% / 0.12)" }, // cyan
  { border: "4px solid #eab308", bg: "hsl(50 98% 50% / 0.12)" }, // yellow
  { border: "4px solid #f97316", bg: "hsl(25 95% 53% / 0.12)" }, // orange
  { border: "4px solid #10b981", bg: "hsl(160 84% 39% / 0.12)" }, // emerald
  { border: "4px solid #a855f7", bg: "hsl(270 90% 60% / 0.12)" }, // purple
];

const EditableNode = memo(({ id, data, selected }: NodeProps) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(data.label as string);

  const isCenter = id === "center";

  useEffect(() => {
    setVal(data.label as string);
  }, [data.label]);

  const commit = useCallback(() => {
    setEditing(false);
    if (val.trim() && val !== data.label) {
      data.label = val.trim();
    } else {
      setVal(data.label as string);
    }
  }, [val, data]);

  const a = isCenter
    ? { border: "none" }
    : accentBorders[Number(id.replace("node-", "").replace("ch-", "")) % accentBorders.length];

  return (
    <div
      onDoubleClick={() => (isCenter ? null : setEditing(true))}
      className={cn(
        "relative px-4 py-2 text-xs font-bold transition-shadow min-w-[60px]",
        isCenter
          ? "bg-gradient-to-br from-purple-500 to-purple-700 text-white font-extrabold text-sm px-5 rounded-full"
          : "bg-card text-foreground font-bold rounded-full shadow-sm",
      )}
      style={{
        border: isCenter ? "none" : `2px solid ${a.border.replace("4px solid ", "")}`,
        outline: selected && !isCenter ? "2px solid hsl(var(--primary))" : "none",
        outlineOffset: 2,
      }}
    >
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setVal(data.label as string);
              setEditing(false);
            }
          }}
          className="w-full bg-transparent outline-none border-b-2 border-primary font-bold text-xs"
          style={{ minWidth: 60 }}
        />
      ) : (
        <span className="block leading-tight select-none text-center max-w-[200px]">
          {data.label as string}
        </span>
      )}
      {!isCenter && (
        <>
          <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-card !bg-primary" />
          <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-card !bg-primary" />
        </>
      )}
    </div>
  );
});

const nodeTypes = { default: EditableNode };

export default function ConceptGraphFlow({ center, subjectName, std }: Props) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const isTeacher = me?.role === "teacher";
  const [editing, setEditing] = useState(false);
  const [nextId, setNextId] = useState(100);

  const { data, isLoading } = useQuery({
    queryKey: ["related-concepts", std, subjectName, center],
    queryFn: async () => {
      const res = await fetch(
        apiPath(
          `/api/content/related?std=${std}&subjectName=${encodeURIComponent(subjectName)}&chapterName=${encodeURIComponent(center)}`,
        ),
      );
      const body = await parseApiJson<{
        concepts?: ConceptNode[];
        edges?: ConceptEdge[];
        updatedBy?: string;
      }>(res);
      if (!res.ok) throw new Error("Failed");
      return body;
    },
  });

  const initialNodes: Node[] = useMemo(() => {
    const concepts = data?.concepts ?? [];
    if (!concepts.length) return [];
    const centerNode: Node = {
      id: "center",
      type: "default",
      position: { x: 250, y: 200 },
      data: { label: center },
    };
    const others: Node[] = concepts.map((n, i) => ({
      id: n.id,
      type: "default",
      position: { x: n.x * 5, y: n.y * 5 },
      data: { label: n.name },
    }));
    return [centerNode, ...others];
  }, [data?.concepts, center]);

  const initialEdges: Edge[] = useMemo(() => {
    return (data?.edges ?? []).map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      style: { stroke: "#a855f7", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#a855f7" },
    }));
  }, [data?.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!editing) return;
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            style: { stroke: "#a855f7", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#a855f7" },
          },
          eds,
        ),
      );
    },
    [editing, setEdges],
  );

  const addNode = () => {
    const id = `node-${nextId}`;
    setNextId((n) => n + 1);
    const newNode: Node = {
      id,
      type: "default",
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { label: "New concept" },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const removeSelected = () => {
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => eds.filter((e) => !e.selected));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Login required");
      const conceptNodes: ConceptNode[] = nodes
        .filter((n) => n.id !== "center")
        .map((n) => ({
          id: n.id,
          name: n.data.label as string,
          x: Math.round(n.position.x / 5),
          y: Math.round(n.position.y / 5),
          color: "gradient-cyan text-white",
        }));
      const conceptEdges: ConceptEdge[] = edges
        .filter((e) => e.source !== "center" && e.target !== "center")
        .map((e) => ({ source: e.source, target: e.target }));
      const res = await fetch(apiPath("/api/content/related"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          std,
          subjectName,
          chapterName: center,
          nodes: conceptNodes,
          edges: conceptEdges,
        }),
      });
      const body = await parseApiJson<{ status: string; updatedBy?: string; error?: string }>(res);
      if (!res.ok) throw new Error(body.error || "Save failed");
      return body;
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["related-concepts", std, subjectName, center] });
    },
  });

  const hasData = nodes.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {data?.updatedBy && (
            <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
              <User className="w-3 h-3" />
              Updated by <span className="font-bold text-foreground/80">{data.updatedBy}</span>
            </span>
          )}
        </div>
        {isTeacher && (
          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="h-8 px-3 rounded-xl clay-sm bg-card flex items-center gap-1.5 text-xs font-bold text-primary hover:scale-105 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" /> Edit graph
              </button>
            ) : (
              <>
                <button
                  onClick={addNode}
                  className="h-8 px-3 rounded-xl clay-sm bg-card flex items-center gap-1.5 text-xs font-bold text-emerald-500 hover:scale-105 transition-transform"
                >
                  <Plus className="w-3.5 h-3.5" /> Add node
                </button>
                <button
                  onClick={removeSelected}
                  className="h-8 px-3 rounded-xl clay-sm bg-card flex items-center gap-1.5 text-xs font-bold text-destructive hover:scale-105 transition-transform"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
                <button
                  onClick={() => saveMut.mutate()}
                  disabled={saveMut.isPending}
                  className="h-8 px-3 rounded-xl clay-sm bg-card flex items-center gap-1.5 text-xs font-bold text-primary hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {saveMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="h-8 px-3 rounded-xl clay-sm bg-card flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:scale-105 transition-transform"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="h-[400px] rounded-2xl clay-pressed bg-muted/30 overflow-hidden">
        {isLoading && (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        {!isLoading && !hasData && (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground font-bold">
            No related concepts found.
          </div>
        )}
        {!isLoading && hasData && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            className={editing ? "" : "pointer-events-none"}
          >
            <Controls
              className={cn(editing ? "" : "hidden", "!shadow-none !rounded-xl !border-muted")}
            />
            <Background variant={BackgroundVariant.Dots} color="hsl(var(--muted-foreground) / 0.25)" size={1.5} gap={20} />
          </ReactFlow>
        )}
      </div>

      {editing && (
        <p className="text-xs text-muted-foreground font-bold text-center">
          Drag nodes to reposition · Click a node/edge then Delete to remove · Drag between handles
          to connect
        </p>
      )}
    </div>
  );
}
