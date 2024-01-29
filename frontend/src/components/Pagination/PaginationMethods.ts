export const showPages = (page: number, allData: number, limit: number) => {
    let totalPages = Math.ceil(allData/limit);
    let showPages = totalPages > 3 ? 4 : totalPages;
    let data = [];
    let enteredCase = false;
    if(totalPages <= 4){
        for(let i=0; i<showPages; i++){
            data.push(i+1);
        }
    }
    else{
        if(page === 1) {
            enteredCase = true;
            for(let i=0; i<showPages; i++){
                data.push(page+i);
            }
            if(totalPages > 4) {
                if(totalPages > 5){
                    data.push('...');
                }
                data.push(totalPages);
            }
        }
        if(page > 1 && (page <= (totalPages - (showPages - 1)))) {
            for(let i=-1; i<showPages-1; i++){
                if(page + i !== 1 && i === -1){
                    data.push(1);
                    if(page+i >  2){
                        data.push('...');
                    }
                }
                data.push(page+i);
                if(page + i !== totalPages && i === showPages-2){
                    if(page+i <  totalPages){
                        data.push('...');
                    }
                    data.push(totalPages);
                }
            }
        }    
        if(page > 1 && (page === (totalPages - (showPages - 2)))) {
            enteredCase = true;
            for(let i=-2; i<showPages-2; i++){
                if(page + i !== 1 && i === -2){
                    data.push(1);
                    if(page+i >  2){
                        data.push('...');
                    }
                }
                data.push(page+i);
                if(page + i !== totalPages && i === showPages-3){
                    data.push(totalPages);
                }
            }
        }
        if(page > 1 && (page === (totalPages - (showPages - 3)))) {
            enteredCase = true;
            for(let i=-2; i<showPages-2; i++){
                if(page + i !== 1 && i === -2){
                    data.push(1);
                    if(page+i >  2){
                        data.push('...');
                    }
                }
                data.push(page+i);
                if(page + i !== totalPages && i === showPages-3){
                    if(page+i <  totalPages){
                        data.push('...');
                    }
                    data.push(totalPages);
                }
            }
        }
        if(page === totalPages && (page !== 1) && !enteredCase) {
            enteredCase = true;
            if(totalPages > 4) {
                data.push(1);
                if(totalPages > 5){
                    data.push('...');
                }
            }
            for(let i=showPages-1; i > 0-1; i--){
                data.push(page-i);
            }
        }
    }
    return data
}