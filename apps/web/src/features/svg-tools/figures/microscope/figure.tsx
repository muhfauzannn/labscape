"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { Dots, IsoFigure, Line, Plate, Solid } from "@/components/iso/react/draw";
import {
  ARM,
  ARM_GUSSETS,
  ARM_RIBS,
  ARM_RIVETS,
  ARM_SEAM,
  at,
  axisWindow,
  CLIP_SCREWS,
  BASE,
  BASE_GROOVE,
  BASE_LABEL,
  BASE_LABEL_LINE,
  BASE_LABEL_RULES,
  BASE_SCREWS,
  BODY_TUBE,
  BODY_TUBE_COLLARS,
  CONDENSER_BARREL,
  CONDENSER_CARRIER,
  CONDENSER_HEIGHT_KNOB,
  CONDENSER_HEIGHT_KNURLS,
  CONDENSER_LENS,
  CONDENSER_LENS_RING,
  CONDENSER_LOWER_RING,
  CORD,
  COVER_SLIP,
  DIOPTER_KNURLS,
  EYE_LENS,
  EYE_B,
  EYEPIECE,
  EYEPIECE_BANDS,
  EYECUP,
  FEET,
  FOCUS_BANDS,
  FOCUS_HOUSING,
  FOCUS_KNURLS,
  FOCUS_PINION,
  FOCUS_RACK,
  FOCUS_RACK_TICKS,
  FOCUS_STOPS,
  FOCUS_WHEELS,
  HEAD_SADDLE,
  HEAD_SADDLE_SCREWS,
  HEIGHT,
  HINGE_BOSS,
  HINGE_CAP,
  HINGE_LOCK,
  HINGE_RING,
  IRIS_HOUSING,
  IRIS_LEVER,
  IRIS_LEVER_CAP,
  IRIS_RING,
  LAMP_BEZEL,
  LAMP_DIFFUSER,
  LAMP_RING,
  LAMP_ROCKER,
  LAMP_STATUS,
  LAMP_WELL,
  NOSEPIECE,
  NOSEPIECE_DETENT,
  NOSEPIECE_FACE,
  NOSEPIECE_HUB,
  NOSEPIECE_RIM,
  OBJECTIVES,
  OPTICAL_AXIS,
  PRISM_BLOCK,
  PRISM_FACE,
  PRISM_HOUSING,
  PRISM_SEAMS,
  raySets,
  SLIDE,
  SLIDE_RIM,
  SPECIMEN_DOTS,
  SPECIMEN_LINES,
  STAGE,
  STAGE_CARRIAGE,
  STAGE_CLIPS,
  STAGE_CONTROL_KNURLS,
  STAGE_CONTROL_SHAFTS,
  STAGE_CONTROL_WHEELS,
  STAGE_HOLDER,
  STAGE_HOLDER_BOLTS,
  STAGE_INSET,
  STAGE_MARKS,
  STAGE_RAILS,
  STAGE_SCREWS,
  STAGE_STOP_BLOCKS,
  TUBE_A,
  TUBE_B,
  TUBE_LENSES,
  worldPath,
  worldSegment,
  WIDTH,
} from "./geometry";

function FlowRay({ d, className = "" }: { d: string; className?: string }) {
  return (
    <g className={`ms-flow-ray ${className}`} aria-hidden="true">
      <path className="ms-ray-glow" d={d} />
      <Line d={d} tone="blue" flow className="ms-ray-line" />
    </g>
  );
}

function RayBundle({ upper = false }: { upper?: boolean }) {
  if (upper) {
    const center = worldPath(raySets.center.slice(4));
    const marginalA = worldPath(raySets.marginalA.slice(4));
    const marginalB = worldPath(raySets.marginalB.slice(4));
    return (
      <g className="ms-upper-rays" aria-hidden="true">
        <FlowRay d={marginalA} />
        <FlowRay d={marginalB} />
        <FlowRay d={center} className="ms-flow-ray--core" />
      </g>
    );
  }

  const center = worldPath(raySets.center.slice(0, 5));
  const marginalA = worldPath(raySets.marginalA.slice(0, 5));
  const marginalB = worldPath(raySets.marginalB.slice(0, 5));
  return (
    <g className="ms-lower-rays" aria-hidden="true">
      <FlowRay d={marginalA} />
      <FlowRay d={marginalB} />
      <FlowRay d={center} className="ms-flow-ray--core" />
    </g>
  );
}

