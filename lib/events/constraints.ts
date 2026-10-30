import type { VenueProfile } from '../../types/lab';
export function interpretConstraints(venue:VenueProfile) {
 const text=venue.constraints.toLowerCase();
 const silent=/\b(no|without)\s+(audio(?:\s+playback)?|(?:amplified\s+)?(?:sound|music)|speakers)\b|\bsilent[- ]only\b/.test(text);
 const noRefreshments=/\b(no|without)\s+(food|drinks|refreshments|catering)\b/.test(text);
 const largePrint=/large[- ]print|low vision|visually impaired/.test(text);
 const seated=/wheelchair|step[- ]free|seated|no stairs|limited mobility/.test(text);
 const noScreen=/no\s+(screen|projector)|without\s+(screen|projector)/.test(text);
 const noWriting=/no\s+(paper|writing|pens)|cannot write/.test(text);
 const time=text.match(/(?:max(?:imum)?|at most|no more than)\s*(\d{1,3})\s*(?:minutes?|mins?)\b/);
 const capacity=text.match(/(?:max(?:imum)?(?: capacity)?|at most)\s*[:=]?\s*(\d{1,3})\s*(?:guests|people|attendees)\b/);
 return {silent,noRefreshments,largePrint,seated,noScreen,noWriting,maxDuration:time?Math.max(1,Number(time[1])):undefined,maxGuests:capacity?Math.max(2,Number(capacity[1])):undefined};
}
export function groupPlan(venue:VenueProfile) {
 const groupSize=venue.atmosphere==='Slow & cozy'?6:venue.atmosphere==='Playful & creative'?8:10;
 const groups=Math.ceil(venue.capacity/groupSize);
 return {groups,groupSize,delivery:groups===1?'one seated circle with optional individual participation':`${groups} seated table groups of at most ${groupSize}, with a host-led station rotation and clear routes`};
}
