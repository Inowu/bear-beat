
import React, { useState } from 'react'
import './Pagination.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronCircleLeft, faChevronCircleRight } from '@fortawesome/free-solid-svg-icons';
import { showPages } from './PaginationMethods';
const limit = 100;
interface IPagination {
    totalData: number;
    title: string;
    startFilter: (key: string, value: string | number)=> void;
    currentPage: number;
}
function Pagination (props: IPagination) {
    const { title, totalData, startFilter, currentPage} = props;
    const changePage = (direction: string, page: number) => {
        if(direction === "back"  && currentPage !== 0){
            startFilter('page', page)
        }
        if(direction === "direct"){
            startFilter('page', page)
        }
        if(direction === "forward" && currentPage !== Math.ceil(totalData/limit)){
            startFilter('page', page)
        }
    }
    return (
        <div className='pagination-container'>
            <p className='left-text'>Total de {title}: {totalData}</p>
            <div className='right-side'>
                <FontAwesomeIcon icon ={faChevronCircleLeft} onClick={()=> changePage('back', currentPage - 1)}/>
                {showPages(currentPage + 1, totalData, limit).map((val: number | string, index: number)=>{
                    return (
                        <p 
                            key={"paginate_"+ index} 
                            className={(currentPage +1 ) === val ?'selected ' : (val === "..." ? 'points': 'unselected') }
                            onClick={()=> (typeof val === 'number' && val !== currentPage + 1) ? changePage('direct', val-1): ()=>{}}
                        >
                            {val}
                        </p>
                    )
                })}
                <FontAwesomeIcon icon ={faChevronCircleRight} onClick={()=> changePage('forward', currentPage + 1)}/>
            </div>
        </div>
    )
}
export default Pagination;