function FloorMarks() {
  const rules = Array.from({ length: 9 }, (_, index) => {
    const offset = -96 + index * 24;
    return (
      <React.Fragment key={index}>
        <Line d={worldSegment([offset, -78, -15], [offset, 78, -15])} tone="faint" />
        <Line d={worldSegment([-124, offset, -15], [124, offset, -15])} tone="faint" />
      </React.Fragment>
    );
  });
  return <g className="ms-floor-grid">{rules}</g>;
}

function MicroscopeArt({ paused }: { paused: boolean }) {
  const tubeWindow = axisWindow(TUBE_A, TUBE_B, 9.7, 0.17, 0.82, 0.44);
  const tubeWindowRule = axisWindow(TUBE_A, TUBE_B, 9.82, 0.16, 0.83, 0.49);
  return (
    <div className="ms-plate-wrap" data-paused={paused ? "" : undefined}>
      <Plate
        fig="FIG. 01"
        title="TRANSMITTED LIGHT · 10×"
        hint="Animated center and marginal rays"
        readout="10× objective / 100× total"
        keys={[
          { mark: "blue", label: "Light path" },
          { mark: "raised", label: "Machined housing" },
          { mark: "flat", label: "Glass optics" },
        ]}
        caption="The objective forms an inverted real image inside the tube; the eyepiece magnifies it for the eye."
      >
        <IsoFigure
          width={WIDTH}
          height={HEIGHT}
          label="A detailed isometric compound microscope. Light rises from the illuminator through the condenser and specimen, is collected by the objective, reflected through the prism, and travels along the cutaway tube to the eyepiece."
          className="ms-svg"
        >
          <defs>
            <filter id="ms-light-bloom" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.6" />
            </filter>
            <filter id="ms-floor-blur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="11" />
            </filter>
            <linearGradient id="ms-cutaway" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#142329" stopOpacity="0.96" />
              <stop offset="0.55" stopColor="#1e3940" stopOpacity="0.84" />
              <stop offset="1" stopColor="#142329" stopOpacity="0.96" />
            </linearGradient>
            <radialGradient id="ms-spot">
              <stop offset="0" stopColor="#8bdde5" stopOpacity="0.28" />
              <stop offset="1" stopColor="#8bdde5" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse className="ms-floor-shadow" cx={at([0, 0, -22])[0]} cy={at([0, 0, -22])[1] + 7} rx="180" ry="56" />
          <FloorMarks />

          <g className="ms-base-assembly">
            {FEET.map((foot, index) => (
              <g key={`foot-${index}`}>
                <Solid paths={foot.pad} tone="lo" crease="faint" className="ms-rubber" />
                <Solid paths={foot.flange} tone="mid" crease="faint" className="ms-metal" />
                <Line d={foot.ring} tone="lo" />
              </g>
            ))}
            <path className="iso-halo ms-base-halo" d={BASE.fill} />
            <Solid paths={BASE} tone="mid" crease="faint" className="ms-base ms-metal" />
            <Line d={BASE_GROOVE} tone="lo" />
            <Dots points={BASE_SCREWS} size={0.72} tone="mid" />
            <Solid paths={BASE_LABEL} tone="lo" crease="faint" className="ms-label-plate" />
            <Line d={BASE_LABEL_LINE} tone="faint" />
            {BASE_LABEL_RULES.map((d, index) => <Line key={`label-rule-${index}`} d={d} tone="lo" free />)}
            <Solid paths={LAMP_WELL} tone="lo" crease="faint" className="ms-light-well" />
            <Solid paths={LAMP_BEZEL} tone="mid" crease="faint" className="ms-metal" />
            <Solid paths={LAMP_DIFFUSER} tone="hi" crease="none" flat className="ms-diffuser" />
            <Line d={LAMP_RING} tone="faint" />
            <Solid paths={LAMP_ROCKER} tone="mid" crease="faint" className="ms-metal" />
            <Solid paths={LAMP_STATUS} tone="hi" crease="none" className="ms-indicator" />
            <path className="ms-cable" d={CORD[0]} />
            <circle className="ms-cable-terminal" cx={CORD[1][0]} cy={CORD[1][1]} r="1.4" />
            <circle className="ms-cable-terminal" cx={CORD[2][0]} cy={CORD[2][1]} r="1.4" />
          </g>

          <g className="ms-arm-assembly">
            <Solid paths={ARM} tone="mid" crease="faint" className="ms-casting" />
            {ARM_GUSSETS.map((part, index) => <Solid key={`gusset-${index}`} paths={part} tone="mid" crease="faint" className="ms-metal" />)}
            {ARM_RIBS.map((part, index) => <Solid key={`arm-rib-${index}`} paths={part} tone="hi" crease="faint" className="ms-metal" />)}
            <Line d={ARM_SEAM} tone="faint" />
            <Dots points={ARM_RIVETS} size={0.62} tone="lo" />
            <Solid paths={HINGE_BOSS} tone="hi" crease="faint" className="ms-metal" />
            <Solid paths={HINGE_CAP} tone="mid" crease="faint" className="ms-metal" />
            <Line d={HINGE_RING} tone="lo" />
            <Solid paths={HINGE_LOCK} tone="hi" crease="none" className="ms-metal" />
          </g>

          <g className="ms-stage-support">
            <Solid paths={STAGE_HOLDER} tone="lo" crease="faint" className="ms-metal" />
            <Dots points={STAGE_HOLDER_BOLTS} size={0.66} tone="mid" />
            {STAGE_RAILS.map((part, index) => <Solid key={`stage-rail-${index}`} paths={part} tone="mid" crease="faint" className="ms-metal" />)}
            {STAGE_STOP_BLOCKS.map((part, index) => <Solid key={`stop-${index}`} paths={part} tone="mid" crease="faint" className="ms-metal" />)}
            <Solid paths={FOCUS_HOUSING} tone="mid" crease="faint" className="ms-metal" />
            <Solid paths={FOCUS_RACK} tone="hi" crease="faint" className="ms-metal" />
            <Line d={FOCUS_RACK_TICKS.join("")} tone="lo" />
            <Solid paths={FOCUS_PINION} tone="lo" crease="faint" className="ms-metal" />
            {FOCUS_STOPS.map((part, index) => <Solid key={`focus-stop-${index}`} paths={part} tone="hi" crease="faint" className="ms-metal" />)}
          </g>

          <g className="ms-substage">
            <Solid paths={CONDENSER_CARRIER} tone="lo" crease="faint" className="ms-metal" />
            <Solid paths={CONDENSER_BARREL} tone="mid" crease="faint" className="ms-metal" />
            <Solid paths={CONDENSER_LOWER_RING} tone="hi" crease="faint" className="ms-metal" />
            <Solid paths={IRIS_HOUSING} tone="lo" crease="faint" className="ms-metal" />
            <Line d={IRIS_RING} tone="faint" />
            <Solid paths={CONDENSER_LENS} tone="hi" crease="none" flat className="ms-glass" />
            <Line d={CONDENSER_LENS_RING} tone="hi" />
            <Solid paths={IRIS_LEVER} tone="mid" crease="faint" className="ms-metal" />
            <Solid paths={IRIS_LEVER_CAP} tone="hi" crease="faint" className="ms-metal" />
            <Solid paths={CONDENSER_HEIGHT_KNOB} tone="mid" crease="faint" className="ms-metal" />
            {CONDENSER_HEIGHT_KNURLS.map((d, index) => <Line key={`cond-knurl-${index}`} d={d} tone="faint" />)}
          </g>

          <g className="ms-stage">
            <Solid paths={STAGE_CARRIAGE} tone="lo" crease="faint" className="ms-metal" />
            <Solid paths={STAGE} tone="hi" crease="faint" className="ms-stage-top" />
            <Line d={STAGE_INSET} tone="faint" />
            <Line d={STAGE_MARKS.join("")} tone="lo" />
            <Dots points={STAGE_SCREWS} size={0.58} tone="mid" />
            <Solid paths={SLIDE} tone="hi" crease="faint" className="ms-slide" />
            <Line d={SLIDE_RIM} tone="faint" />
            <Solid paths={COVER_SLIP} tone="hi" crease="faint" className="ms-coverslip" />
            <path className="ms-specimen" d={SPECIMEN_LINES[0]} />
            <path className="ms-specimen ms-specimen--branch" d={SPECIMEN_LINES[1]} />
            <g className="ms-specimen-detail">
              <Dots points={SPECIMEN_DOTS} size={0.7} tone="mid" />
            </g>
            {STAGE_CLIPS.map((part, index) => <Solid key={`stage-clip-${index}`} paths={part} tone="mid" crease="faint" className="ms-metal" />)}
            <Dots points={CLIP_SCREWS} size={0.57} tone="lo" />
          </g>

          <ellipse className="ms-specimen-spot" cx={at([0, 0, 64])[0]} cy={at([0, 0, 64])[1]} rx="43" ry="27" />
          <RayBundle />

          <g className="ms-controls">
            {STAGE_CONTROL_SHAFTS.map((part, index) => <Solid key={`stage-shaft-${index}`} paths={part} tone="lo" crease="none" className="ms-metal" />)}
            {STAGE_CONTROL_WHEELS.map((part, index) => <Solid key={`stage-wheel-${index}`} paths={part} tone="mid" crease="faint" className="ms-metal" />)}
            {STAGE_CONTROL_KNURLS.map((d, index) => <Line key={`stage-knurl-${index}`} d={d} tone="lo" />)}
            {FOCUS_WHEELS.map((part, index) => <Solid key={`focus-wheel-${index}`} paths={part} tone={index % 2 ? "hi" : "mid"} crease="faint" className="ms-metal" />)}
            {FOCUS_BANDS.map((part, index) => <Solid key={`focus-band-${index}`} paths={part} tone="lo" crease="none" className="ms-metal" />)}
            {FOCUS_KNURLS.map((d, index) => <Line key={`focus-knurl-${index}`} d={d} tone="faint" />)}
          </g>

          <g className="ms-objective-train">
            <Solid paths={NOSEPIECE} tone="mid" crease="faint" className="ms-metal" />
            <Line d={NOSEPIECE_RIM} tone="lo" />
            <Solid paths={NOSEPIECE_HUB} tone="hi" crease="faint" className="ms-metal" />
            <Line d={NOSEPIECE_FACE} tone="faint" />
            <Solid paths={NOSEPIECE_DETENT} tone="mid" crease="none" className="ms-metal" />
            {OBJECTIVES.map((lens, index) => (
              <g key={`objective-${index}`} className={index === 0 ? "ms-objective ms-objective--active" : "ms-objective"}>
                <Solid paths={lens.barrel} tone="mid" crease="faint" className="ms-metal" />
                <Solid paths={lens.upper} tone="hi" crease="faint" className="ms-metal" />
                <Solid paths={lens.collar} tone="mid" crease="faint" className="ms-metal" />
                <Solid paths={lens.nose} tone="lo" crease="faint" className="ms-metal" />
                <Solid paths={lens.glass} tone="hi" crease="none" flat className="ms-glass" />
                <Line d={lens.rim} tone="faint" />
              </g>
            ))}
          </g>

          <g className="ms-optical-head">
            <Solid paths={HEAD_SADDLE} tone="lo" crease="faint" className="ms-metal" />
            <Dots points={HEAD_SADDLE_SCREWS} size={0.66} tone="mid" />
            <Solid paths={BODY_TUBE} tone="hi" crease="faint" className="ms-body-tube" />
            {BODY_TUBE_COLLARS.map((part, index) => <Solid key={`tube-collar-${index}`} paths={part} tone="mid" crease="faint" className="ms-metal" />)}
            <Solid paths={EYEPIECE} tone="mid" crease="faint" className="ms-metal" />
            {EYEPIECE_BANDS.map((part, index) => <Solid key={`eyepiece-band-${index}`} paths={part} tone="hi" crease="faint" className="ms-metal" />)}
            <Solid paths={EYECUP} tone="lo" crease="faint" className="ms-rubber" />
            <Solid paths={EYE_LENS} tone="hi" crease="none" flat className="ms-glass" />
            {DIOPTER_KNURLS.map((d, index) => <Line key={`diopter-knurl-${index}`} d={d} tone="lo" />)}
            {TUBE_LENSES.map((part, index) => <Solid key={`tube-lens-${index}`} paths={part} tone="hi" crease="faint" className="ms-glass" />)}
            <path className="ms-tube-cutaway-edge" d={tubeWindowRule} />
            <path className="ms-tube-cutaway" d={tubeWindow} />
            <Line d={worldPath([[18, -11, 136], [45, -11, 177]])} tone="faint" />
            <path className="ms-intermediate-image" d={worldPath([[35.5, -10, 164], [37, -10, 168], [39, -10, 167], [40, -10, 164], [37, -10, 162], [35.5, -10, 164]], true)} />
          </g>

          <g className="ms-prism-and-objectives">
            <Solid paths={PRISM_HOUSING} tone="hi" crease="faint" className="ms-head-cast" />
            <Solid paths={PRISM_BLOCK} tone="mid" crease="faint" className="ms-prism" />
            <Solid paths={PRISM_FACE} tone="hi" crease="none" flat className="ms-prism-window" />
            {PRISM_SEAMS.map((d, index) => <Line key={`prism-seam-${index}`} d={d} tone={index ? "mid" : "faint"} />)}
          </g>

          <RayBundle upper />
          <g className="ms-ray-endpoints" aria-hidden="true">
            <circle className="ms-ray-stop" cx={at([0, 0, 64])[0]} cy={at([0, 0, 64])[1]} r="2.4" />
            <circle className="ms-ray-stop ms-ray-stop--image" cx={at([37, -9, 165])[0]} cy={at([37, -9, 165])[1]} r="2.1" />
            <circle className="ms-eye-aperture" cx={at(EYE_B)[0]} cy={at(EYE_B)[1]} r="3.8" />
          </g>
          <path className="ms-prism-glow" d={OPTICAL_AXIS[2]} />
          <path className="ms-prism-glint" d={worldPath([[0, -14, 119], [8, -14, 125], [16, -14, 125]])} />
          <path className="ms-illumination-pool" d={worldPath([[-13, -8, 61.8], [-7, -16, 61.8], [7, -16, 61.8], [13, -8, 61.8], [7, 0, 61.8], [-7, 0, 61.8]], true)} />
        </IsoFigure>
      </Plate>
    </div>
  );
}

export function MicroscopeFigure() {
  const [paused, setPaused] = React.useState(false);
  return (
    <div className="microscope-figure">
      <MicroscopeArt paused={paused} />
      <div className="ms-figure-tools">
        <span className="ms-live-indicator"><i /> {paused ? "LIGHT PATH HELD" : "ILLUMINATOR ACTIVE"}</span>
        <Button variant="primary" type="button" className="ms-flow-toggle" onClick={() => setPaused((value) => !value)}>
          <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
          {paused ? "Resume light path" : "Pause light path"}
        </Button>
      </div>
    </div>
  );
}

