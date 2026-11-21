export interface PetalItem {
  id: string;
  leftPercent: number;
  delayMs: number;
  durationSec: number;
  symbol: string;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
  leftPercent: number;
}

interface AashirvadOverlayProps {
  petals: PetalItem[];
  reactions: FloatingReaction[];
}

export function AashirvadOverlay({ petals, reactions }: AashirvadOverlayProps) {
  if (petals.length === 0 && reactions.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden" aria-hidden="true">
      {petals.map((petal) => (
        <span
          key={petal.id}
          className="absolute -top-8 text-2xl animate-petal-fall select-none"
          style={
            {
              left: `${petal.leftPercent}%`,
              animationDelay: `${petal.delayMs}ms`,
              '--fall-duration': `${petal.durationSec}s`,
            } as React.CSSProperties
          }
        >
          {petal.symbol}
        </span>
      ))}

      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-16 animate-reaction-float flex flex-col items-center select-none"
          style={{ left: `${r.leftPercent}%` }}
        >
          <span className="text-3xl">{r.emoji}</span>
          <span className="text-[11px] font-medium text-[#FAF5EC] bg-[#1D0E30]/80 px-2 py-0.5 rounded-md mt-1">
            {r.senderName}
          </span>
        </div>
      ))}
    </div>
  );
}
