/* Local audio capture. Diagnostics contain counters/energy, never audio. */
(() => {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  // Match MongolianEndpoint in the working APK: 20-ms frames, 0.003 RMS,
  // 100 ms of active samples and 800 ms trailing quiet. Keep all raw samples.
  const RATE=16000, MAX=12, PAUSE=.8, MIN_VOICE=.1, THRESHOLD=.003;
  const MODEL_IDLE_MS=60000;
  let current=null, armed=null, last={phase:'idle'}, cached=null, idleTimer=null;
  const now=()=>Date.now();
  function closeModel(model=cached) {
    if(!model)return;
    if(model===cached){clearTimeout(idleTimer);idleTimer=null;cached=null;}
    if(model.closed)return;
    model.closed=true;model.rejectReady(new Error('Mongolian model preparation cancelled.'));
    model.pending?.reject(new Error('Mongolian recognition cancelled.'));model.pending=null;
    model.worker.terminate();
  }
  function keepModel(model) {
    if(model!==cached||model.closed)return;
    clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(!current)closeModel(model);},MODEL_IDLE_MS);
  }
  function getModel() {
    clearTimeout(idleTimer);idleTimer=null;
    if(cached&&!cached.closed)return cached;
    const model={worker:new Worker(new URL('mongolian_voice_worker.a1327608c2550c2b342f.js',base)),closed:false,pending:null};
    model.ready=new Promise((resolve,reject)=>{model.resolveReady=resolve;model.rejectReady=reject;});
    model.ready.catch(()=>{});cached=model;
    const failure=message=>{
      const error=new Error(message);model.error=error;model.rejectReady(error);model.pending?.reject(error);model.pending=null;
      if(current?.model===model)fail(current,message);
      closeModel(model);
    };
    model.worker.onmessage=event=>{
      if(model.closed)return;
      const m=event.data;
      if(m.type==='ready'){model.readyAt=now();model.resolveReady();}
      else if(m.type==='result'){model.pending?.resolve(m.text);model.pending=null;}
      else if(m.type==='error')failure(m.message||'Mongolian voice model failed.');
    };
    model.worker.onerror=()=>failure('Mongolian voice processing could not start. Retry or type your search.');
    model.worker.postMessage({type:'init'});
    return model;
  }
  async function warmup() {
    if(current)return;
    const model=getModel();
    // Preparation starts on language selection, without opening a microphone.
    // Idle expiry also bounds an initialization that never reports ready.
    keepModel(model);
    await model.ready;
    if(!current)keepModel(model);
  }
  function prepare() {
    if (armed) { clearTimeout(armed.timer); armed.context.close().catch(()=>{}); }
    const AC=window.AudioContext||window.webkitAudioContext;
    if (!AC) return;
    const a={context:new AC()};
    a.resumed=a.context.resume(); a.resumed.catch(()=>{});
    a.timer=setTimeout(()=>{if(armed===a){armed=null;a.context.close().catch(()=>{});}},30000);
    armed=a;
  }
  function diagnostics(s) {
    return {phase:s.phase,contextState:s.context?.state||'not-created',trackState:s.track?.readyState||'unknown',trackMuted:!!s.track?.muted,sampleRate:s.rate||0,callbacks:s.callbacks,frames:s.frames,rms:s.rms,peak:s.peak,maximumRms:s.maximumRms||0,voicedSeconds:s.voiced,silenceSeconds:s.silence,stopReason:s.reason||null,modelReused:!!s.modelReused,modelWaitMs:s.modelWaitMs??null,decodeMs:s.decodeMs??null,inputGain:s.inputGain||1};
  }
  function release(s) {
    clearTimeout(s.limit);clearTimeout(s.frameDeadline);
    if(s.processor){s.processor.onaudioprocess=null;s.processor.disconnect();}
    s.source?.disconnect();s.mute?.disconnect();
    if(s.context)s.context.onstatechange=null;
    for(const t of s.media?.getTracks()||[]){t.onended=null;t.onmute=null;t.onunmute=null;t.stop();}
    s.context?.close().catch(()=>{});s.recording=false;
  }
  function finish(s,reason) {
    if(!s||s.finished||s.cancelled)return;
    s.finished=true;s.reason=reason;release(s);s.resolveCapture?.();
  }
  function fail(s,message) {
    if(s.cancelled||s.finished)return;
    s.reason=message;s.rejectCapture?.(new Error(message));
  }
  async function bounded(s,p,ms,message) {
    let timer;
    try{return await Promise.race([p,s.cancelledPromise.then(()=>{throw new Error('cancelled');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);})]);}
    finally{clearTimeout(timer);}
  }
  function resample(chunks,rate) {
    const input=new Float32Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;
    for(const c of chunks){input.set(c,at);at+=c.length;}
    const out=new Float32Array(Math.floor(input.length*RATE/rate));
    for(let i=0;i<out.length;i++){const p=i*rate/RATE,l=Math.floor(p),f=p-l;out[i]=input[l]*(1-f)+input[Math.min(l+1,input.length-1)]*f;}
    return out;
  }
  function feedEndpoint(s,chunk) {
    const d=s.endpoint??={size:Math.round(s.rate*.02),count:0,active:0,energy:0,voiced:0,silence:0};
    for(const sample of chunk){
      if(Math.abs(sample)>THRESHOLD)d.active++;
      d.energy+=sample*sample;
      if(++d.count===d.size){
        if(Math.sqrt(d.energy/d.size)>THRESHOLD){d.voiced+=d.active;d.silence=0;}
        else d.silence+=d.size;
        d.count=0;d.active=0;d.energy=0;
      }
    }
    s.voiced=d.voiced/s.rate;s.silence=d.silence/s.rate;
  }
  async function recognize(status) {
    if(current)throw new Error('A Mongolian recording is already active. Stop it and retry.');
    const s={phase:'starting',recording:false,cancelled:false,finished:false,closed:false,chunks:[],callbacks:0,frames:0,voiced:0,silence:0,rms:0,peak:0};
    s.cancelledPromise=new Promise(resolve=>s.resolveCancel=resolve);current=s;
    try {
      s.modelReused=!!cached?.readyAt;
      s.model=getModel();
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone recording requires a secure HTTPS browser page.');
      if(!armed)prepare();
      if(!armed)throw new Error('This browser does not support on-device audio capture. Type your search.');
      const a=armed;armed=null;clearTimeout(a.timer);s.context=a.context;
      status('Requesting Mongolian microphone access...');
      // Request hardware/browser level control, as the native recorder does.
      // Browsers may ignore this preference; do not claim a calibrated gain.
      const permission=navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      permission.then(media=>{if(s.cancelled||s.closed)for(const t of media.getTracks())t.stop();},()=>{});
      s.media=await bounded(s,permission,20000,'Microphone permission did not complete. Allow access and tap the microphone again.');
      await bounded(s,a.resumed,4000,'Audio is suspended. Tap the microphone again, or type your search.');
      if(s.context.state!=='running')throw new Error('Audio is not running. Tap the microphone again, or type your search.');
      s.rate=s.context.sampleRate;
      if(!Number.isFinite(s.rate)||s.rate<8000||s.rate>192000)throw new Error('The browser returned an unsupported microphone sample rate.');
      s.track=s.media.getAudioTracks()[0];
      if(!s.track||s.track.readyState==='ended')throw new Error('No live microphone track is available. Retry or type your search.');
      if(s.model.closed)throw s.model.error||new Error('Mongolian voice model could not start. Retry or type your search.');
      const captured=new Promise((resolve,reject)=>{s.resolveCapture=resolve;s.rejectCapture=reject;});captured.catch(()=>{});
      s.source=s.context.createMediaStreamSource(s.media);
      s.processor=s.context.createScriptProcessor(4096,1,1);s.mute=s.context.createGain();s.mute.gain.value=0;
      const watchFrames=()=>{clearTimeout(s.frameDeadline);s.frameDeadline=setTimeout(()=>fail(s,s.frames?'Microphone audio stopped reaching the app. Retry or type your search.':'No audio frames reached the app. Check microphone access and retry.'),4000);};
      s.processor.onaudioprocess=event=>{
        if(!s.recording||s.finished||s.cancelled)return;
        const input=event.inputBuffer.getChannelData(0),remaining=Math.max(0,Math.floor(s.rate*MAX)-s.frames);
        const chunk=new Float32Array(input.subarray(0,remaining));if(!chunk.length)return;
        let energy=0,peak=0;for(const v of chunk){if(!Number.isFinite(v)){fail(s,'The microphone returned invalid audio samples.');return;}energy+=v*v;peak=Math.max(peak,Math.abs(v));}
        s.chunks.push(chunk);s.callbacks++;s.frames+=chunk.length;s.rms=Math.sqrt(energy/chunk.length);s.peak=Math.max(s.peak,peak);s.maximumRms=Math.max(s.maximumRms||0,s.rms);watchFrames();
        if(s.callbacks===1){s.phase='listening';status('Listening in Mongolian... Speak, then pause. Recording finishes automatically.');}
        const elapsed=s.frames/s.rate;
        if(elapsed>=(s.nextLevelUpdate||.5)){
          s.nextLevelUpdate=elapsed+.5;
          const level=peak>=.98?'very loud':s.rms>=THRESHOLD?'sound detected':s.rms>=.0001?'low':'silent';
          status('Listening in Mongolian... Microphone level: '+level+'. Speak, then pause.');
        }
        feedEndpoint(s,chunk);
        if(s.voiced>=MIN_VOICE&&s.silence>=PAUSE)finish(s,'pause');
        else if(s.voiced<MIN_VOICE&&s.frames/s.rate>=6)finish(s,'no-speech');
        else if(remaining<=input.length)finish(s,'maximum-duration');
      };
      s.track.onended=()=>fail(s,'The microphone was disconnected or interrupted. Retry or type your search.');
      s.context.onstatechange=()=>{if(s.recording&&s.context.state!=='running')fail(s,'Audio was suspended or interrupted. Tap the microphone again to retry.');};
      s.source.connect(s.processor);s.processor.connect(s.mute);s.mute.connect(s.context.destination);
      s.recording=true;s.phase='waiting-for-audio';watchFrames();
      s.limit=setTimeout(()=>finish(s,'maximum-duration'),MAX*1000);
      status('Starting microphone... Waiting for audio from the browser.');
      await bounded(s,captured,14000,'Recording did not finish. Retry or type your search.');
      if(!s.frames)throw new Error('No microphone audio was captured. Retry or type your search.');
      if(s.voiced<MIN_VOICE){
        s.phase='no-speech';
        throw new Error(s.peak<.0001
          ? 'The microphone sent silent audio. Check the selected microphone and try again, or type your search.'
          : 'The microphone captured sound, but not enough above the speech threshold. Try a normal speaking voice closer to the microphone, or type your search.');
      }
      const samples=resample(s.chunks,s.rate);s.chunks=[];
      // Match the APK: use captured samples without a second software-gain pass.
      // The browser/device gain-control request is already made at capture time.
      s.phase='loading-model';status('Processing recorded audio on this device... The voice model may take longer to load on first use.');
      const waitingAt=now();
      await bounded(s,s.model.ready,60000,'Mongolian voice model did not load in time. Connect to the internet and retry, or type your search.');
      s.modelWaitMs=now()-waitingAt;
      s.phase='transcribing';status('Recognizing Mongolian on this device... Wait for the result before starting another word.');
      const decodeAt=now();
      const decoded=new Promise((resolve,reject)=>{s.model.pending={resolve,reject};});
      decoded.catch(()=>{});
      s.model.worker.postMessage({type:'decode',samples},[samples.buffer]);
      const text=await bounded(s,decoded,45000,'Mongolian recognition took too long. Try a shorter phrase or type your search.');
      s.decodeMs=now()-decodeAt;
      s.phase='complete';return text;
    } catch(error) {
      if(s.cancelled){s.phase='cancelled';return '';}
      s.phase='error';s.reason=error.message;
      if(error?.name==='NotAllowedError')throw new Error('Allow microphone access for this website in Safari Settings, then retry or type your search.');
      if(error?.name==='NotFoundError'||error?.name==='NotReadableError')throw new Error('The browser could not open the microphone. Stop other recording apps and retry.');
      throw error;
    } finally {
      s.closed=true;last=diagnostics(s);release(s);s.chunks=[];
      if(current===s)current=null;
      if(s.phase==='complete'&&!s.cancelled)keepModel(s.model);else closeModel(s.model);
    }
  }
  function cancel(keepIdle=false){
    if(armed){clearTimeout(armed.timer);armed.context.close().catch(()=>{});armed=null;}
    if(!current){if(!keepIdle)closeModel();return;}
    const s=current;s.cancelled=true;s.resolveCancel();release(s);closeModel(s.model);current=null;
  }
  globalThis.lexiconMongolianVoice={prepare,warmup,recognize,get recording(){return current?.recording||false;},get diagnostics(){return current?diagnostics(current):{...last};},finish(){finish(current,'manual');},cancel(){cancel();},cancelForNewRecording(){cancel(true);}};
})();
