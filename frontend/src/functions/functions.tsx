export function sortArrayByName(array: any){
    let newArray = array.sort((a:any, b:any) => {return a.name.localeCompare(b.name);});
    newArray = newArray.sort((a:any, b:any) => {return b.type.localeCompare(a.type);});
    return newArray;
}
export function transformBase64ToMp3 (base64: string) {

    return base64;
}