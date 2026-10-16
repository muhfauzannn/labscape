import artwork from "./artwork.json";
import { ComputerLive } from "./live";

export function ComputerArt() {
  const { svg, keys, down, screenMid, textX, maxChars } = artwork;
  return (
    <ComputerLive
      model={{ keys, down: down as [number, number], screenMid, textX, maxChars }}
      artwork={<div key="computer-art" className="terminal-art" dangerouslySetInnerHTML={{ __html: svg }} />}
    />
  );
}
