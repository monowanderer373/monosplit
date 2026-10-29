/** Bounded session-only presentation provenance; never credentials, invite tokens or money. */
export function saveNavigationSession(prefix:string,key:string,value:string,limit=40){
  try{
    sessionStorage.setItem(prefix+key,value)
    const keys=Array.from({length:sessionStorage.length},(_,i)=>sessionStorage.key(i)).filter((k):k is string=>!!k&&k.startsWith(prefix)&&k!==prefix+key)
    while(keys.length>=limit)sessionStorage.removeItem(keys.shift()!)
  }catch{/* Private browsing/disabled/full storage must not block navigation. */}
}
