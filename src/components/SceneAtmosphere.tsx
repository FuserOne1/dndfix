import { memo } from 'react';
import type { ScenePresentation } from '../game/scene-presentation';

function SceneAtmosphere({ presentation }: { presentation: ScenePresentation }) {
  return <div className={`scene-atmosphere weather-${presentation.weather} tension-${presentation.tension}`} aria-hidden="true">
    <div className="scene-ambient-glow"/>
    <div className="scene-weather-layer"/>
    <div className="scene-mist scene-mist-a"/>
    <div className="scene-mist scene-mist-b"/>
    <div className="scene-particles">{Array.from({ length: 12 }, (_, index) => <i key={index}/>)}</div>
    <div className="scene-grain"/>
    <div className="scene-vignette"/>
  </div>;
}

export default memo(SceneAtmosphere);

