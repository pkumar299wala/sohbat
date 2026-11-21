import React, { useEffect, useRef, useState } from 'react';
import { Eraser, PenTool, Trash2 } from 'lucide-react';

export interface WhiteboardStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
}

interface ShyaamPatCanvasProps {
  isGuru: boolean;
  strokes: WhiteboardStroke[];
  onCommitStroke: (stroke: WhiteboardStroke) => void;
  onClearBoard: () => void;
}

const CHALK_COLORS = ['#FAF5EC', '#F3B33D', '#FB7185', '#34D399', '#93C5FD'];

export function ShyaamPatCanvas({
  isGuru,
  strokes,
  onCommitStroke,
  onClearBoard,
}: ShyaamPatCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [color, setColor] = useState(CHALK_COLORS[0]);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const activePointsRef = useRef<{ x: number; y: number }[]>([]);
  const drawingRef = useRef(false);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#140A24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle chalk-board margin frame
    ctx.strokeStyle = 'rgba(243, 179, 61, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    const drawStroke = (s: {
      points: { x: number; y: number }[];
      color: string;
      width: number;
      tool: 'pen' | 'eraser';
    }) => {
      if (s.points.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.tool === 'eraser' ? '#140A24' : s.color;
      ctx.lineWidth = s.tool === 'eraser' ? s.width * 4 : s.width;
      ctx.moveTo(s.points[0].x * canvas.width, s.points[0].y * canvas.height);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x * canvas.width, s.points[i].y * canvas.height);
      }
      ctx.stroke();
      ctx.restore();
    };

    strokes.forEach(drawStroke);
    if (activePointsRef.current.length > 1) {
      drawStroke({
        points: activePointsRef.current,
        color,
        width: 3,
        tool,
      });
    }
  };

  useEffect(() => {
    const resize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redraw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isGuru) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    activePointsRef.current = [getNormalizedPoint(e)];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isGuru || !drawingRef.current) return;
    activePointsRef.current.push(getNormalizedPoint(e));
    redraw();
  };

  const handlePointerUp = () => {
    if (!isGuru || !drawingRef.current) return;
    drawingRef.current = false;
    const pts = [...activePointsRef.current];
    activePointsRef.current = [];
    if (pts.length >= 2) {
      onCommitStroke({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        points: pts,
        color,
        width: 3,
        tool,
      });
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#140A24]">
      {/* Dedicated non-overlapping top strip for Shyaam-Pat tools */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3D1F63] bg-[#1D0E30] shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#FAF5EC]">
          <PenTool className="w-3.5 h-3.5 text-[#F3B33D]" />
          <span className="font-display font-medium">Shyaam-Pat</span>
          {!isGuru && <span className="text-[#E8DEC8]/70">· Guruji writing board</span>}
        </div>
        {isGuru && (
          <div className="flex items-center gap-2">
            {CHALK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Select chalk color ${c}`}
                onClick={() => {
                  setColor(c);
                  setTool('pen');
                }}
                className={`w-5 h-5 rounded-full border cursor-pointer ${
                  tool === 'pen' && color === c ? 'border-[#F3B33D] scale-110' : 'border-white/25'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <button
              type="button"
              onClick={() => setTool((t) => (t === 'eraser' ? 'pen' : 'eraser'))}
              title="Eraser"
              className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                tool === 'eraser' ? 'bg-[#E59819] text-[#1D0E30]' : 'bg-[#2B1547] text-[#FAF5EC]'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClearBoard}
              title="Clear Shyaam-Pat"
              className="p-1.5 rounded-lg bg-[#2B1547] text-rose-300 hover:bg-rose-950/60 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Canvas occupies remaining center space */}
      <div ref={containerRef} className="flex-1 w-full h-full min-h-0">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`w-full h-full block touch-none ${isGuru ? 'cursor-crosshair' : 'cursor-default'}`}
        />
      </div>
    </div>
  );
}
