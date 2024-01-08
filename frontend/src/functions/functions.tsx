export function sortArrayByName(array: any){
    let newArray = array.sort((a:any, b:any) => {return a.name.localeCompare(b.name);});
    newArray = newArray.sort((a:any, b:any) => {return b.type.localeCompare(a.type);});
    return newArray;
}
export function convertBase64ToMP3(file: any) {
    const binaryData = atob(file);

    const byteArray = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      byteArray[i] = binaryData.charCodeAt(i);
    }
    const mp3Blob = new Blob([byteArray], { type: 'audio/mp3' });
    const url = URL.createObjectURL(mp3Blob);
    return url
  };
  export function downloadMP3 (file: any, name: string){
    // Create a temporary anchor element
    const a = document.createElement('a');
    a.href = convertBase64ToMP3(file);
    a.download = name +'.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
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
export const handleChangeBigint = (gigas: number | string) => {
  // Here, we're using BigInt to handle big integers.
  const value = gigas;
  try {
    const parsedValue = BigInt(value)
    return parsedValue
    // formik.setFieldValue('gigas', parsedValue);
  } catch (error) {
    // Handle invalid input, e.g., notify the user.
    console.error('Invalid input:', error);
  }
};
export const handleChangeBigIntToNumber = (gigas: number) => {
  // Convert input value to a number.
  const value = gigas
  if (!isNaN(value)) {
    return (Number(value));
  } else {
    // Handle invalid input, e.g., notify the user.
    console.error('Invalid input: not a number');
  }
};