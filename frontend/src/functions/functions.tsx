export function sortArrayByName(array: any){
    let newArray = array.sort((a:any, b:any) => {return a.name.localeCompare(b.name);});
    newArray = newArray.sort((a:any, b:any) => {return b.type.localeCompare(a.type);});
    return newArray;
}
export function transformBase64ToMp3 (base64: string) {
// Decode the base64 string into binary data
const binaryMp3 = atob(base64);

// Create a Blob from the binary data
const blob = new Blob([new Uint8Array(binaryMp3.length).map((_, i) => binaryMp3.charCodeAt(i))], {
  type: 'audio/mpeg'
});

// Generate a temporary URL for the Blob
const mp3Url = URL.createObjectURL(blob);

// Create an HTML audio element and set its src attribute
// const audioElement = new Audio(mp3Url);
    console.log(mp3Url);
return mp3Url;
}

export function transformBiteToGb (bite: bigint){
    let gb: number = +bite?.toString()/1073741824;
    return Math.round(gb);
}
export function getCompleted (used:bigint, available: bigint){
    let ava = +available?.toString()  === 0 ? 1 : +available?.toString();
    let use = +used?.toString();
    let percentage = (use/ava) * 100;
    return Math.round(percentage)
}