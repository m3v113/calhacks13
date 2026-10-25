import { PALETTE } from "@/lib/colors";

// A grid of colors to pick from.
export default function Swatches({ value, onPick }: { value: string | null; onPick: (color: string) => void }) {
  return (
    <div className="swatches">
      {PALETTE.map((c) => (
        <button key={c} className={c === value ? "on" : ""} style={{ background: c }} aria-label={c} onClick={() => onPick(c)} />
      ))}
    </div>
  );
}
