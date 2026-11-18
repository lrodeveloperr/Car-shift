// YouTube Playables host adapter. Uses the ytgame SDK inside Playables; elsewhere falls back to localStorage
// and page visibility so the same build runs in a normal browser for development.
const KEY='shape-shifting-vehicle-race-v1';
let memory=null;

export function connectHost(){
  const yt=typeof ytgame!=='undefined'&&ytgame?.IN_PLAYABLES_ENV?ytgame:null;
  const call=(fn,...args)=>{try{return fn?.(...args);}catch(e){console.warn(e);}};
  const storage=yt?{
    load:()=>yt.game.loadData(),
    save:value=>yt.game.saveData(value),
  }:{
    // Outside Playables, browser storage can be blocked (private windows, sandboxed previews). Then progress lives in
    // memory for the session instead of every save failing, which would stop races from starting.
    async load(){try{return localStorage.getItem(KEY);}catch{return memory;}},
    async save(value){try{localStorage.setItem(KEY,value);}catch{memory=value;}},
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
    // Ads. YouTube's ads API is a public preview and may change. An interstitial is awaited and its outcome ignored.
    // A rewarded video reports 'earned', 'skipped' (closed early) or 'unavailable' (no ad for this player, or no SDK).
    async interstitial(){if(!yt?.ads?.requestInterstitialAd)return;try{await yt.ads.requestInterstitialAd();}catch{}},
    async rewarded(id){
      if(!yt?.ads?.requestRewardedAd)return 'unavailable';
      try{return await yt.ads.requestRewardedAd(id)===true?'earned':'skipped';}catch{return 'unavailable';}
    },
    sendScore(value){Promise.resolve(call(yt?.engagement?.sendScore,{value})).catch(()=>{});},
    logError(){call(yt?.health?.logError);},
  };
}
