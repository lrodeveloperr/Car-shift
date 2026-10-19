// YouTube Playables host adapter. Uses the ytgame SDK inside Playables; elsewhere falls back to localStorage
// and page visibility so the same build runs in a normal browser for development.
const KEY='shape-shifting-vehicle-race-v1';

export function connectHost(){
  const yt=typeof ytgame!=='undefined'&&ytgame?.IN_PLAYABLES_ENV?ytgame:null;
  const call=(fn,...args)=>{try{return fn?.(...args);}catch(e){console.warn(e);}};
  const storage=yt?{
    load:()=>yt.game.loadData(),
    save:value=>yt.game.saveData(value),
  }:{
    async load(){try{return localStorage.getItem(KEY);}catch{return null;}},
    async save(value){localStorage.setItem(KEY,value);},
  };
  return {
    inPlayables:!!yt,storage,
    firstFrameReady(){call(yt?.game?.firstFrameReady);},
    gameReady(){call(yt?.game?.gameReady);},
    onPause(pause,resume){
      if(yt){call(yt.system?.onPause,pause);call(yt.system?.onResume,resume);return;}
      document.addEventListener('visibilitychange',()=>document.hidden?pause():resume());
    },
    // YouTube owns the audio switch inside Playables; the game must stay silent while it is off.
    audioEnabled(){return yt?call(yt.system?.isAudioEnabled)!==false:true;},
    onAudioChange(callback){if(yt)call(yt.system?.onAudioEnabledChange,callback);},
    sendScore(value){Promise.resolve(call(yt?.engagement?.sendScore,{value})).catch(()=>{});},
    logError(){call(yt?.health?.logError);},
  };
}
