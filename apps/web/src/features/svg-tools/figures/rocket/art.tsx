import art from "./artwork.json";
import { RocketLive } from "./live";

export function RocketArt() {
  return <RocketLive model={art.model} artwork={<div key="rocket-art" className="rocket-art" dangerouslySetInnerHTML={{__html:art.svg}} />} />;
}
