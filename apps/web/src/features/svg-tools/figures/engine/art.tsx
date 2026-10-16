import art from "./artwork.json";
import {EngineLive} from "./live";

export function EngineArt() {
  return <EngineLive turn={art.turn} mesh={art.mesh} model={art.model} artwork={<div key="engine-art" className="engine-art" dangerouslySetInnerHTML={{__html:art.svg}}/>}/>;
}
