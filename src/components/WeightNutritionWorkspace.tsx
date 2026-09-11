"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import WeightsManager from "./WeightsManager";

const NutritionManager = dynamic(() => import("./NutritionManager"), { loading: () => <div className="loading-state">칼로리 기록 준비 중</div> });

export default function WeightNutritionWorkspace() {
  const [view, setView] = useState("weight");
  const [visited, setVisited] = useState(false);
  function select(value: string) {
    if (value === "nutrition") setVisited(true);
    setView(value);
  }
  return <>
    <div className="tracking-tabs"><div className="segmented" role="tablist" aria-label="체중과 칼로리" onKeyDown={(event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? "weight" : event.key === "End" ? "nutrition" : view === "weight" ? "nutrition" : "weight";
      select(next);
      event.currentTarget.querySelector<HTMLButtonElement>("#" + next + "-tab")?.focus();
    }}>
      <button id="weight-tab" role="tab" tabIndex={view === "weight" ? 0 : -1} aria-selected={view === "weight"} aria-controls="weight-panel" onClick={() => select("weight")}>체중</button>
      <button id="nutrition-tab" role="tab" tabIndex={view === "nutrition" ? 0 : -1} aria-selected={view === "nutrition"} aria-controls="nutrition-panel" onClick={() => select("nutrition")}>칼로리</button>
    </div></div>
    <div id="weight-panel" role="tabpanel" aria-labelledby="weight-tab" hidden={view !== "weight"}><WeightsManager /></div>
    <div id="nutrition-panel" role="tabpanel" aria-labelledby="nutrition-tab" hidden={view !== "nutrition"}>{visited && <NutritionManager />}</div>
  </>;
}
