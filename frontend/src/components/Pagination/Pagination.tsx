import React from "react";
import "./Pagination.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronCircleLeft,
  faChevronCircleRight,
} from "@fortawesome/free-solid-svg-icons";
import { showPages } from "./PaginationMethods";
import { Spinner } from "../../components/Spinner/Spinner";
interface IPagination {
  totalData: number;
  title: string;
  startFilter: (key: string, value: string | number) => void;
  currentPage: number;
  limit: number;
  totalLoader?: boolean;
}
function Pagination(props: IPagination) {
  const { title, totalData, startFilter, currentPage, limit, totalLoader } =
    props;
  const changePage = (direction: string, page: number) => {
    if (direction === "back" && currentPage !== 0) {
      startFilter("page", page);
    }
    if (direction === "direct") {
      startFilter("page", page);
    }
    if (
      direction === "forward" &&
      currentPage !== Math.ceil(totalData / limit)
    ) {
      startFilter("page", page);
    }
  };
  return (
    <div className="pagination-container">
      <div className="left-side">
        <div className="total">
          <p className="left-text">Total de {title}:</p>
          {totalLoader ? (
            <Spinner size={1} width={0.1} color="var(--app-accent)" />
          ) : (
            <p className="left-text">{totalData}</p>
          )}
        </div>
        <p className="left-text">Datos por página: {limit}</p>
      </div>
      <div className="right-side">
        <FontAwesomeIcon
          icon={faChevronCircleLeft}
          onClick={() => changePage("back", currentPage - 1)}
        />
        {showPages(currentPage + 1, totalData, limit).map(
          (val: number | string, index: number) => {
            return (
              <p
                key={"paginate_" + index}
                className={
                  currentPage + 1 === val
                    ? "selected "
                    : val === "..."
                    ? "points"
                    : "unselected"
                }
                onClick={() =>
                  typeof val === "number" && val !== currentPage + 1
                    ? changePage("direct", val - 1)
                    : () => {}
                }
              >
                {val}
              </p>
            );
          }
        )}
        <FontAwesomeIcon
          icon={faChevronCircleRight}
          onClick={() => changePage("forward", currentPage + 1)}
        />
      </div>
    </div>
  );
}
export default Pagination;
